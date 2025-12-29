/**
 * @fileoverview Lock Screen Templates
 * HTML templates for the vault lock screen
 */

import { ICON_LOCK, ICON_UNLOCK, ICON_PLUS, ICON_FOLDER, ICON_HELLO, ICON_CLOSE, ICON_CHECK } from '../icons.js';

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format date for display
 * @param {string|Date} dateStr - Date to format
 * @param {string} locale - Locale string
 * @returns {string} Formatted date
 */
function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Generate lock screen main template
 * @param {Object} options - Template options
 * @param {Object} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderLockScreen({ t }) {
  return `
    <div class="vault-lock-screen">
      <div class="vault-lock-content">
        <div class="vault-lock-icon">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            ${ICON_LOCK}
          </svg>
        </div>
        <h2>${t('vault.lockScreen.title')}</h2>
        <p class="vault-lock-subtitle">${t('vault.lockScreen.subtitle')}</p>

        <div class="vault-selector" id="vault-selector" role="listbox" aria-label="${t('vault.aria.vaultSelection')}">
          <div class="vault-loading"><div class="vault-spinner"></div></div>
        </div>

        <form class="vault-unlock-form" id="unlock-form">
          <div class="vault-input-group">
            <input type="password" class="vault-input" id="vault-password"
                   placeholder="${t('vault.lockScreen.masterPassword')}" autocomplete="current-password"
                   aria-label="${t('vault.lockScreen.masterPassword')}" aria-required="true">
            <button type="button" class="vault-input-btn" id="toggle-password"
                    title="${t('vault.lockScreen.showHide')}" aria-label="${t('vault.lockScreen.showHide')}" aria-pressed="false">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          <button type="submit" class="vault-btn vault-btn-primary vault-btn-full" id="btn-unlock">
            <svg class="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              ${ICON_UNLOCK}
            </svg>
            <svg class="btn-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" hidden>
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" stroke-linecap="round"/>
            </svg>
            <span class="btn-text">${t('vault.lockScreen.unlock')}</span>
          </button>
          <div class="vault-unlock-progress" id="unlock-progress" hidden>
            <div class="vault-progress-bar"><div class="vault-progress-fill"></div></div>
            <span class="vault-progress-text">${t('vault.lockScreen.derivingKey')}</span>
          </div>
        </form>

        <!-- Windows Hello Button (shown when available) -->
        <div class="vault-hello-section" id="hello-section" hidden>
          <div class="vault-hello-divider">
            <span>${t('vault.lockScreen.or')}</span>
          </div>
          <button type="button" class="vault-btn vault-btn-hello" id="btn-hello-unlock">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              ${ICON_HELLO}
            </svg>
            <span>Windows Hello</span>
          </button>
        </div>

        <div class="vault-lock-actions">
          <button type="button" class="vault-link-btn" id="btn-create-vault">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              ${ICON_PLUS}
            </svg>
            ${t('vault.lockScreen.newVault')}
          </button>
          <span class="vault-action-divider">|</span>
          <button type="button" class="vault-link-btn" id="btn-open-external">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              ${ICON_FOLDER}
            </svg>
            ${t('vault.lockScreen.openFile')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render vault list for lock screen
 * @param {Array} vaults - List of vaults
 * @param {Object} options - Options
 * @param {Object} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderVaultList(vaults, { t }) {
  if (vaults.length === 0) {
    return `
      <div class="vault-empty-small">
        <p>${t('vault.lockScreen.noVaultFound')}</p>
      </div>
    `;
  }

  return `
    <div class="vault-list" role="listbox">
      ${vaults.map((v, i) => `
        <div class="vault-list-item ${i === 0 ? 'selected' : ''} ${v.isMissing ? 'vault-missing' : ''}"
             data-vault-id="${v.id}"
             role="option"
             aria-selected="${i === 0}"
             tabindex="${i === 0 ? 0 : -1}">
          <div class="vault-list-icon">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              ${ICON_LOCK}
            </svg>
          </div>
          <div class="vault-list-info">
            <div class="vault-list-name">${escapeHtml(v.name || v.id.substring(0, 8))}</div>
            <div class="vault-list-meta">${v.isMissing ? '⚠️ ' + t('vault.messages.fileNotFound') : formatDate(v.modifiedAt)}</div>
          </div>
          <button type="button" class="vault-list-forget" data-vault-id="${v.id}" title="${t('vault.messages.forgetVault')}" aria-label="${t('vault.messages.forgetVault')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              ${ICON_CLOSE}
            </svg>
          </button>
          <div class="vault-list-check" aria-hidden="true">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3">
              ${ICON_CHECK}
            </svg>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render vault list loading state
 * @returns {string} HTML string
 */
export function renderVaultListLoading() {
  return `<div class="vault-loading"><div class="vault-spinner"></div></div>`;
}

/**
 * Render vault list error state
 * @param {Object} options - Options
 * @param {Object} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderVaultListError({ t }) {
  return `<div class="vault-error">${t('vault.messages.errorLoadingVaults')}</div>`;
}
