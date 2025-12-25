/**
 * @fileoverview VaultBridge - Bridge between Password Generator and Vault
 * Provides a clean API for generator components to interact with the vault
 *
 * @version 2.6.8
 */

import { showToast } from '../utils/toast.js';
import { safeLog } from '../utils/logger.js';

/**
 * Vault state enum
 */
export const VaultState = {
  UNAVAILABLE: 'unavailable',  // Not in Electron / no vault API
  LOCKED: 'locked',
  UNLOCKED: 'unlocked'
};

/**
 * VaultBridge - Static utility class for Generator ↔ Vault communication
 */
export class VaultBridge {
  static #listeners = new Set();
  static #currentState = VaultState.UNAVAILABLE;
  static #initialized = false;
  static #unsubscribers = [];
  static #refreshing = false; // Mutex to prevent concurrent refreshState calls

  /**
   * Initialize the vault bridge (call once at app startup)
   */
  static init() {
    if (this.#initialized) return;

    if (!this.isAvailable()) {
      this.#currentState = VaultState.UNAVAILABLE;
      this.#initialized = true;
      return;
    }

    // Subscribe to vault events
    if (window.vault?.on) {
      const unsubLocked = window.vault.on('locked', () => {
        this.#currentState = VaultState.LOCKED;
        this.#notifyListeners();
      });

      const unsubUnlocked = window.vault.on('unlocked', () => {
        this.#currentState = VaultState.UNLOCKED;
        this.#notifyListeners();
      });

      this.#unsubscribers.push(unsubLocked, unsubUnlocked);
    }

    // Check initial state
    this.#refreshState();
    this.#initialized = true;
  }

  /**
   * Cleanup subscriptions
   */
  static destroy() {
    this.#unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.#unsubscribers = [];
    this.#listeners.clear();
    this.#initialized = false;
  }

  /**
   * Check if vault API is available (Electron only)
   * @returns {boolean}
   */
  static isAvailable() {
    return typeof window !== 'undefined' && !!window.vault;
  }

  /**
   * Get current vault state synchronously
   * @returns {VaultState}
   */
  static getState() {
    return this.#currentState;
  }

  /**
   * Check if vault is currently unlocked
   * @returns {Promise<boolean>}
   */
  static async isUnlocked() {
    if (!this.isAvailable()) return false;

    try {
      const state = await window.vault.getState();
      return state?.status === 'unlocked';
    } catch (error) {
      safeLog(`[VaultBridge] Error checking unlock state: ${error.message}`);
      return false;
    }
  }

  /**
   * Refresh the current vault state
   * @private
   */
  static async #refreshState() {
    // Prevent concurrent refresh calls (race condition fix)
    if (this.#refreshing) return;
    this.#refreshing = true;

    try {
      if (!this.isAvailable()) {
        this.#currentState = VaultState.UNAVAILABLE;
        return;
      }

      const state = await window.vault.getState();
      this.#currentState = state?.status === 'unlocked'
        ? VaultState.UNLOCKED
        : VaultState.LOCKED;
    } catch (error) {
      this.#currentState = VaultState.LOCKED;
    } finally {
      this.#refreshing = false;
    }
  }

  /**
   * Subscribe to vault state changes
   * @param {Function} callback - Called with new state
   * @returns {Function} Unsubscribe function
   */
  static subscribe(callback) {
    this.#listeners.add(callback);
    // Immediately call with current state
    callback(this.#currentState);

    return () => {
      this.#listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of state change
   * @private
   */
  static #notifyListeners() {
    // Update status indicator
    this.updateStatusIndicator();

    // Notify registered listeners
    this.#listeners.forEach(callback => {
      try {
        callback(this.#currentState);
      } catch (error) {
        safeLog(`[VaultBridge] Listener error: ${error.message}`);
      }
    });
  }

  /**
   * Get list of available folders
   * @returns {Promise<Array>}
   */
  static async getFolders() {
    if (!this.isAvailable()) return [];

    try {
      const folders = await window.vault.folders.getAll();
      return folders || [];
    } catch (error) {
      safeLog(`[VaultBridge] Error fetching folders: ${error.message}`);
      return [];
    }
  }

  /**
   * Save a generated password to the vault
   * @param {string} password - The generated password
   * @param {Object} metadata - Entry metadata
   * @param {string} metadata.title - Entry title (required)
   * @param {string} [metadata.username] - Username
   * @param {string} [metadata.url] - Website URL
   * @param {string} [metadata.notes] - Additional notes
   * @param {string} [metadata.folderId] - Target folder ID
   * @returns {Promise<{success: boolean, entryId?: string, error?: string}>}
   */
  static async savePassword(password, metadata) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Vault not available' };
    }

    // Check if unlocked
    const isUnlocked = await this.isUnlocked();
    if (!isUnlocked) {
      return { success: false, error: 'Vault locked' };
    }

    // Validate required fields
    if (!metadata?.title?.trim()) {
      return { success: false, error: 'Title required' };
    }

    try {
      const entryData = {
        username: metadata.username || '',
        password: password,
        url: metadata.url || '',
        notes: metadata.notes || ''
      };

      // Add entry to vault
      const result = await window.vault.entries.add(
        'login',
        metadata.title.trim(),
        entryData,
        {
          folderId: metadata.folderId || null,
          favorite: false
        }
      );

      if (result?.id) {
        showToast(`Saved to vault: ${metadata.title}`, 'success');
        return { success: true, entryId: result.id };
      } else {
        return { success: false, error: 'Save failed' };
      }
    } catch (error) {
      safeLog(`[VaultBridge] Save error: ${error.message}`);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Quick save with minimal info (just title)
   * @param {string} password - The generated password
   * @param {string} title - Entry title
   * @returns {Promise<{success: boolean, entryId?: string, error?: string}>}
   */
  static async quickSave(password, title) {
    return this.savePassword(password, { title });
  }

  /**
   * Open the vault tab
   */
  static switchToVaultTab() {
    const vaultTab = document.querySelector('.header-tab[data-tab="vault"]');
    if (vaultTab) {
      vaultTab.click();
    }
  }

  /**
   * Prompt user to unlock vault (switches to vault tab)
   */
  static promptUnlock() {
    showToast('Please unlock the vault', 'warning');
    this.switchToVaultTab();
  }

  /**
   * Update the vault status indicator in the header
   */
  static updateStatusIndicator() {
    const indicator = document.getElementById('vault-status-indicator');
    if (!indicator) return;

    // Only show indicator in Electron
    if (!this.isAvailable()) {
      indicator.hidden = true;
      return;
    }

    indicator.hidden = false;
    const icon = indicator.querySelector('.vault-status-icon');
    const text = indicator.querySelector('.vault-status-text');

    if (this.#currentState === VaultState.UNLOCKED) {
      indicator.classList.add('unlocked');
      if (icon) icon.textContent = '🔓';
      if (text) text.textContent = 'Unlocked';
    } else {
      indicator.classList.remove('unlocked');
      if (icon) icon.textContent = '🔒';
      if (text) text.textContent = 'Locked';
    }
  }

  /**
   * Bind click event on status indicator
   */
  static bindStatusIndicatorClick() {
    const indicator = document.getElementById('vault-status-indicator');
    if (!indicator) return;

    indicator.addEventListener('click', () => {
      this.switchToVaultTab();
    });
  }
}

// Auto-initialize when module loads (if in browser context)
if (typeof window !== 'undefined') {
  // Defer initialization to allow vault API to be set up
  const initVaultBridge = () => {
    VaultBridge.init();
    VaultBridge.updateStatusIndicator();
    VaultBridge.bindStatusIndicatorClick();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initVaultBridge, 100);
    });
  } else {
    setTimeout(initVaultBridge, 100);
  }
}

export default VaultBridge;
