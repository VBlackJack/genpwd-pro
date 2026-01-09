/**
 * @fileoverview Field Renderer
 * Pure rendering functions for vault entry fields
 */

import { escapeHtml } from '../utils/formatter.js';
import { renderPasswordStrength } from '../utils/password-display.js';
import { t } from '../../utils/i18n.js';

/**
 * Render a single field in the detail view
 * @param {Object} options - Field options
 * @param {string} options.label - Field label
 * @param {string} options.value - Field value
 * @param {string} [options.key=''] - Field key for styling
 * @param {boolean} [options.masked=false] - Whether to mask the value
 * @param {boolean} [options.copyable=false] - Whether to show copy button
 * @param {boolean} [options.isUrl=false] - Whether to render as link
 * @returns {string} HTML string
 */
export function renderField({ label, value, key = '', masked = false, copyable = false, isUrl = false }) {
  if (!value) return '';

  // Use special password card for password fields
  if (key === 'password') {
    return renderPasswordCard({ label, value });
  }

  // Dynamic masking based on actual value length
  const maskedValue = masked ? '•'.repeat(Math.min(value.length, 24)) : escapeHtml(value);

  return `
    <div class="vault-field" data-key="${key}" data-masked="${masked}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${label}</label>
        ${masked ? `<span class="vault-field-hint">${t('vault.detail.hoverToReveal')}</span>` : ''}
      </div>
      <div class="vault-field-value ${masked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(value)}">
        <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${escapeHtml(value)}">
          ${isUrl ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : maskedValue}
        </span>
        <span class="vault-field-revealed">${escapeHtml(value)}</span>
        <div class="vault-field-actions">
          ${masked ? renderVisibilityToggle() : ''}
          ${copyable ? renderCopyButton(value, label) : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render password field as a styled card (like generator)
 * @param {Object} options - Options
 * @param {string} options.label - Field label
 * @param {string} options.value - Password value
 * @returns {string} HTML string
 */
function renderPasswordCard({ label, value }) {
  const maskedValue = '•'.repeat(Math.min(value.length, 24));
  const strengthHtml = renderPasswordStrength(value, t);

  return `
    <div class="vault-field vault-password-card" data-key="password" data-masked="true">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${label}</label>
        <span class="vault-field-hint">${t('vault.detail.hoverToReveal')}</span>
        <div class="vault-breach-indicator" id="password-breach-indicator"></div>
      </div>
      <div class="vault-password-card-body">
        <div class="vault-password-card-content vault-reveal-on-hover" data-real-value="${escapeHtml(value)}">
          <span class="vault-field-text masked" data-value="${escapeHtml(value)}">${maskedValue}</span>
          <span class="vault-field-revealed">${escapeHtml(value)}</span>
        </div>
        <div class="vault-password-card-actions">
          ${renderVisibilityToggle()}
          ${renderCopyButton(value, label)}
        </div>
      </div>
      ${strengthHtml}
    </div>
  `;
}

/**
 * Render visibility toggle button
 * @returns {string} HTML string
 */
function renderVisibilityToggle() {
  return `
    <button class="vault-field-btn toggle-visibility" title="${t('vault.aria.toggleVisibility')}" aria-label="${t('vault.aria.toggleVisibility')}" aria-pressed="false">
      <svg class="icon-show" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <svg class="icon-hide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    </button>
  `;
}

/**
 * Render copy button
 * @param {string} value - Value to copy
 * @param {string} label - Field label for accessibility
 * @returns {string} HTML string
 */
function renderCopyButton(value, label) {
  return `
    <button class="vault-field-btn copy-field" data-value="${escapeHtml(value)}" title="${t('vault.common.copy')}" aria-label="${t('vault.common.copy')} ${label}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  `;
}

/**
 * Render custom fields display section
 * @param {Object} entry - Entry with custom fields
 * @returns {string} HTML string
 */
export function renderCustomFieldsDisplay(entry) {
  const fields = entry.data?.fields || entry.fields || [];
  if (!fields || fields.length === 0) return '';

  const fieldKindLabels = {
    text: t('vault.fieldKinds.text'),
    hidden: t('vault.fieldKinds.hidden'),
    password: t('vault.fieldKinds.password'),
    url: t('vault.fieldKinds.url'),
    email: t('vault.fieldKinds.email'),
    phone: t('vault.fieldKinds.phone'),
    date: t('vault.fieldKinds.date')
  };

  return `
    <div class="vault-custom-fields-display">
      <div class="vault-section-divider">
        <span class="vault-section-divider-text">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          ${t('vault.labels.customFields')}
        </span>
      </div>
      ${fields.map(field => renderCustomField(field, fieldKindLabels)).join('')}
    </div>
  `;
}

/**
 * Render a single custom field
 * @param {Object} field - Custom field object
 * @param {Object} fieldKindLabels - Labels for field kinds
 * @returns {string} HTML string
 */
function renderCustomField(field, fieldKindLabels) {
  const isMasked = field.isSecured || field.kind === 'hidden' || field.kind === 'password';
  const isUrl = field.kind === 'url';
  const isEmail = field.kind === 'email';
  const isPhone = field.kind === 'phone';
  const isDate = field.kind === 'date';

  // Format value based on type
  let displayValue = escapeHtml(field.value || '');
  if (isUrl && field.value) {
    displayValue = `<a href="${escapeHtml(field.value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(field.value)}</a>`;
  } else if (isEmail && field.value) {
    displayValue = `<a href="mailto:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
  } else if (isPhone && field.value) {
    displayValue = `<a href="tel:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
  } else if (isDate && field.value) {
    try {
      const date = new Date(field.value);
      displayValue = date.toLocaleDateString('en-US');
    } catch {
      displayValue = escapeHtml(field.value);
    }
  }

  const maskedValue = isMasked ? '•'.repeat(Math.min((field.value || '').length, 24)) : displayValue;

  return `
    <div class="vault-field vault-custom-field-display" data-field-id="${escapeHtml(field.id || '')}" data-masked="${isMasked}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${escapeHtml(field.label)}</label>
        ${field.isSecured ? '<span class="vault-field-badge secure">🔒 Secured</span>' : ''}
        <span class="vault-field-kind-badge">${fieldKindLabels[field.kind] || field.kind}</span>
      </div>
      <div class="vault-field-value ${isMasked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(field.value || '')}">
        <span class="vault-field-text ${isMasked ? 'masked' : ''}" data-value="${escapeHtml(field.value || '')}">
          ${isMasked ? maskedValue : displayValue}
        </span>
        <span class="vault-field-revealed">${escapeHtml(field.value || '')}</span>
        <div class="vault-field-actions">
          ${isMasked ? renderVisibilityToggle() : ''}
          <button class="vault-field-btn copy-field" data-value="${escapeHtml(field.value || '')}" title="${t('vault.common.copy')}" aria-label="${t('vault.common.copy')} ${escapeHtml(field.label)}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}
