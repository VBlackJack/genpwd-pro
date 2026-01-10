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
 * @fileoverview Vault Settings Service
 * Manages vault settings persistence and state
 */

import { safeLog } from '../../utils/logger.js';

const STORAGE_KEY = 'genpwd-vault-settings';

/**
 * Default vault settings
 */
const DEFAULT_SETTINGS = {
  lockTimeout: 300, // 5 minutes in seconds
  lockOnMinimize: false,
  lockOnBlur: false,
  lockOnSystemIdle: true,
  clipboardClearTimeout: 30, // 30 seconds, 0 = disabled
  requirePasswordToReveal: false
};

/**
 * Timeout options for lock timeout
 */
export const LOCK_TIMEOUT_OPTIONS = [
  { value: 0, labelKey: 'vault.settings.disabled' },
  { value: 60, labelKey: 'settings.timeout.1min' },
  { value: 120, labelKey: 'settings.timeout.2min' },
  { value: 300, labelKey: 'settings.timeout.5min' },
  { value: 600, labelKey: 'settings.timeout.10min' },
  { value: 900, labelKey: 'settings.timeout.15min' },
  { value: 1800, labelKey: 'settings.timeout.30min' }
];

/**
 * Clipboard clear timeout options
 */
export const CLIPBOARD_TIMEOUT_OPTIONS = [
  { value: 0, labelKey: 'vault.settings.clipboardNever' },
  { value: 15, labelKey: 'vault.settings.clipboard15s' },
  { value: 30, labelKey: 'vault.settings.clipboard30s' },
  { value: 60, labelKey: 'settings.timeout.1min' },
  { value: 120, labelKey: 'settings.timeout.2min' }
];

// Singleton instance
let settingsInstance = null;
let changeListeners = [];

/**
 * Load settings from localStorage
 * @returns {Object} Settings object
 */
function loadSettings() {
  let settings = { ...DEFAULT_SETTINGS };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all keys exist
      settings = { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    safeLog('[VaultSettingsService] Failed to load settings:', e?.message);
  }

  // Sync with legacy localStorage key for lockTimeout
  try {
    const legacyTimeout = localStorage.getItem('genpwd-vault-autolock-timeout');
    if (legacyTimeout) {
      const timeout = parseInt(legacyTimeout, 10);
      if (!isNaN(timeout) && timeout >= 0) {
        settings.lockTimeout = timeout;
      }
    }
  } catch (e) {
    // Ignore legacy sync errors
  }

  return settings;
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings to save
 */
function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    safeLog('[VaultSettingsService] Failed to save settings:', e?.message);
  }
}

/**
 * Notify all change listeners
 * @param {string} key - Setting key that changed
 * @param {*} value - New value
 * @param {Object} allSettings - All current settings
 */
function notifyListeners(key, value, allSettings) {
  changeListeners.forEach(listener => {
    try {
      listener(key, value, allSettings);
    } catch (e) {
      safeLog('[VaultSettingsService] Listener error:', e?.message);
    }
  });
}

/**
 * Get or create the vault settings service instance
 * @returns {Object} Vault settings service
 */
export function getVaultSettingsService() {
  if (settingsInstance) {
    return settingsInstance;
  }

  let settings = loadSettings();

  settingsInstance = {
    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    get(key) {
      return settings[key];
    },

    /**
     * Get all settings
     * @returns {Object} All settings
     */
    getAll() {
      return { ...settings };
    },

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    set(key, value) {
      if (key in DEFAULT_SETTINGS) {
        settings[key] = value;
        saveSettings(settings);
        notifyListeners(key, value, settings);
      } else {
        safeLog('[VaultSettingsService] Unknown setting key:', key);
      }
    },

    /**
     * Update multiple settings at once
     * @param {Object} updates - Object with key-value pairs to update
     */
    update(updates) {
      let changed = false;
      Object.entries(updates).forEach(([key, value]) => {
        if (key in DEFAULT_SETTINGS && settings[key] !== value) {
          settings[key] = value;
          changed = true;
        }
      });
      if (changed) {
        saveSettings(settings);
        notifyListeners('*', null, settings);
      }
    },

    /**
     * Reset all settings to defaults
     */
    reset() {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings(settings);
      notifyListeners('*', null, settings);
    },

    /**
     * Add a change listener
     * @param {Function} listener - Callback function(key, value, allSettings)
     * @returns {Function} Unsubscribe function
     */
    onChange(listener) {
      changeListeners.push(listener);
      return () => {
        changeListeners = changeListeners.filter(l => l !== listener);
      };
    },

    /**
     * Check if lock timeout is enabled
     * @returns {boolean}
     */
    isLockTimeoutEnabled() {
      return settings.lockTimeout > 0;
    },

    /**
     * Check if clipboard clear is enabled
     * @returns {boolean}
     */
    isClipboardClearEnabled() {
      return settings.clipboardClearTimeout > 0;
    }
  };

  return settingsInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetVaultSettingsService() {
  settingsInstance = null;
  changeListeners = [];
}
