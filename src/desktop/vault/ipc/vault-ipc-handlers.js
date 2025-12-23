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
 */
const unlockRateLimiter = {
  /** @type {Map<string, { attempts: number, lockedUntil: number }>} */
  attempts: new Map(),

  /** Max attempts before lockout */
  MAX_ATTEMPTS: 5,

  /** Lockout duration in ms (5 minutes) */
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
  ipcMain.handle('vault:getState', async (event) => {
    validateOrigin(event);
    return session.getState();
  });

  /**
   * List available vaults
   */
  ipcMain.handle('vault:list', async (event) => {
    validateOrigin(event);
    return fileManager.listVaults();
  });

  /**
   * Create new vault
   */
  ipcMain.handle('vault:create', async (event, { name, password, customPath }) => {
    validateOrigin(event);
    validateString(name, 'name');
    validateString(password, 'password');

    const vaultId = await session.create(name, password, customPath || null);
    return { vaultId, success: true };
  });

  // ==================== SECURE SHARING (GenPwd Send) ====================

  /**
   * Create a secure share
   */
  ipcMain.handle('vault:share:create', async (event, { secretData, options }) => {
    validateOrigin(event);
    validateString(secretData, 'secretData');

    return shareService.createShare(secretData, options);
  });

  // ==================== EXTERNAL VAULT MANAGEMENT ====================

  /**
   * Show dialog to select vault file location for creating
   */
  ipcMain.handle('vault:showSaveDialog', async (event, { defaultName }) => {
    validateOrigin(event);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Créer un coffre à...',
      defaultPath: defaultName || 'MonCoffre.gpd',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpd'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePath };
  });

  /**
   * Show dialog to open existing vault file
   */
  ipcMain.handle('vault:showOpenDialog', async (event) => {
    validateOrigin(event);

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Ouvrir un coffre...',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpd'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  });

  /**
   * Open vault from external path
   */
  ipcMain.handle('vault:openFromPath', async (event, { filePath, password }) => {
    validateOrigin(event);
    validateString(filePath, 'filePath');
    validateString(password, 'password');

    // Use fileManager to open from path
    const { vaultData, key, vaultId } = await fileManager.openVaultFromPath(filePath, password);

    // Initialize session with the vault
    await session.initWithVault(vaultId, vaultData, key);

    return { vaultId, success: true };
  });

  /**
   * Remove vault from registry (doesn't delete file)
   */
  ipcMain.handle('vault:unregister', async (event, { vaultId }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');

    await fileManager.unregisterVault(vaultId);
    return { success: true };
  });

  /**
   * Unlock vault (with rate limiting and origin validation)
   */
  ipcMain.handle('vault:unlock', async (event, { vaultId, password }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');

    // Check rate limit before attempting unlock
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(`Trop de tentatives. Réessayez dans ${minutes} minute(s).`);
    }

    try {
      await session.unlock(vaultId, password);
      // Clear attempts on successful unlock
      unlockRateLimiter.clearAttempts(vaultId);
      return { success: true };
    } catch (error) {
      // Add remaining attempts info to error
      const remaining = rateCheck.remainingAttempts - 1;
      if (remaining > 0) {
        error.message = `${error.message} (${remaining} essai(s) restant(s))`;
      }
      throw error;
    }
  });

  /**
   * Lock vault
   */
  ipcMain.handle('vault:lock', async (event) => {
    validateOrigin(event);
    await session.lock();
    return { success: true };
  });

  /**
   * Get vault metadata
   */
  ipcMain.handle('vault:getMetadata', async (event) => {
    validateOrigin(event);
    return session.getMetadata();
  });

  /**
   * Reset activity timer (call on user interaction)
   */
  ipcMain.handle('vault:resetActivity', async (event) => {
    validateOrigin(event);
    session.resetActivity();
    return { success: true };
  });

  // ==================== ENTRIES ====================

  /**
   * Get all entries
   */
  ipcMain.handle('vault:entries:getAll', async (event) => {
    validateOrigin(event);
    return session.getEntries();
  });

  /**
   * Get entry by ID
   */
  ipcMain.handle('vault:entries:get', async (event, { id }) => {
    validateOrigin(event);
    validateString(id, 'id');
    return session.getEntry(id);
  });

  /**
   * Get entries by folder
   */
  ipcMain.handle('vault:entries:getByFolder', async (event, { folderId }) => {
    validateOrigin(event);
    return session.getEntriesByFolder(folderId);
  });

  /**
   * Search entries
   */
  ipcMain.handle('vault:entries:search', async (event, { query }) => {
    validateOrigin(event);
    validateString(query, 'query');
    return session.searchEntries(query);
  });

  /**
   * Add entry
   * @param {Object} params - Entry parameters
   * @param {string} params.type - Entry type (login, card, note, etc.)
   * @param {string} params.title - Entry title
   * @param {Object} params.data - Entry data (username, password, etc.)
   * @param {Object} [params.options] - Additional options (folderId, favorite, tags)
   */
  ipcMain.handle('vault:entries:add', async (event, { type, title, data, options = {} }) => {
    validateOrigin(event);
    validateString(type, 'type');
    validateString(title, 'title');
    // Merge options into data for backward compatibility
    const entryData = {
      ...(data || {}),
      folderId: options.folderId || data?.folderId || null,
      favorite: options.favorite ?? data?.favorite ?? false,
      tagIds: options.tagIds || data?.tagIds || []
    };
    return session.addEntry(type, title, entryData);
  });

  /**
   * Update entry
   */
  ipcMain.handle('vault:entries:update', async (event, { id, updates }) => {
    validateOrigin(event);
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateEntry(id, updates);
  });

  /**
   * Delete entry
   */
  ipcMain.handle('vault:entries:delete', async (event, { id }) => {
    validateOrigin(event);
    validateString(id, 'id');
    return session.deleteEntry(id);
  });

  // ==================== FOLDERS ====================

  /**
   * Get all folders
   */
  ipcMain.handle('vault:folders:getAll', async (event) => {
    validateOrigin(event);
    return session.getFolders();
  });

  /**
   * Add folder
   */
  ipcMain.handle('vault:folders:add', async (event, { name, parentId }) => {
    validateOrigin(event);
    validateString(name, 'name');
    return session.addFolder(name, parentId || null);
  });

  /**
   * Update folder
   */
  ipcMain.handle('vault:folders:update', async (event, { id, updates }) => {
    validateOrigin(event);
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateFolder(id, updates);
  });

  /**
   * Delete folder
   */
  ipcMain.handle('vault:folders:delete', async (event, { id, deleteEntries }) => {
    validateOrigin(event);
    validateString(id, 'id');
    return session.deleteFolder(id, deleteEntries === true);
  });

  // ==================== TAGS ====================

  /**
   * Get all tags
   */
  ipcMain.handle('vault:tags:getAll', async (event) => {
    validateOrigin(event);
    return session.getTags();
  });

  /**
   * Add tag
   */
  ipcMain.handle('vault:tags:add', async (event, { name, color }) => {
    validateOrigin(event);
    validateString(name, 'name');
    return session.addTag(name, color || '#6366f1');
  });

  /**
   * Update tag
   */
  ipcMain.handle('vault:tags:update', async (event, { id, updates }) => {
    validateOrigin(event);
    validateString(id, 'id');
    validateObject(updates, 'updates');
    return session.updateTag(id, updates);
  });

  /**
   * Delete tag
   */
  ipcMain.handle('vault:tags:delete', async (event, { id }) => {
    validateOrigin(event);
    validateString(id, 'id');
    return session.deleteTag(id);
  });

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export vault (requires dialog in renderer)
   */
  ipcMain.handle('vault:export', async (event, { vaultId, password, exportPath }) => {
    validateOrigin(event);
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
    validateOrigin(event);
    validateString(importPath, 'importPath');
    validateString(password, 'password');

    const { vaultId } = await fileManager.importVault(importPath, password);
    return { vaultId, success: true };
  });

  /**
   * Change vault password
   */
  ipcMain.handle('vault:changePassword', async (event, { vaultId, currentPassword, newPassword }) => {
    validateOrigin(event);
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
    validateOrigin(event);
    validateString(vaultId, 'vaultId');

    // Lock if this vault is open
    if (session.getState().vaultId === vaultId) {
      await session.lock();
    }

    await fileManager.deleteVault(vaultId);
    return { success: true };
  });

  /**
   * Panic / Nuke Vault
   */
  ipcMain.handle('vault:nuke', async (event) => {
    validateOrigin(event);
    await session.nuke();
    return { success: true };
  });

  // ==================== WINDOWS HELLO ====================

  /**
   * Check if Windows Hello is available
   */
  ipcMain.handle('vault:hello:isAvailable', async (event) => {
    validateOrigin(event);
    return WindowsHelloAuth.isAvailable();
  });

  /**
   * Check if Windows Hello is enabled for a vault
   */
  ipcMain.handle('vault:hello:isEnabled', async (event, { vaultId }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');
    return WindowsHelloAuth.isEnabledForVault(vaultId);
  });

  /**
   * Enable Windows Hello for a vault
   * Requires master password to derive the vault key
   */
  ipcMain.handle('vault:hello:enable', async (event, { vaultId, password }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');
    validateString(password, 'password');

    // Check Windows Hello availability
    const isAvailable = await WindowsHelloAuth.isAvailable();
    if (!isAvailable) {
      throw new Error('Windows Hello n\'est pas disponible sur ce système');
    }

    // Request Windows Hello verification
    const verified = await WindowsHelloAuth.requestVerification(
      'GenPwd Pro - Activer Windows Hello'
    );
    if (!verified) {
      throw new Error('Vérification Windows Hello échouée');
    }

    // Unlock vault temporarily to get the encryption key
    const vaultKey = await session.getDerivedKey(vaultId, password);
    if (!vaultKey) {
      throw new Error('Mot de passe incorrect');
    }

    // Generate wrapper key and encrypt vault key
    const wrapperKey = WindowsHelloAuth.generateKeyWrapper();
    const encryptedKey = WindowsHelloAuth.encryptVaultKey(vaultKey, wrapperKey);

    // Store wrapper in Windows Credential Manager
    const stored = await WindowsHelloAuth.storeCredential(vaultId, wrapperKey);
    if (!stored) {
      throw new Error('Impossible de stocker les credentials');
    }

    // Store encrypted vault key in vault metadata
    await fileManager.setVaultHelloKey(vaultId, encryptedKey);

    console.log(`[WindowsHello] Enabled for vault: ${vaultId}`);
    return { success: true };
  });

  /**
   * Disable Windows Hello for a vault
   */
  ipcMain.handle('vault:hello:disable', async (event, { vaultId }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');

    // Delete credential from Windows Credential Manager
    await WindowsHelloAuth.deleteCredential(vaultId);

    // Remove encrypted key from vault metadata
    await fileManager.removeVaultHelloKey(vaultId);

    console.log(`[WindowsHello] Disabled for vault: ${vaultId}`);
    return { success: true };
  });

  /**
   * Unlock vault using Windows Hello
   */
  ipcMain.handle('vault:hello:unlock', async (event, { vaultId }) => {
    validateOrigin(event);
    validateString(vaultId, 'vaultId');

    // Check if Windows Hello is enabled for this vault
    const isEnabled = await WindowsHelloAuth.isEnabledForVault(vaultId);
    if (!isEnabled) {
      throw new Error('Windows Hello n\'est pas activé pour ce coffre');
    }

    // Request Windows Hello verification
    const verified = await WindowsHelloAuth.requestVerification(
      'GenPwd Pro - Déverrouiller le coffre'
    );
    if (!verified) {
      throw new Error('Vérification Windows Hello échouée');
    }

    // Retrieve wrapper key from Credential Manager
    const wrapperKey = await WindowsHelloAuth.retrieveCredential(vaultId);
    if (!wrapperKey) {
      throw new Error('Credential Windows Hello introuvable');
    }

    // Get encrypted vault key from metadata
    const encryptedKey = await fileManager.getVaultHelloKey(vaultId);
    if (!encryptedKey) {
      throw new Error('Clé chiffrée introuvable');
    }

    // Decrypt vault key
    const vaultKey = WindowsHelloAuth.decryptVaultKey(encryptedKey, wrapperKey);

    // Unlock vault with decrypted key
    await session.unlockWithKey(vaultId, vaultKey);

    console.log(`[WindowsHello] Vault unlocked: ${vaultId}`);
    return { success: true };
  });

  // ==================== CLOUD SYNC CONFIGURATION ====================

  /**
   * Save cloud configuration securely
   */
  ipcMain.handle('vault:saveCloudConfig', async (event, config) => {
    validateOrigin(event);
    validateObject(config, 'config');

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Le chiffrement système n\'est pas disponible');
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
      throw new Error('Erreur lors de la sauvegarde de la configuration');
    }
  });

  /**
   * Get cloud configuration securely
   */
  ipcMain.handle('vault:getCloudConfig', async (event) => {
    validateOrigin(event);

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
  });

  // ==================== DURESS MODE ====================

  /**
   * Setup Duress Mode (Enable Plausible Deniability migration)
   */
  ipcMain.handle('vault:duress:setup', async (event, { masterPassword, duressPassword, populateDecoy }) => {
    validateOrigin(event);
    validateString(masterPassword, 'masterPassword');
    validateString(duressPassword, 'duressPassword');

    // Ensure session is unlocked
    const state = session.getState();
    if (!state.vaultId || state.status !== 'unlocked') {
      throw new Error('Vault must be unlocked to enable Duress Mode');
    }

    // Must pass a new method in FileManager or Session to perform the migration
    // We'll call session.enableDuressMode which will orchestrate with File Manager
    await session.enableDuressMode(masterPassword, duressPassword, populateDecoy);

    return { success: true };
  });

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
  // Skip validation if no sender frame (internal call)
  if (!event.senderFrame) return;

  const url = event.senderFrame.url;

  // Check against trusted origins
  const isTrusted = TRUSTED_ORIGINS.some(origin => url.startsWith(origin));

  if (!isTrusted) {
    console.error(`[Vault] Untrusted IPC origin: ${url}`);
    throw new Error('Accès non autorisé');
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
 * Get session for testing
 * @returns {VaultSessionManager}
 */
export function getSession() {
  return session;
}

export default { registerVaultIPC, setMainWindow, getSession };
