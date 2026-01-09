/**
 * @fileoverview Entry Field Renderers
 * Specialized field rendering for entry detail view
 */

import { escapeHtml } from '../utils/formatter.js';
import { getExpiryStatus } from '../utils/password-utils.js';
import { t, i18n } from '../../utils/i18n.js';

/**
 * Secure in-memory store for TOTP secrets
 * Prevents secret exposure in DOM data attributes
 * @type {Map<string, {secret: string, title: string, account: string}>}
 */
const totpSecretStore = new Map();

/**
 * Store TOTP data securely in memory
 * @param {string} entryId - Entry ID
 * @param {string} secret - TOTP secret
 * @param {string} title - Entry title
 * @param {string} account - Account/username
 */
export function storeTotpSecret(entryId, secret, title, account) {
  totpSecretStore.set(entryId, { secret, title, account });
}

/**
 * Get TOTP data from secure store
 * @param {string} entryId - Entry ID
 * @returns {{secret: string, title: string, account: string}|null}
 */
export function getTotpSecret(entryId) {
  return totpSecretStore.get(entryId) || null;
}

/**
 * Remove TOTP data from store (call when entry is closed/unloaded)
 * @param {string} entryId - Entry ID
 */
export function clearTotpSecret(entryId) {
  totpSecretStore.delete(entryId);
}

/**
 * Clear all TOTP secrets (call on logout/lock)
 */
export function clearAllTotpSecrets() {
  totpSecretStore.clear();
}

/**
 * Render password expiration field
 * @param {Object} entry - Entry object with data.expiresAt
 * @returns {string} HTML string for expiration field
 */
export function renderExpirationField(entry) {
  if (!entry.data?.expiresAt) return '';

  const status = getExpiryStatus(entry, t);
  const expiresDate = new Date(entry.data.expiresAt);
  const locale = i18n.getLocale() || navigator.language || 'en-US';
  const formattedDate = expiresDate.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let statusClass = '';
  let statusIcon = '📅';
  switch (status.status) {
    case 'expired':
      statusClass = 'expired';
      statusIcon = '⚠️';
      break;
    case 'today':
      statusClass = 'today';
      statusIcon = '⏰';
      break;
    case 'soon':
      statusClass = 'soon';
      statusIcon = '🕐';
      break;
    case 'warning':
      statusClass = 'warning';
      statusIcon = '📅';
      break;
    default:
      statusClass = 'valid';
      statusIcon = '✅';
  }

  return `
    <div class="vault-field vault-expiry-field ${statusClass}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${t('vault.labels.passwordExpiration')}</label>
      </div>
      <div class="vault-expiry-display ${statusClass}">
        <span class="vault-expiry-icon" role="img" aria-hidden="true">${statusIcon}</span>
        <div class="vault-expiry-info">
          <span class="vault-expiry-date">${formattedDate}</span>
          <span class="vault-expiry-status">${status.label}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render TOTP (2FA) field
 * Stores secret securely in memory, not in DOM
 * @param {Object} entry - Entry object with data.totp
 * @returns {string} HTML string for TOTP field
 */
export function renderTOTPField(entry) {
  const totpSecret = entry.data?.totp;
  if (!totpSecret) return '';

  // Store secret in memory instead of DOM for security
  storeTotpSecret(entry.id, totpSecret, entry.title, entry.data?.username || '');

  return `
    <div class="vault-field vault-totp-field" data-key="totp" data-entry-id="${escapeHtml(entry.id)}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${t('vault.labels.totp2FA')}</label>
        <span class="vault-field-hint">(${t('vault.hints.autoRefresh')})</span>
      </div>
      <div class="vault-totp-display">
        <div class="vault-totp-code">
          <span class="totp-digits">------</span>
        </div>
        <div class="vault-totp-timer">
          <svg class="totp-timer-ring" viewBox="0 0 36 36">
            <circle class="totp-timer-bg" cx="18" cy="18" r="16"></circle>
            <circle class="totp-timer-progress" cx="18" cy="18" r="16"></circle>
          </svg>
          <span class="totp-timer-text">--</span>
        </div>
        <button class="vault-field-btn copy-totp" title="${t('vault.actions.copy2FACode')}" aria-label="${t('vault.actions.copy2FACode')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="vault-field-btn show-totp-qr" title="${t('vault.aria.showQRCode')}" aria-label="${t('vault.aria.showQRCode')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </button>
      </div>
    </div>
  `;
}
