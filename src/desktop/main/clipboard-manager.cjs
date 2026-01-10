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
 * Secure Clipboard Manager for Electron
 *
 * Provides secure clipboard operations with automatic clearing
 * to prevent password leakage.
 *
 * Features:
 * - Auto-clear after configurable TTL (default: 30s)
 * - Countdown notifications
 * - Windows Clipboard History warning
 * - Manual clear capability
 *
 * @module clipboard-manager
 */

const { clipboard, Notification } = require('electron');

/**
 * Clipboard Manager class
 */
class ClipboardManager {
  /**
   * Create a ClipboardManager instance
   * @param {Object} options - Configuration options
   * @param {number} options.defaultTTL - Default auto-clear time in ms (default: 30000)
   * @param {boolean} options.showNotifications - Show clear notifications (default: true)
   * @param {Function} options.onCleared - Callback when clipboard is cleared
   * @param {Function} options.onCountdownStarted - Callback when countdown starts
   */
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 30000;
    this.showNotifications = options.showNotifications !== false;
    this.onCleared = options.onCleared || (() => {});
    this.onCountdownStarted = options.onCountdownStarted || (() => {});

    this.clearTimer = null;
    this.currentTTL = 0;
    this.startTime = 0;
    this.copiedContent = null;

    // Track if we've shown the Windows clipboard history warning
    this.clipboardHistoryWarningShown = false;
  }

  /**
   * Copy text to clipboard with auto-clear
   * @param {string} text - Text to copy
   * @param {number} ttlMs - Time to live in milliseconds
   * @returns {Object} Result with remaining time info
   */
  copySecure(text, ttlMs = this.defaultTTL) {
    // Clear any existing timer
    this.clearTimer && clearTimeout(this.clearTimer);

    // Copy to clipboard
    clipboard.writeText(text);
    this.copiedContent = text;
    this.currentTTL = ttlMs;
    this.startTime = Date.now();

    // Start auto-clear timer
    this.clearTimer = setTimeout(() => {
      this.clear(true);
    }, ttlMs);

    // Notify countdown started
    this.onCountdownStarted({
      ttlMs,
      startTime: this.startTime
    });

    return {
      success: true,
      ttlMs,
      expiresAt: this.startTime + ttlMs
    };
  }

  /**
   * Clear clipboard immediately
   * @param {boolean} isAutomatic - Whether this is an automatic clear
   * @returns {Object} Result
   */
  clear(isAutomatic = false) {
    // Only clear if we were the ones who set the clipboard
    const currentContent = clipboard.readText();
    const wasOurContent = currentContent === this.copiedContent;

    if (wasOurContent || !isAutomatic) {
      clipboard.clear();
    }

    // Clear timer
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }

    // Reset state
    this.copiedContent = null;
    this.currentTTL = 0;
    this.startTime = 0;

    // Notify
    this.onCleared({
      wasAutomatic: isAutomatic,
      wasOurContent
    });

    return {
      success: true,
      wasAutomatic: isAutomatic,
      wasOurContent
    };
  }

  /**
   * Get remaining time until auto-clear
   * @returns {Object} TTL info
   */
  getTTL() {
    if (!this.clearTimer || !this.startTime) {
      return {
        active: false,
        remainingMs: 0,
        totalMs: 0
      };
    }

    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.currentTTL - elapsed);

    return {
      active: remaining > 0,
      remainingMs: remaining,
      totalMs: this.currentTTL,
      progress: 1 - (remaining / this.currentTTL)
    };
  }

  /**
   * Extend the current TTL
   * @param {number} additionalMs - Additional time to add
   * @returns {Object} New TTL info
   */
  extendTTL(additionalMs) {
    if (!this.clearTimer) {
      return { success: false, error: 'No active clipboard timer' };
    }

    // Clear current timer
    clearTimeout(this.clearTimer);

    // Calculate new TTL
    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.currentTTL - elapsed);
    const newRemaining = remaining + additionalMs;

    // Set new timer
    this.clearTimer = setTimeout(() => {
      this.clear(true);
    }, newRemaining);

    // Update total TTL for progress calculation
    this.currentTTL = elapsed + newRemaining;

    return {
      success: true,
      remainingMs: newRemaining,
      totalMs: this.currentTTL
    };
  }

  /**
   * Show Windows Clipboard History warning (once per session)
   * @param {Object} translations - Translation strings
   */
  showClipboardHistoryWarning(translations) {
    if (this.clipboardHistoryWarningShown) return;
    if (process.platform !== 'win32') return;

    this.clipboardHistoryWarningShown = true;

    // Only show if Notifications are supported
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: translations.securityTip || 'Security Tip',
        body: translations.clipboardHistoryWarning ||
          'Windows Clipboard History (Win+V) may retain copied passwords. Consider disabling it.',
        silent: true
      });
      notification.show();
    }
  }

  /**
   * Destroy the manager and clear any pending timers
   */
  destroy() {
    this.clear(false);
    this.onCleared = () => {};
    this.onCountdownStarted = () => {};
  }
}

/**
 * Create IPC handlers for clipboard operations
 * @param {Object} ipcMain - Electron ipcMain
 * @param {ClipboardManager} manager - ClipboardManager instance
 * @param {BrowserWindow} mainWindow - Main window for notifications
 */
function registerClipboardIPC(ipcMain, manager, getMainWindow) {
  // Copy with auto-clear
  ipcMain.handle('clipboard:copy-secure', async (event, text, ttlMs) => {
    return manager.copySecure(text, ttlMs);
  });

  // Clear immediately
  ipcMain.handle('clipboard:clear', async () => {
    return manager.clear(false);
  });

  // Get TTL info
  ipcMain.handle('clipboard:get-ttl', async () => {
    return manager.getTTL();
  });

  // Set up event forwarding to renderer
  manager.onCleared = (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clipboard:cleared', data);
    }
  };

  manager.onCountdownStarted = (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clipboard:countdown-started', data);
    }
  };
}

module.exports = {
  ClipboardManager,
  registerClipboardIPC
};
