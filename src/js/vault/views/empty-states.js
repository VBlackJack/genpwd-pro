/**
 * @fileoverview Empty States and Skeleton Views
 * Loading placeholders and empty state displays
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Render empty state for search results or welcome screen
 * @param {Object} options
 * @param {string} options.searchQuery - Current search query (if any)
 * @param {Function} options.t - Translation function
 * @returns {string} Empty state HTML
 */
export function renderEmptyState({ searchQuery = '', t = (k) => k } = {}) {
  if (searchQuery) {
    return `
      <div class="vault-empty-state">
        <div class="vault-empty-illustration" aria-hidden="true">
          <svg viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="50" cy="45" r="28" stroke-dasharray="4 2" opacity="0.3"/>
            <circle cx="50" cy="45" r="20"/>
            <line x1="64" y1="59" x2="85" y2="80" stroke-width="3" stroke-linecap="round"/>
            <path d="M45 42 L50 48 L58 38" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
          </svg>
        </div>
        <h3 class="vault-empty-title">${t('vault.messages.noResults')}</h3>
        <p class="vault-empty-text">${t('vault.messages.noEntryMatches', { query: escapeHtml(searchQuery) })}</p>
        <div class="vault-empty-actions">
          <button class="vault-btn vault-btn-secondary" id="btn-clear-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            ${t('vault.messages.clearSearch')}
          </button>
        </div>
        <div class="vault-empty-tips">
          <span class="vault-empty-tip">${t('vault.messages.searchTip')}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="vault-empty-state vault-welcome-screen">
      <div class="vault-empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="25" y="30" width="70" height="50" rx="4" stroke-dasharray="4 2" opacity="0.3"/>
          <rect x="35" y="25" width="50" height="40" rx="3"/>
          <circle cx="60" cy="45" r="8"/>
          <line x1="60" y1="50" x2="60" y2="55" stroke-width="2" stroke-linecap="round"/>
          <path d="M45 70 L60 60 L75 70" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        </svg>
      </div>
      <h3 class="vault-empty-title">Welcome to your vault</h3>
      <p class="vault-empty-text">Your vault is ready. Import your passwords or create your first entry.</p>
      <div class="vault-empty-actions vault-welcome-layout">
        <button class="vault-btn vault-btn-primary vault-full-width" id="btn-welcome-create">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create my first entry
        </button>
        <button class="vault-btn vault-btn-outline vault-full-width" id="btn-welcome-import">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import from file
        </button>
      </div>
      <div class="vault-empty-tips">
        <span class="vault-empty-tip">Use <kbd>Ctrl</kbd>+<kbd>N</kbd> to quickly add</span>
        <span class="vault-empty-tip">Tip: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> auto-fills your forms</span>
      </div>
    </div>
  `;
}

/**
 * Render no selection placeholder for detail panel
 * @returns {string} Placeholder HTML
 */
export function renderNoSelection() {
  return `
    <div class="vault-detail-placeholder">
      <div class="vault-detail-placeholder-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </div>
      <p>Select an entry to see details</p>
      <div class="vault-shortcut-hints">
        <div class="vault-shortcut-hint">
          <kbd>↑</kbd><kbd>↓</kbd> Navigate
        </div>
        <div class="vault-shortcut-hint">
          <kbd>Ctrl</kbd>+<kbd>N</kbd> New entry
        </div>
      </div>
    </div>
  `;
}

/**
 * Render skeleton loading placeholders for entries
 * @param {number} count - Number of skeleton items
 * @returns {string} Skeleton HTML
 */
export function renderEntrySkeleton(count = 5) {
  return `
    <div class="vault-skeleton-list" aria-hidden="true" role="status" aria-label="Loading entries">
      ${Array(count).fill('').map(() => `
        <div class="vault-skeleton-entry">
          <div class="vault-skeleton vault-skeleton-icon"></div>
          <div class="vault-skeleton-content">
            <div class="vault-skeleton vault-skeleton-title"></div>
            <div class="vault-skeleton vault-skeleton-subtitle"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render skeleton loading for detail panel
 * @returns {string} Skeleton HTML
 */
export function renderDetailSkeleton() {
  return `
    <div class="vault-skeleton-detail" aria-hidden="true" role="status" aria-label="Loading details">
      <div class="vault-skeleton-detail-header">
        <div class="vault-skeleton vault-skeleton-icon-lg"></div>
        <div class="vault-skeleton-info">
          <div class="vault-skeleton vault-skeleton-title-lg"></div>
          <div class="vault-skeleton vault-skeleton-badge"></div>
        </div>
      </div>
      <div class="vault-skeleton-detail-body">
        <div class="vault-skeleton-field">
          <div class="vault-skeleton vault-skeleton-label"></div>
          <div class="vault-skeleton vault-skeleton-input"></div>
        </div>
        <div class="vault-skeleton-field">
          <div class="vault-skeleton vault-skeleton-label"></div>
          <div class="vault-skeleton vault-skeleton-input"></div>
        </div>
        <div class="vault-skeleton-field">
          <div class="vault-skeleton vault-skeleton-label"></div>
          <div class="vault-skeleton vault-skeleton-input"></div>
        </div>
      </div>
    </div>
  `;
}
