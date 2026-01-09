/**
 * @fileoverview Import/Export Modal Templates
 * Modal templates for importing and exporting vault data
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Supported import formats
 */
export const IMPORT_FORMATS = [
  { id: 'keepass', name: 'KeePass', icon: '🔐', ext: '.xml' },
  { id: 'bitwarden', name: 'Bitwarden', icon: '🛡️', ext: '.json' },
  { id: 'csv', name: 'Generic CSV', icon: '📊', ext: '.csv' }
];

/**
 * Supported export formats
 */
export const EXPORT_FORMATS = [
  { id: 'json', name: 'JSON (GenPwd)', icon: '📦', descKey: 'vault.exportFormats.jsonDesc' },
  { id: 'bitwarden', name: 'Bitwarden CSV', icon: '🔐', descKey: 'vault.exportFormats.bitwardenDesc' },
  { id: 'lastpass', name: 'LastPass CSV', icon: '🔒', descKey: 'vault.exportFormats.lastpassDesc' },
  { id: '1password', name: '1Password CSV', icon: '🗝️', descKey: 'vault.exportFormats.onepasswordDesc' },
  { id: 'chrome', name: 'Chrome / Edge CSV', icon: '🌐', descKey: 'vault.exportFormats.chromeDesc' },
  { id: 'keepass', name: 'KeePass XML', icon: '🔑', descKey: 'vault.exportFormats.keepassDesc' }
];

/**
 * Render close button
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
function renderCloseBtn(t = (k) => k) {
  return `
    <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
}

/**
 * Render import format cards
 * @returns {string} HTML string
 */
function renderImportFormats() {
  return IMPORT_FORMATS.map(fmt => `
    <div class="vault-format-card">
      <span class="vault-format-icon">${fmt.icon}</span>
      <span class="vault-format-name">${fmt.name}</span>
      <span class="vault-format-ext">${fmt.ext}</span>
    </div>
  `).join('');
}

/**
 * Render import modal
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderImportModal(options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-modal-overlay" id="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div class="vault-modal vault-modal-lg">
        <div class="vault-modal-header">
          <h3 id="import-title">${t('vault.common.import')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <div class="vault-modal-body">
          <div class="vault-import-formats">
            <h4>${t('vault.import.supportedFormats')}</h4>
            <div class="vault-format-cards">
              ${renderImportFormats()}
            </div>
          </div>

          <div class="vault-import-dropzone" id="import-dropzone">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>${t('vault.import.dragOrBrowse').replace('{browse}', `<button type="button" class="vault-btn vault-btn-link" id="btn-import-browse" aria-label="${t('vault.import.browseFiles')}">${t('vault.actions.browse')}</button>`)}</p>
            <input type="file" id="import-file-input" accept=".xml,.json,.csv" hidden>
            <span class="vault-dropzone-hint">${t('vault.import.formatsHint')}</span>
          </div>

          <div class="vault-import-preview" id="import-preview" hidden>
            <div class="vault-import-summary" id="import-summary">
              <!-- Filled dynamically -->
            </div>
            <div class="vault-import-options">
              <label class="vault-checkbox-label">
                <input type="checkbox" id="import-include-groups" checked>
                <span>${t('vault.import.includeFolders')}</span>
              </label>
              <label class="vault-checkbox-label">
                <input type="checkbox" id="import-merge-duplicates">
                <span>${t('vault.import.mergeDuplicates')}</span>
              </label>
            </div>
            <div class="vault-import-warnings" id="import-warnings" hidden>
              <!-- Warnings shown here -->
            </div>
          </div>
        </div>
        <div class="vault-modal-footer">
          <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
          <button type="button" class="vault-btn vault-btn-primary" id="btn-import-confirm" disabled>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            ${t('vault.common.import')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render import summary stats
 * @param {Object} options
 * @param {Object} options.stats - Import statistics
 * @param {string} options.filename - File name
 * @param {number} options.filesize - File size in bytes
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderImportSummary(options = {}) {
  const { stats = {}, filename = '', filesize = 0, t = (k) => k } = options;

  return `
    <div class="vault-import-stats">
      <div class="vault-import-stat">
        <span class="vault-import-stat-value">${stats.importedEntries || 0}</span>
        <span class="vault-import-stat-label">${t('vault.import.entries')}</span>
      </div>
      <div class="vault-import-stat">
        <span class="vault-import-stat-value">${stats.importedGroups || 0}</span>
        <span class="vault-import-stat-label">${t('vault.sidebar.folders')}</span>
      </div>
      <div class="vault-import-stat">
        <span class="vault-import-stat-value">${stats.customFieldsCount || 0}</span>
        <span class="vault-import-stat-label">${t('vault.import.fields')}</span>
      </div>
    </div>
    <div class="vault-import-file-info">
      <span class="vault-import-filename">${escapeHtml(filename)}</span>
      <span class="vault-import-filesize">${(filesize / 1024).toFixed(1)} ${t('vault.import.kb')}</span>
    </div>
  `;
}

/**
 * Render import warnings/errors
 * @param {Object} options
 * @param {Array} options.errors - Error messages
 * @param {Array} options.warnings - Warning messages
 * @returns {string} HTML string
 */
export function renderImportWarnings(options = {}) {
  const { errors = [], warnings = [] } = options;

  if (errors.length === 0 && warnings.length === 0) {
    return '';
  }

  return `
    ${errors.map(e => `<div class="vault-import-error" role="alert"><span aria-hidden="true">❌</span> ${escapeHtml(e)}</div>`).join('')}
    ${warnings.map(w => `<div class="vault-import-warning" role="alert"><span aria-hidden="true">⚠️</span> ${escapeHtml(w)}</div>`).join('')}
  `;
}

/**
 * Render export format modal
 * @param {Object} options
 * @param {number} options.count - Number of entries to export
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderExportModal(options = {}) {
  const { count = 0, t = (k) => k } = options;

  return `
    <div class="vault-modal">
      <div class="vault-modal-header">
        <h3 id="export-format-modal-title">${t('vault.export.title', { count })}</h3>
        ${renderCloseBtn(t)}
      </div>
      <div class="vault-modal-body">
        <p class="vault-modal-hint">${t('vault.export.chooseFormat')}</p>
        <div class="vault-export-formats">
          ${EXPORT_FORMATS.map(fmt => `
            <button class="vault-export-format-btn" data-format="${fmt.id}">
              <span class="vault-export-format-icon">${fmt.icon}</span>
              <span class="vault-export-format-name">${fmt.name}</span>
              <span class="vault-export-format-desc">${t(fmt.descKey)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Create and show export format modal
 * @param {Object} options
 * @param {number} options.count - Number of entries
 * @param {Function} options.onFormatSelected - Callback when format is selected
 * @param {Function} options.onClose - Callback when modal is closed
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} Modal element
 */
export function showExportFormatModal(options = {}) {
  const { count = 0, onFormatSelected, onClose, t = (k) => k } = options;

  // Create modal if not exists
  let modal = document.getElementById('export-format-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'export-format-modal';
    modal.className = 'vault-modal-overlay';
    modal.role = 'dialog';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'export-format-modal-title');
    document.body.appendChild(modal);
  }

  modal.innerHTML = renderExportModal({ count, t });

  // Bind events
  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (onClose) onClose();
  };

  modal.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);

  modal.querySelectorAll('.vault-export-format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      closeModal();
      if (onFormatSelected) onFormatSelected(format);
    });
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  return modal;
}
