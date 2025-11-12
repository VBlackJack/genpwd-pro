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
import { showToast } from '../utils/toast.js';
import { safeLog } from '../utils/logger.js';
import { escapeHtml } from '../utils/helpers.js';

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
  setTimeout(() => modal.classList.add('show'), 10);
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
  setTimeout(() => modal.classList.add('show'), 10);
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
 * Initialize all feature UIs
 */
export function initializeAllFeatures() {
  initializeLanguageSelector();
  initializePresetsUI();
  initializeHistoryUI();
  safeLog('All feature UIs initialized');
}
