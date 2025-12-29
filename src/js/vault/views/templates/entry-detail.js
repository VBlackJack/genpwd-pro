/**
 * @fileoverview Entry Detail Templates
 * HTML templates for vault entry detail panel
 */

import { ENTRY_TYPES, getTypeLabel } from './entry-list.js';
import { escapeHtml, formatDateTime } from '../../utils/formatter.js';
import { renderFaviconImg } from '../../utils/favicon-manager.js';

/**
 * Render tags in detail view
 * @param {Object} entry - Entry object
 * @param {Array} allTags - All available tags
 * @returns {string} HTML string
 */
function renderTagsInDetail(entry, allTags = []) {
  if (!entry.tags || entry.tags.length === 0) return '';

  const tags = entry.tags
    .map(tagId => allTags.find(t => t.id === tagId))
    .filter(Boolean);

  if (tags.length === 0) return '';

  return tags.map(tag => `
    <span class="vault-detail-tag" style="--tag-color: ${tag.color || '#6b7280'}">
      ${escapeHtml(tag.name)}
    </span>
  `).join('');
}

/**
 * Render entry detail header
 * @param {Object} entry - Entry data
 * @param {Object} options - Options
 * @param {Array} options.allTags - All available tags
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderDetailHeader(entry, options = {}) {
  const { allTags = [], t = (k) => k } = options;
  const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;

  return `
    <div class="vault-detail-header">
      <div class="vault-detail-icon" data-type-color="${type.color}" aria-hidden="true">
        ${entry.data?.url ? renderFaviconImg(entry.data.url, 32) : type.icon}
      </div>
      <div class="vault-detail-info">
        <h3 class="vault-detail-title">${escapeHtml(entry.title)}</h3>
        <span class="vault-detail-type">${getTypeLabel(type, t)}</span>
        <div class="vault-detail-tags">${renderTagsInDetail(entry, allTags)}</div>
      </div>
      <div class="vault-detail-actions" role="group" aria-label="${t('vault.aria.entryActions')}">
        <button class="vault-icon-btn ${entry.favorite ? 'active' : ''}" id="btn-toggle-favorite"
                data-tooltip="${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-label="${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-pressed="${entry.favorite}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="${entry.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button class="vault-icon-btn" id="btn-edit-entry" data-tooltip="${t('vault.common.edit')} (E)" aria-label="${t('vault.dialogs.editEntry')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="vault-icon-btn" id="btn-duplicate-entry" data-tooltip="${t('vault.common.duplicate')}" aria-label="${t('vault.common.duplicate')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        ${entry.type === 'login' ? `
        <button class="vault-icon-btn autotype" id="btn-autotype" data-tooltip="${t('vault.actions.autoFill')} (Ctrl+Shift+U)" aria-label="${t('vault.actions.autoFill')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
            <line x1="6" y1="8" x2="6" y2="8"></line>
            <line x1="10" y1="8" x2="18" y2="8"></line>
            <line x1="6" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="16" x2="14" y2="16"></line>
          </svg>
        </button>
        ` : ''}
        <button class="vault-icon-btn share" id="btn-share-entry" data-tooltip="${t('vault.share.title')}" aria-label="${t('vault.share.title')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>
        <button class="vault-icon-btn danger" id="btn-delete-entry" data-tooltip="${t('vault.common.delete')}" data-tooltip-pos="left" aria-label="${t('vault.common.delete')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render a single field in detail view
 * @param {string} label - Field label
 * @param {string} value - Field value
 * @param {Object} options - Options
 * @param {string} options.type - Field type (text, password, url, email, phone)
 * @param {boolean} options.masked - Show masked by default
 * @param {boolean} options.copyable - Show copy button
 * @returns {string} HTML string
 */
export function renderField(label, value, options = {}) {
  if (!value) return '';

  const { type = 'text', masked = false, copyable = false } = options;
  const isUrl = type === 'url';
  const maskedValue = masked ? '•'.repeat(Math.min(value.length, 24)) : escapeHtml(value);

  let displayValue = escapeHtml(value);
  if (isUrl) {
    displayValue = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
  }

  return `
    <div class="vault-field" data-field-type="${type}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${escapeHtml(label)}</label>
      </div>
      <div class="vault-field-value ${masked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(value)}">
        <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${escapeHtml(value)}">
          ${masked ? maskedValue : displayValue}
        </span>
        ${masked ? `<span class="vault-field-revealed">${displayValue}</span>` : ''}
        ${copyable ? `
          <div class="vault-field-actions">
            ${masked ? `
              <button class="vault-field-btn toggle-reveal" title="${options.t?.('vault.aria.toggleVisibility')}" aria-label="${options.t?.('vault.aria.toggleVisibility')}">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            ` : ''}
            <button class="vault-field-btn copy-field" data-value="${escapeHtml(value)}" title="${options.t?.('vault.common.copy')}" aria-label="${options.t?.('vault.common.copy')} ${escapeHtml(label)}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render entry metadata (created, modified, last used)
 * @param {Object} entry - Entry data
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEntryMeta(entry, options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-detail-meta">
      <div class="vault-meta-row">
        <div class="vault-meta-item">
          <span class="vault-meta-label">${t('vault.detail.created')}</span>
          <span class="vault-meta-value">${formatDateTime(entry.createdAt || entry.metadata?.createdAt)}</span>
        </div>
        <div class="vault-meta-item">
          <span class="vault-meta-label">${t('vault.detail.modified')}</span>
          <span class="vault-meta-value">${formatDateTime(entry.modifiedAt || entry.metadata?.updatedAt)}</span>
        </div>
      </div>
      ${entry.metadata?.lastUsedAt ? `
        <div class="vault-meta-row">
          <div class="vault-meta-item">
            <span class="vault-meta-label">${t('vault.detail.lastUsed')}</span>
            <span class="vault-meta-value">${formatDateTime(entry.metadata.lastUsedAt)}</span>
          </div>
          <div class="vault-meta-item">
            <span class="vault-meta-label">${t('vault.detail.usageCount')}</span>
            <span class="vault-meta-value">${entry.metadata.usageCount || 0}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render empty detail panel
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEmptyDetail(options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-detail-empty">
      <div class="vault-detail-empty-icon">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          <circle cx="12" cy="16" r="1"></circle>
        </svg>
      </div>
      <p class="vault-detail-empty-text">${t('vault.messages.selectEntry')}</p>
    </div>
  `;
}

/**
 * Render notes field with markdown preview toggle
 * @param {string} notes - Notes content
 * @param {Object} options - Options
 * @param {Function} options.parseMarkdown - Markdown parser function
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderNotesField(notes, options = {}) {
  const { parseMarkdown = (s) => escapeHtml(s), t = (k) => k } = options;

  if (!notes) return '';

  return `
    <div class="vault-field vault-notes-field">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${t('vault.labels.notes')}</label>
        <div class="vault-notes-toggle">
          <button type="button" class="vault-notes-mode active" data-mode="preview" title="${t('vault.actions.preview')}" aria-label="${t('vault.actions.previewMode')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button type="button" class="vault-notes-mode" data-mode="source" title="${t('vault.actions.sourceMarkdown')}" aria-label="${t('vault.actions.sourceMode')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div class="vault-notes-content">
        <div class="vault-notes-preview markdown-body" data-mode="preview">
          ${parseMarkdown(notes)}
        </div>
        <pre class="vault-notes-source" data-mode="source" hidden>${escapeHtml(notes)}</pre>
      </div>
    </div>
  `;
}

/**
 * Custom field type label keys for translation
 */
const FIELD_KIND_KEYS = {
  text: 'vault.fieldKinds.text',
  hidden: 'vault.fieldKinds.hidden',
  password: 'vault.fieldKinds.password',
  url: 'vault.fieldKinds.url',
  email: 'vault.fieldKinds.email',
  phone: 'vault.fieldKinds.phone',
  date: 'vault.fieldKinds.date'
};

/**
 * Get translated field kind label
 * @param {string} kind - Field kind
 * @param {Function} t - Translation function
 * @returns {string} Translated label
 */
function getFieldKindLabel(kind, t) {
  const key = FIELD_KIND_KEYS[kind];
  return key ? (t(key) || kind) : kind;
}

/**
 * Render custom fields section
 * @param {Array} fields - Custom fields array
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderCustomFields(fields, options = {}) {
  if (!fields || fields.length === 0) return '';

  const { t = (k) => k } = options;

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
      ${fields.map(field => {
        const isMasked = field.isSecured || field.kind === 'hidden' || field.kind === 'password';
        const isUrl = field.kind === 'url';
        const isEmail = field.kind === 'email';
        const isPhone = field.kind === 'phone';

        let displayValue = escapeHtml(field.value || '');
        if (isUrl && field.value) {
          displayValue = `<a href="${escapeHtml(field.value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(field.value)}</a>`;
        } else if (isEmail && field.value) {
          displayValue = `<a href="mailto:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
        } else if (isPhone && field.value) {
          displayValue = `<a href="tel:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
        }

        const maskedValue = isMasked ? '•'.repeat(Math.min((field.value || '').length, 24)) : displayValue;

        return `
          <div class="vault-field vault-custom-field-display" data-field-id="${escapeHtml(field.id || '')}" data-masked="${isMasked}">
            <div class="vault-field-label-row">
              <label class="vault-field-label">${escapeHtml(field.label)}</label>
              ${field.isSecured ? `<span class="vault-field-badge secure">🔒 ${t('vault.fieldKinds.secured')}</span>` : ''}
              <span class="vault-field-kind-badge">${getFieldKindLabel(field.kind, t)}</span>
            </div>
            <div class="vault-field-value ${isMasked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(field.value || '')}">
              <span class="vault-field-text ${isMasked ? 'masked' : ''}" data-value="${escapeHtml(field.value || '')}">
                ${isMasked ? maskedValue : displayValue}
              </span>
              ${isMasked ? `<span class="vault-field-revealed">${displayValue}</span>` : ''}
              <div class="vault-field-actions">
                ${isMasked ? `
                  <button class="vault-field-btn toggle-reveal" title="${t('vault.aria.toggleVisibility')}" aria-label="${t('vault.aria.toggleVisibility')}">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                ` : ''}
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
      }).join('')}
    </div>
  `;
}
