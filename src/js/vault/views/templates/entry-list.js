/**
 * @fileoverview Entry List Templates
 * HTML templates for vault entry list rows
 */

// Icons are defined locally in ENTRY_TYPES
import { escapeHtml } from '../../utils/formatter.js';
import { getPasswordStrength } from '../../utils/password-utils.js';
import { renderFaviconImg } from '../../utils/favicon-manager.js';

/**
 * Entry type definitions
 * Note: labels are translation keys, resolved at render time with t()
 */
export const ENTRY_TYPES = {
  login: {
    icon: `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    labelKey: 'vault.entryTypes.login',
    color: '#3b82f6'
  },
  note: {
    icon: `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    labelKey: 'vault.entryTypes.note',
    color: '#10b981'
  },
  card: {
    icon: `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    labelKey: 'vault.entryTypes.card',
    color: '#f59e0b'
  },
  identity: {
    icon: `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    labelKey: 'vault.entryTypes.identity',
    color: '#8b5cf6'
  }
};

/**
 * Get translated label for entry type
 * @param {Object} type - Entry type object
 * @param {Function} t - Translation function
 * @returns {string} Translated label
 */
export function getTypeLabel(type, t) {
  return t(type.labelKey) || type.labelKey.split('.').pop();
}

/**
 * Check if password is duplicated across entries
 * @param {string} password - Password to check
 * @param {string} currentId - Current entry ID
 * @param {Array} allEntries - All entries
 * @returns {boolean}
 */
function isPasswordDuplicated(password, currentId, allEntries) {
  if (!password || !allEntries) return false;
  return allEntries.some(e =>
    e.id !== currentId &&
    e.type === 'login' &&
    e.data?.password === password
  );
}

/**
 * Get expiry status for an entry
 * @param {Object} entry - Entry object
 * @param {Object} t - Translation function
 * @returns {{status: string, badge: string}}
 */
function getExpiryStatus(entry, t) {
  if (!entry.data?.expiryDate) {
    return { status: 'none', badge: '' };
  }

  const expiry = new Date(entry.data.expiryDate);
  const now = new Date();
  const daysUntil = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return {
      status: 'expired',
      badge: `<span class="vault-expiry-badge expired" role="img" aria-label="${t('vault.entryCard.expired')}" title="${t('vault.entryCard.expired')}"><span aria-hidden="true">⚠️</span></span>`
    };
  }
  if (daysUntil === 0) {
    return {
      status: 'today',
      badge: `<span class="vault-expiry-badge today" role="img" aria-label="${t('vault.entryCard.expiresToday')}" title="${t('vault.entryCard.expiresToday')}"><span aria-hidden="true">⏰</span></span>`
    };
  }
  if (daysUntil <= 7) {
    return {
      status: 'soon',
      badge: `<span class="vault-expiry-badge soon" role="img" aria-label="${t('vault.entryCard.expiresSoon')}" title="${t('vault.entryCard.expiresSoon')}"><span aria-hidden="true">⏰</span></span>`
    };
  }

  return { status: 'ok', badge: '' };
}

/**
 * Render tags in entry row
 * @param {Object} entry - Entry object
 * @param {Array} allTags - All available tags
 * @returns {string} HTML string
 */
function renderTagsInRow(entry, allTags = []) {
  if (!entry.tags || entry.tags.length === 0) return '';

  const tags = entry.tags
    .map(tagId => allTags.find(t => t.id === tagId))
    .filter(Boolean)
    .slice(0, 2);

  if (tags.length === 0) return '';

  const remaining = entry.tags.length - 2;

  return `
    <div class="vault-entry-tags">
      ${tags.map(tag => `
        <span class="vault-mini-tag" style="--tag-color: ${tag.color || '#6b7280'}" title="${escapeHtml(tag.name)}">
          ${escapeHtml(tag.name)}
        </span>
      `).join('')}
      ${remaining > 0 ? `<span class="vault-mini-tag-more">+${remaining}</span>` : ''}
    </div>
  `;
}

/**
 * Render a single entry row
 * @param {Object} entry - Entry data
 * @param {Object} options - Render options
 * @param {number} options.index - Entry index
 * @param {boolean} options.isSelected - Is this entry selected
 * @param {boolean} options.isMultiSelected - Is in multi-select
 * @param {Array} options.allEntries - All entries for duplicate check
 * @param {Array} options.allTags - All available tags
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEntryRow(entry, options = {}) {
  const {
    index = 0,
    isSelected = false,
    isMultiSelected = false,
    allEntries = [],
    allTags = [],
    t = (k) => k
  } = options;

  const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
  const typeLabel = getTypeLabel(type, t);
  const subtitle = entry.data?.username || entry.data?.url || typeLabel;
  const isFavorite = entry.favorite;
  const isPinned = entry.pinned;

  const strength = entry.type === 'login' && entry.data?.password
    ? getPasswordStrength(entry.data.password)
    : null;

  const isDuplicate = entry.type === 'login' && entry.data?.password
    ? isPasswordDuplicated(entry.data.password, entry.id, allEntries)
    : false;

  const expiryStatus = getExpiryStatus(entry, t);

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
        <span aria-hidden="true">${isFavorite ? '★' : '☆'}</span>
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
        ${renderTagsInRow(entry, allTags)}
      </div>
      <div class="vault-entry-actions" role="group" aria-label="${t('vault.aria.quickActions')}">
        ${entry.type === 'login' && entry.data?.username ? `
          <button class="vault-quick-btn copy-user" data-action="copy-username"
                  title="${t('vault.actions.copyUsername')}" aria-label="${t('vault.actions.copyUsername')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
        ` : ''}
        ${entry.type === 'login' && entry.data?.password ? `
          <button class="vault-quick-btn copy-pass" data-action="copy-password"
                  title="${t('vault.actions.copyPassword')}" aria-label="${t('vault.actions.copyPassword')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </button>
        ` : ''}
        ${entry.data?.url ? `
          <button class="vault-quick-btn open-url" data-action="open-url"
                  title="${t('vault.actions.openWebsite')}" aria-label="${t('vault.actions.openWebsite')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render empty state for entry list
 * @param {Object} options - Options
 * @param {string} options.searchQuery - Current search query
 * @param {boolean} options.hasFilters - Are filters active
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEmptyEntryList(options = {}) {
  const { searchQuery = '', hasFilters = false, t = (k) => k } = options;

  if (searchQuery) {
    return `
      <div class="vault-empty-list">
        <div class="vault-empty-icon">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h3 class="vault-empty-title">${t('vault.messages.noResults')}</h3>
        <p class="vault-empty-text">${t('vault.messages.noEntryMatches', { query: escapeHtml(searchQuery) })}</p>
      </div>
    `;
  }

  if (hasFilters) {
    return `
      <div class="vault-empty-list">
        <div class="vault-empty-icon">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </div>
        <h3 class="vault-empty-title">${t('vault.messages.noMatches')}</h3>
        <p class="vault-empty-text">${t('vault.messages.tryDifferentFilters')}</p>
      </div>
    `;
  }

  return `
    <div class="vault-empty-list">
      <div class="vault-empty-icon">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h3 class="vault-empty-title">${t('vault.messages.noEntries')}</h3>
      <p class="vault-empty-text">${t('vault.messages.addFirstEntry')}</p>
    </div>
  `;
}

/**
 * Render entry list header with count and sort
 * @param {Object} options - Options
 * @param {number} options.count - Entry count
 * @param {string} options.sortBy - Current sort field
 * @param {string} options.sortOrder - Current sort order
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEntryListHeader(options = {}) {
  const { count = 0, sortBy = 'title', sortOrder = 'asc', t = (k) => k } = options;

  return `
    <div class="vault-list-header">
      <span class="vault-list-count">${count} ${count === 1 ? t('vault.misc.entry') : t('vault.misc.entries')}</span>
      <button class="vault-sort-btn" id="sort-btn" aria-haspopup="true" aria-expanded="false">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="${sortOrder === 'asc' ? '19' : '5'}" x2="12" y2="${sortOrder === 'asc' ? '5' : '19'}"></line>
          <polyline points="${sortOrder === 'asc' ? '5 12 12 5 19 12' : '19 12 12 19 5 12'}"></polyline>
        </svg>
        <span>${sortBy === 'title' ? t('vault.sort.name') : sortBy === 'modifiedAt' ? t('vault.sort.modified') : sortBy === 'createdAt' ? t('vault.sort.created') : t('vault.sort.type')}</span>
      </button>
    </div>
  `;
}
