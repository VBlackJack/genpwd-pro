/**
 * @fileoverview Vault Session Manager
 * Manages the unlocked vault in memory with auto-lock functionality
 *
 * Lifecycle:
 *   unlock() → vault in memory → CRUD operations → lock() → memory cleared
 *
 * Security features:
 * - Auto-lock after inactivity
 * - Key wiped on lock
 * - Automatic save after mutations
 */

import { VaultFileManager } from '../storage/vault-file-manager.js';
import { CryptoEngine } from '../crypto/crypto-engine.js';
import { createEntry, createFolder, createTag } from '../models/vault-types.js';
import { EventEmitter } from 'node:events';
import { t } from '../../utils/i18n-node.js';

// Security constant: matches SECURITY_TIMEOUTS.AUTO_LOCK_DEFAULT_MS in ui-constants.js (300000ms = 5 minutes)
const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

// Warning before auto-lock (30 seconds before)
const AUTO_LOCK_WARNING_MS = 30 * 1000;

/**
 * Sanitize error messages to prevent information disclosure
 * Maps internal error patterns to user-friendly messages
 * @param {string} message - Raw error message
 * @returns {string} Sanitized message safe for display
 */
function sanitizeErrorMessage(message) {
  if (!message) return t('errors.generic.occurred');

  const errorMappings = [
    { pattern: /ENOENT|no such file/i, key: 'errors.file.notFound' },
    { pattern: /EACCES|permission denied/i, key: 'errors.file.accessDenied' },
    { pattern: /crypto|decrypt|cipher|authentication/i, key: 'errors.crypto.encryptionError' },
    { pattern: /password|incorrect/i, key: 'errors.auth.incorrectPassword' },
    { pattern: /timeout|timed out/i, key: 'errors.session.timeout' },
    { pattern: /locked/i, key: 'errors.session.locked' },
  ];

  for (const mapping of errorMappings) {
    if (mapping.pattern.test(message)) {
      return t(mapping.key);
    }
  }

  // Generic message for unknown errors (don't expose internals)
  return t('errors.generic.tryAgain');
}

/**
 * @typedef {Object} SessionState
 * @property {'locked'|'unlocked'|'unlocking'} status
 * @property {string|null} vaultId
 * @property {string|null} vaultName
 */

/**
 * Vault Session Manager
 * Emits: 'locked', 'unlocked', 'changed', 'error'
 */
export class VaultSessionManager extends EventEmitter {
  /** @type {VaultFileManager} */
  #fileManager;

  /** @type {CryptoEngine} */
  #crypto;

  /** @type {Object|null} */
  #vaultData;

  /** @type {Uint8Array|null} */
  #key;

  /** @type {string|null} */
  #vaultId;

  /** @type {NodeJS.Timeout|null} */
  #autoLockTimer;

  /** @type {NodeJS.Timeout|null} */
  #autoLockWarningTimer;

  /** @type {number} */
  #autoLockMs;

  /** @type {boolean} */
  #isDirty;

  /** @type {number} */
  #activeSlot = 0; // 0 = Real, 1 = Decoy

  constructor() {
    super();
    this.#fileManager = new VaultFileManager();
    this.#crypto = new CryptoEngine();
    this.#vaultData = null;
    this.#key = null;
    this.#vaultId = null;
    this.#autoLockTimer = null;
    this.#autoLockWarningTimer = null;
    this.#autoLockMs = DEFAULT_AUTO_LOCK_MS;
    this.#isDirty = false;
  }

  /**
   * Get current session state
   * @returns {SessionState}
   */
  getState() {
    return {
      status: this.#key ? 'unlocked' : 'locked',
      vaultId: this.#vaultId,
      vaultName: this.#vaultData?.metadata?.name || null
    };
  }

  /**
   * Check if vault is unlocked
   * @returns {boolean}
   */
  isUnlocked() {
    return this.#key !== null && this.#vaultData !== null;
  }

  /**
   * Create a new vault
   * @param {string} name - Vault name
   * @param {string} password - Master password
   * @param {string} [customPath] - Custom file path for external vaults
   * @returns {Promise<string>} Vault ID
   */
  async create(name, password, customPath = null) {
    const { vaultId } = await this.#fileManager.createVault(name, password, customPath);

    // Auto-unlock the newly created vault
    await this.unlock(vaultId, password);

    return vaultId;
  }

  /**
   * Initialize session with an already-loaded vault (for external vaults)
   * @param {string} vaultId - Vault ID
   * @param {Object} vaultData - Decrypted vault data
   * @param {Uint8Array} key - Encryption key
   * @param {number} [activeSlot=0] - Active slot index
   * @returns {Promise<void>}
   */
  async initWithVault(vaultId, vaultData, key, activeSlot = 0) {
    // Lock current vault if any
    if (this.isUnlocked()) {
      await this.lock();
    }

    this.#vaultData = vaultData;
    this.#key = key;
    this.#vaultId = vaultId;
    this.#activeSlot = activeSlot;
    this.#isDirty = false;

    // Set auto-lock timer
    this.#resetAutoLockTimer();

    // Configure auto-lock from vault settings
    if (vaultData.metadata?.settings?.autoLockMinutes) {
      this.#autoLockMs = vaultData.metadata.settings.autoLockMinutes * 60 * 1000;
    }

    this.emit('unlocked', { vaultId, name: vaultData.metadata.name, isDecoy: activeSlot === 1 });
  }

  /**
   * Unlock vault
   * @param {string} vaultId - Vault ID
   * @param {string} password - Master password
   * @returns {Promise<void>}
   */
  async unlock(vaultId, password) {
    // Lock current vault if any
    if (this.isUnlocked()) {
      await this.lock();
    }

    try {
      const { vaultData, key, activeSlot } = await this.#fileManager.openVault(vaultId, password);

      this.#vaultData = vaultData;
      this.#key = key;
      this.#vaultId = vaultId;
      this.#activeSlot = activeSlot || 0;
      this.#isDirty = false;

      // Set auto-lock timer
      this.#resetAutoLockTimer();

      // Configure auto-lock from vault settings
      if (vaultData.metadata?.settings?.autoLockMinutes) {
        this.#autoLockMs = vaultData.metadata.settings.autoLockMinutes * 60 * 1000;
      }

      this.emit('unlocked', { vaultId, name: vaultData.metadata.name, isDecoy: activeSlot === 1 });
    } catch (error) {
      this.emit('error', { action: 'unlock', error: sanitizeErrorMessage(error.message) });
      throw error;
    }
  }

  /**
   * Lock vault and clear memory
   * @returns {Promise<void>}
   */
  async lock() {
    if (!this.isUnlocked()) return;

    // Clear data from memory
    this.#vaultData = null;
    this.#vaultId = null;
    this.#activeSlot = 0;

    if (this.#key) {
      this.#crypto.wipeKey(this.#key);
      this.#key = null;
    }

    this.#stopAutoLockTimer();
    this.emit('locked', {});
  }

  /**
   * Save current vault state
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.isUnlocked()) {
      throw new Error(t('errors.vault.locked'));
    }

    try {
      if (this.#key && this.#vaultData) {
        await this.#fileManager.saveVault(
          this.#vaultId,
          this.#vaultData,
          this.#key,
          this.#activeSlot
        );
        this.#isDirty = false;
        this.emit('changed', {});
      }
    } catch (error) {
      this.emit('error', { action: 'save', error: sanitizeErrorMessage(error.message) });
      throw error;
    }
  }
  /**
   * Reset auto-lock timer (call on user activity)
   */
  resetActivity() {
    if (this.isUnlocked()) {
      this.#resetAutoLockTimer();
    }
  }

  /**
   * Get vault metadata
   * @returns {Object|null}
   */
  getMetadata() {
    return this.#vaultData?.metadata || null;
  }

  // ==================== ENTRIES ====================

  /**
   * Get all entries
   * @returns {Array}
   */
  getEntries() {
    this.#requireUnlocked();
    return [...this.#vaultData.entries];
  }

  /**
   * Get entry by ID
   * @param {string} id - Entry ID
   * @returns {Object|null}
   */
  getEntry(id) {
    this.#requireUnlocked();
    return this.#vaultData.entries.find(e => e.id === id) || null;
  }

  /**
   * Get entries by folder
   * @param {string|null} folderId - Folder ID (null for root)
   * @returns {Array}
   */
  getEntriesByFolder(folderId) {
    this.#requireUnlocked();
    return this.#vaultData.entries.filter(e => e.folderId === folderId);
  }

  /**
   * Search entries
   * @param {string} query - Search query
   * @returns {Array}
   */
  searchEntries(query) {
    this.#requireUnlocked();
    const lower = query.toLowerCase();
    return this.#vaultData.entries.filter(e =>
      e.title.toLowerCase().includes(lower) ||
      e.data?.username?.toLowerCase().includes(lower) ||
      e.data?.url?.toLowerCase().includes(lower) ||
      e.notes?.toLowerCase().includes(lower)
    );
  }

  /**
   * Add new entry
   * @param {string} type - Entry type
   * @param {string} title - Entry title
   * @param {Object} data - Entry data
   * @returns {Object} Created entry
   */
  addEntry(type, title, data) {
    this.#requireUnlocked();
    const entry = createEntry(type, title, data);
    this.#vaultData.entries.push(entry);
    this.#markDirty();
    return entry;
  }

  /**
   * Update entry
   * @param {string} id - Entry ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated entry
   */
  updateEntry(id, updates) {
    this.#requireUnlocked();
    const index = this.#vaultData.entries.findIndex(e => e.id === id);
    if (index === -1) return null;

    const entry = this.#vaultData.entries[index];
    const updated = {
      ...entry,
      ...updates,
      id: entry.id, // Preserve ID
      createdAt: entry.createdAt, // Preserve creation date
      modifiedAt: new Date().toISOString()
    };

    this.#vaultData.entries[index] = updated;
    this.#markDirty();
    return updated;
  }

  /**
   * Delete entry
   * @param {string} id - Entry ID
   * @returns {boolean} Success
   */
  deleteEntry(id) {
    this.#requireUnlocked();
    const index = this.#vaultData.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.#vaultData.entries.splice(index, 1);
    this.#markDirty();
    return true;
  }

  // ==================== FOLDERS ====================

  /**
   * Get all folders
   * @returns {Array}
   */
  getFolders() {
    this.#requireUnlocked();
    return [...this.#vaultData.folders];
  }

  /**
   * Add folder
   * @param {string} name - Folder name
   * @param {string|null} parentId - Parent folder ID
   * @returns {Object} Created folder
   */
  addFolder(name, parentId = null) {
    this.#requireUnlocked();
    const folder = createFolder(name, parentId);
    this.#vaultData.folders.push(folder);
    this.#markDirty();
    return folder;
  }

  /**
   * Update folder
   * @param {string} id - Folder ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null}
   */
  updateFolder(id, updates) {
    this.#requireUnlocked();
    const index = this.#vaultData.folders.findIndex(f => f.id === id);
    if (index === -1) return null;

    const folder = this.#vaultData.folders[index];
    const updated = {
      ...folder,
      ...updates,
      id: folder.id,
      createdAt: folder.createdAt,
      modifiedAt: new Date().toISOString()
    };

    this.#vaultData.folders[index] = updated;
    this.#markDirty();
    return updated;
  }

  /**
   * Delete folder (and optionally its entries)
   * @param {string} id - Folder ID
   * @param {boolean} deleteEntries - Delete contained entries
   * @returns {boolean}
   */
  deleteFolder(id, deleteEntries = false) {
    this.#requireUnlocked();
    const index = this.#vaultData.folders.findIndex(f => f.id === id);
    if (index === -1) return false;

    if (deleteEntries) {
      this.#vaultData.entries = this.#vaultData.entries.filter(
        e => e.folderId !== id
      );
    } else {
      // Move entries to root
      this.#vaultData.entries.forEach(e => {
        if (e.folderId === id) e.folderId = null;
      });
    }

    // Move child folders to root
    this.#vaultData.folders.forEach(f => {
      if (f.parentId === id) f.parentId = null;
    });

    this.#vaultData.folders.splice(index, 1);
    this.#markDirty();
    return true;
  }

  // ==================== TAGS ====================

  /**
   * Get all tags
   * @returns {Array}
   */
  getTags() {
    this.#requireUnlocked();
    return [...this.#vaultData.tags];
  }

  /**
   * Add tag
   * @param {string} name - Tag name
   * @param {string} color - Tag color
   * @returns {Object}
   */
  addTag(name, color) {
    this.#requireUnlocked();
    const tag = createTag(name, color);
    this.#vaultData.tags.push(tag);
    this.#markDirty();
    return tag;
  }

  /**
   * Delete tag
   * @param {string} id - Tag ID
   * @returns {boolean}
   */
  deleteTag(id) {
    this.#requireUnlocked();
    const index = this.#vaultData.tags.findIndex(t => t.id === id);
    if (index === -1) return false;

    // Remove tag from entries
    this.#vaultData.entries.forEach(e => {
      e.tagIds = e.tagIds.filter(tid => tid !== id);
    });

    this.#vaultData.tags.splice(index, 1);
    this.#markDirty();
    return true;
  }

  /**
   * Update tag
   * @param {string} id - Tag ID
   * @param {Object} updates - Updates to apply (name, color)
   * @returns {Object|null}
   */
  updateTag(id, updates) {
    this.#requireUnlocked();
    const index = this.#vaultData.tags.findIndex(t => t.id === id);
    if (index === -1) return null;

    const tag = this.#vaultData.tags[index];
    const updated = {
      ...tag,
      ...updates,
      id: tag.id, // Preserve ID
      createdAt: tag.createdAt // Preserve creation date
    };

    this.#vaultData.tags[index] = updated;
    this.#markDirty();
    return updated;
  }

  // ==================== PRIVATE ====================

  /**
   * Ensure vault is unlocked
   * @private
   * @throws {Error}
   */
  #requireUnlocked() {
    if (!this.isUnlocked()) {
      throw new Error(t('errors.vault.locked'));
    }
    this.#resetAutoLockTimer();
  }

  /**
   * Mark vault as dirty (needs save)
   * @private
   */
  #markDirty() {
    this.#isDirty = true;
    this.emit('changed', { vaultId: this.#vaultId });

    // Auto-save after short delay (debounced)
    this.#scheduleSave();
  }

  /** @type {NodeJS.Timeout|null} */
  #saveTimer = null;

  /**
   * Schedule auto-save
   * @private
   */
  #scheduleSave() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => this.#save(), 2000);
  }

  /**
   * Save vault to disk
   * @private
   */
  async #save() {
    if (!this.isUnlocked() || !this.#isDirty) return;

    try {
      await this.#fileManager.saveVault(this.#vaultId, this.#vaultData, this.#key, this.#activeSlot);
      this.#isDirty = false;
    } catch (error) {
      this.emit('error', { type: 'save', message: sanitizeErrorMessage(error.message) });
    }
  }

  /**
   * Reset auto-lock timer
   * Emits 'autoLockWarning' event 30 seconds before locking
   * @private
   */
  #resetAutoLockTimer() {
    // Clear existing timers
    if (this.#autoLockTimer) {
      clearTimeout(this.#autoLockTimer);
      this.#autoLockTimer = null;
    }
    if (this.#autoLockWarningTimer) {
      clearTimeout(this.#autoLockWarningTimer);
      this.#autoLockWarningTimer = null;
    }

    if (this.#autoLockMs > 0) {
      // Set warning timer (30 seconds before lock)
      const warningDelay = Math.max(0, this.#autoLockMs - AUTO_LOCK_WARNING_MS);
      if (warningDelay > 0 && this.#autoLockMs > AUTO_LOCK_WARNING_MS) {
        this.#autoLockWarningTimer = setTimeout(() => {
          this.emit('autoLockWarning', { secondsRemaining: AUTO_LOCK_WARNING_MS / 1000 });
        }, warningDelay);
      }

      // Set lock timer
      this.#autoLockTimer = setTimeout(() => {
        this.lock();
      }, this.#autoLockMs);
    }
  }

  /**
   * Force save immediately
   * @returns {Promise<void>}
   */
  async forceSave() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    await this.#save();
  }

  /**
   * Set auto-lock timeout
   * @param {number} minutes - Minutes until auto-lock (0 to disable)
   */
  setAutoLockMinutes(minutes) {
    this.#autoLockMs = minutes * 60 * 1000;
    if (this.isUnlocked()) {
      this.#resetAutoLockTimer();
    }
  }

  // ==================== WINDOWS HELLO ====================

  /**
   * Get derived key for a vault (for Windows Hello enablement)
   * @param {string} vaultId - Vault ID
   * @param {string} password - Master password
   * @returns {Promise<Uint8Array|null>} The derived key or null if password incorrect
   */
  async getDerivedKey(vaultId, password) {
    try {
      const { key } = await this.#fileManager.openVault(vaultId, password);
      return key;
    } catch (error) {
      // Don't log error details - could contain sensitive path info
      return null;
    }
  }

  /**
   * Unlock vault with a pre-derived key (for Windows Hello unlock)
   * @param {string} vaultId - Vault ID
   * @param {Uint8Array} key - Pre-derived encryption key
   * @returns {Promise<void>}
   */
  async unlockWithKey(vaultId, key) {
    // Lock current vault if any
    if (this.isUnlocked()) {
      await this.lock();
    }

    try {
      const { vaultData } = await this.#fileManager.openVaultWithKey(vaultId, key);

      this.#vaultData = vaultData;
      this.#key = key;
      this.#vaultId = vaultId;
      this.#isDirty = false;

      // Set auto-lock timer
      this.#resetAutoLockTimer();

      // Configure auto-lock from vault settings
      if (vaultData.metadata?.settings?.autoLockMinutes) {
        this.#autoLockMs = vaultData.metadata.settings.autoLockMinutes * 60 * 1000;
      }

      this.emit('unlocked', { vaultId, name: vaultData.metadata.name });
    } catch (error) {
      this.emit('error', { type: 'unlock', message: sanitizeErrorMessage(error.message) });
      throw error;
    }
  }

  /**
   * Migrate to Duress Mode (V3)
   * @param {string} masterPassword 
   * @param {string} duressPassword 
   * @param {boolean} populateDecoy 
   */
  async enableDuressMode(masterPassword, duressPassword, populateDecoy) {
    if (!this.isUnlocked()) throw new Error(t('errors.vault.locked'));

    // Verify master password matches current key (sanity check)
    // Actually we are already unlocked, we trust the intent.

    await this.#fileManager.migrateToV3(
      this.#vaultId,
      this.#vaultData,
      masterPassword,
      duressPassword,
      populateDecoy
    );

    // Relock to force re-auth
    await this.lock();
  }

  /**
   * Stop auto-lock timer and warning timer
   * @private
   */
  #stopAutoLockTimer() {
    if (this.#autoLockTimer) {
      clearTimeout(this.#autoLockTimer);
      this.#autoLockTimer = null;
    }
    if (this.#autoLockWarningTimer) {
      clearTimeout(this.#autoLockWarningTimer);
      this.#autoLockWarningTimer = null;
    }
  }
  /**
   * Panic Nuking: Destroy the vault immediately
   * @param {string} confirmPassword - Confirmation (optional in extreme duress?)
   */
  async nuke() {
    if (!this.#vaultId) return;

    const vaultId = this.#vaultId;

    // 1. Lock immediately to clear memory
    await this.lock();

    // 2. Securely delete the file
    await this.#fileManager.deleteVault(vaultId);

    this.emit('nuked', { vaultId });
  }
}

// Export singleton
export const vaultSession = new VaultSessionManager();
export default vaultSession;
