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
// src/js/utils/clipboard.js - Gestion sécurisée du presse-papiers
import { safeLog } from './logger.js';

/**
 * Maximum text length for clipboard operations (security limit)
 * Prevents DoS attacks via excessive memory allocation
 */
const MAX_CLIPBOARD_LENGTH = 100000; // 100KB

/**
 * Auto-clear timer ID
 * @type {number|null}
 */
let autoClearTimer = null;

/**
 * Default auto-clear timeout options (in seconds)
 * Aligned with secure-clipboard.js
 */
export const CLIPBOARD_TIMEOUT_OPTIONS = Object.freeze([
  { value: 0, label: 'Désactivé', ms: 0 },
  { value: 10, label: '10 secondes', ms: 10 * 1000 },
  { value: 30, label: '30 secondes', ms: 30 * 1000 },
  { value: 60, label: '1 minute', ms: 60 * 1000 },
  { value: 120, label: '2 minutes', ms: 2 * 60 * 1000 },
  { value: 300, label: '5 minutes', ms: 5 * 60 * 1000 }
]);

/**
 * Get clipboard auto-clear timeout from settings
 * @returns {number} Timeout in seconds (0 = disabled)
 */
export function getClipboardTimeout() {
  const stored = localStorage.getItem('clipboard-auto-clear');
  if (stored === null) return 30; // Default: 30 seconds
  const value = parseInt(stored, 10);
  return isNaN(value) ? 30 : value;
}

/**
 * Set clipboard auto-clear timeout
 * @param {number} seconds - Timeout in seconds (0 to disable)
 */
export function setClipboardTimeout(seconds) {
  localStorage.setItem('clipboard-auto-clear', seconds.toString());
}

/**
 * Clear the clipboard
 * @returns {Promise<boolean>} Success status
 */
export async function clearClipboard() {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText('');
      safeLog('Clipboard cleared');
      return true;
    }
    return false;
  } catch (err) {
    safeLog(`Failed to clear clipboard: ${err.message}`);
    return false;
  }
}

/**
 * Schedule clipboard auto-clear
 * @param {number} [timeout] - Override timeout in seconds
 */
function scheduleAutoClear(timeout) {
  // Cancel any existing timer
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }

  const seconds = timeout ?? getClipboardTimeout();
  if (seconds <= 0) return; // Auto-clear disabled

  autoClearTimer = setTimeout(async () => {
    try {
      await clearClipboard();
      autoClearTimer = null;

      // Dispatch event for UI feedback
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clipboard-cleared', {
          detail: { auto: true }
        }));
      }
    } catch (err) {
      safeLog('Auto-clear clipboard failed:', err);
    }
  }, seconds * 1000);

  safeLog(`Clipboard will auto-clear in ${seconds}s`);
}

/**
 * Cancel scheduled clipboard clear
 */
export function cancelAutoClear() {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
    safeLog('Auto-clear cancelled');
  }
}

/**
 * Copies text to clipboard using modern Clipboard API or fallback
 * @param {string} text - Text to copy
 * @param {Object} [options] - Options
 * @param {boolean} [options.autoClear=true] - Whether to schedule auto-clear
 * @param {number} [options.timeout] - Override auto-clear timeout
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If text exceeds maximum length
 */
export async function copyToClipboard(text, options = {}) {
  const { autoClear = true, timeout } = options;
  // Input validation
  if (!text || typeof text !== 'string') {
    safeLog('copyToClipboard: text must be a non-empty string');
    return false;
  }

  // Security check: prevent excessive memory allocation
  if (text.length > MAX_CLIPBOARD_LENGTH) {
    safeLog(`copyToClipboard: text exceeds maximum length (${MAX_CLIPBOARD_LENGTH} chars)`);
    return false;
  }

  try {
    let success = false;

    // Prefer modern Clipboard API in secure contexts
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      safeLog('Text copied to clipboard using Clipboard API');
      success = true;
    } else {
      // Fallback for non-secure contexts or older browsers
      safeLog('Using fallback clipboard method (non-secure context or old browser)');
      success = fallbackCopyTextToClipboard(text);
    }

    // Schedule auto-clear if copy was successful
    if (success && autoClear) {
      scheduleAutoClear(timeout);
    }

    return success;
  } catch (err) {
    safeLog(`Clipboard API failed: ${err.message}, trying fallback`);
    const success = fallbackCopyTextToClipboard(text);
    if (success && autoClear) {
      scheduleAutoClear(timeout);
    }
    return success;
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
        safeLog('readFromClipboard: clipboard content exceeds safe limit');
        return null;
      }

      return text;
    }

    safeLog('readFromClipboard: Clipboard API not available in this context');
    return null;
  } catch (err) {
    safeLog(`readFromClipboard error: ${err.message}`);
    return null;
  }
}

/**
 * Fallback clipboard copy method using deprecated execCommand
 * Used for older browsers or non-secure contexts (http://)
 * @param {string} text - Text to copy
 * @returns {boolean} Success status
 * @private
 */
function fallbackCopyTextToClipboard(text) {
  let textArea = null;

  try {
    // Create temporary textarea element (off-screen)
    textArea = document.createElement('textarea');
    textArea.value = text;

    // Style to make invisible but functional
    Object.assign(textArea.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '2em',
      height: '2em',
      padding: '0',
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      opacity: '0',
      pointerEvents: 'none' // Prevent any user interaction
    });

    // Set readonly to prevent keyboard popup on mobile
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);

    // iOS Safari requires special handling
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, text.length);
    } else {
      textArea.focus();
      textArea.select();
    }

    // Execute deprecated copy command
    const successful = document.execCommand('copy');

    if (successful) {
      safeLog('Text copied using fallback method (execCommand)');
    } else {
      safeLog('Fallback clipboard copy failed (execCommand returned false)');
    }

    return successful;
  } catch (err) {
    safeLog(`Fallback clipboard error: ${err.message}`);
    return false;
  } finally {
    // Ensure textarea is always removed, even if error occurs
    if (textArea && textArea.parentNode) {
      document.body.removeChild(textArea);
    }
  }
}
