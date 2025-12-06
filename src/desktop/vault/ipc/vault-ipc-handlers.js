/**
 * @fileoverview Vault IPC Handlers
 * Exposes vault operations to the renderer process via IPC
 *
 * Security: All vault operations go through IPC, keeping the encryption
 * key and sensitive data in the main process only.
 *
 * Usage in main process:
 *   import { registerVaultIPC } from './vault/ipc/vault-ipc-handlers.js';
 *   registerVaultIPC(ipcMain);
 */

import { VaultSessionManager } from '../session/vault-session.js';
import { VaultFileManager } from '../storage/vault-file-manager.js';

/** @type {VaultSessionManager} */
let session;

/** @type {VaultFileManager} */
let fileManager;

/**
 * Register all vault IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC main instance
 */
export function registerVaultIPC(ipcMain) {
  session = new VaultSessionManager();
  fileManager = new VaultFileManager();

  // Forward session events to renderer
  session.on('locked', (data) => {
    sendToRenderer('vault:locked', data);
  });

  session.on('unlocked', (data) => {
    sendToRenderer('vault:unlocked', data);
  });

  session.on('changed', (data) => {
    sendToRenderer('vault:changed', data);
  });

  session.on('error', (data) => {
    sendToRenderer('vault:error', data);
  });

  // ==================== VAULT MANAGEMENT ====================

  /**
   * Get current session state
   */
  ipcMain.handle('vault:getState', async () => {
    return session.getState();
  });

  /**
   * List available vaults
   */
  ipcMain.handle('vault:list', async () => {
    return fileManager.listVaults();
  });

  /**
   * Create new vault
   */
  ipcMain.handle('vault:create', async (event, { name, password }) => {
    validateString(name, 'name');
    validateString(password, 'password');

    const vaultId = await session.create(name, password);
    return { vaultId, success: true };
  });

  /**
   * Unlock vault
   */
  ipcMain.handle('vault:unlock', async (event, { vaultId, password }) => {
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');

    await session.unlock(vaultId, password);
    return { success: true };
  });

  /**
   * Lock vault
   */
  ipcMain.handle('vault:lock', async () => {
    await session.lock();
    return { success: true };
  });

  /**
   * Get vault metadata
   */
  ipcMain.handle('vault:getMetadata', async () => {
    return session.getMetadata();
  });

  /**
   * Reset activity timer (call on user interaction)
   */
  ipcMain.handle('vault:resetActivity', async () => {
    session.resetActivity();
    return { success: true };
  });

  // ==================== ENTRIES ====================

  /**
   * Get all entries
   */
  ipcMain.handle('vault:entries:getAll', async () => {
    return session.getEntries();
  });

  /**
   * Get entry by ID
   */
  ipcMain.handle('vault:entries:get', async (event, { id }) => {
    validateString(id, 'id');
    return session.getEntry(id);
  });

  /**
   * Get entries by folder
   */
  ipcMain.handle('vault:entries:getByFolder', async (event, { folderId }) => {
    return session.getEntriesByFolder(folderId);
  });

  /**
   * Search entries
   */
  ipcMain.handle('vault:entries:search', async (event, { query }) => {
    validateString(query, 'query');
    return session.searchEntries(query);
  });

  /**
   * Add entry
   */
  ipcMain.handle('vault:entries:add', async (event, { type, title, data }) => {
    validateString(type, 'type');
    validateString(title, 'title');
    return session.addEntry(type, title, data || {});
  });

  /**
   * Update entry
   */
  ipcMain.handle('vault:entries:update', async (event, { id, updates }) => {
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateEntry(id, updates);
  });

  /**
   * Delete entry
   */
  ipcMain.handle('vault:entries:delete', async (event, { id }) => {
    validateString(id, 'id');
    return session.deleteEntry(id);
  });

  // ==================== FOLDERS ====================

  /**
   * Get all folders
   */
  ipcMain.handle('vault:folders:getAll', async () => {
    return session.getFolders();
  });

  /**
   * Add folder
   */
  ipcMain.handle('vault:folders:add', async (event, { name, parentId }) => {
    validateString(name, 'name');
    return session.addFolder(name, parentId || null);
  });

  /**
   * Update folder
   */
  ipcMain.handle('vault:folders:update', async (event, { id, updates }) => {
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateFolder(id, updates);
  });

  /**
   * Delete folder
   */
  ipcMain.handle('vault:folders:delete', async (event, { id, deleteEntries }) => {
    validateString(id, 'id');
    return session.deleteFolder(id, deleteEntries === true);
  });

  // ==================== TAGS ====================

  /**
   * Get all tags
   */
  ipcMain.handle('vault:tags:getAll', async () => {
    return session.getTags();
  });

  /**
   * Add tag
   */
  ipcMain.handle('vault:tags:add', async (event, { name, color }) => {
    validateString(name, 'name');
    return session.addTag(name, color || '#6366f1');
  });

  /**
   * Delete tag
   */
  ipcMain.handle('vault:tags:delete', async (event, { id }) => {
    validateString(id, 'id');
    return session.deleteTag(id);
  });

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export vault (requires dialog in renderer)
   */
  ipcMain.handle('vault:export', async (event, { vaultId, password, exportPath }) => {
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');
    validateString(exportPath, 'exportPath');

    await fileManager.exportVault(vaultId, password, exportPath);
    return { success: true };
  });

  /**
   * Import vault
   */
  ipcMain.handle('vault:import', async (event, { importPath, password }) => {
    validateString(importPath, 'importPath');
    validateString(password, 'password');

    const { vaultId } = await fileManager.importVault(importPath, password);
    return { vaultId, success: true };
  });

  /**
   * Change vault password
   */
  ipcMain.handle('vault:changePassword', async (event, { vaultId, currentPassword, newPassword }) => {
    validateString(vaultId, 'vaultId');
    validateString(currentPassword, 'currentPassword');
    validateString(newPassword, 'newPassword');

    await fileManager.changePassword(vaultId, currentPassword, newPassword);
    return { success: true };
  });

  /**
   * Delete vault
   */
  ipcMain.handle('vault:delete', async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    // Lock if this vault is open
    if (session.getState().vaultId === vaultId) {
      await session.lock();
    }

    await fileManager.deleteVault(vaultId);
    return { success: true };
  });

  console.log('[Vault] IPC handlers registered');
}

// ==================== HELPERS ====================

/** @type {Electron.BrowserWindow|null} */
let mainWindow = null;

/**
 * Set main window for sending events
 * @param {Electron.BrowserWindow} window
 */
export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Send event to renderer
 * @param {string} channel - Event channel
 * @param {Object} data - Event data
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Validate string parameter
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name
 * @throws {Error}
 */
function validateString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid parameter: ${name} must be a non-empty string`);
  }
}

/**
 * Validate object parameter
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name
 * @throws {Error}
 */
function validateObject(value, name) {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Invalid parameter: ${name} must be an object`);
  }
}

/**
 * Get session for testing
 * @returns {VaultSessionManager}
 */
export function getSession() {
  return session;
}

export default { registerVaultIPC, setMainWindow, getSession };
