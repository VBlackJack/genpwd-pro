/**
 * @fileoverview Password Display Utilities
 * UI rendering functions for password strength, history, and age
 */

import { escapeHtml, maskHistoryPassword, getRelativeTime } from './formatter.js';
import { calculatePasswordStrength } from './password-utils.js';

/**
 * Render password strength indicator
 * @param {string} password - Password to check
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderPasswordStrength(password, t = (k) => k) {
  const strength = calculatePasswordStrength(password, t);
  return `
    <div class="vault-password-strength">
      <div class="vault-strength-bar">
        <div class="vault-strength-fill ${strength.level}" data-strength-width="${strength.percent}"></div>
      </div>
      <span class="vault-strength-text ${strength.level}">
        <span class="vault-strength-icon">${strength.icon}</span>
        ${strength.label}
      </span>
    </div>
  `;
}

/**
 * Render password history section
 * @param {Object} entry - Entry with password history
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderPasswordHistory(entry, t = (k) => k) {
  const history = entry.data?.passwordHistory || [];
  if (history.length === 0) return '';

  const historyItems = history.map((h, idx) => {
    const date = new Date(h.changedAt);
    const relativeTime = getRelativeTime(date);
    const maskedPwd = maskHistoryPassword(h.password);

    return `
      <div class="vault-history-item" data-index="${idx}">
        <div class="vault-history-info">
          <span class="vault-history-password" title="${t('vault.history.clickToReveal')}">${maskedPwd}</span>
          <span class="vault-history-date">${relativeTime}</span>
          ${h.reason ? `<span class="vault-history-reason">${escapeHtml(h.reason)}</span>` : ''}
        </div>
        <div class="vault-history-actions">
          <button class="vault-field-btn copy-history-pwd" data-password="${escapeHtml(h.password)}" title="${t('vault.common.copy')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="vault-field-btn restore-history-pwd" data-index="${idx}" title="${t('vault.actions.restore')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="vault-password-history">
      <button class="vault-history-toggle" aria-expanded="false">
        <svg class="vault-history-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>${t('vault.history.title')} (${history.length})</span>
      </button>
      <div class="vault-history-list" hidden>
        ${historyItems}
      </div>
    </div>
  `;
}

/**
 * Render password age indicator
 * @param {Object} entry - Entry to check
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderPasswordAge(entry, t = (k) => k) {
  // Only show for login entries with passwords
  if (entry.type !== 'login' || !entry.data?.password) return '';

  const modifiedAt = new Date(entry.modifiedAt);
  const now = new Date();
  const daysSinceModified = Math.floor((now - modifiedAt) / (1000 * 60 * 60 * 24));

  let ageClass = 'good';
  let ageLabel = t('vault.age.recent');
  let ageIcon = 'check';

  if (daysSinceModified > 365) {
    ageClass = 'critical';
    const years = Math.floor(daysSinceModified / 365);
    ageLabel = `${t('vault.age.years', { count: years })} - ${t('vault.age.renewalRecommended')}`;
    ageIcon = 'alert';
  } else if (daysSinceModified > 180) {
    ageClass = 'warning';
    ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
    ageIcon = 'clock';
  } else if (daysSinceModified > 90) {
    ageClass = 'fair';
    ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
    ageIcon = 'clock';
  } else if (daysSinceModified > 30) {
    ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
  } else {
    ageLabel = daysSinceModified === 0 ? t('vault.age.today') : t('vault.age.days', { count: daysSinceModified });
  }

  return `
    <div class="vault-password-age ${ageClass}">
      <div class="vault-age-icon">
        ${ageIcon === 'alert' ? `
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        ` : ageIcon === 'clock' ? `
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        ` : `
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        `}
      </div>
      <div class="vault-age-info">
        <span class="vault-age-label">${t('vault.age.label')}</span>
        <span class="vault-age-value">${ageLabel}</span>
      </div>
    </div>
  `;
}
