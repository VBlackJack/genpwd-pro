/**
 * @fileoverview Entry Field Renderers
 * Specialized field rendering for entry detail view
 */

import { escapeHtml } from '../utils/formatter.js';
import { getExpiryStatus } from '../utils/password-utils.js';
import { t } from '../../utils/i18n.js';

/**
 * Render password expiration field
 * @param {Object} entry - Entry object with data.expiresAt
 * @returns {string} HTML string for expiration field
 */
export function renderExpirationField(entry) {
  if (!entry.data?.expiresAt) return '';

  const status = getExpiryStatus(entry);
  const expiresDate = new Date(entry.data.expiresAt);
  const formattedDate = expiresDate.toLocaleDateString('en-US', {
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
        <label class="vault-field-label">Password expiration</label>
      </div>
      <div class="vault-expiry-display ${statusClass}">
        <span class="vault-expiry-icon">${statusIcon}</span>
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
 * @param {Object} entry - Entry object with data.totp
 * @returns {string} HTML string for TOTP field
 */
export function renderTOTPField(entry) {
  const totpSecret = entry.data?.totp;
  if (!totpSecret) return '';

  return `
    <div class="vault-field vault-totp-field" data-key="totp" data-entry-id="${entry.id}">
      <div class="vault-field-label-row">
        <label class="vault-field-label">Code 2FA (TOTP)</label>
        <span class="vault-field-hint">(actualisation auto)</span>
      </div>
      <div class="vault-totp-display">
        <div class="vault-totp-code" data-secret="${escapeHtml(totpSecret)}">
          <span class="totp-digits">------</span>
        </div>
        <div class="vault-totp-timer">
          <svg class="totp-timer-ring" viewBox="0 0 36 36">
            <circle class="totp-timer-bg" cx="18" cy="18" r="16"></circle>
            <circle class="totp-timer-progress" cx="18" cy="18" r="16"></circle>
          </svg>
          <span class="totp-timer-text">--</span>
        </div>
        <button class="vault-field-btn copy-totp" title="Copier le code 2FA" aria-label="Copier le code 2FA">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="vault-field-btn show-totp-qr" data-secret="${escapeHtml(totpSecret)}" data-title="${escapeHtml(entry.title)}" data-account="${escapeHtml(entry.data?.username || '')}" title="${t('vault.aria.showQRCode')}" aria-label="${t('vault.aria.showQRCode')}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
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
