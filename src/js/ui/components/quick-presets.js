/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Quick Presets Component - BMAD UX Improvement
 * Provides one-click preset buttons for common password configurations.
 */

import { t } from '../../utils/i18n.js';
import { showToast } from '../../utils/toast.js';

/** Storage key for custom presets */
const CUSTOM_PRESETS_KEY = 'genpwd-custom-presets';

/** Custom presets loaded from storage */
let customPresets = {};

/**
 * Predefined quick presets for common use cases
 */
export const QUICK_PRESETS = {
  strong: {
    id: 'strong',
    icon: '🛡️',
    mode: 'syllables',
    length: 24,
    digits: 3,
    specials: 3,
    caseMode: 'mixte',
    policy: 'standard'
  },
  simple: {
    id: 'simple',
    icon: '💬',
    mode: 'passphrase',
    wordCount: 4,
    separator: '-',
    caseMode: 'title',
    digits: 1,
    specials: 0
  },
  maximum: {
    id: 'maximum',
    icon: '🔐',
    mode: 'syllables',
    length: 32,
    digits: 4,
    specials: 4,
    caseMode: 'blocks',
    policy: 'standard'
  },
  apiKey: {
    id: 'apiKey',
    icon: '🔑',
    mode: 'syllables',
    length: 32,
    digits: 4,
    specials: 0,
    caseMode: 'mixte',
    policy: 'alphanumerique'
  },
  banking: {
    id: 'banking',
    icon: '🏦',
    mode: 'syllables',
    length: 24,
    digits: 3,
    specials: 1,
    caseMode: 'mixte',
    policy: 'standard'
  }
};

/**
 * Apply a quick preset configuration to the generator
 * @param {string} presetKey - The preset key to apply
 * @param {Object} options - Options for applying the preset
 * @param {boolean} options.showFeedback - Whether to show a toast notification
 * @param {boolean} options.autoGenerate - Whether to auto-generate after applying
 * @returns {boolean} Whether the preset was applied successfully
 */
export function applyQuickPreset(presetKey, options = {}) {
  const { showFeedback = true, autoGenerate = true } = options;

  // Check both built-in and custom presets
  const preset = QUICK_PRESETS[presetKey] || customPresets[presetKey];
  if (!preset) {
    console.warn(`[QuickPresets] Unknown preset: ${presetKey}`);
    return false;
  }

  try {
    // Update mode selector
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect && preset.mode) {
      modeSelect.value = preset.mode;
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Apply mode-specific settings
    if (preset.mode === 'syllables') {
      applySyllablesPreset(preset);
    } else if (preset.mode === 'passphrase') {
      applyPassphrasePreset(preset);
    }

    // Apply common settings
    applyCommonSettings(preset);

    // Update visual state of quick preset buttons
    updateQuickPresetButtons(presetKey);

    // Show feedback toast
    if (showFeedback) {
      const presetName = preset.isCustom ? preset.name : t(`quickPresets.${presetKey}`);
      showToast(t('quickPresets.applied', { name: presetName }), 'success');
    }

    // Auto-generate if enabled
    if (autoGenerate) {
      const generateBtn = document.getElementById('btn-generate');
      if (generateBtn) {
        // Small delay to allow UI to update
        setTimeout(() => generateBtn.click(), 100);
      }
    }

    return true;
  } catch (error) {
    console.error('[QuickPresets] Error applying preset:', error);
    return false;
  }
}

/**
 * Apply syllables mode specific settings
 */
function applySyllablesPreset(preset) {
  const lengthSlider = document.getElementById('syll-len');
  if (lengthSlider && preset.length) {
    lengthSlider.value = preset.length;
    lengthSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const policySelect = document.getElementById('policy-select');
  if (policySelect && preset.policy) {
    policySelect.value = preset.policy;
    policySelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Apply passphrase mode specific settings
 */
function applyPassphrasePreset(preset) {
  const wordCountSlider = document.getElementById('pp-count');
  if (wordCountSlider && preset.wordCount) {
    wordCountSlider.value = preset.wordCount;
    wordCountSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const separatorSelect = document.getElementById('pp-sep');
  if (separatorSelect && preset.separator) {
    separatorSelect.value = preset.separator;
    separatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Apply common settings (digits, specials, case)
 */
function applyCommonSettings(preset) {
  // Digits
  const digitsSlider = document.getElementById('digits-count');
  if (digitsSlider && preset.digits !== undefined) {
    digitsSlider.value = preset.digits;
    digitsSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Specials
  const specialsSlider = document.getElementById('specials-count');
  if (specialsSlider && preset.specials !== undefined) {
    specialsSlider.value = preset.specials;
    specialsSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Case mode
  const caseModeSelect = document.getElementById('case-mode-select');
  if (caseModeSelect && preset.caseMode) {
    caseModeSelect.value = preset.caseMode;
    caseModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Update the visual state of quick preset buttons
 */
function updateQuickPresetButtons(activePresetKey) {
  const buttons = document.querySelectorAll('.quick-preset-btn');
  buttons.forEach(btn => {
    const presetKey = btn.dataset.preset;
    if (presetKey === activePresetKey) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

/**
 * Initialize quick presets - bind event handlers
 */
export function initQuickPresets() {
  const container = document.getElementById('quick-presets-container');
  if (!container) {
    return;
  }

  // Load custom presets from storage
  loadCustomPresets();

  // Render the quick preset buttons
  renderQuickPresetButtons(container);

  // Bind click events
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-preset-btn');
    if (!btn) return;

    // Handle save button
    if (btn.id === 'btn-save-preset') {
      showSavePresetPrompt();
      return;
    }

    // Handle preset selection
    const presetKey = btn.dataset.preset;
    if (presetKey) {
      applyQuickPreset(presetKey);
    }
  });

  // Keyboard support
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = e.target.closest('.quick-preset-btn');
      if (btn) {
        e.preventDefault();
        if (btn.id === 'btn-save-preset') {
          showSavePresetPrompt();
          return;
        }
        const presetKey = btn.dataset.preset;
        if (presetKey) {
          applyQuickPreset(presetKey);
        }
      }
    }
  });
}

/**
 * Render quick preset buttons into the container
 */
function renderQuickPresetButtons(container) {
  // Built-in presets
  const builtInHtml = Object.entries(QUICK_PRESETS).map(([key, preset]) => `
    <button type="button"
            class="quick-preset-btn"
            data-preset="${key}"
            aria-pressed="false"
            title="${t(`quickPresets.${key}Desc`)}">
      <span class="quick-preset-icon" aria-hidden="true">${preset.icon}</span>
      <span class="quick-preset-label" data-i18n="quickPresets.${key}">${t(`quickPresets.${key}`)}</span>
    </button>
  `).join('');

  // Custom presets
  const customHtml = Object.entries(customPresets).map(([key, preset]) => `
    <button type="button"
            class="quick-preset-btn custom-preset"
            data-preset="${key}"
            aria-pressed="false"
            title="${preset.name}">
      <span class="quick-preset-icon" aria-hidden="true">${preset.icon}</span>
      <span class="quick-preset-label">${preset.name}</span>
    </button>
  `).join('');

  // Save button
  const saveBtn = `
    <button type="button"
            class="quick-preset-btn save-preset"
            id="btn-save-preset"
            title="${t('customPresets.save')}">
      <span class="quick-preset-icon" aria-hidden="true">➕</span>
      <span class="quick-preset-label" data-i18n="customPresets.save">${t('customPresets.save')}</span>
    </button>
  `;

  container.innerHTML = builtInHtml + customHtml + saveBtn;
}

/**
 * Get the currently active preset based on current settings
 * @returns {string|null} The preset key or null if no match
 */
export function detectActivePreset() {
  const modeSelect = document.getElementById('mode-select');
  if (!modeSelect) return null;

  const currentMode = modeSelect.value;
  const digitsSlider = document.getElementById('digits-count');
  const specialsSlider = document.getElementById('specials-count');
  const lengthSlider = document.getElementById('syll-len');
  const wordCountSlider = document.getElementById('pp-count');

  for (const [key, preset] of Object.entries(QUICK_PRESETS)) {
    if (preset.mode !== currentMode) continue;

    if (currentMode === 'syllables') {
      if (lengthSlider && parseInt(lengthSlider.value) === preset.length &&
          digitsSlider && parseInt(digitsSlider.value) === preset.digits &&
          specialsSlider && parseInt(specialsSlider.value) === preset.specials) {
        return key;
      }
    } else if (currentMode === 'passphrase') {
      if (wordCountSlider && parseInt(wordCountSlider.value) === preset.wordCount &&
          digitsSlider && parseInt(digitsSlider.value) === preset.digits &&
          specialsSlider && parseInt(specialsSlider.value) === preset.specials) {
        return key;
      }
    }
  }

  return null;
}

/**
 * Load custom presets from storage
 */
export function loadCustomPresets() {
  try {
    const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (stored) {
      customPresets = JSON.parse(stored);
    }
  } catch {
    customPresets = {};
  }
  return customPresets;
}

/**
 * Save custom presets to storage
 */
function saveCustomPresets() {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
  } catch {
    // Storage not available
  }
}

/**
 * Get current generator settings
 * @returns {Object} Current settings
 */
function getCurrentSettings() {
  const modeSelect = document.getElementById('mode-select');
  const lengthSlider = document.getElementById('syll-len');
  const wordCountSlider = document.getElementById('pp-count');
  const digitsSlider = document.getElementById('digits-count');
  const specialsSlider = document.getElementById('specials-count');
  const policySelect = document.getElementById('policy-select');
  const caseModeSelect = document.getElementById('case-mode-select');
  const separatorSelect = document.getElementById('pp-sep');

  return {
    mode: modeSelect?.value || 'syllables',
    length: parseInt(lengthSlider?.value || '16', 10),
    wordCount: parseInt(wordCountSlider?.value || '4', 10),
    digits: parseInt(digitsSlider?.value || '2', 10),
    specials: parseInt(specialsSlider?.value || '2', 10),
    policy: policySelect?.value || 'standard',
    caseMode: caseModeSelect?.value || 'mixte',
    separator: separatorSelect?.value || '-'
  };
}

/**
 * Create a custom preset from current settings
 * @param {string} name - Name for the preset
 * @param {string} icon - Emoji icon for the preset
 * @returns {Object|null} The created preset or null if invalid
 */
export function createCustomPreset(name, icon = '⚙️') {
  if (!name || name.trim() === '') return null;

  const settings = getCurrentSettings();
  const id = `custom_${Date.now()}`;

  const preset = {
    id,
    icon,
    isCustom: true,
    createdAt: new Date().toISOString(),
    name: name.trim(),
    ...settings
  };

  customPresets[id] = preset;
  saveCustomPresets();

  return preset;
}

/**
 * Delete a custom preset
 * @param {string} presetId - ID of the preset to delete
 */
export function deleteCustomPreset(presetId) {
  if (customPresets[presetId]) {
    delete customPresets[presetId];
    saveCustomPresets();
    showToast(t('customPresets.deleted'), 'info');
  }
}

/**
 * Show save preset prompt
 */
export function showSavePresetPrompt() {
  const name = prompt(t('customPresets.namePrompt'));
  if (name) {
    const preset = createCustomPreset(name);
    if (preset) {
      showToast(t('customPresets.saved'), 'success');
      // Re-render presets to include the new one
      const container = document.getElementById('quick-presets-container');
      if (container) {
        renderQuickPresetButtons(container);
      }
    }
  }
}

/**
 * Get all presets (built-in + custom)
 * @returns {Object} All presets
 */
export function getAllPresets() {
  return { ...QUICK_PRESETS, ...customPresets };
}

export default {
  QUICK_PRESETS,
  applyQuickPreset,
  initQuickPresets,
  detectActivePreset,
  loadCustomPresets,
  createCustomPreset,
  deleteCustomPreset,
  showSavePresetPrompt,
  getAllPresets
};
