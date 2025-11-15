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

// src/js/ui/features-ui.js - UI components for v2.6.0 features

import { i18n, t } from '../utils/i18n.js';
import presetManager from '../utils/preset-manager.js';
import historyManager from '../utils/history-manager.js';
import pluginManager from '../utils/plugin-manager.js';
import importExportService from '../services/import-export-service.js';
import { showToast } from '../utils/toast.js';
import { safeLog } from '../utils/logger.js';
import { escapeHtml } from '../utils/helpers.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';

/**
 * Initialize language selector in header
 */
export function initializeLanguageSelector() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Create language selector button (only button, not dropdown)
  const langSelector = document.createElement('div');
  langSelector.className = 'language-selector';
  langSelector.innerHTML = `
    <button class="lang-btn" id="lang-btn" aria-label="Changer la langue" title="Langue">
      <span class="lang-flag" id="lang-flag">${i18n.getLocaleFlag(i18n.getLocale())}</span>
      <span class="lang-code" id="lang-code">${i18n.getLocale().toUpperCase()}</span>
    </button>
  `;

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
  langDropdown.innerHTML = `
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
  `;
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
    } else {
      langDropdown.classList.add('hidden');
    }
  });

  // Reposition on scroll/resize
  window.addEventListener('scroll', () => {
    if (!langDropdown.classList.contains('hidden')) {
      positionDropdown();
    }
  });

  window.addEventListener('resize', () => {
    if (!langDropdown.classList.contains('hidden')) {
      positionDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    langDropdown.classList.add('hidden');
  });

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

        showToast(`Language changed to ${i18n.getLocaleDisplayName(lang)}`, 'success');

        safeLog(`Language changed to: ${lang}`);
      } catch (error) {
        showToast('Failed to change language', 'error');
        safeLog(`Error changing language: ${error.message}`);
      }
    });
  });
}

/**
 * Update interface language with current translations
 */
function updateInterfaceLanguage() {
  try {
    // Update header
    const logoSubtitle = document.querySelector('.logo-subtitle');
    if (logoSubtitle) {
      logoSubtitle.textContent = i18n.t('app.subtitle');
    }

    const aboutBtn = document.querySelector('.about-btn span');
    if (aboutBtn) {
      aboutBtn.textContent = i18n.t('common.about');
    }

    // Update main buttons
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
      btnGenerate.textContent = '🔒 ' + i18n.t('common.generate');
    }

    const btnCopyAll = document.getElementById('btn-copy-all');
    if (btnCopyAll) {
      btnCopyAll.textContent = '📋 ' + i18n.t('common.copyAll');
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.textContent = '📤 ' + i18n.t('common.export');
    }

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.textContent = '🗑️ ' + i18n.t('common.clear');
    }

    // Update preset buttons if they exist
    const btnSavePreset = document.getElementById('btn-save-preset');
    if (btnSavePreset) {
      btnSavePreset.textContent = '💾 ' + i18n.t('presets.save');
    }

    const btnManagePresets = document.getElementById('btn-manage-presets');
    if (btnManagePresets) {
      btnManagePresets.textContent = '🗂️ ' + i18n.t('presets.manage');
    }

    // Update history button if it exists
    const btnHistory = document.getElementById('btn-history');
    if (btnHistory) {
      btnHistory.textContent = '📜 ' + i18n.t('history.title');
    }

    // Update tests button
    const btnTests = document.getElementById('btn-run-tests');
    if (btnTests) {
      btnTests.textContent = '🧪 ' + i18n.t('common.tests');
    }

    // Update section headers
    updateSectionHeaders();

    // Update labels
    updateLabels();

    // Update select options
    updateSelectOptions();

    safeLog('Interface language updated');
  } catch (error) {
    safeLog(`Error updating interface language: ${error.message}`);
  }
}

/**
 * Update section headers
 */
function updateSectionHeaders() {
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
 * Update labels
 */
function updateLabels() {
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
    blurCheckbox.innerHTML = `<input type="checkbox" id="mask-toggle" checked> ${i18n.t('settings.blurPasswords')}`;
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
 * Update select options
 */
function updateSelectOptions() {
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
  presetsSection.innerHTML = `
    <div class="section-header chevron">
      <span class="chev">▼</span>
      <strong>💾 ${i18n.t('presets.title')}</strong>
      <span class="badge">${presetManager.getAllPresets().length}</span>
    </div>
    <div class="section-content">
      <div class="row">
        <button class="btn full-width" id="btn-save-preset">
          💾 ${i18n.t('presets.save')}
        </button>
      </div>
      <div class="row">
        <button class="btn full-width" id="btn-manage-presets">
          🗂️ ${i18n.t('presets.manage')}
        </button>
      </div>
      <div class="row">
        <label for="preset-select">${i18n.t('presets.load')}</label>
        <select id="preset-select" class="grow">
          <option value="">${i18n.t('presets.select')}</option>
        </select>
      </div>
    </div>
  `;

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
  safeLog('Presets UI initialized');
}

/**
 * Update preset dropdown
 */
function updatePresetDropdown() {
  const presetSelect = document.getElementById('preset-select');
  if (!presetSelect) return;

  const presets = presetManager.getAllPresets();
  presetSelect.innerHTML = `<option value="">${i18n.t('presets.select')}</option>`;

  presets.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.name}${preset.isDefault ? ' ⭐' : ''}`;
    presetSelect.appendChild(option);
  });
}

/**
 * Bind preset events
 */
function bindPresetEvents() {
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnManagePresets = document.getElementById('btn-manage-presets');
  const presetSelect = document.getElementById('preset-select');

  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', showSavePresetDialog);
  }

  if (btnManagePresets) {
    btnManagePresets.addEventListener('click', showManagePresetsModal);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', loadPreset);
  }
}

/**
 * Show save preset dialog (modal version)
 */
function showSavePresetDialog() {
  // Gather current configuration
  const config = {
    mode: document.getElementById('mode-select')?.value,
    length: parseInt(document.getElementById('syll-len')?.value),
    policy: document.getElementById('policy-select')?.value,
    digits: parseInt(document.getElementById('digits-count')?.value),
    specials: parseInt(document.getElementById('specials-count')?.value),
    customSpecials: document.getElementById('custom-specials')?.value,
    placeDigits: document.getElementById('place-digits')?.value,
    placeSpecials: document.getElementById('place-specials')?.value,
    caseMode: document.getElementById('case-mode-select')?.value,
    quantity: parseInt(document.getElementById('qty')?.value)
  };

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'save-preset-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">💾 Sauvegarder le Preset</div>
        <button class="modal-close" id="close-save-modal" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="preset-name">Nom du preset <span style="color: red;">*</span></label>
          <input type="text" id="preset-name" class="input-field" placeholder="Ex: Mon preset sécurisé" required maxlength="50">
          <span class="error-message" id="name-error" style="display:none; color: red; font-size: 0.85em;"></span>
        </div>

        <div class="form-group">
          <label for="preset-description">Description</label>
          <textarea id="preset-description" class="input-field" rows="2" placeholder="Description optionnelle..."></textarea>
        </div>

        <div class="config-preview">
          <strong>Configuration à sauvegarder :</strong>
          <ul style="margin: 8px 0; padding-left: 20px; font-size: 0.9em;">
            <li>Mode: ${config.mode || 'Non défini'}</li>
            <li>Longueur: ${config.length || 'N/A'} caractères</li>
            <li>Politique: ${config.policy || 'Standard'}</li>
            <li>Chiffres: ${config.digits || 0}</li>
            <li>Caractères spéciaux: ${config.specials || 0}</li>
            ${config.customSpecials ? `<li>Spéciaux personnalisés: ${config.customSpecials}</li>` : ''}
            <li>Placement chiffres: ${config.placeDigits || 'Aléatoire'}</li>
            <li>Placement spéciaux: ${config.placeSpecials || 'Aléatoire'}</li>
            <li>Casse: ${config.caseMode || 'Mixte'}</li>
            <li>Quantité: ${config.quantity || 1}</li>
          </ul>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-save-preset-confirm">💾 Sauvegarder</button>
        <button class="btn" id="btn-cancel-save">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => {
    modal.classList.add('show');
    document.getElementById('preset-name')?.focus();
  }, 10);

  // Validation
  const nameInput = document.getElementById('preset-name');
  const nameError = document.getElementById('name-error');

  function validateName() {
    const name = nameInput.value.trim();
    if (!name) {
      nameError.textContent = 'Le nom est requis';
      nameError.style.display = 'block';
      return false;
    }
    if (name.length > 50) {
      nameError.textContent = 'Le nom ne peut pas dépasser 50 caractères';
      nameError.style.display = 'block';
      return false;
    }
    nameError.style.display = 'none';
    return true;
  }

  nameInput.addEventListener('input', validateName);

  // Save button
  document.getElementById('btn-save-preset-confirm')?.addEventListener('click', () => {
    if (!validateName()) return;

    const name = nameInput.value.trim();
    const description = document.getElementById('preset-description')?.value.trim() || '';

    try {
      const preset = presetManager.createPreset(name, config, description);
      updatePresetDropdown();
      modal.remove();
      showToast(`Preset "${name}" sauvegardé !`, 'success');
      safeLog(`Preset created: ${preset.id}`);
    } catch (error) {
      showToast('Échec de la sauvegarde du preset', 'error');
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
 * Load preset
 */
function loadPreset(event) {
  const presetId = event.target.value;
  if (!presetId) return;

  const preset = presetManager.getPreset(presetId);
  if (!preset) {
    showToast('Preset not found', 'error');
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

  if (config.quantity) {
    const qty = document.getElementById('qty');
    if (qty) {
      qty.value = config.quantity;
      qty.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  showToast(`Preset "${preset.name}" loaded!`, 'success');
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

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="presets-modal-title">
          🗂️ Gérer les Presets
        </div>
        <button class="modal-close" id="close-presets-modal" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="search-container" style="margin-bottom: 16px;">
          <input
            type="text"
            id="preset-search"
            class="input-field"
            placeholder="🔍 Rechercher un preset..."
            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
          >
        </div>
        <div class="presets-list">
          ${presets.map(preset => `
            <div class="preset-item" data-preset-id="${preset.id}">
              <div class="preset-info">
                <div class="preset-name" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>${escapeHtml(preset.name)} ${preset.isDefault ? '⭐' : ''}</span>
                  <button class="btn-mini" data-action="toggle-details" data-preset-id="${preset.id}" style="font-size: 0.8em;">
                    <span class="details-toggle-icon">▼</span> Détails
                  </button>
                </div>
                <div class="preset-desc">${escapeHtml(preset.description || 'Aucune description')}</div>

                <!-- Section expandable des détails -->
                <div class="preset-details" id="details-${preset.id}" style="display: none; background: #f5f5f5; padding: 10px; margin-top: 10px; border-radius: 4px; font-size: 0.9em;">
                  <strong style="color: #333;">Configuration :</strong>
                  <ul style="margin: 8px 0; padding-left: 20px;">
                    <li><strong>Mode :</strong> ${preset.config.mode || 'Non défini'}</li>
                    <li><strong>Longueur :</strong> ${preset.config.length || 'N/A'} caractères</li>
                    <li><strong>Politique :</strong> ${preset.config.policy || 'Standard'}</li>
                    <li><strong>Chiffres :</strong> ${preset.config.digits || 0}</li>
                    <li><strong>Caractères spéciaux :</strong> ${preset.config.specials || 0}</li>
                    ${preset.config.customSpecials ? `<li><strong>Spéciaux personnalisés :</strong> ${preset.config.customSpecials}</li>` : ''}
                    <li><strong>Placement chiffres :</strong> ${preset.config.placeDigits || 'Aléatoire'}</li>
                    <li><strong>Placement spéciaux :</strong> ${preset.config.placeSpecials || 'Aléatoire'}</li>
                    <li><strong>Casse :</strong> ${preset.config.caseMode || 'Mixte'}</li>
                    <li><strong>Quantité :</strong> ${preset.config.quantity || 1}</li>
                  </ul>
                  <div style="font-size: 0.85em; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                    <div>📅 Créé : ${new Date(preset.createdAt).toLocaleDateString()} ${new Date(preset.createdAt).toLocaleTimeString()}</div>
                    <div>🔄 Modifié : ${new Date(preset.updatedAt).toLocaleDateString()} ${new Date(preset.updatedAt).toLocaleTimeString()}</div>
                  </div>
                </div>

                <div class="preset-meta" style="margin-top: 6px;">
                  Créé: ${new Date(preset.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div class="preset-actions">
                <button class="btn-mini" data-action="load" data-preset-id="${preset.id}">Charger</button>
                <button class="btn-mini" data-action="edit" data-preset-id="${preset.id}">✏️ Éditer</button>
                <button class="btn-mini" data-action="duplicate" data-preset-id="${preset.id}">📋 Dupliquer</button>
                <button class="btn-mini" data-action="export" data-preset-id="${preset.id}">Export</button>
                ${!preset.isDefault ? `<button class="btn-mini danger" data-action="delete" data-preset-id="${preset.id}">Supprimer</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-import-preset">📥 Importer</button>
        <button class="btn" id="btn-export-all-presets">📤 Tout Exporter</button>
        <button class="btn danger" id="close-presets-modal-footer">Fermer</button>
      </div>
    </div>
  `;

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

          item.style.display = matchesSearch ? 'block' : 'none';
        }
      });
    });
  }

  // Action buttons
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
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
            const isVisible = detailsSection.style.display !== 'none';
            detailsSection.style.display = isVisible ? 'none' : 'block';
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
            const duplicatedPreset = presetManager.duplicatePreset(presetId);
            if (duplicatedPreset) {
              updatePresetDropdown();
              modal.remove();
              showManagePresetsModal();
              showToast(`Preset "${duplicatedPreset.name}" dupliqué !`, 'success');
            } else {
              showToast('Échec de la duplication du preset', 'error');
            }
          }
          break;

        case 'export':
          const json = presetManager.exportPreset(presetId);
          if (json) {
            downloadFile(json, `preset-${presetId}.json`, 'application/json');
            showToast('Preset exported!', 'success');
          }
          break;

        case 'delete':
          if (confirm('Supprimer ce preset ?')) {
            presetManager.deletePreset(presetId);
            updatePresetDropdown();
            modal.remove();
            showToast('Preset deleted', 'success');
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
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const preset = presetManager.importPreset(event.target.result);
          if (preset) {
            updatePresetDropdown();
            modal.remove();
            showToast(`Preset "${preset.name}" imported!`, 'success');
          }
        } catch (error) {
          showToast('Failed to import preset', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Export all button
  modal.querySelector('#btn-export-all-presets')?.addEventListener('click', () => {
    const json = presetManager.exportAll();
    downloadFile(json, 'genpwd-presets-all.json', 'application/json');
    showToast('All presets exported!', 'success');
  });
}

/**
 * Show edit preset modal
 */
function showEditPresetModal(presetId) {
  const preset = presetManager.getPreset(presetId);
  if (!preset) {
    showToast('Preset introuvable', 'error');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'edit-preset-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">✏️ Modifier le Preset</div>
        <button class="modal-close" id="close-edit-modal" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-preset-name">Nom du preset <span style="color: red;">*</span></label>
          <input type="text" id="edit-preset-name" class="input-field" value="${escapeHtml(preset.name)}" required maxlength="50">
          <span class="error-message" id="edit-name-error" style="display:none; color: red; font-size: 0.85em;"></span>
        </div>

        <div class="form-group">
          <label for="edit-preset-description">Description</label>
          <textarea id="edit-preset-description" class="input-field" rows="2">${escapeHtml(preset.description || '')}</textarea>
        </div>

        <div class="config-preview" style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin-top: 12px;">
          <strong>Configuration (non modifiable) :</strong>
          <ul style="margin: 8px 0; padding-left: 20px; font-size: 0.9em;">
            <li>Mode: ${preset.config.mode || 'Non défini'}</li>
            <li>Longueur: ${preset.config.length || 'N/A'} caractères</li>
            <li>Politique: ${preset.config.policy || 'Standard'}</li>
            <li>Chiffres: ${preset.config.digits || 0}</li>
            <li>Caractères spéciaux: ${preset.config.specials || 0}</li>
            ${preset.config.customSpecials ? `<li>Spéciaux personnalisés: ${preset.config.customSpecials}</li>` : ''}
            <li>Placement chiffres: ${preset.config.placeDigits || 'Aléatoire'}</li>
            <li>Placement spéciaux: ${preset.config.placeSpecials || 'Aléatoire'}</li>
            <li>Casse: ${preset.config.caseMode || 'Mixte'}</li>
            <li>Quantité: ${preset.config.quantity || 1}</li>
          </ul>
          <p style="font-size: 0.85em; color: #666; margin-top: 8px;">
            💡 Pour modifier la configuration, supprimez ce preset et créez-en un nouveau avec les paramètres souhaités.
          </p>
        </div>

        ${preset.isDefault ? `
          <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 0.9em;">
            ⚠️ Ceci est le preset par défaut. Vous pouvez modifier son nom et sa description.
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-edit-preset-confirm">💾 Sauvegarder</button>
        <button class="btn" id="btn-cancel-edit">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => {
    modal.classList.add('show');
    document.getElementById('edit-preset-name')?.focus();
  }, 10);

  // Validation
  const nameInput = document.getElementById('edit-preset-name');
  const nameError = document.getElementById('edit-name-error');

  function validateName() {
    const name = nameInput.value.trim();
    if (!name) {
      nameError.textContent = 'Le nom est requis';
      nameError.style.display = 'block';
      return false;
    }
    if (name.length > 50) {
      nameError.textContent = 'Le nom ne peut pas dépasser 50 caractères';
      nameError.style.display = 'block';
      return false;
    }
    nameError.style.display = 'none';
    return true;
  }

  nameInput.addEventListener('input', validateName);

  // Save button
  document.getElementById('btn-edit-preset-confirm')?.addEventListener('click', () => {
    if (!validateName()) return;

    const name = nameInput.value.trim();
    const description = document.getElementById('edit-preset-description')?.value.trim() || '';

    const success = presetManager.updatePreset(presetId, {
      name: name,
      description: description
    });

    if (success) {
      updatePresetDropdown();
      modal.remove();
      showToast(`Preset "${name}" modifié avec succès !`, 'success');
      safeLog(`Preset updated: ${presetId}`);
    } else {
      showToast('Échec de la modification du preset', 'error');
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
 * Initialize history UI
 */
export function initializeHistoryUI() {
  const resultsPanel = document.querySelector('.results .actions');
  if (!resultsPanel) return;

  // Add history button
  const btnHistory = document.createElement('button');
  btnHistory.className = 'btn';
  btnHistory.id = 'btn-history';
  btnHistory.innerHTML = '📜 ' + i18n.t('history.title');

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
function showHistoryModal() {
  const settings = historyManager.getSettings();

  if (!settings.enabled) {
    if (confirm('Historique désactivé. Activer maintenant ?')) {
      historyManager.updateSettings({ enabled: true });
      showToast('History enabled!', 'success');
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

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">
          📜 Historique des Mots de Passe
        </div>
        <button class="modal-close" id="close-history-modal" aria-label="Fermer">
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
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.favorites}</div>
            <div class="stat-label">Favoris</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.round(stats.averageEntropy)}</div>
            <div class="stat-label">Entropie Moy.</div>
          </div>
        </div>

        <div class="history-search">
          <input type="text" id="history-search-input" placeholder="Rechercher..." class="input" />
        </div>

        <div class="history-list">
          ${history.length === 0 ? '<p class="empty-state">Aucun mot de passe dans l\'historique</p>' :
            history.map(entry => `
              <div class="history-item" data-entry-id="${entry.id}">
                <div class="history-password">
                  <code>${entry.password}</code>
                  ${entry.isFavorite ? '⭐' : ''}
                </div>
                <div class="history-meta">
                  Mode: ${entry.metadata.mode} | Entropie: ${entry.metadata.entropy?.toFixed(1)} bits |
                  ${new Date(entry.timestamp).toLocaleString()}
                </div>
                <div class="history-tags">
                  ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <div class="history-actions">
                  <button class="btn-mini" data-action="copy" data-entry-id="${entry.id}">📋</button>
                  <button class="btn-mini" data-action="favorite" data-entry-id="${entry.id}">⭐</button>
                  <button class="btn-mini danger" data-action="delete" data-entry-id="${entry.id}">🗑️</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-export-history">📤 Exporter</button>
        <button class="btn danger" id="btn-clear-history">🗑️ Tout Effacer</button>
        <button class="btn" id="close-history-modal-footer">Fermer</button>
      </div>
    </div>
  `;

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
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const entryId = btn.dataset.entryId;

      switch (action) {
        case 'copy':
          const entry = historyManager.getEntry(entryId);
          if (entry) {
            navigator.clipboard.writeText(entry.password);
            showToast('Copied!', 'success');
          }
          break;

        case 'favorite':
          historyManager.toggleFavorite(entryId);
          modal.remove();
          showHistoryModal(); // Refresh
          break;

        case 'delete':
          if (confirm('Supprimer cette entrée ?')) {
            historyManager.deleteEntry(entryId);
            modal.remove();
            showHistoryModal(); // Refresh
          }
          break;
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
    showToast('History exported!', 'success');
  });

  // Clear all button
  modal.querySelector('#btn-clear-history')?.addEventListener('click', () => {
    if (confirm('Effacer tout l\'historique ? Cette action est irréversible !')) {
      historyManager.clearHistory();
      modal.remove();
      showToast('History cleared', 'success');
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

  pluginsSection.innerHTML = `
    <div class="section-header chevron">
      <span class="chev">▼</span>
      <strong>🔌 Plugins & Extensions</strong>
      <span class="badge">${pluginStats.enabledPlugins}/${pluginStats.totalPlugins}</span>
    </div>
    <div class="section-content">
      <div class="row">
        <button class="btn full-width" id="btn-manage-plugins">
          🔌 Manage Plugins
        </button>
      </div>
      <div class="row">
        <button class="btn full-width" id="btn-load-demo-plugins">
          🎨 Load Demo Plugins
        </button>
      </div>
      <div class="plugin-status" style="font-size: 0.9em; color: #666; margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <div><strong>Status:</strong> ${pluginStats.totalPlugins} plugin(s) installed</div>
        <div><strong>Hooks:</strong> ${pluginStats.totalHooks} active hook(s)</div>
      </div>
    </div>
  `;

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
      showToast('Demo plugins loaded successfully!', 'success');
      updatePluginStatus();
    } else if (emojiSuccess || xmlSuccess) {
      showToast('Some demo plugins loaded', 'warning');
      updatePluginStatus();
    } else {
      showToast('Failed to load demo plugins', 'error');
    }
  } catch (error) {
    safeLog(`Error loading demo plugins: ${error.message}`);
    showToast('Error loading demo plugins', 'error');
  }
}

/**
 * Update plugin status display
 */
function updatePluginStatus() {
  const statusDiv = document.querySelector('.plugin-status');
  if (statusDiv) {
    const stats = pluginManager.getStats();
    statusDiv.innerHTML = `
      <div><strong>Status:</strong> ${stats.totalPlugins} plugin(s) installed</div>
      <div><strong>Hooks:</strong> ${stats.totalHooks} active hook(s)</div>
    `;
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

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">
          🔌 Plugin Manager
        </div>
        <button class="modal-close" id="close-plugins-modal" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="plugin-stats" style="display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 6px;">
          <div class="stat-item">
            <div class="stat-value" style="font-size: 2em; font-weight: bold; color: #4CAF50;">${stats.totalPlugins}</div>
            <div class="stat-label" style="font-size: 0.9em; color: #666;">Total Plugins</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" style="font-size: 2em; font-weight: bold; color: #2196F3;">${stats.enabledPlugins}</div>
            <div class="stat-label" style="font-size: 0.9em; color: #666;">Enabled</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" style="font-size: 2em; font-weight: bold; color: #FF9800;">${stats.totalHooks}</div>
            <div class="stat-label" style="font-size: 0.9em; color: #666;">Active Hooks</div>
          </div>
        </div>

        <div class="plugins-list">
          ${plugins.length === 0 ? '<p class="empty-state" style="text-align: center; padding: 40px; color: #999;">No plugins installed. Click "Load Demo Plugins" to get started!</p>' :
            plugins.map(plugin => `
              <div class="plugin-item" data-plugin-name="${plugin.name}" style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: ${plugin.enabled ? '#fff' : '#f9f9f9'};">
                <div class="plugin-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                  <div class="plugin-info" style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1em;">
                      ${escapeHtml(plugin.name)}
                      ${plugin.enabled ? '<span style="color: #4CAF50; margin-left: 8px;">●</span>' : '<span style="color: #999; margin-left: 8px;">○</span>'}
                    </h4>
                    <div style="font-size: 0.85em; color: #666;">
                      v${escapeHtml(plugin.version)} by ${escapeHtml(plugin.author)}
                    </div>
                  </div>
                  <div class="plugin-toggle">
                    <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 24px;">
                      <input type="checkbox" data-action="toggle" data-plugin-name="${plugin.name}" ${plugin.enabled ? 'checked' : ''}>
                      <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${plugin.enabled ? '#4CAF50' : '#ccc'}; transition: .4s; border-radius: 24px;"></span>
                    </label>
                  </div>
                </div>

                <div class="plugin-description" style="font-size: 0.95em; color: #333; margin-bottom: 10px;">
                  ${escapeHtml(plugin.description)}
                </div>

                <div class="plugin-hooks" style="font-size: 0.85em; color: #666; margin-bottom: 10px;">
                  <strong>Hooks:</strong>
                  ${plugin.hooks ? Object.keys(plugin.hooks).map(h => `<span style="display: inline-block; background: #e3f2fd; padding: 2px 8px; border-radius: 3px; margin: 2px;">${h}</span>`).join('') : '<span>None</span>'}
                </div>

                <div class="plugin-meta" style="font-size: 0.8em; color: #999; border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
                  ${plugin._loadedAt ? `Loaded: ${new Date(plugin._loadedAt).toLocaleString()}` : ''}
                </div>

                <div class="plugin-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                  <button class="btn-mini" data-action="settings" data-plugin-name="${plugin.name}">⚙️ Settings</button>
                  <button class="btn-mini" data-action="export" data-plugin-name="${plugin.name}">📤 Export</button>
                  <button class="btn-mini danger" data-action="uninstall" data-plugin-name="${plugin.name}">🗑️ Uninstall</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-install-plugin-file">📁 Install from File</button>
        <button class="btn" id="btn-clear-all-plugins" style="background: #f44336; color: white;">🗑️ Clear All</button>
        <button class="btn" id="close-plugins-modal-footer">Close</button>
      </div>
    </div>
  `;

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
    btn.addEventListener('click', (e) => {
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
            showToast('Plugin metadata exported!', 'success');
          }
          break;

        case 'uninstall':
          if (confirm(`Uninstall plugin "${pluginName}"?`)) {
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
    input.onchange = (e) => {
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
          showToast('Failed to install plugin', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Clear all plugins
  modal.querySelector('#btn-clear-all-plugins')?.addEventListener('click', () => {
    if (confirm('Clear all plugins? This action cannot be undone!')) {
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
    showToast('Plugin not found', 'error');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'plugin-settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">⚙️ ${escapeHtml(plugin.name)} Settings</div>
        <button class="modal-close" id="close-plugin-settings-modal" aria-label="Close">
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
        <button class="btn" id="close-plugin-settings-footer">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Call plugin's onUIRender hook if available
  const container = modal.querySelector('#plugin-settings-container');
  if (plugin.hooks && plugin.hooks.onUIRender && container) {
    try {
      plugin.hooks.onUIRender(container);
    } catch (error) {
      container.innerHTML = `<p style="color: #f44336;">Error rendering plugin settings: ${escapeHtml(error.message)}</p>`;
    }
  } else {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>This plugin does not have configurable settings.</p>
        <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 6px; text-align: left;">
          <strong>Plugin Configuration:</strong>
          <pre style="margin-top: 10px; font-size: 0.85em; overflow: auto;">${JSON.stringify(plugin.config || {}, null, 2)}</pre>
        </div>
      </div>
    `;
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
      importBtn.innerHTML = '📥 Import';

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
    showToast('No passwords to export', 'warning');
    return;
  }

  const passwords = Array.from(passwordElements).map((el, index) => ({
    title: `Password ${index + 1}`,
    username: '',
    password: el.textContent.trim(),
    url: '',
    notes: `Generated by GenPwd Pro on ${new Date().toLocaleDateString()}`,
    tags: [],
    metadata: {},
    folder: 'GenPwd Pro',
    createdAt: new Date(),
    modifiedAt: new Date()
  }));

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'advanced-export-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📤 Advanced Export</div>
        <button class="modal-close" id="close-export-modal" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 20px; color: #666;">
          Export ${passwords.length} password(s) to various password manager formats
        </p>

        <div class="form-group" style="margin-bottom: 20px;">
          <label for="export-format" style="display: block; margin-bottom: 8px; font-weight: 500;">
            Select Export Format:
          </label>
          <select id="export-format" class="input-field" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <optgroup label="Password Managers">
              <option value="keepass-csv">KeePass (CSV)</option>
              <option value="bitwarden-json">Bitwarden (JSON)</option>
              <option value="lastpass-csv">LastPass (CSV)</option>
              <option value="1password-csv">1Password (CSV)</option>
            </optgroup>
            <optgroup label="Generic Formats">
              <option value="generic-json">Generic JSON</option>
              <option value="generic-csv">Generic CSV</option>
            </optgroup>
          </select>
        </div>

        <div class="format-info" style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <strong>Format Information:</strong>
          <div id="format-description" style="margin-top: 8px; font-size: 0.9em; color: #666;">
            Select a format to see details
          </div>
        </div>

        <div class="export-options" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px;">
            <input type="checkbox" id="include-metadata" checked>
            Include metadata (timestamps, notes)
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-export-download" style="background: #4CAF50; color: white;">
          📥 Download Export
        </button>
        <button class="btn" id="close-export-modal-footer">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Update format description
  const formatSelect = modal.querySelector('#export-format');
  const formatDescription = modal.querySelector('#format-description');

  const formatDescriptions = {
    'keepass-csv': 'CSV format compatible with KeePass password manager. Fields: Account, Login Name, Password, Web Site, Comments.',
    'bitwarden-json': 'JSON format for Bitwarden. Full-featured with folders, favorites, and timestamps.',
    'lastpass-csv': 'CSV format compatible with LastPass. Fields: url, username, password, extra, name, grouping.',
    '1password-csv': 'CSV format for 1Password. Fields: Title, URL, Username, Password, Notes, Category.',
    'generic-json': 'Universal JSON format with all fields. Can be re-imported to GenPwd Pro.',
    'generic-csv': 'Simple CSV format with basic fields: title, username, password, url, notes.'
  };

  formatSelect.addEventListener('change', () => {
    const format = formatSelect.value;
    formatDescription.textContent = formatDescriptions[format] || 'Select a format to see details';
  });

  // Trigger initial description
  formatSelect.dispatchEvent(new Event('change'));

  // Export button
  modal.querySelector('#btn-export-download').addEventListener('click', () => {
    const format = formatSelect.value;
    const includeMetadata = modal.querySelector('#include-metadata').checked;

    try {
      // Export passwords
      const exported = importExportService.export(passwords, format);
      const formatInfo = importExportService.getFormatInfo(format);

      // Download file
      const filename = `genpwd-export-${new Date().toISOString().slice(0, 10)}${formatInfo.extension}`;
      downloadFile(exported, filename, format.includes('json') ? 'application/json' : 'text/csv');

      showToast(`Exported ${passwords.length} passwords to ${formatInfo.name}`, 'success');
      modal.remove();
    } catch (error) {
      showToast(`Export failed: ${error.message}`, 'error');
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

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📥 Advanced Import</div>
        <button class="modal-close" id="close-import-modal" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 20px; color: #666;">
          Import passwords from popular password managers
        </p>

        <div class="form-group" style="margin-bottom: 20px;">
          <label for="import-format" style="display: block; margin-bottom: 8px; font-weight: 500;">
            Select Import Format:
          </label>
          <select id="import-format" class="input-field" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <optgroup label="Password Managers">
              <option value="keepass-xml">KeePass (XML)</option>
              <option value="keepass-csv">KeePass (CSV)</option>
              <option value="bitwarden-json">Bitwarden (JSON)</option>
              <option value="lastpass-csv">LastPass (CSV)</option>
              <option value="1password-csv">1Password (CSV)</option>
            </optgroup>
            <optgroup label="Generic Formats">
              <option value="generic-json">Generic JSON</option>
              <option value="generic-csv">Generic CSV</option>
            </optgroup>
          </select>
        </div>

        <div class="format-info" style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <strong>Format Information:</strong>
          <div id="import-format-description" style="margin-top: 8px; font-size: 0.9em; color: #666;">
            Select a format to see details
          </div>
        </div>

        <div class="file-upload" style="margin-bottom: 20px;">
          <input type="file" id="import-file-input" accept=".xml,.csv,.json" style="display: none;">
          <button class="btn full-width" id="btn-select-file" style="background: #2196F3; color: white;">
            📁 Select File
          </button>
          <div id="selected-file-name" style="margin-top: 10px; font-size: 0.9em; color: #666;"></div>
        </div>

        <div id="import-preview" style="display: none; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
          <strong>Preview:</strong>
          <div id="import-preview-content" style="margin-top: 10px; font-size: 0.9em;"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btn-import-execute" style="background: #4CAF50; color: white;" disabled>
          ✅ Import Passwords
        </button>
        <button class="btn" id="close-import-modal-footer">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let importedData = null;

  // Update format description
  const formatSelect = modal.querySelector('#import-format');
  const formatDescription = modal.querySelector('#import-format-description');

  const formatDescriptions = {
    'keepass-xml': 'Import from KeePass XML export. Supports full metadata including groups, timestamps, and custom fields.',
    'keepass-csv': 'Import from KeePass CSV export. Basic fields: Account, Login Name, Password, Web Site, Comments.',
    'bitwarden-json': 'Import from Bitwarden JSON export. Full-featured with folders and timestamps.',
    'lastpass-csv': 'Import from LastPass CSV export. Fields: url, username, password, extra, name, grouping.',
    '1password-csv': 'Import from 1Password CSV export. Fields: Title, URL, Username, Password, Notes.',
    'generic-json': 'Import from GenPwd Pro or other generic JSON formats.',
    'generic-csv': 'Import from generic CSV with fields: title, username, password, url, notes.'
  };

  formatSelect.addEventListener('change', () => {
    const format = formatSelect.value;
    formatDescription.textContent = formatDescriptions[format] || 'Select a format to see details';
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

    selectedFileName.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;

    try {
      const content = await file.text();
      const format = formatSelect.value;

      // Import and preview
      importedData = importExportService.import(content, format);

      // Show preview
      importPreview.style.display = 'block';
      importPreviewContent.innerHTML = `
        <div style="margin-bottom: 10px;">
          <strong>Entries found:</strong> ${importedData.length}
        </div>
        <div style="max-height: 200px; overflow-y: auto;">
          ${importedData.slice(0, 5).map((entry, i) => `
            <div style="padding: 8px; margin: 4px 0; background: #f9f9f9; border-radius: 4px;">
              <div style="font-weight: 500;">${escapeHtml(entry.title || `Entry ${i + 1}`)}</div>
              <div style="font-size: 0.85em; color: #666;">
                ${entry.username ? `👤 ${escapeHtml(entry.username)}` : ''}
                ${entry.url ? `🔗 ${escapeHtml(entry.url)}` : ''}
              </div>
            </div>
          `).join('')}
          ${importedData.length > 5 ? `<div style="padding: 8px; text-align: center; color: #999;">... and ${importedData.length - 5} more</div>` : ''}
        </div>
      `;

      importButton.disabled = false;
      showToast(`Found ${importedData.length} password entries`, 'success');
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error');
      safeLog(`Import error: ${error.message}`);
      importPreview.style.display = 'none';
      importButton.disabled = true;
    }
  });

  // Import button
  importButton.addEventListener('click', () => {
    if (!importedData || importedData.length === 0) {
      showToast('No data to import', 'warning');
      return;
    }

    // Display imported passwords in results
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="import-results">
          <h3 style="margin-bottom: 15px;">Imported ${importedData.length} Passwords</h3>
          ${importedData.map((entry, i) => `
            <div class="result-item" style="padding: 12px; margin: 8px 0; background: #f5f5f5; border-radius: 6px; border-left: 4px solid #4CAF50;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; margin-bottom: 5px;">${escapeHtml(entry.title || `Entry ${i + 1}`)}</div>
                  ${entry.username ? `<div style="font-size: 0.9em; color: #666;">👤 ${escapeHtml(entry.username)}</div>` : ''}
                  ${entry.url ? `<div style="font-size: 0.9em; color: #666;">🔗 ${escapeHtml(entry.url)}</div>` : ''}
                  ${entry.notes ? `<div style="font-size: 0.85em; color: #999; margin-top: 5px;">📝 ${escapeHtml(entry.notes.slice(0, 100))}${entry.notes.length > 100 ? '...' : ''}</div>` : ''}
                  <div style="font-family: monospace; background: white; padding: 8px; border-radius: 4px; margin-top: 8px; word-break: break-all;">
                    ${entry.password}
                  </div>
                </div>
                <button class="btn-mini copy-btn" data-password="${entry.password}" style="margin-left: 10px;">
                  📋 Copy
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Bind copy buttons
      resultsDiv.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const password = btn.dataset.password;
          navigator.clipboard.writeText(password);
          showToast('Password copied!', 'success');
        });
      });
    }

    showToast(`Successfully imported ${importedData.length} passwords`, 'success');
    modal.remove();
  });

  // Close buttons
  modal.querySelector('#close-import-modal').addEventListener('click', () => modal.remove());
  modal.querySelector('#close-import-modal-footer').addEventListener('click', () => modal.remove());

  // Show modal
  setTimeout(() => modal.classList.add('show'), ANIMATION_DURATION.MODAL_FADE_IN);
}

/**
 * Initialize all feature UIs
 */
export function initializeAllFeatures() {
  initializeLanguageSelector();
  initializePresetsUI();
  initializeHistoryUI();
  initializePluginsUI();
  initializeAdvancedImportExportUI();
  safeLog('All feature UIs initialized');
}
