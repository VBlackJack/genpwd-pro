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
  version: '2.6.0',

  // Vérifier si on est dans Electron
  isElectron: true,

  // Écouter les événements du main process
  onGeneratePassword: (callback) => {
    ipcRenderer.on('generate-password', callback);
  }
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
console.log('Vault API: enabled');
