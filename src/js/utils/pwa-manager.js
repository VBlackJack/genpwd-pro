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

/**
 * PWA Manager - Handles Service Worker registration and PWA installation
 */
class PWAManager {
  constructor() {
    this.registration = null;
    this.updateAvailable = false;
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;

    safeLog('PWAManager initialized');
  }

  /**
   * Initialize PWA Manager
   * Register Service Worker and set up event listeners
   */
  async init() {
    // Check for Service Worker support
    if (!('serviceWorker' in navigator)) {
      safeLog('Service Worker not supported');
      return;
    }

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
      });

      // Check if already controlled by SW
      if (navigator.serviceWorker.controller) {
        safeLog('Page is controlled by Service Worker');
      }

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.onMessage(event);
      });

      // Set up install prompt listener
      this.setupInstallPrompt();

      // Set up online/offline listeners
      this.setupOnlineListeners();

      // Notify user if offline on load
      if (!this.isOnline) {
        showToast('Offline mode - Using cached resources', 'info');
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
      showToast('App updated - Using latest version', 'success');
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
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 10000;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    updateBtn.innerHTML = sanitizeHTML(`
      <div style="display: flex; align-items: center; gap: 10px;">
        <span>✨ New version available!</span>
        <button id="update-app-btn" style="background: white; color: #4CAF50; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: 600;">
          Update
        </button>
        <button id="dismiss-update-btn" style="background: transparent; color: white; border: 1px solid white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
          Later
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
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent default prompt
      event.preventDefault();

      // Store event for later use
      this.deferredPrompt = event;

      safeLog('Install prompt ready');

      // Show custom install UI
      this.showInstallUI();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      safeLog('PWA installed successfully');
      showToast('GenPwd Pro installed successfully!', 'success');
      this.deferredPrompt = null;
    });
  }

  /**
   * Show custom install UI
   */
  showInstallUI() {
    // Check if already showing install UI
    if (document.getElementById('pwa-install-banner')) return;

    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      max-width: 90%;
      animation: slideDown 0.3s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    installBanner.innerHTML = sanitizeHTML(`
      <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 5px;">📱 Install GenPwd Pro</div>
          <div style="font-size: 0.9em; opacity: 0.95;">Add to home screen for offline access</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="pwa-install-btn" style="background: white; color: #667eea; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95em;">
            Install
          </button>
          <button id="pwa-dismiss-btn" style="background: transparent; color: white; border: 1px solid rgba(255,255,255,0.5); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.95em;">
            Not now
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
        showToast('Installing GenPwd Pro...', 'info');
      }

      // Clear prompt
      this.deferredPrompt = null;
      installBanner.remove();
    });

    // Dismiss button
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      installBanner.remove();

      // Don't show again for 7 days
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.getElementById('pwa-install-banner')) {
        installBanner.remove();
      }
    }, 10000);
  }

  /**
   * Set up online/offline event listeners
   */
  setupOnlineListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      safeLog('Back online');
      showToast('✅ Back online', 'success');

      // Sync when back online
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      safeLog('Gone offline');
      showToast('⚠️ Offline mode - Using cached data', 'warning');
    });
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
