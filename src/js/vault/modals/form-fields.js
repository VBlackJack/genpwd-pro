/**
 * @fileoverview Entry Form Field Templates
 * Type-specific field templates for add/edit entry forms
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Field type options for custom fields
 * Uses labelKey for i18n support
 */
export const FIELD_KIND_OPTIONS = [
  { value: 'text', labelKey: 'vault.fieldKinds.text' },
  { value: 'hidden', labelKey: 'vault.fieldKinds.hidden' },
  { value: 'password', labelKey: 'vault.fieldKinds.password' },
  { value: 'url', labelKey: 'vault.fieldKinds.url' },
  { value: 'email', labelKey: 'vault.fieldKinds.email' },
  { value: 'phone', labelKey: 'vault.fieldKinds.phone' },
  { value: 'date', labelKey: 'vault.fieldKinds.date' }
];

/**
 * Get translated label for field kind
 * @param {Object} option - Field kind option
 * @param {Function} t - Translation function
 * @returns {string} Translated label
 */
export function getFieldKindLabel(option, t) {
  return t ? t(option.labelKey) || option.value : option.value;
}

/**
 * Render password input group with visibility toggle and generator
 * @param {Object} options
 * @param {string} options.id - Input ID
 * @param {string} options.value - Current value
 * @param {string} options.placeholder - Input placeholder
 * @param {boolean} options.showGenerator - Show generator button
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderPasswordField(options = {}) {
  const {
    id = 'password',
    value = '',
    placeholder = '••••••••',
    showGenerator = true,
    t = (k) => k
  } = options;

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${id}">${t('vault.labels.password')}</label>
      <div class="vault-input-group">
        <input type="password" class="vault-input" id="${id}"
               value="${escapeHtml(value)}" placeholder="${placeholder}" autocomplete="new-password">
        <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="${id}" aria-label="${t('vault.aria.show')}"
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        ${showGenerator ? `
          <button type="button" class="vault-input-btn" id="${id}-generate" data-tooltip="${t('vault.actions.generate')}" aria-label="${t('vault.aria.generatePassword')}"
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </button>
        ` : ''}
      </div>
      <div class="vault-password-strength" id="${id}-strength"></div>
    </div>
  `;
}

/**
 * Render expiry picker (preset dropdown + custom date)
 * @param {Object} options
 * @param {string} options.idPrefix - ID prefix for elements
 * @param {string} options.currentValue - Current expiry date (ISO string)
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderExpiryPicker(options = {}) {
  const {
    idPrefix = 'entry',
    currentValue = '',
    t: _t = (k) => k
  } = options;

  const hasCustomDate = !!currentValue;

  // Get translation function with fallback
  const t = _t || ((k) => k);

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${idPrefix}-expires">${t('vault.labels.passwordExpiration')}</label>
      <div class="vault-expiry-picker">
        <select class="vault-input vault-select" id="${idPrefix}-expires-preset">
          <option value="">${t('vault.expiry.never')}</option>
          <option value="30">${t('vault.expiry.30days')}</option>
          <option value="60">${t('vault.expiry.60days')}</option>
          <option value="90">${t('vault.expiry.90days')}</option>
          <option value="180">${t('vault.expiry.6months')}</option>
          <option value="365">${t('vault.expiry.1year')}</option>
          <option value="custom" ${hasCustomDate ? 'selected' : ''}>${t('vault.expiry.custom')}</option>
        </select>
        <input type="date" class="vault-input" id="${idPrefix}-expires"
               value="${currentValue}" ${hasCustomDate ? '' : 'hidden'}>
      </div>
      <span class="vault-field-hint">${t('vault.hints.expiryReminder')}</span>
    </div>
  `;
}

/**
 * Render login type fields
 * @param {Object} options
 * @param {Object} options.data - Entry data
 * @param {boolean} options.isEdit - Edit mode
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderLoginFields(options = {}) {
  const { data = {}, isEdit = false, t = (k) => k } = options;
  const prefix = isEdit ? 'edit' : 'entry';

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-username">${t('vault.labels.usernameEmail')}</label>
      ${isEdit ? `
        <input type="text" class="vault-input" id="${prefix}-username" value="${escapeHtml(data.username || '')}">
      ` : `
        <div class="input-with-action">
          <input type="text" class="vault-input" id="${prefix}-username" placeholder="${t('vault.form.userPlaceholder')}" autocomplete="username">
          <button type="button" class="vault-btn-icon" id="btn-create-alias" title="${t('vault.actions.generateAlias')}">
            <span class="icon">🕵️</span>
          </button>
        </div>
      `}
    </div>
    ${renderPasswordField({
      id: `${prefix}-password`,
      value: data.password || '',
      showGenerator: true,
      t
    })}
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-url">${t('vault.labels.url')}</label>
      <input type="url" class="vault-input" id="${prefix}-url"
             value="${escapeHtml(data.url || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.urlExample')}"
             aria-describedby="${prefix}-url-message">
      <div class="vault-field-message" id="${prefix}-url-message" role="alert" aria-live="polite"></div>
    </div>
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-totp">${t('vault.labels.totpKey')}</label>
      <div class="vault-input-group">
        <input type="text" class="vault-input mono" id="${prefix}-totp"
               value="${escapeHtml(data.totp || '')}"
               placeholder="${t('vault.placeholders.totpKeyExample')}" autocomplete="off" spellcheck="false">
        ${isEdit ? `
          <button type="button" class="vault-input-btn" id="${prefix}-scan-totp" data-tooltip="${t('vault.actions.scanQR')}" aria-label="${t('vault.aria.scanQROrPaste')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        ` : ''}
      </div>
      <span class="vault-field-hint">${isEdit ? t('vault.hints.totpSecretEdit') : t('vault.hints.totpSecretAdd')}</span>
    </div>
    ${renderExpiryPicker({
      idPrefix: prefix,
      currentValue: data.expiresAt || '',
      t
    })}
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-notes">${t('vault.labels.notes')}</label>
      <textarea class="vault-input vault-textarea" id="${prefix}-notes" rows="${isEdit ? 3 : 2}"
                placeholder="${isEdit ? '' : t('vault.form.optionalNotes')}">${escapeHtml(data.notes || '')}</textarea>
    </div>
  `;
}

/**
 * Render note type fields
 * @param {Object} options
 * @param {Object} options.data - Entry data
 * @param {boolean} options.isEdit - Edit mode
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderNoteFields(options = {}) {
  const { data = {}, isEdit = false, t = (k) => k } = options;
  const prefix = isEdit ? 'edit' : 'entry';

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-content">${t('vault.labels.content')} ${isEdit ? '' : '<span class="required">*</span>'}</label>
      <textarea class="vault-input vault-textarea" id="${prefix}-content" rows="8"
                placeholder="${isEdit ? '' : t('vault.form.secureNote')}"
                ${isEdit ? '' : 'required'}>${escapeHtml(data.content || '')}</textarea>
    </div>
  `;
}

/**
 * Render card type fields
 * @param {Object} options
 * @param {Object} options.data - Entry data
 * @param {boolean} options.isEdit - Edit mode
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderCardFields(options = {}) {
  const { data = {}, isEdit = false, t = (k) => k } = options;
  const prefix = isEdit ? 'edit' : 'entry';

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-holder">${t('vault.labels.cardHolder')}</label>
      <input type="text" class="vault-input" id="${prefix}-holder"
             value="${escapeHtml(data.holder || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.holderExample')}" autocomplete="cc-name">
    </div>
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-cardnumber">${t('vault.labels.cardNumber')}</label>
      <input type="text" class="vault-input" id="${prefix}-cardnumber"
             value="${escapeHtml(data.number || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.cardNumberExample')}" autocomplete="cc-number">
    </div>
    <div class="vault-form-row">
      <div class="vault-form-group">
        <label class="vault-label" for="${prefix}-expiry">${t('vault.labels.expiration')}</label>
        <input type="text" class="vault-input" id="${prefix}-expiry"
               value="${escapeHtml(data.expiry || '')}"
               placeholder="${t('vault.placeholders.expiryFormat')}" autocomplete="cc-exp">
      </div>
      <div class="vault-form-group">
        <label class="vault-label" for="${prefix}-cvv">CVV</label>
        <input type="password" class="vault-input" id="${prefix}-cvv"
               value="${escapeHtml(data.cvv || '')}"
               placeholder="${isEdit ? '' : t('vault.placeholders.cvvExample')}" maxlength="4" autocomplete="cc-csc">
      </div>
    </div>
  `;
}

/**
 * Render identity type fields
 * @param {Object} options
 * @param {Object} options.data - Entry data
 * @param {boolean} options.isEdit - Edit mode
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderIdentityFields(options = {}) {
  const { data = {}, isEdit = false, t = (k) => k } = options;
  const prefix = isEdit ? 'edit' : 'entry';

  return `
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-fullname">${t('vault.labels.fullName')}</label>
      <input type="text" class="vault-input" id="${prefix}-fullname"
             value="${escapeHtml(data.fullName || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.fullNameExample')}" autocomplete="name">
    </div>
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-email">${t('vault.labels.email')}</label>
      <input type="email" class="vault-input" id="${prefix}-email"
             value="${escapeHtml(data.email || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.emailExample')}"
             autocomplete="email" aria-describedby="${prefix}-email-message">
      <div class="vault-field-message" id="${prefix}-email-message" role="alert" aria-live="polite"></div>
    </div>
    <div class="vault-form-group">
      <label class="vault-label" for="${prefix}-phone">${t('vault.labels.phone')}</label>
      <input type="tel" class="vault-input" id="${prefix}-phone"
             value="${escapeHtml(data.phone || '')}"
             placeholder="${isEdit ? '' : t('vault.placeholders.phoneExample')}" autocomplete="tel">
    </div>
  `;
}

/**
 * Render fields for a given entry type
 * @param {string} type - Entry type (login, note, card, identity)
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
export function renderTypeFields(type, options = {}) {
  switch (type) {
    case 'login':
      return renderLoginFields(options);
    case 'note':
      return renderNoteFields(options);
    case 'card':
      return renderCardFields(options);
    case 'identity':
      return renderIdentityFields(options);
    default:
      return '';
  }
}
