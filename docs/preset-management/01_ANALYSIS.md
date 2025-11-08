# GenPwd Pro - Preset Management System Analysis

## Overview
The application implements a **dual-platform preset management system** with separate implementations for Android (Kotlin) and Web (JavaScript).

---

## 1. PRESET DATA STRUCTURES

### Android Platform (Kotlin)

#### PresetEntity (Storage Model)
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/models/vault/VaultEntities.kt`

```kotlin
data class PresetEntity(
    val id: String,                      // UUID for uniqueness
    val vaultId: String,                 // Parent vault ID
    val name: String,                    // User-friendly name
    val icon: String = "🔐",             // Emoji icon
    val generationMode: String,          // "SYLLABLES" or "PASSPHRASE"
    val settings: String,                // JSON-serialized Settings
    val isDefault: Boolean = false,      // Only one per vault
    val isSystemPreset: Boolean = false, // System-provided, non-editable
    val createdAt: Long,                 // Timestamp
    val modifiedAt: Long,                // Timestamp
    val lastUsedAt: Long?,               // Nullable timestamp
    val usageCount: Int = 0              // Statistics tracking
)
```

#### DecryptedPreset (UI Model)
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/models/vault/DecryptedPreset.kt`

- Strongly-typed wrapper of PresetEntity
- Converts JSON settings string to `Settings` object
- Converts generationMode string to `GenerationMode` enum
- Used exclusively by ViewModels and UI layers
- Includes conversion functions: `toDecrypted()` and `toEntity()`

### Web Platform (JavaScript)

#### Preset Object
**File:** `/home/user/genpwd-pro/src/js/utils/preset-manager.js`

```javascript
{
  id: string,              // 'preset_' + timestamp + random
  name: string,            // User-friendly name
  description: string,     // Optional description
  config: {
    mode: string,          // 'syllables', 'passphrase'
    length: number,        // 20
    policy: string,        // 'standard', 'alphanumeric'
    digits: number,        // 2
    specials: number,      // 2
    customSpecials: string,// '_+-=.@#%'
    placeDigits: string,   // 'aleatoire', 'debut', 'fin', 'milieu'
    placeSpecials: string, // 'aleatoire', 'debut', 'fin', 'milieu'
    caseMode: string,      // 'mixte'
    quantity: number       // 5
  },
  createdAt: Date,
  updatedAt: Date,
  isDefault: boolean
}
```

---

## 2. WHERE PRESETS ARE STORED/DEFINED

### Android (Vault-based)
- **Location:** Inside encrypted `.gpv` (vault) files
- **Management:** `FileVaultRepository` (file-based system, replaced legacy Room database)
- **Session Management:** `VaultSessionManager` loads/decrypts presets into memory after vault unlock
- **Encryption:** Handled by `VaultCryptoManager`
- **Limitations:**
  - Maximum 3 presets per generation mode (per vault)
  - One default preset per vault
  - System presets are read-only

### Web (Browser)
- **Location:** Browser `localStorage` with key `'genpwd_presets'`
- **Management:** `PresetManager` class (singleton pattern)
- **Storage Format:** JSON array serialized to localStorage
- **Limitations:**
  - No explicit preset limit enforced (browser storage constraints apply)
  - Default preset marked with `isDefault: true`
  - Cannot delete the default preset

---

## 3. UI DISPLAY COMPONENTS

### Android

#### 1. **PresetListScreen.kt**
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetListScreen.kt`

- Main preset management interface
- **Features:**
  - Lists all presets grouped by generation mode (SYLLABLES, PASSPHRASE)
  - Shows default preset separately at top
  - Displays usage count and last used timestamp
  - Limit indicator: "Syllables: 2/3 • Passphrase: 1/3"
  - Settings summary display per preset
  - Visual indicators for default (⭐) and system (🔒) presets

- **Components:**
  - `PresetManagementCard`: Individual preset card with stats and actions
  - `StatChip`: Usage statistics display
  - `EmptyPresetsState`: Placeholder when only default preset exists

#### 2. **PresetSelector.kt**
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetSelector.kt`

- BottomSheet preset picker for quick selection
- **Features:**
  - Shows currently selected preset in a button
  - Dropdown with all available presets
  - Grouped by mode (SYLLABLES, PASSPHRASE)
  - Quick "Create Preset" button
  - Settings summary for each preset
  - Visual check mark on selected preset

#### 3. **VaultPresetsScreen.kt**
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/vault/VaultPresetsScreen.kt`

- Vault-level preset browsing
- **Features:**
  - Grouped display by generation mode
  - Default preset indicator card
  - Click to view details
  - Delete button (system presets disabled)

#### 4. **PresetDetailScreen.kt**
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/vault/PresetDetailScreen.kt`

- Read-only preset details view
- **Features:**
  - Icon and name header (with indicators)
  - Usage statistics (count, last used date)
  - Creation/modification timestamps
  - System preset badge
  - "Test in Generator" button (TODO)
  - "Edit" button (TODO, only for non-system presets)

### Web

#### Presets UI Section in features-ui.js
**Location:** `/home/user/genpwd-pro/src/js/ui/features-ui.js` (lines 421-474)

- **Integrated into config panel:** Section with collapsible header
- **Controls:**
  - "💾 Save Preset" button → Opens save dialog
  - "🗂️ Manage Presets" button → Opens management modal
  - Dropdown select: Load existing preset

#### Manage Presets Modal
- **Display:** Grid/list of all presets with name, description, creation date
- **Actions per preset:**
  - Load preset
  - Export preset (JSON)
  - Delete preset (if not default)
- **Modal footer:**
  - Import preset button
  - Export all presets button

---

## 4. PRESET CREATION, EDITING, DELETION COMPONENTS

### Android

#### Creation
**File:** `PresetViewModel.kt` - `createPreset()` function

```kotlin
fun createPreset(
    name: String,
    icon: String,
    mode: GenerationMode,
    settings: Settings,
    setAsDefault: Boolean = false
)
```

- Validates: max 3 presets per mode (`canCreatePreset()`)
- Creates `DecryptedPreset` with auto-generated UUID
- Delegates to `FileVaultRepository.createPreset()`
- Emits `createdPresetId` in UI state for navigation

**Current Status:** ✅ Implemented

#### Editing
**Location:** `PresetListScreen.kt` (lines 285-299)

- **Dialog defined but NOT implemented** (TODO comment visible)
- Current placeholder only shows "Fonctionnalité en cours de développement..."
- ViewModel has `updatePreset()` method ready

**Current Status:** ⚠️ Pending Implementation

#### Deletion
**Location:** `PresetListScreen.kt` (lines 231-282)

```kotlin
fun deletePreset(presetId: String)
```

- Confirmation dialog with warning icon
- Disabled for system presets
- Shows preset name and icon in confirmation
- Emits success/error via snackbar

**Current Status:** ✅ Implemented

### Web

#### Creation
**Location:** `features-ui.js` - `showSavePresetDialog()` (lines 518-547)

```javascript
function showSavePresetDialog() {
  const name = prompt('Nom du preset:');
  const description = prompt('Description (optionnelle):');
  const config = { /* gather all form values */ };
  presetManager.createPreset(name, config, description);
}
```

- Prompts for name and description
- Gathers all current configuration from form
- Creates preset and updates dropdown
- Shows toast notification

**Current Status:** ✅ Implemented (basic)

#### Editing
- **NOT directly implemented**
- Could be added via modal dialog
- Would require: name, description, and config modification

**Current Status:** ❌ Not Available

#### Deletion
**Location:** `features-ui.js` - `bindPresetModalEvents()` (lines 725-731)

```javascript
case 'delete':
  if (confirm('Supprimer ce preset ?')) {
    presetManager.deletePreset(presetId);
    updatePresetDropdown();
  }
  break;
```

- Confirmation dialog
- Cannot delete if `isDefault: true`
- Updates dropdown after deletion

**Current Status:** ✅ Implemented

---

## 5. REPOSITORY & BUSINESS LOGIC LAYER

### Android - FileVaultRepository
**File:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt`

#### Available Methods

| Method | Purpose | Return Type |
|--------|---------|-------------|
| `getPresets()` | Stream all presets | `Flow<List<PresetEntity>>` |
| `getPresetById(id)` | Get single preset | `PresetEntity?` |
| `addPreset(preset)` | Create new | `Result<Unit>` |
| `updatePreset(preset)` | Modify existing | `Result<Unit>` |
| `deletePreset(id)` | Remove preset | `Result<Unit>` |
| `canCreatePreset(mode)` | Check 3-preset limit | `Boolean` |
| `getDefaultPreset()` | Get default | `PresetEntity?` |
| `setAsDefaultPreset(id)` | Make default | `Result<Unit>` |
| `recordPresetUsage(id)` | Update stats | `Result<Unit>` |
| `getPresetsDecrypted()` | UI-friendly version | `Flow<List<DecryptedPreset>>` |
| `createPreset(DecryptedPreset)` | UI layer creation | `String?` (ID) |
| `updatePresetDecrypted(preset)` | UI layer update | `Unit` |
| `canCreatePreset(GenerationMode)` | Overload for enums | `Boolean` |

### Web - PresetManager
**File:** `/home/user/genpwd-pro/src/js/utils/preset-manager.js`

#### Available Methods

| Method | Purpose |
|--------|---------|
| `loadPresets()` | Load from localStorage |
| `savePresets()` | Persist to localStorage |
| `ensureDefaultPreset()` | Create default if missing |
| `createPreset(name, config, desc)` | Create new preset |
| `getPreset(id)` | Retrieve single preset |
| `getAllPresets()` | Get all presets array |
| `updatePreset(id, updates)` | Modify preset |
| `deletePreset(id)` | Remove preset (not default) |
| `exportPreset(id)` | Export single as JSON |
| `importPreset(json)` | Import from JSON |
| `exportAll()` | Export all as JSON |
| `importAll(json)` | Import multiple |
| `searchPresets(query)` | Search by name/description |
| `getDefaultPreset()` | Get default preset |
| `setAsDefault(id)` | Make default |
| `clearAll()` | Clear non-default presets |

---

## 6. INTEGRATION WITH PASSWORD GENERATION

### Android
- **PresetViewModel** is injected into password generator screens
- `recordPresetUsage()` automatically called after generation with selected preset
- Presets available in generator via `PresetSelector` component

### Web
- **Preset loading** applies all settings back to form fields
- Triggers `change` events to update dependent UI (like mode change)
- Integrates with main generation flow through shared form elements

---

## 7. KEY STATISTICS & METADATA

### Tracked Per Preset

| Field | Purpose | Update Trigger |
|-------|---------|-----------------|
| `usageCount` | How many times preset was used | After each generation |
| `lastUsedAt` | Timestamp of last use | After each generation |
| `createdAt` | When preset was created | On preset creation |
| `modifiedAt` | When preset was last modified | On update or settings change |

---

## 8. CURRENT LIMITATIONS & TODOs

### Android
1. **Edit Dialog NOT Implemented**
   - File: `PresetListScreen.kt` line 284-299
   - Has TODO comment: "TODO: Implémenter le dialog d'édition"
   - ViewModel method `updatePreset()` is ready

2. **Test in Generator Link**
   - File: `PresetDetailScreen.kt` line 254
   - Has TODO: "TODO: Navigate to generator with preset"

3. **Max 3 Presets Per Mode**
   - Hard limit enforced in `canCreatePreset()`
   - No UI feedback before hitting limit beyond error message

### Web
1. **No Edit Feature**
   - Presets are save-once, overwrite not implemented
   - Would require modal dialog implementation

2. **Basic Save Dialog**
   - Uses browser `prompt()` for name/description
   - Limited user experience compared to modal

3. **No Settings Summary**
   - Manage modal doesn't show detailed config preview
   - Only name, description, creation date visible

---

## 9. ARCHITECTURE PATTERNS

### Android (MVVM Pattern)
```
UI Layer (Composables)
    ↓
ViewModel (PresetViewModel, VaultPresetViewModel)
    ↓
Repository (FileVaultRepository)
    ↓
Session Manager (VaultSessionManager)
    ↓
File System (.gpv encrypted files)
```

### Web (Singleton Pattern)
```
UI Components (features-ui.js)
    ↓
PresetManager Singleton
    ↓
Browser localStorage
```

---

## 10. UX IMPROVEMENT OPPORTUNITIES

1. **Android:**
   - Complete preset editing with full form modal
   - Show config preview in management screen
   - Better feedback for 3-preset limit (counter, disabled state)
   - Batch operations (duplicate, export multiple)

2. **Web:**
   - Replace prompt() with proper modal dialog
   - Add edit functionality via modal
   - Show configuration preview in manage modal
   - Drag-to-reorder presets
   - Favorite/star presets for quick access

3. **Both:**
   - Preset templates/suggestions
   - Duplicate preset feature
   - Organize presets in categories
   - Share presets (with security considerations)
   - Sync presets across devices
   - Usage analytics dashboard

