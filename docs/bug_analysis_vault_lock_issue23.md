# 🔴 Bug Analysis: Issue #23 - Vaults remain unlocked after app restart

## 🔍 Root Cause Analysis

### Problem: TWO session managers with no synchronization

The codebase has **two separate session management systems** that don't properly communicate:

1. **`SessionManager`** (legacy) - Simple in-memory flag tracker
   - Location: `domain/session/SessionManager.kt`
   - Stores: `currentVaultId` in `MutableStateFlow`
   - Persistence: **NONE** - Pure memory (lost on app restart)

2. **`VaultSessionManager`** (file-based) - Keeps decrypted data in memory
   - Location: `domain/session/VaultSessionManager.kt`
   - Stores: `currentSession: VaultSession?` with full decrypted `VaultData`
   - Persistence: **IMPLICIT** - May persist via `VaultRegistryDao.isLoaded` flag

### Critical Issues Identified

#### ❌ Issue 1: `onDestroy()` is unreliable

```kotlin
// AppLifecycleObserver.kt:74-78
override fun onDestroy(owner: LifecycleOwner) {
    super.onDestroy(owner)
    Log.d(TAG, "App destroyed, locking all vaults")
    lockAllVaults()
}
```

**Problem**: `onDestroy()` is NOT guaranteed to be called by Android:
- Not called when user swipes app away from recent apps
- Not called on process death
- Not called on force close
- Only called in graceful shutdown scenarios

**Solution**: Use `onStop()` or `onPause()` for critical security operations.

---

#### ❌ Issue 2: `VaultRegistryDao.isLoaded` persists in database

```kotlin
// VaultRegistryEntry.kt
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    // ...
    val isLoaded: Boolean = false,  // ← THIS PERSISTS IN ROOM DATABASE
    // ...
)
```

**Problem**: When a vault is unlocked, `isLoaded = true` is saved to Room database.
After app restart:
- `SessionManager.currentSession` is NULL (memory cleared) ✅
- `VaultSessionManager.currentSession` is NULL (memory cleared) ✅
- **BUT** `VaultRegistryEntry.isLoaded` is still TRUE in database ❌

The UI checks `isLoaded` flag and assumes vault is unlocked!

---

#### ❌ Issue 3: `MainActivity.onCreate()` doesn't lock vaults

```kotlin
// MainActivity.kt (legacy behaviour)
private fun setupSessionManagement() {
    lifecycleScope.launch {
        val hasExpired = sessionManager.clearExpiredSessions(SESSION_TIMEOUT_HOURS)
        if (hasExpired) {
            Log.d(TAG, "Sessions expirées nettoyées au démarrage.")
        } else {
            Log.d(TAG, "Aucune session expirée, le coffre reste déverrouillé.")
        }
    }
    lifecycle.addObserver(AppLifecycleObserver(sessionManager, vaultSessionManager))
}
```

**Problem (legacy)**:
- Relied on a separate `SessionManager` that could decide to keep a vault
  unlocked across process restarts.
- Never forced a call to `vaultSessionManager.lockVault()` nor reset registry
  flags when the legacy session considered itself valid.
- Produced inconsistent startup states when a crash occurred between
  backgrounding and the next resume.

**Current state**: the dedicated `SessionManager` has been removed. Startup now
delegates directly to `VaultSessionManager.clearExpiredSession()` and the
`AppLifecycleObserver` only locks the file-based session.

---

#### ❌ Issue 4: Auto-unlock after vault creation

```kotlin
// VaultManagerViewModel.kt:161-166 (from commit 238597d)
// Auto-déverrouiller le vault nouvellement créé
val autoUnlockResult = try {
    vaultSessionManager.unlockVault(vaultId, masterPassword)
} catch (unlockError: Exception) {
    Result.failure(unlockError)
}
```

**Problem**: Every new vault is auto-unlocked, which:
- Sets `isLoaded = true` in database
- Creates a session in `VaultSessionManager`
- If app is closed right after, `isLoaded` stays true forever

---

## 🎯 Required Fixes

### Fix 1: Reset `isLoaded` flags on app start ⭐ CRITICAL

```kotlin
// MainActivity.onCreate() - AFTER setupSessionManagement()
private suspend fun lockAllVaultsOnStartup() {
    Log.d(TAG, "Locking all vaults on app startup for security")

    // 1. Lock VaultSessionManager (clear memory)
    vaultSessionManager.lockVault()

    // 2. Reset ALL isLoaded flags in database
    vaultRegistryDao.updateAllLoadedStatus(false)

    Log.d(TAG, "All vaults locked successfully")
}
```

### Fix 2: Move lock from `onDestroy` to `onStop`

```kotlin
// AppLifecycleObserver.kt
override fun onStop(owner: LifecycleOwner) {
    super.onStop(owner)
    Log.d(TAG, "App moved to background")
    backgroundTimestamp = System.currentTimeMillis()

    // LOCK IMMEDIATELY for security
    Log.d(TAG, "Locking vault immediately on background")
    lockAllVaults()
}
```

### Fix 3: Add DAO method to reset all isLoaded flags

```kotlin
// VaultRegistryDao.kt
@Query("UPDATE vault_registry SET isLoaded = 0")
suspend fun updateAllLoadedStatus(isLoaded: Boolean = false)
```

### Fix 4: Don't persist `isLoaded` in unlockVault

Consider NOT persisting `isLoaded` at all, or use a separate in-memory tracker.

---

## 🧪 Test Plan

1. **Test 1: App restart locks vaults**
   - Create vault A + vault B
   - Unlock both
   - Force close app (swipe away)
   - Reopen app
   - ✅ EXPECT: Both vaults locked, require auth

2. **Test 2: Background timeout locks vaults**
   - Unlock vault A
   - Send app to background
   - Wait 5+ minutes
   - Return to app
   - ✅ EXPECT: Vault locked, require auth

3. **Test 3: Immediate background locks vaults**
   - Unlock vault A
   - Send app to background immediately
   - Return within 1 second
   - ⚠️ EXPECT: Vault should be locked (security > UX)

4. **Test 4: Process death locks vaults**
   - Unlock vault A
   - Kill app process: `adb shell am force-stop com.julien.genpwdpro`
   - Reopen app
   - ✅ EXPECT: Vault locked, require auth

---

## 🚨 Security Recommendations

1. **NEVER trust `isLoaded` flag from database** - It can persist across restarts
2. **ALWAYS lock on `onStop()`** - Don't wait for `onDestroy()`
3. **Reset all lock flags on `onCreate()`** - Assume app was force-closed
4. **Use encryption for sensitive flags** - If they must persist
5. **Add session timeout setting** - Let users configure lock behavior

---

## 📊 Files to Modify

Priority order:

1. ✅ `MainActivity.kt` - Add `lockAllVaultsOnStartup()`
2. ✅ `AppLifecycleObserver.kt` - Move lock to `onStop()`
3. ✅ `VaultRegistryDao.kt` - Add `updateAllLoadedStatus()`
4. ✅ `VaultSessionManager.kt` - Document memory-only nature
5. ⚠️ `VaultManagerViewModel.kt` - Review auto-unlock behavior

---

**Estimated effort**: 2-3 hours
**Testing effort**: 1-2 hours
**Risk**: LOW (adds security, no feature removal)
