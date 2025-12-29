/**
 * @fileoverview Custom Fields Module
 * Templates and helpers for custom field management in entry forms
 */

import { escapeHtml } from '../utils/formatter.js';
import { FIELD_KIND_OPTIONS, getFieldKindLabel } from './form-fields.js';

/**
 * Render the custom fields section header and container
 * @param {Object} options
 * @param {Array} options.existingFields - Existing custom fields
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderCustomFieldsSection(options = {}) {
  const { existingFields = [], t = (k) => k } = options;

  const existingFieldsHtml = existingFields.map((field, index) =>
    renderCustomField({ field, index, t })
  ).join('');

  return `
    <div class="vault-custom-fields-section">
      <div class="vault-section-header">
        <h4 class="vault-section-title">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          ${t('vault.labels.customFields')}
        </h4>
        <button type="button" class="vault-btn vault-btn-sm vault-btn-ghost" id="btn-add-custom-field">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          ${t('vault.labels.addField')}
        </button>
      </div>
      <div id="custom-fields-container">
        ${existingFieldsHtml}
      </div>
    </div>
  `;
}

/**
 * Render a single custom field
 * @param {Object} options
 * @param {Object} options.field - Field data (or empty for new field)
 * @param {number} options.index - Field index
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderCustomField(options = {}) {
  const { field = {}, index = 0, t = (k) => k } = options;

  const shouldMask = field.kind === 'password' || field.kind === 'hidden' || field.isSecured;
  const inputType = shouldMask ? 'password' : 'text';

  return `
    <div class="vault-custom-field" data-field-index="${index}" data-field-id="${escapeHtml(field.id || '')}">
      <div class="vault-custom-field-header">
        <input type="text" class="vault-input vault-custom-field-label"
               placeholder="${t('vault.placeholders.fieldName')}"
               value="${escapeHtml(field.label || '')}"
               aria-label="${t('vault.placeholders.fieldName')}">
        <select class="vault-input vault-custom-field-kind" aria-label="${t('vault.labels.fieldType')}">
          ${FIELD_KIND_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${field.kind === opt.value ? 'selected' : ''}>${getFieldKindLabel(opt, t)}</option>`
          ).join('')}
        </select>
        <label class="vault-checkbox-inline vault-custom-field-secured">
          <input type="checkbox" ${field.isSecured ? 'checked' : ''}>
          <span>${t('vault.labels.secure')}</span>
        </label>
        <button type="button" class="vault-icon-btn danger vault-remove-field-btn" title="${t('vault.common.delete')}" aria-label="${t('vault.aria.deleteField')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-input-group">
        <input type="${inputType}"
               class="vault-input vault-custom-field-value"
               placeholder="${t('vault.placeholders.fieldValue')}"
               value="${escapeHtml(field.value || '')}"
               aria-label="${t('vault.placeholders.fieldValue')}">
        ${shouldMask ? `
          <button type="button" class="vault-input-btn toggle-pwd-visibility" aria-label="${t('vault.aria.toggleVisibility')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Create a new empty custom field element
 * @param {number} index - Field index
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function createCustomFieldElement(index, t = (k) => k) {
  return renderCustomField({ field: {}, index, t });
}

/**
 * Collect custom fields data from the DOM
 * @returns {Array} Array of field objects
 */
export function collectCustomFieldsData() {
  const container = document.getElementById('custom-fields-container');
  if (!container) return [];

  const fields = [];
  container.querySelectorAll('.vault-custom-field').forEach((fieldEl) => {
    const label = fieldEl.querySelector('.vault-custom-field-label')?.value?.trim();
    const value = fieldEl.querySelector('.vault-custom-field-value')?.value || '';
    const kind = fieldEl.querySelector('.vault-custom-field-kind')?.value || 'text';
    const isSecured = fieldEl.querySelector('.vault-custom-field-secured input')?.checked || false;
    const id = fieldEl.dataset.fieldId || crypto.randomUUID();

    if (label) {
      fields.push({ id, label, value, kind, isSecured });
    }
  });

  return fields;
}

/**
 * Create custom fields event attachment helper
 * Returns a function that can be called to attach events
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @param {Function} options.onFieldAdded - Callback when field is added
 * @returns {Function} Attach events function
 */
export function createCustomFieldsController(options = {}) {
  const { t = (k) => k, onFieldAdded } = options;

  return function attachCustomFieldsEvents() {
    const addBtn = document.getElementById('btn-add-custom-field');
    const container = document.getElementById('custom-fields-container');

    if (!addBtn || !container) return;

    // Add new field button
    addBtn.addEventListener('click', () => {
      const fieldCount = container.querySelectorAll('.vault-custom-field').length;
      const newField = document.createElement('div');
      newField.innerHTML = createCustomFieldElement(fieldCount, t);
      const fieldEl = newField.firstElementChild;
      container.appendChild(fieldEl);

      // Attach events to the new field
      attachSingleFieldEvents(fieldEl, t);

      // Focus the label input
      fieldEl.querySelector('.vault-custom-field-label')?.focus();

      // Callback
      if (onFieldAdded) onFieldAdded(fieldEl);
    });

    // Attach events to existing fields
    container.querySelectorAll('.vault-custom-field').forEach(fieldEl => {
      attachSingleFieldEvents(fieldEl, t);
    });
  };
}

/**
 * Attach events to a single custom field element
 * @param {HTMLElement} fieldEl - Field element
 * @param {Function} t - Translation function
 */
function attachSingleFieldEvents(fieldEl, t = (k) => k) {
  // Remove field button
  fieldEl.querySelector('.vault-remove-field-btn')?.addEventListener('click', () => {
    fieldEl.remove();
  });

  // Kind selector - update input type when kind changes
  const kindSelect = fieldEl.querySelector('.vault-custom-field-kind');
  const valueInput = fieldEl.querySelector('.vault-custom-field-value');
  const securedCheckbox = fieldEl.querySelector('.vault-custom-field-secured input');

  const updateInputType = () => {
    const kind = kindSelect?.value;
    const isSecured = securedCheckbox?.checked;
    const shouldMask = kind === 'password' || kind === 'hidden' || isSecured;

    if (valueInput) {
      valueInput.type = shouldMask ? 'password' : 'text';

      // Add/remove toggle button
      const inputGroup = valueInput.closest('.vault-input-group');
      let toggleBtn = inputGroup?.querySelector('.toggle-pwd-visibility');

      if (shouldMask && !toggleBtn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vault-input-btn toggle-pwd-visibility';
        btn.setAttribute('aria-label', t('vault.aria.toggleVisibility'));
        btn.innerHTML = `
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        btn.addEventListener('click', () => {
          valueInput.type = valueInput.type === 'password' ? 'text' : 'password';
        });
        inputGroup.appendChild(btn);
      } else if (!shouldMask && toggleBtn) {
        toggleBtn.remove();
      }
    }
  };

  kindSelect?.addEventListener('change', updateInputType);
  securedCheckbox?.addEventListener('change', updateInputType);

  // Existing toggle visibility buttons
  fieldEl.querySelector('.toggle-pwd-visibility')?.addEventListener('click', function() {
    if (valueInput) {
      valueInput.type = valueInput.type === 'password' ? 'text' : 'password';
    }
  });
}
