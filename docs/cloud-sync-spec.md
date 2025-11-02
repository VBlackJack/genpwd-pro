# Cahier des charges — Providers Cloud & Sync « à la Roboform » (GenPwd Pro — Android)

> **But**: fournir à Codex un référentiel complet et actionnable pour implémenter la synchronisation multi-appareils avec providers cloud (Google Drive, OneDrive/SharePoint, Dropbox, WebDAV/Nextcloud), avec cache local chiffré, fonctionnement offline-first, résolution de conflits, et zéro-knowledge.

---

## 1) Contexte & objectifs

* **Produit**: GenPwd Pro (branche `android`).
* **Besoin**: ouvrir des « vaults » stockés sur différents drives, les rapatrier en local, les utiliser offline, puis **synchroniser automatiquement** toutes les modifications entre appareils.
* **Objectifs clés**:

  * Multi-providers (Drive, Graph/OneDrive, Dropbox, WebDAV/Nextcloud).
  * Zéro-knowledge (aucune donnée en clair côté provider, cache local chiffré au repos).
  * **Offline-first**: utilisable sans réseau, reprise fiable.
  * **Conflits sûrs**: pas de perte silencieuse, stratégie claire avec UI de résolution.
  * **Performances** & **robustesse** (WorkManager, backoff, throttling, reprise, écritures atomiques).

## 2) Périmètre

* **Dans le périmètre (Phase 1)**: abstraction providers, authentification, gestion de comptes, format vault chiffré, moteur de sync (pull/push), cache local, UX minimale (ajout compte, créer/importer/ouvrir vault, statut sync, résolution simple), tests & CI.
* **Hors périmètre (Phase 1)**: collaboration en temps réel, partages inter-comptes, webhooks/push natifs (on démarre en polling / delta).
* **Phase 2+ (facultatif)**: S3-compatible, partage de vault, webhooks/push, CRDT avancés item-level.

## 3) Définitions & hypothèses

* **Vault**: fichier unique chiffré (`vault.bin`) + journal interne des changements item-level.
* **Item**: entrée logique du vault (ex: credential). Le contenu **ne quitte jamais** l’app en clair.
* **Zéro-knowledge**: tout contenu (vault + journal) chiffré **avant** d’être écrit côté provider.
* **Horodatage**: utiliser UTC; ne pas faire confiance au clock du device exclusivement pour décider des conflits (préférer ETag/Rev + journal interne).

## 4) Architecture cible

* **UI**: écrans Comptes Cloud, Liste de vaults, Détails/Statut, Résolution de conflits, Réglages sécurité.
* **Domaine**: `Vault`, `VaultMeta`, `VaultItem`, `ProviderAccount`, `SyncState`, `Conflict`, `Change`.
* **Sync Engine**: orchestration pull/push via **WorkManager** (déclencheurs réseau/foreground/intervalle), backoff exponentiel, reprise et batching.
* **Abstraction Provider**: interface unique + implémentations (Drive, Graph/OneDrive, Dropbox, WebDAV/Nextcloud).
* **Stockage local**: Room (méta + état de sync + pending ops), cache fichiers **chiffrés**, secrets/tokens dans EncryptedSharedPreferences/Android Keystore.
* **Crypto**: Argon2id (KDF), AES-256-GCM (ou ChaCha20-Poly1305 fallback), header versionné, effacement mémoire sensible.

## 5) Modèle de données (logique)

```kotlin
// Identité d’un vault sur un provider
data class VaultId(val remotePath: String, val provider: ProviderKind, val accountId: String)

data class VaultMeta(
  val id: VaultId,
  val name: String,
  val version: Long,
  val lastModifiedUtc: Long,
  val size: Long,
  val remoteEtag: String?
)

data class Vault(
  val meta: VaultMeta,
  val items: List<VaultItem>,
  val changeVector: String // p.ex. deviceId + counter + lastChangeTime
)

data class SyncState(
  val vaultId: VaultId,
  val lastSyncUtc: Long,
  val localEtag: String?,   // hash du ciphertext local
  val remoteEtag: String?,  // ETag/Rev provider
  val pendingOps: List<PendingOp>
)
```

**Room** (exemple tables): `accounts`, `vault_meta`, `sync_state`, `pending_ops`, `audit_logs` (min).

## 6) Format `vault.bin` (v1)

* **Conteneur**: fichier unique chiffré (tout, y compris le journal interne).
* **Header** (non chiffré minimal, signé ou authentifié via AAD GCM) : `formatVersion`, `cipher`, `kdf`, `nonce/salt`, `deviceId`, `createdUtc`.
* **KDF**: Argon2id (t=3, m=64–128MB, p=2) — fallback PBKDF2 configurable si contraintes.
* **Chiffrement**: AES-256-GCM (nonce unique par écriture, stocker nonce dans header ou bloc méta).
* **Hash local**: `SHA-256(ciphertext)` → `localEtag`.
* **Journal interne**: liste d’opérations item-level (`add/update/delete`, `itemId`, `changeId`, `updatedAt`, `updatedBy`), compressée.

## 7) Abstraction provider (contrat stable)

```kotlin
interface CloudProvider {
  val kind: ProviderKind
  suspend fun authenticate(): ProviderAccount
  suspend fun listVaults(account: ProviderAccount): List<VaultMeta>
  suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag
  suspend fun upload(account: ProviderAccount, id: VaultId, data: ByteArray, ifMatchEtag: String?): ProviderWriteResult
  suspend fun createVault(account: ProviderAccount, name: String): VaultMeta
  suspend fun deleteVault(account: ProviderAccount, id: VaultId)
  suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges?
}
```

**Mapping ETag/Rev**:

* Google Drive → `md5Checksum` + `modifiedTime` ou révision; gérer `If-Match` via revisionId quand dispo.
* OneDrive/SharePoint (Graph) → `eTag`/`cTag` + `delta`.
* Dropbox → `rev` (+ `list_folder`/`continue`).
* WebDAV/Nextcloud → header `ETag` + `Last-Modified`.

## 8) Spécifications par provider

### 8.1 Google Drive

* **Auth**: OAuth2 PKCE (AppAuth), scopes minimaux (`appFolder` si possible; sinon dossier dédié `/GenPwdPro`).
* **Store**: un fichier `vault.bin`/vault dans un dossier dédié; métadonnées en `appProperties` (id, version).
* **Opérations**: list, create, download (media), upload (resumable si >4MB), if-match par révision.
* **Changes**: `changes.list` (cursor) si usage drive complet; sinon polling `modifiedTime`.
* **Quotas**: gérer 403/429 avec backoff exponentiel.

### 8.2 Microsoft Graph (OneDrive/SharePoint)

* **Auth**: OAuth2 PKCE, scopes Files.ReadWrite/AppFolder.
* **API**: `/drive/root:/GenPwdPro:/children`, `delta`, `@microsoft.graph.downloadUrl`.
* **Contrainte**: 429 Retry-After → respecter le délai exact.

### 8.3 Dropbox

* **Auth**: OAuth2 PKCE, scope `files.content.write/read`.
* **API**: `files/list_folder`, `files/download`, `files/upload`, `list_folder/continue` (delta).
* **Rev**: utiliser `rev` comme `remoteEtag`.

### 8.4 WebDAV/Nextcloud

* **Auth**: Basic/OAuth2 selon instance; stocker secrets chiffrés.
* **API**: PROPFIND, GET, PUT, MOVE; s’appuyer strictement sur `ETag`.
* **Spécificités**: locks, nommage, path case-sensitive, time skew.

## 9) Authentification & gestion de comptes

* **Lib**: AppAuth-Android (OAuth2 PKCE) quand applicable.
* **Stockage tokens**: EncryptedSharedPreferences (clé en Keystore).
* **Renouvellement**: silencieux (refresh_token) + re-auth guidée si erreur.
* **Sécurité**: aucun token en clair dans logs; rubriquer les scopes par provider.

## 10) Moteur de synchronisation (WorkManager)

* **Stratégie**:

  * **Pull-on-open**: à l’ouverture d’un vault, vérifier `remoteEtag` vs `localEtag` → rapatrier si différent.
  * **Push différé**: après modifications locales, planifier upload (batch, coalescing).
  * **Périodique**: job (15–60 min) + triggers (connectivité retrouvée, app foreground, device idle)
* **Opérations atomiques**: écriture en temp (`.tmp`) puis rename/move.
* **Backoff**: exponentiel (min 10s → max 1h), respecter Retry-After.
* **Reprise**: réseau intermittent → reprendre téléchargements/upload en chunking (Drive/Graph/Dropbox).
* **Observabilité**: journaliser étapes (niveau DEBUG), page « Diagnostics » exportable.

## 11) Gestion des conflits

* **Détection**: divergence `remoteEtag` vs `localEtag` + comparaison des journaux internes.
* **Règle par défaut**: **LWW** (Last-Writer-Wins) **à la granularité item**, jamais au niveau fichier entier.
* **Option**: **Keep both** — dupliquer l’item conflictuel avec suffixe `(conflict)`.
* **UI**: écran « Résoudre les conflits » (liste, détail, diff simple avant/après, actions Merge / Keep both / Choose remote/local).

## 12) Offline-first & cache local

* **Cache**: vault sur disque **toujours chiffré** (keystore pour clé locale d’enveloppe).
* **Mode avion**: lecture/édition possibles; pending ops en file; resync dès retour réseau.
* **Auto-lock**: délai d’inactivité configurable; support **BiometricPrompt**.

## 13) Sécurité

* **Zéro-knowledge**: le provider ne voit que du ciphertext.
* **KDF**: Argon2id; paramétrage équilibré pour mobiles (bench au démarrage pour calibrer).
* **AEAD**: AES-256-GCM (ou ChaCha20-Poly1305). Nonces uniques, stockage sécurisé.
* **Secrets**: tokens et clés protégés (Keystore + EncryptedSharedPreferences).
* **Hardening**: FLAG_SECURE (optionnel), éviter screenshots sur vues sensibles, pas de logs de secrets, effacement mémoire.

## 14) UX / UI — Parcours

1. **Ajouter un compte**: choisir provider → OAuth2 → succès → compte listé.
2. **Créer un vault**: choisir provider/dossier → nommer → définir secret maître/biométrie → upload initial.
3. **Importer**: choisir `vault.bin` existant → download → déchiffrer → ajout à la liste.
4. **Ouvrir**: vérif diff → rapatriement → déchiffrement en RAM → statut de sync en temps réel.
5. **Modifier**: enregistrement local + push asynchrone; notifications en cas d’erreur/conflit.
6. **Réglages**: auto-lock, biométrie, effacer cache, diagnostics.

## 15) Performances & limites

* **Chunking**: uploads/downloads segmentés (>4–8MB) avec reprise.
* **Batching**: coalescing des petites modifs; limiter réveils WorkManager.
* **Throttling**: Graph/Dropbox (429) → respecter Retry-After.
* **Taille vault**: recommandation < 50MB (v1) — au-delà, activer chunking obligatoire.

## 16) Journalisation & observabilité

* **Niveaux**: ERROR/WARN/INFO/DEBUG.
* **Diagnostics**: écran export (zip) avec logs (sanitisés), état sync, versions, deviceId; **jamais** de contenu sensible.

## 17) Plan de tests

* **Unit**: crypto (KDF, AEAD), parser vault, résolveur de conflits, mapping ETag.
* **Intégration**: mocks HTTP (WireMock/MockWebServer), scénarios offline→online, erreurs 401/403/429, reprise.
* **Instrumentation**: parcours complets UI (ajout compte, créer/importer/ouvrir, mode avion, conflit, reprise).
* **Non-régression**: jeu d’échantillons de vaults (v1), migration prête pour v2.

## 18) CI/CD & Qualité

* **Build**: Gradle; lint, detekt/ktlint, unit + instrumentation (avec émulateurs headless).
* **Secrets**: variables chiffrées CI; ne jamais logger tokens.
* **Artefacts**: rapport tests, coverage, APK debug.
* **Gate PR**: check-list (voir §22) + succès pipelines.

## 19) Compliance & confidentialité

* **Privacy Policy**: documenter chiffrement, stockage local, scopes; opt-in télémétrie.
* **Scopes**: minimaux par provider; `appFolder` privilégié quand possible.
* **Données**: pas d’analytics par défaut; aucune donnée en clair.

## 20) Planning (jalons)

* **M1 — Socle local (2–3 j)**: format `vault.bin` v1, crypto utils, Room, cache chiffré, CRUD local, écran Statut.
* **M2 — Abstraction + Google Drive (5–7 j)**: OAuth2, list/create/download/upload, ETag/if-match, pull/push de base.
* **M3 — Dropbox (3–5 j)**: delta, reprise.
* **M4 — OneDrive/Graph (3–5 j)**: delta, 429/backoff.
* **M5 — WebDAV/Nextcloud (3–5 j)**: ETag strict, locks.
* **M6 — Conflits avancés + UI (3–4 j)**: LWW item-level + écran résolution.
* **M7 — Background/polish (2–3 j)**: WorkManager périodique, notifications, réglages sécurité/biométrie.
* **M8 — Beta fermée (1–2 j)**: tests instruments, docs, diagnostics.

## 21) Critères d’acceptation (extraits)

* Ouvrir un vault distant **rapatrie** localement si différent, puis l’app affiche **À jour**.
* Modifs locales offline **se propagent** au retour réseau, sans duplication non justifiée.
* Conflits multi-appareils → **aucune perte silencieuse** (LWW item-level + copie conflict/merge UI).
* Zéro-knowledge: le provider ne reçoit **jamais** de données en clair.
* Désinstallation/réinstallation n’expose pas de secrets (keystore requis pour ré-accès).

## 22) Définition de Fini (DoD) & Check-list PR

* [ ] Couverture tests unit ≥ 80% pour crypto + format + résolveur.
* [ ] Tests intégration majeurs verts (offline→online, 401/403/429, reprise, conflit).
* [ ] Pas de secrets/tokens en clair (code, logs, artefacts CI).
* [ ] Lint/detekt/ktlint OK, warnings critiques résolus.
* [ ] UX: ajouter compte, créer/importer/ouvrir, statut sync, résolution conflits, réglages sécurité → validés.
* [ ] Documentation mise à jour (README Android, schémas sync, matrice providers, Privacy Policy draft).

## 23) Livrables attendus (Codex)

1. **Modules**:

   * `core-vault/` (crypto, format v1, journal, hash local)
   * `sync-engine/` (WorkManager, workers pull/push/périodique, backoff, reprise)
   * `providers-api/` + `provider-drive/`, `provider-graph/`, `provider-dropbox/`, `provider-webdav/`
   * `storage/` (Room, cache fichiers chiffrés, secrets)
2. **Interfaces & DTOs** (contrat §7) avec adapters si besoin.
3. **Écrans**: ProvidersList, AddAccount, VaultsList, VaultDetails (statut), ResolveConflict, Settings/Security, Diagnostics.
4. **Tests**: unit/int/instr + jeux d’essai vaults v1.
5. **Docs**: README, guides d’auth par provider (scopes, redirect URIs), schéma architecture & sync, guide release.

## 24) Conventions & qualité code

* **Langage**: Kotlin, coroutines/Flows, Retrofit/OkHttp, Hilt pour DI.
* **Erreurs**: sealed classes pour résultats (Success/RetryableError/FatalError), mapping HTTP standardisé.
* **Timeouts**: 10s connect, 30s read, 30s write (ajuster si chunking).
* **Répertoires**: feature-modules; pas de classes God; séparation claire domaine/données/UI.

## 25) Annexes — exemples d’API (esquisses)

```kotlin
// Upload atomique avec if-match
data class ProviderWriteResult(val newEtag: String, val modifiedUtc: Long)

suspend fun syncPush(vault: Vault) {
  val ciphertext = encryptVault(vault)
  val res = provider.upload(account, vault.meta.id, ciphertext, ifMatchEtag = vault.meta.remoteEtag)
  updateLocalMeta(etag = res.newEtag, lastModifiedUtc = res.modifiedUtc)
}

suspend fun syncPull(meta: VaultMeta) {
  val remote = provider.download(account, meta.id)
  if (remote.etag != meta.remoteEtag || sha256(remote.bytes) != meta.localHash) {
    writeLocalCipher(remote.bytes)
    updateLocalMeta(etag = remote.etag)
  }
}
```

---

### Fin du cahier des charges

Ce document sert d’unique référence pour lancer l’implémentation. Toute divergence ou contrainte provider non anticipée sera consignée et adressée via une Note de Conception (NDC) avant merge.
