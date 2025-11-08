# Preset Management UX - Improvement Opportunities

## Current State vs. Target State

### Android - Current Gaps

#### 1. Preset Editing (CRITICAL)
| Aspect | Current | Target |
|--------|---------|--------|
| Edit Dialog | TODO placeholder | Full modal form |
| Edit Fields | None | Name, Icon, Settings |
| Validation | None needed yet | Name length, icon selection |
| Confirmation | N/A | Save/Cancel buttons |
| Implementation Status | 0% | Ready for implementation |

**Location to Implement:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetListScreen.kt` lines 285-299

**Backend Ready:** Yes - `PresetViewModel.updatePreset()` is fully implemented

---

#### 2. 3-Preset Limit Feedback (MEDIUM)
| Aspect | Current | Target |
|--------|---------|--------|
| Feedback Before Limit | Generic error message | Visual counter + disabled state |
| Where Shown | Error snackbar after attempt | Info card + button disabled state |
| UX Impact | Frustrating | Preventive, clear |

**Current Code:** `/home/user/genpwd-pro/android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetListScreen.kt` lines 99-131

**Suggested UI Mockup:**
```
┌─────────────────────────────────────┐
│ PRESET LIMIT: 3 per mode            │
├─────────────────────────────────────┤
│                                     │
│ Syllables: [==] 2/3 [⬜ +]          │ <- Add button DISABLED if 3/3
│ Passphrase: [=] 1/3 [+]            │
│                                     │
└─────────────────────────────────────┘
```

---

#### 3. Settings Preview in List (LOW)
| Aspect | Current | Target |
|--------|---------|--------|
| Settings Display | Text summary only | Full config card or preview modal |
| Edit from List | No | Quick edit link |
| Duplicate Preset | No | Duplicate button |

**Current:** PresetManagementCard shows 1-line summary like "20 chars • 2 chiffres • 2 spéciaux"

**Enhanced Version:**
```kotlin
// In PresetManagementCard, add expandable section:
// Click to see full settings like:
// - Length: 20 characters
// - Policy: Standard
// - Digits: 2 (placement: aléatoire)
// - Specials: 2 (placement: aléatoire)
// - Custom specials: _+-=.@#%
```

---

### Web - Current Gaps

#### 1. Save Dialog UX (CRITICAL)
| Aspect | Current | Target |
|--------|---------|--------|
| Input Method | Browser prompt() | Modal dialog with form |
| Fields | Name, Description | Name, Description, Icon selector, Settings preview |
| Validation | None | Required fields, name length limits |
| Settings Display | Hidden | Show current settings being saved |

**Current Code:** `/home/user/genpwd-pro/src/js/ui/features-ui.js` lines 518-547

**New Modal Should Include:**
```html
<div class="save-preset-modal">
  <h2>Save Preset</h2>
  
  <div class="form-group">
    <label>Preset Name *</label>
    <input type="text" required>
    <span class="error" hidden></span>
  </div>
  
  <div class="form-group">
    <label>Description</label>
    <textarea></textarea>
  </div>
  
  <div class="form-group">
    <label>Icon</label>
    <select>
      <option>🔐 Secure</option>
      <option>🔒 Password</option>
      <option>✨ Special</option>
      <!-- ... more options ... -->
    </select>
  </div>
  
  <div class="settings-preview">
    <h3>Configuration to Save:</h3>
    <ul>
      <li>Mode: Syllables</li>
      <li>Length: 20 chars</li>
      <li>Digits: 2</li>
      <!-- ... full config ... -->
    </ul>
  </div>
  
  <div class="modal-actions">
    <button>Save</button>
    <button>Cancel</button>
  </div>
</div>
```

---

#### 2. Preset Editing (CRITICAL)
| Aspect | Current | Target |
|--------|---------|--------|
| Edit Feature | Not available | Modal form (similar to save) |
| Edit Trigger | None | Edit button in manage modal |
| Fields | N/A | Name, Description, Icon |
| Settings Edit | N/A | Show but read-only note (to change: delete + recreate or add new update logic) |

**Implementation Approach:**
```javascript
// In bindPresetModalEvents(), add case:
case 'edit':
  showEditPresetModal(presetId);
  break;

// New function:
function showEditPresetModal(presetId) {
  const preset = presetManager.getPreset(presetId);
  // Show modal similar to save dialog
  // Call: presetManager.updatePreset(id, updates)
}
```

---

#### 3. Settings Preview in Manage Modal (MEDIUM)
| Aspect | Current | Target |
|---------|---------|--------|
| Displayed Info | Name, Description, Created | Add full config summary |
| Display Format | Text only | Card with sections |
| Expandable | No | Yes, click to expand |

**Current Display:** (lines 648-665)
```javascript
${presets.map(preset => `
  <div class="preset-item" data-preset-id="${preset.id}">
    <div class="preset-info">
      <div class="preset-name">${preset.name}</div>
      <div class="preset-desc">${preset.description}</div>
      <div class="preset-meta">Créé: ${date}</div>
    </div>
```

**Enhanced:**
```javascript
<div class="preset-item" data-preset-id="${preset.id}">
  <div class="preset-header" data-toggle="preset-${preset.id}">
    <div class="preset-name">${preset.name}</div>
    <span class="toggle-icon">▼</span>
  </div>
  
  <div class="preset-info" id="preset-${preset.id}">
    <div class="preset-desc">${preset.description}</div>
    
    <div class="preset-config">
      <strong>Settings:</strong>
      <ul>
        <li>Mode: ${preset.config.mode}</li>
        <li>Length: ${preset.config.length}</li>
        <li>Policy: ${preset.config.policy}</li>
        <!-- ... more settings ... -->
      </ul>
    </div>
    
    <div class="preset-meta">
      Créé: ${date} | Modifié: ${updated}
    </div>
  </div>
```

---

### Cross-Platform UX Improvements

#### 1. Preset Duplication
**Current:** Not available on either platform
**Target:** "Duplicate" button on preset card
**Benefit:** Users can create variations without starting fresh
**Implementation:** ~5 minutes per platform

```
Duplicate Flow:
1. User clicks "Duplicate" on preset
2. New preset created with name "Copy of [Original Name]"
3. User can immediately edit the copy
4. Original unchanged
```

#### 2. Preset Search
**Android:** Not visible in PresetListScreen (could be added)
**Web:** No search in manage modal
**Target:** Search field in manage modal

```kotlin
// Android:
// Add search field to PresetListScreen
val searchQuery by remember { mutableStateOf("") }
val filteredPresets = uiState.presets.filter { 
  it.name.contains(searchQuery, ignoreCase = true)
}
```

#### 3. Preset Categories/Tags
**Current:** Only grouped by generation mode
**Target:** Custom categories or tags
**Benefit:** Better organization for power users with many presets

---

## Implementation Priority Roadmap

### Phase 1 - Critical (UX Blockers)
1. **[Android]** Implement edit dialog in PresetListScreen
   - Effort: 3-4 hours
   - Backend: Ready
   - Files: PresetListScreen.kt only

2. **[Web]** Replace prompt() with proper modal for save
   - Effort: 2-3 hours
   - Files: features-ui.js (new savePresetModal function)

### Phase 2 - Important (Feature Parity)
3. **[Web]** Add preset editing feature
   - Effort: 2-3 hours
   - Files: features-ui.js (add edit button, editPresetModal function)

4. **[Both]** Improve 3-preset limit feedback
   - Effort: 1 hour each
   - Files: PresetListScreen.kt, features-ui.js

### Phase 3 - Nice-to-Have (Polish)
5. **[Both]** Add preset duplication
   - Effort: 1-2 hours
   - High user value

6. **[Both]** Add settings preview in lists
   - Effort: 2 hours
   - Improves discoverability

7. **[Both]** Add search/filter functionality
   - Effort: 1-2 hours

---

## Code Examples

### Android - Edit Dialog Template

```kotlin
// In PresetListScreen.kt, replace lines 285-299:

showEditDialog?.let { preset ->
    var editName by remember { mutableStateOf(preset.name) }
    var editIcon by remember { mutableStateOf(preset.icon) }
    
    AlertDialog(
        onDismissRequest = { showEditDialog = null },
        title = { Text("Modifier le preset") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = editName,
                    onValueChange = { editName = it },
                    label = { Text("Nom") },
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = editIcon,
                    onValueChange = { editIcon = it },
                    label = { Text("Icône") },
                    modifier = Modifier.fillMaxWidth()
                )
                
                Text(
                    "Configuration: ${preset.settings.toSummary()}",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    viewModel.updatePreset(
                        preset.copy(name = editName, icon = editIcon)
                    )
                    showEditDialog = null
                }
            ) {
                Text("Sauvegarder")
            }
        },
        dismissButton = {
            TextButton(onClick = { showEditDialog = null }) {
                Text("Annuler")
            }
        }
    )
}
```

### Web - Edit Modal Template

```javascript
function showEditPresetModal(presetId) {
  const preset = presetManager.getPreset(presetId);
  if (!preset) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Modifier le preset</h2>
        <button class="modal-close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="edit-name" 
                 value="${preset.name}" required>
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea id="edit-desc"
                    class="grow">${preset.description || ''}</textarea>
        </div>
        
        <div class="preset-config-display">
          <strong>Configuration (non modifiable):</strong>
          <ul>
            <li>Mode: ${preset.config.mode}</li>
            <li>Longueur: ${preset.config.length}</li>
            <!-- ... show all settings ... -->
          </ul>
          <p style="font-size: 0.85em; color: #666;">
            Pour modifier la configuration, 
            supprimez ce preset et créez-en un nouveau.
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn" id="save-edit">Sauvegarder</button>
        <button class="btn secondary" id="cancel-edit">Annuler</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event handlers
  modal.querySelector('#save-edit').addEventListener('click', () => {
    const name = modal.querySelector('#edit-name').value;
    const desc = modal.querySelector('#edit-desc').value;
    
    if (!name) {
      alert('Name is required');
      return;
    }
    
    presetManager.updatePreset(presetId, {
      name: name,
      description: desc
    });
    
    modal.remove();
    updatePresetDropdown();
    showToast('Preset updated!', 'success');
  });
  
  modal.querySelector('#cancel-edit').addEventListener('click', () => {
    modal.remove();
  });
}
```

---

## Testing Checklist for Improvements

- [ ] Create preset with maximum allowed name length
- [ ] Edit preset and verify changes persist
- [ ] Delete preset and verify undo not available
- [ ] Hit 3-preset limit and verify clear error/disabled state
- [ ] Duplicate preset and verify original unchanged
- [ ] Export edited preset as JSON
- [ ] Import preset and verify all fields
- [ ] Search/filter presets with partial matches
- [ ] Load preset after editing and verify latest settings apply

