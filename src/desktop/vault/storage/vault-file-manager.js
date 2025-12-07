/**
 * @fileoverview Vault File Manager
 * Handles reading/writing encrypted vault files (.gpd)
 *
 * File Format (.gpd):
 * {
 *   "header": {
 *     "version": "1.0.0",
 *     "vaultId": "uuid",
 *     "keyData": { salt, verifier, kdfParams, algorithm }
 *   },
 *   "encryptedData": { nonce, ciphertext, algorithm }
 * }
 *
 * Note: This module runs in Electron's main process
 */

import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { CryptoEngine } from '../crypto/crypto-engine.js';
import { createEmptyVault, VAULT_FORMAT_VERSION } from '../models/vault-types.js';

const VAULT_EXTENSION = '.gpd';
const BACKUP_EXTENSION = '.gpd.bak';
const REGISTRY_FILE = 'vault-registry.json';

/**
 * Vault File Manager - handles all file operations
 */
export class VaultFileManager {
  /** @type {CryptoEngine} */
  #crypto;

  /** @type {string} */
  #vaultsDir;

  /** @type {string} */
  #registryPath;

  /** @type {Map<string, {path: string, name: string, isExternal: boolean}>} */
  #vaultRegistry = new Map();

  constructor() {
    this.#crypto = new CryptoEngine();
    this.#vaultsDir = this.#getVaultsDirectory();
    this.#registryPath = path.join(app.getPath('userData'), REGISTRY_FILE);
    this.#loadRegistry();
  }

  /**
   * Load vault registry from disk
   * @private
   */
  async #loadRegistry() {
    try {
      const content = await fs.readFile(this.#registryPath, 'utf-8');
      const data = JSON.parse(content);
      this.#vaultRegistry = new Map(Object.entries(data.vaults || {}));
    } catch {
      // Registry doesn't exist yet, that's OK
      this.#vaultRegistry = new Map();
    }
  }

  /**
   * Save vault registry to disk
   * @private
   */
  async #saveRegistry() {
    const data = {
      version: '1.0',
      vaults: Object.fromEntries(this.#vaultRegistry)
    };
    await fs.writeFile(this.#registryPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Register a vault in the registry
   * @param {string} vaultId - Vault ID
   * @param {string} vaultPath - Full path to vault file
   * @param {string} name - Vault name
   * @param {boolean} isExternal - True if stored outside default directory
   */
  async registerVault(vaultId, vaultPath, name, isExternal = false) {
    this.#vaultRegistry.set(vaultId, { path: vaultPath, name, isExternal });
    await this.#saveRegistry();
  }

  /**
   * Unregister a vault from the registry
   * @param {string} vaultId - Vault ID
   */
  async unregisterVault(vaultId) {
    this.#vaultRegistry.delete(vaultId);
    await this.#saveRegistry();
  }

  /**
   * Get vault path from registry
   * @param {string} vaultId - Vault ID
   * @returns {string|null} Vault path or null if not found
   */
  getRegisteredVaultPath(vaultId) {
    const entry = this.#vaultRegistry.get(vaultId);
    if (entry) return entry.path;
    // Fallback to default location
    return this.getVaultPath(vaultId);
  }

  /**
   * Get the vaults directory path
   * @private
   * @returns {string} Vaults directory path
   */
  #getVaultsDirectory() {
    const userData = app.getPath('userData');
    return path.join(userData, 'vaults');
  }

  /**
   * Ensure vaults directory exists
   * @returns {Promise<void>}
   */
  async ensureDirectory() {
    await fs.mkdir(this.#vaultsDir, { recursive: true });
  }

  /**
   * Get vault file path
   * @param {string} vaultId - Vault ID
   * @returns {string} Full file path
   */
  getVaultPath(vaultId) {
    return path.join(this.#vaultsDir, `${vaultId}${VAULT_EXTENSION}`);
  }

  /**
   * Get backup file path
   * @param {string} vaultId - Vault ID
   * @returns {string} Backup file path
   */
  getBackupPath(vaultId) {
    return path.join(this.#vaultsDir, `${vaultId}${BACKUP_EXTENSION}`);
  }

  /**
   * Create a new vault
   * @param {string} name - Vault name
   * @param {string} password - Master password
   * @param {string} [customPath] - Custom file path (for external vaults)
   * @returns {Promise<{vaultId: string, vaultPath: string}>}
   */
  async createVault(name, password, customPath = null) {
    // Create vault data
    const vaultData = createEmptyVault(name);
    const vaultId = vaultData.metadata.id;

    // Determine file path
    let vaultPath;
    let isExternal = false;

    if (customPath) {
      // External vault - use provided path
      vaultPath = customPath.endsWith(VAULT_EXTENSION)
        ? customPath
        : `${customPath}${VAULT_EXTENSION}`;
      isExternal = true;
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(vaultPath), { recursive: true });
    } else {
      // Default location
      await this.ensureDirectory();
      vaultPath = this.getVaultPath(vaultId);
    }

    // Create encryption key
    const { key, keyData } = await this.#crypto.createVaultKey(password);

    // Encrypt vault data
    const encryptedData = this.#crypto.encrypt(vaultData, key);

    // Create file structure
    const vaultFile = {
      header: {
        version: VAULT_FORMAT_VERSION,
        vaultId,
        keyData
      },
      encryptedData
    };

    // Write to file
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');

    // Register in vault registry
    await this.registerVault(vaultId, vaultPath, name, isExternal);

    // Wipe key from memory
    this.#crypto.wipeKey(key);

    return { vaultId, vaultPath };
  }

  /**
   * Open vault from any file path (for external vaults)
   * @param {string} vaultPath - Full path to vault file
   * @param {string} password - Master password
   * @returns {Promise<{vaultData: Object, key: Uint8Array, vaultId: string}>}
   */
  async openVaultFromPath(vaultPath, password) {
    // Read file
    let fileContent;
    try {
      fileContent = await fs.readFile(vaultPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Vault file not found: ${vaultPath}`);
      }
      throw error;
    }

    // Parse vault file
    const vaultFile = JSON.parse(fileContent);

    // Validate it's a valid vault file
    if (!vaultFile.header?.vaultId || !vaultFile.encryptedData) {
      throw new Error('Invalid vault file format');
    }

    const vaultId = vaultFile.header.vaultId;

    // Verify password and get key
    const { valid, key } = await this.#crypto.verifyPassword(
      password,
      vaultFile.header.keyData
    );

    if (!valid || !key) {
      throw new Error('Invalid password');
    }

    // Decrypt vault data
    const vaultData = this.#crypto.decrypt(vaultFile.encryptedData, key);

    // Register this vault if not already registered
    const existingPath = this.#vaultRegistry.get(vaultId);
    if (!existingPath) {
      const isExternal = !vaultPath.startsWith(this.#vaultsDir);
      await this.registerVault(vaultId, vaultPath, vaultData.metadata?.name || vaultId, isExternal);
    }

    return { vaultData, key, vaultId };
  }

  /**
   * Read vault metadata without decrypting (for vault list)
   * @param {string} vaultPath - Full path to vault file
   * @returns {Promise<{vaultId: string, version: string, modifiedAt: string, hasHello: boolean}|null>}
   */
  async readVaultMetadata(vaultPath) {
    try {
      const content = await fs.readFile(vaultPath, 'utf-8');
      const vaultFile = JSON.parse(content);
      const stats = await fs.stat(vaultPath);

      return {
        vaultId: vaultFile.header.vaultId,
        version: vaultFile.header.version,
        modifiedAt: stats.mtime.toISOString(),
        hasHello: vaultFile.header.windowsHello?.enabled === true
      };
    } catch (error) {
      console.error(`[VaultFileManager] Error reading metadata: ${error.message}`);
      return null;
    }
  }

  /**
   * Open existing vault (read and decrypt)
   * @param {string} vaultId - Vault ID
   * @param {string} password - Master password
   * @returns {Promise<{vaultData: Object, key: Uint8Array}>}
   * @throws {Error} If vault not found or password invalid
   */
  async openVault(vaultId, password) {
    // Use registered path (supports external vaults)
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read file
    let fileContent;
    try {
      fileContent = await fs.readFile(vaultPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Vault not found: ${vaultId}`);
      }
      throw error;
    }

    // Parse vault file
    const vaultFile = JSON.parse(fileContent);

    // Verify password and get key
    const { valid, key } = await this.#crypto.verifyPassword(
      password,
      vaultFile.header.keyData
    );

    if (!valid || !key) {
      throw new Error('Invalid password');
    }

    // Decrypt vault data
    const vaultData = this.#crypto.decrypt(vaultFile.encryptedData, key);

    return { vaultData, key };
  }

  /**
   * Save vault data
   * @param {string} vaultId - Vault ID
   * @param {Object} vaultData - Vault data to save
   * @param {Uint8Array} key - Encryption key
   * @returns {Promise<void>}
   */
  async saveVault(vaultId, vaultData, key) {
    // Use registered path (supports external vaults)
    const vaultPath = this.getRegisteredVaultPath(vaultId);
    const backupPath = `${vaultPath}.bak`;

    // Read existing file for header
    const existingContent = await fs.readFile(vaultPath, 'utf-8');
    const existingFile = JSON.parse(existingContent);

    // Create backup before saving
    try {
      await fs.copyFile(vaultPath, backupPath);
    } catch {
      // Ignore backup errors
    }

    // Update metadata
    vaultData.metadata.modifiedAt = new Date().toISOString();
    vaultData.metadata.entryCount = vaultData.entries?.length || 0;

    // Encrypt new data
    const encryptedData = this.#crypto.encrypt(vaultData, key);

    // Create updated file
    const updatedFile = {
      header: existingFile.header,
      encryptedData
    };

    // Atomic write (write to temp, then rename)
    const tempPath = `${vaultPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(updatedFile, null, 2), 'utf-8');
    await fs.rename(tempPath, vaultPath);
  }

  /**
   * Delete vault
   * @param {string} vaultId - Vault ID
   * @returns {Promise<void>}
   */
  async deleteVault(vaultId) {
    const vaultPath = this.getVaultPath(vaultId);
    const backupPath = this.getBackupPath(vaultId);

    try {
      await fs.unlink(vaultPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fs.unlink(backupPath);
    } catch {
      // Ignore missing backup
    }
  }

  /**
   * List all vaults (local + external from registry)
   * @returns {Promise<Array<{id: string, name: string, path: string, modifiedAt: string, isExternal: boolean}>>}
   */
  async listVaults() {
    await this.ensureDirectory();

    const vaults = [];
    const seenIds = new Set();

    // First, add vaults from registry (includes external vaults)
    for (const [vaultId, entry] of this.#vaultRegistry) {
      try {
        const stats = await fs.stat(entry.path);
        const content = await fs.readFile(entry.path, 'utf-8');
        const vaultFile = JSON.parse(content);

        vaults.push({
          id: vaultId,
          name: entry.name || vaultId.substring(0, 8),
          path: entry.path,
          modifiedAt: stats.mtime.toISOString(),
          version: vaultFile.header.version,
          isExternal: entry.isExternal || false,
          hasHello: vaultFile.header.windowsHello?.enabled === true
        });
        seenIds.add(vaultId);
      } catch (error) {
        // Vault file may have been moved/deleted - keep in registry but mark as missing
        console.warn(`[VaultFileManager] Registry vault not accessible: ${entry.path}`);
        vaults.push({
          id: vaultId,
          name: entry.name || vaultId.substring(0, 8),
          path: entry.path,
          modifiedAt: null,
          isExternal: entry.isExternal || false,
          isMissing: true
        });
        seenIds.add(vaultId);
      }
    }

    // Then scan default directory for any unregistered vaults
    const files = await fs.readdir(this.#vaultsDir);

    for (const file of files) {
      if (!file.endsWith(VAULT_EXTENSION)) continue;

      try {
        const filePath = path.join(this.#vaultsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const vaultFile = JSON.parse(content);
        const vaultId = vaultFile.header.vaultId;

        // Skip if already in registry
        if (seenIds.has(vaultId)) continue;

        const stats = await fs.stat(filePath);

        // Auto-register this vault
        await this.registerVault(vaultId, filePath, vaultId.substring(0, 8), false);

        vaults.push({
          id: vaultId,
          name: vaultId.substring(0, 8),
          path: filePath,
          modifiedAt: stats.mtime.toISOString(),
          version: vaultFile.header.version,
          isExternal: false,
          hasHello: vaultFile.header.windowsHello?.enabled === true
        });
      } catch (error) {
        console.error(`Error reading vault file ${file}:`, error.message);
      }
    }

    return vaults;
  }

  /**
   * Check if vault exists
   * @param {string} vaultId - Vault ID
   * @returns {Promise<boolean>}
   */
  async vaultExists(vaultId) {
    try {
      await fs.access(this.getRegisteredVaultPath(vaultId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Change vault password
   * @param {string} vaultId - Vault ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(vaultId, currentPassword, newPassword) {
    // Open with current password
    const { vaultData, key: oldKey } = await this.openVault(vaultId, currentPassword);

    // Create new key
    const { key: newKey, keyData } = await this.#crypto.createVaultKey(newPassword);

    // Read current file for structure (use registered path for external vaults)
    const vaultPath = this.getRegisteredVaultPath(vaultId);
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);

    // Backup current file
    await fs.copyFile(vaultPath, `${vaultPath}.bak`);

    // Update with new encryption
    const encryptedData = this.#crypto.encrypt(vaultData, newKey);

    const updatedFile = {
      header: {
        ...vaultFile.header,
        keyData
      },
      encryptedData
    };

    // Save
    await fs.writeFile(vaultPath, JSON.stringify(updatedFile, null, 2), 'utf-8');

    // Wipe keys
    this.#crypto.wipeKey(oldKey);
    this.#crypto.wipeKey(newKey);
  }

  /**
   * Export vault to JSON (decrypted)
   * @param {string} vaultId - Vault ID
   * @param {string} password - Master password
   * @param {string} exportPath - Export file path
   * @returns {Promise<void>}
   */
  async exportVault(vaultId, password, exportPath) {
    const { vaultData, key } = await this.openVault(vaultId, password);
    await fs.writeFile(exportPath, JSON.stringify(vaultData, null, 2), 'utf-8');
    this.#crypto.wipeKey(key);
  }

  /**
   * Import vault from JSON
   * @param {string} importPath - Import file path
   * @param {string} password - New master password
   * @returns {Promise<{vaultId: string}>}
   */
  async importVault(importPath, password) {
    const content = await fs.readFile(importPath, 'utf-8');
    const vaultData = JSON.parse(content);

    // Validate structure
    if (!vaultData.metadata || !vaultData.entries) {
      throw new Error('Invalid vault export format');
    }

    // Create new vault with imported data
    await this.ensureDirectory();

    const vaultId = vaultData.metadata.id || crypto.randomUUID();
    vaultData.metadata.id = vaultId;

    // Create encryption key
    const { key, keyData } = await this.#crypto.createVaultKey(password);

    // Encrypt vault data
    const encryptedData = this.#crypto.encrypt(vaultData, key);

    // Create file
    const vaultFile = {
      header: {
        version: VAULT_FORMAT_VERSION,
        vaultId,
        keyData
      },
      encryptedData
    };

    const vaultPath = this.getVaultPath(vaultId);
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');

    this.#crypto.wipeKey(key);

    return { vaultId };
  }

  // ==================== WINDOWS HELLO ====================

  /**
   * Open vault with a pre-derived key (for Windows Hello)
   * @param {string} vaultId - Vault ID
   * @param {Uint8Array} key - Pre-derived encryption key
   * @returns {Promise<{vaultData: Object}>}
   */
  async openVaultWithKey(vaultId, key) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read file
    let fileContent;
    try {
      fileContent = await fs.readFile(vaultPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Vault not found: ${vaultId}`);
      }
      throw error;
    }

    // Parse vault file
    const vaultFile = JSON.parse(fileContent);

    // Decrypt vault data with provided key
    const vaultData = this.#crypto.decrypt(vaultFile.encryptedData, key);

    return { vaultData };
  }

  /**
   * Store Windows Hello encrypted key in vault header
   * @param {string} vaultId - Vault ID
   * @param {string} encryptedKey - Base64 encoded encrypted vault key
   * @returns {Promise<void>}
   */
  async setVaultHelloKey(vaultId, encryptedKey) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read current file
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);

    // Add Windows Hello key to header
    vaultFile.header.windowsHello = {
      enabled: true,
      encryptedKey,
      enabledAt: new Date().toISOString()
    };

    // Save back
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');
  }

  /**
   * Remove Windows Hello data from vault header
   * @param {string} vaultId - Vault ID
   * @returns {Promise<void>}
   */
  async removeVaultHelloKey(vaultId) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read current file
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);

    // Remove Windows Hello data from header
    delete vaultFile.header.windowsHello;

    // Save back
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');
  }

  /**
   * Get Windows Hello encrypted key from vault header
   * @param {string} vaultId - Vault ID
   * @returns {Promise<string|null>} Encrypted key or null if not enabled
   */
  async getVaultHelloKey(vaultId) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    try {
      const content = await fs.readFile(vaultPath, 'utf-8');
      const vaultFile = JSON.parse(content);

      if (vaultFile.header.windowsHello?.enabled) {
        return vaultFile.header.windowsHello.encryptedKey || null;
      }
      return null;
    } catch (error) {
      console.error('[VaultFileManager] Error reading Hello key:', error.message);
      return null;
    }
  }

  /**
   * Check if Windows Hello is enabled for a vault
   * @param {string} vaultId - Vault ID
   * @returns {Promise<boolean>}
   */
  async isHelloEnabled(vaultId) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    try {
      const content = await fs.readFile(vaultPath, 'utf-8');
      const vaultFile = JSON.parse(content);
      return vaultFile.header.windowsHello?.enabled === true;
    } catch {
      return false;
    }
  }
}

// Export singleton
export const vaultFileManager = new VaultFileManager();
export default vaultFileManager;
