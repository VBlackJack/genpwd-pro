# KeePass Vault Management - Research Findings

**Date**: 27 octobre 2025
**Source**: KeePassXC, KeePass2, KeePass2Android

---

## 📋 Executive Summary

Research on leading password managers (KeePass ecosystem) reveals industry best practices for vault management that we should incorporate into GenPwd Pro.

---

## 🔍 Key Findings

### 1. KDBX File Format (Industry Standard)

**Structure**:
```
┌─────────────────────────────────────┐
│ Unencrypted Header (Variable Size)  │
│   - Magic signatures (8 bytes)      │
│   - Version info                    │
│   - Cipher ID, compression flags    │
│   - Master seed, encryption IV      │
│   - Transform rounds count          │
│   - Stream protection keys          │
├─────────────────────────────────────┤
│ Encrypted Database (Variable Size)  │
│   - 32-byte validation hash         │
│   - Sequential blocks with checksums│
│   - XML document (after decryption) │
│   - Optional inner stream encryption│
└─────────────────────────────────────┘
```

**File Signatures**:
- Signature 1: `0x9AA2D903` (always)
- Signature 2: `0xB54BFB67` (KDBX 2.x format)

**Extensions**: `.kdbx` (KeePass 2.x), `.kdb` (KeePass 1.x - legacy)

**Our Equivalent**: `.gpv` with "GPVAULT1" magic number ✅

---

### 2. Security Model

#### Multi-Factor Authentication
- **Master Password** (required)
- **Key File** (optional, recommended for teams)
  - Stored separately from database
  - Never uploaded to cloud with database
  - Shared in person for maximum security
  - Combined with password = practically unbreakable

#### Encryption
- **Algorithm**: AES-256, ChaCha20, or Twofish
- **Our approach**: AES-256-GCM ✅

#### Key Derivation
- **KeePass method**: AES encryption rounds (configurable, e.g., 60,000 rounds)
- **Our approach**: Argon2id (modern, better) ✅

#### Additional Protection
- **Inner stream encryption** for sensitive fields (ARC4 or Salsa20)
- **Validation bytes** to detect corrupted/manipulated data
- **Per-block checksums** in KDBX format

---

### 3. Storage & Synchronization

#### Storage Locations
KeePass2Android supports:
- Local files (`/` paths)
- Storage Access Framework (`content://` URIs)
- Cloud providers: Dropbox, Google Drive, OneDrive, pCloud, Nextcloud
- Protocols: SFTP, WebDAV

**Our equivalent**: 4 StorageStrategy options ✅

#### Synchronization Best Practices

**Recommended workflow**:
1. **Target database** (master) → stored in cloud
2. **Working database** (local) → stored on device
3. On open: sync working → target
4. Use triggers for automation

**Conflict handling**:
- Automatic detection of remote changes
- Options: **Merge** (pull-before-push) or **Overwrite** (discard remote)
- Merge uses 3-way diff to combine changes

**Security recommendations**:
- Enable 2FA on cloud accounts
- Never store key file in same location as database
- Don't use target database as working database (data loss risk)

---

### 4. Multi-Vault Management

#### Current KeePass Limitations
- **Pain point**: Must close current database before opening another
- **Feature request** (2017): Easy database switching - still not fully resolved

#### Workarounds
- **Child databases**: Share subset of credentials without exposing full vault
- **Entry templates**: Reusable entry structures
- **Database references**: Link entries across databases

#### Our Opportunity
We can improve on this by:
- Loading multiple vaults simultaneously ✅ (already planned)
- Quick vault switching without close/reopen
- Vault unloading for security (planned) ✅

---

### 5. File Management

#### File Handling (KeePass2Android)
- Uses Storage Access Framework for flexibility
- Local paths: `/storage/emulated/0/...`
- SAF paths: `content://...`
- Automatic backup before destructive operations

#### Best Practices
- **Auto-save** after modifications
- **Lock on timeout** for security
- **Recent files list** for quick access
- **File integrity checks** on load

---

## 💡 Ideas to Incorporate

### ✅ Already Implemented
1. Custom file format (.gpv vs .kdbx)
2. Header + encrypted content structure
3. AES-256-GCM encryption
4. Argon2id key derivation (better than KeePass)
5. Multiple storage strategies
6. SHA-256 checksum validation
7. Multi-vault loading support

### 🆕 Should Add (Priority: HIGH)

#### 1. Key File Support (Phase 2/3)
```kotlin
data class VaultAuthenticationOptions(
    val masterPassword: String,
    val keyFile: Uri? = null  // Optional second factor
)

fun deriveKeyWithKeyFile(
    password: String,
    salt: ByteArray,
    keyFileContent: ByteArray?
): SecretKey {
    // Combine password hash + key file hash
    val compositeKey = if (keyFileContent != null) {
        val passwordHash = sha256(password.toByteArray())
        val keyFileHash = sha256(keyFileContent)
        sha256(passwordHash + keyFileHash)
    } else {
        sha256(password.toByteArray())
    }

    return argon2id(compositeKey, salt)
}
```

#### 2. Sync Conflict Resolution (Phase 5)
```kotlin
enum class SyncConflictResolution {
    MERGE,           // 3-way merge (recommended)
    OVERWRITE_LOCAL, // Use remote version
    OVERWRITE_REMOTE,// Use local version
    MANUAL           // Let user choose
}

suspend fun syncVault(
    vaultId: String,
    remoteUri: Uri,
    resolution: SyncConflictResolution = MERGE
): SyncResult
```

#### 3. Automatic Backup Before Destructive Operations (Phase 6)
```kotlin
suspend fun performWithBackup(
    vaultId: String,
    operation: suspend () -> Unit
): Result<Unit> {
    val backup = createBackup(vaultId)
    return try {
        operation()
        Result.success(Unit)
    } catch (e: Exception) {
        restoreBackup(backup)
        Result.failure(e)
    }
}
```

#### 4. Working vs Target Database Pattern (Phase 5)
```kotlin
data class VaultSyncConfig(
    val localWorkingPath: String,    // Device storage
    val targetPath: Uri?,             // Cloud location
    val autoSync: Boolean = false,
    val syncOnOpen: Boolean = true,
    val syncOnClose: Boolean = true
)
```

### 🆕 Should Add (Priority: MEDIUM)

#### 5. Child Vault / Export Subset (Phase 5)
```kotlin
suspend fun exportVaultSubset(
    vaultId: String,
    entryIds: List<String>,
    destinationPath: Uri,
    newMasterPassword: String
): File {
    // Create new vault with only selected entries
    // Useful for sharing credentials with team members
}
```

#### 6. Database Merge (Phase 5)
```kotlin
suspend fun mergeVaults(
    localVaultId: String,
    remoteVaultData: VaultData,
    strategy: MergeStrategy = THREE_WAY_MERGE
): MergeResult {
    // Compare timestamps, detect conflicts
    // Merge entries, presets, folders
    // Return conflicts for manual resolution
}
```

#### 7. Recent Vaults List (Phase 4)
```kotlin
data class RecentVaultEntry(
    val vaultId: String,
    val lastAccessTime: Long,
    val quickUnlock: Boolean = false  // Fingerprint/PIN
)

@Dao
interface VaultRegistryDao {
    @Query("SELECT * FROM vault_registry ORDER BY lastAccessed DESC LIMIT 5")
    fun getRecentVaults(): Flow<List<VaultRegistryEntry>>
}
```

### 🆕 Should Add (Priority: LOW)

#### 8. Inner Stream Encryption (Phase 6)
- Optional additional encryption for password fields
- Even if vault file is decrypted, passwords still protected
- Use ChaCha20 or Salsa20 for performance

#### 9. Transform Rounds Configuration (Phase 6)
```kotlin
data class VaultSecurityConfig(
    val kdfIterations: Int = 100_000,  // Argon2id iterations
    val kdfMemory: Int = 64 * 1024,    // 64 MB
    val kdfParallelism: Int = 4        // Threads
)
```

---

## 📊 Comparison: GenPwd Pro vs KeePass

| Feature | KeePass | GenPwd Pro | Status |
|---------|---------|------------|--------|
| **File Format** | .kdbx | .gpv | ✅ Implemented |
| **Encryption** | AES-256/ChaCha20 | AES-256-GCM | ✅ Implemented |
| **Key Derivation** | AES rounds | Argon2id | ✅ Better |
| **Master Password** | Yes | Yes | ✅ Implemented |
| **Key File** | Yes | No | ❌ Should add |
| **Cloud Sync** | Manual/Plugin | Planned | 📝 Phase 5 |
| **Merge Conflicts** | Yes | No | 📝 Should add |
| **Multi-Vault** | One at a time | Multiple | ✅ Better |
| **Storage Options** | Local/Cloud | 4 strategies | ✅ Better |
| **Auto-backup** | Plugin | Planned | 📝 Phase 6 |
| **File Integrity** | Block checksums | SHA-256 | ✅ Implemented |
| **Child Databases** | Yes | No | 📝 Should add |
| **Entry Templates** | Yes | Presets | ✅ Different approach |
| **Mobile-First** | No | Yes | ✅ Better |
| **Preset System** | No | Yes | ✅ Unique feature |

---

## 🎯 Updated Roadmap Priorities

### Phase 2 (Integration) - CURRENT
- Add VaultCryptoManager helpers
- Database migration
- **NEW**: Add key file support to authentication

### Phase 3 (Migration)
- VaultMigrationManager
- **NEW**: Automatic backup before migration

### Phase 4 (UI)
- VaultManagerScreen
- **NEW**: Recent vaults list
- **NEW**: Key file picker in CreateVaultDialog

### Phase 5 (Advanced Features)
- Export/Import
- **NEW**: Sync conflict resolution
- **NEW**: Working/Target database pattern
- **NEW**: Export vault subset (child vault)
- **NEW**: Merge vaults functionality

### Phase 6 (Testing & Polish)
- All existing tests
- **NEW**: Security audit including key file handling
- **NEW**: Sync conflict scenarios testing
- **NEW**: Multi-device testing

---

## 🔐 Security Enhancements from Research

### Immediate (Phase 2)
1. **Key file support**: Optional second factor
2. **Validation bytes**: Detect file corruption/tampering
3. **Per-block integrity**: Incremental validation

### Medium-term (Phase 5)
1. **Sync security**: Never auto-upload key files
2. **Backup encryption**: Backups use same security as originals
3. **Conflict detection**: Timestamp + checksum validation

### Long-term (Phase 6)
1. **Inner stream encryption**: Additional protection for passwords
2. **Configurable KDF**: Let users choose security vs performance
3. **Hardware key support**: YubiKey integration

---

## 📝 Lessons Learned

### What KeePass Does Well
1. **Open format** - Well-documented, auditable
2. **Strong encryption** - Industry-standard algorithms
3. **Flexibility** - Multiple auth methods, storage options
4. **Backward compatibility** - Can open old databases
5. **Plugin ecosystem** - Extensible architecture

### Where KeePass Has Weaknesses (Our Opportunities)
1. **Multi-database UX** - Still requires close/reopen
2. **Mobile experience** - Desktop-first design
3. **Sync complexity** - Manual process, conflict-prone
4. **Modern UX** - UI feels dated
5. **Password generation** - No preset system

### Our Competitive Advantages
1. **Mobile-first** - Built for Android from ground up
2. **Preset system** - Unique password generation approach
3. **Multi-vault** - Simultaneous vault loading
4. **Modern UI** - Material Design 3, clean UX
5. **Smart defaults** - Syllables mode, quick generator

---

## 🚀 Action Items

### Implement Now (Phase 2)
- [x] Research completed
- [ ] Update VaultFileHeader to include key file hash (optional)
- [ ] Add key file support to VaultCryptoManager
- [ ] Update VaultFileManager to handle key files

### Plan for Later
- [ ] Design sync conflict resolution UI (Phase 5)
- [ ] Implement vault merge algorithm (Phase 5)
- [ ] Create child vault export feature (Phase 5)
- [ ] Add recent vaults quick access (Phase 4)

---

## 📚 References

- [KDBX 4 Format Specification](https://keepass.info/help/kb/kdbx_4.html)
- [KeePass File Format Explained](https://gist.github.com/lgg/e6ccc6e212d18dd2ecd8a8c116fb1e45)
- [KeePass Synchronization Guide](https://keepass.info/help/v2/sync.html)
- [KeePass2Android GitHub](https://github.com/PhilippC/keepass2android)
- [KeePassXC Documentation](https://keepassxc.org/docs/)

---

🤖 Généré avec [Claude Code](https://claude.com/claude-code)

**Dernière mise à jour**: Recherche KeePass complétée
**Impact**: Enhanced security features and better UX planning
