# Specification Document -- Cloud Providers & "Roboform-style" Sync (GenPwd Pro -- Android)

> **Goal**: provide Codex with a complete and actionable reference to implement multi-device synchronization with cloud providers (Google Drive, OneDrive/SharePoint, Dropbox, WebDAV/Nextcloud), with encrypted local cache, offline-first operation, conflict resolution, and zero-knowledge.

---

## 1) Context & Objectives

* **Product**: GenPwd Pro (`android` branch).
* **Need**: open vaults stored on various drives, pull them locally, use them offline, then **automatically synchronize** all changes between devices.
* **Key objectives**:

  * Multi-provider (Drive, Graph/OneDrive, Dropbox, WebDAV/Nextcloud).
  * Zero-knowledge (no plaintext data on the provider side, encrypted local cache at rest).
  * **Offline-first**: usable without network, reliable recovery.
  * **Safe conflicts**: no silent data loss, clear strategy with resolution UI.
  * **Performance** & **robustness** (WorkManager, backoff, throttling, recovery, atomic writes).

## 2) Scope

* **In scope (Phase 1)**: provider abstraction, authentication, account management, encrypted vault format, sync engine (pull/push), local cache, minimal UX (add account, create/import/open vault, sync status, simple resolution), tests & CI.
* **Out of scope (Phase 1)**: real-time collaboration, cross-account sharing, native webhooks/push (starting with polling / delta).
* **Phase 2+ (optional)**: S3-compatible, vault sharing, webhooks/push, advanced item-level CRDTs.

## 3) Definitions & Assumptions

* **Vault**: single encrypted file (`vault.bin`) + internal item-level change journal.
* **Item**: logical vault entry (e.g., credential). Content **never leaves** the app in plaintext.
* **Zero-knowledge**: all content (vault + journal) encrypted **before** being written to the provider.
* **Timestamps**: use UTC; do not rely solely on device clock for conflict decisions (prefer ETag/Rev + internal journal).

## 4) Target Architecture

* **UI**: Cloud Accounts screens, Vault List, Details/Status, Conflict Resolution, Security Settings.
* **Domain**: `Vault`, `VaultMeta`, `VaultItem`, `ProviderAccount`, `SyncState`, `Conflict`, `Change`.
* **Sync Engine**: pull/push orchestration via **WorkManager** (network/foreground/interval triggers), exponential backoff, recovery and batching.
* **Provider Abstraction**: single interface + implementations (Drive, Graph/OneDrive, Dropbox, WebDAV/Nextcloud).
* **Local Storage**: Room (metadata + sync state + pending ops), **encrypted** file cache, secrets/tokens in EncryptedSharedPreferences/Android Keystore.
* **Crypto**: Argon2id (KDF), AES-256-GCM (or ChaCha20-Poly1305 fallback), versioned header, sensitive memory wiping.

## 5) Data Model (Logical)

```kotlin
// Vault identity on a provider
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
  val changeVector: String // e.g. deviceId + counter + lastChangeTime
)

data class SyncState(
  val vaultId: VaultId,
  val lastSyncUtc: Long,
  val localEtag: String?,   // hash of local ciphertext
  val remoteEtag: String?,  // provider ETag/Rev
  val pendingOps: List<PendingOp>
)
```

**Room** (example tables): `accounts`, `vault_meta`, `sync_state`, `pending_ops`, `audit_logs` (minimum).

## 6) `vault.bin` Format (v1)

* **Container**: single encrypted file (everything, including the internal journal).
* **Header** (minimal unencrypted, signed or authenticated via GCM AAD): `formatVersion`, `cipher`, `kdf`, `nonce/salt`, `deviceId`, `createdUtc`.
* **KDF**: Argon2id (t=3, m=64-128MB, p=2) -- configurable PBKDF2 fallback if constrained.
* **Encryption**: AES-256-GCM (unique nonce per write, store nonce in header or metadata block).
* **Local hash**: `SHA-256(ciphertext)` -> `localEtag`.
* **Internal journal**: list of item-level operations (`add/update/delete`, `itemId`, `changeId`, `updatedAt`, `updatedBy`), compressed.

## 7) Provider Abstraction (Stable Contract)

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

**ETag/Rev Mapping**:

* Google Drive -> `md5Checksum` + `modifiedTime` or revision; handle `If-Match` via revisionId when available.
* OneDrive/SharePoint (Graph) -> `eTag`/`cTag` + `delta`.
* Dropbox -> `rev` (+ `list_folder`/`continue`).
* WebDAV/Nextcloud -> `ETag` header + `Last-Modified`.

## 8) Per-Provider Specifications

### 8.1 Google Drive

* **Auth**: OAuth2 PKCE (AppAuth), minimal scopes (`appFolder` if possible; otherwise dedicated `/GenPwdPro` folder).
* **Store**: one `vault.bin`/vault file in a dedicated folder; metadata in `appProperties` (id, version).
* **Operations**: list, create, download (media), upload (resumable if >4MB), if-match by revision.
* **Changes**: `changes.list` (cursor) if using full drive; otherwise polling `modifiedTime`.
* **Quotas**: handle 403/429 with exponential backoff.

### 8.2 Microsoft Graph (OneDrive/SharePoint)

* **Auth**: OAuth2 PKCE, scopes Files.ReadWrite/AppFolder.
* **API**: `/drive/root:/GenPwdPro:/children`, `delta`, `@microsoft.graph.downloadUrl`.
* **Constraint**: 429 Retry-After -> respect the exact delay.

### 8.3 Dropbox

* **Auth**: OAuth2 PKCE, scope `files.content.write/read`.
* **API**: `files/list_folder`, `files/download`, `files/upload`, `list_folder/continue` (delta).
* **Rev**: use `rev` as `remoteEtag`.

### 8.4 WebDAV/Nextcloud

* **Auth**: Basic/OAuth2 depending on instance; store secrets encrypted.
* **API**: PROPFIND, GET, PUT, MOVE; rely strictly on `ETag`.
* **Specifics**: locks, naming, case-sensitive paths, time skew.

## 9) Authentication & Account Management

* **Library**: AppAuth-Android (OAuth2 PKCE) when applicable.
* **Token storage**: EncryptedSharedPreferences (key in Keystore).
* **Renewal**: silent (refresh_token) + guided re-auth on error.
* **Security**: no tokens in plaintext in logs; list scopes per provider.

## 10) Sync Engine (WorkManager)

* **Strategy**:

  * **Pull-on-open**: when opening a vault, check `remoteEtag` vs `localEtag` -> pull if different.
  * **Deferred push**: after local modifications, schedule upload (batch, coalescing).
  * **Periodic**: job (15-60 min) + triggers (connectivity restored, app foreground, device idle)
* **Atomic operations**: write to temp (`.tmp`) then rename/move.
* **Backoff**: exponential (min 10s -> max 1h), respect Retry-After.
* **Recovery**: intermittent network -> resume downloads/uploads with chunking (Drive/Graph/Dropbox).
* **Observability**: log steps (DEBUG level), exportable "Diagnostics" page.

## 11) Conflict Management

* **Detection**: `remoteEtag` vs `localEtag` divergence + internal journal comparison.
* **Default rule**: **LWW** (Last-Writer-Wins) **at item granularity**, never at the whole file level.
* **Option**: **Keep both** -- duplicate the conflicting item with a `(conflict)` suffix.
* **UI**: "Resolve Conflicts" screen (list, detail, simple before/after diff, Merge / Keep both / Choose remote/local actions).

## 12) Offline-First & Local Cache

* **Cache**: vault on disk **always encrypted** (keystore for local envelope key).
* **Airplane mode**: read/edit possible; pending ops queued; resync on network return.
* **Auto-lock**: configurable inactivity timeout; **BiometricPrompt** support.

## 13) Security

* **Zero-knowledge**: the provider only sees ciphertext.
* **KDF**: Argon2id; balanced parameters for mobile (benchmark at startup to calibrate).
* **AEAD**: AES-256-GCM (or ChaCha20-Poly1305). Unique nonces, secure storage.
* **Secrets**: tokens and keys protected (Keystore + EncryptedSharedPreferences).
* **Hardening**: FLAG_SECURE (optional), prevent screenshots on sensitive views, no secret logging, memory wiping.

## 14) UX / UI -- User Flows

1. **Add an account**: choose provider -> OAuth2 -> success -> account listed.
2. **Create a vault**: choose provider/folder -> name -> set master secret/biometrics -> initial upload.
3. **Import**: choose existing `vault.bin` -> download -> decrypt -> add to list.
4. **Open**: check diff -> pull -> decrypt in RAM -> real-time sync status.
5. **Edit**: local save + asynchronous push; notifications on error/conflict.
6. **Settings**: auto-lock, biometrics, clear cache, diagnostics.

## 15) Performance & Limits

* **Chunking**: segmented uploads/downloads (>4-8MB) with recovery.
* **Batching**: coalescing small changes; limit WorkManager wake-ups.
* **Throttling**: Graph/Dropbox (429) -> respect Retry-After.
* **Vault size**: recommended < 50MB (v1) -- beyond that, mandatory chunking.

## 16) Logging & Observability

* **Levels**: ERROR/WARN/INFO/DEBUG.
* **Diagnostics**: export screen (zip) with logs (sanitized), sync state, versions, deviceId; **never** sensitive content.

## 17) Test Plan

* **Unit**: crypto (KDF, AEAD), vault parser, conflict resolver, ETag mapping.
* **Integration**: HTTP mocks (WireMock/MockWebServer), offline->online scenarios, 401/403/429 errors, recovery.
* **Instrumentation**: full UI flows (add account, create/import/open, airplane mode, conflict, recovery).
* **Non-regression**: sample vault fixtures (v1), migration ready for v2.

## 18) CI/CD & Quality

* **Build**: Gradle; lint, detekt/ktlint, unit + instrumentation (with headless emulators).
* **Secrets**: encrypted CI variables; never log tokens.
* **Artifacts**: test report, coverage, debug APK.
* **PR Gate**: checklist (see section 22) + pipeline success.

## 19) Compliance & Privacy

* **Privacy Policy**: document encryption, local storage, scopes; opt-in telemetry.
* **Scopes**: minimal per provider; `appFolder` preferred when possible.
* **Data**: no analytics by default; no plaintext data.

## 20) Timeline (Milestones)

* **M1 -- Local Foundation (2-3 d)**: `vault.bin` v1 format, crypto utils, Room, encrypted cache, local CRUD, Status screen.
* **M2 -- Abstraction + Google Drive (5-7 d)**: OAuth2, list/create/download/upload, ETag/if-match, basic pull/push.
* **M3 -- Dropbox (3-5 d)**: delta, recovery.
* **M4 -- OneDrive/Graph (3-5 d)**: delta, 429/backoff.
* **M5 -- WebDAV/Nextcloud (3-5 d)**: strict ETag, locks.
* **M6 -- Advanced Conflicts + UI (3-4 d)**: item-level LWW + resolution screen.
* **M7 -- Background/Polish (2-3 d)**: periodic WorkManager, notifications, security/biometric settings.
* **M8 -- Closed Beta (1-2 d)**: instrumented tests, docs, diagnostics.

## 21) Acceptance Criteria (Excerpts)

* Opening a remote vault **pulls** locally if different, then the app displays **Up to date**.
* Offline local changes **propagate** on network return, without unjustified duplication.
* Multi-device conflicts -> **no silent data loss** (item-level LWW + conflict copy/merge UI).
* Zero-knowledge: the provider **never** receives plaintext data.
* Uninstall/reinstall does not expose secrets (keystore required for re-access).

## 22) Definition of Done (DoD) & PR Checklist

* [ ] Unit test coverage >= 80% for crypto + format + resolver.
* [ ] Major integration tests green (offline->online, 401/403/429, recovery, conflict).
* [ ] No plaintext secrets/tokens (code, logs, CI artifacts).
* [ ] Lint/detekt/ktlint OK, critical warnings resolved.
* [ ] UX: add account, create/import/open, sync status, conflict resolution, security settings -> validated.
* [ ] Documentation updated (Android README, sync diagrams, provider matrix, Privacy Policy draft).

## 23) Expected Deliverables (Codex)

1. **Modules**:

   * `core-vault/` (crypto, v1 format, journal, local hash)
   * `sync-engine/` (WorkManager, pull/push/periodic workers, backoff, recovery)
   * `providers-api/` + `provider-drive/`, `provider-graph/`, `provider-dropbox/`, `provider-webdav/`
   * `storage/` (Room, encrypted file cache, secrets)
2. **Interfaces & DTOs** (contract from section 7) with adapters if needed.
3. **Screens**: ProvidersList, AddAccount, VaultsList, VaultDetails (status), ResolveConflict, Settings/Security, Diagnostics.
4. **Tests**: unit/integration/instrumentation + v1 vault test fixtures.
5. **Docs**: README, per-provider auth guides (scopes, redirect URIs), architecture & sync diagram, release guide.

## 24) Code Conventions & Quality

* **Language**: Kotlin, coroutines/Flows, Retrofit/OkHttp, Hilt for DI.
* **Errors**: sealed classes for results (Success/RetryableError/FatalError), standardized HTTP mapping.
* **Timeouts**: 10s connect, 30s read, 30s write (adjust if chunking).
* **Directories**: feature-modules; no God classes; clear domain/data/UI separation.

## 25) Appendices -- API Examples (Sketches)

```kotlin
// Atomic upload with if-match
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

### End of Specification Document

This document serves as the sole reference for launching the implementation. Any divergence or unanticipated provider constraint will be recorded and addressed via a Design Note (DN) before merge.
