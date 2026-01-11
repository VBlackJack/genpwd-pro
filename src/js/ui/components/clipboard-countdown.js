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
 * @fileoverview Clipboard Countdown Component
 * Shows a visible countdown when clipboard auto-clear is scheduled
 */

import { t } from '../../utils/i18n.js';
import { getSecureClipboard } from '../../utils/secure-clipboard.js';

/** @type {ClipboardCountdown|null} */
let instance = null;

/**
 * Clipboard Countdown - Shows visible countdown before clipboard clears
 */
export class ClipboardCountdown {
  /** @type {number|null} */
  #intervalId = null;

  /** @type {HTMLElement|null} */
  #toastElement = null;

  /** @type {boolean} */
  #isActive = false;

  constructor() {
    this.#setupCallbacks();
  }

  /**
   * Set up clipboard callbacks
   * @private
   */
  #setupCallbacks() {
    const clipboard = getSecureClipboard();

    // Listen for copy events
    clipboard.setOnCopy(({ isSecure, timeoutMs, label }) => {
      if (isSecure && timeoutMs > 0) {
        this.start(timeoutMs, label);
      }
    });

    // Listen for clear events
    clipboard.setOnCleared((reason) => {
      this.stop(reason === 'timeout');
    });
  }

  /**
   * Start the countdown display
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} [label] - What was copied (e.g., "Password")
   */
  start(timeoutMs, label = '') {
    // Stop any existing countdown
    this.stop(false);

    this.#isActive = true;
    const endTime = Date.now() + timeoutMs;

    // Create or update toast
    this.#createToast(label);

    // Update every second
    this.#intervalId = window.setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);

      if (remaining <= 0) {
        this.stop(true);
      } else {
        this.#updateToast(remaining);
      }
    }, 1000);

    // Initial update
    const initialRemaining = Math.ceil(timeoutMs / 1000);
    this.#updateToast(initialRemaining);
  }

  /**
   * Stop the countdown
   * @param {boolean} [showCleared=false] - Show "cleared" message
   */
  stop(showCleared = false) {
    this.#isActive = false;

    if (this.#intervalId) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = null;
    }

    if (showCleared && this.#toastElement) {
      this.#showClearedMessage();
    } else {
      this.#removeToast();
    }
  }

  /**
   * Check if countdown is active
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * Create the countdown toast
   * @private
   * @param {string} label - What was copied
   */
  #createToast(label) {
    // Remove existing toast
    this.#removeToast();

    const container = document.getElementById('toasts') || document.body;

    this.#toastElement = document.createElement('div');
    this.#toastElement.className = 'toast toast-info toast-clipboard-countdown';
    this.#toastElement.setAttribute('role', 'status');
    this.#toastElement.setAttribute('aria-live', 'polite');
    this.#toastElement.innerHTML = `
      <svg class="toast-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="toast-message clipboard-countdown-message"></span>
      <button class="toast-dismiss clipboard-countdown-clear" aria-label="${t('clipboard.clearNow') || 'Clear now'}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Clear clipboard on button click
    const clearBtn = this.#toastElement.querySelector('.clipboard-countdown-clear');
    clearBtn?.addEventListener('click', async () => {
      const clipboard = getSecureClipboard();
      await clipboard.clear(true);
      this.stop(true);
    });

    container.appendChild(this.#toastElement);

    // Animate in
    requestAnimationFrame(() => {
      this.#toastElement?.classList.add('show');
    });
  }

  /**
   * Update the countdown message
   * @private
   * @param {number} seconds - Seconds remaining
   */
  #updateToast(seconds) {
    if (!this.#toastElement) return;

    const messageEl = this.#toastElement.querySelector('.clipboard-countdown-message');
    if (messageEl) {
      messageEl.textContent = t('clipboard.countdown', { seconds }) ||
        `Clipboard clears in ${seconds}s`;
    }

    // Add warning class when time is low
    if (seconds <= 5) {
      this.#toastElement.classList.add('toast-warning');
      this.#toastElement.classList.remove('toast-info');
    }
  }

  /**
   * Show "clipboard cleared" message briefly
   * @private
   */
  #showClearedMessage() {
    if (!this.#toastElement) return;

    const messageEl = this.#toastElement.querySelector('.clipboard-countdown-message');
    if (messageEl) {
      messageEl.textContent = t('clipboard.cleared') || 'Clipboard cleared';
    }

    // Update icon to checkmark
    const iconEl = this.#toastElement.querySelector('.toast-icon');
    if (iconEl) {
      iconEl.innerHTML = `
        <polyline points="20 6 9 17 4 12"></polyline>
      `;
    }

    // Hide clear button
    const clearBtn = this.#toastElement.querySelector('.clipboard-countdown-clear');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    // Change to success style
    this.#toastElement.classList.remove('toast-info', 'toast-warning');
    this.#toastElement.classList.add('toast-success');

    // Remove after delay
    setTimeout(() => {
      this.#removeToast();
    }, 2000);
  }

  /**
   * Remove the toast element
   * @private
   */
  #removeToast() {
    if (!this.#toastElement) return;

    this.#toastElement.classList.remove('show');

    setTimeout(() => {
      this.#toastElement?.remove();
      this.#toastElement = null;
    }, 300);
  }
}

/**
 * Get or create the singleton instance
 * @returns {ClipboardCountdown}
 */
export function getClipboardCountdown() {
  if (!instance) {
    instance = new ClipboardCountdown();
  }
  return instance;
}

/**
 * Initialize clipboard countdown (call once at app startup)
 */
export function initClipboardCountdown() {
  return getClipboardCountdown();
}
