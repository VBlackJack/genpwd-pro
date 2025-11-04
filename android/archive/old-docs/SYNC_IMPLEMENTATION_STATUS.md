# État d'implémentation de la synchronisation multi-appareils

**Date**: 2025-11-02
**Branche**: `claude/multi-device-sync-011CUji3n8ZxLmG7pQ2uDHEi`
**Basé sur**: Travail de Codex (`codex/implement-multi-device-sync-for-genpwd-pro`)

---

## ✅ Ce qui a été complété

### 1. Architecture modulaire (Codex + Claude)

Tous les modules Gradle sont créés et configurés :

```
android/
├── core-vault/          ✅ Cryptographie Argon2 + AES-256-GCM
├── providers-api/       ✅ Interface CloudProvider
├── provider-drive/      ✅ Google Drive (OAuth2 PKCE)
├── provider-dropbox/    ⚠️  Structure créée, auth à compléter
├── provider-graph/      ⚠️  Structure créée, auth à compléter
├── provider-webdav/     ⚠️  Structure créée, auth à compléter
├── storage/             ✅ Room + cache chiffré
└── sync-engine/         ✅ VaultSyncManager + ConflictResolver
```

### 2. Types et modèles de données

**Fichier**: `core-vault/src/main/kotlin/com/genpwd/corevault/VaultModels.kt`

✅ Types ajoutés :
- `ProviderKind` enum (GOOGLE_DRIVE, DROPBOX, ONEDRIVE, WEBDAV, NEXTCLOUD)
- `PendingOp` sealed class (Add, Update, Delete)
- `SyncState` data class
- `VaultId.provider` corrigé de String → ProviderKind

### 3. Cryptographie (core-vault)

**Fichier**: `VaultCryptoEngine.kt`

✅ Implémentation complète :
- Argon2id KDF (t=3, m=64MB, p=2)
- AES-256-GCM encryption
- Méthodes publiques :
  - `encryptVault(secret, vault, deviceId): EncryptedVault`
  - `decryptVault(secret, encryptedVault): Vault`
- Header versionné avec authentification AAD
- Compression GZIP du journal

✅ **VaultEncoding** :
- `encode(encryptedVault, json): ByteArray` pour transfert réseau
- `decode(bytes, json): EncryptedVault` pour réception

### 4. Stockage local (storage)

**Fichier**: `storage/src/main/kotlin/com/genpwd/storage/`

✅ Room Database complète :
- `ProviderAccountDao` - Comptes cloud
- `VaultMetaDao` - Métadonnées vaults
- `SyncStateDao` - État de synchronisation
- `PendingOpDao` - Opérations en attente
- `AuditLogDao` - Logs d'audit

✅ **EncryptedVaultCache** :
- Cache fichiers chiffrés avec Android EncryptedFile
- Master key AES-256-GCM via Android Keystore
- Méthodes : `write()`, `read()`, `clear()`

### 5. Moteur de synchronisation (sync-engine)

**Fichier**: `sync-engine/src/main/kotlin/com/genpwd/sync/`

✅ **VaultSyncManager** :
- Pull/push orchestration
- Détection de conflits
- Gestion des ETags
- Support des opérations pending

✅ **ConflictResolver** :
- Last-Writer-Wins (LWW) à la granularité item
- Correction : `updatedAt` → `updatedAtUtc`, `encryptedPayload` → `encryptedBlob`
- Support "Keep both" avec suffixe `_conflict`

✅ **ProviderRegistry** :
- Injection Hilt avec `Set<CloudProvider>`
- Map des providers par ProviderKind
- Méthode `get(kind): CloudProvider`

### 6. Google Drive Provider (provider-drive)

**Fichier**: `provider-drive/src/main/kotlin/com/genpwd/provider/drive/`

✅ **OAuth2GoogleDriveAuthProvider** :
- OAuth 2.0 avec PKCE (RFC 7636)
- Génération code_verifier et code_challenge
- Endpoints : `/auth`, `/token`
- Support refresh_token
- Scopes : `drive.appdata`, `drive.file`

✅ **GoogleDriveCloudProvider** :
- Toutes les méthodes CloudProvider implémentées :
  - `authenticate()` - Délégation au AuthProvider
  - `listVaults()` - Liste fichiers appDataFolder
  - `download()` - Download avec ETag
  - `upload()` - Upload avec If-Match
  - `createVault()` - Création fichier
  - `deleteVault()` - Suppression
  - `listChanges()` - Delta sync
  - `observeHealth()` - Status monitoring
- Gestion erreurs : 401, 403, 409, 429 (rate limiting)
- Modèles de sérialisation JSON

### 7. Dependency Injection (Hilt)

✅ **SyncModule** (`sync-engine/di/SyncModule.kt`) :
```kotlin
@Module @InstallIn(SingletonComponent::class)
abstract class SyncModule {
    @Multibinds
    abstract fun bindProvidersSet(): Set<CloudProvider>

    companion object {
        @Provides @Singleton
        fun provideVaultCryptoEngine(): VaultCryptoEngine

        @Provides @Singleton
        fun provideOkHttpClient(): OkHttpClient
    }
}
```

✅ **StorageModule** (`storage/di/StorageModule.kt`) :
- Room Database provider
- Json instance partagée

✅ **DriveModule** (`provider-drive/di/DriveModule.kt`) :
- Binding GoogleDriveCloudProvider → CloudProvider (IntoSet)
- Binding OAuth2GoogleDriveAuthProvider → GoogleDriveAuthProvider

### 8. Configuration Build

✅ Tous les modules configurés avec :
- Hilt plugin (`dagger.hilt.android.plugin`)
- Kotlin kapt
- OkHttp 4.12.0
- Kotlinx Serialization
- Dependencies correctes entre modules

---

## ⚠️ Ce qui reste à implémenter

### 1. Providers cloud (auth + implémentation)

#### **Dropbox** (provider-dropbox)
- [ ] `OAuth2DropboxAuthProvider` similaire à Drive
- [ ] `DropboxCloudProvider` :
  - API endpoints : `https://api.dropboxapi.com/2/`
  - Méthodes : list_folder, download, upload, delete
  - Delta sync avec cursor
- [ ] Module Hilt `DropboxModule`

#### **OneDrive/Microsoft Graph** (provider-graph)
- [ ] `OAuth2GraphAuthProvider`
- [ ] `GraphCloudProvider` :
  - API endpoints : `https://graph.microsoft.com/v1.0/`
  - Méthodes : /me/drive/items
  - Delta sync avec Graph delta query
- [ ] Module Hilt `GraphModule`

#### **WebDAV/Nextcloud** (provider-webdav)
- [ ] `WebDavAuthProvider` (Basic Auth ou OAuth2)
- [ ] `WebDavCloudProvider` :
  - Méthodes WebDAV : PROPFIND, GET, PUT, DELETE
  - Gestion ETag strict
- [ ] Module Hilt `WebDavModule`

### 2. WorkManager pour sync automatique

**Fichier**: `sync-engine/src/main/kotlin/com/genpwd/sync/work/VaultSyncWorker.kt`

Structure existe, à compléter :
- [ ] Configuration contraintes (réseau, batterie)
- [ ] Périodicité configurable (15-60 min)
- [ ] Retry avec backoff exponentiel
- [ ] Notification sur erreurs/conflits
- [ ] Integration avec `AutoSyncScheduler`

### 3. UI - Gestion des comptes cloud

**Fichiers à créer** :
```
app/src/main/java/com/julien/genpwdpro/presentation/sync/
├── CloudAccountsScreen.kt       ❌ Liste des comptes
├── AddCloudAccountScreen.kt     ❌ Ajout compte avec OAuth
├── CloudAccountsViewModel.kt    ❌ ViewMode1 gestion comptes
└── ConflictResolutionScreen.kt  ❌ UI résolution conflits
```

**Fonctionnalités** :
- [ ] Liste des comptes cloud connectés
- [ ] Bouton "Ajouter un compte" avec choix de provider
- [ ] Flow OAuth2 avec Activity result
- [ ] Affichage statut de sync par vault
- [ ] Action déconnexion/suppression compte

### 4. UI - Résolution de conflits

**ConflictResolutionScreen.kt** :
- [ ] Liste des conflits item par item
- [ ] Affichage diff local vs remote
- [ ] Actions : Keep Local, Keep Remote, Keep Both, Manual Merge
- [ ] Preview des changements avant application

### 5. Intégration avec app existante

**Fichiers à modifier** :

#### `VaultSessionManager`
- [ ] Intégrer `VaultSyncManager` dans le cycle de vie des vaults
- [ ] Trigger sync on vault open/close
- [ ] Handle sync en background

#### `Navigation.kt` / `NavGraph.kt`
- [ ] Routes pour CloudAccountsScreen
- [ ] Routes pour ConflictResolutionScreen
- [ ] Ajout dans menu Settings

#### `MainActivity.kt`
- [ ] Initialisation Hilt si pas déjà fait
- [ ] Request permissions si nécessaire (Internet, etc.)

### 6. Configuration OAuth (IMPORTANT!)

**AndroidManifest.xml** :
```xml
<activity android:name=".presentation.sync.OAuthCallbackActivity"
    android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.julien.genpwdpro"
              android:host="oauth2callback" />
    </intent-filter>
</activity>
```

**Configuration Google Cloud Console** :
1. Créer projet Google Cloud
2. Activer Google Drive API
3. Créer OAuth 2.0 Client ID (Android)
4. Ajouter SHA-1 du keystore
5. Copier client ID dans `OAuth2GoogleDriveAuthProvider.CLIENT_ID`

### 7. Tests

#### Tests unitaires
- [ ] Tests provider mocks (MockWebServer)
- [ ] Tests ConflictResolver avec scénarios complexes
- [ ] Tests VaultCryptoEngine (déjà existants ✅)

#### Tests d'intégration
- [ ] Scénario offline → online → sync
- [ ] Scénario conflict resolution
- [ ] Scénario multiple devices
- [ ] Scénario network errors (401, 403, 429)

#### Tests UI
- [ ] CloudAccountsScreen navigation
- [ ] OAuth flow end-to-end
- [ ] Conflict resolution user actions

### 8. Documentation

- [ ] README pour chaque provider avec setup instructions
- [ ] Guide OAuth setup pour Google Drive, Dropbox, OneDrive
- [ ] User guide pour sync multi-devices
- [ ] Troubleshooting common issues

---

## 🏗️ Architecture actuelle

```
┌─────────────────────────────────────────────────────────┐
│                      Android App                         │
│  ┌────────────────────────────────────────────────┐    │
│  │         VaultSessionManager                     │    │
│  │         (gestion session vault)                 │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────┐    │
│  │           VaultSyncManager                      │    │
│  │     (orchestration pull/push/conflict)          │    │
│  └───┬────────────────────────────────────────────┘    │
│      │                                                   │
│      ├──────────┬──────────┬──────────┬─────────┐      │
│      │          │          │          │         │      │
│  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  │
│  │Drive │  │Dropbox│  │Graph │  │WebDAV│  │...   │  │
│  │Provider  │Provider  │Provider  │Provider  │      │  │
│  └───┬──┘  └───┬──┘  └───┬──┘  └───┬──┘  └──────┘  │
│      │          │          │          │               │
│      └──────────┴──────────┴──────────┘               │
│                 │                                      │
│      ┌──────────▼──────────┐                         │
│      │  ProviderRegistry   │                         │
│      │  (Hilt multibinding)│                         │
│      └──────────┬───────────┘                        │
│                 │                                      │
│      ┌──────────▼───────────┐                        │
│      │  VaultStorageRepo    │                        │
│      │  (Room + Cache)      │                        │
│      └──────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Checklist pour finaliser

### Phase 1 : Compléter les providers (Priorité: HAUTE)
- [ ] Créer OAuth2DropboxAuthProvider
- [ ] Implémenter DropboxCloudProvider
- [ ] Créer OAuth2GraphAuthProvider
- [ ] Implémenter GraphCloudProvider
- [ ] Implémenter WebDavAuthProvider
- [ ] Implémenter WebDavCloudProvider
- [ ] Créer modules Hilt pour chaque provider

### Phase 2 : UI Sync (Priorité: HAUTE)
- [ ] CloudAccountsScreen + ViewModel
- [ ] AddCloudAccountScreen + OAuth flow
- [ ] ConflictResolutionScreen
- [ ] Intégration navigation

### Phase 3 : WorkManager (Priorité: MOYENNE)
- [ ] Configuration VaultSyncWorker
- [ ] Scheduling logic
- [ ] Notifications

### Phase 4 : Tests (Priorité: HAUTE)
- [ ] Tests unitaires providers
- [ ] Tests intégration sync
- [ ] Tests UI end-to-end

### Phase 5 : Polish (Priorité: BASSE)
- [ ] Documentation
- [ ] Guides setup OAuth
- [ ] Troubleshooting

---

## 🚀 Comment continuer l'implémentation

### Étape 1 : Compléter un provider (ex: Dropbox)

1. Créer `OAuth2DropboxAuthProvider.kt` basé sur `OAuth2GoogleDriveAuthProvider.kt`
2. Adapter les endpoints Dropbox :
   - Auth: `https://www.dropbox.com/oauth2/authorize`
   - Token: `https://api.dropboxapi.com/oauth2/token`
3. Implémenter `DropboxCloudProvider` basé sur `GoogleDriveCloudProvider`
4. Créer `DropboxModule.kt` pour Hilt binding
5. Tester avec MockWebServer

### Étape 2 : Créer l'UI de base

1. Créer `CloudAccountsViewModel` :
```kotlin
@HiltViewModel
class CloudAccountsViewModel @Inject constructor(
    private val storage: VaultStorageRepository,
    private val providerRegistry: ProviderRegistry
) : ViewModel() {
    val accounts: StateFlow<List<ProviderAccount>> = ...
    fun addAccount(kind: ProviderKind) { ... }
    fun removeAccount(accountId: String) { ... }
}
```

2. Créer `CloudAccountsScreen.kt` (Compose)
3. Ajouter à la navigation

### Étape 3 : OAuth flow

1. Créer `OAuthCallbackActivity`
2. Gérer Intent callback
3. Extraire authorization code
4. Échanger contre tokens
5. Sauvegarder dans storage

---

## 📚 Ressources

- [Cahier des charges complet](../docs/cloud-sync-spec.md)
- [OAuth 2.0 PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Google Drive API](https://developers.google.com/drive/api/v3/reference)
- [Dropbox API](https://www.dropbox.com/developers/documentation/http/documentation)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview)
- [WebDAV RFC 4918](https://tools.ietf.org/html/rfc4918)

---

**Dernière mise à jour**: 2025-11-02
**Statut**: Infrastructure complète, providers à finaliser, UI à créer
