# Preset Management System - File Reference Guide

## Complete File Listing

### ANDROID - Core Preset Files

#### Data Models
- **DecryptedPreset.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/models/vault/DecryptedPreset.kt`
  - Purpose: UI-friendly preset model with strongly-typed fields
  - Key Functions: `toDecrypted()`, `toEntity()`

- **VaultEntities.kt** (Contains PresetEntity)
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/models/vault/VaultEntities.kt`
  - Lines: 229-264
  - Purpose: Storage model for encrypted vault data

#### Business Logic Layer
- **FileVaultRepository.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt`
  - Lines: 307-492 (Preset Operations)
  - Purpose: Repository pattern - high-level API for preset operations
  - Key Methods: 
    - `getPresetsDecrypted()` (Flow)
    - `createPreset(DecryptedPreset)`
    - `updatePresetDecrypted(preset)`
    - `canCreatePreset(GenerationMode)`
    - `recordPresetUsage(presetId)`

#### ViewModel Layer
- **PresetViewModel.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetViewModel.kt`
  - Purpose: State management for preset operations
  - Key State: `PresetUiState` with computed properties:
    - `presetsByMode`: Grouped by generation mode
    - `defaultPreset`: Current default
    - `syllablesPresets` / `passphrasePresets`: Filtered lists
  - Key Methods:
    - `loadPresets(vaultId)`
    - `createPreset(name, icon, mode, settings, setAsDefault)`
    - `updatePreset(preset)`
    - `deletePreset(presetId)`
    - `setAsDefault(presetId)`
    - `recordUsage(presetId)` - Auto-called after generation
    - `canCreatePreset(mode)` - Suspend function

- **VaultPresetViewModel.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/vault/VaultPresetViewModel.kt`
  - Purpose: Vault-level preset management
  - Key Methods: `loadPresets()`, `deletePreset(id)`, `clearError()`

#### UI Layer (Jetpack Compose)
- **PresetListScreen.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetListScreen.kt`
  - Lines: 305-445 (PresetManagementCard component)
  - Purpose: Main preset management interface
  - Features: List by mode, stats display, edit/delete dialogs
  - INCOMPLETE: Edit dialog (lines 285-299)

- **PresetSelector.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetSelector.kt`
  - Purpose: BottomSheet picker for preset selection
  - Key Component: `PresetListContent` (lines 94-195), `PresetItem` (lines 200-289)

- **VaultPresetsScreen.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/vault/VaultPresetsScreen.kt`
  - Purpose: Vault-level preset browsing
  - Delete functionality: Lines 179-212

- **PresetDetailScreen.kt**
  - Path: `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/vault/PresetDetailScreen.kt`
  - Purpose: Read-only preset details
  - INCOMPLETE: "Test in Generator" (line 254), Edit button (line 264)

---

### WEB - Preset Files

#### Core Logic
- **preset-manager.js**
  - Path: `/home/user/genpwd-pro/src/js/utils/preset-manager.js`
  - Lines: 35-373 (PresetManager class)
  - Pattern: Singleton
  - Storage: Browser localStorage with key `'genpwd_presets'`
  - Key Methods:
    - `createPreset(name, config, desc)`
    - `getPreset(id)`
    - `getAllPresets()`
    - `updatePreset(id, updates)`
    - `deletePreset(id)`
    - `exportPreset(id)` / `importPreset(json)`
    - `exportAll()` / `importAll(json)`
    - `setAsDefault(id)`
    - `searchPresets(query)`

#### UI Integration
- **features-ui.js**
  - Path: `/home/user/genpwd-pro/src/js/ui/features-ui.js`
  - Key Sections:
    - **initializePresetsUI()** (lines 421-474)
      - Creates presets section in config panel
      - Adds buttons: Save, Manage, Load dropdown
    - **showSavePresetDialog()** (lines 516-547)
      - Uses prompt() for name/description
      - Gathers form configuration
    - **showManagePresetsModal()** (lines 622-683)
      - Display all presets with metadata
      - Shows actions: Load, Export, Delete
    - **bindPresetModalEvents()** (lines 688-770)
      - Modal action handlers
      - Import/Export buttons
      - Delete confirmation
    - **loadPreset()** (lines 552-617)
      - Applies preset config to form
      - Triggers change events

- **app.js**
  - Path: `/home/user/genpwd-pro/src/js/app.js`
  - Lines: 34, 98-100, 151-152, 169, 174
  - Initialization: Imports presetManager, exposes globally as `window.genpwdPresets`

---

### Documentation

- **PRESET_USER_GUIDE.md**
  - Path: `/home/user/genpwd-pro/android/PRESET_USER_GUIDE.md`
  - Purpose: User-facing preset management documentation

---

## Quick Navigation

### To Add/Modify Preset Creation:
1. Start in: `PresetViewModel.kt` - `createPreset()`
2. Check limits in: `FileVaultRepository.kt` - `canCreatePreset()`
3. Update UI in: `PresetListScreen.kt` or `PresetSelector.kt`

### To Implement Preset Editing:
1. Add modal in: `PresetListScreen.kt` (replace TODO at line 285)
2. Implement in: `PresetViewModel.kt` - use existing `updatePreset()`
3. Update UI state in: `PresetUiState`

### To Add Web Edit Feature:
1. Modify: `features-ui.js` - `showManagePresetsModal()`
2. Add modal dialog with form fields
3. Call: `presetManager.updatePreset(id, updates)`
4. Add button in actions (currently has: Load, Export, Delete)

### To Improve UI Feedback (3-Preset Limit):
1. **Android**: Update `PresetListScreen.kt` info card (lines 99-131)
2. **Web**: Add feedback in save dialog, disable button if at limit

---

## Data Flow Diagrams

### Android - Create Preset Flow
```
UI (PresetListScreen)
    ↓ click "Save Preset" (manual in generator)
PresetViewModel.createPreset(name, icon, mode, settings)
    ↓ checks canCreatePreset()
FileVaultRepository.createPreset(DecryptedPreset)
    ↓ converts to PresetEntity
VaultSessionManager.addPreset(preset)
    ↓ encodes to JSON, encrypts
VaultFileManager.saveVault()
    ↓
.gpv file (encrypted)
    ↓ Flow emission
PresetListScreen receives updated list
```

### Web - Load Preset Flow
```
UI (Manage Modal - Load action)
    ↓ click "Charger"
PresetManager.getPreset(id)
    ↓ retrieves from localStorage
Returns Preset object with config
    ↓
loadPreset() function
    ↓ apply to form fields
Dispatch change events
    ↓
UI updates (dependent fields respond)
```

### Android - Usage Recording Flow
```
GeneratorScreen generates password with preset
    ↓
PresetViewModel.recordUsage(presetId)
    ↓
FileVaultRepository.recordPresetUsage(presetId)
    ↓
Updates preset.usageCount++ and preset.lastUsedAt
    ↓
Saved to .gpv file
    ↓
Statistics available in PresetDetailScreen
```

---

## Key Constants & Limits

| Constant | Value | Location |
|----------|-------|----------|
| Max presets per mode (Android) | 3 | FileVaultRepository.canCreatePreset() |
| Max presets per mode (Web) | Unlimited | - |
| Storage key (Web) | `'genpwd_presets'` | preset-manager.js line 32 |
| Default preset ID (Web) | `'default'` | preset-manager.js line 33 |
| Icon default (Android) | "🔐" | VaultEntities.kt line 239 |

---

## File Dependencies

```
PresetListScreen.kt
    ├─ PresetViewModel
    ├─ PresetManagementCard
    ├─ StatChip
    └─ EmptyPresetsState

PresetSelector.kt
    ├─ PresetListContent
    └─ PresetItem

FileVaultRepository.kt
    ├─ VaultSessionManager
    ├─ PresetEntity
    ├─ DecryptedPreset
    └─ GenerationMode

features-ui.js
    ├─ presetManager
    ├─ i18n
    └─ showToast()
```

