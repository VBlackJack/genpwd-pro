/**
 * @fileoverview Empty States and Skeleton Views
 * Loading placeholders and empty state displays
 */

import { escapeHtml } from '../utils/formatter.js';
import { i18n } from '../../utils/i18n.js';

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
          <svg aria-hidden="true" viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
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
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
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
        <svg aria-hidden="true" viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="25" y="30" width="70" height="50" rx="4" stroke-dasharray="4 2" opacity="0.3"/>
          <rect x="35" y="25" width="50" height="40" rx="3"/>
          <circle cx="60" cy="45" r="8"/>
          <line x1="60" y1="50" x2="60" y2="55" stroke-width="2" stroke-linecap="round"/>
          <path d="M45 70 L60 60 L75 70" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        </svg>
      </div>
      <h3 class="vault-empty-title">${t('vault.welcome.title')}</h3>
      <p class="vault-empty-text">${t('vault.welcome.subtitle')}</p>

      <!-- Benefits Section (BMAD Motivation) -->
      <ul class="vault-benefits" role="list" aria-label="${t('vault.benefits.title')}">
        <li class="vault-benefit">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>${t('vault.benefits.secure')}</span>
        </li>
        <li class="vault-benefit">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>${t('vault.benefits.autofill')}</span>
        </li>
        <li class="vault-benefit">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>${t('vault.benefits.sync')}</span>
        </li>
      </ul>

      <!-- Quick Actions Grid (BMAD Enhancement) -->
      <div class="vault-quick-actions" role="group" aria-label="${t('vault.quickActions.title')}">
        <h4 class="vault-quick-actions-title">${t('vault.quickActions.title')}</h4>
        <div class="vault-quick-actions-grid">
          <button class="vault-quick-action" id="btn-welcome-create">
            <span class="vault-quick-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </span>
            <span class="vault-quick-action-label">${t('vault.quickActions.addFirst')}</span>
            <span class="vault-quick-action-hint">${t('vault.quickActions.addFirstHint')}</span>
          </button>

          <button class="vault-quick-action" id="btn-welcome-import">
            <span class="vault-quick-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </span>
            <span class="vault-quick-action-label">${t('vault.quickActions.import')}</span>
            <span class="vault-quick-action-hint">${t('vault.quickActions.importHint')}</span>
          </button>

          <button class="vault-quick-action" id="btn-welcome-generate">
            <span class="vault-quick-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M13 6l-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3 1.5 3 3 1.5-3 1.5z" fill="currentColor" stroke="none"></path>
              </svg>
            </span>
            <span class="vault-quick-action-label">${t('vault.quickActions.generate')}</span>
            <span class="vault-quick-action-hint">${t('vault.quickActions.generateHint')}</span>
          </button>
        </div>
      </div>

      <div class="vault-empty-tips">
        <span class="vault-empty-tip">${t('vault.tips.quickAdd')}</span>
        <span class="vault-empty-tip">${t('vault.tips.autoFill')}</span>
      </div>
    </div>
  `;
}

/**
 * Render no selection placeholder for detail panel
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} Placeholder HTML
 */
export function renderNoSelection({ t = (k) => k } = {}) {
  return `
    <div class="vault-detail-placeholder">
      <div class="vault-detail-placeholder-icon" aria-hidden="true">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </div>
      <p>${t('vault.detail.selectEntry')}</p>
      <div class="vault-shortcut-hints">
        <div class="vault-shortcut-hint">
          <kbd>↑</kbd><kbd>↓</kbd> ${t('vault.shortcuts.navigate')}
        </div>
        <div class="vault-shortcut-hint">
          <kbd>Ctrl</kbd>+<kbd>N</kbd> ${t('vault.shortcuts.newEntry')}
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
    <div class="sr-only" role="status" aria-live="polite">${i18n.t('vault.aria.loadingEntries')}</div>
    <div class="vault-skeleton-list" aria-hidden="true">
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
    <div class="sr-only" role="status" aria-live="polite">${i18n.t('vault.aria.loadingDetails')}</div>
    <div class="vault-skeleton-detail" aria-hidden="true">
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
