/**
 * @fileoverview Clipboard Service
 * Secure clipboard operations with auto-clear functionality
 */

import { getSecureClipboard } from '../../utils/secure-clipboard.js';

/**
 * Create a clipboard service instance
 * @param {Object} options - Service options
 * @param {Function} options.onSuccess - Callback for successful copy (message)
 * @param {Function} options.onError - Callback for copy errors
 * @param {Function} options.onCleared - Callback when clipboard is cleared (reason)
 * @returns {Object} Clipboard service instance
 */
export function createClipboardService(options = {}) {
  const { onSuccess, onError, onCleared } = options;
  let callbackSet = false;

  /**
   * Copy text to clipboard with optional auto-clear
   * @param {string} text - Text to copy
   * @param {string} message - Success message
   * @param {boolean} autoClear - Auto-clear clipboard after timeout
   * @returns {Promise<boolean>} Success status
   */
  async function copy(text, message, autoClear = true) {
    if (!text) return false;

    try {
      const secureClipboard = getSecureClipboard();

      // Set up cleared callback (once)
      if (!callbackSet && onCleared) {
        secureClipboard.setOnCleared((reason) => {
          if (reason === 'manual' || reason === 'timeout') {
            onCleared(reason);
          }
        });
        callbackSet = true;
      }

      // Copy using secure clipboard
      const success = await secureClipboard.copy(text, {
        secure: autoClear,
        label: message
      });

      if (success) {
        onSuccess?.(message);
        return true;
      } else {
        onError?.();
        return false;
      }
    } catch {
      onError?.();
      return false;
    }
  }

  /**
   * Clear clipboard immediately
   * @returns {Promise<void>}
   */
  async function clear() {
    try {
      const secureClipboard = getSecureClipboard();
      await secureClipboard.clearNow?.();
    } catch {
      // Ignore errors
    }
  }

  return {
    copy,
    clear
  };
}
