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

import { app, dialog, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { VaultSessionManager } from '../session/vault-session.js';
import { VaultFileManager } from '../storage/vault-file-manager.js';
import { WindowsHelloAuth } from '../auth/windows-hello.js';
import { ShareService } from '../services/share-service.js';

/** @type {VaultSessionManager} */
let session;

/** @type {VaultFileManager} */
let fileManager;

/** @type {ShareService} */
let shareService;

// ==================== RATE LIMITING ====================

/**
 * Rate limiter for vault unlock attempts
 * Prevents brute force attacks
 *
 * Security constants match SECURITY_TIMEOUTS in ui-constants.js:
 * - MAX_ATTEMPTS matches MAX_FAILED_ATTEMPTS (5)
 * - LOCKOUT_DURATION matches LOCKOUT_DURATION_MS (5 minutes)
 */
const unlockRateLimiter = {
  /** @type {Map<string, { attempts: number, lockedUntil: number }>} */
  attempts: new Map(),

  /** Max attempts before lockout - matches SECURITY_TIMEOUTS.MAX_FAILED_ATTEMPTS */
  MAX_ATTEMPTS: 5,

  /** Lockout duration in ms - matches SECURITY_TIMEOUTS.LOCKOUT_DURATION_MS */
  LOCKOUT_DURATION: 5 * 60 * 1000,

  /** Window for counting attempts (5 minutes) */
  ATTEMPT_WINDOW: 5 * 60 * 1000,

  /**
   * Check if unlock is allowed and record attempt
   * @param {string} vaultId
   * @returns {{ allowed: boolean, remainingAttempts?: number, lockoutSeconds?: number }}
   */
  checkAndRecord(vaultId) {
    const now = Date.now();
    let record = this.attempts.get(vaultId);

    // Clean up expired lockouts
    if (record && record.lockedUntil && now >= record.lockedUntil) {
      this.attempts.delete(vaultId);
      record = null;
    }

    // Check if currently locked out
    if (record && record.lockedUntil && now < record.lockedUntil) {
      const lockoutSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, lockoutSeconds };
    }

    // Initialize or reset if window expired
    if (!record || (now - record.firstAttempt) > this.ATTEMPT_WINDOW) {
      record = { attempts: 0, firstAttempt: now, lockedUntil: 0 };
    }

    // Increment attempts
    record.attempts++;

    // Check if max attempts exceeded
    if (record.attempts > this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION;
      this.attempts.set(vaultId, record);
      const lockoutSeconds = Math.ceil(this.LOCKOUT_DURATION / 1000);
      return { allowed: false, lockoutSeconds };
    }

    this.attempts.set(vaultId, record);
    return {
      allowed: true,
      remainingAttempts: this.MAX_ATTEMPTS - record.attempts + 1
    };
  },

  /**
   * Clear attempts on successful unlock
   * @param {string} vaultId
   */
  clearAttempts(vaultId) {
    this.attempts.delete(vaultId);
  }
};

// ==================== SAFE HANDLER WRAPPER ====================

/**
 * Wrap an IPC handler with consistent error handling
 * - Validates origin
 * - Logs errors for debugging
 * - Sanitizes error messages to prevent internal detail leakage
 * @param {Function} handler - The handler function
 * @param {string} name - Handler name for logging
 * @returns {Function} Wrapped handler
 */
function safeHandler(handler, name) {
  return async (event, ...args) => {
    try {
      validateOrigin(event);
      return await handler(event, ...args);
    } catch (error) {
      // Log the full error for debugging
      console.error(`[IPC:${name}] Error:`, error.message);

      // Re-throw with sanitized message (no stack trace, no internal paths)
      const safeMessage = error.message || 'An error occurred';
      throw new Error(safeMessage);
    }
  };
}

/**
 * Register all vault IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC main instance
 */
export function registerVaultIPC(ipcMain) {
  session = new VaultSessionManager();
  fileManager = new VaultFileManager();
  shareService = new ShareService(fileManager);

  // Forward sync events to renderer
  fileManager.on('sync:status', (data) => {
    sendToRenderer('vault:sync:status', data);
  });

  // Initialize Cloud Config
  if (safeStorage.isEncryptionAvailable()) {
    (async () => {
      try {
        const configPath = path.join(app.getPath('userData'), 'cloud-config.enc');
        const encrypted = await fs.promises.readFile(configPath);
        const decrypted = safeStorage.decryptString(encrypted);
        const config = JSON.parse(decrypted);
        fileManager.setCloudConfig(config);
        console.log('[Vault] Cloud config loaded on startup');
      } catch (e) {
        // Ignore if file doesn't exist
      }
    })();
  }

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
  ipcMain.handle('vault:getState', safeHandler(async () => {
    return session.getState();
  }, 'getState'));

  /**
   * List available vaults
   */
  ipcMain.handle('vault:list', safeHandler(async () => {
    return fileManager.listVaults();
  }, 'list'));

  /**
   * Create new vault
   */
  ipcMain.handle('vault:create', safeHandler(async (event, { name, password, customPath }) => {
    validateString(name, 'name');
    validateString(password, 'password');

    const vaultId = await session.create(name, password, customPath || null);
    return { vaultId, success: true };
  }, 'create'));

  // ==================== SECURE SHARING (GenPwd Send) ====================

  /**
   * Create a secure share
   */
  ipcMain.handle('vault:share:create', safeHandler(async (event, { secretData, options }) => {
    validateString(secretData, 'secretData');

    // Validate options if provided
    if (options !== undefined && options !== null) {
      validateObject(options, 'options');
      // Validate specific option fields
      if (options.expiryType !== undefined && typeof options.expiryType !== 'string') {
        throw new Error('options.expiryType must be a string');
      }
      if (options.burnAfterReading !== undefined && typeof options.burnAfterReading !== 'boolean') {
        throw new Error('options.burnAfterReading must be a boolean');
      }
    }

    return shareService.createShare(secretData, options || {});
  }, 'share:create'));

  // ==================== EXTERNAL VAULT MANAGEMENT ====================

  /**
   * Show dialog to select vault file location for creating
   */
  ipcMain.handle('vault:showSaveDialog', safeHandler(async (event, { defaultName }) => {
    // Validate defaultName if provided (prevent path traversal)
    if (defaultName !== undefined && defaultName !== null) {
      validateString(defaultName, 'defaultName');
      // Sanitize: only allow alphanumeric, dash, underscore, space
      if (!/^[\w\-\s]+$/.test(defaultName.replace(/\.gpd$/i, ''))) {
        throw new Error('Invalid vault name characters');
      }
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Create vault at...',
      defaultPath: defaultName || 'MyVault.gpd',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpd'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePath };
  }, 'showSaveDialog'));

  /**
   * Show dialog to open existing vault file
   */
  ipcMain.handle('vault:showOpenDialog', safeHandler(async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open vault...',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpd'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  }, 'showOpenDialog'));

  /**
   * Open vault from external path
   */
  ipcMain.handle('vault:openFromPath', safeHandler(async (event, { filePath, password }) => {
    validateString(filePath, 'filePath');
    validateString(password, 'password');

    // Use fileManager to open from path
    const { vaultData, key, vaultId, activeSlot } = await fileManager.openVaultFromPath(filePath, password);

    // Initialize session with the vault
    await session.initWithVault(vaultId, vaultData, key, activeSlot);

    return { vaultId, success: true };
  }, 'openFromPath'));

  /**
   * Remove vault from registry (doesn't delete file)
   */
  ipcMain.handle('vault:unregister', safeHandler(async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    await fileManager.unregisterVault(vaultId);
    return { success: true };
  }, 'unregister'));

  /**
   * Unlock vault (with rate limiting and origin validation)
   */
  ipcMain.handle('vault:unlock', safeHandler(async (event, { vaultId, password }) => {
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');

    // Check rate limit before attempting unlock
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      await session.unlock(vaultId, password);
      // Clear attempts on successful unlock
      unlockRateLimiter.clearAttempts(vaultId);
      return { success: true };
    } catch (error) {
      // SECURITY: Don't leak remaining attempts count to potential attackers
      // Just throw the original error without attempt information
      throw error;
    }
  }, 'unlock'));

  /**
   * Lock vault
   */
  ipcMain.handle('vault:lock', safeHandler(async () => {
    await session.lock();
    return { success: true };
  }, 'lock'));

  /**
   * Get vault metadata
   */
  ipcMain.handle('vault:getMetadata', safeHandler(async () => {
    return session.getMetadata();
  }, 'getMetadata'));

  /**
   * Reset activity timer (call on user interaction)
   */
  ipcMain.handle('vault:resetActivity', safeHandler(async () => {
    session.resetActivity();
    return { success: true };
  }, 'resetActivity'));

  // ==================== ENTRIES ====================

  /**
   * Get all entries
   */
  ipcMain.handle('vault:entries:getAll', safeHandler(async () => {
    return session.getEntries();
  }, 'entries:getAll'));

  /**
   * Get entry by ID
   */
  ipcMain.handle('vault:entries:get', safeHandler(async (event, { id }) => {
    validateString(id, 'id');
    return session.getEntry(id);
  }, 'entries:get'));

  /**
   * Get entries by folder
   */
  ipcMain.handle('vault:entries:getByFolder', safeHandler(async (event, { folderId }) => {
    // Validate folderId: must be null (root), undefined (root), or a non-empty string (UUID)
    if (folderId !== null && folderId !== undefined) {
      validateString(folderId, 'folderId');
    }
    return session.getEntriesByFolder(folderId);
  }, 'entries:getByFolder'));

  /**
   * Search entries
   */
  ipcMain.handle('vault:entries:search', safeHandler(async (event, { query }) => {
    validateString(query, 'query');
    return session.searchEntries(query);
  }, 'entries:search'));

  /**
   * Add entry
   * @param {Object} params - Entry parameters
   * @param {string} params.type - Entry type (login, card, note, etc.)
   * @param {string} params.title - Entry title
   * @param {Object} params.data - Entry data (username, password, etc.)
   * @param {Object} [params.options] - Additional options (folderId, favorite, tags)
   */
  ipcMain.handle('vault:entries:add', safeHandler(async (event, { type, title, data, options = {} }) => {
    validateString(type, 'type');
    validateString(title, 'title');
    // Merge options into data for backward compatibility
    const entryData = {
      ...(data || {}),
      folderId: options.folderId || data?.folderId || null,
      favorite: options.favorite ?? data?.favorite ?? false,
      tagIds: options.tagIds || data?.tagIds || []
    };
    // Deep validation of entry data
    validateEntryData(type, entryData);
    return session.addEntry(type, title, entryData);
  }, 'entries:add'));

  /**
   * Update entry
   */
  ipcMain.handle('vault:entries:update', safeHandler(async (event, { id, updates }) => {
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateEntry(id, updates);
  }, 'entries:update'));

  /**
   * Delete entry
   */
  ipcMain.handle('vault:entries:delete', safeHandler(async (event, { id }) => {
    validateString(id, 'id');
    return session.deleteEntry(id);
  }, 'entries:delete'));

  // ==================== FOLDERS ====================

  /**
   * Get all folders
   */
  ipcMain.handle('vault:folders:getAll', safeHandler(async () => {
    return session.getFolders();
  }, 'folders:getAll'));

  /**
   * Add folder
   */
  ipcMain.handle('vault:folders:add', safeHandler(async (event, { name, parentId }) => {
    validateString(name, 'name');
    // Validate parentId if provided
    if (parentId !== undefined && parentId !== null) {
      validateString(parentId, 'parentId');
    }
    return session.addFolder(name, parentId || null);
  }, 'folders:add'));

  /**
   * Update folder
   */
  ipcMain.handle('vault:folders:update', safeHandler(async (event, { id, updates }) => {
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateFolder(id, updates);
  }, 'folders:update'));

  /**
   * Delete folder
   */
  ipcMain.handle('vault:folders:delete', safeHandler(async (event, { id, deleteEntries }) => {
    validateString(id, 'id');
    return session.deleteFolder(id, deleteEntries === true);
  }, 'folders:delete'));

  // ==================== TAGS ====================

  /**
   * Get all tags
   */
  ipcMain.handle('vault:tags:getAll', safeHandler(async () => {
    return session.getTags();
  }, 'tags:getAll'));

  /**
   * Add tag
   */
  ipcMain.handle('vault:tags:add', safeHandler(async (event, { name, color }) => {
    validateString(name, 'name');
    // Validate color format if provided (hex color)
    if (color !== undefined && color !== null) {
      if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('color must be a valid hex color (e.g., #6366f1)');
      }
    }
    return session.addTag(name, color || '#6366f1');
  }, 'tags:add'));

  /**
   * Update tag
   */
  ipcMain.handle('vault:tags:update', safeHandler(async (event, { id, updates }) => {
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateTag(id, updates);
  }, 'tags:update'));

  /**
   * Delete tag
   */
  ipcMain.handle('vault:tags:delete', safeHandler(async (event, { id }) => {
    validateString(id, 'id');
    return session.deleteTag(id);
  }, 'tags:delete'));

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export vault (requires dialog in renderer) - with rate limiting
   */
  ipcMain.handle('vault:export', safeHandler(async (event, { vaultId, password, exportPath }) => {
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');
    validateString(exportPath, 'exportPath');

    // Check rate limit before attempting export (password verification)
    const rateCheck = unlockRateLimiter.checkAndRecord(`${vaultId}:export`);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      await fileManager.exportVault(vaultId, password, exportPath);
      unlockRateLimiter.clearAttempts(`${vaultId}:export`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }, 'export'));

  /**
   * Import vault - with rate limiting
   */
  ipcMain.handle('vault:import', safeHandler(async (event, { importPath, password }) => {
    validateString(importPath, 'importPath');
    validateString(password, 'password');

    // Check rate limit before attempting import (password verification)
    const rateCheck = unlockRateLimiter.checkAndRecord(`import:${importPath}`);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      const { vaultId } = await fileManager.importVault(importPath, password);
      unlockRateLimiter.clearAttempts(`import:${importPath}`);
      return { vaultId, success: true };
    } catch (error) {
      throw error;
    }
  }, 'import'));

  /**
   * Change vault password (with rate limiting)
   */
  ipcMain.handle('vault:changePassword', safeHandler(async (event, { vaultId, currentPassword, newPassword }) => {
    validateString(vaultId, 'vaultId');
    validateString(currentPassword, 'currentPassword');
    validateString(newPassword, 'newPassword');

    // Check rate limit before attempting password change
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      await fileManager.changePassword(vaultId, currentPassword, newPassword);
      unlockRateLimiter.clearAttempts(vaultId);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }, 'changePassword'));

  /**
   * Delete vault
   */
  ipcMain.handle('vault:delete', safeHandler(async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    // Lock if this vault is open
    if (session.getState().vaultId === vaultId) {
      await session.lock();
    }

    await fileManager.deleteVault(vaultId);
    return { success: true };
  }, 'delete'));

  /**
   * Panic / Nuke Vault
   */
  ipcMain.handle('vault:nuke', safeHandler(async () => {
    await session.nuke();
    return { success: true };
  }, 'nuke'));

  // ==================== WINDOWS HELLO ====================

  /**
   * Check if Windows Hello is available
   */
  ipcMain.handle('vault:hello:isAvailable', safeHandler(async () => {
    return WindowsHelloAuth.isAvailable();
  }, 'hello:isAvailable'));

  /**
   * Check if Windows Hello is enabled for a vault
   * Checks BOTH Windows Credential Manager AND vault file
   */
  ipcMain.handle('vault:hello:isEnabled', safeHandler(async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    // Check if credential exists in Windows Credential Manager
    const hasCredential = await WindowsHelloAuth.isEnabledForVault(vaultId);
    if (!hasCredential) {
      return false;
    }

    // Also check if encrypted key exists in vault file
    const encryptedKey = await fileManager.getVaultHelloKey(vaultId);
    if (!encryptedKey) {
      // Credential exists but vault doesn't have the key - cleanup orphan credential
      console.warn(`[WindowsHello] Orphan credential found for vault ${vaultId}, cleaning up...`);
      await WindowsHelloAuth.deleteCredential(vaultId);
      return false;
    }

    return true;
  }, 'hello:isEnabled'));

  /**
   * Enable Windows Hello for a vault (with rate limiting)
   * Requires master password to derive the vault key
   */
  ipcMain.handle('vault:hello:enable', safeHandler(async (event, { vaultId, password }) => {
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');

    // Check rate limit before attempting (password is validated)
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      // Check Windows Hello availability
      const isAvailable = await WindowsHelloAuth.isAvailable();
      if (!isAvailable) {
        throw new Error('Windows Hello is not available on this system');
      }

      // Request Windows Hello verification
      const verified = await WindowsHelloAuth.requestVerification(
        'GenPwd Pro - Enable Windows Hello'
      );
      if (!verified) {
        throw new Error('Windows Hello verification failed');
      }

      // Unlock vault temporarily to get the encryption key
      const vaultKey = await session.getDerivedKey(vaultId, password);
      if (!vaultKey) {
        throw new Error('Incorrect password');
      }

      // Generate wrapper key and encrypt vault key
      const wrapperKey = WindowsHelloAuth.generateKeyWrapper();
      const encryptedKey = WindowsHelloAuth.encryptVaultKey(vaultKey, wrapperKey);

      // Store wrapper in Windows Credential Manager
      const stored = await WindowsHelloAuth.storeCredential(vaultId, wrapperKey);
      if (!stored) {
        throw new Error('Failed to store Windows Hello credentials');
      }

      // Store encrypted vault key in vault metadata
      await fileManager.setVaultHelloKey(vaultId, encryptedKey);

      // Clear rate limit on success
      unlockRateLimiter.clearAttempts(vaultId);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }, 'hello:enable'));

  /**
   * Disable Windows Hello for a vault
   */
  ipcMain.handle('vault:hello:disable', safeHandler(async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    // Delete credential from Windows Credential Manager
    await WindowsHelloAuth.deleteCredential(vaultId);

    // Remove encrypted key from vault metadata
    await fileManager.removeVaultHelloKey(vaultId);

    console.log(`[WindowsHello] Disabled for vault: ${vaultId}`);
    return { success: true };
  }, 'hello:disable'));

  /**
   * Unlock vault using Windows Hello (with rate limiting)
   */
  ipcMain.handle('vault:hello:unlock', safeHandler(async (event, { vaultId }) => {
    validateString(vaultId, 'vaultId');

    // Check rate limit before attempting unlock (same limiter as password unlock)
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
    }

    try {
      // Get encrypted vault key from vault file FIRST
      const encryptedKey = await fileManager.getVaultHelloKey(vaultId);
      if (!encryptedKey) {
        // Cleanup orphan credential if exists
        await WindowsHelloAuth.deleteCredential(vaultId);
        throw new Error('Windows Hello not configured for this vault. Please re-enable it with your master password.');
      }

      // Check if credential exists in Windows Credential Manager
      const wrapperKey = await WindowsHelloAuth.retrieveCredential(vaultId);
      if (!wrapperKey) {
        throw new Error('Windows Hello credential not found. Please re-enable Windows Hello.');
      }

      // Request Windows Hello verification
      const verified = await WindowsHelloAuth.requestVerification(
        'GenPwd Pro - Unlock Vault'
      );
      if (!verified) {
        throw new Error('Windows Hello verification cancelled');
      }

      // Decrypt vault key
      let vaultKey;
      try {
        vaultKey = WindowsHelloAuth.decryptVaultKey(encryptedKey, wrapperKey);
      } catch (decryptError) {
        console.error('[WindowsHello] Key decryption failed:', decryptError.message);
        throw new Error('Decryption error. Please re-enable Windows Hello.');
      }

      // Unlock vault with decrypted key
      await session.unlockWithKey(vaultId, vaultKey);

      // Clear attempts on successful unlock
      unlockRateLimiter.clearAttempts(vaultId);
      return { success: true };
    } catch (error) {
      // Re-throw without leaking attempt count
      throw error;
    }
  }, 'hello:unlock'));

  // ==================== CLOUD SYNC CONFIGURATION ====================

  /**
   * Save cloud configuration securely
   */
  ipcMain.handle('vault:saveCloudConfig', safeHandler(async (event, config) => {
    validateObject(config, 'config');

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('System encryption is not available');
    }

    try {
      const jsonStr = JSON.stringify(config);
      const encrypted = safeStorage.encryptString(jsonStr);
      const configPath = path.join(app.getPath('userData'), 'cloud-config.enc');

      await fs.promises.writeFile(configPath, encrypted);

      // Update active file manager config
      fileManager.setCloudConfig(config);

      return { success: true };
    } catch (error) {
      console.error('[Vault] Error saving cloud config:', error);
      throw new Error('Failed to save cloud configuration');
    }
  }, 'saveCloudConfig'));

  /**
   * Get cloud configuration securely
   */
  ipcMain.handle('vault:getCloudConfig', safeHandler(async () => {
    if (!safeStorage.isEncryptionAvailable()) {
      return { provider: 'none' };
    }

    try {
      const configPath = path.join(app.getPath('userData'), 'cloud-config.enc');
      const encrypted = await fs.promises.readFile(configPath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Vault] Error loading cloud config:', error);
      }
      return { provider: 'none' };
    }
  }, 'getCloudConfig'));

  // ==================== DURESS MODE ====================

  /**
   * Setup Duress Mode (Enable Plausible Deniability migration)
   */
  ipcMain.handle('vault:duress:setup', safeHandler(async (event, { masterPassword, duressPassword, populateDecoy }) => {
    validateString(masterPassword, 'masterPassword');
    validateString(duressPassword, 'duressPassword');
    // Validate populateDecoy is boolean
    if (typeof populateDecoy !== 'boolean') {
      throw new Error('populateDecoy must be a boolean');
    }

    // Ensure session is unlocked
    const state = session.getState();
    if (!state.vaultId || state.status !== 'unlocked') {
      throw new Error('Vault must be unlocked to enable Duress Mode');
    }

    // Must pass a new method in FileManager or Session to perform the migration
    // We'll call session.enableDuressMode which will orchestrate with File Manager
    await session.enableDuressMode(masterPassword, duressPassword, populateDecoy);

    return { success: true };
  }, 'duress:setup'));

  console.log('[Vault] IPC handlers registered');
}

// ==================== HELPERS ====================

/** @type {Electron.BrowserWindow|null} */
let mainWindow = null;

/** Trusted origins for IPC validation */
const TRUSTED_ORIGINS = [
  'file://',      // Local file (app)
  'app://',       // Electron app protocol
  'localhost'     // Dev server
];

/**
 * Validate IPC event origin
 * Prevents unauthorized access from external windows
 * @param {Electron.IpcMainInvokeEvent} event - IPC event
 * @throws {Error} If origin is not trusted
 */
function validateOrigin(event) {
  // SECURITY: Always validate origin - if senderFrame is undefined,
  // fall back to event.sender.getURL() which should always be available
  let url;
  if (event.senderFrame) {
    url = event.senderFrame.url;
  } else if (event.sender) {
    url = event.sender.getURL();
  } else {
    console.error('[Vault] IPC event has no sender information');
    throw new Error('Unauthorized access');
  }

  // Check against trusted origins
  const isTrusted = TRUSTED_ORIGINS.some(origin => url.startsWith(origin));

  if (!isTrusted) {
    console.error(`[Vault] Untrusted IPC origin: ${url}`);
    throw new Error('Unauthorized access');
  }
}

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
 * Valid entry types
 */
const VALID_ENTRY_TYPES = ['login', 'card', 'note', 'identity'];

/**
 * Allowed fields per entry type (whitelist)
 */
const ALLOWED_ENTRY_FIELDS = {
  login: ['username', 'password', 'url', 'totp', 'notes', 'folderId', 'favorite', 'tagIds'],
  card: ['holder', 'number', 'expiry', 'cvv', 'notes', 'folderId', 'favorite', 'tagIds'],
  note: ['content', 'notes', 'folderId', 'favorite', 'tagIds'],
  identity: ['fullName', 'email', 'phone', 'address', 'notes', 'folderId', 'favorite', 'tagIds']
};

/**
 * Validate entry data structure
 * @param {string} type - Entry type
 * @param {Object} data - Entry data
 * @throws {Error}
 */
function validateEntryData(type, data) {
  // Validate type
  if (!VALID_ENTRY_TYPES.includes(type)) {
    throw new Error(`Invalid entry type: ${type}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
  }

  // Validate data is object
  if (typeof data !== 'object' || data === null) {
    throw new Error('Entry data must be an object');
  }

  // Whitelist allowed fields
  const allowedFields = ALLOWED_ENTRY_FIELDS[type];
  const dataFields = Object.keys(data);

  for (const field of dataFields) {
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field "${field}" for entry type "${type}"`);
    }
  }

  // Validate field types
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (key === 'tagIds') {
      if (!Array.isArray(value)) {
        throw new Error('tagIds must be an array');
      }
      if (!value.every(id => typeof id === 'string')) {
        throw new Error('tagIds must contain only strings');
      }
    } else if (key === 'favorite') {
      if (typeof value !== 'boolean') {
        throw new Error('favorite must be a boolean');
      }
    } else if (typeof value !== 'string') {
      throw new Error(`Field "${key}" must be a string`);
    }
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
