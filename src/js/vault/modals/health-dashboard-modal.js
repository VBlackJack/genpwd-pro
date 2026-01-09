/**
 * @fileoverview Health Dashboard Modal Templates
 * Security dashboard modal for password health analysis
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Health stat card definitions
 * Note: labelKey values are i18n keys resolved at render time via t()
 */
export const HEALTH_CARDS = [
  { id: 'total', icon: '📊', labelKey: 'vault.health.totalEntries', cssClass: 'vault-health-total' },
  { id: 'strong', icon: '✅', labelKey: 'vault.health.strongPasswords', cssClass: 'vault-health-strong', filter: 'strong' },
  { id: 'weak', icon: '⚠️', labelKey: 'vault.health.weakPasswords', cssClass: 'vault-health-weak', filter: 'weak' },
  { id: 'reused', icon: '🔄', labelKey: 'vault.health.reusedPasswords', cssClass: 'vault-health-reused', filter: 'reused' },
  { id: 'old', icon: '📅', labelKey: 'vault.health.oldPasswords', cssClass: 'vault-health-old', filter: 'old' },
  { id: '2fa', icon: '🛡️', labelKey: 'vault.health.with2FA', cssClass: 'vault-health-2fa' }
];

/**
 * Render close button
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
function renderCloseBtn(t = (k) => k) {
  return `
    <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
}

/**
 * Render score gauge
 * @param {Object} options
 * @param {number} options.score - Score value (0-100)
 * @param {string} options.scoreColor - CSS color for score
 * @param {string} options.scoreLabel - Score label (e.g., "Excellent")
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderScoreGauge(options = {}) {
  const { score = 0, scoreColor = 'var(--vault-primary)', scoreLabel = 'N/A', t = (k) => k } = options;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - score / 100);

  return `
    <div class="vault-health-score">
      <div class="vault-score-gauge" data-score-color="${scoreColor}" data-score-percent="${score}">
        <svg aria-hidden="true" viewBox="0 0 120 120" class="vault-score-ring">
          <circle class="vault-score-bg" cx="60" cy="60" r="54" />
          <circle class="vault-score-progress" cx="60" cy="60" r="54"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}" />
        </svg>
        <div class="vault-score-content">
          <span class="vault-score-value">${score}</span>
          <span class="vault-score-max">/100</span>
        </div>
      </div>
      <div class="vault-health-status" data-score-color="${scoreColor}">${scoreLabel}</div>
      <div class="vault-health-subtitle">${t('vault.health.overallScore')}</div>
    </div>
  `;
}

/**
 * Render health stat card
 * @param {Object} options
 * @param {string} options.icon - Card icon
 * @param {number} options.value - Stat value
 * @param {string} options.label - Card label
 * @param {string} options.cssClass - Additional CSS class
 * @param {string} options.filter - Filter action (optional)
 * @returns {string} HTML string
 */
export function renderHealthCard(options = {}) {
  const { icon, value = 0, label, cssClass = '', filter } = options;
  const clickable = filter ? 'clickable' : '';
  const dataFilter = filter ? `data-filter="${filter}"` : '';

  return `
    <div class="vault-health-card ${cssClass} ${clickable}" ${dataFilter}>
      <div class="vault-health-card-icon">${icon}</div>
      <div class="vault-health-card-value">${value}</div>
      <div class="vault-health-card-label">${label}</div>
    </div>
  `;
}

/**
 * Render health stats grid
 * @param {Object} options
 * @param {Object} options.report - Audit report
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderHealthGrid(options = {}) {
  const { report = {}, t = (k) => k } = options;
  const stats = report.stats || {};

  const cards = [
    { icon: '📊', value: report.totalEntries || 0, label: t('vault.health.totalEntries'), cssClass: 'vault-health-total' },
    { icon: '✅', value: stats.strongPasswords || 0, label: t('vault.health.strongPasswords'), cssClass: 'vault-health-strong', filter: 'strong' },
    { icon: '⚠️', value: stats.weakPasswords || 0, label: t('vault.health.weakPasswords'), cssClass: 'vault-health-weak', filter: 'weak' },
    { icon: '🔄', value: stats.reusedPasswords || 0, label: t('vault.health.reusedPasswords'), cssClass: 'vault-health-reused', filter: 'reused' },
    { icon: '📅', value: stats.oldPasswords || 0, label: t('vault.health.oldPasswords'), cssClass: 'vault-health-old', filter: 'old' },
    { icon: '🛡️', value: stats.with2FA || 0, label: t('vault.health.with2FA'), cssClass: 'vault-health-2fa' }
  ];

  return `
    <div class="vault-health-grid" aria-live="polite" aria-atomic="true">
      ${cards.map(card => renderHealthCard(card)).join('')}
    </div>
  `;
}

/**
 * Render recommendation item
 * @param {Object} rec - Recommendation object
 * @returns {string} HTML string
 */
export function renderRecommendation(rec) {
  return `
    <div class="vault-recommendation vault-recommendation-${rec.priority} clickable" data-filter="${rec.filter}">
      <span class="vault-recommendation-icon">${rec.icon}</span>
      <div class="vault-recommendation-content">
        <div class="vault-recommendation-title">${rec.message}</div>
        <div class="vault-recommendation-action">${rec.action}</div>
      </div>
      <svg class="vault-recommendation-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `;
}

/**
 * Render recommendations section
 * @param {Array} recommendations - List of recommendations
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderRecommendations(recommendations = [], t = (k) => k) {
  if (recommendations.length === 0) {
    return `
      <div class="vault-health-success">
        <span class="vault-health-success-icon">🎉</span>
        <span>${t('vault.health.excellentSecurity')}</span>
      </div>
    `;
  }

  return `
    <div class="vault-health-recommendations">
      <h4>${t('vault.health.recommendations')}</h4>
      <div class="vault-recommendation-list">
        ${recommendations.map(renderRecommendation).join('')}
      </div>
    </div>
  `;
}

/**
 * Render breach check section
 * @param {Object} options
 * @param {boolean} options.hasAuditFilter - Whether audit filter is active
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderBreachSection(options = {}) {
  const { hasAuditFilter = false, t = (k) => k } = options;

  return `
    <div class="vault-health-actions">
      <button class="vault-btn vault-btn-outline" id="btn-check-breaches" data-loading-text="${t('vault.common.checking')}">
        <svg class="btn-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <span class="btn-spinner" hidden><span class="vault-spinner-small"></span></span>
        <span class="btn-text">${t('vault.health.checkBreaches')}</span>
      </button>
      ${hasAuditFilter ? `
        <button class="vault-btn vault-btn-secondary" id="btn-clear-audit-filter">
          ${t('vault.health.clearFilter')}
        </button>
      ` : ''}
    </div>

    <div class="vault-health-breaches" id="breach-results" hidden>
      <h4>${t('vault.breach.checkResults')}</h4>
      <div class="vault-breach-loading" id="breach-loading">
        <span class="vault-spinner-small"></span>
        ${t('vault.common.checking')}
      </div>
      <div class="vault-breach-results" id="breach-list" role="region" aria-live="polite" aria-label="${t('vault.aria.breachResults')}"></div>
    </div>
  `;
}

/**
 * Render breach results - safe
 * @param {number} checkedCount - Number of passwords checked
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderBreachResultsSafe(checkedCount, t = (k) => k) {
  return `
    <div class="vault-breach-safe">
      <span class="vault-breach-icon" aria-hidden="true">✅</span>
      <span>${t('vault.health.noCompromised', { count: checkedCount })}</span>
    </div>
  `;
}

/**
 * Render breach results - compromised
 * @param {Array} compromised - List of compromised entries
 * @param {number} totalChecked - Total number checked
 * @param {Function} formatCount - Function to format breach count
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderBreachResultsCompromised(compromised, totalChecked, formatCount = (n) => n.toString(), t = (k) => k) {
  return `
    <div class="vault-breach-warning">
      <span class="vault-breach-icon" aria-hidden="true">🚨</span>
      <span>${t('vault.health.compromisedFound', { count: compromised.length, total: totalChecked })}</span>
    </div>
    <ul class="vault-breach-list">
      ${compromised.map(({ entry, count }) => `
        <li class="vault-breach-item" data-entry-id="${entry.id}">
          <span class="vault-breach-title">${escapeHtml(entry.title)}</span>
          <span class="vault-breach-count">${formatCount(count)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Render health dashboard modal
 * @param {Object} options
 * @param {Object} options.report - Audit report
 * @param {Array} options.recommendations - Recommendations list
 * @param {Function} options.getScoreColor - Function to get score color
 * @param {Function} options.getScoreLabel - Function to get score label
 * @param {boolean} options.hasAuditFilter - Whether audit filter is active
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderHealthDashboardModal(options = {}) {
  const {
    report = null,
    recommendations = [],
    getScoreColor,
    getScoreLabel,
    hasAuditFilter = false,
    t = (k) => k
  } = options;

  // If no report, return empty modal shell
  if (!report) {
    return renderEmptyHealthModal({ t });
  }

  const scoreColor = getScoreColor?.(report.score) || 'var(--vault-primary)';
  const scoreLabel = getScoreLabel?.(report.score) || 'N/A';

  return `
    <div class="vault-modal-overlay" id="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-title">
      <div class="vault-modal vault-modal-health">
        <div class="vault-modal-header">
          <h3 id="health-title">${t('vault.health.securityDashboard')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <div class="vault-modal-body">
          ${renderScoreGauge({ score: report.score, scoreColor, scoreLabel, t })}
          ${renderHealthGrid({ report, t })}
          ${renderRecommendations(recommendations, t)}
          ${renderBreachSection({ hasAuditFilter, t })}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render empty/loading health modal
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEmptyHealthModal(options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-modal-overlay" id="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-title">
      <div class="vault-modal vault-modal-health">
        <div class="vault-modal-header">
          <h3 id="health-title">${t('vault.health.securityDashboard')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <div class="vault-modal-body">
          <div class="vault-health-loading">
            <span class="vault-spinner"></span>
            <p>${t('vault.health.analyzing')}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render legacy health modal (backwards compatibility)
 * @param {Object} stats - Health statistics
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
export function renderLegacyHealthModal(stats, t = (k) => k) {
  return `
    <div class="vault-modal-overlay" id="legacy-health-modal" role="dialog" aria-modal="true" aria-labelledby="legacy-health-title">
      <div class="vault-modal vault-modal-health">
        <div class="vault-modal-header">
          <h3 id="legacy-health-title">${t('vault.health.passwordHealth')}</h3>
          ${renderCloseBtn(t)}
        </div>
        <div class="vault-modal-body">
          <div class="vault-health-score">
            <div class="vault-health-circle ${stats.scoreClass}">
              <span class="vault-health-value">${stats.score}</span>
              <span class="vault-health-label">/ 100</span>
            </div>
            <div class="vault-health-status">${stats.status}</div>
          </div>
          <div class="vault-health-grid">
            <div class="vault-health-card"><div class="vault-health-card-value">${stats.total}</div><div class="vault-health-card-label">${t('vault.health.total')}</div></div>
            <div class="vault-health-card"><div class="vault-health-card-value">${stats.strong}</div><div class="vault-health-card-label">${t('vault.filters.strong')}</div></div>
            <div class="vault-health-card"><div class="vault-health-card-value">${stats.weak}</div><div class="vault-health-card-label">${t('vault.filters.weak')}</div></div>
            <div class="vault-health-card"><div class="vault-health-card-value">${stats.reused}</div><div class="vault-health-card-label">${t('vault.filters.reused')}</div></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Set breach check button loading state
 * @param {boolean} isLoading - Whether button is in loading state
 */
export function setBreachButtonLoading(isLoading) {
  const btn = document.getElementById('btn-check-breaches');
  if (!btn) return;

  const icon = btn.querySelector('.btn-icon');
  const spinner = btn.querySelector('.btn-spinner');
  const text = btn.querySelector('.btn-text');

  btn.disabled = isLoading;
  btn.setAttribute('aria-busy', String(isLoading));

  if (icon) icon.hidden = isLoading;
  if (spinner) spinner.hidden = !isLoading;
  if (text && isLoading) {
    text.dataset.originalText = text.textContent;
    text.textContent = btn.dataset.loadingText || text.textContent;
  } else if (text && !isLoading && text.dataset.originalText) {
    text.textContent = text.dataset.originalText;
  }
}
