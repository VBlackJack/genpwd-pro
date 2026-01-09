/**
 * @fileoverview Entry Row Renderer
 * Pure rendering function for vault entry rows with multiple view modes
 */

import { escapeHtml, formatRelativeTime } from '../utils/formatter.js';
import { getPasswordStrength, isPasswordDuplicated, getExpiryStatus, getPasswordAgeDays } from '../utils/password-utils.js';
import { renderFaviconImg } from '../utils/favicon-manager.js';
import { renderTagsInRow } from '../components/tags-display.js';
import { getEntryTypes, ENTRY_TYPES } from '../../config/entry-types.js';
import { t } from '../../utils/i18n.js';
import { VIEW_MODES, getViewMode } from '../components/view-mode-switcher.js';

/**
 * Get entry metadata for enhanced display
 * @param {Object} entry - Entry object
 * @param {Array} entries - All entries (for duplicate check)
 * @returns {Object} Entry metadata
 */
function getEntryMetadata(entry, entries) {
  const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
  const strength = entry.type === 'login' && entry.data?.password
    ? getPasswordStrength(entry.data.password)
    : null;
  const isDuplicate = entry.type === 'login' && entry.data?.password
    ? isPasswordDuplicated(entry.data.password, entry.id, entries)
    : false;
  const expiryStatus = getExpiryStatus(entry);
  const has2FA = Boolean(entry.data?.totp);
  const hasAttachments = entry.attachments && entry.attachments.length > 0;
  const hasCustomFields = entry.customFields && entry.customFields.length > 0;
  const hasNotes = Boolean(entry.notes || entry.data?.content);
  const passwordAge = entry.type === 'login' ? getPasswordAgeDays(entry.modifiedAt) : null;

  return {
    type,
    strength,
    isDuplicate,
    expiryStatus,
    has2FA,
    hasAttachments,
    hasCustomFields,
    hasNotes,
    passwordAge,
    attachmentCount: entry.attachments?.length || 0,
    customFieldCount: entry.customFields?.length || 0
  };
}

/**
 * Render status badges for an entry
 * @param {Object} metadata - Entry metadata
 * @returns {string} HTML string
 */
function renderStatusBadges(metadata) {
  const badges = [];

  // 2FA badge
  if (metadata.has2FA) {
    badges.push(`<span class="vault-badge vault-badge-2fa" title="${t('vault.entryInfo.has2FA')}" aria-label="${t('vault.entryInfo.has2FA')}">2FA</span>`);
  }

  // Strength badge (for comfortable/grid view)
  if (metadata.strength) {
    badges.push(`<span class="vault-badge vault-badge-strength vault-badge-${metadata.strength}" title="${t('vault.badges.' + metadata.strength)}">${t('vault.badges.' + metadata.strength)}</span>`);
  }

  // Expiry badge
  if (metadata.expiryStatus.status === 'expired') {
    badges.push(`<span class="vault-badge vault-badge-danger" title="${t('vault.badges.expired')}">${t('vault.badges.expired')}</span>`);
  } else if (metadata.expiryStatus.status === 'soon' || metadata.expiryStatus.status === 'warning') {
    badges.push(`<span class="vault-badge vault-badge-warning" title="${t('vault.badges.expiring')}">${t('vault.badges.expiring')}</span>`);
  }

  // Duplicate badge
  if (metadata.isDuplicate) {
    badges.push(`<span class="vault-badge vault-badge-danger" title="${t('vault.badges.reused')}">${t('vault.badges.reused')}</span>`);
  }

  return badges.join('');
}

/**
 * Render metadata info line for comfortable/grid view
 * @param {Object} entry - Entry object
 * @param {Object} metadata - Entry metadata
 * @returns {string} HTML string
 */
function renderMetadataLine(entry, metadata) {
  const parts = [];

  // Modified date
  const modifiedDate = entry.modifiedAt || entry.metadata?.updatedAt;
  if (modifiedDate) {
    const relativeTime = formatRelativeTime(modifiedDate);
    parts.push(`<span class="vault-entry-meta-item" title="${t('vault.entryInfo.lastModified')}">${relativeTime}</span>`);
  }

  // Attachments count
  if (metadata.attachmentCount > 0) {
    parts.push(`<span class="vault-entry-meta-item vault-entry-meta-attach" title="${t('vault.entryInfo.attachmentsCount', { count: metadata.attachmentCount })}">📎 ${metadata.attachmentCount}</span>`);
  }

  // Custom fields count
  if (metadata.customFieldCount > 0) {
    parts.push(`<span class="vault-entry-meta-item" title="${t('vault.entryInfo.customFieldsCount', { count: metadata.customFieldCount })}">+${metadata.customFieldCount}</span>`);
  }

  return parts.length > 0 ? `<div class="vault-entry-meta">${parts.join('<span class="vault-meta-sep">•</span>')}</div>` : '';
}

/**
 * Render a single entry row
 * @param {Object} options - Render options
 * @param {Object} options.entry - Entry to render
 * @param {number} options.index - Entry index in list
 * @param {boolean} options.isSelected - Whether entry is selected
 * @param {boolean} options.isMultiSelected - Whether entry is multi-selected
 * @param {Array} options.entries - All entries (for duplicate check)
 * @param {Array} options.tags - All tags
 * @param {string} [options.viewMode] - Override view mode
 * @returns {string} HTML string
 */
export function renderEntryRow({ entry, index, isSelected, isMultiSelected, entries, tags, viewMode }) {
  const mode = viewMode || getViewMode();
  const metadata = getEntryMetadata(entry, entries);
  const { type, strength, isDuplicate, expiryStatus } = metadata;

  const subtitle = entry.data?.username || entry.data?.url || type.label;
  const isFavorite = entry.favorite;
  const isPinned = entry.pinned;

  // View mode specific classes
  const viewModeClass = `vault-entry-${mode}`;

  // Build CSS classes
  const cssClasses = [
    'vault-entry-row',
    viewModeClass,
    isSelected ? 'selected' : '',
    isMultiSelected ? 'multi-selected' : '',
    isPinned ? 'pinned' : '',
    isFavorite ? 'is-favorite' : '',
    strength ? `strength-${strength}` : '',
    metadata.has2FA ? 'has-2fa' : ''
  ].filter(Boolean).join(' ');

  // Grid view uses a card layout
  if (mode === VIEW_MODES.GRID) {
    return renderGridCard({ entry, index, isSelected, isMultiSelected, tags, metadata, cssClasses, type, subtitle, isFavorite, isPinned, strength, isDuplicate, expiryStatus });
  }

  // Compact and Comfortable modes use row layout
  return `
    <div class="${cssClasses}"
         data-entry-id="${entry.id}"
         data-entry-index="${index}"
         data-entry-type="${entry.type}"
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
        ${entry.data?.url ? renderFaviconImg(entry.data.url, mode === VIEW_MODES.COMPACT ? 18 : 24) : type.icon}
      </div>
      <div class="vault-entry-content">
        <div class="vault-entry-title-row">
          <span class="vault-entry-title">
            ${isPinned ? `<span class="vault-pin-badge" role="img" aria-label="${t('vault.entryCard.pinned')}"><span aria-hidden="true">📌</span></span>` : ''}
            ${escapeHtml(entry.title)}
          </span>
          ${mode === VIEW_MODES.COMPACT ? renderCompactIndicators(strength, isDuplicate, expiryStatus, metadata.has2FA) : ''}
        </div>
        <div class="vault-entry-subtitle">${escapeHtml(subtitle)}</div>
        ${mode === VIEW_MODES.COMFORTABLE ? `
          <div class="vault-entry-badges">${renderStatusBadges(metadata)}</div>
          ${renderMetadataLine(entry, metadata)}
          ${renderTagsInRow({ entry, tags })}
        ` : ''}
      </div>
      <div class="vault-entry-actions" role="group" aria-label="${t('vault.aria.quickActions')}">
        ${renderQuickActions(entry)}
      </div>
    </div>
  `;
}

/**
 * Render compact mode indicators (dots only)
 * @param {string|null} strength - Password strength
 * @param {boolean} isDuplicate - Is password duplicated
 * @param {Object} expiryStatus - Expiry status object
 * @param {boolean} has2FA - Has 2FA enabled
 * @returns {string} HTML string
 */
function renderCompactIndicators(strength, isDuplicate, expiryStatus, has2FA) {
  const indicators = [];

  if (strength) {
    indicators.push(`<span class="vault-strength-dot ${strength}" title="${t('vault.badges.' + strength)}"></span>`);
  }

  if (isDuplicate) {
    indicators.push(`<span class="vault-indicator-dot danger" title="${t('vault.badges.reused')}"></span>`);
  }

  if (expiryStatus.status === 'expired' || expiryStatus.status === 'soon') {
    indicators.push(`<span class="vault-indicator-dot ${expiryStatus.status === 'expired' ? 'danger' : 'warning'}" title="${expiryStatus.status === 'expired' ? t('vault.badges.expired') : t('vault.badges.expiring')}"></span>`);
  }

  if (has2FA) {
    indicators.push(`<span class="vault-indicator-dot success" title="${t('vault.badges.has2FA')}"></span>`);
  }

  return indicators.length > 0 ? `<span class="vault-compact-indicators">${indicators.join('')}</span>` : '';
}

/**
 * Render grid card layout
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
function renderGridCard({ entry, index, isSelected, isMultiSelected, tags, metadata, cssClasses, type, subtitle, isFavorite, isPinned, strength, isDuplicate, expiryStatus }) {
  return `
    <div class="${cssClasses}"
         data-entry-id="${entry.id}"
         data-entry-index="${index}"
         data-entry-type="${entry.type}"
         role="option"
         aria-selected="${isSelected || isMultiSelected}"
         tabindex="${isSelected ? 0 : -1}"
         draggable="true">
      <div class="vault-card-header">
        <label class="vault-checkbox-wrapper" title="${t('vault.common.select')}">
          <input type="checkbox" class="vault-checkbox" data-action="multi-select"
                 ${isMultiSelected ? 'checked' : ''} aria-label="${t('vault.common.select')} ${escapeHtml(entry.title)}">
          <span class="vault-checkbox-mark"></span>
        </label>
        <div class="vault-card-icon" data-type-color="${type.color}" aria-hidden="true">
          ${entry.data?.url ? renderFaviconImg(entry.data.url, 32) : type.icon}
        </div>
        <button class="vault-fav-toggle ${isFavorite ? 'active' : ''}"
                data-action="toggle-favorite"
                title="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-label="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-pressed="${isFavorite}">
          ${isFavorite ? '★' : '☆'}
        </button>
      </div>
      <div class="vault-card-body">
        <div class="vault-card-title">
          ${isPinned ? `<span class="vault-pin-badge"><span aria-hidden="true">📌</span></span>` : ''}
          ${escapeHtml(entry.title)}
        </div>
        <div class="vault-card-subtitle">${escapeHtml(subtitle)}</div>
        <div class="vault-card-badges">${renderStatusBadges(metadata)}</div>
        ${renderTagsInRow({ entry, tags, maxVisible: 3 })}
      </div>
      <div class="vault-card-footer">
        <div class="vault-card-meta">
          ${metadata.has2FA ? '<span class="vault-card-2fa" title="2FA">🔐</span>' : ''}
          ${metadata.hasAttachments ? '<span class="vault-card-attach" title="Attachments">📎</span>' : ''}
        </div>
        <div class="vault-card-actions" role="group" aria-label="${t('vault.aria.quickActions')}">
          ${renderQuickActions(entry, true)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render quick action buttons for an entry
 * @param {Object} entry - Entry object
 * @param {boolean} [compact=false] - Use compact icon size
 * @returns {string} HTML string
 */
function renderQuickActions(entry, compact = false) {
  const actions = [];
  const iconSize = compact ? 14 : 16;

  if (entry.type === 'login' && entry.data?.username) {
    actions.push(`
      <button class="vault-quick-btn copy-user" data-action="copy-username"
              title="${t('vault.actions.copyUsername')}" aria-label="${t('vault.actions.copyUsername')}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2">
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2">
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
    `);
  }

  // Copy 2FA code if TOTP is configured
  if (entry.data?.totp) {
    actions.push(`
      <button class="vault-quick-btn copy-2fa" data-action="copy-totp"
              title="${t('vault.actions.copy2FACode')}" aria-label="${t('vault.actions.copy2FACode')}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
      </button>
    `);
  }

  return actions.join('');
}
