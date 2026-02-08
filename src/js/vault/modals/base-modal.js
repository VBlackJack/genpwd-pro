/**
 * @fileoverview Base Modal Components
 * Common modal elements and wrappers
 */

import { ICON_CLOSE } from '../views/icons.js';

/**
 * Render modal close button
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderCloseButton({ t = (k) => k } = {}) {
  return `
    <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        ${ICON_CLOSE}
      </svg>
    </button>
  `;
}

/**
 * Render modal wrapper
 * @param {Object} options - Options
 * @param {string} options.id - Modal ID
 * @param {string} options.title - Modal title
 * @param {string} options.titleId - Title element ID for aria-labelledby
 * @param {string} options.content - Modal body content
 * @param {string} options.size - Modal size (sm, md, lg)
 * @param {string} options.role - ARIA role (dialog, alertdialog)
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderModal(options = {}) {
  const {
    id,
    title,
    titleId = `${id}-title`,
    content,
    size = 'md',
    role = 'dialog',
    t = (k) => k
  } = options;

  const sizeClass = size === 'sm' ? 'vault-modal-sm' : size === 'lg' ? 'vault-modal-lg' : '';

  return `
    <div class="vault-modal-overlay" id="${id}" role="${role}" aria-modal="true" aria-labelledby="${titleId}">
      <div class="vault-modal ${sizeClass}">
        <div class="vault-modal-header">
          <h3 id="${titleId}">${title}</h3>
          ${renderCloseButton({ t })}
        </div>
        ${content}
      </div>
    </div>
  `;
}

/**
 * Render modal action buttons (footer)
 * @param {Object} options - Options
 * @param {string} options.cancelText - Cancel button text
 * @param {string} options.submitText - Submit button text
 * @param {string} options.submitClass - Submit button class
 * @param {boolean} options.showDelete - Show delete button
 * @param {string} options.deleteText - Delete button text
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderModalActions(options = {}) {
  const {
    cancelText,
    submitText,
    submitClass = 'vault-btn-primary',
    showDelete = false,
    deleteText = 'Delete',
    t = (k) => k
  } = options;

  const cancel = cancelText || t('vault.common.cancel');
  const submit = submitText || t('vault.common.save');

  if (showDelete) {
    return `
      <div class="vault-modal-actions vault-modal-actions-split">
        <button type="button" class="vault-btn vault-btn-danger" id="btn-delete">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          ${deleteText}
        </button>
        <div class="vault-modal-actions-right">
          <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${cancel}</button>
          <button type="submit" class="vault-btn ${submitClass}">${submit}</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="vault-modal-actions">
      <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${cancel}</button>
      <button type="submit" class="vault-btn ${submitClass}">${submit}</button>
    </div>
  `;
}

/**
 * Render form input group
 * @param {Object} options - Options
 * @param {string} options.id - Input ID
 * @param {string} options.label - Label text
 * @param {string} options.type - Input type
 * @param {string} options.placeholder - Placeholder text
 * @param {string} options.value - Input value
 * @param {boolean} options.required - Is required
 * @param {number} options.maxLength - Max length
 * @param {string} options.message - Validation message
 * @returns {string} HTML string
 */
export function renderFormInput(options = {}) {
  const {
    id,
    label,
    type = 'text',
    placeholder = '',
    value = '',
    required = false,
    maxLength,
    message,
    t = (k) => k
  } = options;

  const requiredLabel = t('vault.forms.required');

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${id}">
        ${label}${required ? ` <span class="required" aria-label="${requiredLabel}">*</span>` : ''}
      </label>
      <input type="${type}" class="vault-input" id="${id}"
             placeholder="${placeholder}"
             value="${value}"
             ${required ? 'required aria-required="true"' : ''}
             ${maxLength ? `maxlength="${maxLength}"` : ''}
             aria-invalid="false"
             ${message ? `aria-describedby="${id}-message"` : ''}>
      ${message ? `<div class="vault-field-message" id="${id}-message" role="alert" aria-live="polite"></div>` : ''}
    </div>
  `;
}

/**
 * Render form select group
 * @param {Object} options - Options
 * @param {string} options.id - Select ID
 * @param {string} options.label - Label text
 * @param {Array} options.options - Select options [{value, label, selected}]
 * @param {string} options.emptyLabel - Empty option label
 * @returns {string} HTML string
 */
export function renderFormSelect(options = {}) {
  const {
    id,
    label,
    options: selectOptions = [],
    emptyLabel = ''
  } = options;

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${id}">${label}</label>
      <select class="vault-input vault-select" id="${id}">
        ${emptyLabel ? `<option value="">${emptyLabel}</option>` : ''}
        ${selectOptions.map(opt => `
          <option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.label}</option>
        `).join('')}
      </select>
    </div>
  `;
}

/**
 * Color palette for tags
 */
export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
];

/**
 * Render color picker grid
 * @param {Object} options - Options
 * @param {string} options.id - Container ID
 * @param {string} options.selectedColor - Currently selected color
 * @param {string} options.inputId - Hidden input ID
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderColorPicker(options = {}) {
  const {
    id,
    selectedColor = TAG_COLORS[0],
    inputId = 'color',
    t = (k) => k
  } = options;

  return `
    <div class="vault-color-grid" id="${id}">
      ${TAG_COLORS.map(color => `
        <button type="button" class="vault-color-option ${color === selectedColor ? 'selected' : ''}"
                data-color="${color}" aria-label="${t('vault.labels.selectColor')} ${color}" style="background-color: ${color}">
          ${color === selectedColor ? '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </button>
      `).join('')}
    </div>
    <input type="hidden" id="${inputId}" value="${selectedColor}">
  `;
}
