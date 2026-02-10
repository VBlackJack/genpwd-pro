# GenPwd Pro Android Architecture - Current State (Post-Migration)

**Last updated:** 2025-10-30
**Branch:** `android`
**Version:** 1.1.0

---

## IMPORTANT: Migration Complete

**The migration from the Room system to .gpv files is COMPLETE.**

- **DO NOT reference the Room-based system as the main architecture anymore**
- **The file-based (.gpv) system is the production architecture**
- **Room is used only for metadata (registry, history)**

---

## Current Architecture

### Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     UI LAYER (Jetpack Compose)               │
│  - Screens, ViewModels, Components                           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   DOMAIN LAYER                               │
│  - Use Cases, Business Logic, Session Management             │
│  - VaultSessionManager (Single Source of Truth)              │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│  ┌────────────────────────┐  ┌─────────────────────────┐    │
│  │ FileVaultRepository    │  │ Room Database           │    │
│  │ (Sensitive data)       │  │ (Metadata)              │    │
│  │                        │  │                         │    │
│  │ - .gpv files           │  │ - VaultRegistryEntry    │    │
│  │ - VaultFileManager     │  │ - PasswordHistoryEntity │    │
│  │ - VaultCryptoManager   │  │                         │    │
│  └────────────────────────┘  └─────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Vault Storage System

### .gpv Format (GenPwd Vault)

**File:** `MyVault.gpv`

**Structure (encrypted):**
```json
{
  "version": "1.0",
  "id": "vault-uuid",
  "name": "My Vault",
  "description": "Optional description",
  "kdf": {
    "algorithm": "argon2id",
    "iterations": 3,
    "memoryKB": 65536,
    "parallelism": 4,
    "salt": "base64..."
  },
  "encryption": {
    "algorithm": "AES-256-GCM",
    "encryptedKey": "base64...",
    "keyIv": "base64..."
  },
  "entries": [
    {
      "id": "uuid-entry",
      "type": "LOGIN|NOTE|CARD|IDENTITY",
      "title": "Title",
      "folderId": "uuid-folder",
      "tags": ["tag1", "tag2"],
      "encryptedData": "base64...",
      "dataIv": "base64...",
      "createdAt": 1234567890,
      "modifiedAt": 1234567890
    }
  ],
  "folders": [...],
  "tags": [...],
  "presets": [...]
}
```

**Advantages:**
- Portable (file copy = backup)
- Compatible with cloud sync (Dropbox, Drive, WebDAV)
- Platform-independent (future iOS/Desktop)
- Readable (encrypted JSON)
- Versionable

---

## Room Database - Current Role

### Active Entities (Production)

#### 1. VaultRegistryEntry
**Table:** `vault_registry`
**Role:** Vault registry (metadata)

```kotlin
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    val id: String,                    // Vault UUID
    val name: String,                  // Display name
    val filePath: String,              // Path to the .gpv file
    val storageStrategy: StorageStrategy, // FILE | SAF | CLOUD
    val fileSize: Long,                // Size in bytes
    val lastModified: Long,            // Modification timestamp
    val lastAccessed: Long?,           // Last unlock
    val isDefault: Boolean,            // Default vault
    val isLoaded: Boolean,             // Loaded in memory
    val statistics: VaultStatistics,   // Stats (entry count, etc.)
    val biometricUnlockEnabled: Boolean,
    val encryptedMasterPassword: ByteArray?, // For biometrics
    val masterPasswordIv: ByteArray?
)
```

**Usage:**
- Vault list in the UI
- Dashboard statistics
- Biometric configuration
- Tracking of .gpv files

#### 2. PasswordHistoryEntity
**Table:** `password_history`
**Role:** Generated password history

```kotlin
@Entity(tableName = "password_history")
data class PasswordHistoryEntity(
    val id: String,
    val encryptedPassword: String,
    val iv: String,
    val timestamp: Long,
    val strength: Int,
    val entropy: Double,
    val generationMode: GenerationMode,
    val isFavorite: Boolean,
    val note: String
)
```

**Usage:**
- History screen
- Dashboard quick generator
- Generation statistics

### Legacy Entities (REMOVED - 2025-11-01)

The historical Room artifacts have been **completely removed** from the source code:

- `VaultEntity` - REMOVED
- `VaultEntryEntity` - REMOVED
- `VaultEntryEntityExt` - REMOVED
- `FolderEntity` - REMOVED
- `TagEntity` - REMOVED
- `PresetEntity` - REMOVED
- `VaultDao` - REMOVED
- `VaultEntryDao` - REMOVED
- `FolderDao` - REMOVED
- `TagDao` - REMOVED
- `PresetDao` - REMOVED
- `VaultRepository` (legacy Room) - REMOVED

**Reason:** The file-based (.gpv) system works perfectly. Legacy code was removed to eliminate any ambiguity for code analyzers and AI tools.

---

## Vault Management Flows

### 1. Creating a Vault

```
User Input (name + master password)
         ↓
VaultSessionManager.createVault()
         ↓
VaultCryptoManager.deriveKey(password, argon2id)
         ↓
Generate vault encryption key (AES-256)
         ↓
Encrypt vault key with derived key
         ↓
VaultFileManager.saveToFile("MyVault.gpv")
         ↓
VaultRegistryDao.insert(VaultRegistryEntry)
```

### 2. Unlocking a Vault

```
User Input (master password) OR Biometric Auth
         ↓
[Biometric] → KeystoreManager.decrypt(encryptedMasterPassword)
         ↓
VaultFileManager.loadFromFile("MyVault.gpv")
         ↓
VaultCryptoManager.deriveKey(password, argon2id)
         ↓
Decrypt vault key
         ↓
VaultSessionManager.unlockVault(vaultKey) → Keep in memory
         ↓
VaultRegistryDao.update(lastAccessed, isLoaded = true)
```

### 3. Reading/Writing Entries

```
VaultSessionManager.getEntry(entryId)
         ↓
Retrieve vault from memory (VaultData)
         ↓
Find entry in entries list
         ↓
VaultCryptoManager.decrypt(encryptedData, vaultKey)
         ↓
Return EntryData to UI
```

**Saving:**
```
VaultSessionManager.saveEntry(entry)
         ↓
Update VaultData in memory
         ↓
VaultCryptoManager.encrypt(entryData, vaultKey)
         ↓
VaultFileManager.saveToFile("MyVault.gpv")
         ↓
VaultRegistryDao.update(statistics, lastModified)
```

### 4. Locking

```
VaultSessionManager.lockVault(vaultId)
         ↓
Wipe vault key from memory (SecretKey.destroy())
         ↓
Clear VaultData from ConcurrentHashMap
         ↓
VaultRegistryDao.update(isLoaded = false)
```

---

## Key Components

### VaultSessionManager
**Location:** `domain/session/VaultSessionManager.kt`
**Role:** Single Source of Truth for file-based vaults

**Responsibilities:**
- In-memory session management
- Loading/unloading vaults
- CRUD operations on entries/folders/tags/presets
- Coordination with VaultFileManager
- Auto-lock management

**Main API:**
```kotlin
suspend fun createVault(name: String, password: String, strategy: StorageStrategy): Result<String>
suspend fun unlockVault(vaultId: String, password: String): Result<Unit>
suspend fun lockVault(vaultId: String)
suspend fun saveEntry(vaultId: String, entry: EntryData): Result<Unit>
suspend fun getEntry(vaultId: String, entryId: String): Result<EntryData>
suspend fun deleteEntry(vaultId: String, entryId: String): Result<Unit>
// + folders, tags, presets, search, etc.
```

### FileVaultRepository
**Location:** `data/repository/FileVaultRepository.kt`
**Role:** Abstraction layer between UI and VaultSessionManager

**Responsibilities:**
- Provide a high-level API for ViewModels
- Transform data for the UI (Flows, StateFlow)
- Error handling and logging
- Integration with VaultRegistry

**Injection:**
```kotlin
@HiltViewModel
class MyViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository  // Use this one
    // NOT: private val vaultRepository: VaultRepository  // Legacy
)
```

### VaultFileManager
**Location:** `data/vault/VaultFileManager.kt`
**Role:** I/O management for .gpv files

**Responsibilities:**
- Reading/writing .gpv files
- Storage Access Framework (SAF) support
- Permission management
- File integrity validation

### VaultCryptoManager
**Location:** `data/crypto/VaultCryptoManager.kt`
**Role:** Cryptographic operations

**Responsibilities:**
- Key derivation (Argon2id)
- Encryption/decryption (AES-256-GCM)
- Random key generation
- IV management

---

## Security

### Layered Encryption

1. **Master Password -> Derived Key (Argon2id)**
   - 3 iterations
   - 64 MB memory
   - 4 threads parallelism
   - Unique salt per vault

2. **Derived Key -> Vault Key (AES-256-GCM)**
   - Vault key generated randomly
   - Encrypted with the derived key
   - Stored in the .gpv file

3. **Vault Key -> Entry Data (AES-256-GCM)**
   - Each sensitive field encrypted individually
   - Unique IV per field
   - GCM authentication

### Zero-Knowledge

- Master password is **never stored** (neither in plaintext nor hashed)
- Derived key is **never stored**
- Vault key is **in memory only** (during session)
- Biometrics: Master password encrypted with Android Keystore (hardware-backed)

### Memory Protection

```kotlin
// Secure wipe on lock
unlockedKeys.remove(vaultId)?.destroy()
loadedVaults.remove(vaultId)
```

---

## Statistics and Metadata

### VaultStatistics (Embedded in VaultRegistryEntry)

```kotlin
data class VaultStatistics(
    val totalEntries: Int = 0,
    val loginEntries: Int = 0,
    val noteEntries: Int = 0,
    val cardEntries: Int = 0,
    val identityEntries: Int = 0,
    val totalFolders: Int = 0,
    val totalTags: Int = 0,
    val totalPresets: Int = 0,
    val favoriteEntries: Int = 0,
    val entriesWithTOTP: Int = 0
)
```

**Updates:**
- After each vault modification
- On initial load
- Displayed in the Dashboard

---

## Cloud Synchronization

### Sync Architecture

```
FileVaultRepository
         ↓
CloudProviderSyncRepository
         ↓
┌────────────────┬──────────────┬──────────────┐
│ GoogleDrive    │ WebDAV       │ OneDrive     │
│ Provider       │ Provider     │ Provider     │
│ (Prod)         │ (Prod)       │ (Template)   │
└────────────────┴──────────────┴──────────────┘
         ↓
VaultFileManager (upload/download .gpv files)
```

**Provider Status:**
- **Google Drive**: Production (OAuth2, API v3)
- **WebDAV**: Production (Nextcloud, ownCloud, Synology)
- **OneDrive**: Template 40% (implementation guide available)
- **pCloud**: Template 40%
- **ProtonDrive**: Template 40%

**Conflict Resolution:**
- `LOCAL_WINS` - Keep the local version
- `REMOTE_WINS` - Keep the remote version
- `NEWEST_WINS` - Keep the most recent (by timestamp)
- `SMART_MERGE` - Intelligent merge (merge entries)
- `MANUAL` - Ask the user

---

## Tests

### Test Strategy

**Unit Tests:**
- `VaultSessionManagerTest.kt`
- `VaultCryptoManagerTest.kt`
- `FileVaultRepositoryTest.kt`

**Integration Tests:**
- `VaultFileManagerTest.kt`
- `CloudSyncIntegrationTest.kt`

**Instrumented Tests:**
- `EncryptedAppDatabaseTest.kt`
- `SecureFlagInstrumentationTest.kt`
- `BiometricAuthTest.kt`

**Coverage:** ~85-90% on critical components

---

## Legacy Data Migration

### For existing users (Room -> .gpv)

**Tool:** `LegacyVaultMigrationTool` (in development)

**Process:**
1. Detection of Room vaults on first launch
2. Display a migration notification
3. Export Room data to .gpv format
4. Create VaultRegistryEntry records
5. Archive old data
6. Delete after confirmation

**Status:** Implementation in progress

---

## Integration Checklist

### To add a new vault feature:

- [ ] Modify `VaultData` (domain model) if necessary
- [ ] Add the method in `VaultSessionManager`
- [ ] Expose via `FileVaultRepository` for the UI
- [ ] Update JSON serialization/deserialization
- [ ] Handle encryption if the data is sensitive
- [ ] Update `VaultStatistics` if applicable
- [ ] Test with existing .gpv files (backward compatibility)
- [ ] Document in comments

### To add a new ViewModel:

```kotlin
@HiltViewModel
class MyNewViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,  // Correct
    private val vaultSessionManager: VaultSessionManager   // Also acceptable
    // private val vaultRepository: VaultRepository        // Do not use
) : ViewModel() {
    // Implementation
}
```

---

## Quick References

### Key Files

| Component | File |
|-----------|------|
| Session Manager | `domain/session/VaultSessionManager.kt` |
| Repository | `data/repository/FileVaultRepository.kt` |
| File I/O | `data/vault/VaultFileManager.kt` |
| Crypto | `data/crypto/VaultCryptoManager.kt` |
| Registry DAO | `data/db/dao/VaultRegistryDao.kt` |
| Registry Entity | `data/db/entity/VaultRegistryEntry.kt` |
| Database | `data/db/database/AppDatabase.kt` |
| DI Module | `di/DatabaseModule.kt` |

### Documentation

- `/android/README.md` - Main Android documentation
- `/android/CLOUD_SYNC_README.md` - Cloud synchronization guide
- `/android/OAUTH2_SETUP_GUIDE.md` - OAuth2 setup guide
- `/android/PRESET_USER_GUIDE.md` - Presets user guide
- `/docs/` - General technical documentation

---

## FAQ for Future Sessions

### Q: Which repository should I use in a new ViewModel?
**A:** `FileVaultRepository` - This is the production repository.

### Q: Is Room still used for vaults?
**A:** No. Room only stores the registry (`VaultRegistryEntry`) and the history (`PasswordHistoryEntity`).

### Q: Where is the vault data stored?
**A:** In `.gpv` files (encrypted JSON) on the filesystem or via SAF.

### Q: What does `VaultRepository` (without "File") do?
**A:** It is the old legacy system, active only in DEBUG mode for compatibility.

### Q: How do I add an entry to a vault?
**A:** Via `VaultSessionManager.saveEntry()` or `FileVaultRepository.saveEntry()`.

### Q: Is the data encrypted in the database?
**A:** The metadata in Room is not sensitive (no encryption needed). Sensitive data is in the .gpv files (encrypted).

### Q: How does biometric unlock work?
**A:** The master password is encrypted with Android Keystore and stored in `VaultRegistryEntry.encryptedMasterPassword`.

---

## Summary for Future Sessions

```
CURRENT SYSTEM: .gpv files (file-based)
OLD SYSTEM: Room vaults (deprecated, DEBUG only)

USE: FileVaultRepository, VaultSessionManager
DO NOT USE: VaultRepository (legacy)

ROOM FOR: Vault registry (VaultRegistryEntry) + History (PasswordHistoryEntity)
NOT ROOM FOR: Storing vault entries (obsolete)

FORMAT: Encrypted JSON in .gpv files
NOT FORMAT: Data in SQLite (obsolete)
```

---

**Created:** 2025-10-30
**Author:** Julien Bombled
**Branch:** android
**Last revision:** 2025-10-30
