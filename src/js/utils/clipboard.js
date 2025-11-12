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
 * Copies text to clipboard using modern Clipboard API or fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If text exceeds maximum length
 */
export async function copyToClipboard(text) {
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
    // Prefer modern Clipboard API in secure contexts
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      safeLog('Text copied to clipboard using Clipboard API');
      return true;
    }

    // Fallback for non-secure contexts or older browsers
    safeLog('Using fallback clipboard method (non-secure context or old browser)');
    return fallbackCopyTextToClipboard(text);
  } catch (err) {
    safeLog(`Clipboard API failed: ${err.message}, trying fallback`);
    return fallbackCopyTextToClipboard(text);
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
