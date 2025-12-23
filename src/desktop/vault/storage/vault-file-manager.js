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

import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { CryptoEngine } from '../crypto/crypto-engine.js';
import { DuressManager } from '../crypto/duress-manager.js';
import { CloudSyncManager } from '../sync/cloud-sync-manager.js';
import { createEmptyVault, VAULT_FORMAT_VERSION, LEGACY_FORMAT_VERSION } from '../models/vault-types.js';

const VAULT_EXTENSION = '.gpd';
const BACKUP_EXTENSION = '.gpd.bak';
const REGISTRY_FILE = 'vault-registry.json';

/**
 * Vault File Manager - handles all file operations
 */
export class VaultFileManager extends EventEmitter {
  /** @type {CryptoEngine} */
  #crypto;

  /** @type {CloudSyncManager} */
  #cloudSync;

  /** @type {string} */
  #vaultsDir;

  /** @type {string} */
  #registryPath;

  /** @type {Map<string, {path: string, name: string, isExternal: boolean}>} */
  #vaultRegistry = new Map();

  constructor() {
    super();
    this.#crypto = new CryptoEngine();
    this.#cloudSync = new CloudSyncManager();
    this.#vaultsDir = this.#getVaultsDirectory();
    this.#registryPath = path.join(app.getPath('userData'), REGISTRY_FILE);
    this.#loadRegistry();

    this.#cloudSync.on('status', (data) => {
      this.emit('sync:status', data);
    });
  }

  /**
   * Get the cloud sync manager
   * @returns {CloudSyncManager}
   */
  getCloudManager() {
    return this.#cloudSync;
  }

  /**
   * Configure Cloud Sync
   * @param {Object} config 
   */
  setCloudConfig(config) {
    this.#cloudSync.setConfig(config);
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
  /**
   * Create a new vault (V3 Dual-Slot Format)
   * @param {string} name - Vault name
   * @param {string} password - Master password
   * @param {string} [customPath] - Custom file path (for external vaults)
   * @returns {Promise<{vaultId: string, vaultPath: string}>}
   */
  async createVault(name, password, customPath = null) {
    // Create real vault data (Slot A)
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
      await fs.mkdir(path.dirname(vaultPath), { recursive: true });
    } else {
      await this.ensureDirectory();
      vaultPath = this.getVaultPath(vaultId);
    }

    // --- SLOT A: REAL VAULT ---
    const slotA = await this.#crypto.createVaultKey(password);
    const encryptedPayloadA = this.#crypto.encrypt(vaultData, slotA.key);

    // --- SLOT B: DECOY VAULT (CHAFF) ---
    // Generate a random high-entropy key for the decoy slot initially
    // The user hasn't set a duress password yet, so this slot is inaccessible but cryptographically valid
    const randomDuressPassword = crypto.randomUUID() + crypto.randomUUID();
    const slotB = await this.#crypto.createVaultKey(randomDuressPassword);

    // Generate Chaff that matches the size of true data to mask existence
    const chaffSize = Buffer.from(encryptedPayloadA.ciphertext, 'base64').length;
    // Add some random variance to size (+/- 10%) so they aren't identical byte-sized
    const variance = Math.floor(chaffSize * 0.1 * (Math.random() - 0.5));
    const chaffData = DuressManager.generateChaff(chaffSize + variance);

    // We treat the chaff as "encrypted data" structure
    const encryptedPayloadB = {
      nonce: DuressManager.generateChaff(12).toString('base64'), // Fake nonce
      ciphertext: chaffData.toString('base64'),
      algorithm: 'AES-GCM'
    };

    // Create V3 File Structure
    const vaultFile = {
      version: '3.0.0', // V3
      slots: [
        {
          salt: slotA.keyData.salt,
          iv: slotA.keyData.iv, // Using IV field for clarity, though typically KDF uses salt. Adjust if keyData has different structure.
          iterations: slotA.keyData.kdfParams ? slotA.keyData.kdfParams.iterations : 600000,
          encryptedKey: slotA.keyData.encryptedKey || '', // If using wrapped keys (Tink)
          // Store full keyData blob for flexibility
          keyData: slotA.keyData
        },
        {
          // Store keyData for Slot B
          keyData: slotB.keyData
        }
      ],
      payloads: [
        JSON.stringify(encryptedPayloadA),
        JSON.stringify(encryptedPayloadB)
      ]
    };

    // Write to file
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');

    // Register in vault registry
    await this.registerVault(vaultId, vaultPath, name, isExternal);

    // Wipe keys from memory
    this.#crypto.wipeKey(slotA.key);
    this.#crypto.wipeKey(slotB.key);

    return { vaultId, vaultPath };
  }

  /**
   * Open vault from any file path (for external vaults)
   * @param {string} vaultPath - Full path to vault file
   * @param {string} password - Master password
   * @returns {Promise<{vaultData: Object, key: Uint8Array, vaultId: string, activeSlot: number}>}
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
    let vaultFile;
    try {
      vaultFile = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(`Invalid vault file: JSON parse error - ${parseError.message}`);
    }

    // Detect format version
    const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

    // Log detected structure for debugging
    console.log('[VaultFileManager] Opening vault:', {
      path: vaultPath,
      detectedVersion: version,
      hasSlots: !!vaultFile.slots,
      hasPayloads: !!vaultFile.payloads,
      hasHeader: !!vaultFile.header,
      hasEncryptedData: !!vaultFile.encryptedData,
      topLevelKeys: Object.keys(vaultFile)
    });

    // --- V3 IMPLEMENTATION (DUAL SLOT) ---
    if (version === VAULT_FORMAT_VERSION) {
      // Validate V3 structure
      if (!vaultFile.slots || !vaultFile.payloads || vaultFile.slots.length < 2) {
        const issues = [];
        if (!vaultFile.slots) issues.push('missing slots array');
        else if (vaultFile.slots.length < 2) issues.push(`slots has ${vaultFile.slots.length} items (need 2)`);
        if (!vaultFile.payloads) issues.push('missing payloads array');
        throw new Error(`Invalid vault file format (V3): ${issues.join(', ')}`);
      }

      let activeSlot = -1;
      let derivedKey = null;

      // Try unlocking Slot 0 (Real)
      try {
        const { valid, key } = await this.#crypto.verifyPassword(password, vaultFile.slots[0].keyData);
        if (valid) {
          try {
            const payloadA = JSON.parse(vaultFile.payloads[0]);
            this.#crypto.decrypt(payloadA, key); // Check only
            activeSlot = 0;
            derivedKey = key;
          } catch (e) {
            console.warn('[VaultFileManager] Slot 0 payload decryption failed:', e.message);
          }
        }
      } catch (e) {
        console.warn('[VaultFileManager] Slot 0 KDF verification failed:', e.message);
      }

      // If Slot 0 failed, try Slot 1 (Decoy)
      if (activeSlot === -1) {
        try {
          const { valid, key } = await this.#crypto.verifyPassword(password, vaultFile.slots[1].keyData);
          if (valid) {
            try {
              const payloadB = JSON.parse(vaultFile.payloads[1]);
              this.#crypto.decrypt(payloadB, key);
              activeSlot = 1;
              derivedKey = key;
            } catch (e) {
              console.debug('[VaultFileManager] Slot 1 payload decryption failed (expected for chaff):', e.message);
            }
          }
        } catch (e) {
          console.warn('[VaultFileManager] Slot 1 KDF verification failed:', e.message);
        }
      }

      if (activeSlot === -1 || !derivedKey) {
        throw new Error('Invalid password');
      }

      // Decrypt data from Active Slot
      const encryptedPayload = JSON.parse(vaultFile.payloads[activeSlot]);
      const vaultData = this.#crypto.decrypt(encryptedPayload, derivedKey);

      // Get vaultId from decrypted metadata
      const vaultId = vaultData.metadata?.id;
      if (!vaultId) {
        throw new Error('Invalid vault data: missing metadata.id');
      }

      // Register this vault if not already registered
      const existingPath = this.#vaultRegistry.get(vaultId);
      if (!existingPath) {
        const isExternal = !vaultPath.startsWith(this.#vaultsDir);
        await this.registerVault(vaultId, vaultPath, vaultData.metadata?.name || vaultId, isExternal);
      }

      return { vaultData, key: derivedKey, vaultId, activeSlot };
    }

    // --- LEGACY V1 IMPLEMENTATION ---
    // Validate legacy structure
    if (!vaultFile.header?.vaultId || !vaultFile.encryptedData) {
      const missing = [];
      if (!vaultFile.header) missing.push('header');
      else if (!vaultFile.header.vaultId) missing.push('header.vaultId');
      if (!vaultFile.encryptedData) missing.push('encryptedData');
      throw new Error(`Invalid vault file format: missing ${missing.join(', ')}. File keys: [${Object.keys(vaultFile).join(', ')}]`);
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

    return { vaultData, key, vaultId, activeSlot: 0 };
  }

  /**
   * Read vault metadata without decrypting (for vault list)
   * @param {string} vaultPath - Full path to vault file
   * @returns {Promise<{vaultId: string|null, version: string, modifiedAt: string, hasHello: boolean}|null>}
   */
  async readVaultMetadata(vaultPath) {
    try {
      const content = await fs.readFile(vaultPath, 'utf-8');
      const vaultFile = JSON.parse(content);
      const stats = await fs.stat(vaultPath);
      const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

      // V3 format - vaultId is in encrypted metadata, not available without decryption
      if (version === VAULT_FORMAT_VERSION) {
        return {
          vaultId: null, // Not available in V3 without decryption
          version,
          modifiedAt: stats.mtime.toISOString(),
          hasHello: false // V3 stores Hello differently, check slots
        };
      }

      // Legacy format
      return {
        vaultId: vaultFile.header?.vaultId || null,
        version: vaultFile.header?.version || LEGACY_FORMAT_VERSION,
        modifiedAt: stats.mtime.toISOString(),
        hasHello: vaultFile.header?.windowsHello?.enabled === true
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
    console.log('[VaultFileManager] openVault called for:', vaultId);

    // Use registered path (supports external vaults)
    const vaultPath = this.getRegisteredVaultPath(vaultId);
    console.log('[VaultFileManager] Vault path:', vaultPath);

    // Read file
    let fileContent;
    try {
      fileContent = await fs.readFile(vaultPath, 'utf-8');
      console.log('[VaultFileManager] File read successfully, size:', fileContent.length);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Vault not found: ${vaultId}`);
      }
      throw error;
    }

    // Parse vault file
    const vaultFile = JSON.parse(fileContent);
    const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;
    console.log('[VaultFileManager] Detected version:', version, 'Keys:', Object.keys(vaultFile));

    // --- V3 IMPLEMENTATION (DUAL SLOT) ---
    if (version === VAULT_FORMAT_VERSION) {
      console.log('[VaultFileManager] Using V3 dual-slot implementation');
      let activeSlot = -1;
      let derivedKey = null;

      // Check slot structure
      if (!vaultFile.slots?.[0]?.keyData) {
        console.error('[VaultFileManager] V3 slots[0].keyData missing!');
        throw new Error('Invalid vault structure: missing slots[0].keyData');
      }

      // Try unlocking Slot 0 (Real)
      console.log('[VaultFileManager] Attempting Slot 0 unlock...');
      try {
        const { valid, key } = await this.#crypto.verifyPassword(password, vaultFile.slots[0].keyData);
        console.log('[VaultFileManager] Slot 0 password valid:', valid);
        if (valid) {
          // Check if payload decrypts (integrity check)
          try {
            const payloadA = JSON.parse(vaultFile.payloads[0]);
            this.#crypto.decrypt(payloadA, key); // Check only
            activeSlot = 0;
            derivedKey = key;
            console.log('[VaultFileManager] Slot 0 decryption successful');
          } catch (e) {
            // Password correct for KDF, but payload fail? Unlikely unless corrupted.
            // Or maybe we unlocked Slot 1 by accident if salts are reused (bad).
            console.warn('[VaultFileManager] Slot 0 payload decryption failed:', e.message);
          }
        }
      } catch (e) {
        console.warn('[VaultFileManager] Slot 0 KDF verification failed:', e.message);
      }

      // If Slot 0 failed, try Slot 1 (Decoy)
      if (activeSlot === -1) {
        console.log('[VaultFileManager] Attempting Slot 1 unlock...');
        try {
          const { valid, key } = await this.#crypto.verifyPassword(password, vaultFile.slots[1].keyData);
          console.log('[VaultFileManager] Slot 1 password valid:', valid);
          if (valid) {
            try {
              const payloadB = JSON.parse(vaultFile.payloads[1]);
              // If this slot is Chaff, decrypt will fail randomness check (Tink/AES-GCM auth tag).
              // BUT, if user set a duress password, we overwrote Chaff with valid vault.
              this.#crypto.decrypt(payloadB, key);
              activeSlot = 1;
              derivedKey = key;
              console.log('[VaultFileManager] Slot 1 decryption successful');
            } catch (e) {
              // Decrypt failed. If this is Chaff, this is EXPECTED.
              // It means password matched KDF but Auth Tag rejected the random noise.
              console.debug('[VaultFileManager] Slot 1 payload decryption failed (expected for chaff):', e.message);
            }
          }
        } catch (e) {
          console.warn('[VaultFileManager] Slot 1 KDF verification failed:', e.message);
        }
      }

      if (activeSlot === -1 || !derivedKey) {
        console.log('[VaultFileManager] Both slots failed, invalid password');
        throw new Error('Invalid password');
      }

      // Decrypt data from Active Slot
      const encryptedPayload = JSON.parse(vaultFile.payloads[activeSlot]);
      const vaultData = this.#crypto.decrypt(encryptedPayload, derivedKey);

      return { vaultData, key: derivedKey, activeSlot };
    }

    // --- LEGACY V1 IMPLEMENTATION ---
    const { valid, key } = await this.#crypto.verifyPassword(
      password,
      vaultFile.header.keyData
    );

    if (!valid || !key) {
      throw new Error('Invalid password');
    }

    // Decrypt vault data
    const vaultData = this.#crypto.decrypt(vaultFile.encryptedData, key);

    return { vaultData, key, activeSlot: 0 }; // Legacy is always Slot 0
  }

  /**
   * Save vault data
   * @param {string} vaultId - Vault ID
   * @param {Object} vaultData - Vault data to save
   * @param {Uint8Array} key - Encryption key
   * @param {number} [activeSlot=0] - Active slot index (0=Real, 1=Decoy)
   * @returns {Promise<void>}
   */
  async saveVault(vaultId, vaultData, key, activeSlot = 0) {
    // Use registered path (supports external vaults)
    const vaultPath = this.getRegisteredVaultPath(vaultId);
    const backupPath = `${vaultPath}.bak`;

    // Read existing file to preserve other slots
    const existingContent = await fs.readFile(vaultPath, 'utf-8');
    const existingFile = JSON.parse(existingContent);
    const version = existingFile.version || existingFile.header?.version || LEGACY_FORMAT_VERSION;

    // Create backup before saving
    try {
      await fs.copyFile(vaultPath, backupPath);
    } catch { /* Ignore */ }

    // Update metadata
    vaultData.metadata.modifiedAt = new Date().toISOString();
    vaultData.metadata.entryCount = vaultData.entries?.length || 0;

    // Encrypt new data
    const encryptedData = this.#crypto.encrypt(vaultData, key);

    let updatedFile;

    // --- V3 IMPLEMENTATION ---
    if (version === VAULT_FORMAT_VERSION) {
      // Preserve existing structure
      updatedFile = { ...existingFile };

      // Update ONLY the active payload/slot
      updatedFile.payloads[activeSlot] = JSON.stringify(encryptedData);
    }
    // --- LEGACY IMPLEMENTATION ---
    else {
      updatedFile = {
        header: existingFile.header,
        encryptedData
      };
    }

    // Atomic write
    const tempPath = `${vaultPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(updatedFile, null, 2), 'utf-8');
    await fs.rename(tempPath, vaultPath);

    // Trigger Auto-Sync
    // We don't await this to avoid blocking UI response
    this.#cloudSync.uploadVault(vaultPath, vaultId).catch(err => {
      console.error('[VaultFileManager] Auto-sync failed:', err);
    });
  }

  /**
   * Securely delete vault (Panic Mode)
   * Overwrites file content before deletion
   * @param {string} vaultId - Vault ID
   * @returns {Promise<void>}
   */
  async deleteVault(vaultId) {
    const vaultPath = this.getVaultPath(vaultId);
    const backupPath = this.getBackupPath(vaultId);

    // Helper to securely wipe a file
    const secureWipe = async (filePath) => {
      try {
        const stats = await fs.stat(filePath);
        const size = stats.size;

        // Pass 1: Random data
        const buffer = Buffer.alloc(size);
        crypto.randomFillSync(buffer);
        await fs.writeFile(filePath, buffer);

        // Pass 2: Zeros
        buffer.fill(0);
        await fs.writeFile(filePath, buffer);

        // Pass 3: Ones
        buffer.fill(255);
        await fs.writeFile(filePath, buffer);

        // Finally delete
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error(`Failed to securely wipe ${filePath}:`, error);
      }
    };

    await secureWipe(vaultPath);
    await secureWipe(backupPath);

    // Also remove from registry
    await this.unregisterVault(vaultId);
  }

  /**
   * List all vaults (local + external from registry)
   * @returns {Promise<Array<{id: string, name: string, path: string, modifiedAt: string, isExternal: boolean}>>}
   */
  async listVaults() {
    await this.ensureDirectory();

    const vaults = [];
    const seenIds = new Set();

    // Helper to get version from vault file (handles V1 and V3)
    const getVersion = (vaultFile) => vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

    // Helper to check Windows Hello (handles V1 and V3)
    const hasHello = (vaultFile) => {
      const version = getVersion(vaultFile);
      if (version === VAULT_FORMAT_VERSION) {
        return vaultFile.windowsHello?.enabled === true;
      }
      return vaultFile.header?.windowsHello?.enabled === true;
    };

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
          version: getVersion(vaultFile),
          isExternal: entry.isExternal || false,
          hasHello: hasHello(vaultFile)
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
        const version = getVersion(vaultFile);

        // Get vaultId - from header (V1) or from filename (V3)
        let vaultId;
        if (version === VAULT_FORMAT_VERSION) {
          // V3: extract vaultId from filename (files are named {vaultId}.gpd)
          vaultId = file.replace(VAULT_EXTENSION, '');
        } else {
          // V1: get from header
          vaultId = vaultFile.header?.vaultId;
        }

        if (!vaultId) {
          console.warn(`[VaultFileManager] Could not determine vaultId for: ${file}`);
          continue;
        }

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
          version,
          isExternal: false,
          hasHello: hasHello(vaultFile)
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
   * Migrate vault to V3 with Plausible Deniability
   * @param {string} vaultId 
   * @param {Object} currentVaultData 
   * @param {string} masterPassword 
   * @param {string} duressPassword 
   * @param {boolean} populateDecoy 
   */
  async migrateToV3(vaultId, currentVaultData, masterPassword, duressPassword, populateDecoy) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);
    const backupPath = `${vaultPath}.migration.bak`;

    // 1. Backup!
    try { await fs.copyFile(vaultPath, backupPath); } catch { }

    // 2. Prepare Slot A (Real Vault)
    const slotA = await this.#crypto.createVaultKey(masterPassword);
    const payloadA = this.#crypto.encrypt(currentVaultData, slotA.key);

    // 3. Prepare Slot B (Decoy Vault)
    const slotB = await this.#crypto.createVaultKey(duressPassword);
    let decoyData;
    if (populateDecoy) {
      decoyData = DuressManager.generateDecoyVault();
    } else {
      decoyData = createEmptyVault('My Vault');
    }
    const payloadB = this.#crypto.encrypt(decoyData, slotB.key);

    // 4. Create V3 File
    const vaultFile = {
      version: VAULT_FORMAT_VERSION,
      slots: [
        {
          salt: slotA.keyData.salt,
          iv: slotA.keyData.iv,
          iterations: slotA.keyData.kdfParams ? slotA.keyData.kdfParams.iterations : 600000,
          encryptedKey: slotA.keyData.encryptedKey || '',
          keyData: slotA.keyData
        },
        {
          keyData: slotB.keyData
        }
      ],
      payloads: [
        JSON.stringify(payloadA),
        JSON.stringify(payloadB)
      ]
    };

    // 5. Write
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');

    // Wipe
    this.#crypto.wipeKey(slotA.key);
    this.#crypto.wipeKey(slotB.key);
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
   * @returns {Promise<{vaultData: Object, activeSlot: number}>}
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
    const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

    // V3: decrypt from slot 0 (Windows Hello always uses real vault)
    if (version === VAULT_FORMAT_VERSION) {
      const encryptedPayload = JSON.parse(vaultFile.payloads[0]);
      const vaultData = this.#crypto.decrypt(encryptedPayload, key);
      return { vaultData, activeSlot: 0 };
    }

    // Legacy: decrypt from encryptedData
    const vaultData = this.#crypto.decrypt(vaultFile.encryptedData, key);
    return { vaultData, activeSlot: 0 };
  }

  /**
   * Store Windows Hello encrypted key in vault
   * @param {string} vaultId - Vault ID
   * @param {string} encryptedKey - Base64 encoded encrypted vault key
   * @returns {Promise<void>}
   */
  async setVaultHelloKey(vaultId, encryptedKey) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read current file
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);
    const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

    const helloData = {
      enabled: true,
      encryptedKey,
      enabledAt: new Date().toISOString()
    };

    // V3: store at root level
    if (version === VAULT_FORMAT_VERSION) {
      vaultFile.windowsHello = helloData;
    } else {
      // Legacy: store in header
      if (!vaultFile.header) vaultFile.header = {};
      vaultFile.header.windowsHello = helloData;
    }

    // Save back
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');
  }

  /**
   * Remove Windows Hello data from vault
   * @param {string} vaultId - Vault ID
   * @returns {Promise<void>}
   */
  async removeVaultHelloKey(vaultId) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    // Read current file
    const content = await fs.readFile(vaultPath, 'utf-8');
    const vaultFile = JSON.parse(content);
    const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

    // V3: remove from root level
    if (version === VAULT_FORMAT_VERSION) {
      delete vaultFile.windowsHello;
    } else {
      // Legacy: remove from header
      delete vaultFile.header?.windowsHello;
    }

    // Save back
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), 'utf-8');
  }

  /**
   * Get Windows Hello encrypted key from vault
   * @param {string} vaultId - Vault ID
   * @returns {Promise<string|null>} Encrypted key or null if not enabled
   */
  async getVaultHelloKey(vaultId) {
    const vaultPath = this.getRegisteredVaultPath(vaultId);

    try {
      const content = await fs.readFile(vaultPath, 'utf-8');
      const vaultFile = JSON.parse(content);
      const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

      // V3: check root level
      if (version === VAULT_FORMAT_VERSION) {
        if (vaultFile.windowsHello?.enabled) {
          return vaultFile.windowsHello.encryptedKey || null;
        }
        return null;
      }

      // Legacy: check header
      if (vaultFile.header?.windowsHello?.enabled) {
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
      const version = vaultFile.version || vaultFile.header?.version || LEGACY_FORMAT_VERSION;

      // V3: check root level
      if (version === VAULT_FORMAT_VERSION) {
        return vaultFile.windowsHello?.enabled === true;
      }

      // Legacy: check header
      return vaultFile.header?.windowsHello?.enabled === true;
    } catch {
      return false;
    }
  }
}

// Export singleton
export const vaultFileManager = new VaultFileManager();
export default vaultFileManager;
