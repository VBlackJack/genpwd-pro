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

/**
 * Vault File Manager - handles all file operations
 */
export class VaultFileManager {
  /** @type {CryptoEngine} */
  #crypto;

  /** @type {string} */
  #vaultsDir;

  constructor() {
    this.#crypto = new CryptoEngine();
    this.#vaultsDir = this.#getVaultsDirectory();
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
   * @returns {Promise<{vaultId: string, vaultPath: string}>}
   */
  async createVault(name, password) {
    await this.ensureDirectory();

    // Create vault data
    const vaultData = createEmptyVault(name);
    const vaultId = vaultData.metadata.id;

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
    const vaultPath = this.getVaultPath(vaultId);
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');

    // Wipe key from memory
    this.#crypto.wipeKey(key);

    return { vaultId, vaultPath };
  }

  /**
   * Open existing vault (read and decrypt)
   * @param {string} vaultId - Vault ID
   * @param {string} password - Master password
   * @returns {Promise<{vaultData: Object, key: Uint8Array}>}
   * @throws {Error} If vault not found or password invalid
   */
  async openVault(vaultId, password) {
    const vaultPath = this.getVaultPath(vaultId);

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
    const vaultPath = this.getVaultPath(vaultId);
    const backupPath = this.getBackupPath(vaultId);

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
   * List all vaults
   * @returns {Promise<Array<{id: string, name: string, modifiedAt: string}>>}
   */
  async listVaults() {
    await this.ensureDirectory();

    const files = await fs.readdir(this.#vaultsDir);
    const vaults = [];

    for (const file of files) {
      if (!file.endsWith(VAULT_EXTENSION)) continue;

      try {
        const filePath = path.join(this.#vaultsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const vaultFile = JSON.parse(content);

        // Decrypt just the metadata name (we can't without key)
        // For listing, we use the vault ID and file stats
        const stats = await fs.stat(filePath);

        vaults.push({
          id: vaultFile.header.vaultId,
          name: vaultFile.header.vaultId.substring(0, 8), // Placeholder
          modifiedAt: stats.mtime.toISOString(),
          version: vaultFile.header.version
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
      await fs.access(this.getVaultPath(vaultId));
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

    // Read current file for structure
    const vaultPath = this.getVaultPath(vaultId);
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);

    // Backup current file
    await fs.copyFile(vaultPath, this.getBackupPath(vaultId));

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
}

// Export singleton
export const vaultFileManager = new VaultFileManager();
export default vaultFileManager;
