/**
 * @fileoverview Entry Preview Component
 * Floating preview card for vault entries on hover
 */

import { escapeHtml } from '../utils/formatter.js';
import { getEntryTypes, ENTRY_TYPES } from '../../config/entry-types.js';
import { i18n } from '../../utils/i18n.js';

/**
 * Position a preview element relative to cursor
 * @param {HTMLElement} preview - The preview element
 * @param {number} x - Cursor X position
 * @param {number} y - Cursor Y position
 */
function positionPreview(preview, x, y) {
  const rect = preview.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let posX = x + 15;
  let posY = y + 15;

  if (posX + rect.width > viewportW) posX = x - rect.width - 15;
  if (posY + rect.height > viewportH) posY = y - rect.height - 15;
  if (posX < 0) posX = 10;
  if (posY < 0) posY = 10;

  preview.style.left = `${posX}px`;
  preview.style.top = `${posY}px`;
}

/**
 * Build preview fields HTML based on entry type
 * @param {Object} entry - The vault entry
 * @param {Function} t - Translation function
 * @returns {string} HTML string for fields
 */
function buildPreviewFields(entry, t) {
  let fieldsHtml = '';

  if (entry.type === 'login') {
    if (entry.data?.username) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.username')}</span>
          <span class="vault-preview-value">${escapeHtml(entry.data.username)}</span>
        </div>
      `;
    }
    if (entry.data?.password) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.password')}</span>
          <span class="vault-preview-value vault-preview-password">••••••••••••</span>
        </div>
      `;
    }
    if (entry.data?.url) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.url')}</span>
          <span class="vault-preview-value">${escapeHtml(entry.data.url)}</span>
        </div>
      `;
    }
  } else if (entry.type === 'card') {
    if (entry.data?.cardNumber) {
      const masked = '**** **** **** ' + (entry.data.cardNumber.slice(-4) || '****');
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.cardNumber')}</span>
          <span class="vault-preview-value">${masked}</span>
        </div>
      `;
    }
    if (entry.data?.expiry) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.expiration')}</span>
          <span class="vault-preview-value">${escapeHtml(entry.data.expiry)}</span>
        </div>
      `;
    }
  } else if (entry.type === 'note') {
    if (entry.data?.note) {
      const truncated = entry.data.note.length > 100
        ? entry.data.note.slice(0, 100) + '...'
        : entry.data.note;
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.note')}</span>
          <span class="vault-preview-value">${escapeHtml(truncated)}</span>
        </div>
      `;
    }
  } else if (entry.type === 'identity') {
    if (entry.data?.fullName) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.fullName')}</span>
          <span class="vault-preview-value">${escapeHtml(entry.data.fullName)}</span>
        </div>
      `;
    }
    if (entry.data?.email) {
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">${t('vault.labels.email')}</span>
          <span class="vault-preview-value">${escapeHtml(entry.data.email)}</span>
        </div>
      `;
    }
  }

  // Add modified date
  if (entry.modifiedAt) {
    const locale = i18n.getLocale() || navigator.language || 'en-US';
    const modified = new Date(entry.modifiedAt).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    fieldsHtml += `
      <div class="vault-preview-field">
        <span class="vault-preview-label">${t('vault.labels.modified')}</span>
        <span class="vault-preview-value">${modified}</span>
      </div>
    `;
  }

  return fieldsHtml;
}

/**
 * Show entry preview at position
 * @param {Object} options
 * @param {Object} options.entry - The vault entry to preview
 * @param {number} options.x - X position
 * @param {number} options.y - Y position
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The preview element
 */
export function showEntryPreview(options = {}) {
  const { entry, x, y, t = (k) => k } = options;

  // Remove existing preview
  hideEntryPreview();

  if (!entry) return null;

  const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
  const preview = document.createElement('div');
  preview.className = 'vault-entry-preview';
  preview.setAttribute('role', 'tooltip');
  preview.setAttribute('aria-label', t('vault.aria.entryPreview'));

  const fieldsHtml = buildPreviewFields(entry, t);

  preview.innerHTML = `
    <div class="vault-preview-header">
      <div class="vault-preview-icon" data-type-color="${escapeHtml(type.color || '')}">
        ${escapeHtml(type.icon || '')}
      </div>
      <span class="vault-preview-title">${escapeHtml(entry.title)}</span>
    </div>
    <div class="vault-preview-fields">
      ${fieldsHtml}
    </div>
  `;

  document.body.appendChild(preview);
  positionPreview(preview, x, y);

  return preview;
}

/**
 * Update preview position (for mouse move)
 * @param {number} x - X position
 * @param {number} y - Y position
 */
export function updateEntryPreviewPosition(x, y) {
  const preview = document.querySelector('.vault-entry-preview');
  if (preview) {
    positionPreview(preview, x, y);
  }
}

/**
 * Hide entry preview
 */
export function hideEntryPreview() {
  document.querySelector('.vault-entry-preview')?.remove();
}
