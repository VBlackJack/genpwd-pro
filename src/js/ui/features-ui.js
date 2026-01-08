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

// src/js/ui/features-ui.js - UI components for advanced features

import { i18n } from '../utils/i18n.js';
import presetManager from '../utils/preset-manager.js';
import historyManager from '../utils/history-manager.js';
import pluginManager from '../utils/plugin-manager.js';
import importExportService from '../services/import-export-service.js';
import hibpService from '../services/hibp-service.js';
import { showToast } from '../utils/toast.js';
import { safeLog } from '../utils/logger.js';
import { escapeHtml } from '../utils/helpers.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';

/**
 * Simple throttle utility for scroll/resize events
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls (ms)
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let lastCall = 0;
  let timeout = null;
  return function(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastCall = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}
import { getBlocks, setBlocks, setUIState } from '../config/settings.js';
import { renderChips, updateBlockSizeLabel } from './dom.js';
import { showConfirm } from './modal-manager.js';

/**
 * Shared validation utility for preset name fields
 * @param {HTMLInputElement} nameInput - The name input element
 * @param {HTMLElement} nameError - The error display element
 * @returns {boolean} True if valid
 */
function validatePresetName(nameInput, nameError) {
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = i18n.t('toast.nameRequired');
    nameError.hidden = false;
    nameInput.setAttribute('aria-invalid', 'true');
    return false;
  }
  if (name.length > 50) {
    nameError.textContent = i18n.t('toast.nameTooLong');
    nameError.hidden = false;
    nameInput.setAttribute('aria-invalid', 'true');
    return false;
  }
  nameError.hidden = true;
  nameInput.removeAttribute('aria-invalid');
  return true;
}

// AbortController for language selector event listeners cleanup
let langSelectorAbortController = null;

/**
 * Cleanup language selector event listeners
 * @returns {void}
 */
export function cleanupLanguageSelector() {
  if (langSelectorAbortController) {
    langSelectorAbortController.abort();
    langSelectorAbortController = null;
  }
  // Remove dropdown from DOM if exists
  const langDropdown = document.getElementById('lang-dropdown');
  if (langDropdown) {
    langDropdown.remove();
  }
}

/**
 * Initialize language selector in header
 */
export function initializeLanguageSelector() {
  // Cleanup any existing listeners first
  cleanupLanguageSelector();
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Create language selector button (only button, not dropdown)
  const langSelector = document.createElement('div');
  langSelector.className = 'language-selector';
  langSelector.innerHTML = sanitizeHTML(`
    <button class="lang-btn" id="lang-btn" aria-label="${i18n.t('settings.changeLanguage')}" title="${i18n.t('settings.language')}">
      <span class="lang-flag" id="lang-flag">${escapeHtml(i18n.getLocaleFlag(i18n.getLocale()))}</span>
      <span class="lang-code" id="lang-code">${escapeHtml(i18n.getLocale().toUpperCase())}</span>
    </button>
  `);

  // Insert before the about button
  const aboutBtn = document.querySelector('.about-btn');
  if (aboutBtn) {
    headerRight.insertBefore(langSelector, aboutBtn);
  } else {
    headerRight.appendChild(langSelector);
  }

  // Create dropdown in body (to escape header z-index context)
  const langDropdown = document.createElement('div');
  langDropdown.className = 'lang-dropdown-portal hidden';
  langDropdown.id = 'lang-dropdown';
  langDropdown.innerHTML = sanitizeHTML(`
    <button class="lang-option" data-lang="fr">
      <span class="lang-flag">🇫🇷</span>
      <span class="lang-name">Français</span>
    </button>
    <button class="lang-option" data-lang="en">
      <span class="lang-flag">🇬🇧</span>
      <span class="lang-name">English</span>
    </button>
    <button class="lang-option" data-lang="es">
      <span class="lang-flag">🇪🇸</span>
      <span class="lang-name">Español</span>
    </button>
  `);
  document.body.appendChild(langDropdown);

  // Bind events
  bindLanguageSelectorEvents();
  safeLog('Language selector initialized');
}

/**
 * Bind language selector events
 */
function bindLanguageSelectorEvents() {
  const langBtn = document.getElementById('lang-btn');
  const langDropdown = document.getElementById('lang-dropdown');
  const langOptions = document.querySelectorAll('.lang-option');

  if (!langBtn || !langDropdown) return;

  // Create AbortController for cleanup
  langSelectorAbortController = new AbortController();
  const { signal } = langSelectorAbortController;

  // Position dropdown relative to button
  function positionDropdown() {
    const btnRect = langBtn.getBoundingClientRect();
    langDropdown.style.setProperty('position', 'fixed');
    langDropdown.style.setProperty('top', `${btnRect.bottom + 8}px`);
    langDropdown.style.setProperty('right', `${window.innerWidth - btnRect.right}px`);
  }

  // Toggle dropdown
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = langDropdown.classList.contains('hidden');

    if (isHidden) {
      positionDropdown();
      langDropdown.classList.remove('hidden');
      // Focus first option for keyboard navigation
      langOptions[0]?.focus();
    } else {
      langDropdown.classList.add('hidden');
    }
  }, { signal });

  // Keyboard navigation for dropdown trigger
  langBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      positionDropdown();
      langDropdown.classList.remove('hidden');
      langOptions[0]?.focus();
    }
  }, { signal });

  // Keyboard navigation within dropdown options
  const optionsArray = Array.from(langOptions);
  langOptions.forEach((option, idx) => {
    option.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          optionsArray[Math.min(idx + 1, optionsArray.length - 1)]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (idx === 0) {
            langBtn.focus();
            langDropdown.classList.add('hidden');
          } else {
            optionsArray[idx - 1]?.focus();
          }
          break;
        case 'Escape':
          e.preventDefault();
          langDropdown.classList.add('hidden');
          langBtn.focus();
          break;
        case 'Tab':
          // Close on tab out
          langDropdown.classList.add('hidden');
          break;
      }
    }, { signal });
  }, { signal });

  // Reposition on scroll/resize (throttled for performance)
  const throttledPositionOnScroll = throttle(() => {
    if (!langDropdown.classList.contains('hidden')) {
      positionDropdown();
    }
  }, ANIMATION_DURATION.DEBOUNCE_SCROLL);

  const throttledPositionOnResize = throttle(() => {
    if (!langDropdown.classList.contains('hidden')) {
      positionDropdown();
    }
  }, ANIMATION_DURATION.DEBOUNCE_RESIZE);

  window.addEventListener('scroll', throttledPositionOnScroll, { passive: true, signal });
  window.addEventListener('resize', throttledPositionOnResize, { passive: true, signal });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    langDropdown.classList.add('hidden');
  }, { signal });

  // Handle language selection
  langOptions.forEach(option => {
    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const lang = option.dataset.lang;

      try {
        await i18n.setLocale(lang);

        // Update UI
        document.getElementById('lang-flag').textContent = i18n.getLocaleFlag(lang);
        document.getElementById('lang-code').textContent = lang.toUpperCase();

        langDropdown.classList.add('hidden');

        // Update interface with new translations
        updateInterfaceLanguage();

        showToast(i18n.t('toast.languageChanged', { lang: i18n.getLocaleDisplayName(lang) }), 'success');

        safeLog(`Language changed to: ${lang}`);
      } catch (error) {
        showToast(i18n.t('toast.languageChangeFailed'), 'error');
        safeLog(`Error changing language: ${error.message}`);
      }
    }, { signal });
  });
}

/**
 * Update interface language with current translations
 */
function updateInterfaceLanguage() {
  try {
    // Use translatePage() for all data-i18n elements (declarative approach)
    const translatedCount = i18n.translatePage();
    safeLog(`Translated ${translatedCount} elements via data-i18n`);

    // Legacy updates for dynamically created content and special cases
    // Update preset buttons if they exist (dynamically created)
    const btnSavePreset = document.getElementById('btn-save-preset');
    if (btnSavePreset) {
      btnSavePreset.textContent = '💾 ' + i18n.t('presets.save');
    }

    const btnManagePresets = document.getElementById('btn-manage-presets');
    if (btnManagePresets) {
      btnManagePresets.textContent = '🗂️ ' + i18n.t('presets.manage');
    }

    // Update history button if it exists (dynamically created)
    const btnHistory = document.getElementById('btn-history');
    if (btnHistory) {
      btnHistory.textContent = '📜 ' + i18n.t('history.title');
    }

    // Update vault UI if it exists
    if (window.genPwdApp?.vaultUI?.refreshLanguage) {
      window.genPwdApp.vaultUI.refreshLanguage();
    }

    safeLog('Interface language updated');
  } catch (error) {
    safeLog(`Error updating interface language: ${error.message}`);
  }
}

/**
 * Update section headers (reserved for dynamic i18n)
 */
function _updateSectionHeaders() {
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    const header = section.querySelector('.section-header strong');
    if (!header) return;

    const text = header.textContent.trim();

    // Match by text content or position
    if (text.includes('Mode') || text.includes('génération') || text.includes('Generation')) {
      header.textContent = i18n.t('sections.generationMode');
    } else if (text.includes('Paramètres') || text.includes('communs') || text.includes('Settings')) {
      header.textContent = i18n.t('sections.commonSettings');
    } else if (text.includes('Aide') || text.includes('Notes') || text.includes('Help')) {
      header.textContent = i18n.t('sections.helpNotes');
    } else if (text.includes('Presets') || text.includes('💾')) {
      header.textContent = '💾 ' + i18n.t('presets.title');
    }
  });
}

/**
 * Update labels (reserved for dynamic i18n)
 */
function _updateLabels() {
  // Mode select label
  const modeLabel = document.querySelector('label[for="mode-select"]');
  if (modeLabel) {
    modeLabel.textContent = i18n.t('modes.title');
  }

  // Length label
  const lengthLabel = document.querySelector('label[for="syll-len"]');
  if (lengthLabel) {
    lengthLabel.textContent = i18n.t('settings.lengthRange');
  }

  // Policy label
  const policyLabel = document.querySelector('label[for="policy-select"]');
  if (policyLabel) {
    policyLabel.textContent = i18n.t('settings.policy');
  }

  // Passphrase word count
  const ppCountLabel = document.querySelector('label[for="pp-count"]');
  if (ppCountLabel) {
    ppCountLabel.textContent = i18n.t('passphrase.wordCount');
  }

  // Passphrase separator
  const ppSepLabel = document.querySelector('label[for="pp-sep"]');
  if (ppSepLabel) {
    ppSepLabel.textContent = i18n.t('passphrase.separator');
  }

  // Dictionary
  const dictLabel = document.querySelector('label[for="dict-select"]');
  if (dictLabel) {
    dictLabel.textContent = i18n.t('passphrase.dictionary');
  }

  // Leet input
  const leetLabel = document.querySelector('label[for="leet-input"]');
  if (leetLabel) {
    leetLabel.textContent = i18n.t('leet.wordToTransform');
  }

  // Quantity
  const qtyLabel = document.querySelector('label[for="qty"]');
  if (qtyLabel) {
    qtyLabel.textContent = i18n.t('settings.quantityRange');
  }

  // Mask display
  const maskLabels = document.querySelectorAll('label');
  maskLabels.forEach(label => {
    if (label.textContent.includes('Masquer') || label.textContent.includes('Hide')) {
      label.textContent = i18n.t('settings.maskDisplay');
    }
  });

  // Blur passwords checkbox
  const blurCheckbox = document.querySelector('label[for="mask-toggle"]');
  if (blurCheckbox) {
    blurCheckbox.innerHTML = sanitizeHTML(`<input type="checkbox" id="mask-toggle" checked> ${escapeHtml(i18n.t('settings.blurPasswords'))}`);
  }

  // Digits
  const digitsLabel = document.querySelector('label[for="digits-count"]');
  if (digitsLabel) {
    digitsLabel.textContent = i18n.t('settings.digitsRange');
  }

  // Specials
  const specialsLabel = document.querySelector('label[for="specials-count"]');
  if (specialsLabel) {
    specialsLabel.textContent = i18n.t('settings.specialsRange');
  }

  // Custom specials
  const customSpecialsLabel = document.querySelector('label[for="custom-specials"]');
  if (customSpecialsLabel) {
    customSpecialsLabel.textContent = i18n.t('settings.customSpecials');
  }

  // Placement labels
  const placeDigitsLabels = document.querySelectorAll('label');
  placeDigitsLabels.forEach(label => {
    if (label.textContent.includes('Placement chiffres') || label.textContent.includes('Digits placement')) {
      label.textContent = i18n.t('settings.placementDigits');
    } else if (label.textContent.includes('Placement spéciaux') || label.textContent.includes('Specials placement')) {
      label.textContent = i18n.t('settings.placementSpecials');
    } else if (label.textContent.includes('🎯 Placement visuel') || label.textContent.includes('🎯 Visual')) {
      label.textContent = '🎯 ' + i18n.t('sections.visualPlacement');
    }
  });

  // Preset load label
  const presetSelectLabel = document.querySelector('label[for="preset-select"]');
  if (presetSelectLabel) {
    presetSelectLabel.textContent = i18n.t('presets.load');
  }
}

/**
 * Update select options (reserved for dynamic i18n)
 */
function _updateSelectOptions() {
  // Mode select options
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    const options = modeSelect.querySelectorAll('option');
    if (options[0]) options[0].textContent = i18n.t('modes.syllables');
    if (options[1]) options[1].textContent = i18n.t('modes.passphrase');
    if (options[2]) options[2].textContent = i18n.t('modes.leet');
  }

  // Policy select options
  const policySelect = document.getElementById('policy-select');
  if (policySelect) {
    const options = policySelect.querySelectorAll('option');
    if (options[0]) options[0].textContent = i18n.t('policy.standard');
    if (options[1]) options[1].textContent = i18n.t('policy.standardLayout');
    if (options[2]) options[2].textContent = i18n.t('policy.alphanumeric');
    if (options[3]) options[3].textContent = i18n.t('policy.alphanumericLayout');
  }

  // Placement selects (digits and specials)
  updatePlacementSelectOptions('place-digits');
  updatePlacementSelectOptions('place-specials');

  // Preset select placeholder
  const presetSelect = document.getElementById('preset-select');
  if (presetSelect && presetSelect.options[0]) {
    presetSelect.options[0].textContent = i18n.t('presets.select');
  }
}

/**
 * Update placement select options
 * @param {string} selectId - The select element ID
 */
function updatePlacementSelectOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const options = select.querySelectorAll('option');
  options.forEach(option => {
    const value = option.value;
    switch (value) {
      case 'debut':
        option.textContent = i18n.t('placement.start');
        break;
      case 'fin':
        option.textContent = i18n.t('placement.end');
        break;
      case 'milieu':
        option.textContent = i18n.t('placement.middle');
        break;
      case 'aleatoire':
        option.textContent = i18n.t('placement.random');
        break;
      case 'positions':
        option.textContent = '🎯 ' + i18n.t('placement.visual');
        break;
    }
  });
}

/**
 * Initialize presets UI
 */
export function initializePresetsUI() {
  const configPanel = document.querySelector('#config-panel .panel-body');
  if (!configPanel) return;

  // Add presets section
  const presetsSection = document.createElement('section');
  presetsSection.className = 'section';
  presetsSection.innerHTML = sanitizeHTML(`
    <div class="section-header chevron" role="button" tabindex="0" aria-expanded="true">
      <span class="chev">▼</span>
      <strong>💾 ${i18n.t('presets.title')}</strong>
      <span class="badge">${presetManager.getAllPresets().length}</span>
    </div>
    <div class="section-content">
      <div class="row gap-8 items-center">
        <select id="preset-select" class="grow flex-1">
          <option value="">${i18n.t('presets.select')}</option>
        </select>
        <button class="btn-icon d-none" id="btn-clear-preset" title="${i18n.t('presets.clearSelection')}" aria-label="${i18n.t('presets.clearSelection')}">✕</button>
      </div>
      <div class="row gap-8">
        <button class="btn flex-1" id="btn-save-preset">
          💾 ${i18n.t('presets.save')}
        </button>
        <button class="btn px-12" id="btn-new-preset" title="${i18n.t('presets.createNew')}" aria-label="${i18n.t('presets.createNew')}">➕</button>
      </div>
      <div class="row">
        <button class="btn full-width" id="btn-manage-presets">
          🗂️ ${i18n.t('presets.manage')}
        </button>
      </div>
      <button class="btn-icon d-none" id="btn-quick-save-preset" aria-label="${i18n.t('presets.quickSave')}"><span aria-hidden="true">💾</span></button>
      <button class="btn-icon d-none" id="btn-refresh-presets" aria-label="${i18n.t('presets.refreshFromVault')}"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></button>
    </div>
  `);

  // Insert before "Aide & Notes" section
  const helpSection = Array.from(configPanel.querySelectorAll('.section')).find(
    section => section.textContent.includes('Aide & Notes') || section.textContent.includes('Help')
  );

  if (helpSection) {
    configPanel.insertBefore(presetsSection, helpSection);
  } else {
    // Fallback: insert at the end if help section not found
    configPanel.appendChild(presetsSection);
  }

  // Populate preset dropdown
  updatePresetDropdown();

  // Bind events
  bindPresetEvents();

  // Set up callback for automatic UI updates on vault unlock/lock
  presetManager.setUpdateUICallback(() => {
    updatePresetDropdown();
    updatePresetBadge();
  });

  safeLog('Presets UI initialized');
}

/**
 * Update preset dropdown
 */
function updatePresetDropdown() {
  const presetSelect = document.getElementById('preset-select');
  if (!presetSelect) return;

  const presets = presetManager.getAllPresets();
  presetSelect.innerHTML = sanitizeHTML(`<option value="">${i18n.t('presets.select')}</option>`);

  presets.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.name}${preset.isDefault ? ' ⭐' : ''}`;
    presetSelect.appendChild(option);
  });
}

/**
 * Update preset count badge in section header
 */
function updatePresetBadge() {
  const badge = document.querySelector('.section-header .badge');
  if (badge) {
    badge.textContent = presetManager.getAllPresets().length;
  }
}

// Track the currently loaded preset
let currentLoadedPresetId = null;

/**
 * Update save button text based on loaded preset
 */
function updateSaveButtonState() {
  const btnSavePreset = document.getElementById('btn-save-preset');
  if (!btnSavePreset) return;

  if (currentLoadedPresetId) {
    const preset = presetManager.getPreset(currentLoadedPresetId);
    if (preset) {
      btnSavePreset.innerHTML = `🔄 ${i18n.t('presets.update')} "${preset.name}"`;
      btnSavePreset.title = i18n.t('presets.updateTooltip', { name: preset.name });
      return;
    }
  }
  btnSavePreset.innerHTML = `💾 ${i18n.t('presets.save')}`;
  btnSavePreset.title = i18n.t('presets.saveTooltip');
}

/**
 * Bind preset events
 */
function bindPresetEvents() {
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnManagePresets = document.getElementById('btn-manage-presets');
  const presetSelect = document.getElementById('preset-select');
  const btnQuickSave = document.getElementById('btn-quick-save-preset');
  const btnRefreshPresets = document.getElementById('btn-refresh-presets');

  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', async () => {
      // If a preset is loaded, update it directly
      if (currentLoadedPresetId) {
        const preset = presetManager.getPreset(currentLoadedPresetId);
        if (preset) {
          const currentConfig = getCurrentGeneratorConfig();
          const success = await presetManager.updatePreset(currentLoadedPresetId, { config: currentConfig });
          if (success) {
            showToast(`"${preset.name}" ${i18n.t('presets.updated')}!`, 'success');
          } else {
            showToast(i18n.t('presets.updateFailed'), 'error');
          }
          return;
        }
      }
      // Otherwise show save dialog for new preset
      showSavePresetDialog();
    });
  }

  if (btnManagePresets) {
    btnManagePresets.addEventListener('click', showManagePresetsModal);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', (event) => {
      loadPreset(event);
      // Track the loaded preset
      currentLoadedPresetId = event.target.value || null;
      updateSaveButtonState();
      // Show/hide clear button (CSP-compliant class toggle)
      const btnClear = document.getElementById('btn-clear-preset');
      if (btnClear) {
        btnClear.classList.toggle('d-none', !currentLoadedPresetId);
        btnClear.classList.toggle('d-inline-flex', !!currentLoadedPresetId);
      }
    });
  }

  // New preset button - always creates a new preset
  const btnNewPreset = document.getElementById('btn-new-preset');
  if (btnNewPreset) {
    btnNewPreset.addEventListener('click', showSavePresetDialog);
  }

  // Clear preset button - deselect current preset
  const btnClearPreset = document.getElementById('btn-clear-preset');
  if (btnClearPreset) {
    btnClearPreset.addEventListener('click', () => {
      if (presetSelect) {
        presetSelect.value = '';
      }
      currentLoadedPresetId = null;
      updateSaveButtonState();
      btnClearPreset.classList.add('d-none');
      btnClearPreset.classList.remove('d-inline-flex');
    });
  }

  // Quick save button - kept for compatibility but hidden
  if (btnQuickSave) {
    btnQuickSave.classList.add('d-none');
  }

  // Refresh presets button - load from vault (Electron only)
  if (btnRefreshPresets && window.vault) {
    btnRefreshPresets.classList.remove('d-none');
    btnRefreshPresets.classList.add('d-inline-flex');

    btnRefreshPresets.addEventListener('click', async () => {
      btnRefreshPresets.disabled = true;
      btnRefreshPresets.setAttribute('aria-busy', 'true');
      btnRefreshPresets.innerHTML = '<span class="spinner-sm" aria-hidden="true"></span>';

      try {
        const isReady = await presetManager.isVaultReady();
        if (!isReady) {
          showToast(i18n.t('toast.vaultLockedUnlockFirst'), 'warning');
          return;
        }

        const loaded = await presetManager.loadCustomPresetsFromVault();
        updatePresetDropdown();
        updatePresetBadge();

        if (loaded > 0) {
          showToast(i18n.t('toast.presetsLoaded', { count: loaded }), 'success');
        } else {
          showToast(i18n.t('toast.noPresetsFound'), 'info');
        }
        safeLog(`[RefreshPresets] Loaded ${loaded} presets from vault`);
      } catch (error) {
        showToast(i18n.t('toast.presetsLoadError'), 'error');
        safeLog(`[RefreshPresets] Error: ${error.message}`);
      } finally {
        btnRefreshPresets.disabled = false;
        btnRefreshPresets.removeAttribute('aria-busy');
        btnRefreshPresets.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
      }
    });
  }
}

/**
 * Get current generator configuration from DOM elements
 * @returns {Object} Current configuration
 */
function getCurrentGeneratorConfig() {
  const caseMode = document.getElementById('case-mode-select')?.value || 'mixte';
  const blocks = getBlocks();

  safeLog(`[getCurrentGeneratorConfig] caseMode=${caseMode}, blocks=${JSON.stringify(blocks)}`);

  return {
    mode: document.getElementById('mode-select')?.value || 'syllables',
    length: parseInt(document.getElementById('syll-len')?.value, 10) || 20,
    policy: document.getElementById('policy-select')?.value || 'standard',
    digits: parseInt(document.getElementById('digits-count')?.value, 10) || 2,
    specials: parseInt(document.getElementById('specials-count')?.value, 10) || 2,
    customSpecials: document.getElementById('custom-specials')?.value || '_+-=.@#%',
    placeDigits: document.getElementById('place-digits')?.value || 'aleatoire',
    placeSpecials: document.getElementById('place-specials')?.value || 'aleatoire',
    caseMode: caseMode,
    // Always save blocks (they exist even when not in blocks mode)
    blocks: blocks,
    quantity: parseInt(document.getElementById('qty')?.value, 10) || 5
  };
}

/**
 * Show save preset dialog (modal version)
 */
function showSavePresetDialog() {
  // Gather current configuration
  const config = getCurrentGeneratorConfig();

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'save-preset-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${i18n.t('presets.dialog.saveTitle')}</div>
        <button class="modal-close" id="close-save-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="preset-name">${i18n.t('presets.dialog.nameLabel')} <span class="text-red">*</span></label>
          <input type="text" id="preset-name" class="input-field" placeholder="${i18n.t('presets.dialog.namePlaceholder')}" required maxlength="50">
          <span class="error-msg" id="name-error"></span>
        </div>

        <div class="form-group">
          <label for="preset-description">${i18n.t('presets.dialog.descriptionLabel')}</label>
          <textarea id="preset-description" class="input-field" rows="2" placeholder="${i18n.t('presets.dialog.descriptionPlaceholder')}"></textarea>
        </div>

        <div class="config-preview">
          <strong>${i18n.t('presets.dialog.configToSave')}</strong>
          <ul class="my-8 pl-20 text-base">
            <li>${i18n.t('presets.config.mode')}: ${config.mode || i18n.t('presets.config.undefined')}</li>
            <li>${i18n.t('presets.config.length')}: ${config.length || i18n.t('presets.config.notAvailable')} ${i18n.t('presets.config.characters')}</li>
            <li>${i18n.t('presets.config.policy')}: ${config.policy || i18n.t('presets.config.standard')}</li>
            <li>${i18n.t('presets.config.digits')}: ${config.digits || 0}</li>
            <li>${i18n.t('presets.config.specialCharacters')}: ${config.specials || 0}</li>
            ${config.customSpecials ? `<li>${i18n.t('presets.config.customSpecials')}: ${config.customSpecials}</li>` : ''}
            <li>${i18n.t('presets.config.digitsPlacement')}: ${config.placeDigits || i18n.t('presets.config.random')}</li>
            <li>${i18n.t('presets.config.specialsPlacement')}: ${config.placeSpecials || i18n.t('presets.config.random')}</li>
            <li>${i18n.t('presets.config.case')}: ${config.caseMode || i18n.t('presets.config.mixed')}</li>
            <li>${i18n.t('presets.config.quantity')}: ${config.quantity || 1}</li>
          </ul>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-save-preset-confirm">💾 ${i18n.t('common.save')}</button>
        <button class="btn" id="btn-cancel-save">${i18n.t('common.cancel')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => {
    modal.classList.add('show');
    document.getElementById('preset-name')?.focus();
  }, 10);

  // Validation
  const nameInput = document.getElementById('preset-name');
  const nameError = document.getElementById('name-error');
  const validateName = () => validatePresetName(nameInput, nameError);

  nameInput.addEventListener('input', validateName);

  // Save button
  document.getElementById('btn-save-preset-confirm')?.addEventListener('click', async () => {
    if (!validateName()) return;

    const name = nameInput.value.trim();
    const description = document.getElementById('preset-description')?.value.trim() || '';

    try {
      const preset = await presetManager.createPreset(name, config, description);
      if (preset) {
        updatePresetDropdown();
        modal.remove();
        showToast(i18n.t('toast.presetSaved', { name }), 'success');
        safeLog(`Preset created: ${preset.id}`);
      } else {
        showToast(i18n.t('toast.vaultLockedToSave'), 'error');
      }
    } catch (error) {
      showToast(i18n.t('toast.presetSaveFailed'), 'error');
      safeLog(`Error saving preset: ${error.message}`);
    }
  });

  // Cancel button
  document.getElementById('btn-cancel-save')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close button
  document.getElementById('close-save-modal')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Handle Enter key
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-save-preset-confirm')?.click();
    }
  });
}

/**
 * Update blocks chips UI after setting blocks
 */
function updateBlocksChipsUI() {
  const blocks = getBlocks();
  renderChips('#chips', blocks, (index) => {
    const currentBlocks = getBlocks();
    const current = currentBlocks[index];
    currentBlocks[index] = current === 'U' ? 'l' : current === 'l' ? 'T' : 'U';
    setBlocks(currentBlocks);
    updateBlocksChipsUI();
  });
  updateBlockSizeLabel('#block-size-label', blocks.length);
}

/**
 * Load preset
 */
function loadPreset(event) {
  const presetId = event.target.value;
  if (!presetId) return;

  const preset = presetManager.getPreset(presetId);
  if (!preset) {
    showToast(i18n.t('toast.presetNotFound'), 'error');
    return;
  }

  // Apply configuration
  const { config } = preset;

  if (config.mode) {
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
      modeSelect.value = config.mode;
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (config.length) {
    const syllLen = document.getElementById('syll-len');
    if (syllLen) {
      syllLen.value = config.length;
      syllLen.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.policy) {
    const policySelect = document.getElementById('policy-select');
    if (policySelect) policySelect.value = config.policy;
  }

  if (config.digits !== undefined) {
    const digitsCount = document.getElementById('digits-count');
    if (digitsCount) {
      digitsCount.value = config.digits;
      digitsCount.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.specials !== undefined) {
    const specialsCount = document.getElementById('specials-count');
    if (specialsCount) {
      specialsCount.value = config.specials;
      specialsCount.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.customSpecials) {
    const customSpecials = document.getElementById('custom-specials');
    if (customSpecials) customSpecials.value = config.customSpecials;
  }

  if (config.placeDigits) {
    const placeDigits = document.getElementById('place-digits');
    if (placeDigits) placeDigits.value = config.placeDigits;
  }

  if (config.placeSpecials) {
    const placeSpecials = document.getElementById('place-specials');
    if (placeSpecials) placeSpecials.value = config.placeSpecials;
  }

  if (config.caseMode) {
    const caseModeSelect = document.getElementById('case-mode-select');
    if (caseModeSelect) {
      caseModeSelect.value = config.caseMode;
      caseModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Restore blocks if in blocks mode
  // IMPORTANT: Must set blocks AFTER dispatchEvent and mark as dirty to prevent
  // async scheduleBlockSync from overwriting them
  if (config.caseMode === 'blocks' && config.blocks && Array.isArray(config.blocks)) {
    setBlocks(config.blocks);
    setUIState('blockDirty', true); // Prevent auto-sync from overwriting
    // Update chips UI
    updateBlocksChipsUI();
    safeLog(`[loadPreset] Restored blocks: ${config.blocks.join('-')}`);
  }

  if (config.quantity) {
    const qty = document.getElementById('qty');
    if (qty) {
      qty.value = config.quantity;
      qty.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  showToast(i18n.t('presets.loaded', { name: preset.name }), 'success');
  safeLog(`Preset loaded: ${preset.id}`);
}

/**
 * Show manage presets modal
 */
function showManagePresetsModal() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'presets-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'presets-modal-title');

  const presets = presetManager.getAllPresets();

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="presets-modal-title">
          ${i18n.t('presets.dialog.manageTitle')}
        </div>
        <button class="modal-close" id="close-presets-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="search-container mb-16">
          <input
            type="text"
            id="preset-search"
            class="search-input"
            placeholder="${i18n.t('presets.dialog.searchPlaceholder')}"
          >
        </div>
        <div class="presets-list">
          ${presets.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">💾</div>
              <p>${i18n.t('presets.emptyState')}</p>
              <p class="text-sm opacity-70 mt-8">
                ${i18n.t('presets.emptyHint')}
              </p>
            </div>
          ` : presets.map(preset => `
            <div class="preset-manager-item" data-preset-id="${preset.id}">
              <div class="preset-manager-info">
                <div class="preset-manager-name">
                  ${escapeHtml(preset.name)} ${preset.isDefault ? '<span class="text-yellow">⭐</span>' : ''}
                </div>
                <div class="preset-manager-summary">
                  ${preset.config.mode || 'standard'} • ${preset.config.length || 20} ${i18n.t('presets.config.chars')} • ${preset.config.digits || 0} ${i18n.t('presets.config.digits').toLowerCase()} • ${preset.config.specials || 0} ${i18n.t('presets.config.specials').toLowerCase()}
                </div>
              </div>
              <div class="preset-manager-actions">
                <button class="btn-mini" data-action="load" data-preset-id="${preset.id}" title="${i18n.t('presets.dialog.loadPreset')}" aria-label="${i18n.t('presets.dialog.loadPreset')}"><span aria-hidden="true">▶️</span></button>
                <button class="btn-mini" data-action="edit" data-preset-id="${preset.id}" title="${i18n.t('presets.dialog.edit')}" aria-label="${i18n.t('presets.dialog.edit')}"><span aria-hidden="true">✏️</span></button>
                <button class="btn-mini" data-action="duplicate" data-preset-id="${preset.id}" title="${i18n.t('presets.dialog.duplicate')}" aria-label="${i18n.t('presets.dialog.duplicate')}"><span aria-hidden="true">📋</span></button>
                ${!preset.isDefault ? `<button class="btn-mini danger" data-action="delete" data-preset-id="${preset.id}" title="${i18n.t('common.delete')}" aria-label="${i18n.t('common.delete')}"><span aria-hidden="true">🗑️</span></button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer flex-wrap gap-8">
        <button class="btn" id="btn-import-preset">${i18n.t('presets.dialog.import')}</button>
        <button class="btn" id="btn-export-all-presets">${i18n.t('presets.dialog.exportAll')}</button>
        <button class="btn ${window.vault ? '' : 'd-none'}" id="btn-vault-sync-presets">🗄️ Vault</button>
        <button class="btn danger" id="close-presets-modal-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Bind events
  bindPresetModalEvents(modal);

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Bind preset modal events
 */
function bindPresetModalEvents(modal) {
  // Close buttons
  modal.querySelector('#close-presets-modal')?.addEventListener('click', () => {
    modal.remove();
  });
  modal.querySelector('#close-presets-modal-footer')?.addEventListener('click', () => {
    modal.remove();
  });

  // Search functionality
  const searchInput = modal.querySelector('#preset-search');
  const presetItems = modal.querySelectorAll('.preset-item');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();

      presetItems.forEach(item => {
        const presetId = item.dataset.presetId;
        const preset = presetManager.getPreset(presetId);

        if (preset) {
          const matchesSearch =
            preset.name.toLowerCase().includes(searchTerm) ||
            (preset.description && preset.description.toLowerCase().includes(searchTerm));

          // CSP-compliant: use class toggle instead of inline style
          item.classList.toggle('d-none', !matchesSearch);
        }
      });
    });
  }

  // Action buttons
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (_e) => {
      const action = btn.dataset.action;
      const presetId = btn.dataset.presetId;

      switch (action) {
        case 'load':
          const preset = presetManager.getPreset(presetId);
          if (preset) {
            // Trigger preset select change
            const presetSelect = document.getElementById('preset-select');
            if (presetSelect) {
              presetSelect.value = presetId;
              presetSelect.dispatchEvent(new Event('change'));
            }
            modal.remove();
          }
          break;

        case 'toggle-details':
          const detailsSection = document.getElementById(`details-${presetId}`);
          const toggleIcon = btn.querySelector('.details-toggle-icon');
          if (detailsSection) {
            // CSP-compliant: use class toggle instead of inline style
            const isVisible = !detailsSection.classList.contains('d-none');
            detailsSection.classList.toggle('d-none', isVisible);
            if (toggleIcon) {
              toggleIcon.textContent = isVisible ? '▼' : '▲';
            }
          }
          break;

        case 'edit':
          modal.remove();
          showEditPresetModal(presetId);
          break;

        case 'duplicate':
          const presetToDuplicate = presetManager.getPreset(presetId);
          if (presetToDuplicate) {
            const duplicatedPreset = await presetManager.duplicatePreset(presetId);
            if (duplicatedPreset) {
              updatePresetDropdown();
              modal.remove();
              showManagePresetsModal();
              showToast(i18n.t('toast.presetDuplicated', { name: duplicatedPreset.name }), 'success');
            } else {
              showToast(i18n.t('toast.vaultLockedToDuplicate'), 'error');
            }
          }
          break;

        case 'export':
          const json = presetManager.exportPreset(presetId);
          if (json) {
            downloadFile(json, `preset-${presetId}.json`, 'application/json');
            showToast(i18n.t('toast.presetExported'), 'success');
          }
          break;

        case 'update-config':
          const presetToUpdate = presetManager.getPreset(presetId);
          if (presetToUpdate) {
            const confirmed = await showConfirm(i18n.t('presets.replaceConfirm', { name: presetToUpdate.name }), {
              title: i18n.t('presets.updateTitle'),
              confirmLabel: i18n.t('common.update'),
              danger: false
            });
            if (confirmed) {
              const currentConfig = getCurrentGeneratorConfig();
              const success = await presetManager.updatePreset(presetId, { config: currentConfig });
              if (success) {
                updatePresetDropdown();
                modal.remove();
                showManagePresetsModal(); // Refresh the modal
                showToast(i18n.t('toast.configurationUpdated'), 'success');
              } else {
                showToast(i18n.t('toast.vaultLockedToUpdate'), 'error');
              }
            }
          }
          break;

        case 'delete':
          const deleteConfirmed = await showConfirm(i18n.t('presets.deleteConfirm'), {
            title: i18n.t('presets.deleteTitle'),
            confirmLabel: i18n.t('common.delete'),
            danger: true
          });
          if (deleteConfirmed) {
            const success = await presetManager.deletePreset(presetId);
            if (success) {
              updatePresetDropdown();
              modal.remove();
              showToast(i18n.t('toast.presetDeleted'), 'success');
            } else {
              showToast(i18n.t('toast.deletionFailed'), 'error');
            }
          }
          break;
      }
    });
  });

  // Import button
  modal.querySelector('#btn-import-preset')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const preset = await presetManager.importPreset(event.target.result);
          if (preset) {
            updatePresetDropdown();
            modal.remove();
            showToast(i18n.t('toast.presetImported', { name: preset.name }), 'success');
          } else {
            showToast(i18n.t('toast.vaultLockedToImport'), 'error');
          }
        } catch (error) {
          showToast(i18n.t('toast.presetImportFailed'), 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // Export all button
  modal.querySelector('#btn-export-all-presets')?.addEventListener('click', () => {
    const json = presetManager.exportAll();
    downloadFile(json, 'genpwd-presets-all.json', 'application/json');
    showToast(i18n.t('toast.allPresetsExported'), 'success');
  });

  // Vault sync button
  modal.querySelector('#btn-vault-sync-presets')?.addEventListener('click', () => {
    modal.remove();
    showVaultPresetSyncModal();
  });
}

/**
 * Format case mode label for display
 */
function formatCaseModeLabel(caseMode, blocks) {
  const labels = {
    'mixte': i18n.t('case.mixed'),
    'upper': i18n.t('case.upper'),
    'lower': i18n.t('case.lower'),
    'title': i18n.t('case.title'),
    'blocks': blocks ? `${i18n.t('case.blocks')} (${blocks.join('-')})` : i18n.t('case.blocks')
  };
  return labels[caseMode] || caseMode || i18n.t('case.mixed');
}

/**
 * Format placement label for display
 */
function formatPlacementLabel(placement) {
  const labels = {
    'aleatoire': i18n.t('placement.random'),
    'debut': i18n.t('placement.start'),
    'fin': i18n.t('placement.end'),
    'milieu': i18n.t('placement.middle')
  };
  return labels[placement] || placement || i18n.t('placement.random');
}

/**
 * Show edit preset modal
 */
function showEditPresetModal(presetId) {
  const preset = presetManager.getPreset(presetId);
  if (!preset) {
    showToast(i18n.t('toast.presetNotFound'), 'error');
    return;
  }

  const config = preset.config;

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'edit-preset-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal modal-md">
      <div class="modal-header">
        <div class="modal-title">${i18n.t('presets.dialog.editTitle', { name: escapeHtml(preset.name) })}</div>
        <button class="modal-close" id="close-edit-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <!-- Info section -->
        <div class="form-group">
          <label for="edit-preset-name">${i18n.t('presets.dialog.nameLabel')} <span class="text-red">*</span></label>
          <input type="text" id="edit-preset-name" class="input-field" value="${escapeHtml(preset.name)}" required maxlength="50">
          <span class="error-msg" id="edit-name-error"></span>
        </div>

        <div class="form-group mt-12">
          <label for="edit-preset-description">${i18n.t('presets.dialog.descriptionLabel')}</label>
          <textarea id="edit-preset-description" class="input-field resize-y" rows="2" placeholder="${i18n.t('presets.dialog.descriptionPlaceholder')}">${escapeHtml(preset.description || '')}</textarea>
        </div>

        <!-- Config section -->
        <div class="config-info-box">
          <div class="d-flex justify-between items-center mb-12">
            <strong class="text-blue">${i18n.t('presets.dialog.configuration')}</strong>
            <button class="btn-mini text-xs" id="btn-update-config-inline" title="${i18n.t('presets.dialog.replaceWithCurrent')}">
              ${i18n.t('presets.dialog.updateConfig')}
            </button>
          </div>
          <div class="config-grid">
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.mode')}:</span> <span class="text-primary">${escapeHtml(config.mode || 'syllables')}</span>
            </div>
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.length')}:</span> <span class="text-primary">${config.length || 20}</span>
            </div>
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.digits')}:</span> <span class="text-primary">${config.digits || 0}</span>
            </div>
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.specials')}:</span> <span class="text-primary">${config.specials || 0}</span>
            </div>
            <div class="config-item col-span-2">
              <span class="text-slate">${i18n.t('presets.config.case')}:</span> <span class="text-primary">${formatCaseModeLabel(config.caseMode, config.blocks)}</span>
            </div>
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.digitsPlace')}:</span> <span class="text-primary">${formatPlacementLabel(config.placeDigits)}</span>
            </div>
            <div class="config-item">
              <span class="text-slate">${i18n.t('presets.config.specialsPlace')}:</span> <span class="text-primary">${formatPlacementLabel(config.placeSpecials)}</span>
            </div>
          </div>
        </div>

        ${preset.isDefault ? `
          <div class="warning-box">
            ${i18n.t('presets.dialog.defaultPreset')}
          </div>
        ` : ''}

        <div class="text-xs text-secondary mt-12 pt-12 border-top">
          ${i18n.t('presets.dialog.created')} ${new Date(preset.createdAt).toLocaleDateString()} • ${i18n.t('presets.dialog.modified')} ${new Date(preset.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn bg-blue-alpha" id="btn-edit-preset-confirm">💾 ${i18n.t('common.save')}</button>
        <button class="btn" id="btn-cancel-edit">${i18n.t('common.cancel')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => {
    modal.classList.add('show');
    document.getElementById('edit-preset-name')?.focus();
  }, 10);

  // Validation
  const nameInput = document.getElementById('edit-preset-name');
  const nameError = document.getElementById('edit-name-error');
  const validateName = () => validatePresetName(nameInput, nameError);

  nameInput.addEventListener('input', validateName);

  // Save button
  document.getElementById('btn-edit-preset-confirm')?.addEventListener('click', async () => {
    if (!validateName()) return;

    const name = nameInput.value.trim();
    const description = document.getElementById('edit-preset-description')?.value.trim() || '';

    const success = await presetManager.updatePreset(presetId, {
      name: name,
      description: description
    });

    if (success) {
      updatePresetDropdown();
      modal.remove();
      showToast(i18n.t('toast.presetUpdated', { name }), 'success');
      safeLog(`Preset updated: ${presetId}`);
    } else {
      showToast(i18n.t('toast.vaultLockedToEdit'), 'error');
    }
  });

  // Update config inline button
  document.getElementById('btn-update-config-inline')?.addEventListener('click', async () => {
    const preset = presetManager.getPreset(presetId);
    if (!preset) return;

    const confirmed = await showConfirm(i18n.t('presets.replaceConfirm', { name: preset.name }), {
      title: i18n.t('presets.updateTitle'),
      confirmLabel: i18n.t('common.update')
    });
    if (confirmed) {
      const currentConfig = getCurrentGeneratorConfig();
      const success = await presetManager.updatePreset(presetId, { config: currentConfig });
      if (success) {
        modal.remove();
        showEditPresetModal(presetId); // Refresh modal with new config
        showToast(i18n.t('toast.configurationUpdated'), 'success');
      } else {
        showToast(i18n.t('toast.vaultLockedToEdit'), 'error');
      }
    }
  });

  // Cancel button
  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close button
  document.getElementById('close-edit-modal')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Handle Enter key
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-edit-preset-confirm')?.click();
    }
  });
}

/**
 * Show vault preset sync modal
 * Allows import/export of presets to/from the vault
 */
async function showVaultPresetSyncModal() {
  // Check if vault is available
  if (!window.vault) {
    showToast(i18n.t('toast.vaultNotAvailable'), 'error');
    return;
  }

  // Check vault state
  const isVaultReady = await presetManager.isVaultReady();
  const vaultPresetCount = isVaultReady ? await presetManager.getVaultPresetCount() : 0;
  const localPresetCount = presetManager.getAllPresets().length;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'vault-preset-sync-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title">${i18n.t('presets.vaultSync.title')}</div>
        <button class="modal-close" id="close-vault-sync-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        ${!isVaultReady ? `
          <div class="vault-locked-state">
            <div class="vault-locked-icon">🔒</div>
            <p class="m-0 text-red">${i18n.t('presets.vaultSync.vaultLocked')}</p>
            <p class="mt-8 m-0 text-base text-muted">${i18n.t('presets.vaultSync.unlockToSync')}</p>
            <button class="btn mt-12" id="btn-go-to-vault">${i18n.t('presets.vaultSync.goToVault')}</button>
          </div>
        ` : `
          <div class="vault-sync-stats">
            <div class="vault-sync-stat local">
              <div class="stat-value">${localPresetCount}</div>
              <div class="text-sm text-muted">${i18n.t('presets.vaultSync.localPresets')}</div>
            </div>
            <div class="vault-sync-stat vault">
              <div class="stat-value">${vaultPresetCount}</div>
              <div class="text-sm text-muted">${i18n.t('presets.vaultSync.vaultPresets')}</div>
            </div>
          </div>

          <div class="vault-sync-actions">
            <button class="btn full-width d-flex items-center justify-center gap-8" id="btn-export-to-vault">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              ${i18n.t('presets.vaultSync.exportToVault')}
            </button>
            <button class="btn full-width d-flex items-center justify-center gap-8" id="btn-import-from-vault" ${vaultPresetCount === 0 ? 'disabled' : ''}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              ${i18n.t('presets.vaultSync.importFromVault')}
            </button>
          </div>

          <div class="vault-sync-checkbox-row">
            <label class="vault-sync-checkbox-label">
              <input type="checkbox" id="vault-sync-overwrite" class="vault-sync-checkbox">
              ${i18n.t('presets.vaultSync.overwriteOption')}
            </label>
          </div>

          ${vaultPresetCount > 0 ? `
          <div class="vault-presets-section">
            <h4 class="vault-presets-title">${i18n.t('presets.vaultSync.presetsInVault')}</h4>
            <div id="vault-presets-list" class="vault-presets-list">
              <div class="text-center p-20 text-muted">${i18n.t('common.loading')}</div>
            </div>
          </div>
          ` : ''}
        `}
      </div>
      <div class="modal-footer">
        <button class="btn" id="close-vault-sync-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Bind events
  modal.querySelector('#close-vault-sync-modal')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#close-vault-sync-footer')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Go to vault button
  modal.querySelector('#btn-go-to-vault')?.addEventListener('click', () => {
    modal.remove();
    const vaultTab = document.querySelector('.header-tab[data-tab="vault"]');
    if (vaultTab) vaultTab.click();
  });

  // Export to vault
  modal.querySelector('#btn-export-to-vault')?.addEventListener('click', async () => {
    const btn = modal.querySelector('#btn-export-to-vault');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${i18n.t('presets.vaultSync.exporting')}`;

    const result = await presetManager.exportAllToVault();

    if (result.success > 0) {
      showToast(i18n.t('toast.presetsExportedToVault', { count: result.success }), 'success');
    } else {
      showToast(i18n.t('toast.noPresetsExported'), 'warning');
    }

    modal.remove();
  });

  // Import from vault
  modal.querySelector('#btn-import-from-vault')?.addEventListener('click', async () => {
    const btn = modal.querySelector('#btn-import-from-vault');
    const overwrite = modal.querySelector('#vault-sync-overwrite')?.checked || false;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> ' + i18n.t('common.importing');

    const result = await presetManager.importFromVault(overwrite);

    if (result.imported > 0) {
      updatePresetDropdown();
      showToast(i18n.t('toast.presetsImportedFromVault', { count: result.imported }), 'success');
    } else if (result.skipped > 0) {
      showToast(i18n.t('toast.presetsSkipped', { count: result.skipped }), 'info');
    } else {
      showToast(i18n.t('toast.noPresetsToImport'), 'warning');
    }

    modal.remove();
  });

  // Load vault presets list if container exists
  if (vaultPresetCount > 0) {
    loadVaultPresetsList(modal);
  }

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Load and display vault presets in the sync modal
 */
async function loadVaultPresetsList(modal) {
  const container = modal.querySelector('#vault-presets-list');
  if (!container) return;

  try {
    const vaultPresets = await presetManager.getVaultPresets();

    if (vaultPresets.length === 0) {
      container.innerHTML = `<div class="text-center p-20 text-muted">${i18n.t('presets.vaultSync.noPresetsInVault')}</div>`;
      return;
    }

    container.innerHTML = vaultPresets.map(entry => `
      <div class="vault-preset-row" data-entry-id="${entry.id}">
        <div class="vault-preset-info">
          <div class="vault-preset-name">${escapeHtml(entry.title)}</div>
          <div class="vault-preset-date">
            ${entry.data?.config?.mode || i18n.t('presets.config.unknownMode')} • ${entry.data?.config?.length || '?'} ${i18n.t('presets.config.chars')}
          </div>
        </div>
        <div class="vault-preset-actions">
          <button class="btn-mini" data-action="load-vault-preset" data-entry-id="${entry.id}" title="${i18n.t('presets.vaultSync.loadPreset')}" aria-label="${i18n.t('presets.vaultSync.loadPreset')}"><span aria-hidden="true">📥</span></button>
          <button class="btn-mini danger" data-action="delete-vault-preset" data-entry-id="${entry.id}" title="${i18n.t('presets.vaultSync.deleteFromVault')}" aria-label="${i18n.t('presets.vaultSync.deleteFromVault')}"><span aria-hidden="true">🗑️</span></button>
        </div>
      </div>
    `).join('');

    // Bind actions
    container.querySelectorAll('[data-action="load-vault-preset"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entryId = btn.dataset.entryId;
        const entry = vaultPresets.find(e => e.id === entryId);
        if (entry?.data?.config) {
          // Preset is already in vault, just load it into local map if not already there
          let preset = presetManager.getPreset(entryId);
          if (!preset) {
            // Not in local map, load from vault entry
            preset = await presetManager.createPreset(
              entry.title,
              entry.data.config,
              entry.data.description || `Imported from vault`
            );
          }
          if (preset) {
            updatePresetDropdown();
            // Apply the preset
            const presetSelect = document.getElementById('preset-select');
            if (presetSelect) {
              presetSelect.value = preset.id;
              presetSelect.dispatchEvent(new Event('change'));
            }
            showToast(i18n.t('toast.presetLoaded', { name: entry.title }), 'success');
            modal.remove();
          } else {
            showToast(i18n.t('toast.presetLoadFailed'), 'error');
          }
        }
      });
    });

    container.querySelectorAll('[data-action="delete-vault-preset"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entryId = btn.dataset.entryId;
        const entry = vaultPresets.find(e => e.id === entryId);
        if (!entry) return;

        const confirmed = await showConfirm(i18n.t('vault.messages.deleteEntryConfirm', { title: entry.title }), {
          title: i18n.t('vault.actions.delete'),
          confirmLabel: i18n.t('common.delete'),
          danger: true
        });
        if (confirmed) {
          try {
            await window.vault.entries.delete(entryId);
            // Remove from UI
            btn.closest('.vault-preset-item')?.remove();
            showToast(i18n.t('toast.presetDeletedFromVault'), 'success');
            // Update count display
            const countEl = modal.querySelector('[style*="rgba(139, 92, 246"]');
            if (countEl) {
              const currentCount = parseInt(countEl.querySelector('div')?.textContent || '0', 10);
              const newCount = Math.max(0, currentCount - 1);
              countEl.querySelector('div').textContent = newCount;
            }
          } catch (error) {
            showToast(i18n.t('toast.presetDeleteError'), 'error');
          }
        }
      });
    });

  } catch (error) {
    container.innerHTML = `<div class="text-center p-20 text-red">${i18n.t('presets.vaultSync.loadingError')}</div>`;
    safeLog(`[VaultPresets] Error loading: ${error.message}`);
  }
}

/**
 * Initialize history UI
 */
export function initializeHistoryUI() {
  const resultsPanel = document.querySelector('.results .actions');
  if (!resultsPanel) return;

  // Add history button
  const btnHistory = document.createElement('button');
  btnHistory.className = 'btn';
  btnHistory.id = 'btn-history';
  btnHistory.innerHTML = sanitizeHTML('📜 ' + escapeHtml(i18n.t('history.title')));

  // Insert before spacer
  const spacer = resultsPanel.querySelector('.spacer');
  if (spacer) {
    resultsPanel.insertBefore(btnHistory, spacer);
  } else {
    resultsPanel.appendChild(btnHistory);
  }

  // Bind event
  btnHistory.addEventListener('click', showHistoryModal);

  safeLog('History UI initialized');
}

/**
 * Show history modal
 */
async function showHistoryModal() {
  const settings = historyManager.getSettings();

  if (!settings.enabled) {
    const confirmed = await showConfirm(i18n.t('history.enableConfirm'), {
      title: i18n.t('history.title'),
      confirmLabel: i18n.t('common.enable')
    });
    if (confirmed) {
      historyManager.updateSettings({ enabled: true });
      showToast(i18n.t('toast.historyEnabled'), 'success');
    }
    return;
  }

  // Get history
  const history = historyManager.getHistory({ limit: 100 });
  const stats = historyManager.getStatistics();

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'history-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">
          ${i18n.t('history.modalTitle')}
        </div>
        <button class="modal-close" id="close-history-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="history-stats">
          <div class="stat-item">
            <div class="stat-value">${stats.totalEntries}</div>
            <div class="stat-label">${i18n.t('history.stats.total')}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.favorites}</div>
            <div class="stat-label">${i18n.t('history.stats.favorites')}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.round(stats.averageEntropy)}</div>
            <div class="stat-label">${i18n.t('history.stats.avgEntropy')}</div>
          </div>
        </div>

        <div class="history-search">
          <input type="text" id="history-search-input" placeholder="${i18n.t('history.searchPlaceholder')}" class="input" />
        </div>

        <div class="history-list">
          ${history.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">📜</div>
                <p>${i18n.t('history.emptyState')}</p>
                <p class="text-sm opacity-70 mt-8">
                  ${i18n.t('history.emptyHint')}
                </p>
              </div>
            ` :
            history.map(entry => `
              <div class="history-item" data-entry-id="${entry.id}">
                <div class="history-password">
                  <code>${entry.password}</code>
                  ${entry.isFavorite ? '⭐' : ''}
                </div>
                <div class="history-meta">
                  ${i18n.t('history.meta.mode')}: ${entry.metadata.mode} | ${i18n.t('history.meta.entropy')}: ${entry.metadata.entropy?.toFixed(1)} bits |
                  ${new Date(entry.timestamp).toLocaleString()}
                </div>
                <div class="history-tags">
                  ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <div class="history-actions">
                  <button class="btn-mini" data-action="copy" data-entry-id="${entry.id}" title="${i18n.t('common.copy')}" aria-label="${i18n.t('common.copy')}"><span aria-hidden="true">📋</span></button>
                  <button class="btn-mini" data-action="favorite" data-entry-id="${entry.id}" title="${i18n.t('history.favorite')}" aria-label="${i18n.t('history.favorite')}"><span aria-hidden="true">⭐</span></button>
                  <button class="btn-mini danger" data-action="delete" data-entry-id="${entry.id}" title="${i18n.t('common.delete')}" aria-label="${i18n.t('common.delete')}"><span aria-hidden="true">🗑️</span></button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-export-history">${i18n.t('history.export')}</button>
        <button class="btn danger" id="btn-clear-history">${i18n.t('history.clearAll')}</button>
        <button class="btn" id="close-history-modal-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Bind events
  bindHistoryModalEvents(modal);

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Bind history modal events
 */
function bindHistoryModalEvents(modal) {
  // Close buttons
  modal.querySelector('#close-history-modal')?.addEventListener('click', () => {
    modal.remove();
  });
  modal.querySelector('#close-history-modal-footer')?.addEventListener('click', () => {
    modal.remove();
  });

  // Action buttons
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (_e) => {
      const action = btn.dataset.action;
      const entryId = btn.dataset.entryId;

      switch (action) {
        case 'copy': {
          const entry = historyManager.getEntry(entryId);
          if (entry) {
            try {
              await navigator.clipboard.writeText(entry.password);
              showToast(i18n.t('toast.historyCopied'), 'success');
            } catch (err) {
              showToast(i18n.t('toast.copyFailed'), 'error');
            }
          }
          break;
        }

        case 'favorite':
          historyManager.toggleFavorite(entryId);
          modal.remove();
          showHistoryModal(); // Refresh
          break;

        case 'delete': {
          const deleteConfirmed = await showConfirm(i18n.t('history.deleteEntryConfirm'), {
            title: i18n.t('history.deleteTitle'),
            confirmLabel: i18n.t('common.delete'),
            danger: true
          });
          if (deleteConfirmed) {
            historyManager.deleteEntry(entryId);
            modal.remove();
            showHistoryModal(); // Refresh
          }
          break;
        }
      }
    });
  });

  // Search
  modal.querySelector('#history-search-input')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    modal.querySelectorAll('.history-item').forEach(item => {
      const password = item.querySelector('.history-password code')?.textContent.toLowerCase();
      const meta = item.querySelector('.history-meta')?.textContent.toLowerCase();
      const visible = password?.includes(query) || meta?.includes(query);
      if (visible) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  });

  // Export button
  modal.querySelector('#btn-export-history')?.addEventListener('click', () => {
    const json = historyManager.exportHistory();
    downloadFile(json, 'genpwd-history.json', 'application/json');
    showToast(i18n.t('toast.historyExported'), 'success');
  });

  // Clear all button
  modal.querySelector('#btn-clear-history')?.addEventListener('click', async () => {
    const confirmed = await showConfirm(i18n.t('history.clearAllConfirm'), {
      title: i18n.t('history.clearTitle'),
      confirmLabel: i18n.t('common.clearAll'),
      danger: true
    });
    if (confirmed) {
      historyManager.clearHistory();
      modal.remove();
      showToast(i18n.t('toast.historyCleared'), 'success');
    }
  });
}

/**
 * Download file helper
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Initialize plugins UI
 */
export function initializePluginsUI() {
  const configPanel = document.querySelector('#config-panel .panel-body');
  if (!configPanel) return;

  // Add plugins section
  const pluginsSection = document.createElement('section');
  pluginsSection.className = 'section';
  const pluginStats = pluginManager.getStats();

  pluginsSection.innerHTML = sanitizeHTML(`
    <div class="section-header chevron" role="button" tabindex="0" aria-expanded="true">
      <span class="chev">▼</span>
      <strong>🔌 Plugins & Extensions</strong>
      <span class="badge">${pluginStats.enabledPlugins}/${pluginStats.totalPlugins}</span>
    </div>
    <div class="section-content">
      <div class="row">
        <button class="btn full-width" id="btn-manage-plugins">
          🔌 ${i18n.t('plugins.managePlugins')}
        </button>
      </div>
      <div class="row">
        <button class="btn full-width" id="btn-load-demo-plugins">
          🎨 ${i18n.t('plugins.loadDemoPlugins')}
        </button>
      </div>
      <div class="plugin-status plugin-status-box">
        <div><strong>${i18n.t('plugins.statusLabel')}</strong> ${i18n.t('plugins.pluginsInstalled', { count: pluginStats.totalPlugins })}</div>
        <div><strong>${i18n.t('plugins.hooksLabel')}</strong> ${i18n.t('plugins.activeHooksCount', { count: pluginStats.totalHooks })}</div>
      </div>
    </div>
  `);

  // Insert after Presets section
  const presetsSection = Array.from(configPanel.querySelectorAll('.section')).find(
    section => section.textContent.includes('Presets') || section.textContent.includes('💾')
  );

  if (presetsSection && presetsSection.nextSibling) {
    configPanel.insertBefore(pluginsSection, presetsSection.nextSibling);
  } else if (presetsSection) {
    presetsSection.parentNode.insertBefore(pluginsSection, presetsSection.nextSibling);
  } else {
    // Fallback: insert before help section
    const helpSection = Array.from(configPanel.querySelectorAll('.section')).find(
      section => section.textContent.includes('Aide & Notes') || section.textContent.includes('Help')
    );
    if (helpSection) {
      configPanel.insertBefore(pluginsSection, helpSection);
    } else {
      configPanel.appendChild(pluginsSection);
    }
  }

  // Bind events
  bindPluginEvents();
  safeLog('Plugins UI initialized');
}

/**
 * Bind plugin events
 */
function bindPluginEvents() {
  const btnManagePlugins = document.getElementById('btn-manage-plugins');
  const btnLoadDemoPlugins = document.getElementById('btn-load-demo-plugins');

  if (btnManagePlugins) {
    btnManagePlugins.addEventListener('click', showPluginManagerModal);
  }

  if (btnLoadDemoPlugins) {
    btnLoadDemoPlugins.addEventListener('click', loadDemoPlugins);
  }
}

/**
 * Load demo plugins
 */
async function loadDemoPlugins() {
  try {
    // Dynamically import demo plugins
    const emojiPlugin = await import('../plugins/emoji-generator-plugin.js');
    const xmlPlugin = await import('../plugins/xml-export-plugin.js');

    // Register plugins
    const emojiSuccess = pluginManager.registerPlugin(emojiPlugin.default);
    const xmlSuccess = pluginManager.registerPlugin(xmlPlugin.default);

    if (emojiSuccess && xmlSuccess) {
      showToast(i18n.t('toast.demoPluginsLoadedSuccess'), 'success');
      updatePluginStatus();
    } else if (emojiSuccess || xmlSuccess) {
      showToast(i18n.t('toast.demoPluginsPartialLoad'), 'warning');
      updatePluginStatus();
    } else {
      showToast(i18n.t('toast.demoPluginsLoadFailed'), 'error');
    }
  } catch (error) {
    safeLog(`Error loading demo plugins: ${error.message}`);
    showToast(i18n.t('toast.demoPluginsError'), 'error');
  }
}

/**
 * Update plugin status display
 */
function updatePluginStatus() {
  const statusDiv = document.querySelector('.plugin-status');
  if (statusDiv) {
    const stats = pluginManager.getStats();
    statusDiv.innerHTML = sanitizeHTML(`
      <div><strong>${i18n.t('plugins.statusLabel')}</strong> ${i18n.t('plugins.pluginsInstalled', { count: stats.totalPlugins })}</div>
      <div><strong>${i18n.t('plugins.hooksLabel')}</strong> ${i18n.t('plugins.activeHooksCount', { count: stats.totalHooks })}</div>
    `);
  }

  // Update badge
  const badge = document.querySelector('.section-header .badge');
  if (badge) {
    const stats = pluginManager.getStats();
    badge.textContent = `${stats.enabledPlugins}/${stats.totalPlugins}`;
  }
}

/**
 * Show plugin manager modal
 */
function showPluginManagerModal() {
  const plugins = pluginManager.getAllPlugins();
  const stats = pluginManager.getStats();

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'plugins-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">
          🔌 Plugin Manager
        </div>
        <button class="modal-close" id="close-plugins-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="plugin-stats plugin-stats-grid">
          <div class="plugin-stat-item total">
            <div class="stat-value">${stats.totalPlugins}</div>
            <div class="stat-label">${i18n.t('plugins.stats.totalPlugins')}</div>
          </div>
          <div class="plugin-stat-item enabled">
            <div class="stat-value">${stats.enabledPlugins}</div>
            <div class="stat-label">${i18n.t('plugins.stats.enabled')}</div>
          </div>
          <div class="plugin-stat-item hooks">
            <div class="stat-value">${stats.totalHooks}</div>
            <div class="stat-label">${i18n.t('plugins.stats.activeHooks')}</div>
          </div>
        </div>

        <div class="plugins-list">
          ${plugins.length === 0 ? `<p class="empty-state empty-state-msg">${i18n.t('plugins.emptyState')}</p>` :
            plugins.map(plugin => `
              <div class="plugin-item plugin-card ${plugin.enabled ? 'enabled' : 'disabled'}" data-plugin-name="${plugin.name}">
                <div class="plugin-header">
                  <div class="plugin-info">
                    <h4 class="plugin-title">
                      ${escapeHtml(plugin.name)}
                      <span class="plugin-enabled-dot ${plugin.enabled ? 'on' : 'off'}">${plugin.enabled ? '●' : '○'}</span>
                    </h4>
                    <div class="plugin-version-author">
                      v${escapeHtml(plugin.version)} by ${escapeHtml(plugin.author)}
                    </div>
                  </div>
                  <div class="plugin-toggle">
                    <label class="switch">
                      <input type="checkbox" data-action="toggle" data-plugin-name="${plugin.name}" ${plugin.enabled ? 'checked' : ''}>
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="plugin-description">
                  ${escapeHtml(plugin.description)}
                </div>

                <div class="plugin-hooks plugin-hooks-list">
                  <strong>${i18n.t('plugins.hooksLabel')}</strong>
                  ${plugin.hooks ? Object.keys(plugin.hooks).map(h => `<span class="hook-badge">${h}</span>`).join('') : `<span>${i18n.t('plugins.none')}</span>`}
                </div>

                <div class="plugin-meta plugin-meta-info">
                  ${plugin._loadedAt ? i18n.t('plugins.loadedAt', { date: new Date(plugin._loadedAt).toLocaleString() }) : ''}
                </div>

                <div class="plugin-actions">
                  <button class="btn-mini" data-action="settings" data-plugin-name="${plugin.name}">⚙️ ${i18n.t('plugins.settings')}</button>
                  <button class="btn-mini" data-action="export" data-plugin-name="${plugin.name}">📤 ${i18n.t('plugins.export')}</button>
                  <button class="btn-mini danger" data-action="uninstall" data-plugin-name="${plugin.name}">🗑️ ${i18n.t('common.uninstall')}</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-install-plugin-file">📁 ${i18n.t('plugins.installFromFile')}</button>
        <button class="btn btn-red" id="btn-clear-all-plugins">🗑️ ${i18n.t('plugins.clearAll')}</button>
        <button class="btn" id="close-plugins-modal-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Bind events
  bindPluginModalEvents(modal);

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Bind plugin modal events
 */
function bindPluginModalEvents(modal) {
  // Close buttons
  modal.querySelector('#close-plugins-modal')?.addEventListener('click', () => {
    modal.remove();
  });
  modal.querySelector('#close-plugins-modal-footer')?.addEventListener('click', () => {
    modal.remove();
  });

  // Action buttons
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = btn.dataset.action;
      const pluginName = btn.dataset.pluginName;

      switch (action) {
        case 'toggle':
          const checkbox = e.target;
          if (checkbox.checked) {
            pluginManager.enablePlugin(pluginName);
          } else {
            pluginManager.disablePlugin(pluginName);
          }
          updatePluginStatus();
          break;

        case 'settings':
          showPluginSettingsModal(pluginName);
          break;

        case 'export':
          const json = pluginManager.exportPlugin(pluginName);
          if (json) {
            downloadFile(json, `plugin-${pluginName}.json`, 'application/json');
            showToast(i18n.t('toast.pluginMetadataExported'), 'success');
          }
          break;

        case 'uninstall':
          const uninstallConfirmed = await showConfirm(i18n.t('vault.messages.uninstallPluginConfirm', { name: pluginName }), {
            title: i18n.t('plugins.uninstallTitle'),
            confirmLabel: i18n.t('common.uninstall'),
            danger: true
          });
          if (uninstallConfirmed) {
            pluginManager.unregisterPlugin(pluginName);
            modal.remove();
            showPluginManagerModal(); // Refresh
            updatePluginStatus();
          }
          break;
      }
    });
  });

  // Install from file
  modal.querySelector('#btn-install-plugin-file')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,application/javascript';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const success = pluginManager.loadPluginFromCode(event.target.result, file.name);
          if (success) {
            modal.remove();
            showPluginManagerModal(); // Refresh
            updatePluginStatus();
          }
        } catch (error) {
          showToast(i18n.t('toast.pluginInstallFailed'), 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // Clear all plugins
  modal.querySelector('#btn-clear-all-plugins')?.addEventListener('click', async () => {
    const confirmed = await showConfirm(i18n.t('toast.clearPluginsConfirm'), {
      title: i18n.t('plugins.clearAllTitle'),
      confirmLabel: i18n.t('common.clearAll'),
      danger: true
    });
    if (confirmed) {
      pluginManager.clearAllPlugins();
      modal.remove();
      showPluginManagerModal(); // Refresh
      updatePluginStatus();
    }
  });
}

/**
 * Show plugin settings modal
 */
function showPluginSettingsModal(pluginName) {
  const plugin = pluginManager.getPlugin(pluginName);
  if (!plugin) {
    showToast(i18n.t('toast.pluginNotFound'), 'error');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'plugin-settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">⚙️ ${i18n.t('plugins.settingsTitle', { name: escapeHtml(plugin.name) })}</div>
        <button class="modal-close" id="close-plugin-settings-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div id="plugin-settings-container"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="close-plugin-settings-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Call plugin's onUIRender hook if available
  const container = modal.querySelector('#plugin-settings-container');
  if (plugin.hooks && plugin.hooks.onUIRender && container) {
    try {
      plugin.hooks.onUIRender(container);
    } catch (error) {
      container.innerHTML = sanitizeHTML(`<p class="text-red">${i18n.t('plugins.renderError', { error: escapeHtml(error.message) })}</p>`);
    }
  } else {
    container.innerHTML = sanitizeHTML(`
      <div class="p-20 text-center text-secondary">
        <p>${i18n.t('plugins.noSettings')}</p>
        <div class="format-info-box mt-20 text-left">
          <strong>${i18n.t('plugins.configTitle')}</strong>
          <pre class="config-pre">${JSON.stringify(plugin.config || {}, null, 2)}</pre>
        </div>
      </div>
    `);
  }

  // Bind close events
  modal.querySelector('#close-plugin-settings-modal')?.addEventListener('click', () => {
    modal.remove();
  });
  modal.querySelector('#close-plugin-settings-footer')?.addEventListener('click', () => {
    modal.remove();
  });

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Initialize advanced import/export UI
 */
export function initializeAdvancedImportExportUI() {
  // Add event listener to existing export button if it exists
  const existingExportBtn = document.getElementById('btn-export');
  if (existingExportBtn) {
    // Replace click handler with advanced export
    const newExportBtn = existingExportBtn.cloneNode(true);
    existingExportBtn.parentNode.replaceChild(newExportBtn, existingExportBtn);

    newExportBtn.addEventListener('click', showAdvancedExportModal);
  }

  // Add import button next to export if not already there
  const resultsPanel = document.querySelector('.results .actions');
  if (resultsPanel) {
    const existingImportBtn = document.getElementById('btn-import-advanced');
    if (!existingImportBtn) {
      const importBtn = document.createElement('button');
      importBtn.className = 'btn';
      importBtn.id = 'btn-import-advanced';
      importBtn.innerHTML = sanitizeHTML('📥 Import');

      // Insert after export button
      const exportBtn = document.getElementById('btn-export');
      if (exportBtn && exportBtn.nextSibling) {
        exportBtn.parentNode.insertBefore(importBtn, exportBtn.nextSibling);
      } else if (exportBtn) {
        exportBtn.parentNode.appendChild(importBtn);
      }

      importBtn.addEventListener('click', showAdvancedImportModal);
    }
  }

  safeLog('Advanced Import/Export UI initialized');
}

/**
 * Show advanced export modal
 */
function showAdvancedExportModal() {
  // Get current passwords from results
  const passwordElements = document.querySelectorAll('.result-item');
  if (passwordElements.length === 0) {
    showToast(i18n.t('toast.noPasswordsToExport'), 'warning');
    return;
  }

  const passwords = Array.from(passwordElements).map((el, index) => ({
    title: i18n.t('export.passwordTitle', { index: index + 1 }),
    username: '',
    password: el.textContent.trim(),
    url: '',
    notes: i18n.t('export.generatedBy', { date: new Date().toLocaleDateString() }),
    tags: [],
    metadata: {},
    folder: i18n.t('export.folderName'),
    createdAt: new Date(),
    modifiedAt: new Date()
  }));

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'advanced-export-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${i18n.t('export.title')}</div>
        <button class="modal-close" id="close-export-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="mb-20 text-secondary">
          ${i18n.t('export.description', { count: passwords.length })}
        </p>

        <div class="form-group mb-20">
          <label for="export-format" class="form-label">
            ${i18n.t('export.selectFormat')}
          </label>
          <select id="export-format" class="input-field format-select">
            <optgroup label="${i18n.t('export.passwordManagers')}">
              <option value="keepass-csv">KeePass (CSV)</option>
              <option value="bitwarden-json">Bitwarden (JSON)</option>
              <option value="lastpass-csv">LastPass (CSV)</option>
              <option value="1password-csv">1Password (CSV)</option>
            </optgroup>
            <optgroup label="${i18n.t('export.genericFormats')}">
              <option value="generic-json">Generic JSON</option>
              <option value="generic-csv">Generic CSV</option>
            </optgroup>
          </select>
        </div>

        <div class="format-info format-info-box">
          <strong>${i18n.t('export.formatInfo')}</strong>
          <div id="format-description" class="form-description">
            ${i18n.t('export.selectFormatDetails')}
          </div>
        </div>

        <div class="export-options mb-20">
          <label class="form-label">
            <input type="checkbox" id="include-metadata" checked>
            ${i18n.t('export.includeMetadata')}
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-green" id="btn-export-download">
          ${i18n.t('export.download')}
        </button>
        <button class="btn" id="close-export-modal-footer">${i18n.t('common.cancel')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Update format description
  const formatSelect = modal.querySelector('#export-format');
  const formatDescription = modal.querySelector('#format-description');

  const formatDescriptions = {
    'keepass-csv': i18n.t('export.formats.keepassCsv'),
    'bitwarden-json': i18n.t('export.formats.bitwardenJson'),
    'lastpass-csv': i18n.t('export.formats.lastpassCsv'),
    '1password-csv': i18n.t('export.formats.onepasswordCsv'),
    'generic-json': i18n.t('export.formats.genericJson'),
    'generic-csv': i18n.t('export.formats.genericCsv')
  };

  formatSelect.addEventListener('change', () => {
    const format = formatSelect.value;
    formatDescription.textContent = formatDescriptions[format] || i18n.t('export.selectFormatDetails');
  });

  // Trigger initial description
  formatSelect.dispatchEvent(new Event('change'));

  // Export button
  modal.querySelector('#btn-export-download').addEventListener('click', () => {
    const format = formatSelect.value;
    const _includeMetadata = modal.querySelector('#include-metadata').checked;

    try {
      // Export passwords
      const exported = importExportService.export(passwords, format);
      const formatInfo = importExportService.getFormatInfo(format);

      // Download file
      const filename = `genpwd-export-${new Date().toISOString().slice(0, 10)}${formatInfo.extension}`;
      downloadFile(exported, filename, format.includes('json') ? 'application/json' : 'text/csv');

      showToast(i18n.t('export.success', { count: passwords.length, format: formatInfo.name }), 'success');
      modal.remove();
    } catch (error) {
      showToast(i18n.t('export.failed', { error: error.message }), 'error');
      safeLog(`Export error: ${error.message}`);
    }
  });

  // Close buttons
  modal.querySelector('#close-export-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#close-export-modal-footer').addEventListener('click', () => modal.remove());

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Show advanced import modal
 */
function showAdvancedImportModal() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'advanced-import-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = sanitizeHTML(`
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📥 Advanced Import</div>
        <button class="modal-close" id="close-import-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="mb-20 text-secondary">
          ${i18n.t('import.description')}
        </p>

        <div class="form-group mb-20">
          <label for="import-format" class="form-label">
            ${i18n.t('import.selectFormat')}
          </label>
          <select id="import-format" class="input-field format-select">
            <optgroup label="${i18n.t('import.passwordManagers')}">
              <option value="keepass-xml">KeePass (XML)</option>
              <option value="keepass-csv">KeePass (CSV)</option>
              <option value="bitwarden-json">Bitwarden (JSON)</option>
              <option value="lastpass-csv">LastPass (CSV)</option>
              <option value="1password-csv">1Password (CSV)</option>
            </optgroup>
            <optgroup label="${i18n.t('import.genericFormats')}">
              <option value="generic-json">Generic JSON</option>
              <option value="generic-csv">Generic CSV</option>
            </optgroup>
          </select>
        </div>

        <div class="format-info format-info-box">
          <strong>${i18n.t('import.formatInfo')}</strong>
          <div id="import-format-description" class="form-description">
            ${i18n.t('import.selectFormatDetails')}
          </div>
        </div>

        <div class="file-upload mb-20">
          <input type="file" id="import-file-input" accept=".xml,.csv,.json" class="file-input-hidden">
          <button class="btn full-width btn-blue" id="btn-select-file">
            📁 ${i18n.t('import.selectFile')}
          </button>
          <div id="selected-file-name" class="file-name-display"></div>
        </div>

        <div id="import-preview" class="import-preview-box">
          <strong>${i18n.t('import.preview')}:</strong>
          <div id="import-preview-content" class="form-description"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-green" id="btn-import-execute" disabled>
          ✅ ${i18n.t('import.importPasswords')}
        </button>
        <button class="btn" id="close-import-modal-footer">${i18n.t('common.cancel')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  let importedData = null;

  // Update format description
  const formatSelect = modal.querySelector('#import-format');
  const formatDescription = modal.querySelector('#import-format-description');

  const formatDescriptions = {
    'keepass-xml': () => i18n.t('import.formats.keepassXml'),
    'keepass-csv': () => i18n.t('import.formats.keepassCsv'),
    'bitwarden-json': () => i18n.t('import.formats.bitwardenJson'),
    'lastpass-csv': () => i18n.t('import.formats.lastpassCsv'),
    '1password-csv': () => i18n.t('import.formats.onepasswordCsv'),
    'generic-json': () => i18n.t('import.formats.genericJson'),
    'generic-csv': () => i18n.t('import.formats.genericCsv')
  };

  formatSelect.addEventListener('change', () => {
    const format = formatSelect.value;
    const getDescription = formatDescriptions[format];
    formatDescription.textContent = getDescription ? getDescription() : i18n.t('plugins.selectFormat');
  });

  // Trigger initial description
  formatSelect.dispatchEvent(new Event('change'));

  // File selection
  const fileInput = modal.querySelector('#import-file-input');
  const selectFileBtn = modal.querySelector('#btn-select-file');
  const selectedFileName = modal.querySelector('#selected-file-name');
  const importPreview = modal.querySelector('#import-preview');
  const importPreviewContent = modal.querySelector('#import-preview-content');
  const importButton = modal.querySelector('#btn-import-execute');

  selectFileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedFileName.textContent = i18n.t('plugins.selectedFile', { name: file.name, size: (file.size / 1024).toFixed(2) });

    try {
      const content = await file.text();
      const format = formatSelect.value;

      // Import and preview
      importedData = importExportService.import(content, format);

      // Show preview
      importPreview.classList.add('visible');
      importPreviewContent.innerHTML = sanitizeHTML(`
        <div class="mb-10">
          <strong>Entries found:</strong> ${importedData.length}
        </div>
        <div class="import-entries-list">
          ${importedData.slice(0, 5).map((entry, i) => `
            <div class="import-entry-preview">
              <div class="import-entry-title">${escapeHtml(entry.title || `Entry ${i + 1}`)}</div>
              <div class="import-entry-details">
                ${entry.username ? `👤 ${escapeHtml(entry.username)}` : ''}
                ${entry.url ? `🔗 ${escapeHtml(entry.url)}` : ''}
              </div>
            </div>
          `).join('')}
          ${importedData.length > 5 ? `<div class="import-more-msg">... and ${importedData.length - 5} more</div>` : ''}
        </div>
      `);

      importButton.disabled = false;
      showToast(i18n.t('toast.foundPasswordEntries', { count: importedData.length }), 'success');
    } catch (error) {
      showToast(i18n.t('import.failed', { error: error.message }), 'error');
      safeLog(`Import error: ${error.message}`);
      importPreview.classList.remove('visible');
      importButton.disabled = true;
    }
  });

  // Import button
  importButton.addEventListener('click', () => {
    if (!importedData || importedData.length === 0) {
      showToast(i18n.t('toast.noDataToImport'), 'warning');
      return;
    }

    // Display imported passwords in results
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
      resultsDiv.innerHTML = sanitizeHTML(`
        <div class="import-results">
          <h3 class="heading-3">Imported ${importedData.length} Passwords</h3>
          ${importedData.map((entry, i) => `
            <div class="result-item import-result-item">
              <div class="import-result-content">
                <div class="import-result-info">
                  <div class="result-entry-title">${escapeHtml(entry.title || `Entry ${i + 1}`)}</div>
                  ${entry.username ? `<div class="result-entry-detail">👤 ${escapeHtml(entry.username)}</div>` : ''}
                  ${entry.url ? `<div class="result-entry-detail">🔗 ${escapeHtml(entry.url)}</div>` : ''}
                  ${entry.notes ? `<div class="result-entry-notes">📝 ${escapeHtml(entry.notes.slice(0, 100))}${entry.notes.length > 100 ? '...' : ''}</div>` : ''}
                  <div class="import-password-display">
                    ${entry.password}
                  </div>
                </div>
                <button class="btn-mini copy-btn copy-btn-result" data-password="${entry.password}">
                  📋 Copy
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `);

      // Bind copy buttons
      resultsDiv.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const password = btn.dataset.password;
          navigator.clipboard.writeText(password);
          showToast(i18n.t('toast.passwordCopied'), 'success');
        });
      });
    }

    showToast(i18n.t('toast.importedPasswords', { count: importedData.length }), 'success');
    modal.remove();
  });

  // Close buttons
  modal.querySelector('#close-import-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#close-import-modal-footer').addEventListener('click', () => modal.remove());

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Initialize HIBP (Have I Been Pwned) Breach Checker UI
 */
export function initializeHIBPUI() {
  // Add HIBP Check button to actions toolbar
  const actionsToolbar = document.querySelector('.actions');
  if (!actionsToolbar) return;

  // Check if button already exists
  if (document.getElementById('btn-hibp-check')) return;

  // Create HIBP check button
  const hibpBtn = document.createElement('button');
  hibpBtn.className = 'btn';
  hibpBtn.id = 'btn-hibp-check';
  hibpBtn.setAttribute('aria-label', i18n.t('aria.checkBreaches'));
  hibpBtn.innerHTML = sanitizeHTML('🔍 Check Breaches');

  // Insert after Export button
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.after(hibpBtn);
  } else {
    actionsToolbar.appendChild(hibpBtn);
  }

  // Bind click event
  hibpBtn.addEventListener('click', () => showHIBPCheckModal());

  safeLog('HIBP UI initialized');
}

/**
 * Show HIBP Check Modal
 */
function showHIBPCheckModal() {
  // Get all generated passwords from results list
  const passwordItems = document.querySelectorAll('.password-item');

  if (passwordItems.length === 0) {
    showToast(i18n.t('toast.noPasswordsToCheck'), 'warning');
    return;
  }

  // Extract passwords
  const passwords = Array.from(passwordItems).map(item => {
    const pwdSpan = item.querySelector('.password-text');
    return pwdSpan ? pwdSpan.textContent : '';
  }).filter(pwd => pwd.length > 0);

  if (passwords.length === 0) {
    showToast(i18n.t('toast.noValidPasswordsToCheck'), 'warning');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = sanitizeHTML(`
    <div class="modal large">
      <div class="modal-header">
        <div class="modal-title">
          ${i18n.t('breach.modalTitle')}
        </div>
        <button class="modal-close" id="close-hibp-modal" aria-label="${i18n.t('common.close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-box">
          <strong>${i18n.t('breach.privacyTitle')}</strong>
          <p class="import-hint">
            ${i18n.t('breach.privacyDescription')}
          </p>
        </div>

        <div id="hibp-checking-status" class="checking-status">
          <div class="spinner"></div>
          <p>${i18n.t('breach.checkingStatus', { count: passwords.length })}</p>
        </div>

        <div id="hibp-results" class="hibp-results hidden"></div>
      </div>

      <div class="modal-footer">
        <button class="btn" id="close-hibp-modal-footer">${i18n.t('common.close')}</button>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Close button handlers
  modal.querySelector('#close-hibp-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#close-hibp-modal-footer').addEventListener('click', () => modal.remove());

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);

  // Check passwords
  checkPasswordsWithHIBP(passwords, modal);
}

/**
 * Check passwords with HIBP
 */
async function checkPasswordsWithHIBP(passwords, modal) {
  const statusDiv = modal.querySelector('#hibp-checking-status');
  const resultsDiv = modal.querySelector('#hibp-results');

  try {
    const results = [];

    // Check each password
    for (let i = 0; i < passwords.length; i++) {
      const password = passwords[i];

      // Update status
      statusDiv.querySelector('p').textContent =
        i18n.t('breach.checkingProgress', { current: i + 1, total: passwords.length });

      const result = await hibpService.checkPassword(password);
      results.push({
        password: password,
        ...result
      });
    }

    // Hide status, show results
    statusDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');

    // Render results
    renderHIBPResults(results, resultsDiv);

  } catch (error) {
    statusDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = sanitizeHTML(`
      <div class="error-box">
        <strong>${i18n.t('breach.errorTitle')}</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `);
  }
}

/**
 * Render HIBP results
 */
function renderHIBPResults(results, container) {
  // Summary statistics
  const pwnedCount = results.filter(r => r.isPwned).length;
  const safeCount = results.length - pwnedCount;

  let summaryHtml = `
    <div class="hibp-summary">
      <div class="summary-stat ${safeCount > 0 ? 'safe' : ''}">
        <div class="stat-value">${safeCount}</div>
        <div class="stat-label">${i18n.t('breach.stats.safe')}</div>
      </div>
      <div class="summary-stat ${pwnedCount > 0 ? 'danger' : ''}">
        <div class="stat-value">${pwnedCount}</div>
        <div class="stat-label">${i18n.t('breach.stats.breached')}</div>
      </div>
    </div>
  `;

  // Individual results
  let resultsHtml = '<div class="hibp-results-list">';

  for (const result of results) {
    const severity = hibpService.getSeverity(result.count);
    const message = hibpService.getMessage(result.isPwned, result.count);
    const color = hibpService.getSeverityColor(severity);

    resultsHtml += `
      <div class="hibp-result-item ${severity}">
        <div class="hibp-result-header">
          <div class="password-display">
            <code>${escapeHtml(result.password.substring(0, 20))}${result.password.length > 20 ? '...' : ''}</code>
          </div>
          <div class="hibp-badge" data-hibp-color="${color}">
            ${result.isPwned ? i18n.t('breach.breachesCount', { count: result.count.toLocaleString() }) : i18n.t('breach.stats.safe')}
          </div>
        </div>
        <div class="hibp-result-message">
          ${escapeHtml(message)}
        </div>
      </div>
    `;
  }

  resultsHtml += '</div>';

  container.innerHTML = summaryHtml + resultsHtml;

  // Apply HIBP badge colors via CSSOM for CSP compliance
  container.querySelectorAll('[data-hibp-color]').forEach(el => {
    el.style.setProperty('--hibp-badge-color', el.dataset.hibpColor);
  });

  // Show toast with summary
  if (pwnedCount > 0) {
    showToast(i18n.t('breach.pwnedWarning', { count: pwnedCount }), 'warning');
  } else {
    showToast(i18n.t('breach.safeMessage', { count: safeCount }), 'success');
  }
}

/**
 * Initialize all feature UIs
 */
export function initializeAllFeatures() {
  initializeLanguageSelector();
  initializePresetsUI();
  initializeHistoryUI();
  // initializePluginsUI(); // Disabled - no plugins available yet
  initializeAdvancedImportExportUI();
  initializeHIBPUI();
  safeLog('All feature UIs initialized');
}
