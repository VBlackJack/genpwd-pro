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
// src/js/app.js - Main application entry point
import { validateCharSets } from './config/constants.js';
import { initializeDictionaries } from './core/dictionaries.js';
import { initializeDOM } from './ui/dom.js';
import { bindEventHandlers } from './ui/events.js';
import { bindModalEvents } from './ui/modal.js';
import { defaultBlocksForMode } from './core/casing.js';
import { setBlocks } from './config/settings.js';
import { safeLog } from './utils/logger.js';
import { showToast } from './utils/toast.js';
import { initErrorMonitoring, reportError } from './utils/error-monitoring.js';
import { ANIMATION_DURATION } from './config/ui-constants.js';
import { initThemeSystem } from './utils/theme-manager.js';
import { isDevelopment } from './utils/environment.js';
import { initKeyboardShortcuts, removeKeyboardShortcuts } from './utils/keyboard-shortcuts.js';

// Feature imports (v3.0.0)
import { i18n } from './utils/i18n.js';
import { initSentry, captureException } from './config/sentry-config.js';
import analytics from './utils/analytics.js';
import presetManager from './utils/preset-manager.js';
import historyManager from './utils/history-manager.js';
import { initializeAllFeatures } from './ui/features-ui.js';
import pwaManager from './utils/pwa-manager.js';

// Vault UI (Electron only)
import { VaultUI } from './vault-ui.js';
import { VaultBridge } from './ui/vault-bridge.js';

// Phase 4+5: Native integration
import { initNativeIntegration, cleanupNativeIntegration } from './ui/native-integration.js';

// Singleton tooltip manager
import { initTooltips } from './ui/tooltip-manager.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '3.0.0';
    this.vaultUI = null;
  }

  async init() {
    try {
      safeLog(`Starting GenPwd Pro v${this.version} - Modular architecture`);

      // 0. Initialize theme system (first for UI)
      initThemeSystem();
      safeLog('Theme system initialized');

      // 1. Initialize error monitoring
      initErrorMonitoring();
      safeLog('Error monitoring initialized');

      // 1.1 NEW: Initialize Sentry (optional, configured via SENTRY_DSN)
      try {
        await initSentry();
        safeLog('Sentry initialized');
      } catch (error) {
        safeLog('Sentry not configured or disabled');
      }

      // 1.2 NEW: Initialize Analytics (optional, configured via provider)
      if (analytics.config.provider !== 'none') {
        analytics.init();
        safeLog(`Analytics initialized: ${analytics.config.provider}`);
      }

      // 1.3 NEW: Initialize i18n and load locale
      try {
        const detectedLocale = i18n.detectLocale();
        await i18n.loadLocale(detectedLocale);
        await i18n.setLocale(detectedLocale);
        // Translate static HTML elements with data-i18n attributes
        const translatedCount = i18n.translatePage();
        safeLog(`i18n initialized: ${detectedLocale} (${translatedCount} elements translated)`);
      } catch (i18nError) {
        safeLog(`i18n not available: ${i18nError.message} - continuing without i18n`);
      }

      // 2. Environment validation
      if (!this.validateEnvironment()) {
        throw new Error('Incompatible environment');
      }

      // 3. Critical data validation
      if (!validateCharSets()) {
        throw new Error('CHAR_SETS data corrupted');
      }

      // 4. DOM initialization
      await initializeDOM();
      safeLog('DOM initialized');

      // 4.1 NEW: Initialize new UI components
      this.initializeNewFeatures();
      safeLog('New UI features initialized');

      // 4.2 NEW: Initialize feature UIs (language, presets, history)
      initializeAllFeatures();
      safeLog('Feature UIs initialized (language, presets, history)');

      // 5. Dictionary initialization
      initializeDictionaries();
      safeLog('Dictionary system initialized');

      // 6. Initial block configuration
      const initialBlocks = defaultBlocksForMode('syllables');
      setBlocks(initialBlocks);
      safeLog(`Blocks initialized: ${initialBlocks.join('-')}`);

      // 7. Event binding
      bindEventHandlers();
      bindModalEvents();
      safeLog('Events bound');

      // 7.1 NEW: Bind new feature events
      this.bindNewFeatureEvents();
      safeLog('New feature events bound');

      // 7.2 NEW: Initialize keyboard shortcuts (accessibility)
      initKeyboardShortcuts();
      safeLog('Keyboard shortcuts initialized (Alt+G/C/R/S, Escape)');

      // 7.3 Initialize singleton tooltips (premium UI)
      initTooltips();
      safeLog('Singleton tooltips initialized');

      // 8. Initial generation after delay
      setTimeout(() => this.generateInitial(), ANIMATION_DURATION.INITIAL_GENERATION_DELAY);

      // 9. NEW: Track page view
      if (analytics.config.provider !== 'none') {
        analytics.trackPageView();
      }

      this.initialized = true;
      safeLog('Application initialized successfully');
      showToast(`GenPwd Pro v${this.version} loaded successfully`, 'success');

      // 10. Initialize Vault Bridge (for Generator-Vault communication)
      VaultBridge.init();
      safeLog('VaultBridge initialized');

      // 11. Initialize Native Integration (Electron only - Phase 4)
      if (window.electronAPI?.isElectron) {
        initNativeIntegration();
        safeLog('Native integration initialized (Tray, DeepLink, Clipboard, SecureStorage)');
      }

      // 12. Initialize Vault UI (Electron only)
      this.initializeVault();

    } catch (error) {
      safeLog(`Critical initialization error: ${error.message}`, 'error');
      reportError(error, { phase: 'initialization' });

      // NEW: Report to Sentry
      if (typeof captureException === 'function') {
        captureException(error, { phase: 'initialization' });
      }

      // Use i18n if available, fallback to English
      showToast(i18n?.t?.('toast.criticalStartupError') || 'Critical startup error', 'error');
    }
  }

  /**
   * Initialize features UI components
   */
  initializeNewFeatures() {
    // Check if managers are initialized
    if (presetManager) {
      safeLog(`Preset manager: ${presetManager.getAllPresets().length} presets loaded`);
    }

    if (historyManager) {
      const settings = historyManager.getSettings();
      safeLog(`History manager: ${settings.enabled ? 'enabled' : 'disabled'}`);
    }

    // Note: UI elements will be added via separate UI modules
    // This is just initialization logging
  }

  /**
   * Bind new feature event handlers
   */
  bindNewFeatureEvents() {
    // Language selector will be added via features-ui.js
    // Preset management UI will be added via features-ui.js
    // History UI will be added via features-ui.js

    // For now, expose managers globally for debugging
    if (isDevelopment()) {
      window.genpwdPresets = presetManager;
      window.genpwdHistory = historyManager;
      window.genpwdi18n = i18n;
      window.genpwdAnalytics = analytics;
      window.genpwdPWA = pwaManager;
      safeLog('Managers exposed globally for debugging');
    }
  }

  validateEnvironment() {
    // Check window APIs
    const windowAPIs = ['fetch', 'Promise', 'Map', 'Set', 'JSON'];

    for (const api of windowAPIs) {
      if (typeof window[api] === 'undefined') {
        safeLog(`Missing window API: ${api}`);
        return false;
      }
    }

    // Check specific APIs
    if (typeof Object.assign === 'undefined') {
      safeLog('Missing API: Object.assign');
      return false;
    }

    if (typeof document.querySelector === 'undefined') {
      safeLog('Missing API: document.querySelector');
      return false;
    }

    if (typeof window.addEventListener === 'undefined') {
      safeLog('Missing API: window.addEventListener');
      return false;
    }

    // Check CSS Grid support
    const testEl = document.createElement('div');
    testEl.style.setProperty('display', 'grid');
    if (testEl.style.display !== 'grid') {
      safeLog('CSS Grid not supported');
      return false;
    }

    safeLog('Environment validated successfully');
    return true;
  }

  /**
   * Initialize Vault UI (Electron only)
   */
  initializeVault() {
    // Check if running in Electron (vault API available)
    if (!window.vault) {
      safeLog('Vault API not available (browser mode)');
      return;
    }

    safeLog('Initializing vault system...');

    // Show header tabs
    const tabsEl = document.getElementById('app-tabs');
    if (tabsEl) {
      tabsEl.removeAttribute('hidden');
    }

    // Initialize vault UI
    const vaultContainer = document.getElementById('vault-container');
    if (vaultContainer) {
      this.vaultUI = new VaultUI(vaultContainer);
      this.vaultUI.init();
    }

    // Bind tab events
    this.bindVaultTabEvents();

    safeLog('Vault system initialized');
  }

  /**
   * Bind vault tab switching events
   */
  bindVaultTabEvents() {
    const tabs = document.querySelectorAll('.header-tab');
    const mainContent = document.getElementById('main-content');
    const vaultContainer = document.getElementById('vault-container');
    const debugPanel = document.getElementById('debug-panel');
    const appContainer = document.querySelector('.app');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab with aria-current for accessibility
        tabs.forEach(t => {
          t.classList.remove('active');
          t.removeAttribute('aria-current');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-current', 'page');

        const targetTab = tab.dataset.tab;

        if (targetTab === 'generator') {
          // Show generator, hide vault (debug panel state preserved)
          if (mainContent) mainContent.removeAttribute('hidden');
          if (vaultContainer) vaultContainer.setAttribute('hidden', '');
          if (appContainer) appContainer.classList.remove('vault-mode');
        } else if (targetTab === 'vault') {
          // Show vault, hide generator and debug panel
          if (mainContent) mainContent.setAttribute('hidden', '');
          if (vaultContainer) vaultContainer.removeAttribute('hidden');
          if (debugPanel) debugPanel.setAttribute('hidden', '');
          if (appContainer) appContainer.classList.add('vault-mode');
        }
      });
    });

    // Listen for menu events from main process (uses secure preload API)
    if (window.vault?.menu) {
      window.vault.menu.onCreate(() => {
        // Switch to vault tab and trigger create
        document.querySelector('.header-tab[data-tab="vault"]')?.click();
        setTimeout(() => {
          document.getElementById('btn-create-vault')?.click();
        }, 100);
      });

      window.vault.menu.onOpen(() => {
        // Switch to vault tab
        document.querySelector('.header-tab[data-tab="vault"]')?.click();
      });
    }
  }

  async generateInitial() {
    try {
      safeLog('Launching automatic generation...');

      // Simulate click on generate button
      const generateBtn = document.getElementById('btn-generate');
      if (generateBtn) {
        generateBtn.click();
      } else {
        safeLog('Generate button not found for initial generation');
      }

    } catch (error) {
      safeLog(`Initial generation error: ${error.message}`);
    }
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', async () => {
  window.genPwdApp = new GenPwdApp();
  await window.genPwdApp.init();
});

// MEMORY LEAK FIX: Cleanup timers and resources before page unload
window.addEventListener('beforeunload', () => {
  try {
    // Stop analytics batch timer
    if (window.genpwdAnalytics && typeof window.genpwdAnalytics.stop === 'function') {
      window.genpwdAnalytics.stop();
    }
    // Cleanup VaultBridge subscriptions
    VaultBridge.destroy();
    // Cleanup native integration listeners
    cleanupNativeIntegration();
    // Cleanup keyboard shortcuts event listener
    removeKeyboardShortcuts();
    // Clear any active intervals/timeouts
    safeLog('[App] Cleanup on beforeunload');
  } catch (error) {
    // Silently fail - page is unloading anyway
  }
});

// Note: Global error handling is now managed by error-monitoring.js
// which is initialized in init() via initErrorMonitoring()

export { GenPwdApp };
