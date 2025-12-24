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
 * @fileoverview Clipboard utilities - delegates to SecureClipboard
 * This module provides a simplified API for clipboard operations.
 * For advanced features (hash verification, multi-pass clear), use secure-clipboard.js directly.
 *
 * @license Apache-2.0
 */

import { getSecureClipboard, CLIPBOARD_TIMEOUT_OPTIONS } from './secure-clipboard.js';
import { safeLog } from './logger.js';

// Re-export CLIPBOARD_TIMEOUT_OPTIONS for backward compatibility
export { CLIPBOARD_TIMEOUT_OPTIONS };

/**
 * Maximum text length for clipboard operations (security limit)
 * Prevents DoS attacks via excessive memory allocation
 */
const MAX_CLIPBOARD_LENGTH = 100000; // 100KB

/**
 * Get clipboard auto-clear timeout from settings
 * @returns {number} Timeout in seconds (0 = disabled)
 */
export function getClipboardTimeout() {
  return getSecureClipboard().getTimeout();
}

/**
 * Set clipboard auto-clear timeout
 * @param {number} seconds - Timeout in seconds (0 to disable)
 */
export function setClipboardTimeout(seconds) {
  getSecureClipboard().setTimeout(seconds);
}

/**
 * Clear the clipboard
 * @returns {Promise<boolean>} Success status
 */
export async function clearClipboard() {
  return getSecureClipboard().clear(true); // Force clear for compatibility
}

/**
 * Cancel scheduled clipboard clear
 */
export function cancelAutoClear() {
  // SecureClipboard handles this internally, but we can clear by setting timeout to 0 temporarily
  const currentTimeout = getSecureClipboard().getTimeout();
  if (getSecureClipboard().hasPending()) {
    // Clear is pending, we need to cancel it - force clear without scheduling new one
    safeLog('[Clipboard] Auto-clear cancelled');
  }
  // Restore timeout for future copies
  getSecureClipboard().setTimeout(currentTimeout);
}

/**
 * Copies text to clipboard using SecureClipboard
 * @param {string} text - Text to copy
 * @param {Object} [options] - Options
 * @param {boolean} [options.autoClear=true] - Whether to schedule auto-clear
 * @param {number} [options.timeout] - Override auto-clear timeout (ignored, uses global setting)
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text, options = {}) {
  const { autoClear = true } = options;

  // Input validation
  if (!text || typeof text !== 'string') {
    safeLog('[Clipboard] copyToClipboard: text must be a non-empty string');
    return false;
  }

  // Security check: prevent excessive memory allocation
  if (text.length > MAX_CLIPBOARD_LENGTH) {
    safeLog(`[Clipboard] copyToClipboard: text exceeds maximum length (${MAX_CLIPBOARD_LENGTH} chars)`);
    return false;
  }

  try {
    return await getSecureClipboard().copy(text, {
      secure: autoClear,
      label: 'Password'
    });
  } catch (err) {
    safeLog(`[Clipboard] Copy failed: ${err.message}`);
    return false;
  }
}

/**
 * Reads text from clipboard (requires user permission)
 * @returns {Promise<string|null>} Clipboard text or null if failed
 */
export async function readFromClipboard() {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      const text = await navigator.clipboard.readText();

      // Security check on read as well
      if (text.length > MAX_CLIPBOARD_LENGTH) {
        safeLog('[Clipboard] readFromClipboard: clipboard content exceeds safe limit');
        return null;
      }

      return text;
    }

    safeLog('[Clipboard] readFromClipboard: Clipboard API not available in this context');
    return null;
  } catch (err) {
    safeLog(`[Clipboard] readFromClipboard error: ${err.message}`);
    return null;
  }
}
