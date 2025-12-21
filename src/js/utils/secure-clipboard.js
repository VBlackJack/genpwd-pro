/**
 * @fileoverview Secure Clipboard Manager
 * Handles sensitive clipboard operations with auto-clear and content verification.
 *
 * Features:
 * - Auto-clear after configurable timeout (default 60s)
 * - Content verification before clearing (only clears OUR data)
 * - Multiple overwrite passes for security
 * - Electron API integration when available
 * - Toast notifications for user feedback
 *
 * @license Apache-2.0
 */

import { safeLog } from './logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'security-clipboard-timeout';
const DEFAULT_TIMEOUT_MS = 60 * 1000; // 60 seconds
const MIN_TIMEOUT_MS = 10 * 1000; // 10 seconds minimum
const MAX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max

/**
 * Available timeout options (in seconds)
 */
export const CLIPBOARD_TIMEOUT_OPTIONS = Object.freeze([
  { value: 0, label: 'Désactivé', ms: 0 },
  { value: 10, label: '10 secondes', ms: 10 * 1000 },
  { value: 30, label: '30 secondes', ms: 30 * 1000 },
  { value: 60, label: '1 minute', ms: 60 * 1000 },
  { value: 120, label: '2 minutes', ms: 2 * 60 * 1000 },
  { value: 300, label: '5 minutes', ms: 5 * 60 * 1000 }
]);

// ============================================================================
// SECURE CLIPBOARD CLASS
// ============================================================================

/**
 * Singleton Secure Clipboard Manager
 */
class SecureClipboard {
  /** @type {SecureClipboard|null} */
  static #instance = null;

  /** @type {number} */
  #timeoutMs = DEFAULT_TIMEOUT_MS;

  /** @type {number|null} */
  #timerId = null;

  /** @type {string|null} */
  #copiedHash = null;

  /** @type {string|null} */
  #copiedText = null;

  /** @type {number|null} */
  #copiedLength = null;

  /** @type {Function|null} */
  #onClearedCallback = null;

  /** @type {Function|null} */
  #onCopyCallback = null;

  /** @type {boolean} */
  #isClearing = false;

  /**
   * Get singleton instance
   * @returns {SecureClipboard}
   */
  static getInstance() {
    if (!SecureClipboard.#instance) {
      SecureClipboard.#instance = new SecureClipboard();
    }
    return SecureClipboard.#instance;
  }

  constructor() {
    if (SecureClipboard.#instance) {
      return SecureClipboard.#instance;
    }
    this.#loadSettings();

    // Listen for Electron clipboard cleared events
    if (window.electronAPI?.onClipboardCleared) {
      window.electronAPI.onClipboardCleared((data) => {
        safeLog('[SecureClipboard] Electron clipboard cleared event received');
        this.#handleCleared(data?.reason || 'external');
      });
    }
  }

  // ==================== CONFIGURATION ====================

  /**
   * Load settings from localStorage
   * @private
   */
  #loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const value = parseInt(stored, 10);
        if (!isNaN(value) && value >= 0) {
          this.#timeoutMs = value * 1000;
        }
      }
    } catch {
      // Use default
    }
  }

  /**
   * Save settings to localStorage
   * @private
   */
  #saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, Math.floor(this.#timeoutMs / 1000).toString());
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get current timeout in seconds
   * @returns {number}
   */
  getTimeout() {
    return Math.floor(this.#timeoutMs / 1000);
  }

  /**
   * Set timeout in seconds
   * @param {number} seconds - Timeout in seconds (0 to disable)
   */
  setTimeout(seconds) {
    this.#timeoutMs = Math.max(0, seconds * 1000);
    this.#saveSettings();
    safeLog(`[SecureClipboard] Timeout set to ${seconds}s`);
  }

  /**
   * Set callback for when clipboard is cleared
   * @param {Function} callback - Called with reason string
   */
  setOnCleared(callback) {
    this.#onClearedCallback = callback;
  }

  /**
   * Set callback for when text is copied
   * @param {Function} callback - Called with { text, isSecure, timeoutMs }
   */
  setOnCopy(callback) {
    this.#onCopyCallback = callback;
  }

  // ==================== CORE OPERATIONS ====================

  /**
   * Copy text to clipboard with optional auto-clear
   * @param {string} text - Text to copy
   * @param {Object} [options] - Options
   * @param {boolean} [options.secure=true] - Whether to auto-clear
   * @param {string} [options.label] - Label for notifications
   * @returns {Promise<boolean>} - Success
   */
  async copy(text, options = {}) {
    const { secure = true, label = 'Texte' } = options;

    if (!text) {
      safeLog('[SecureClipboard] Empty text, ignoring copy');
      return false;
    }

    try {
      // Cancel any pending clear
      this.#cancelTimer();

      // Try Electron secure copy first (handles TTL natively)
      if (secure && window.electronAPI?.copyToClipboardSecure && this.#timeoutMs > 0) {
        await window.electronAPI.copyToClipboardSecure(text, this.#timeoutMs);
        this.#storeReference(text);
        safeLog(`[SecureClipboard] Copied via Electron (secure, ${this.#timeoutMs}ms TTL)`);
      } else {
        // Fallback to browser clipboard API
        await navigator.clipboard.writeText(text);
        this.#storeReference(text);

        // Schedule auto-clear if secure
        if (secure && this.#timeoutMs > 0) {
          this.#scheduleAutoClear();
        }
        safeLog(`[SecureClipboard] Copied via browser API${secure ? ` (auto-clear in ${this.#timeoutMs}ms)` : ''}`);
      }

      // Notify callback
      if (this.#onCopyCallback) {
        this.#onCopyCallback({
          text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
          isSecure: secure,
          timeoutMs: secure ? this.#timeoutMs : 0,
          label
        });
      }

      return true;
    } catch (error) {
      console.error('[SecureClipboard] Copy failed:', error);
      return false;
    }
  }

  /**
   * Clear clipboard immediately (with verification)
   * @param {boolean} [force=false] - Force clear without verification
   * @returns {Promise<boolean>}
   */
  async clear(force = false) {
    if (this.#isClearing) return false;
    this.#isClearing = true;

    try {
      this.#cancelTimer();

      // Verify content before clearing (unless forced)
      if (!force && this.#copiedHash) {
        const currentContent = await this.#getCurrentClipboard();
        const currentHash = await this.#hashText(currentContent);

        if (currentHash !== this.#copiedHash) {
          safeLog('[SecureClipboard] Content changed, skipping clear (user copied something else)');
          this.#resetReference();
          this.#isClearing = false;
          return false;
        }
      }

      // Perform secure clear with multiple overwrites
      await this.#secureClear();

      this.#handleCleared('manual');
      return true;
    } catch (error) {
      console.error('[SecureClipboard] Clear failed:', error);
      return false;
    } finally {
      this.#isClearing = false;
    }
  }

  /**
   * Check if we have pending auto-clear
   * @returns {boolean}
   */
  hasPending() {
    return this.#timerId !== null;
  }

  /**
   * Get time remaining until auto-clear (in seconds)
   * @returns {number|null}
   */
  getTimeRemaining() {
    if (!this.#timerId) return null;
    // Note: We'd need to track start time for accurate remaining time
    // This is a simplified version
    return Math.floor(this.#timeoutMs / 1000);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Store reference to copied text for verification
   * @private
   * @param {string} text
   */
  async #storeReference(text) {
    this.#copiedText = text;
    this.#copiedLength = text.length;
    this.#copiedHash = await this.#hashText(text);
  }

  /**
   * Reset stored reference
   * @private
   */
  #resetReference() {
    this.#copiedText = null;
    this.#copiedLength = null;
    this.#copiedHash = null;
  }

  /**
   * Hash text for comparison (SHA-256)
   * @private
   * @param {string} text
   * @returns {Promise<string>}
   */
  async #hashText(text) {
    if (!text) return '';
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback: simple hash
      return String(text.length) + text.substring(0, 10);
    }
  }

  /**
   * Get current clipboard content
   * @private
   * @returns {Promise<string>}
   */
  async #getCurrentClipboard() {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Clipboard access may be blocked
      return '';
    }
  }

  /**
   * Schedule auto-clear timer
   * @private
   */
  #scheduleAutoClear() {
    this.#cancelTimer();

    if (this.#timeoutMs <= 0) return;

    this.#timerId = window.setTimeout(async () => {
      await this.clear();
    }, this.#timeoutMs);

    safeLog(`[SecureClipboard] Auto-clear scheduled in ${this.#timeoutMs}ms`);
  }

  /**
   * Cancel pending timer
   * @private
   */
  #cancelTimer() {
    if (this.#timerId) {
      window.clearTimeout(this.#timerId);
      this.#timerId = null;
    }
  }

  /**
   * Perform secure clipboard clear with multiple overwrites
   * @private
   */
  async #secureClear() {
    try {
      // Try Electron clear first
      if (window.electronAPI?.clearClipboard) {
        await window.electronAPI.clearClipboard();
        safeLog('[SecureClipboard] Cleared via Electron API');
        return;
      }

      // Browser fallback: overwrite multiple times
      const length = this.#copiedLength || 32;

      // Pass 1: Random data
      const randomData = Array.from(crypto.getRandomValues(new Uint8Array(length)))
        .map(b => String.fromCharCode(b % 94 + 33))
        .join('');
      await navigator.clipboard.writeText(randomData);

      // Pass 2: Spaces (same length)
      await navigator.clipboard.writeText(' '.repeat(length));

      // Pass 3: Empty
      await navigator.clipboard.writeText('');

      safeLog('[SecureClipboard] Cleared via browser API (3-pass overwrite)');
    } catch (error) {
      console.error('[SecureClipboard] Secure clear error:', error);
      // Last resort: try simple clear
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Give up
      }
    }
  }

  /**
   * Handle clipboard cleared event
   * @private
   * @param {string} reason
   */
  #handleCleared(reason) {
    this.#resetReference();
    this.#cancelTimer();

    if (this.#onClearedCallback) {
      try {
        this.#onClearedCallback(reason);
      } catch (error) {
        console.error('[SecureClipboard] Cleared callback error:', error);
      }
    }

    safeLog(`[SecureClipboard] Clipboard cleared (reason: ${reason})`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get the singleton secure clipboard instance
 * @returns {SecureClipboard}
 */
export function getSecureClipboard() {
  return SecureClipboard.getInstance();
}

/**
 * Quick copy with secure auto-clear
 * @param {string} text - Text to copy
 * @param {string} [label] - Label for notifications
 * @returns {Promise<boolean>}
 */
export async function secureCopy(text, label) {
  return getSecureClipboard().copy(text, { secure: true, label });
}

/**
 * Quick copy without auto-clear
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>}
 */
export async function unsecureCopy(text) {
  return getSecureClipboard().copy(text, { secure: false });
}

/**
 * Clear clipboard now
 * @param {boolean} [force=false] - Force clear without verification
 * @returns {Promise<boolean>}
 */
export async function clearClipboard(force = false) {
  return getSecureClipboard().clear(force);
}

export default SecureClipboard;
