/**
 * @fileoverview Entry Row Renderer
 * Pure rendering function for vault entry rows
 */

import { escapeHtml } from '../utils/formatter.js';
import { getPasswordStrength, isPasswordDuplicated, getExpiryStatus } from '../utils/password-utils.js';
import { renderFaviconImg } from '../utils/favicon-manager.js';
import { renderTagsInRow } from '../components/tags-display.js';
import { getEntryTypes, ENTRY_TYPES } from '../../config/entry-types.js';
import { t } from '../../utils/i18n.js';

/**
 * Render a single entry row
 * @param {Object} options - Render options
 * @param {Object} options.entry - Entry to render
 * @param {number} options.index - Entry index in list
 * @param {boolean} options.isSelected - Whether entry is selected
 * @param {boolean} options.isMultiSelected - Whether entry is multi-selected
 * @param {Array} options.entries - All entries (for duplicate check)
 * @param {Array} options.tags - All tags
 * @returns {string} HTML string
 */
export function renderEntryRow({ entry, index, isSelected, isMultiSelected, entries, tags }) {
  const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
  const subtitle = entry.data?.username || entry.data?.url || type.label;
  const isFavorite = entry.favorite;
  const isPinned = entry.pinned;

  const strength = entry.type === 'login' && entry.data?.password
    ? getPasswordStrength(entry.data.password)
    : null;

  const isDuplicate = entry.type === 'login' && entry.data?.password
    ? isPasswordDuplicated(entry.data.password, entry.id, entries)
    : false;

  const expiryStatus = getExpiryStatus(entry);

  return `
    <div class="vault-entry-row ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${isPinned ? 'pinned' : ''}"
         data-entry-id="${entry.id}"
         data-entry-index="${index}"
         role="option"
         aria-selected="${isSelected || isMultiSelected}"
         tabindex="${isSelected ? 0 : -1}"
         draggable="true">
      <label class="vault-checkbox-wrapper" title="${t('vault.common.select')}">
        <input type="checkbox" class="vault-checkbox" data-action="multi-select"
               ${isMultiSelected ? 'checked' : ''} aria-label="${t('vault.common.select')} ${escapeHtml(entry.title)}">
        <span class="vault-checkbox-mark"></span>
      </label>
      <button class="vault-fav-toggle ${isFavorite ? 'active' : ''}"
              data-action="toggle-favorite"
              title="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
              aria-label="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
              aria-pressed="${isFavorite}">
        ${isFavorite ? '★' : '☆'}
      </button>
      <div class="vault-entry-icon" data-type-color="${type.color}" aria-hidden="true">
        ${entry.data?.url ? renderFaviconImg(entry.data.url, 20) : type.icon}
      </div>
      <div class="vault-entry-content">
        <div class="vault-entry-title">
          ${isPinned ? `<span class="vault-pin-badge" role="img" aria-label="${t('vault.entryCard.pinned')}"><span aria-hidden="true">📌</span></span>` : ''}
          ${escapeHtml(entry.title)}
          ${strength ? `<span class="vault-strength-dot ${strength}" role="img" aria-label="${t('vault.entryCard.strengthPrefix')}: ${t('vault.filters.' + strength)}" title="${t('vault.entryCard.strengthTitle')}: ${t('vault.filters.' + strength)}"></span>` : ''}
          ${isDuplicate ? `<span class="vault-duplicate-badge" role="img" aria-label="${t('vault.entryCard.reusedPassword')}" title="${t('vault.entryCard.reusedPassword')}"><span aria-hidden="true">🔁</span></span>` : ''}
          ${expiryStatus.badge}
        </div>
        <div class="vault-entry-subtitle">${escapeHtml(subtitle)}</div>
        ${renderTagsInRow({ entry, tags })}
      </div>
      <div class="vault-entry-actions" role="group" aria-label="${t('vault.aria.quickActions')}">
        ${renderQuickActions(entry)}
      </div>
    </div>
  `;
}

/**
 * Render quick action buttons for an entry
 * @param {Object} entry - Entry object
 * @returns {string} HTML string
 */
function renderQuickActions(entry) {
  const actions = [];

  if (entry.type === 'login' && entry.data?.username) {
    actions.push(`
      <button class="vault-quick-btn copy-user" data-action="copy-username"
              title="${t('vault.actions.copyUsername')}" aria-label="${t('vault.actions.copyUsername')}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
    `);
  }

  if (entry.type === 'login' && entry.data?.password) {
    actions.push(`
      <button class="vault-quick-btn copy-pass" data-action="copy-password"
              title="${t('vault.actions.copyPassword')}" aria-label="${t('vault.actions.copyPassword')}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </button>
    `);
  }

  if (entry.data?.url) {
    actions.push(`
      <button class="vault-quick-btn open-url" data-action="open-url"
              title="${t('vault.actions.openWebsite')}" aria-label="${t('vault.actions.openWebsite')}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
    `);
  }

  return actions.join('');
}
