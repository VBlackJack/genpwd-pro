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
 * @fileoverview Status Bar Component
 * Bottom status bar for vault with save indicator, sync status, and entry count
 * (BMAD Anxiety reduction - persistent feedback)
 */

import { t } from '../../utils/i18n.js';
import { getIcon } from '../../vault/views/icons.js';
import { SaveIndicator, SAVE_STATES } from './save-indicator.js';

/** Sync status states */
export const SYNC_STATES = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error'
};

/**
 * Status Bar Component
 * Displays persistent status information at the bottom of the vault
 */
export class StatusBar {
  /**
   * @param {string|HTMLElement} container - Container element or selector
   * @param {Object} options - Component options
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      showSaveIndicator: true,
      showSyncStatus: true,
      showEntryCount: true,
      showEncryptionStatus: true,
      ...options
    };

    this.element = null;
    this.saveIndicator = null;
    this.syncState = SYNC_STATES.IDLE;
    this.entryCount = 0;

    this.#init();
  }

  #init() {
    if (!this.container) return;

    this.element = document.createElement('div');
    this.element.className = 'vault-status-bar';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', t('vault.status.barLabel'));

    this.#render();
    this.container.appendChild(this.element);

    // Initialize save indicator
    if (this.options.showSaveIndicator) {
      const saveContainer = this.element.querySelector('.status-bar-left');
      if (saveContainer) {
        this.saveIndicator = new SaveIndicator(saveContainer);
      }
    }
  }

  #render() {
    this.element.innerHTML = `
      <div class="status-bar-left">
        <!-- Save indicator will be injected here -->
      </div>
      <div class="status-bar-center">
        ${this.options.showEncryptionStatus ? this.#renderEncryptionStatus() : ''}
        ${this.options.showEntryCount ? this.#renderEntryCount() : ''}
      </div>
      <div class="status-bar-right">
        ${this.options.showSyncStatus ? this.#renderSyncStatus() : ''}
      </div>
    `;
  }

  #renderEncryptionStatus() {
    const icon = getIcon('lock', { size: 14 });
    const label = t('vault.encryption.aes256');
    const details = t('vault.encryption.details');

    return `
      <span class="status-bar-item status-bar-encryption" title="${details}">
        <span class="status-bar-icon encryption-icon" aria-hidden="true">${icon}</span>
        <span class="status-bar-text">${label}</span>
      </span>
    `;
  }

  #renderEntryCount() {
    const icon = getIcon('folder', { size: 14 });
    const label = t('vault.status.entries', { count: this.entryCount });

    return `
      <span class="status-bar-item status-bar-entries" title="${label}">
        <span class="status-bar-icon" aria-hidden="true">${icon}</span>
        <span class="status-bar-text">${this.entryCount}</span>
      </span>
    `;
  }

  #renderSyncStatus() {
    const configs = {
      [SYNC_STATES.IDLE]: { iconName: 'cloud', labelKey: 'vault.sync.idle', className: '' },
      [SYNC_STATES.SYNCING]: { iconName: 'sync', labelKey: 'vault.sync.syncing', className: 'syncing' },
      [SYNC_STATES.SYNCED]: { iconName: 'cloud', labelKey: 'vault.sync.synced', className: 'synced' },
      [SYNC_STATES.OFFLINE]: { iconName: 'cloud', labelKey: 'vault.sync.offline', className: 'offline' },
      [SYNC_STATES.ERROR]: { iconName: 'alert', labelKey: 'vault.sync.error', className: 'error' }
    };

    const config = configs[this.syncState] || configs[SYNC_STATES.IDLE];
    const icon = getIcon(config.iconName, { size: 14 });
    const label = t(config.labelKey);

    return `
      <span class="status-bar-item status-bar-sync ${config.className}" title="${label}">
        <span class="status-bar-icon" aria-hidden="true">${icon}</span>
        <span class="status-bar-text sr-only">${label}</span>
      </span>
    `;
  }

  /**
   * Update entry count display
   * @param {number} count
   */
  updateEntryCount(count) {
    this.entryCount = count;
    const entriesEl = this.element?.querySelector('.status-bar-entries');
    if (entriesEl) {
      const icon = getIcon('folder', { size: 14 });
      const label = t('vault.status.entries', { count });
      entriesEl.title = label;
      entriesEl.innerHTML = `
        <span class="status-bar-icon" aria-hidden="true">${icon}</span>
        <span class="status-bar-text">${count}</span>
      `;
    }
  }

  /**
   * Update sync status display
   * @param {string} state - One of SYNC_STATES values
   */
  updateSyncStatus(state) {
    if (!Object.values(SYNC_STATES).includes(state)) return;

    this.syncState = state;
    const rightEl = this.element?.querySelector('.status-bar-right');
    if (rightEl) {
      rightEl.innerHTML = this.#renderSyncStatus();
    }
  }

  /**
   * Show saving state
   */
  showSaving() {
    this.saveIndicator?.showSaving();
  }

  /**
   * Show saved state
   */
  showSaved() {
    this.saveIndicator?.showSaved();
  }

  /**
   * Show save error
   */
  showSaveError() {
    this.saveIndicator?.showError();
  }

  /**
   * Show saved state with fade out animation
   * @param {number} delay - Delay before fade (default: 3000ms)
   */
  showSavedWithFade(delay = 3000) {
    this.saveIndicator?.showSavedWithFade(delay);
  }

  /**
   * Show persistent error with retry option
   * @param {Object} options - Error options
   * @param {string} options.message - Custom error message
   * @param {Function} options.onRetry - Retry callback
   */
  showPersistentError(options = {}) {
    this.saveIndicator?.showPersistentStatus(SAVE_STATES.ERROR, options);
  }

  /**
   * Get save indicator instance
   * @returns {SaveIndicator|null}
   */
  getSaveIndicator() {
    return this.saveIndicator;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.saveIndicator) {
      this.saveIndicator.destroy();
      this.saveIndicator = null;
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

/**
 * Create and return a status bar instance
 * @param {string|HTMLElement} container
 * @param {Object} options
 * @returns {StatusBar}
 */
export function createStatusBar(container, options = {}) {
  return new StatusBar(container, options);
}
