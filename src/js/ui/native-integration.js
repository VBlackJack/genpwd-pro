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

// src/js/ui/native-integration.js - Phase 4+5 Native Platform Integration
// Connects Electron backend services to the UI

import { safeLog } from '../utils/logger.js';
import { showToast } from '../utils/toast.js';
import { SECURITY_TIMEOUTS } from '../config/ui-constants.js';
import { isValidMode } from '../config/constants.js';
import { i18n } from '../utils/i18n.js';

/**
 * Native Integration Settings
 * Stored in localStorage for persistence
 */
const SETTINGS_KEY = 'genpwd_native_settings';

// AbortController for cleanup
let nativeIntegrationController = null;
// Vault event unsubscribers
let unsubscribeVaultLocked = null;

const DEFAULT_SETTINGS = {
  minimizeToTray: true,
  quickUnlockEnabled: false,
  clipboardAutoClear: true,
  clipboardTTL: SECURITY_TIMEOUTS.CLIPBOARD_TTL_MS
};

/**
 * Get native settings from localStorage
 */
function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    safeLog(`Failed to load native settings: ${error.message}`);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save native settings to localStorage
 */
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    safeLog(`Failed to save native settings: ${error.message}`);
  }
}

/**
 * Initialize Deep Link Handler
 * Handles genpwd:// protocol URLs
 */
function initDeepLinkHandler() {
  if (!window.electronAPI?.onDeepLink) {
    return;
  }

  window.electronAPI.onDeepLink((url) => {
    safeLog(`Deep link received: ${url}`);

    try {
      const parsedUrl = new URL(url);
      const action = parsedUrl.hostname;
      const params = Object.fromEntries(parsedUrl.searchParams);

      switch (action) {
        case 'oauth':
        case 'callback':
          // Handle OAuth callback (from Google Drive, etc.)
          handleOAuthCallback(params);
          break;

        case 'open-vault':
          // Open a specific vault
          if (params.path) {
            handleOpenVault(params.path);
          }
          break;

        case 'generate':
          // Generate password with specific settings
          handleGenerateRequest(params);
          break;

        case 'settings':
          // Open settings panel
          handleOpenSettings(params.section);
          break;

        default:
          safeLog(`Unknown deep link action: ${action}`);
      }
    } catch (error) {
      safeLog(`Failed to parse deep link: ${error.message}`);
    }
  });

  safeLog('Deep link handler initialized');
}

/**
 * Handle OAuth callback from cloud providers
 */
function handleOAuthCallback(params) {
  if (params.code) {
    // Dispatch event for sync service to handle
    window.dispatchEvent(new CustomEvent('oauth:callback', {
      detail: {
        code: params.code,
        state: params.state,
        provider: params.provider || 'google-drive'
      }
    }));

    showToast(i18n.t('toast.authSuccess'), 'success');
  } else if (params.error) {
    showToast(`Authentication error: ${params.error}`, 'error');
  }
}

/**
 * Handle open vault request
 */
function handleOpenVault(vaultPath) {
  // Switch to vault tab
  const vaultTab = document.querySelector('.header-tab[data-tab="vault"]');
  if (vaultTab) {
    vaultTab.click();
  }

  // Trigger vault open dialog with pre-filled path
  if (window.vault?.openFromPath) {
    // Will need password prompt - dispatch event
    window.dispatchEvent(new CustomEvent('vault:open-request', {
      detail: { path: vaultPath }
    }));
  }
}

/**
 * Handle generate password request
 */
function handleGenerateRequest(params) {
  // Switch to generator tab
  const generatorTab = document.querySelector('.header-tab[data-tab="generator"]');
  if (generatorTab) {
    generatorTab.click();
  }

  // Apply settings if provided
  if (params.mode) {
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect && isValidMode(params.mode)) {
      modeSelect.value = params.mode;
      modeSelect.dispatchEvent(new Event('change'));
    }
  }

  // Trigger generation
  setTimeout(() => {
    const generateBtn = document.getElementById('btn-generate');
    if (generateBtn) {
      generateBtn.click();
    }
  }, 100);
}

/**
 * Handle open settings request
 */
function handleOpenSettings(_section) {
  // Show settings modal if exists
  const settingsBtn = document.querySelector('[data-modal="settings"]');
  if (settingsBtn) {
    settingsBtn.click();
  }
}

/**
 * Initialize Clipboard Auto-Clear Integration
 */
function initClipboardIntegration(signal) {
  if (!window.electronAPI?.onClipboardCleared) {
    return;
  }

  // Listen for clipboard cleared events
  window.electronAPI.onClipboardCleared((_data) => {
    showToast(i18n.t('toast.clipboardAutoCleared'), 'info', 2000);
    safeLog('Clipboard auto-cleared');
  });

  // Override default copy behavior for password fields
  overrideCopyBehavior(signal);

  safeLog('Clipboard integration initialized');
}

/**
 * Override copy behavior for secure password copying
 *
 * NOTE: This listens for 'password:copy' custom events. To use this feature,
 * dispatch the event when copying passwords:
 *   window.dispatchEvent(new CustomEvent('password:copy', { detail: { password } }));
 */
function overrideCopyBehavior(signal) {
  const settings = getSettings();

  window.addEventListener('password:copy', async (event) => {
    const password = event.detail?.password;
    if (!password) return;

    try {
      if (settings.clipboardAutoClear && window.electronAPI?.copyToClipboardSecure) {
        // Use secure clipboard with auto-clear
        const result = await window.electronAPI.copyToClipboardSecure(password, settings.clipboardTTL);
        if (result.success) {
          const seconds = Math.round(settings.clipboardTTL / 1000);
          showToast(`Copied (auto-clear in ${seconds}s)`, 'success', 2000);
        } else {
          throw new Error(result.error || 'Secure copy failed');
        }
      } else {
        // Fallback to standard clipboard
        await navigator.clipboard.writeText(password);
        showToast(i18n.t('toast.copiedToClipboard'), 'success', 2000);
      }
    } catch (error) {
      safeLog(`Clipboard copy failed: ${error.message}`);
      showToast(i18n.t('toast.copyFailed'), 'error', 2000);
    }
  }, { signal });
}

/**
 * Initialize Quick Unlock (Secure Storage) Integration
 */
async function initQuickUnlockIntegration() {
  if (!window.electronAPI?.isSecureStorageAvailable) {
    return;
  }

  const isAvailable = await window.electronAPI.isSecureStorageAvailable();
  if (!isAvailable) {
    safeLog('Secure storage not available on this system');
    return;
  }

  // Make quick unlock functions available globally
  window.quickUnlock = {
    isAvailable: true,

    /**
     * Store master password securely
     */
    async store(vaultId, password) {
      const result = await window.electronAPI.encryptSecret(password);
      if (result.success) {
        localStorage.setItem(`quick_unlock_${vaultId}`, result.data);
        return true;
      }
      return false;
    },

    /**
     * Retrieve stored master password
     */
    async retrieve(vaultId) {
      const encrypted = localStorage.getItem(`quick_unlock_${vaultId}`);
      if (!encrypted) return null;

      const result = await window.electronAPI.decryptSecret(encrypted);
      return result.success ? result.data : null;
    },

    /**
     * Check if quick unlock is enabled for vault
     */
    isEnabled(vaultId) {
      return localStorage.getItem(`quick_unlock_${vaultId}`) !== null;
    },

    /**
     * Disable quick unlock for vault
     */
    disable(vaultId) {
      localStorage.removeItem(`quick_unlock_${vaultId}`);
    }
  };

  safeLog('Quick unlock integration initialized');
}

/**
 * Initialize Tray Restore Behavior
 */
function initTrayRestoreBehavior(signal) {
  // When window is restored from tray, refresh UI state
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Dispatch event for components to refresh
      window.dispatchEvent(new CustomEvent('app:restored'));
    }
  }, { signal });

  // Listen for vault lock events from tray menu
  if (window.vault?.on) {
    unsubscribeVaultLocked = window.vault.on('locked', () => {
      showToast(i18n.t('toast.vaultLocked'), 'info');
    });
  }
}

/**
 * Create Native Settings UI Section
 * Returns HTML string for settings panel
 */
export function createNativeSettingsUI() {
  const settings = getSettings();

  return `
    <div class="settings-section native-settings">
      <h3>System Integration</h3>

      <div class="setting-item">
        <label class="toggle-label">
          <input type="checkbox" id="setting-minimize-tray"
                 ${settings.minimizeToTray ? 'checked' : ''}>
          <span>Minimize to system tray</span>
        </label>
        <p class="setting-description">Application stays active in background</p>
      </div>

      <div class="setting-item">
        <label class="toggle-label">
          <input type="checkbox" id="setting-clipboard-autoclear"
                 ${settings.clipboardAutoClear ? 'checked' : ''}>
          <span>Automatic clipboard clearing</span>
        </label>
        <div class="setting-sub">
          <label>Delay:
            <select id="setting-clipboard-ttl">
              <option value="15000" ${settings.clipboardTTL === 15000 ? 'selected' : ''}>15 seconds</option>
              <option value="30000" ${settings.clipboardTTL === 30000 ? 'selected' : ''}>30 seconds</option>
              <option value="60000" ${settings.clipboardTTL === 60000 ? 'selected' : ''}>1 minute</option>
              <option value="120000" ${settings.clipboardTTL === 120000 ? 'selected' : ''}>2 minutes</option>
            </select>
          </label>
        </div>
      </div>

      <div class="setting-item" id="quick-unlock-section" style="display: none;">
        <label class="toggle-label">
          <input type="checkbox" id="setting-quick-unlock"
                 ${settings.quickUnlockEnabled ? 'checked' : ''}>
          <span>Quick unlock (Windows Hello)</span>
        </label>
        <p class="setting-description">Uses biometrics to unlock vault</p>
      </div>
    </div>
  `;
}

/**
 * Bind Native Settings Event Handlers
 */
export function bindNativeSettingsEvents() {
  const settings = getSettings();

  // Minimize to tray toggle
  const trayToggle = document.getElementById('setting-minimize-tray');
  if (trayToggle) {
    trayToggle.addEventListener('change', (e) => {
      settings.minimizeToTray = e.target.checked;
      saveSettings(settings);
    });
  }

  // Clipboard auto-clear toggle
  const clipboardToggle = document.getElementById('setting-clipboard-autoclear');
  if (clipboardToggle) {
    clipboardToggle.addEventListener('change', (e) => {
      settings.clipboardAutoClear = e.target.checked;
      saveSettings(settings);
    });
  }

  // Clipboard TTL select
  const ttlSelect = document.getElementById('setting-clipboard-ttl');
  if (ttlSelect) {
    ttlSelect.addEventListener('change', (e) => {
      settings.clipboardTTL = parseInt(e.target.value, 10);
      saveSettings(settings);
    });
  }

  // Quick unlock toggle
  const quickUnlockToggle = document.getElementById('setting-quick-unlock');
  if (quickUnlockToggle) {
    quickUnlockToggle.addEventListener('change', (e) => {
      settings.quickUnlockEnabled = e.target.checked;
      saveSettings(settings);
    });
  }

  // Show quick unlock section if available
  if (window.quickUnlock?.isAvailable) {
    const section = document.getElementById('quick-unlock-section');
    if (section) {
      section.style.display = '';
    }
  }
}

/**
 * Cleanup native integration listeners
 */
export function cleanupNativeIntegration() {
  if (nativeIntegrationController) {
    nativeIntegrationController.abort();
    nativeIntegrationController = null;
  }
  if (unsubscribeVaultLocked) {
    unsubscribeVaultLocked();
    unsubscribeVaultLocked = null;
  }
  safeLog('Native integration cleaned up');
}

/**
 * Initialize all native integrations
 */
export function initNativeIntegration() {
  if (!window.electronAPI?.isElectron) {
    safeLog('Not running in Electron, skipping native integration');
    return;
  }

  safeLog('Initializing native integration...');

  // Initialize AbortController for cleanup
  cleanupNativeIntegration();
  nativeIntegrationController = new AbortController();
  const signal = nativeIntegrationController.signal;

  // Initialize all handlers
  initDeepLinkHandler();
  initClipboardIntegration(signal);
  // Fire-and-forget with error handling - quick unlock init is optional
  initQuickUnlockIntegration().catch(error => {
    safeLog(`Quick unlock init failed: ${error.message}`);
  });
  initTrayRestoreBehavior(signal);

  // Expose settings functions for settings UI
  window.nativeSettings = {
    get: getSettings,
    save: saveSettings,
    createUI: createNativeSettingsUI,
    bindEvents: bindNativeSettingsEvents
  };

  safeLog('Native integration complete');
}

export { getSettings, saveSettings };
