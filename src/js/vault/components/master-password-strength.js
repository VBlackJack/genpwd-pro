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
 * @fileoverview Master Password Strength Indicator
 * Visual feedback for master password creation (BMAD - Security awareness)
 */

import { t } from '../../utils/i18n.js';

/** Strength levels configuration */
export const STRENGTH_LEVELS = {
  WEAK: { score: 0, color: '#ef4444', key: 'weak', minBits: 0, width: 25 },
  FAIR: { score: 1, color: '#f59e0b', key: 'fair', minBits: 40, width: 50 },
  STRONG: { score: 2, color: '#22c55e', key: 'strong', minBits: 60, width: 75 },
  EXCELLENT: { score: 3, color: '#6366f1', key: 'excellent', minBits: 80, width: 100 }
};

/** Password requirements */
const REQUIREMENTS = [
  { id: 'length', test: (pwd) => pwd.length >= 12 },
  { id: 'mixed', test: (pwd) => /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) },
  { id: 'numbers', test: (pwd) => /[0-9]/.test(pwd) },
  { id: 'special', test: (pwd) => /[^a-zA-Z0-9]/.test(pwd) }
];

/**
 * Master Password Strength Indicator Component
 */
export class MasterPasswordStrength {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Component options
   * @param {boolean} options.showRequirements - Show requirements checklist
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showRequirements: true,
      ...options
    };

    this.currentLevel = null;
    this.#render();
  }

  /**
   * Calculate password strength
   * @param {string} password - Password to evaluate
   * @returns {Object} Strength level
   */
  #calculateStrength(password) {
    if (!password || password.length < 8) return STRENGTH_LEVELS.WEAK;

    // Calculate entropy bits
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

    const entropy = charsetSize > 0 ? Math.log2(charsetSize) * password.length : 0;

    // Penalize common patterns
    let penalty = 0;
    if (/(.)\1{2,}/.test(password)) penalty += 10; // Repeated chars
    if (/^[0-9]+$/.test(password)) penalty += 20; // Only numbers
    if (/^[a-zA-Z]+$/.test(password)) penalty += 10; // Only letters

    const adjustedEntropy = Math.max(0, entropy - penalty);

    if (adjustedEntropy >= 80) return STRENGTH_LEVELS.EXCELLENT;
    if (adjustedEntropy >= 60) return STRENGTH_LEVELS.STRONG;
    if (adjustedEntropy >= 40) return STRENGTH_LEVELS.FAIR;
    return STRENGTH_LEVELS.WEAK;
  }

  /**
   * Update the indicator with a new password
   * @param {string} password - Password to evaluate
   * @returns {Object} Strength level
   */
  update(password) {
    const level = this.#calculateStrength(password);
    this.currentLevel = level;
    this.#updateUI(level, password);
    return level;
  }

  /**
   * Update the UI components
   * @param {Object} level - Strength level
   * @param {string} password - Current password
   */
  #updateUI(level, password) {
    const bar = this.container.querySelector('.master-strength-fill');
    const label = this.container.querySelector('.master-strength-label');

    if (bar) {
      bar.style.width = `${level.width}%`;
      bar.style.backgroundColor = level.color;
    }

    if (label) {
      label.textContent = t(`vault.masterPassword.strength.${level.key}`);
      label.style.color = level.color;
    }

    // Update requirements checklist
    if (this.options.showRequirements) {
      REQUIREMENTS.forEach(req => {
        const item = this.container.querySelector(`[data-req="${req.id}"]`);
        if (item) {
          const passed = password && req.test(password);
          item.classList.toggle('passed', passed);
          item.setAttribute('aria-checked', passed ? 'true' : 'false');
        }
      });
    }

    // Update ARIA
    const progressBar = this.container.querySelector('.master-strength-bar');
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', level.score + 1);
      progressBar.setAttribute('aria-valuetext', t(`vault.masterPassword.strength.${level.key}`));
    }
  }

  /**
   * Render the component
   */
  #render() {
    const requirementsHtml = this.options.showRequirements ? `
      <ul class="master-strength-requirements" role="list">
        <li data-req="length" role="listitem" aria-checked="false">
          <span class="req-icon" aria-hidden="true"></span>
          ${t('vault.masterPassword.req.length')}
        </li>
        <li data-req="mixed" role="listitem" aria-checked="false">
          <span class="req-icon" aria-hidden="true"></span>
          ${t('vault.masterPassword.req.mixed')}
        </li>
        <li data-req="numbers" role="listitem" aria-checked="false">
          <span class="req-icon" aria-hidden="true"></span>
          ${t('vault.masterPassword.req.numbers')}
        </li>
        <li data-req="special" role="listitem" aria-checked="false">
          <span class="req-icon" aria-hidden="true"></span>
          ${t('vault.masterPassword.req.special')}
        </li>
      </ul>
    ` : '';

    this.container.innerHTML = `
      <div class="master-password-strength">
        <div class="master-strength-bar" role="progressbar"
             aria-label="${t('vault.masterPassword.strengthLabel')}"
             aria-valuemin="1" aria-valuemax="4" aria-valuenow="1">
          <div class="master-strength-fill"></div>
        </div>
        <span class="master-strength-label"></span>
      </div>
      ${requirementsHtml}
    `;
  }

  /**
   * Get current strength level
   * @returns {Object|null} Current strength level
   */
  getLevel() {
    return this.currentLevel;
  }

  /**
   * Check if password meets minimum requirements
   * @returns {boolean} True if password is at least FAIR
   */
  isAcceptable() {
    return this.currentLevel && this.currentLevel.score >= STRENGTH_LEVELS.FAIR.score;
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.container.innerHTML = '';
    this.currentLevel = null;
  }
}

/**
 * Create and return a master password strength indicator
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Component options
 * @returns {MasterPasswordStrength}
 */
export function createMasterPasswordStrength(container, options = {}) {
  return new MasterPasswordStrength(container, options);
}
