/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Usage Statistics Modal - BMAD UX Improvement
 * Displays user generation statistics in a dashboard format
 */

import { Modal } from './modal.js';
import { t } from '../../utils/i18n.js';
import {
  getStats,
  getAverageEntropy,
  getStrongestEntropy,
  getModeBreakdown,
  getDailyHistory,
  resetStats
} from '../../utils/usage-stats.js';
import {
  renderAchievementsSection,
  applyAchievementProgressWidths
} from '../components/achievement-display.js';

/**
 * Stats Modal - Shows usage statistics dashboard with Canvas charts
 * BMAD Phase 4 Enhancement
 */
export class StatsModal extends Modal {
  constructor() {
    super('stats-modal');
  }

  get template() {
    const stats = getStats();
    const avgEntropy = getAverageEntropy();
    const strongest = getStrongestEntropy();
    const breakdown = getModeBreakdown();

    return `
      <div class="vault-modal-header">
        <h2 class="vault-modal-title">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 20V10"></path>
            <path d="M12 20V4"></path>
            <path d="M6 20v-6"></path>
          </svg>
          ${t('stats.title')}
        </h2>
        <button type="button" class="vault-modal-close" data-action="close" aria-label="${t('common.close')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body">
        <div class="stats-dashboard">
          <!-- Main Stats -->
          <div class="stats-grid">
            <div class="stat-card stat-primary">
              <span class="stat-value">${stats.totalGenerated.toLocaleString()}</span>
              <span class="stat-label">${t('stats.totalGenerated')}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.totalCopied.toLocaleString()}</span>
              <span class="stat-label">${t('stats.totalCopied')}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.totalSaved.toLocaleString()}</span>
              <span class="stat-label">${t('stats.totalSaved')}</span>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="stats-charts-row">
            <!-- Donut Chart for Mode Breakdown -->
            <div class="stats-chart-container">
              <h3 class="stats-section-title">${t('stats.modeBreakdown')}</h3>
              <div class="donut-chart-wrapper">
                <canvas id="stats-donut-chart" width="160" height="160" role="img" aria-label="${t('stats.modeBreakdownChart')}"></canvas>
                <div class="donut-chart-legend">
                  <div class="legend-item">
                    <span class="legend-dot syllables"></span>
                    <span>${t('modes.syllables')}: ${breakdown.syllables}%</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-dot passphrase"></span>
                    <span>${t('modes.passphrase')}: ${breakdown.passphrase}%</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-dot leet"></span>
                    <span>${t('modes.leet')}: ${breakdown.leet}%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Entropy Stats -->
            <div class="stats-chart-container">
              <h3 class="stats-section-title">${t('stats.securityMetrics')}</h3>
              <div class="entropy-stats-visual">
                <div class="entropy-meter">
                  <div class="entropy-meter-fill" data-entropy="${avgEntropy}"></div>
                  <span class="entropy-meter-label">${avgEntropy} bits ${t('stats.avgEntropy')}</span>
                </div>
                <div class="entropy-meter strongest">
                  <div class="entropy-meter-fill" data-entropy="${strongest}"></div>
                  <span class="entropy-meter-label">${strongest} bits ${t('stats.strongestPassword')}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Chart - BMAD Phase 6 -->
          <div class="stats-section stats-activity-section">
            <h3 class="stats-section-title">${t('stats.recentActivity')}</h3>
            <div class="activity-chart" id="activity-chart">
              ${this.#renderActivityBars()}
            </div>
          </div>

          <!-- Mode Breakdown Bars (accessible fallback) -->
          <div class="stats-section stats-bars-fallback">
            <div class="mode-bars">
              <div class="mode-bar">
                <span class="mode-name">${t('modes.syllables')}</span>
                <div class="mode-bar-track">
                  <div class="mode-bar-fill syllables" data-width="${breakdown.syllables}"></div>
                </div>
                <span class="mode-percent">${breakdown.syllables}%</span>
              </div>
              <div class="mode-bar">
                <span class="mode-name">${t('modes.passphrase')}</span>
                <div class="mode-bar-track">
                  <div class="mode-bar-fill passphrase" data-width="${breakdown.passphrase}"></div>
                </div>
                <span class="mode-percent">${breakdown.passphrase}%</span>
              </div>
              <div class="mode-bar">
                <span class="mode-name">${t('modes.leet')}</span>
                <div class="mode-bar-track">
                  <div class="mode-bar-fill leet" data-width="${breakdown.leet}"></div>
                </div>
                <span class="mode-percent">${breakdown.leet}%</span>
              </div>
            </div>
          </div>

          <!-- Achievements Section -->
          ${renderAchievementsSection()}

          ${stats.firstUse ? `
          <div class="stats-footer-info">
            <span>${t('stats.memberSince')}: ${new Date(stats.firstUse).toLocaleDateString()}</span>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="vault-modal-footer">
        <button type="button" class="vault-btn vault-btn-ghost" id="stats-reset-btn">
          ${t('stats.reset')}
        </button>
        <button type="button" class="vault-btn vault-btn-primary" data-action="close">
          ${t('common.close')}
        </button>
      </div>
    `;
  }

  show() {
    // Refresh template content before showing
    if (this._element) {
      const modal = this._element.querySelector('.vault-modal');
      if (modal) {
        modal.innerHTML = this.template;
        this._setupBaseEventHandlers();
      }
    }
    super.show();
    this.#bindEvents();
    this.#renderCharts();
    this.#applyBarWidths();
    // BMAD Phase 6: Apply activity bar heights
    this.#applyActivityBarHeights();
    // Apply achievement progress bar widths
    applyAchievementProgressWidths(this.element);
  }

  #bindEvents() {
    const resetBtn = this.element?.querySelector('#stats-reset-btn');
    resetBtn?.addEventListener('click', () => {
      if (confirm(t('stats.confirmReset'))) {
        resetStats();
        // Refresh modal by hiding and showing
        this.hide();
        setTimeout(() => this.show(), 100);
      }
    });
  }

  /**
   * Apply widths to mode bars using CSS (CSP-compliant)
   */
  #applyBarWidths() {
    const bars = this.element?.querySelectorAll('.mode-bar-fill[data-width]');
    bars?.forEach(bar => {
      const width = bar.getAttribute('data-width');
      if (width) {
        bar.style.setProperty('width', `${width}%`);
      }
    });

    // Apply entropy meter fills
    const meters = this.element?.querySelectorAll('.entropy-meter-fill[data-entropy]');
    meters?.forEach(meter => {
      const entropy = parseInt(meter.getAttribute('data-entropy') || '0', 10);
      // Max entropy scale is 150 bits
      const percent = Math.min(100, (entropy / 150) * 100);
      meter.style.setProperty('width', `${percent}%`);
    });
  }

  /**
   * Render Canvas charts (Donut chart for mode breakdown)
   */
  #renderCharts() {
    const canvas = this.element?.querySelector('#stats-donut-chart');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const breakdown = getModeBreakdown();
    const data = [
      { value: breakdown.syllables, color: '#06b6d4' }, // cyan
      { value: breakdown.passphrase, color: '#8b5cf6' }, // purple
      { value: breakdown.leet, color: '#10b981' } // green
    ];

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const innerRadius = radius * 0.6; // Donut hole

    let startAngle = -Math.PI / 2; // Start at top
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

    // Draw donut segments
    data.forEach(segment => {
      if (segment.value === 0) return;

      const sliceAngle = (segment.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      startAngle = endAngle;
    });

    // Draw center text (total count)
    const stats = getStats();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e5e7eb';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stats.totalGenerated.toString(), centerX, centerY - 8);

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#9ca3af';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(t('stats.total'), centerX, centerY + 12);
  }

  /**
   * Render activity bars for the last 7 days - BMAD Phase 6
   * @returns {string} HTML string for activity bars
   */
  #renderActivityBars() {
    const history = getDailyHistory(7);
    const maxGenerated = Math.max(...history.map(d => d.generated), 1);

    const dayNames = ['stats.days.sun', 'stats.days.mon', 'stats.days.tue',
                      'stats.days.wed', 'stats.days.thu', 'stats.days.fri', 'stats.days.sat'];

    return history.map(day => {
      const date = new Date(day.date);
      const dayName = t(dayNames[date.getDay()]);
      const heightPercent = (day.generated / maxGenerated) * 100;
      const isToday = day.date === new Date().toISOString().split('T')[0];

      return `
        <div class="activity-bar-wrapper${isToday ? ' today' : ''}">
          <div class="activity-bar-container">
            <div class="activity-bar" data-height="${heightPercent}" title="${day.generated} ${t('stats.generated')}"></div>
          </div>
          <span class="activity-bar-label">${dayName}</span>
          <span class="activity-bar-count">${day.generated}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Apply activity bar heights (CSP-compliant) - BMAD Phase 6
   */
  #applyActivityBarHeights() {
    const bars = this.element?.querySelectorAll('.activity-bar[data-height]');
    bars?.forEach(bar => {
      const height = bar.getAttribute('data-height');
      if (height) {
        bar.style.setProperty('height', `${height}%`);
      }
    });
  }
}

// Export singleton instance
export const statsModal = new StatsModal();
