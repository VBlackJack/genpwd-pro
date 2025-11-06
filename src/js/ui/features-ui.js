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

/**
 * Initialize language selector in header
 */
export function initializeLanguageSelector() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Create language selector dropdown
  const langSelector = document.createElement('div');
  langSelector.className = 'language-selector';
  langSelector.innerHTML = `
    <button class="lang-btn" id="lang-btn" aria-label="Changer la langue" title="Langue">
      <span class="lang-flag" id="lang-flag">${i18n.getLocaleFlag(i18n.getLocale())}</span>
      <span class="lang-code" id="lang-code">${i18n.getLocale().toUpperCase()}</span>
    </button>
    <div class="lang-dropdown hidden" id="lang-dropdown">
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
    </div>
  `;

  // Insert before the about button
  const aboutBtn = document.querySelector('.about-btn');
  if (aboutBtn) {
    headerRight.insertBefore(langSelector, aboutBtn);
  } else {
    headerRight.appendChild(langSelector);
  }

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

  // Toggle dropdown
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle('hidden');
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
      <strong>💾 Presets</strong>
      <span class="badge">${presetManager.getAllPresets().length}</span>
    </div>
    <div class="section-content">
      <div class="row">
        <button class="btn full-width" id="btn-save-preset">
          💾 Sauvegarder Configuration
        </button>
      </div>
      <div class="row">
        <button class="btn full-width" id="btn-manage-presets">
          🗂️ Gérer les Presets
        </button>
      </div>
      <div class="row">
        <label for="preset-select">Charger un preset</label>
        <select id="preset-select" class="grow">
          <option value="">-- Sélectionner --</option>
        </select>
      </div>
    </div>
  `;

  // Insert at the end of config panel
  configPanel.appendChild(presetsSection);

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
  presetSelect.innerHTML = '<option value="">-- Sélectionner --</option>';

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
 * Show save preset dialog
 */
function showSavePresetDialog() {
  const name = prompt('Nom du preset:');
  if (!name) return;

  const description = prompt('Description (optionnelle):') || '';

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

  try {
    const preset = presetManager.createPreset(name, config, description);
    updatePresetDropdown();
    showToast(`Preset "${name}" saved!`, 'success');
    safeLog(`Preset created: ${preset.id}`);
  } catch (error) {
    showToast('Failed to save preset', 'error');
    safeLog(`Error saving preset: ${error.message}`);
  }
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
        <div class="presets-list">
          ${presets.map(preset => `
            <div class="preset-item" data-preset-id="${preset.id}">
              <div class="preset-info">
                <div class="preset-name">
                  ${preset.name} ${preset.isDefault ? '⭐' : ''}
                </div>
                <div class="preset-desc">${preset.description || 'Aucune description'}</div>
                <div class="preset-meta">
                  Créé: ${new Date(preset.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div class="preset-actions">
                <button class="btn-mini" data-action="load" data-preset-id="${preset.id}">Charger</button>
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
 * Initialize history UI
 */
export function initializeHistoryUI() {
  const resultsPanel = document.querySelector('.results .actions');
  if (!resultsPanel) return;

  // Add history button
  const btnHistory = document.createElement('button');
  btnHistory.className = 'btn';
  btnHistory.id = 'btn-history';
  btnHistory.innerHTML = '📜 Historique';

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
