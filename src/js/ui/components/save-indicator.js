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
 * @fileoverview Save Indicator Component
 * Visual feedback for vault save operations (BMAD Anxiety reduction)
 */

import { t } from '../../utils/i18n.js';
import { getIcon } from '../../vault/views/icons.js';

/** Save indicator states */
export const SAVE_STATES = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
};

/** State display configuration */
const STATE_CONFIG = {
  [SAVE_STATES.IDLE]: {
    iconName: null,
    labelKey: null,
    className: 'save-indicator--idle'
  },
  [SAVE_STATES.SAVING]: {
    iconName: 'sync',
    labelKey: 'vault.status.saving',
    className: 'save-indicator--saving'
  },
  [SAVE_STATES.SAVED]: {
    iconName: 'check',
    labelKey: 'vault.status.saved',
    className: 'save-indicator--saved'
  },
  [SAVE_STATES.ERROR]: {
    iconName: 'alert',
    labelKey: 'vault.status.error',
    className: 'save-indicator--error'
  }
};

/**
 * Save Indicator Component
 * Displays visual feedback for vault save operations
 */
export class SaveIndicator {
  /**
   * @param {string|HTMLElement} container - Container element or selector
   * @param {Object} options - Component options
   * @param {number} options.autoHideDelay - Delay before hiding after saved (default: 3000ms)
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      autoHideDelay: 3000,
      ...options
    };

    this.element = null;
    this.currentState = SAVE_STATES.IDLE;
    this.hideTimeout = null;

    this.#init();
  }

  #init() {
    if (!this.container) return;

    this.element = document.createElement('div');
    this.element.className = 'save-indicator';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.element.hidden = true;

    this.container.appendChild(this.element);
  }

  /**
   * Show the indicator with a specific state
   * @param {string} state - One of SAVE_STATES values
   */
  show(state) {
    if (!this.element) return;
    if (!Object.values(SAVE_STATES).includes(state)) return;

    // Clear any pending hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.currentState = state;
    const config = STATE_CONFIG[state];

    // Update content
    const icon = config.iconName ? getIcon(config.iconName, { size: 16 }) : '';
    const label = config.labelKey ? t(config.labelKey) : '';

    this.element.innerHTML = `
      <span class="save-indicator-icon" aria-hidden="true">${icon}</span>
      <span class="save-indicator-label">${label}</span>
    `;

    // Update class
    this.element.className = `save-indicator ${config.className}`;

    // Show element
    this.element.hidden = false;

    // Auto-hide for 'saved' state
    if (state === SAVE_STATES.SAVED) {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, this.options.autoHideDelay);
    }
  }

  /**
   * Hide the indicator
   */
  hide() {
    if (!this.element) return;

    this.element.hidden = true;
    this.element.innerHTML = '';
    this.currentState = SAVE_STATES.IDLE;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Convenience method: show saving state
   */
  showSaving() {
    this.show(SAVE_STATES.SAVING);
  }

  /**
   * Convenience method: show saved state
   */
  showSaved() {
    this.show(SAVE_STATES.SAVED);
  }

  /**
   * Convenience method: show error state
   */
  showError() {
    this.show(SAVE_STATES.ERROR);
  }

  /**
   * Show saved state with fade out animation after delay
   * @param {number} delay - Delay before starting fade (default: 3000ms)
   */
  showSavedWithFade(delay = 3000) {
    this.show(SAVE_STATES.SAVED);

    // Clear any existing timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    // Start fade animation after delay
    this.hideTimeout = setTimeout(() => {
      if (this.element) {
        this.element.classList.add('save-indicator--fading');
        // Remove after animation completes
        setTimeout(() => this.hide(), 300);
      }
    }, delay);
  }

  /**
   * Show persistent status message (for errors with retry)
   * @param {string} state - One of SAVE_STATES values
   * @param {Object} options - Additional options
   * @param {string} options.message - Custom message to display
   * @param {Function} options.onRetry - Callback for retry action
   */
  showPersistentStatus(state, options = {}) {
    if (!this.element) return;

    this.currentState = state;
    const config = STATE_CONFIG[state];

    const icon = config.iconName ? getIcon(config.iconName, { size: 16 }) : '';
    const message = options.message || (config.labelKey ? t(config.labelKey) : '');

    let retryButton = '';
    if (options.onRetry && state === SAVE_STATES.ERROR) {
      retryButton = `
        <button class="save-indicator-retry" type="button" aria-label="${t('common.retry')}">
          ${t('common.retry')}
        </button>
      `;
    }

    this.element.innerHTML = `
      <span class="save-indicator-icon" aria-hidden="true">${icon}</span>
      <span class="save-indicator-label">${message}</span>
      ${retryButton}
    `;

    this.element.className = `save-indicator save-indicator--persistent ${config.className}`;
    this.element.hidden = false;

    // Bind retry handler
    if (options.onRetry) {
      const retryBtn = this.element.querySelector('.save-indicator-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          options.onRetry();
        }, { once: true });
      }
    }
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

/**
 * Create and return a save indicator instance
 * @param {string|HTMLElement} container
 * @param {Object} options
 * @returns {SaveIndicator}
 */
export function createSaveIndicator(container, options = {}) {
  return new SaveIndicator(container, options);
}
