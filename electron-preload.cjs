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

// electron-preload.js - Secure preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // Application version
  version: '3.0.0',

  // Check if running in Electron
  isElectron: true,

  // ==================== FILE SYSTEM ====================
  // Read binary file (for KDBX import)
  readBinaryFile: (filePath) => ipcRenderer.invoke('fs:read-binary', filePath),

  // Show open file dialog
  showOpenFileDialog: (options) => ipcRenderer.invoke('fs:show-open-dialog', options),

  // ==================== SECURE STORAGE (Quick Unlock) ====================
  // Check if secure storage is available (DPAPI on Windows, Keychain on macOS)
  isSecureStorageAvailable: () => ipcRenderer.invoke('auth:is-available'),

  // Encrypt secret using OS-level encryption
  encryptSecret: (text) => ipcRenderer.invoke('auth:encrypt-secret', text),

  // Decrypt secret using OS-level encryption
  decryptSecret: (encryptedBase64) => ipcRenderer.invoke('auth:decrypt-secret', encryptedBase64),

  // ==================== SMART CLIPBOARD ====================
  // Copy to clipboard with auto-clear (KeePass-style)
  copyToClipboardSecure: (text, ttlMs = 30000) =>
    ipcRenderer.invoke('clipboard:copy-secure', text, ttlMs),

  // Clear clipboard immediately
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),

  // Check if clipboard has active auto-clear
  getClipboardTTL: () => ipcRenderer.invoke('clipboard:get-ttl'),

  // Listen for clipboard cleared event
  onClipboardCleared: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('clipboard:cleared', handler);
    return () => ipcRenderer.removeListener('clipboard:cleared', handler);
  },

  // Listen for clipboard countdown started (for showing progress indicator)
  onClipboardCountdownStarted: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('clipboard:countdown-started', handler);
    return () => ipcRenderer.removeListener('clipboard:countdown-started', handler);
  },

  // ==================== WINDOW CONTROL ====================
  // Minimize to system tray
  minimizeToTray: () => ipcRenderer.invoke('window:minimize-to-tray'),

  // Show window from tray
  showWindow: () => ipcRenderer.invoke('window:show'),

  // Check if window is visible
  isWindowVisible: () => ipcRenderer.invoke('window:is-visible'),

  // Quit application completely
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // ==================== AUTO-START ====================
  // Get auto-start status
  getAutoStart: () => ipcRenderer.invoke('app:get-autostart'),

  // Set auto-start status
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-autostart', enabled),

  // ==================== WINDOWS SYSTEM INTEGRATION ====================
  // Get Windows accent color
  getAccentColor: () => ipcRenderer.invoke('app:get-accent-color'),

  // Get system info (admin status, platform details)
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),

  // Listen for system accent color changes
  onAccentColorChanged: (callback) => {
    const handler = (_, colors) => callback(colors);
    ipcRenderer.on('system:accent-color', handler);
    return () => ipcRenderer.removeListener('system:accent-color', handler);
  },

  // ==================== COMPACT/OVERLAY MODE ====================
  // Toggle compact mode (floating widget)
  toggleCompactMode: () => ipcRenderer.invoke('window:toggle-compact'),

  // Check if in compact mode
  isCompactMode: () => ipcRenderer.invoke('window:is-compact'),

  // Listen for compact mode changes
  onCompactModeChanged: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('window:compact-mode-changed', handler);
    return () => ipcRenderer.removeListener('window:compact-mode-changed', handler);
  },

  // ==================== DEEP LINKING ====================
  // Listen for deep link events (genpwd:// URLs)
  onDeepLink: (callback) => {
    const handler = (_, url) => callback(url);
    ipcRenderer.on('deep-link', handler);
    return () => ipcRenderer.removeListener('deep-link', handler);
  },

  // Listen for vault file open events (file association)
  onVaultFileOpen: (callback) => {
    const handler = (_, filePath) => callback(filePath);
    ipcRenderer.on('vault:open-file', handler);
    return () => ipcRenderer.removeListener('vault:open-file', handler);
  },

  // ==================== AUTO-TYPE (KeePass Killer Feature) ====================
  // Perform auto-type into other applications
  performAutoType: (sequence, data) =>
    ipcRenderer.invoke('automation:perform-auto-type', { sequence, data }),

  // Get default auto-type sequence
  getDefaultAutoTypeSequence: () => ipcRenderer.invoke('automation:get-default-sequence'),

  // Listen for auto-type blocked events (security)
  onAutoTypeBlocked: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('autotype:blocked', handler);
    return () => ipcRenderer.removeListener('autotype:blocked', handler);
  },

  // Listen for global auto-type trigger
  onGlobalAutoType: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('automation:global-autotype', handler);
    return () => ipcRenderer.removeListener('automation:global-autotype', handler);
  },

  // ==================== VISUAL PROTECTION (Blur/Focus) ====================
  // Listen for window blur event (hide sensitive data)
  onWindowBlur: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('window:blur', handler);
    return () => ipcRenderer.removeListener('window:blur', handler);
  },

  // Listen for window focus event (restore sensitive data)
  onWindowFocus: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('window:focus', handler);
    return () => ipcRenderer.removeListener('window:focus', handler);
  }
});

// Expose Vault API to renderer process
contextBridge.exposeInMainWorld('vault', {
  // ==================== STATE ====================
  getState: () => ipcRenderer.invoke('vault:getState'),
  list: () => ipcRenderer.invoke('vault:list'),
  create: (name, password, customPath = null) => ipcRenderer.invoke('vault:create', { name, password, customPath }),
  unlock: (vaultId, password) => ipcRenderer.invoke('vault:unlock', { vaultId, password }),
  lock: () => ipcRenderer.invoke('vault:lock'),
  getMetadata: () => ipcRenderer.invoke('vault:getMetadata'),
  resetActivity: () => ipcRenderer.invoke('vault:resetActivity'),
  changePassword: (vaultId, currentPassword, newPassword) =>
    ipcRenderer.invoke('vault:changePassword', { vaultId, currentPassword, newPassword }),
  delete: (vaultId) => ipcRenderer.invoke('vault:delete', { vaultId }),

  // ==================== PANIC / NUKE ====================
  nuke: () => ipcRenderer.invoke('vault:nuke'),

  // ==================== EXTERNAL VAULTS ====================
  showSaveDialog: (defaultName) => ipcRenderer.invoke('vault:showSaveDialog', { defaultName }),
  showOpenDialog: () => ipcRenderer.invoke('vault:showOpenDialog'),
  openFromPath: (filePath, password) => ipcRenderer.invoke('vault:openFromPath', { filePath, password }),
  unregister: (vaultId) => ipcRenderer.invoke('vault:unregister', { vaultId }),

  // ==================== CLOUD SYNC ====================
  cloud: {
    saveConfig: (config) => ipcRenderer.invoke('vault:saveCloudConfig', config),
    getConfig: () => ipcRenderer.invoke('vault:getCloudConfig')
  },

  // ==================== DURESS MODE ====================
  duress: {
    setup: (options) => ipcRenderer.invoke('vault:duress:setup', options)
  },

  // ==================== SECURE SHARING ====================
  share: {
    create: (secretData, options) => ipcRenderer.invoke('vault:share:create', { secretData, options })
  },

  // ==================== ENTRIES ====================
  entries: {
    getAll: () => ipcRenderer.invoke('vault:entries:getAll'),
    get: (id) => ipcRenderer.invoke('vault:entries:get', { id }),
    getByFolder: (folderId) => ipcRenderer.invoke('vault:entries:getByFolder', { folderId }),
    search: (query) => ipcRenderer.invoke('vault:entries:search', { query }),
    add: (type, title, data, options = {}) => ipcRenderer.invoke('vault:entries:add', { type, title, data, options }),
    update: (id, updates) => ipcRenderer.invoke('vault:entries:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('vault:entries:delete', { id })
  },

  // ==================== FOLDERS ====================
  folders: {
    getAll: () => ipcRenderer.invoke('vault:folders:getAll'),
    add: (name, parentId) => ipcRenderer.invoke('vault:folders:add', { name, parentId }),
    update: (id, updates) => ipcRenderer.invoke('vault:folders:update', { id, updates }),
    delete: (id, deleteEntries) => ipcRenderer.invoke('vault:folders:delete', { id, deleteEntries })
  },

  // ==================== TAGS ====================
  tags: {
    getAll: () => ipcRenderer.invoke('vault:tags:getAll'),
    add: (name, color) => ipcRenderer.invoke('vault:tags:add', { name, color }),
    update: (id, updates) => ipcRenderer.invoke('vault:tags:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('vault:tags:delete', { id })
  },

  // ==================== IMPORT/EXPORT ====================
  // NOTE: These methods are available but not yet used in the UI
  export: (vaultId, password, exportPath) =>
    ipcRenderer.invoke('vault:export', { vaultId, password, exportPath }),
  import: (importPath, password) =>
    ipcRenderer.invoke('vault:import', { importPath, password }),

  // ==================== WINDOWS HELLO ====================
  hello: {
    isAvailable: () => ipcRenderer.invoke('vault:hello:isAvailable'),
    isEnabled: (vaultId) => ipcRenderer.invoke('vault:hello:isEnabled', { vaultId }),
    enable: (vaultId, password) => ipcRenderer.invoke('vault:hello:enable', { vaultId, password }),
    disable: (vaultId) => ipcRenderer.invoke('vault:hello:disable', { vaultId }),
    unlock: (vaultId) => ipcRenderer.invoke('vault:hello:unlock', { vaultId })
  },

  // ==================== LOW-LEVEL I/O ====================
  io: {
    /**
     * Save data to file (atomic write with backup)
     * @param {Object|string|Buffer} data - Data to save
     * @param {string} filePath - Destination path
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
     */
    save: (data, filePath) => ipcRenderer.invoke('vaultIO:save', { data, filePath }),

    /**
     * Load data from file
     * @param {string} filePath - Source path
     * @returns {Promise<{success: boolean, data?: any, format?: 'json'|'binary', error?: string}>}
     */
    load: (filePath) => ipcRenderer.invoke('vaultIO:load', { filePath }),

    /**
     * Open file dialog to select vault file
     * @returns {Promise<{success: boolean, canceled?: boolean, filePath?: string, fileName?: string}>}
     */
    selectFile: () => ipcRenderer.invoke('vaultIO:selectFile'),

    /**
     * Save dialog to choose vault save location
     * @param {string} [defaultName='vault.gpdb'] - Default filename
     * @returns {Promise<{success: boolean, canceled?: boolean, filePath?: string, fileName?: string}>}
     */
    selectSaveLocation: (defaultName) => ipcRenderer.invoke('vaultIO:selectSaveLocation', { defaultName }),

    /**
     * Check if file exists
     * @param {string} filePath - Path to check
     * @returns {Promise<{success: boolean, exists?: boolean}>}
     */
    exists: (filePath) => ipcRenderer.invoke('vaultIO:exists', { filePath }),

    /**
     * Get file info (size, dates)
     * @param {string} filePath - Path to check
     * @returns {Promise<{success: boolean, info?: {size: number, createdAt: string, modifiedAt: string}}>}
     */
    getFileInfo: (filePath) => ipcRenderer.invoke('vaultIO:getFileInfo', { filePath })
  },

  // ==================== MENU EVENTS ====================
  menu: {
    onCreate: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('vault:menu:create', handler);
      return () => ipcRenderer.removeListener('vault:menu:create', handler);
    },
    onOpen: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('vault:menu:open', handler);
      return () => ipcRenderer.removeListener('vault:menu:open', handler);
    }
  },

  // ==================== EVENTS ====================
  on: (event, callback) => {
    const channel = `vault:${event}`;
    const handler = (_, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  once: (event, callback) => {
    const channel = `vault:${event}`;
    const handler = (_, data) => callback(data);
    ipcRenderer.once(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});

// Debug log (development only - no sensitive data exposed)
if (process.env.NODE_ENV === 'development') {
  console.log('GenPwd Pro - Preload script loaded');
  console.log('Platform:', process.platform);
  console.log('Electron version:', process.versions.electron);
  console.log('APIs enabled: Vault, SecureStorage, Clipboard, DeepLink, Tray, AutoType, CompactMode, GlobalHotkey');
}

// Note: Vault events are handled via the vault.on() API exposed above.
// Components should use window.vault.on('unlocked', callback) instead of
// window.addEventListener('vault:unlocked', callback) due to context isolation.

/**
 * Desktop Integration Features Summary:
 *
 * 1. System Tray & Background Lifecycle
 *    - App minimizes to tray on close (not quit)
 *    - Tray context menu: Show, Generate Password, Lock Vault, Quit
 *    - Single instance lock
 *    - Quick password generation from tray (copied to clipboard with auto-clear)
 *
 * 2. Secure Storage (Quick Unlock)
 *    - window.electronAPI.isSecureStorageAvailable()
 *    - window.electronAPI.encryptSecret(text)
 *    - window.electronAPI.decryptSecret(base64)
 *    Uses Windows DPAPI / macOS Keychain
 *
 * 3. Smart Clipboard
 *    - window.electronAPI.copyToClipboardSecure(text, ttlMs)
 *    - Auto-clears after timeout (default 30s)
 *    - window.electronAPI.onClipboardCleared(callback)
 *
 * 4. Deep Linking
 *    - Handles genpwd:// protocol URLs
 *    - window.electronAPI.onDeepLink(callback)
 *
 * 5. Window Control
 *    - window.electronAPI.minimizeToTray()
 *    - window.electronAPI.showWindow()
 *    - window.electronAPI.quitApp()
 *
 * 6. Auto-Type (KeePass Killer Feature)
 *    - window.electronAPI.performAutoType(sequence, data)
 *    - Sequence supports: {USERNAME}, {PASSWORD}, {TAB}, {ENTER}, {DELAY N}
 *    - Minimizes app and types into focused window
 *    - Uses PowerShell SendKeys on Windows (no native modules)
 *
 * 7. Compact/Overlay Mode (Floating Widget)
 *    - window.electronAPI.toggleCompactMode()
 *    - window.electronAPI.isCompactMode()
 *    - window.electronAPI.onCompactModeChanged(callback)
 *    - 380x640 floating window, always on top
 *    - Hides sidebar, shows only search + list
 *
 * 8. Global Hotkey (Boss Key)
 *    - Ctrl+Shift+P (or Cmd+Shift+P on macOS)
 *    - Toggles window visibility from anywhere
 */
