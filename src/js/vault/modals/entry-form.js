/**
 * @fileoverview Entry Form Modal Templates
 * Add and Edit entry modal templates
 */

import { escapeHtml } from '../utils/formatter.js';
import { renderTypeFields } from './form-fields.js';
import { renderCustomFieldsSection } from './custom-fields.js';
import { t } from '../../utils/i18n.js';

/**
 * Entry type definitions
 */
export const ENTRY_TYPE_DEFS = {
  login: { icon: '🔑', color: 'var(--vault-type-login)' },
  note: { icon: '📝', color: 'var(--vault-type-note)' },
  card: { icon: '💳', color: 'var(--vault-type-card)' },
  identity: { icon: '👤', color: 'var(--vault-type-identity)' }
};

/**
 * Render entry type selector
 * @param {Object} options
 * @param {Object} options.entryTypes - Entry type definitions with labels
 * @param {string} options.selectedType - Currently selected type
 * @returns {string} HTML string
 */
export function renderTypeSelector(options = {}) {
  const { entryTypes = {}, selectedType = 'login' } = options;

  // Filter out preset and ssh types
  const types = Object.entries(entryTypes)
    .filter(([k]) => k !== 'preset' && k !== 'ssh');

  return `
    <div class="vault-type-selector" role="radiogroup" aria-label="${t('vault.aria.entryType')}">
      ${types.map(([key, type]) => `
        <label class="vault-type-option">
          <input type="radio" name="entry-type" value="${key}" ${key === selectedType ? 'checked' : ''}>
          <span class="vault-type-card" data-type-color="${type.color}">
            <span class="vault-type-icon">${type.icon}</span>
            <span class="vault-type-label">${type.label}</span>
          </span>
        </label>
      `).join('')}
    </div>
  `;
}

/**
 * Render tag picker for entry form
 * @param {Object} options
 * @param {Array} options.tags - All available tags
 * @param {Array} options.selectedTagIds - Currently selected tag IDs
 * @returns {string} HTML string
 */
export function renderTagPicker(options = {}) {
  const { tags = [], selectedTagIds = [] } = options;

  if (tags.length === 0) {
    return `<div class="vault-tag-picker-empty">${t('vault.messages.noTags')}</div>`;
  }

  return `
    <div class="vault-tag-picker" id="entry-tag-picker">
      ${tags.map(tag => `
        <label class="vault-tag-option">
          <input type="checkbox" name="entry-tags" value="${tag.id}"
                 ${selectedTagIds.includes(tag.id) ? 'checked' : ''}>
          <span class="vault-tag-chip" style="--tag-color: ${tag.color || 'var(--vault-text-muted)'}">
            ${escapeHtml(tag.name)}
          </span>
        </label>
      `).join('')}
    </div>
  `;
}

/**
 * Render folder selector
 * @param {Object} options
 * @param {Array} options.folders - Available folders
 * @param {string} options.selectedFolderId - Currently selected folder ID
 * @param {string} options.id - Input ID
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderFolderSelector(options = {}) {
  const { folders = [], selectedFolderId = '', id = 'entry-folder', t = (k) => k } = options;

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${id}">${t('vault.labels.folder')}</label>
      <select class="vault-input vault-select" id="${id}">
        <option value="">${t('vault.labels.noFolder')}</option>
        ${folders.map(f => `
          <option value="${f.id}" ${f.id === selectedFolderId ? 'selected' : ''}>
            ${escapeHtml(f.name)}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}

/**
 * Render close button for modal
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
 * Render add entry modal
 * @param {Object} options
 * @param {Object} options.entryTypes - Entry type definitions
 * @param {Array} options.folders - Available folders
 * @param {Array} options.tags - Available tags
 * @param {string} options.templateGridHtml - Pre-rendered template grid
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderAddEntryModal(options = {}) {
  const {
    entryTypes = {},
    folders = [],
    tags = [],
    templateGridHtml = '',
    t = (k) => k
  } = options;

  return `
    <div class="vault-modal-overlay" id="add-entry-modal" role="dialog" aria-modal="true" aria-labelledby="add-entry-title">
      <div class="vault-modal vault-modal-lg">
        <div class="vault-modal-header">
          <h3 id="add-entry-title">${t('vault.dialogs.newEntry')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <form class="vault-modal-body" id="add-entry-form">
          <!-- Template Selector -->
          <div class="vault-template-section">
            <button type="button" class="vault-template-toggle" id="toggle-templates" aria-expanded="false">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              ${t('vault.labels.useTemplate')}
              <svg class="vault-template-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="vault-template-picker" id="template-picker" hidden>
              <input type="text" class="vault-input vault-template-search" id="template-search" placeholder="${t('vault.placeholders.searchTemplate')}">
              <div class="vault-template-grid" id="template-grid">
                ${templateGridHtml}
              </div>
            </div>
          </div>

          ${renderTypeSelector({ entryTypes, selectedType: 'login' })}

          <div class="vault-form-group">
            <label class="vault-label" for="entry-title">${t('vault.labels.title')} <span class="required" aria-label="${t('vault.aria.required')}">*</span></label>
            <input type="text" class="vault-input" id="entry-title"
                   placeholder="${t('vault.placeholders.entryTitleExample')}"
                   required aria-required="true" aria-describedby="entry-title-message" aria-invalid="false">
            <div class="vault-field-message" id="entry-title-message" role="alert" aria-live="polite"></div>
          </div>

          ${renderFolderSelector({ folders, id: 'entry-folder', t })}

          <div class="vault-form-group">
            <label class="vault-label">${t('vault.labels.tags')}</label>
            ${renderTagPicker({ tags, selectedTagIds: [], t })}
          </div>

          <div id="entry-type-fields"></div>

          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="submit" class="vault-btn vault-btn-primary">${t('vault.common.add')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Render edit entry modal (shell - content populated dynamically)
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEditEntryModal(options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-modal-overlay" id="edit-entry-modal" role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
      <div class="vault-modal vault-modal-lg">
        <div class="vault-modal-header">
          <h3 id="edit-entry-title">${t('vault.dialogs.editEntry')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <form class="vault-modal-body" id="edit-entry-form">
          <div id="edit-entry-fields"></div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="submit" class="vault-btn vault-btn-primary">${t('vault.common.save')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Render edit entry form content
 * @param {Object} options
 * @param {Object} options.entry - Entry to edit
 * @param {Array} options.folders - Available folders
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEditEntryContent(options = {}) {
  const { entry = {}, folders = [], t = (k) => k } = options;

  const titleField = `
    <div class="vault-form-group">
      <label class="vault-label" for="edit-title">${t('vault.labels.title')} <span class="required" aria-label="${t('vault.aria.required')}">*</span></label>
      <input type="text" class="vault-input" id="edit-title"
             value="${escapeHtml(entry.title)}"
             required aria-required="true" aria-describedby="edit-title-message" aria-invalid="false">
      <div class="vault-field-message" id="edit-title-message" role="alert" aria-live="polite"></div>
    </div>
  `;

  const folderField = renderFolderSelector({
    folders,
    selectedFolderId: entry.folderId || '',
    id: 'edit-folder',
    t
  });

  const typeFields = renderTypeFields(entry.type, {
    data: { ...entry.data, notes: entry.notes },
    isEdit: true,
    t
  });

  const existingFields = entry.data?.fields || entry.fields || [];
  const customFieldsSection = renderCustomFieldsSection({
    existingFields,
    t
  });

  return titleField + folderField + typeFields + customFieldsSection;
}

/**
 * Collect entry form data from the DOM
 * @param {string} formId - Form element ID
 * @param {string} type - Entry type
 * @returns {Object} Entry data object
 */
export function collectEntryFormData(formId, type) {
  const isEdit = formId === 'edit-entry-form';
  const prefix = isEdit ? 'edit' : 'entry';

  const data = {
    title: document.getElementById(`${prefix}-title`)?.value?.trim() || '',
    folderId: document.getElementById(`${prefix}-folder`)?.value || null,
    type
  };

  // Collect type-specific data
  switch (type) {
    case 'login':
      data.data = {
        username: document.getElementById(`${prefix}-username`)?.value?.trim() || '',
        password: document.getElementById(`${prefix}-password`)?.value || '',
        url: document.getElementById(`${prefix}-url`)?.value?.trim() || '',
        totp: document.getElementById(`${prefix}-totp`)?.value?.trim() || '',
        expiresAt: document.getElementById(`${prefix}-expires`)?.value || null
      };
      data.notes = document.getElementById(`${prefix}-notes`)?.value?.trim() || '';
      break;

    case 'note':
      data.data = {
        content: document.getElementById(`${prefix}-content`)?.value || ''
      };
      break;

    case 'card':
      data.data = {
        holder: document.getElementById(`${prefix}-holder`)?.value?.trim() || '',
        number: document.getElementById(`${prefix}-cardnumber`)?.value?.trim() || '',
        expiry: document.getElementById(`${prefix}-expiry`)?.value?.trim() || '',
        cvv: document.getElementById(`${prefix}-cvv`)?.value || ''
      };
      break;

    case 'identity':
      data.data = {
        fullName: document.getElementById(`${prefix}-fullname`)?.value?.trim() || '',
        email: document.getElementById(`${prefix}-email`)?.value?.trim() || '',
        phone: document.getElementById(`${prefix}-phone`)?.value?.trim() || ''
      };
      break;
  }

  // Collect tags (add form only)
  if (!isEdit) {
    const selectedTags = [];
    document.querySelectorAll('input[name="entry-tags"]:checked').forEach(cb => {
      selectedTags.push(cb.value);
    });
    data.tagIds = selectedTags;
  }

  return data;
}
