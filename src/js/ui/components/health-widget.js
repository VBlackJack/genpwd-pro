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
 * @fileoverview Health Widget Component
 * Mini security score widget for vault header (BMAD Motivation)
 */

import { t } from '../../utils/i18n.js';
import { getIcon } from '../../vault/views/icons.js';

/** Score color thresholds */
const SCORE_COLORS = {
  EXCELLENT: { min: 80, color: 'var(--color-success, #10b981)', label: 'excellent' },
  GOOD: { min: 60, color: 'var(--color-warning, #f59e0b)', label: 'good' },
  POOR: { min: 0, color: 'var(--color-danger, #ef4444)', label: 'poor' }
};

/**
 * Health Widget Component
 * Displays a mini circular progress indicator with security score
 */
export class HealthWidget {
  /**
   * @param {string|HTMLElement} container - Container element or selector
   * @param {Object} options - Component options
   * @param {Function} options.onClick - Callback when widget is clicked
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      onClick: null,
      size: 32,
      strokeWidth: 3,
      ...options
    };

    this.element = null;
    this.score = 0;
    this.abortController = new AbortController();

    this.#init();
  }

  #init() {
    if (!this.container) return;

    this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = 'health-widget';
    this.element.setAttribute('role', 'button');
    this.element.setAttribute('aria-label', t('vault.health.widgetLabel'));
    this.element.setAttribute('title', t('vault.health.widgetTitle'));

    this.#render();
    this.container.appendChild(this.element);

    // Attach click handler
    if (this.options.onClick) {
      this.element.addEventListener('click', this.options.onClick, {
        signal: this.abortController.signal
      });
    }
  }

  #render() {
    const { size, strokeWidth } = this.options;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - this.score / 100);
    const scoreColor = this.#getScoreColor();

    this.element.innerHTML = `
      <svg class="health-widget-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle
          class="health-widget-bg"
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          stroke-width="${strokeWidth}"
          fill="none"
          stroke="var(--bg-tertiary, rgba(255,255,255,0.1))"
        />
        <circle
          class="health-widget-progress"
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          stroke-width="${strokeWidth}"
          fill="none"
          stroke="${scoreColor}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
        />
      </svg>
      <span class="health-widget-score" style="color: ${scoreColor}">${this.score}</span>
    `;

    // Update aria-label with current score
    this.element.setAttribute(
      'aria-label',
      t('vault.health.widgetScore', { score: this.score })
    );
  }

  #getScoreColor() {
    if (this.score >= SCORE_COLORS.EXCELLENT.min) {
      return SCORE_COLORS.EXCELLENT.color;
    } else if (this.score >= SCORE_COLORS.GOOD.min) {
      return SCORE_COLORS.GOOD.color;
    }
    return SCORE_COLORS.POOR.color;
  }

  #getScoreLabel() {
    if (this.score >= SCORE_COLORS.EXCELLENT.min) {
      return t('vault.health.scoreExcellent');
    } else if (this.score >= SCORE_COLORS.GOOD.min) {
      return t('vault.health.scoreGood');
    }
    return t('vault.health.scorePoor');
  }

  /**
   * Update the displayed score
   * @param {number} score - Score value (0-100)
   * @param {boolean} animate - Whether to animate the change
   */
  updateScore(score, animate = true) {
    const newScore = Math.max(0, Math.min(100, Math.round(score)));

    if (animate && this.element) {
      // Animate score change
      const startScore = this.score;
      const diff = newScore - startScore;
      const duration = 500;
      const startTime = performance.now();

      const animateFrame = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        this.score = Math.round(startScore + diff * eased);
        this.#render();

        if (progress < 1) {
          requestAnimationFrame(animateFrame);
        }
      };

      requestAnimationFrame(animateFrame);
    } else {
      this.score = newScore;
      this.#render();
    }
  }

  /**
   * Get current score
   * @returns {number}
   */
  getScore() {
    return this.score;
  }

  /**
   * Show/hide the widget
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (this.element) {
      this.element.hidden = !visible;
    }
  }

  /**
   * Add pulse animation (when score improves)
   */
  pulse() {
    if (!this.element) return;

    this.element.classList.add('health-widget--pulse');
    setTimeout(() => {
      this.element.classList.remove('health-widget--pulse');
    }, 600);
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.abortController.abort();
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

/**
 * Create and return a health widget instance
 * @param {string|HTMLElement} container
 * @param {Object} options
 * @returns {HealthWidget}
 */
export function createHealthWidget(container, options = {}) {
  return new HealthWidget(container, options);
}
