# Refactoring TODO - Legacy Code Cleanup

**Date:** 2025-11-01
**Branch:** codex/effectuer-un-audit-de-code-complet

## ✅ Completed

1. ✅ **VaultEntryEntity** refactored to use decrypted data in memory
2. ✅ **PresetEntity** refactored to remove encrypted fields
3. ✅ **SecureNote.kt** updated to use `DecryptedVaultEntry`
4. ✅ **PasswordHealthViewModel** migrated to `FileVaultRepository`
5. ✅ **ImportExportRepository** partially migrated (addEntry call fixed)
6. ✅ **strings.xml** encoding issues fixed (French accents removed)
7. ✅ **ConstraintLayout** dependency added to build.gradle.kts
8. ✅ **SyncManager.kt** syntax error fixed (misplaced imports removed)

---

## ⚠️ BLOCKING ISSUES - Cannot Compile

The following classes still reference **deleted legacy classes** and prevent compilation:

### Classes referencing `VaultRepository` (legacy, deleted):
- `ImportExportRepository.kt` - Constructor parameter
- `VaultSyncManager.kt` - Constructor parameter
- `VaultMigrationManager.kt` - Constructor parameter
- `PresetViewModel.kt` - Constructor parameter
- `GeneratorViewModel.kt` - Constructor parameter
- `FolderManagementViewModel.kt` - Constructor parameter
- `TagManagementViewModel.kt` - Constructor parameter

### Classes referencing `VaultDao` / `VaultEntryDao` (legacy, deleted):
- `ImportExportRepository.kt` - Constructor parameters + usage in methods
- `VaultMigrationManager.kt` - Constructor parameters

---

## 🔧 Required Actions

### Priority 1: Enable Compilation

**Option A (Quick Fix):** Create stub classes
```kotlin
// Temporary file: data/repository/VaultRepositoryStub.kt
@Deprecated("Legacy system removed, use FileVaultRepository")
class VaultRepository @Inject constructor() {
    // Empty stub for compilation only
}

// Temporary file: data/db/dao/VaultDaoStub.kt
@Deprecated("Legacy DAO removed")
interface VaultDao

@Deprecated("Legacy DAO removed")
interface VaultEntryDao
```

**Option B (Proper Fix):** Refactor all affected classes
- Remove dependencies on `VaultRepository`, `VaultDao`, `VaultEntryDao`
- Update to use `FileVaultRepository` and `VaultSessionManager`
- Rewrite methods that use legacy DAOs

---

## 📝 Detailed Refactoring Plan

### 1. ImportExportRepository

**Current state:** Uses both legacy and new systems
**Issue:** Constructor references `VaultDao`, `VaultEntryDao`, `VaultRepository`

**Methods using legacy:**
- Line 59: `vaultEntryDao.getEntriesByVault(vaultId)`
- Line 260: `vaultDao.getById(vaultId)`
- Line 264: `vaultEntryDao.getEntriesByVault(vaultId)`
- Line 360: `vaultDao.insert(newVault)`
- Line 370: `vaultEntryDao.insert(newEntry)`

**Solution:**
- Remove legacy DAO dependencies
- Use `FileVaultRepository.getEntries()` instead of `vaultEntryDao`
- Use `VaultRegistryDao` for vault metadata
- Rewrite import/export to work with `.gpv` files directly

---

### 2. VaultSyncManager

**Issue:** Constructor references `VaultRepository`

**Solution:**
- Replace with `FileVaultRepository`
- Update sync logic to work with `.gpv` files instead of Room entities

---

### 3. VaultMigrationManager

**Issue:** Constructor references multiple legacy classes

**Solution:**
- This class is specifically for migrating FROM legacy TO file-based
- Keep it but mark as `@Deprecated`
- It should only run once per user during migration
- Consider moving to a separate migration module

---

### 4. ViewModels (Preset, Generator, FolderManagement, TagManagement)

**Issue:** Constructor references `VaultRepository`

**Solution:**
- Replace all `VaultRepository` with `FileVaultRepository`
- Update method calls accordingly:
  - `vaultRepository.getPresets()` → `fileVaultRepository.getPresets()`
  - `vaultRepository.createPreset()` → `fileVaultRepository.addPreset()`
  - etc.

---

## 🎯 Recommended Approach

### Phase 1: Quick Compilation Fix (30 min)
1. Create `VaultRepositoryStub.kt` with empty deprecated class
2. Create `VaultDaoStub.kt` and `VaultEntryDaoStub.kt` with empty interfaces
3. Add `@Suppress("DEPRECATION")` to classes using stubs
4. **Goal:** Enable compilation and testing

### Phase 2: Refactor ViewModels (2-3 hours)
1. PresetViewModel → FileVaultRepository
2. GeneratorViewModel → FileVaultRepository
3. FolderManagementViewModel → FileVaultRepository
4. TagManagementViewModel → FileVaultRepository

### Phase 3: Refactor Repositories (4-6 hours)
1. ImportExportRepository - complete migration to file-based
2. VaultSyncManager - update sync logic
3. VaultMigrationManager - mark as deprecated, keep for migration

### Phase 4: Cleanup (1 hour)
1. Remove stub classes
2. Run full test suite
3. Update documentation

---

## 📊 Impact Assessment

### Files to Modify: ~10-15 files
### Estimated Time: 8-12 hours total
### Risk Level: Medium
- Core functionality (import/export, sync) affected
- Requires careful testing
- User data migration must be handled correctly

### Testing Requirements:
- ✅ Unit tests for refactored ViewModels
- ✅ Integration tests for ImportExportRepository
- ✅ Manual testing of sync functionality
- ✅ Migration testing (legacy Room → .gpv)

---

## 🚨 Breaking Changes

### For Future Development:
- **Never use:** `VaultRepository`, `VaultDao`, `VaultEntryDao`
- **Always use:** `FileVaultRepository`, `VaultSessionManager`
- **For metadata:** `VaultRegistryDao`, `PasswordHistoryDao`

### Architecture Rules:
1. Sensitive data = in-memory only (after vault unlock)
2. Metadata = Room Database
3. Persistent data = `.gpv` files (encrypted JSON)
4. Sync = upload/download `.gpv` files

---

## ✅ Success Criteria

- [ ] Project compiles without errors
- [ ] All tests pass
- [ ] No references to deleted classes remain
- [ ] Documentation updated
- [ ] Migration path tested
- [ ] Sync functionality works with new system

---

**Next Steps:**
1. Decide: Quick stub fix OR full refactoring?
2. If stub: Create stub classes immediately
3. If refactoring: Start with ViewModels (lowest risk)
4. Schedule migration testing with real user data

**Notes:**
- French strings in `strings.xml` caused encoding errors (fixed by removing accents)
- ConstraintLayout was missing from dependencies (fixed)
- DecryptedVaultEntry class created for compatibility
