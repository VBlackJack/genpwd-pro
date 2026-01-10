/*
 * Copyright 2026 Julien Bombled
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
 * @fileoverview Crash Recovery System
 * Detects unexpected terminations and offers recovery options
 */

import { safeLog } from './logger.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';

const STORAGE_KEY = 'genpwd-session-state';
const CRASH_FLAG_KEY = 'genpwd-session-active';

/**
 * Session state that can be recovered
 * @typedef {Object} SessionState
 * @property {string} lastTab - Last active tab
 * @property {string|null} lastVaultId - Last opened vault ID
 * @property {number} timestamp - When state was saved
 * @property {boolean} wasLocked - Whether vault was locked
 */

class CrashRecovery {
  #isInitialized = false;
  #saveInterval = null;

  constructor() {
    this.#isInitialized = false;
  }

  /**
   * Initialize crash recovery system
   * Should be called on app startup
   */
  init() {
    if (this.#isInitialized) return;

    // Check for crash on startup
    const didCrash = this.#detectCrash();

    // Set crash flag (will be cleared on clean exit)
    this.#setCrashFlag(true);

    // Set up beforeunload handler for clean exit
    window.addEventListener('beforeunload', () => {
      this.#setCrashFlag(false);
      this.#clearSessionState();
    });

    // Set up periodic state saving
    this.#saveInterval = setInterval(() => {
      this.saveState();
    }, 30000); // Save every 30 seconds

    this.#isInitialized = true;
    safeLog('[CrashRecovery] Initialized');

    // Return crash status for caller to handle
    return didCrash;
  }

  /**
   * Check if app crashed previously
   * @returns {boolean}
   * @private
   */
  #detectCrash() {
    try {
      const crashFlag = localStorage.getItem(CRASH_FLAG_KEY);
      return crashFlag === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set or clear the crash detection flag
   * @param {boolean} active
   * @private
   */
  #setCrashFlag(active) {
    try {
      if (active) {
        localStorage.setItem(CRASH_FLAG_KEY, 'true');
      } else {
        localStorage.removeItem(CRASH_FLAG_KEY);
      }
    } catch {
      // Storage not available
    }
  }

  /**
   * Save current session state
   * @param {Partial<SessionState>} [overrides]
   */
  saveState(overrides = {}) {
    try {
      const state = {
        lastTab: this.#getCurrentTab(),
        lastVaultId: this.#getActiveVaultId(),
        timestamp: Date.now(),
        wasLocked: this.#isVaultLocked(),
        ...overrides
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage not available
    }
  }

  /**
   * Get saved session state
   * @returns {SessionState|null}
   */
  getState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Invalid or missing state
    }
    return null;
  }

  /**
   * Clear saved session state
   * @private
   */
  #clearSessionState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage not available
    }
  }

  /**
   * Get current active tab
   * @returns {string}
   * @private
   */
  #getCurrentTab() {
    const generatorTab = document.getElementById('generator-view');
    const vaultTab = document.getElementById('vault-view');

    if (vaultTab && !vaultTab.hidden) {
      return 'vault';
    }
    return 'generator';
  }

  /**
   * Get active vault ID
   * @returns {string|null}
   * @private
   */
  #getActiveVaultId() {
    // Try to get from selected vault item
    const selectedItem = document.querySelector('.vault-list-item.selected');
    return selectedItem?.dataset?.vaultId || null;
  }

  /**
   * Check if vault is currently locked
   * @returns {boolean}
   * @private
   */
  #isVaultLocked() {
    const lockScreen = document.getElementById('lock-screen');
    return !lockScreen?.hidden;
  }

  /**
   * Show crash recovery notification
   * @param {SessionState} state - Previous session state
   */
  showRecoveryNotification(state) {
    if (!state) return;

    // Only show if crash was recent (within 5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - state.timestamp > fiveMinutes) {
      return;
    }

    // Show toast with recovery info
    const message = t('crashRecovery.sessionRestored');
    showToast(message, 'info', 5000);
  }

  /**
   * Cleanup on app shutdown
   */
  destroy() {
    if (this.#saveInterval) {
      clearInterval(this.#saveInterval);
      this.#saveInterval = null;
    }
    this.#setCrashFlag(false);
    this.#isInitialized = false;
  }
}

// Export singleton instance
export const crashRecovery = new CrashRecovery();

/**
 * Initialize crash recovery and check for previous crash
 * @returns {{ didCrash: boolean, state: SessionState|null }}
 */
export function initCrashRecovery() {
  const didCrash = crashRecovery.init();
  const state = didCrash ? crashRecovery.getState() : null;

  if (didCrash && state) {
    safeLog(`[CrashRecovery] Previous crash detected at ${new Date(state.timestamp).toISOString()}`);
    crashRecovery.showRecoveryNotification(state);
  }

  return { didCrash, state };
}
