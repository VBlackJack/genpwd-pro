# ❌ Build Error Round 2 - Entry CRUD Refactor

## 📊 Progress Report

**Branch:** `claude/entry-crud-refactor-011CUYLbVDNVdxF238ZuefAf`
**Commit:** `674e231` (fixes applied)
**Build time:** 24s
**Result:** ❌ **BUILD FAILED**

### Progress Made:
- ✅ **Original errors:** 27
- ✅ **Resolved:** 6 errors fixed
- ❌ **Remaining:** ~21 errors

---

## ✅ What Was Fixed (Round 1)

1. ✅ **Nullable string safety** - FileVaultRepository.kt:84-86
2. ✅ **Missing `getVaultData()` method** - Replaced with `combine()`
3. ✅ **VaultCryptoManager constructor** - Switched to dependency injection
4. ✅ **Extension imports** - EntryViewModel.kt now has wildcard import

---

## ❌ Remaining Errors (21)

### Error Group 1: Type Inference Issues (VaultSessionManager.kt)

**Lines:** 237, 350, 451, 550
**Count:** 8 errors (2 per line)

```
e: Not enough information to infer type variable T
```

**Affected code pattern:**
```kotlin
// Line 237, 350, 451, 550
return session.vaultData.map { ... }.stateIn(...)
```

**Root cause:** Missing explicit type parameters in `.stateIn()` call.

**Fix needed:**
```kotlin
// BEFORE ❌
return session.vaultData.map { it.entries }.stateIn(
    scope = sessionScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = session.vaultData.value.entries
)

// AFTER ✅
return session.vaultData.map { it.entries }.stateIn<List<VaultEntryEntity>>(
    scope = sessionScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = session.vaultData.value.entries
)
```

**Lines to fix:**
- Line 237: `getEntries()` → `.stateIn<List<VaultEntryEntity>>(...)`
- Line 350: `getFolders()` → `.stateIn<List<FolderEntity>>(...)`
- Line 451: `getTags()` → `.stateIn<List<TagEntity>>(...)`
- Line 550: `getPresets()` → `.stateIn<List<PresetEntity>>(...)`

---

### Error Group 2: Extension Properties Not Resolved (VaultListScreen.kt)

**Lines:** 367, 373, 375
**Count:** 3 errors

```
e: Unresolved reference: title
e: Unresolved reference: username
```

**Problematic code:**
```kotlin
// Line 367
Text(text = entry.title)  // ❌ title not found

// Line 373
subtitle = entry.username  // ❌ username not found
```

**Root cause:** Missing import for extension properties from `VaultEntryEntityExt.kt`

**Fix needed:**
```kotlin
// At top of VaultListScreen.kt
import com.julien.genpwdpro.data.local.entity.*  // ← Add wildcard import
```

---

### Error Group 3: EntryType Enum vs String Mismatch (VaultListScreen.kt)

**Lines:** 351-356
**Count:** 6 errors

```
e: 'when' expression must be exhaustive, add necessary 'else' branch
e: Incompatible types: EntryType and String
```

**Problematic code:**
```kotlin
// Line 351-356
when (entry.entryType) {  // entry.entryType is String
    EntryType.LOGIN -> ...      // ❌ Comparing String to EntryType enum
    EntryType.NOTE -> ...       // ❌ Incompatible types
    EntryType.WIFI -> ...       // ❌ Incompatible types
    EntryType.CARD -> ...       // ❌ Incompatible types
    EntryType.IDENTITY -> ...   // ❌ Incompatible types
    // Missing else branch
}
```

**Fix needed:**
```kotlin
// OPTION 1: Convert String to EntryType
when (entry.entryType.toEntryType()) {
    EntryType.LOGIN -> ...
    EntryType.NOTE -> ...
    EntryType.WIFI -> ...
    EntryType.CARD -> ...
    EntryType.IDENTITY -> ...
}

// OPTION 2: Compare as String
when (entry.entryType) {
    "LOGIN" -> ...
    "NOTE" -> ...
    "WIFI" -> ...
    "CARD" -> ...
    "IDENTITY" -> ...
    else -> ...  // Add else branch
}
```

---

### Error Group 4: Boolean Property Called as Function (VaultListScreen.kt)

**Line:** 384
**Count:** 1 error

```
e: Expression 'hasTOTP' of type 'Boolean' cannot be invoked as a function
```

**Problematic code:**
```kotlin
// Line 384
if (entry.hasTOTP()) {  // ❌ hasTOTP is a Boolean property, not a function
    // ...
}
```

**Fix needed:**
```kotlin
// BEFORE ❌
if (entry.hasTOTP()) {

// AFTER ✅
if (entry.hasTOTP) {  // It's a property, not a method
```

**Note:** In `VaultEntryEntity.kt`, `hasTOTP` is defined as:
```kotlin
val hasTOTP: Boolean = false  // ← Property, not function
```

There's also an extension function `fun VaultEntryEntity.hasTOTP(): Boolean` in `VaultEntryEntityExt.kt` that checks both the property AND the secret. The code should use the extension function, so this might actually need:

```kotlin
import com.julien.genpwdpro.data.local.entity.hasTOTP  // Import extension function
```

---

### Error Group 5: Text Composable Arguments (VaultListScreen.kt)

**Line:** 374
**Count:** 1 error

```
e: None of the following functions can be called with the arguments supplied
```

**Context needed:** Need to see line 374 to diagnose. Likely wrong parameter passed to `Text()`.

---

### Error Group 6: Extension Not Resolved (VaultListViewModel.kt)

**Line:** 61
**Count:** 1 error

```
e: Unresolved reference: title
```

**Fix needed:**
```kotlin
// At top of VaultListViewModel.kt
import com.julien.genpwdpro.data.local.entity.*  // ← Add wildcard import
```

---

### Error Group 7: Type Comparison (VaultListViewModel.kt)

**Line:** 65
**Count:** 1 error

```
e: Operator '==' cannot be applied to 'String' and 'EntryType'
```

**Fix needed:** Same as Error Group 3 - convert String to EntryType or compare as String:
```kotlin
// OPTION 1
entry.entryType.toEntryType() == EntryType.LOGIN

// OPTION 2
entry.entryType == "LOGIN"
```

---

### Error Group 8: Activity Type Mismatch (UnlockVaultScreen.kt)

**Line:** 241
**Count:** 1 error

```
e: Type mismatch: inferred type is ComponentActivity but FragmentActivity was expected
```

**Likely code:**
```kotlin
// Line 241
val activity = LocalContext.current as ComponentActivity  // ❌
// But code expects FragmentActivity
```

**Fix needed:**
```kotlin
val activity = LocalContext.current as FragmentActivity
// OR
val activity = LocalContext.current as? FragmentActivity
```

---

## 📋 Summary of Required Fixes

| File | Errors | Fix Type |
|------|--------|----------|
| **VaultSessionManager.kt** | 8 | Add explicit type parameters to `.stateIn()` |
| **VaultListScreen.kt** | 11 | Import extensions + fix EntryType comparisons + fix hasTOTP call |
| **VaultListViewModel.kt** | 2 | Import extensions + fix type comparison |
| **UnlockVaultScreen.kt** | 1 | Change ComponentActivity to FragmentActivity |
| **TOTAL** | **21** | **4 files to fix** |

---

## 🔧 Quick Fix Checklist

### Fix 1: VaultSessionManager.kt (Lines 237, 350, 451, 550)
```kotlin
// Add explicit type parameter to stateIn()
.stateIn<List<VaultEntryEntity>>(...) // Line 237
.stateIn<List<FolderEntity>>(...)     // Line 350
.stateIn<List<TagEntity>>(...)        // Line 451
.stateIn<List<PresetEntity>>(...)     // Line 550
```

### Fix 2: VaultListScreen.kt
```kotlin
// Add at top
import com.julien.genpwdpro.data.local.entity.*

// Fix when expressions (lines 351-356)
when (entry.entryType.toEntryType()) { ... }

// Fix hasTOTP call (line 384)
if (entry.hasTOTP()) { ... }  // Keep as function call, ensure import
```

### Fix 3: VaultListViewModel.kt
```kotlin
// Add at top
import com.julien.genpwdpro.data.local.entity.*

// Fix type comparison (line 65)
entry.entryType.toEntryType() == EntryType.LOGIN
```

### Fix 4: UnlockVaultScreen.kt (Line 241)
```kotlin
val activity = LocalContext.current as FragmentActivity
```

---

## 🎯 Expected Result After Fixes

```
BUILD SUCCESSFUL in ~1m 30s
APK: app/build/outputs/apk/debug/app-debug.apk
```

---

**Generated by:** Claude CLI
**Date:** 2025-10-27
**Previous errors:** 27 → **Current errors:** 21
**Progress:** 22% reduction in errors
