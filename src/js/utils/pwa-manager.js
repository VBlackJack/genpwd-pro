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

// src/js/utils/pwa-manager.js - PWA Manager for Service Worker registration and installation

import { safeLog } from './logger.js';
import { showToast } from './toast.js';
import { sanitizeHTML } from './dom-sanitizer.js';
import { i18n } from './i18n.js';

const INSTALL_DISMISS_KEY = 'pwa-install-dismissed';
const INSTALL_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * PWA Manager - Handles Service Worker registration and PWA installation
 */
class PWAManager {
  constructor() {
    this.registration = null;
    this.updateAvailable = false;
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;
    this._abortController = null;

    safeLog('PWAManager initialized');
  }

  /**
   * Cleanup all event listeners
   */
  cleanup() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    safeLog('PWAManager cleaned up');
  }

  /**
   * Initialize PWA Manager
   * Register Service Worker and set up event listeners
   */
  async init() {
    // Skip in Electron (file:// protocol doesn't support Service Workers)
    if (window.electronAPI?.isElectron) {
      safeLog('PWA features disabled in Electron');
      return;
    }

    // Check for Service Worker support
    if (!('serviceWorker' in navigator)) {
      safeLog('Service Worker not supported');
      return;
    }

    // Initialize AbortController for cleanup
    this.cleanup();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    try {
      // Register Service Worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      safeLog(`Service Worker registered with scope: ${this.registration.scope}`);

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        this.onUpdateFound();
      });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.onControllerChange();
      }, { signal });

      // Check if already controlled by SW
      if (navigator.serviceWorker.controller) {
        safeLog('Page is controlled by Service Worker');
      }

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.onMessage(event);
      }, { signal });

      // Set up install prompt listener
      this.setupInstallPrompt(signal);

      // Set up online/offline listeners
      this.setupOnlineListeners(signal);

      // Notify user if offline on load
      if (!this.isOnline) {
        showToast(i18n.t('toast.offlineModeCache'), 'info');
      }

    } catch (error) {
      safeLog(`Service Worker registration failed: ${error.message}`);
    }
  }

  /**
   * Handle Service Worker update found
   */
  onUpdateFound() {
    const newWorker = this.registration.installing;

    if (!newWorker) return;

    safeLog('New Service Worker found');

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New SW installed but old SW still in control
        this.updateAvailable = true;
        safeLog('New version available');
        this.showUpdateNotification();
      }
    });
  }

  /**
   * Handle controller change (new SW activated)
   */
  onControllerChange() {
    safeLog('New Service Worker activated');

    // Reload page to use new SW
    if (this.updateAvailable) {
      window.location.reload();
    }
  }

  /**
   * Handle messages from Service Worker
   */
  onMessage(event) {
    safeLog(`Message from SW: ${JSON.stringify(event.data)}`);

    if (event.data.type === 'CACHE_UPDATED') {
      showToast(i18n.t('toast.appUpdated'), 'success');
    }
  }

  /**
   * Show update notification to user
   */
  showUpdateNotification() {
    const updateBtn = document.createElement('div');
    updateBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--accent-green, #4CAF50);
      color: var(--text-on-accent, #070b14);
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 10000;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    updateBtn.innerHTML = sanitizeHTML(`
      <div class="pwa-update-content">
        <span>✨ ${i18n.t('toast.updateAvailable')}</span>
        <button id="update-app-btn" class="pwa-update-btn">
          ${i18n.t('toast.updateAction')}
        </button>
        <button id="dismiss-update-btn" class="pwa-dismiss-btn">
          ${i18n.t('toast.updateDismiss')}
        </button>
      </div>
    `);

    document.body.appendChild(updateBtn);

    // Update button
    document.getElementById('update-app-btn').addEventListener('click', () => {
      // Tell SW to skip waiting
      if (this.registration.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      updateBtn.remove();
    });

    // Dismiss button
    document.getElementById('dismiss-update-btn').addEventListener('click', () => {
      updateBtn.remove();
    });
  }

  /**
   * Set up beforeinstallprompt event listener
   */
  setupInstallPrompt(signal) {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent default prompt
      event.preventDefault();

      // Store event for later use
      this.deferredPrompt = event;

      safeLog('Install prompt ready');

      // Show custom install UI
      if (!this.isInstallPromptDismissed()) {
        this.showInstallUI();
      }
    }, { signal });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      safeLog('PWA installed successfully');
      showToast(i18n.t('toast.appInstalled'), 'success');
      this.deferredPrompt = null;
    }, { signal });
  }

  /**
   * Show custom install UI
   */
  showInstallUI() {
    // Check if already showing install UI
    if (document.getElementById('pwa-install-banner')) return;
    if (this.isInstallPromptDismissed()) return;

    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: var(--text-on-windows-hello, #ffffff);
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      max-width: 90%;
      animation: slideDown 0.3s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    installBanner.innerHTML = sanitizeHTML(`
      <div class="pwa-install-content">
        <div class="pwa-install-info">
          <div class="pwa-install-title">📱 ${i18n.t('pwa.installTitle')}</div>
          <div class="pwa-install-subtitle">${i18n.t('pwa.installSubtitle')}</div>
        </div>
        <div class="pwa-install-actions">
          <button id="pwa-install-btn" class="pwa-install-btn">
            ${i18n.t('pwa.install')}
          </button>
          <button id="pwa-dismiss-btn" class="pwa-install-dismiss-btn">
            ${i18n.t('pwa.notNow')}
          </button>
        </div>
      </div>
    `);

    document.body.appendChild(installBanner);

    // Install button
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!this.deferredPrompt) return;

      // Show install prompt
      this.deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await this.deferredPrompt.userChoice;

      safeLog(`Install prompt outcome: ${outcome}`);

      if (outcome === 'accepted') {
        showToast(i18n.t('toast.installingApp'), 'info');
      }

      // Clear prompt
      this.deferredPrompt = null;
      installBanner.remove();
    });

    // Dismiss button
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      installBanner.remove();

      // Don't show again for 7 days
      this.markInstallPromptDismissed();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.getElementById('pwa-install-banner')) {
        installBanner.remove();
      }
    }, 10000);
  }

  /**
   * Check whether install prompt has been dismissed recently
   * @returns {boolean}
   */
  isInstallPromptDismissed() {
    try {
      const dismissedAtRaw = localStorage.getItem(INSTALL_DISMISS_KEY);
      if (!dismissedAtRaw) return false;
      const dismissedAt = Number.parseInt(dismissedAtRaw, 10);
      if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) {
        return false;
      }
      return (Date.now() - dismissedAt) < INSTALL_DISMISS_DURATION_MS;
    } catch {
      return false;
    }
  }

  /**
   * Persist dismiss timestamp for install prompt
   */
  markInstallPromptDismissed() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString());
    } catch {
      // Ignore storage failures
    }
  }

  /**
   * Set up online/offline event listeners
   */
  setupOnlineListeners(signal) {
    window.addEventListener('online', () => {
      this.isOnline = true;
      safeLog('Back online');
      showToast('✅ ' + i18n.t('toast.backOnline'), 'success');

      // Sync when back online
      this.syncWhenOnline();
    }, { signal });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      safeLog('Gone offline');
      showToast('⚠️ ' + i18n.t('toast.offlineMode'), 'warning');
    }, { signal });
  }

  /**
   * Sync data when back online
   */
  async syncWhenOnline() {
    if ('sync' in this.registration) {
      try {
        await this.registration.sync.register('sync-passwords');
        safeLog('Background sync registered');
      } catch (error) {
        safeLog(`Background sync registration failed: ${error.message}`);
      }
    }
  }

  /**
   * Get Service Worker version
   */
  async getVersion() {
    if (!this.registration) return null;

    try {
      const messageChannel = new MessageChannel();

      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };

        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );

        // Timeout after 1 second
        setTimeout(() => resolve(null), 1000);
      });
    } catch (error) {
      safeLog(`Error getting SW version: ${error.message}`);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  async clearCaches() {
    if (!this.registration) return false;

    try {
      const messageChannel = new MessageChannel();

      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };

        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      safeLog(`Error clearing caches: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if app is running as PWA
   */
  isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }

  /**
   * Get app status
   */
  getStatus() {
    return {
      serviceWorkerRegistered: !!this.registration,
      isPWA: this.isPWA(),
      isOnline: this.isOnline,
      updateAvailable: this.updateAvailable,
      canInstall: !!this.deferredPrompt
    };
  }
}

// Create singleton instance
const pwaManager = new PWAManager();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pwaManager.init();
  });
} else {
  pwaManager.init();
}

export default pwaManager;
export { PWAManager };
