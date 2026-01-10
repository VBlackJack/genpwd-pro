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
import { t } from '../../utils/i18n-node.js';
import auditLogger from '../../security/audit-logger.js';

// SECURITY: Only log in development mode to prevent information disclosure
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Safe logging wrapper - only logs in development mode
 * @param  {...any} args - Arguments to log
 */
function devLog(...args) {
  if (IS_DEV) {
    console.log(...args);
  }
}

/**
 * Safe warning logging wrapper - only logs in development mode
 * @param  {...any} args - Arguments to log
 */
function devWarn(...args) {
  if (IS_DEV) {
    console.warn(...args);
  }
}

/** @type {VaultSessionManager} */
let session;

/** @type {VaultFileManager} */
let fileManager;

/** @type {ShareService} */
let shareService;

// ==================== SECURITY CONSTANTS ====================

/**
 * Input size limits to prevent DoS attacks
 * All sizes in bytes
 */
const INPUT_LIMITS = {
  /** Max password length (256 chars) */
  PASSWORD_MAX: 256,
  /** Max name/title length (200 chars) */
  NAME_MAX: 200,
  /** Max notes/content length (100KB) */
  CONTENT_MAX: 100 * 1024,
  /** Max search query length */
  QUERY_MAX: 500,
  /** Max file path length */
  PATH_MAX: 4096,
  /** Max secret data for sharing (50KB) */
  SECRET_MAX: 50 * 1024,
  /** Max color string length */
  COLOR_MAX: 10
};

/**
 * Whitelist of allowed IPC channels (for documentation and future validation)
 * Note: Actual enforcement is via ipcMain.handle() registration - only registered channels work
 * @private
 */
const _ALLOWED_IPC_CHANNELS = new Set([
  // Vault management
  'vault:getState',
  'vault:list',
  'vault:create',
  'vault:unlock',
  'vault:lock',
  'vault:getMetadata',
  'vault:resetActivity',
  'vault:delete',
  'vault:nuke',
  'vault:unregister',
  'vault:changePassword',
  'vault:export',
  'vault:import',
  // External vault
  'vault:showSaveDialog',
  'vault:showOpenDialog',
  'vault:openFromPath',
  // Entries
  'vault:entries:getAll',
  'vault:entries:get',
  'vault:entries:getByFolder',
  'vault:entries:search',
  'vault:entries:add',
  'vault:entries:update',
  'vault:entries:delete',
  // Folders
  'vault:folders:getAll',
  'vault:folders:add',
  'vault:folders:update',
  'vault:folders:delete',
  // Tags
  'vault:tags:getAll',
  'vault:tags:add',
  'vault:tags:update',
  'vault:tags:delete',
  // Windows Hello
  'vault:hello:isAvailable',
  'vault:hello:isEnabled',
  'vault:hello:enable',
  'vault:hello:disable',
  'vault:hello:unlock',
  // Cloud sync
  'vault:saveCloudConfig',
  'vault:getCloudConfig',
  // Sharing
  'vault:share:create',
  // Duress mode
  'vault:duress:setup'
]);

// ==================== RATE LIMITING ====================

/**
 * Rate limiter for vault unlock attempts with exponential backoff
 * Prevents brute force attacks with escalating lockout durations
 *
 * Security constants match SECURITY_TIMEOUTS in ui-constants.js:
 * - MAX_ATTEMPTS matches MAX_FAILED_ATTEMPTS (5)
 * - Base lockout duration starts at 1 minute
 * - Exponential backoff: 1min → 5min → 15min → 1hr → 4hr
 */
const unlockRateLimiter = {
  /** @type {Map<string, { attempts: number, lockedUntil: number, lockoutCount: number, firstAttempt: number }>} */
  attempts: new Map(),

  /** Max attempts before lockout - matches SECURITY_TIMEOUTS.MAX_FAILED_ATTEMPTS */
  MAX_ATTEMPTS: 5,

  /** Path to encrypted lockout state file */
  get LOCKOUT_FILE() {
    return path.join(app.getPath('userData'), '.lockout-state');
  },

  /**
   * SECURITY: Save lockout state to encrypted file
   * Persists lockout count to prevent bypass via app restart
   */
  async saveState() {
    try {
      // Only save lockout counts (not attempts which reset)
      const state = {};
      for (const [vaultId, record] of this.attempts.entries()) {
        if (record.lockoutCount > 0 || record.lockedUntil > Date.now()) {
          state[vaultId] = {
            lockoutCount: record.lockoutCount,
            lockedUntil: record.lockedUntil
          };
        }
      }

      if (Object.keys(state).length === 0) {
        // No lockouts to persist - delete file if exists
        if (fs.existsSync(this.LOCKOUT_FILE)) {
          fs.unlinkSync(this.LOCKOUT_FILE);
        }
        return;
      }

      const json = JSON.stringify(state);
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(json);
        fs.writeFileSync(this.LOCKOUT_FILE, encrypted);
      } else {
        // Fallback: Base64 encode (not secure, but better than plaintext)
        fs.writeFileSync(this.LOCKOUT_FILE, Buffer.from(json).toString('base64'));
      }
      devLog('[RateLimiter] Lockout state persisted');
    } catch (error) {
      devWarn('[RateLimiter] Failed to save lockout state:', error.message);
    }
  },

  /**
   * SECURITY: Load lockout state from encrypted file on startup
   */
  async loadState() {
    try {
      if (!fs.existsSync(this.LOCKOUT_FILE)) {
        return;
      }

      const data = fs.readFileSync(this.LOCKOUT_FILE);
      let json;

      if (safeStorage.isEncryptionAvailable()) {
        json = safeStorage.decryptString(data);
      } else {
        // Fallback: Base64 decode
        json = Buffer.from(data.toString(), 'base64').toString('utf8');
      }

      const state = JSON.parse(json);
      const now = Date.now();

      for (const [vaultId, record] of Object.entries(state)) {
        // Only restore if lockout is still active or within grace period
        if (record.lockedUntil > now || record.lockoutCount > 0) {
          this.attempts.set(vaultId, {
            attempts: 0,
            firstAttempt: now,
            lockoutCount: record.lockoutCount || 0,
            lockedUntil: record.lockedUntil || 0
          });
        }
      }
      devLog('[RateLimiter] Lockout state loaded');
    } catch (error) {
      devWarn('[RateLimiter] Failed to load lockout state:', error.message);
      // Delete corrupted file
      try {
        if (fs.existsSync(this.LOCKOUT_FILE)) {
          fs.unlinkSync(this.LOCKOUT_FILE);
        }
      } catch { /* ignore */ }
    }
  },

  /** Base lockout durations in ms (exponential backoff) */
  LOCKOUT_DURATIONS: [
    1 * 60 * 1000,      // 1 minute (first lockout)
    5 * 60 * 1000,      // 5 minutes (second lockout)
    15 * 60 * 1000,     // 15 minutes (third lockout)
    60 * 60 * 1000,     // 1 hour (fourth lockout)
    4 * 60 * 60 * 1000  // 4 hours (fifth+ lockout)
  ],

  /** Window for counting attempts (5 minutes) */
  ATTEMPT_WINDOW: 5 * 60 * 1000,

  /** Grace period after lockout expires to reset lockout count (1 hour) */
  LOCKOUT_RESET_WINDOW: 60 * 60 * 1000,

  /**
   * Get lockout duration based on lockout count (exponential backoff)
   * @param {number} lockoutCount - Number of times user has been locked out
   * @returns {number} Lockout duration in ms
   */
  getLockoutDuration(lockoutCount) {
    const index = Math.min(lockoutCount, this.LOCKOUT_DURATIONS.length - 1);
    return this.LOCKOUT_DURATIONS[index];
  },

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
      // Lockout expired - reset attempts but keep lockout count for escalation
      // Reset lockout count only if enough time has passed (grace period)
      if (now - record.lockedUntil > this.LOCKOUT_RESET_WINDOW) {
        record.lockoutCount = 0;
      }
      record.attempts = 0;
      record.lockedUntil = 0;
      record.firstAttempt = now;
    }

    // Check if currently locked out
    if (record && record.lockedUntil && now < record.lockedUntil) {
      const lockoutSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, lockoutSeconds };
    }

    // Initialize if no record
    if (!record) {
      record = { attempts: 0, firstAttempt: now, lockedUntil: 0, lockoutCount: 0 };
    }

    // Reset attempts if window expired (but keep lockout count)
    if ((now - record.firstAttempt) > this.ATTEMPT_WINDOW) {
      record.attempts = 0;
      record.firstAttempt = now;
    }

    // Increment attempts
    record.attempts++;

    // Check if max attempts exceeded
    if (record.attempts > this.MAX_ATTEMPTS) {
      const lockoutDuration = this.getLockoutDuration(record.lockoutCount);
      record.lockedUntil = now + lockoutDuration;
      record.lockoutCount++;
      this.attempts.set(vaultId, record);
      const lockoutSeconds = Math.ceil(lockoutDuration / 1000);
      devLog(`[RateLimiter] Lockout #${record.lockoutCount} applied: ${lockoutSeconds}s`);
      // SECURITY: Persist lockout state to prevent bypass via app restart
      this.saveState();
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
   * Also resets lockout count since user proved they know the password
   * @param {string} vaultId
   */
  clearAttempts(vaultId) {
    this.attempts.delete(vaultId);
    // SECURITY: Update persisted state after successful unlock
    this.saveState();
  }
};

// ==================== GLOBAL IPC RATE LIMITER ====================

/**
 * Global IPC rate limiter to prevent DoS attacks
 * Limits the total number of IPC requests per second
 */
const globalIPCRateLimiter = {
  /** @type {Map<string, { count: number, windowStart: number }>} */
  requests: new Map(),

  /** Max requests per window (per sender) */
  MAX_REQUESTS: 100,

  /** Time window in ms */
  WINDOW_MS: 1000,

  /**
   * High-frequency channels with separate higher limits
   * SECURITY: No channels are fully exempt - all have rate limits to prevent abuse
   */
  HIGH_FREQUENCY_CHANNELS: new Set([
    'vault:resetActivity',  // Called on user interaction - limit 20/sec
    'vault:getState'        // Called for UI state - limit 20/sec
  ]),

  /** Higher limit for high-frequency channels */
  HIGH_FREQUENCY_MAX: 20,

  /**
   * Check if request is allowed
   * @param {string} senderId - Unique sender identifier
   * @param {string} channel - IPC channel name
   * @returns {boolean} - True if allowed
   */
  checkRequest(senderId, channel) {
    const now = Date.now();
    const isHighFrequency = this.HIGH_FREQUENCY_CHANNELS.has(channel);
    const maxRequests = isHighFrequency ? this.HIGH_FREQUENCY_MAX : this.MAX_REQUESTS;

    // Use channel-specific key for high-frequency channels
    const key = isHighFrequency ? `${senderId}:${channel}` : senderId;
    let record = this.requests.get(key);

    // Initialize or reset window
    if (!record || (now - record.windowStart) > this.WINDOW_MS) {
      record = { count: 0, windowStart: now };
    }

    record.count++;
    this.requests.set(key, record);

    if (record.count > maxRequests) {
      devWarn(`[IPCRateLimiter] Rate limit exceeded for ${isHighFrequency ? 'high-frequency ' : ''}channel: ${channel}`);
      return false;
    }

    return true;
  },

  /**
   * Clean up old entries periodically
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if ((now - record.windowStart) > this.WINDOW_MS * 2) {
        this.requests.delete(key);
      }
    }
  }
};

// Cleanup old rate limit entries every minute
setInterval(() => globalIPCRateLimiter.cleanup(), 60000);

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
/**
 * Sanitize error messages to prevent internal detail leakage
 * @param {string} message - Raw error message
 * @returns {string} Sanitized message safe for client
 */
function sanitizeErrorMessage(message) {
  if (!message) return t('errors.generic.unknown');

  // Map of internal error patterns to user-friendly actionable messages (i18n keys)
  const errorMappings = [
    { pattern: /ENOENT|no such file/i, messageKey: 'errors.file.notFound' },
    { pattern: /EACCES|permission denied/i, messageKey: 'errors.file.accessDenied' },
    { pattern: /EEXIST|already exists/i, messageKey: 'errors.file.alreadyExists' },
    { pattern: /ENOSPC|no space/i, messageKey: 'errors.file.noSpace' },
    { pattern: /SQLITE_BUSY|SQLITE_LOCKED/i, messageKey: 'errors.database.busy' },
    { pattern: /SQLITE_CORRUPT/i, messageKey: 'errors.database.corrupted' },
    { pattern: /SQLITE_/i, messageKey: 'errors.database.error' },
    // SECURITY: Use generic auth error for all password/crypto failures
    // Prevents attackers from distinguishing between wrong password vs other errors
    { pattern: /crypto|decrypt|cipher|password|incorrect|invalid.*key/i, messageKey: 'errors.auth.authenticationFailed' },
    { pattern: /timeout|timed out/i, messageKey: 'errors.network.timeout' },
    { pattern: /network|ECONNREFUSED|ETIMEDOUT/i, messageKey: 'errors.network.error' },
    { pattern: /EPERM|operation not permitted/i, messageKey: 'errors.file.operationNotPermitted' },
    { pattern: /EBUSY|resource busy/i, messageKey: 'errors.file.inUse' },
  ];

  // Check for known error patterns
  for (const { pattern, messageKey } of errorMappings) {
    if (pattern.test(message)) {
      return t(messageKey);
    }
  }

  // Remove file paths (Windows and Unix)
  let sanitized = message
    .replace(/[A-Za-z]:\\[^\s:]+/g, '[path]')  // Windows paths
    .replace(/\/[^\s:]+/g, '[path]')            // Unix paths
    .replace(/at\s+.+\(.*:\d+:\d+\)/g, '')      // Stack trace lines
    .replace(/\s+at\s+.+/g, '')                  // More stack traces
    .replace(/Error:\s*/g, '')                   // Error prefix
    .trim();

  // Limit message length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100) + '...';
  }

  return sanitized || t('errors.generic.unknown');
}

function safeHandler(handler, name) {
  return async (event, ...args) => {
    try {
      // SECURITY: Validate origin first
      validateOrigin(event);

      // SECURITY: Apply global rate limiting
      const senderId = event.sender?.id?.toString() || 'unknown';
      if (!globalIPCRateLimiter.checkRequest(senderId, `vault:${name}`)) {
        throw new Error(t('errors.network.rateLimited'));
      }

      return await handler(event, ...args);
    } catch (error) {
      // Log the full error for debugging (server-side only, dev mode)
      if (IS_DEV) {
        console.error(`[IPC:${name}] Error:`, error.message, error.stack);
      }

      // Re-throw with sanitized message (no stack trace, no internal paths)
      const safeMessage = sanitizeErrorMessage(error.message);
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

  // SECURITY: Load persisted lockout state on startup
  // Prevents bypassing lockout by restarting the app
  unlockRateLimiter.loadState();

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
        devLog('[Vault] Cloud config loaded on startup');
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
  //
  // IPC Return Format Convention:
  // - QUERY handlers (get*, list, search): Return data directly
  // - MUTATION handlers (create, update, delete, lock, unlock): Return { success: true, ...extraFields }
  // - BOOLEAN handlers (is*): Return boolean directly
  // - DIALOG handlers (showSaveDialog, showOpenDialog): Return { canceled: boolean, filePath?: string }
  // - ERRORS: Thrown as Error (caught by safeHandler, sanitized)

  /**
   * Get current session state
   * @returns {Promise<{status: string, vaultId: string|null, vaultName: string|null}>}
   */
  ipcMain.handle('vault:getState', safeHandler(async () => {
    return session.getState();
  }, 'getState'));

  /**
   * List available vaults
   * @returns {Promise<Array<{id: string, name: string, path: string, lastOpened: string}>>}
   */
  ipcMain.handle('vault:list', safeHandler(async () => {
    return fileManager.listVaults();
  }, 'list'));

  /**
   * Create new vault
   * @returns {Promise<{vaultId: string, success: boolean}>}
   */
  ipcMain.handle('vault:create', safeHandler(async (event, { name, password, customPath }) => {
    validateName(name, 'name');
    validatePassword(password);
    if (customPath) {
      validatePath(customPath, 'customPath');
    }

    const vaultId = await session.create(name, password, customPath || null);
    auditLogger.vaultCreated(vaultId);
    return { vaultId, success: true };
  }, 'create'));

  // ==================== SECURE SHARING (GenPwd Send) ====================

  /**
   * Create a secure share
   */
  ipcMain.handle('vault:share:create', safeHandler(async (event, { secretData, options }) => {
    validateString(secretData, 'secretData', INPUT_LIMITS.SECRET_MAX);

    // Validate options if provided
    if (options !== undefined && options !== null) {
      validateObject(options, 'options');
      // Validate specific option fields
      if (options.expiryType !== undefined && typeof options.expiryType !== 'string') {
        throw new Error(t('errors.validation.expiryTypeMustBeString'));
      }
      if (options.burnAfterReading !== undefined && typeof options.burnAfterReading !== 'boolean') {
        throw new Error(t('errors.validation.burnAfterReadingMustBeBoolean'));
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
        throw new Error(t('errors.vault.invalidVaultNameChars'));
      }
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: t('desktop.dialogs.createVaultTitle'),
      defaultPath: defaultName || 'MyVault.gpd',
      filters: [
        { name: t('desktop.dialogs.vaultFileFilter'), extensions: ['gpd'] }
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
      title: t('desktop.dialogs.openVaultTitle'),
      filters: [
        { name: t('desktop.dialogs.vaultFileFilter'), extensions: ['gpd'] }
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
    validatePath(filePath, 'filePath');
    validatePassword(password);

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
   * @returns {Promise<{success: boolean}>}
   */
  ipcMain.handle('vault:unlock', safeHandler(async (event, { vaultId, password }) => {
    validateString(vaultId, 'vaultId');
    validatePassword(password);

    // Check rate limit before attempting unlock
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      auditLogger.rateLimitTriggered(vaultId, rateCheck.lockoutSeconds);
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      await session.unlock(vaultId, password);
      // Clear attempts on successful unlock
      unlockRateLimiter.clearAttempts(vaultId);
      auditLogger.authSuccess(vaultId, 'password');
      auditLogger.vaultUnlocked(vaultId);
      return { success: true };
    } catch (error) {
      // SECURITY: Don't leak remaining attempts count to potential attackers
      auditLogger.authFailure(vaultId, 'invalid_credentials');
      throw error;
    }
  }, 'unlock'));

  /**
   * Lock vault
   */
  ipcMain.handle('vault:lock', safeHandler(async () => {
    const currentVaultId = session.getCurrentVaultId?.() || 'unknown';
    await session.lock();
    auditLogger.vaultLocked(currentVaultId, 'manual');
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
   * @returns {Promise<Array<Object>>} Array of entry objects
   */
  ipcMain.handle('vault:entries:getAll', safeHandler(async () => {
    return session.getEntries();
  }, 'entries:getAll'));

  /**
   * Get entry by ID
   * @returns {Promise<Object|null>} Entry object or null if not found
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
    validateString(query, 'query', INPUT_LIMITS.QUERY_MAX);
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
    validateName(title, 'title');
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
    validateName(name, 'name');
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
    validateName(name, 'name');
    // Validate color format if provided (hex color)
    if (color !== undefined && color !== null) {
      if (typeof color !== 'string' || color.length > INPUT_LIMITS.COLOR_MAX || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error(t('errors.validation.colorMustBeHex'));
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
  // NOTE: These handlers are implemented but not yet used in the renderer.
  // They are available for future vault export/import UI features.

  /**
   * Export vault (requires dialog in renderer) - with rate limiting
   * @todo Implement UI in renderer to use this handler
   */
  ipcMain.handle('vault:export', safeHandler(async (event, { vaultId, password, exportPath }) => {
    validateString(vaultId, 'vaultId');
    validatePassword(password);
    validatePath(exportPath, 'exportPath');

    // Check rate limit before attempting export (password verification)
    const rateCheck = unlockRateLimiter.checkAndRecord(`${vaultId}:export`);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      await fileManager.exportVault(vaultId, password, exportPath);
      unlockRateLimiter.clearAttempts(`${vaultId}:export`);
      auditLogger.vaultExported(vaultId, 'json');
      return { success: true };
    } catch (error) {
      auditLogger.authFailure(vaultId, 'export_failed');
      throw error;
    }
  }, 'export'));

  /**
   * Import vault - with rate limiting
   * @todo Implement UI in renderer to use this handler
   */
  ipcMain.handle('vault:import', safeHandler(async (event, { importPath, password }) => {
    validatePath(importPath, 'importPath');
    validatePassword(password);

    // Check rate limit before attempting import (password verification)
    const rateCheck = unlockRateLimiter.checkAndRecord(`import:${importPath}`);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      const { vaultId } = await fileManager.importVault(importPath, password);
      unlockRateLimiter.clearAttempts(`import:${importPath}`);
      auditLogger.vaultImported(vaultId, 'file');
      return { vaultId, success: true };
    } catch (error) {
      auditLogger.authFailure('import', 'import_failed');
      throw error;
    }
  }, 'import'));

  /**
   * Change vault password (with rate limiting)
   */
  ipcMain.handle('vault:changePassword', safeHandler(async (event, { vaultId, currentPassword, newPassword }) => {
    validateString(vaultId, 'vaultId');
    validatePassword(currentPassword);
    validatePassword(newPassword);

    // Check rate limit before attempting password change
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      await fileManager.changePassword(vaultId, currentPassword, newPassword);
      unlockRateLimiter.clearAttempts(vaultId);
      auditLogger.passwordChanged(vaultId);
      return { success: true };
    } catch (error) {
      auditLogger.authFailure(vaultId, 'password_change_failed');
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
      auditLogger.vaultLocked(vaultId, 'delete');
    }

    await fileManager.deleteVault(vaultId);
    auditLogger.vaultDeleted(vaultId);
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
      devWarn('[WindowsHello] Orphan credential found, cleaning up...');
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
    validatePassword(password);

    // Check rate limit before attempting (password is validated)
    const rateCheck = unlockRateLimiter.checkAndRecord(vaultId);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.lockoutSeconds / 60);
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      // Check Windows Hello availability
      const isAvailable = await WindowsHelloAuth.isAvailable();
      if (!isAvailable) {
        throw new Error(t('errors.windowsHello.notAvailable'));
      }

      // Request Windows Hello verification
      const verified = await WindowsHelloAuth.requestVerification(
        t('desktop.dialogs.helloEnablePrompt')
      );
      if (!verified) {
        throw new Error(t('errors.windowsHello.verificationFailed'));
      }

      // Unlock vault temporarily to get the encryption key
      const vaultKey = await session.getDerivedKey(vaultId, password);
      if (!vaultKey) {
        throw new Error(t('errors.auth.incorrectPassword'));
      }

      // Generate wrapper key and encrypt vault key
      const wrapperKey = WindowsHelloAuth.generateKeyWrapper();
      const encryptedKey = WindowsHelloAuth.encryptVaultKey(vaultKey, wrapperKey);

      // Store wrapper in Windows Credential Manager
      const stored = await WindowsHelloAuth.storeCredential(vaultId, wrapperKey);
      if (!stored) {
        throw new Error(t('errors.windowsHello.storeCredentialsFailed'));
      }

      // Store encrypted vault key in vault metadata
      await fileManager.setVaultHelloKey(vaultId, encryptedKey);

      // Clear rate limit on success
      unlockRateLimiter.clearAttempts(vaultId);
      auditLogger.biometricAuth(vaultId, true);
      return { success: true };
    } catch (error) {
      auditLogger.biometricAuth(vaultId, false);
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

    devLog('[WindowsHello] Disabled successfully');
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
      throw new Error(t('errors.auth.tooManyAttempts', { minutes }));
    }

    try {
      // Get encrypted vault key from vault file FIRST
      const encryptedKey = await fileManager.getVaultHelloKey(vaultId);
      if (!encryptedKey) {
        // Cleanup orphan credential if exists
        await WindowsHelloAuth.deleteCredential(vaultId);
        throw new Error(t('errors.windowsHello.notConfigured'));
      }

      // Check if credential exists in Windows Credential Manager
      const wrapperKey = await WindowsHelloAuth.retrieveCredential(vaultId);
      if (!wrapperKey) {
        throw new Error(t('errors.windowsHello.credentialNotFound'));
      }

      // Request Windows Hello verification
      const verified = await WindowsHelloAuth.requestVerification(
        t('desktop.dialogs.helloUnlockPrompt')
      );
      if (!verified) {
        throw new Error(t('errors.windowsHello.verificationCancelled'));
      }

      // Decrypt vault key
      let vaultKey;
      try {
        vaultKey = WindowsHelloAuth.decryptVaultKey(encryptedKey, wrapperKey);
      } catch (decryptError) {
        console.error('[WindowsHello] Key decryption failed:', decryptError.message);
        throw new Error(t('errors.windowsHello.decryptionError'));
      }

      // Unlock vault with decrypted key
      await session.unlockWithKey(vaultId, vaultKey);

      // Clear attempts on successful unlock
      unlockRateLimiter.clearAttempts(vaultId);
      auditLogger.authSuccess(vaultId, 'biometric');
      auditLogger.vaultUnlocked(vaultId);
      return { success: true };
    } catch (error) {
      // Re-throw without leaking attempt count
      auditLogger.authFailure(vaultId, 'biometric_failed');
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
      throw new Error(t('errors.config.systemEncryptionNotAvailable'));
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
      throw new Error(t('errors.config.saveCloudFailed'));
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
    validatePassword(masterPassword);
    validatePassword(duressPassword);
    // Validate populateDecoy is boolean
    if (typeof populateDecoy !== 'boolean') {
      throw new Error(t('errors.duress.populateDecoyMustBeBoolean'));
    }

    // Ensure session is unlocked
    const state = session.getState();
    if (!state.vaultId || state.status !== 'unlocked') {
      throw new Error(t('errors.duress.vaultMustBeUnlocked'));
    }

    // Must pass a new method in FileManager or Session to perform the migration
    // We'll call session.enableDuressMode which will orchestrate with File Manager
    await session.enableDuressMode(masterPassword, duressPassword, populateDecoy);

    auditLogger.duressActivated(state.vaultId);
    return { success: true };
  }, 'duress:setup'));

  devLog('[Vault] IPC handlers registered');
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
    throw new Error(t('errors.auth.unauthorized'));
  }

  // Check against trusted origins
  const isTrusted = TRUSTED_ORIGINS.some(origin => url.startsWith(origin));

  if (!isTrusted) {
    console.error(`[Vault] Untrusted IPC origin: ${url}`);
    throw new Error(t('errors.auth.unauthorized'));
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
 * Validate string parameter with optional size limit
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name
 * @param {number} [maxLength] - Maximum allowed length
 * @throws {Error}
 */
function validateString(value, name, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(t('errors.validation.invalidParameter', { name }));
  }
  if (maxLength && value.length > maxLength) {
    throw new Error(t('errors.validation.parameterTooLong', { name, maxLength }));
  }
}

/**
 * Validate password with size limit
 * @param {*} value - Value to validate
 * @throws {Error}
 */
function validatePassword(value) {
  validateString(value, 'password', INPUT_LIMITS.PASSWORD_MAX);
}

/**
 * Validate name/title with size limit
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name
 * @throws {Error}
 */
function validateName(value, name = 'name') {
  validateString(value, name, INPUT_LIMITS.NAME_MAX);
}

/**
 * Validate file path with size limit and sanitization
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name
 * @throws {Error}
 */
function validatePath(value, name = 'path') {
  validateString(value, name, INPUT_LIMITS.PATH_MAX);
  // Block null bytes and relative path escape attempts
  if (value.includes('\0') || value.includes('..')) {
    throw new Error(t('errors.validation.forbiddenCharacters', { name }));
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
    throw new Error(t('errors.validation.mustBeObject', { name }));
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
    throw new Error(t('errors.validation.invalidEntryType', { type, validTypes: VALID_ENTRY_TYPES.join(', ') }));
  }

  // Validate data is object
  if (typeof data !== 'object' || data === null) {
    throw new Error(t('errors.validation.entryMustBeObject'));
  }

  // Whitelist allowed fields
  const allowedFields = ALLOWED_ENTRY_FIELDS[type];
  const dataFields = Object.keys(data);

  for (const field of dataFields) {
    if (!allowedFields.includes(field)) {
      throw new Error(t('errors.validation.invalidFieldForType', { field, type }));
    }
  }

  // Validate field types and lengths
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (key === 'tagIds') {
      if (!Array.isArray(value)) {
        throw new Error(t('errors.validation.tagIdsMustBeArray'));
      }
      if (!value.every(id => typeof id === 'string')) {
        throw new Error(t('errors.validation.tagIdsMustBeStrings'));
      }
      // Limit number of tags per entry
      if (value.length > 50) {
        throw new Error(t('errors.validation.maxTagsExceeded'));
      }
    } else if (key === 'favorite') {
      if (typeof value !== 'boolean') {
        throw new Error(t('errors.validation.favoriteMustBeBoolean'));
      }
    } else if (typeof value !== 'string') {
      throw new Error(t('errors.validation.mustBeString', { field: key }));
    } else {
      // SECURITY: Validate string field length to prevent memory exhaustion
      const maxLength = (key === 'notes' || key === 'content')
        ? INPUT_LIMITS.CONTENT_MAX
        : INPUT_LIMITS.NAME_MAX;
      if (value.length > maxLength) {
        throw new Error(t('errors.validation.fieldTooLong', { field: key, maxLength }));
      }
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
