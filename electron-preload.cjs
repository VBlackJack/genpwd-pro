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

// electron-preload.js - Script de préchargement sécurisé
const { contextBridge, ipcRenderer } = require('electron');

// Exposer une API sécurisée au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Information sur la plateforme
  platform: process.platform,

  // Version de l'application
  version: '2.7.0',

  // Vérifier si on est dans Electron
  isElectron: true,

  // Écouter les événements du main process
  onGeneratePassword: (callback) => {
    ipcRenderer.on('generate-password', callback);
  },

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

  // ==================== WINDOW CONTROL ====================
  // Minimize to system tray
  minimizeToTray: () => ipcRenderer.invoke('window:minimize-to-tray'),

  // Show window from tray
  showWindow: () => ipcRenderer.invoke('window:show'),

  // Check if window is visible
  isWindowVisible: () => ipcRenderer.invoke('window:is-visible'),

  // Quit application completely
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // ==================== DEEP LINKING ====================
  // Listen for deep link events (genpwd:// URLs)
  onDeepLink: (callback) => {
    const handler = (_, url) => callback(url);
    ipcRenderer.on('deep-link', handler);
    return () => ipcRenderer.removeListener('deep-link', handler);
  },

  // ==================== AUTO-TYPE (KeePass Killer Feature) ====================
  // Perform auto-type into other applications
  performAutoType: (sequence, data) =>
    ipcRenderer.invoke('automation:perform-auto-type', { sequence, data }),

  // Get default auto-type sequence
  getDefaultAutoTypeSequence: () => ipcRenderer.invoke('automation:get-default-sequence')
});

// Exposer l'API Vault au renderer process
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

  // ==================== EXTERNAL VAULTS ====================
  showSaveDialog: (defaultName) => ipcRenderer.invoke('vault:showSaveDialog', { defaultName }),
  showOpenDialog: () => ipcRenderer.invoke('vault:showOpenDialog'),
  openFromPath: (filePath, password) => ipcRenderer.invoke('vault:openFromPath', { filePath, password }),
  unregister: (vaultId) => ipcRenderer.invoke('vault:unregister', { vaultId }),

  // ==================== ENTRIES ====================
  entries: {
    getAll: () => ipcRenderer.invoke('vault:entries:getAll'),
    get: (id) => ipcRenderer.invoke('vault:entries:get', { id }),
    getByFolder: (folderId) => ipcRenderer.invoke('vault:entries:getByFolder', { folderId }),
    search: (query) => ipcRenderer.invoke('vault:entries:search', { query }),
    add: (type, title, data) => ipcRenderer.invoke('vault:entries:add', { type, title, data }),
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
    delete: (id) => ipcRenderer.invoke('vault:tags:delete', { id })
  },

  // ==================== IMPORT/EXPORT ====================
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

  // ==================== EVENTS ====================
  on: (event, callback) => {
    const channel = `vault:${event}`;
    const handler = (_, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  once: (event, callback) => {
    const channel = `vault:${event}`;
    ipcRenderer.once(channel, (_, data) => callback(data));
  }
});

// Log pour debug
console.log('GenPwd Pro - Preload script chargé');
console.log('Platform:', process.platform);
console.log('Electron version:', process.versions.electron);
console.log('APIs enabled: Vault, SecureStorage, Clipboard, DeepLink, Tray, AutoType');

// Note: Vault events are handled via the vault.on() API exposed above.
// Components should use window.vault.on('unlocked', callback) instead of
// window.addEventListener('vault:unlocked', callback) due to context isolation.

/**
 * Phase 4-6 Features Summary:
 *
 * 1. System Tray & Background Lifecycle
 *    - App minimizes to tray on close (not quit)
 *    - Tray context menu: Show, Lock Vault, Quit
 *    - Single instance lock
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
 * 6. Auto-Type (Phase 6 - KeePass Killer Feature)
 *    - window.electronAPI.performAutoType(sequence, data)
 *    - Sequence supports: {USERNAME}, {PASSWORD}, {TAB}, {ENTER}, {DELAY N}
 *    - Minimizes app and types into focused window
 *    - Uses PowerShell SendKeys on Windows (no native modules)
 */
