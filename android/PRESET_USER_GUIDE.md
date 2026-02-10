# User Guide - Preset System

Quick guide for using the preset system in GenPwd Pro Android.

## Preset System Workflow

### 1. Creating a Vault
When creating a new vault, a **default preset** is automatically created with the following settings:
- **Mode**: Syllables (default)
- **Length**: 20 characters
- **Digits**: 2
- **Specials**: 2
- **Icon**: Lock
- **Non-deletable**: This system preset cannot be deleted

### 2. Using Presets in the Generator

#### Dashboard (Home Screen)
The **quick generator** on the Dashboard uses simple default settings:
- Mode: Syllables
- Length: 16 characters
- Digits: 2
- Specials: 2

**Note**: The quick generator does not use presets because it is not linked to a specific vault.

#### Full Generator ("Generator" Tab)

**To use your presets:**
1. Unlock a vault (via the "Vaults" tab)
2. Go to the "Generator" tab (bottom navigation)
3. The **preset selector** appears automatically
4. The **default preset** is automatically selected
5. Click on the selector to choose a different preset

### 3. Managing Presets

#### Creating a Custom Preset
1. Unlock a vault
2. Go to "Generator"
3. Configure your desired settings
4. Click "Save as preset"
5. Give it a name and choose an icon (15 available)
6. Option: Check "Set as default"

**Limit**: Maximum **3 custom presets** per mode (Syllables and Passphrase)

#### Managing Your Existing Presets
1. From the Dashboard, click "Manage presets" on a vault
   OR
2. From the preset selector, click "Manage"

**Available actions:**
- Edit the name and icon
- Set as default
- Delete (except system preset)
- View usage statistics

### 4. Available Preset Icons

When creating/editing a preset, 15 icons are available:
```
Lock, Key, Shield, Lightning, Target,
Star, Diamond, Rocket, Fire, Star,
Strength, Palette, Masks, Tent, Clapperboard
```

### 5. Preset Statistics

Each preset tracks:
- **Usage count**: Incremented with each generation
- **Last used**: Timestamp updated automatically

These stats are visible in the preset management screen.

## Security

- **Encrypted presets**: Stored with AES-256-GCM
- **Linked to vaults**: Each preset belongs to a vault
- **Vault key**: Used to encrypt/decrypt presets
- **Cascade delete**: If you delete a vault, its presets are also deleted

## App Navigation

### Bottom Navigation (Bottom Bar)
3 main tabs (icons only to save space):
- **Home**: Dashboard with quick generator
- **Generator**: Full generator with presets
- **Vaults**: Vault management

### Dashboard (Home)
- **Quick generator**: Instant generation (without preset)
- **Vault list**: Statistics and quick access
- **Quick tools**: Analyzer, History, Custom phrases

## FAQ

**Q: Why don't I see the preset selector?**
A: You need to unlock a vault first. The selector only appears in the "Generator" tab when a vault is unlocked.

**Q: Can I use presets in the Dashboard quick generator?**
A: No, the quick generator uses simple default settings. To use your presets, go to the "Generator" tab after unlocking a vault.

**Q: How many presets can I create?**
A: Maximum 3 custom presets per mode (Syllables and Passphrase), plus 1 non-deletable default system preset.

**Q: Can I edit the default preset?**
A: The system "Default" preset cannot be edited or deleted. You can create your own presets and mark them as "default" to use them automatically.

**Q: Are presets synchronized?**
A: Presets are stored locally in each vault. If you use cloud synchronization, presets are included in the encrypted vault.

## Full Example Workflow

1. **Launch the app** - Dashboard visible
2. **Create a new vault** - Default preset created automatically
3. **Unlock the vault** - VaultSessionManager keeps the session in memory
4. **Go to "Generator"** - Default preset loaded automatically
5. **Click "Generate"** - Password generated with preset
6. **Modify settings** - Adjust according to your needs
7. **"Save as preset"** - Create a custom preset
8. **Select the new preset** - Use your custom settings
9. **Mark as default** - Used automatically on next launch

## Technical Notes

- **VaultSessionManager**: Keeps the unlocked vault in memory and manages timeout
- **GeneratorViewModel**: Automatically loads presets from the active vault
- **PresetRepository**: Manages encryption/decryption
- **Database Migration**: v4 to v5 adds the presets table
- **Material Design 3**: Modern and consistent UI

---

**Version**: 2.5.2
**Documentation**: Complete and up to date
