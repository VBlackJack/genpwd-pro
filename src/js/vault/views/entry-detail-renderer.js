/**
 * @fileoverview Entry Detail Panel Renderer
 * Pure rendering functions for the entry detail view with enhanced organization
 */

import { escapeHtml, formatDateTime, formatRelativeTime } from '../utils/formatter.js';
import { renderFaviconImg } from '../utils/favicon-manager.js';
import { parseMarkdown, renderNotesFieldHTML } from '../utils/markdown-parser.js';
import { renderPasswordHistory, renderPasswordAge } from '../utils/password-display.js';
import { renderField, renderCustomFieldsDisplay } from './field-renderer.js';
import { renderTagsInDetail } from '../components/tags-display.js';
import { renderExpirationField, renderTOTPField } from '../components/entry-fields.js';
import { getEntryTypes, ENTRY_TYPES } from '../../config/entry-types.js';
import { getPasswordStrength, isPasswordDuplicated, getExpiryStatus } from '../utils/password-utils.js';
import { t } from '../../utils/i18n.js';

/**
 * Render the action buttons for entry detail header
 * @param {Object} entry - The entry object
 * @returns {string} HTML string
 */
function renderDetailActions(entry) {
  const isLogin = entry.type === 'login';

  return `
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
    ${isLogin ? `
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
  `;
}

/**
 * Render the metadata section for entry detail
 * @param {Object} entry - The entry object
 * @returns {string} HTML string
 */
function renderDetailMeta(entry) {
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
 * Render note type content with markdown preview/source toggle
 * @param {Object} entry - The entry object
 * @returns {string} HTML string
 */
function renderNoteContent(entry) {
  return `
    <div class="vault-field vault-notes-field">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${t('vault.fields.content')}</label>
        <div class="vault-notes-toggle">
          <button type="button" class="vault-notes-mode active" data-mode="preview" title="${t('vault.actions.preview')}" aria-label="${t('vault.actions.previewMode')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button type="button" class="vault-notes-mode" data-mode="source" title="${t('vault.actions.sourceMarkdown')}" aria-label="${t('vault.actions.editSourceMode')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div class="vault-notes-content">
        <div class="vault-notes-preview markdown-body" data-mode="preview">
          ${parseMarkdown(entry.data?.content || '')}
        </div>
        <pre class="vault-notes-source" data-mode="source" hidden>${escapeHtml(entry.data?.content || '')}</pre>
      </div>
    </div>
  `;
}

/**
 * Render entry fields based on entry type
 * @param {Object} entry - The entry object
 * @returns {string} HTML string
 */
export function renderEntryFields(entry) {
  switch (entry.type) {
    case 'login':
      return `
        ${renderField({ label: t('vault.labels.username'), value: entry.data?.username, key: 'username', copyable: true })}
        ${renderField({ label: t('vault.labels.password'), value: entry.data?.password, key: 'password', masked: true, copyable: true })}
        ${renderPasswordHistory(entry, t)}
        ${entry.data?.totp ? renderTOTPField(entry) : ''}
        ${renderField({ label: t('vault.labels.url'), value: entry.data?.url, key: 'url', copyable: true, isUrl: true })}
        ${renderExpirationField(entry)}
        ${entry.notes ? renderNotesFieldHTML(entry.notes, t) : ''}
      `;
    case 'note':
      return renderNoteContent(entry);
    case 'card':
      return `
        ${renderField({ label: t('vault.labels.holder'), value: entry.data?.holder })}
        ${renderField({ label: t('vault.labels.cardNumber'), value: entry.data?.number, key: 'number', masked: true, copyable: true })}
        ${renderField({ label: t('vault.labels.expiration'), value: entry.data?.expiry })}
        ${renderField({ label: t('vault.labels.cvv'), value: entry.data?.cvv, key: 'cvv', masked: true, copyable: true })}
      `;
    case 'identity':
      return `
        ${renderField({ label: t('vault.labels.fullName'), value: entry.data?.fullName })}
        ${renderField({ label: t('vault.labels.email'), value: entry.data?.email, key: 'email', copyable: true })}
        ${renderField({ label: t('vault.labels.phone'), value: entry.data?.phone, key: 'phone', copyable: true })}
      `;
    default:
      return '';
  }
}

/**
 * Render security summary for login entries
 * @param {Object} entry - The entry object
 * @param {Array} entries - All entries for duplicate checking
 * @returns {string} HTML string
 */
function renderSecuritySummary(entry, entries = []) {
  if (entry.type !== 'login' || !entry.data?.password) return '';

  const strength = getPasswordStrength(entry.data.password);
  const isDuplicate = isPasswordDuplicated(entry.data.password, entry.id, entries);
  const expiryStatus = getExpiryStatus(entry);
  const has2FA = Boolean(entry.data?.totp);

  const strengthLabels = {
    weak: { label: t('vault.badges.weak'), class: 'danger' },
    medium: { label: t('vault.badges.medium'), class: 'warning' },
    strong: { label: t('vault.badges.strong'), class: 'success' }
  };

  const strengthInfo = strengthLabels[strength] || strengthLabels.medium;

  return `
    <div class="vault-detail-section vault-security-summary">
      <div class="vault-section-header">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <span>${t('vault.entryInfo.securityScore')}</span>
      </div>
      <div class="vault-security-indicators">
        <div class="vault-security-item ${strengthInfo.class}">
          <span class="vault-security-icon">
            <span class="vault-strength-dot ${strength}"></span>
          </span>
          <span class="vault-security-label">${t('vault.entryInfo.strength')}</span>
          <span class="vault-security-value">${strengthInfo.label}</span>
        </div>
        <div class="vault-security-item ${has2FA ? 'success' : 'muted'}">
          <span class="vault-security-icon" aria-hidden="true">${has2FA ? '🔐' : '🔓'}</span>
          <span class="vault-security-label">2FA</span>
          <span class="vault-security-value">${has2FA ? t('vault.entryInfo.has2FA') : t('vault.entryInfo.no2FA')}</span>
        </div>
        ${isDuplicate ? `
          <div class="vault-security-item danger">
            <span class="vault-security-icon" aria-hidden="true">🔁</span>
            <span class="vault-security-label">${t('vault.badges.reused')}</span>
            <span class="vault-security-value">${t('vault.entryCard.reusedPassword')}</span>
          </div>
        ` : ''}
        ${expiryStatus.status !== 'none' && expiryStatus.status !== 'ok' ? `
          <div class="vault-security-item ${expiryStatus.status === 'expired' ? 'danger' : 'warning'}">
            <span class="vault-security-icon" aria-hidden="true">⏰</span>
            <span class="vault-security-label">${t('vault.labels.expiration')}</span>
            <span class="vault-security-value">${t('vault.badges.' + expiryStatus.status)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render quick info bar with key stats
 * @param {Object} entry - The entry object
 * @returns {string} HTML string
 */
function renderQuickInfoBar(entry) {
  const modifiedDate = entry.modifiedAt || entry.metadata?.updatedAt;
  const usageCount = entry.metadata?.usageCount || 0;
  const hasAttachments = entry.attachments && entry.attachments.length > 0;
  const hasCustomFields = entry.customFields && entry.customFields.length > 0;

  return `
    <div class="vault-quick-info-bar">
      ${modifiedDate ? `
        <span class="vault-quick-info-item" title="${t('vault.detail.modified')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${formatRelativeTime(modifiedDate)}
        </span>
      ` : ''}
      ${usageCount > 0 ? `
        <span class="vault-quick-info-item" title="${t('vault.detail.usageCount')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          ${usageCount}
        </span>
      ` : ''}
      ${hasAttachments ? `
        <span class="vault-quick-info-item" title="${t('vault.entryInfo.attachmentsCount', { count: entry.attachments.length })}">
          <span aria-hidden="true">📎</span> ${entry.attachments.length}
        </span>
      ` : ''}
      ${hasCustomFields ? `
        <span class="vault-quick-info-item" title="${t('vault.entryInfo.customFieldsCount', { count: entry.customFields.length })}">
          +${entry.customFields.length}
        </span>
      ` : ''}
    </div>
  `;
}

/**
 * Render the complete entry detail view
 * @param {Object} options - Render options
 * @param {Object} options.entry - The entry to render
 * @param {Array} options.tags - All available tags
 * @param {Array} [options.entries] - All entries for duplicate checking
 * @returns {string} HTML string
 */
export function renderEntryDetail({ entry, tags, entries = [] }) {
  if (!entry) return '';

  const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
  const isPinned = entry.pinned;
  const isFavorite = entry.favorite;

  return `
    <div class="vault-detail-header">
      <div class="vault-detail-icon" data-type-color="${type.color}" aria-hidden="true">
        ${entry.data?.url ? renderFaviconImg(entry.data.url, 40) : type.icon}
      </div>
      <div class="vault-detail-info">
        <div class="vault-detail-title-row">
          ${isPinned ? `<span class="vault-pin-badge" role="img" aria-label="${t('vault.badges.pinned')}" title="${t('vault.badges.pinned')}">📌</span>` : ''}
          ${isFavorite ? `<span class="vault-fav-indicator" role="img" aria-label="${t('vault.badges.favorite')}" title="${t('vault.badges.favorite')}">★</span>` : ''}
          <h3 class="vault-detail-title">${escapeHtml(entry.title)}</h3>
        </div>
        <div class="vault-detail-subtitle-row">
          <span class="vault-detail-type" style="--type-color: ${type.color}">${type.label}</span>
          ${entry.data?.url ? (() => {
            try {
              return `<span class="vault-detail-domain">${escapeHtml(new URL(entry.data.url).hostname)}</span>`;
            } catch {
              return '';
            }
          })() : ''}
        </div>
        <div class="vault-detail-tags">${renderTagsInDetail({ entry, tags })}</div>
        ${renderQuickInfoBar(entry)}
      </div>
      <div class="vault-detail-actions" role="group" aria-label="${t('vault.aria.entryActions')}">
        ${renderDetailActions(entry)}
      </div>
    </div>

    <div class="vault-detail-body">
      ${renderSecuritySummary(entry, entries)}

      <div class="vault-detail-section vault-fields-section">
        ${renderEntryFields(entry)}
      </div>

      ${entry.customFields && entry.customFields.length > 0 ? `
        <div class="vault-detail-section vault-custom-fields-section">
          <div class="vault-section-header">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>${t('vault.labels.customFields')}</span>
          </div>
          ${renderCustomFieldsDisplay(entry)}
        </div>
      ` : ''}

      ${renderPasswordAge(entry, t)}

      <div class="vault-detail-section vault-meta-section">
        <div class="vault-section-header">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>${t('vault.detail.modified')}</span>
        </div>
        ${renderDetailMeta(entry)}
      </div>
    </div>
  `;
}
