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

// src/js/services/sync-service.js - End-to-End Encrypted Sync Service

import { safeLog } from '../utils/logger.js';
import historyManager from '../utils/history-manager.js';
import presetManager from '../utils/preset-manager.js';
import vaultCrypto from '../core/crypto/vault-crypto.js';
import { t } from '../utils/i18n.js';
import {
  CloudResult,
  CloudErrorType,
  SyncState,
  ConflictStrategy
} from '../core/sync/models.js';

/**
 * Sync Service Events
 * Emitted via window.dispatchEvent for UI reactivity
 */
export const SyncEvents = Object.freeze({
  /** Sync state changed */
  STATE_CHANGED: 'sync:stateChanged',

  /** Sync completed successfully */
  SYNC_COMPLETE: 'sync:complete',

  /** Sync failed */
  SYNC_ERROR: 'sync:error',

  /** Authentication required (token expired) */
  AUTH_REQUIRED: 'sync:authRequired',

  /** Conflict detected (user decision needed) */
  CONFLICT_DETECTED: 'sync:conflict',

  /** Provider connected */
  CONNECTED: 'sync:connected',

  /** Provider disconnected */
  DISCONNECTED: 'sync:disconnected'
});

/**
 * Sync Service
 * Provides end-to-end encrypted synchronization with conflict resolution
 *
 * CRYPTO ENGINE: Argon2id + AES-256-GCM (Android-compatible)
 * SYNC ENGINE: CloudResult-based error handling (matches Android)
 *
 * v2.7.0: Migrated from PBKDF2 to Argon2id for cross-platform vault compatibility.
 * Uses vault-crypto.js which mirrors the Android VaultCryptoManager implementation.
 *
 * Phase 3: Added CloudResult architecture for robust error handling.
 * All cloud operations now return CloudResult for consistent error handling.
 */
class SyncService {
  constructor() {
    this.provider = null;
    this.encryptionKey = null;
    this.salt = null;
    this.isLocked = true;
    this.deviceId = this.getOrCreateDeviceId();
    this.syncInterval = 300000; // 5 minutes
    this.syncTimer = null;

    // Sync state tracking
    this.syncState = SyncState.IDLE;
    this.lastSyncTime = null;
    this.lastSyncError = null;
    this.conflictStrategy = ConflictStrategy.ASK_USER;

    // Event listeners
    this._eventListeners = new Map();

    // Operation guard for safe lock transitions
    this._activeOperations = 0;
    this._lockPending = false;

    // Crypto configuration now delegated to vault-crypto.js
    // Argon2id: iterations=3, memory=64MB, parallelism=4
    // AES-256-GCM: ivLength=12, tagLength=128
    this.config = {
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12,      // 96 bits for GCM
      tagLength: 128,    // 128-bit authentication tag
      saltLength: 32     // 32 bytes (Android-compatible)
    };

    safeLog('SyncService initialized with Argon2id crypto engine + CloudResult', { deviceId: this.deviceId });
  }

  /**
   * Initialize with a sync provider
   */
  async init(provider, providerConfig = {}) {
    this.provider = provider;
    await this.provider.init(providerConfig);

    safeLog(`SyncService initialized with provider: ${this.provider.name}`);
  }

  /**
   * Unlock sync service with master password
   * Derives encryption key using Argon2id (Android-compatible)
   *
   * IMPORTANT: This operation is CPU-intensive due to Argon2id.
   * Should be called from Main Process or Worker to avoid UI blocking.
   */
  async unlock(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error(t('errors.auth.masterPasswordTooShort'));
    }

    try {
      // Generate or retrieve salt (32 bytes for Android compatibility)
      this.salt = this.getOrCreateSalt();

      // Derive encryption key using Argon2id (via vault-crypto)
      // Parameters: iterations=3, memory=64MB, parallelism=4
      this.encryptionKey = await vaultCrypto.deriveKey(masterPassword, this.salt);

      this.isLocked = false;

      safeLog('SyncService unlocked with Argon2id');

      // Start auto-sync
      this.startAutoSync();

      return true;

    } catch (error) {
      safeLog(`Failed to unlock SyncService: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lock sync service
   * Clears encryption key from memory
   * Waits for any active crypto operations to complete before clearing the key
   */
  async lock() {
    this._lockPending = true;

    // Wait for active encrypt/decrypt operations to finish
    const MAX_LOCK_WAIT_MS = 10000;
    const POLL_INTERVAL_MS = 50;
    let waited = 0;
    while (this._activeOperations > 0 && waited < MAX_LOCK_WAIT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      waited += POLL_INTERVAL_MS;
    }

    if (this._activeOperations > 0) {
      safeLog(`SyncService lock forced after ${MAX_LOCK_WAIT_MS}ms with ${this._activeOperations} active operations`);
    }

    // Wipe encryption key if it's a Buffer
    if (this.encryptionKey && Buffer.isBuffer(this.encryptionKey)) {
      vaultCrypto.wipeBuffer(this.encryptionKey);
    }
    this.encryptionKey = null;
    this.isLocked = true;
    this._lockPending = false;

    this.stopAutoSync();

    safeLog('SyncService locked');
  }

  /**
   * @deprecated REMOVED in v2.7.0 - PBKDF2 replaced with Argon2id
   *
   * Key derivation is now handled by vault-crypto.js using Argon2id
   * with parameters matching Android VaultCryptoManager:
   * - Iterations: 3
   * - Memory: 64MB
   * - Parallelism: 4
   *
   * This ensures cross-platform vault compatibility with Android.
   *
   * @see vault-crypto.js#deriveKey
   */
  async deriveKey(password, salt) {
    // Delegate to vault-crypto for Argon2id key derivation
    return await vaultCrypto.deriveKey(password, salt);
  }

  /**
   * Encrypt data with AES-256-GCM (via vault-crypto)
   *
   * Uses the same encryption format as Android VaultCryptoManager.
   * Protected by an operation guard to prevent key wipe during encryption.
   */
  async encrypt(data) {
    if (this._lockPending || this.isLocked) {
      throw new Error(t('errors.sync.locked'));
    }

    this._activeOperations++;
    try {
      // Generate random IV using vault-crypto
      const iv = vaultCrypto.generateIV();

      // Prepare data as JSON
      const plaintext = Buffer.from(JSON.stringify(data), 'utf8');

      // Encrypt using vault-crypto (AES-256-GCM)
      const encrypted = vaultCrypto.encryptAESGCM(plaintext, this.encryptionKey, iv);

      // Package encrypted data (compatible with Android format)
      return {
        iv: Array.from(iv),
        data: Array.from(encrypted),
        version: '2.0',  // v2.0 = Argon2id crypto engine
        timestamp: Date.now(),
        deviceId: this.deviceId
      };
    } finally {
      this._activeOperations--;
    }
  }

  /**
   * Decrypt data with AES-256-GCM (via vault-crypto)
   *
   * Uses the same decryption format as Android VaultCryptoManager.
   * Protected by an operation guard to prevent key wipe during decryption.
   */
  async decrypt(encryptedPackage) {
    if (this._lockPending || this.isLocked) {
      throw new Error(t('errors.sync.locked'));
    }

    this._activeOperations++;
    try {
      // Extract IV and encrypted data as Buffers
      const iv = Buffer.from(encryptedPackage.iv);
      const encrypted = Buffer.from(encryptedPackage.data);

      // Decrypt using vault-crypto (AES-256-GCM)
      const decrypted = vaultCrypto.decryptAESGCM(encrypted, this.encryptionKey, iv);

      // Parse JSON
      const plaintext = decrypted.toString('utf8');
      return JSON.parse(plaintext);
    } finally {
      this._activeOperations--;
    }
  }

  /**
   * Sync local data with remote
   * Uses Last-Write-Wins conflict resolution
   *
   * @param {string} vaultId - Vault ID to sync
   * @returns {Promise<CloudResult<{action: string, conflicts: number, timestamp: number}>>}
   */
  async sync(vaultId = 'default') {
    if (this.isLocked) {
      return CloudResult.error(
        CloudErrorType.GENERIC,
        t('errors.sync.locked')
      );
    }

    if (!this.provider) {
      return CloudResult.error(
        CloudErrorType.GENERIC,
        t('errors.sync.noProvider')
      );
    }

    // Update state
    this.setSyncState(SyncState.SYNCING);

    try {
      safeLog('Starting sync...');

      // 1. Authenticate provider
      const authResult = await this.provider.authenticate();
      if (authResult.isError) {
        return this.handleSyncError(authResult);
      }

      // 2. Get local data and encrypt
      const localData = await this.getLocalData();
      const encryptedLocal = await this.encryptToBuffer(localData);

      // 3. Download remote vault (if exists)
      this.setSyncState(SyncState.DOWNLOADING);
      const downloadResult = await this.provider.downloadVault(vaultId);

      if (downloadResult.isError) {
        // Handle NOT_FOUND as "no remote data yet"
        if (downloadResult.errorType === CloudErrorType.NOT_FOUND) {
          safeLog('No remote data, uploading local');
          return await this.uploadAndComplete(vaultId, encryptedLocal, 'push', 0);
        }
        return this.handleSyncError(downloadResult);
      }

      // 4. Decrypt remote data
      const remoteVaultData = downloadResult.data;
      let remoteData;

      try {
        remoteData = await this.decryptFromBuffer(remoteVaultData.encryptedContent);
      } catch (decryptError) {
        return CloudResult.error(
          CloudErrorType.GENERIC,
          t('errors.sync.decryptFailed')
        );
      }

      // 5. Resolve conflicts
      this.setSyncState(SyncState.RESOLVING_CONFLICT);
      const { resolved, conflicts, strategy } = this.resolveConflicts(localData, remoteData);

      // If conflict requires user decision
      if (strategy === 'ask_user') {
        this.emitEvent(SyncEvents.CONFLICT_DETECTED, {
          local: localData,
          remote: remoteData,
          vaultId
        });
        return CloudResult.error(
          CloudErrorType.CONFLICT,
          t('errors.sync.conflictDetected')
        );
      }

      // 6. Update local data if remote was newer
      if (resolved !== localData) {
        await this.setLocalData(resolved);
      }

      // 7. Encrypt and upload resolved data
      const encryptedResolved = await this.encryptToBuffer(resolved);
      return await this.uploadAndComplete(vaultId, encryptedResolved, conflicts > 0 ? 'merge' : 'sync', conflicts);

    } catch (error) {
      safeLog(`Sync failed: ${error.message}`);
      return this.handleSyncError(
        CloudResult.error(CloudErrorType.GENERIC, error.message, error)
      );
    }
  }

  /**
   * Upload encrypted data and complete sync
   * @private
   */
  async uploadAndComplete(vaultId, encryptedData, action, conflicts) {
    this.setSyncState(SyncState.UPLOADING);

    const uploadResult = await this.provider.uploadVault(vaultId, encryptedData);

    if (uploadResult.isError) {
      return this.handleSyncError(uploadResult);
    }

    // Sync successful
    this.lastSyncTime = Date.now();
    this.lastSyncError = null;
    this.setSyncState(SyncState.IDLE);

    const result = {
      action,
      conflicts,
      timestamp: this.lastSyncTime,
      fileId: uploadResult.data
    };

    this.emitEvent(SyncEvents.SYNC_COMPLETE, result);
    safeLog(`Sync complete: ${conflicts} conflicts resolved`);

    return CloudResult.success(result);
  }

  /**
   * Handle sync error and emit appropriate events
   * @private
   */
  handleSyncError(errorResult) {
    this.lastSyncError = errorResult;
    this.setSyncState(SyncState.ERROR);

    // Emit specific events based on error type
    if (errorResult.requiresReauth()) {
      this.emitEvent(SyncEvents.AUTH_REQUIRED, {
        provider: this.provider?.name,
        errorType: errorResult.errorType,
        message: errorResult.message
      });
    } else {
      this.emitEvent(SyncEvents.SYNC_ERROR, {
        errorType: errorResult.errorType,
        message: errorResult.message
      });
    }

    return errorResult;
  }

  /**
   * Encrypt data to ArrayBuffer for cloud upload
   */
  async encryptToBuffer(data) {
    const encrypted = await this.encrypt(data);
    // Convert to binary format for cloud storage
    const jsonStr = JSON.stringify(encrypted);
    const encoder = new TextEncoder();
    return encoder.encode(jsonStr).buffer;
  }

  /**
   * Decrypt data from ArrayBuffer
   */
  async decryptFromBuffer(buffer) {
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(buffer);
    const encrypted = JSON.parse(jsonStr);
    return await this.decrypt(encrypted);
  }

  /**
   * Set sync state and emit event
   * @private
   */
  setSyncState(state) {
    const previousState = this.syncState;
    this.syncState = state;

    if (previousState !== state) {
      this.emitEvent(SyncEvents.STATE_CHANGED, {
        previousState,
        currentState: state
      });
    }
  }

  /**
   * Emit event to listeners
   * @private
   */
  emitEvent(eventName, data) {
    // Emit via CustomEvent for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    // Call registered listeners
    const listeners = this._eventListeners.get(eventName) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        safeLog(`Event listener error: ${error.message}`);
      }
    });
  }

  /**
   * Register event listener
   * @param {string} event - Event name from SyncEvents
   * @param {function} callback - Callback function
   * @returns {function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Sync vault to cloud (new CloudResult-based API)
   *
   * @param {string} vaultId - Vault ID
   * @param {ArrayBuffer} encryptedVaultData - Pre-encrypted vault data
   * @returns {Promise<CloudResult<string>>} - File ID on success
   */
  async syncVault(vaultId, encryptedVaultData) {
    if (!this.provider) {
      return CloudResult.error(CloudErrorType.GENERIC, t('errors.sync.noProvider'));
    }

    // Validate data
    if (!(encryptedVaultData instanceof ArrayBuffer)) {
      return CloudResult.error(CloudErrorType.GENERIC, t('errors.sync.invalidData'));
    }

    return await this.provider.uploadVault(vaultId, encryptedVaultData);
  }

  /**
   * Download vault from cloud
   *
   * @param {string} vaultId - Vault ID
   * @returns {Promise<CloudResult<VaultSyncData>>}
   */
  async downloadVault(vaultId) {
    if (!this.provider) {
      return CloudResult.error(CloudErrorType.GENERIC, t('errors.sync.noProvider'));
    }

    return await this.provider.downloadVault(vaultId);
  }

  /**
   * List all synced vaults
   *
   * @returns {Promise<CloudResult<VaultSyncMetadata[]>>}
   */
  async listSyncedVaults() {
    if (!this.provider) {
      return CloudResult.error(CloudErrorType.GENERIC, t('errors.sync.noProvider'));
    }

    return await this.provider.listVaults();
  }

  /**
   * Resolve conflicts using configured strategy
   *
   * @param {Object} local - Local data
   * @param {Object} remote - Remote data
   * @returns {{resolved: Object, conflicts: number, strategy: string}}
   */
  resolveConflicts(local, remote) {
    let conflicts = 0;

    // Compare top-level timestamps
    const localTimestamp = local.timestamp || 0;
    const remoteTimestamp = remote.timestamp || 0;

    // Check if there's a meaningful difference (more than 1 second)
    const timeDiff = Math.abs(localTimestamp - remoteTimestamp);
    const hasConflict = timeDiff > 1000 && local.deviceId !== remote.deviceId;

    // If configured to ask user for conflicts
    if (hasConflict && this.conflictStrategy === ConflictStrategy.ASK_USER) {
      return { resolved: local, conflicts: 1, strategy: 'ask_user' };
    }

    // Apply configured strategy or default to Last-Write-Wins
    if (this.conflictStrategy === ConflictStrategy.LOCAL_WINS) {
      if (localTimestamp !== remoteTimestamp) conflicts = 1;
      safeLog('Conflict resolution: Local wins (configured)');
      return { resolved: local, conflicts, strategy: 'local_wins' };
    }

    if (this.conflictStrategy === ConflictStrategy.REMOTE_WINS) {
      if (localTimestamp !== remoteTimestamp) conflicts = 1;
      safeLog('Conflict resolution: Remote wins (configured)');
      return { resolved: remote, conflicts, strategy: 'remote_wins' };
    }

    // Default: Last-Write-Wins
    if (localTimestamp > remoteTimestamp) {
      // Local is newer, keep local
      if (hasConflict) conflicts = 1;
      safeLog('Conflict resolution: Local wins (newer timestamp)');
      return { resolved: local, conflicts, strategy: 'lww_local' };
    } else if (remoteTimestamp > localTimestamp) {
      // Remote is newer, keep remote
      if (hasConflict) conflicts = 1;
      safeLog('Conflict resolution: Remote wins (newer timestamp)');
      return { resolved: remote, conflicts, strategy: 'lww_remote' };
    } else {
      // Same timestamp, compare device ID (deterministic tie-breaker)
      if (local.deviceId > remote.deviceId) {
        safeLog('Conflict resolution: Local wins (device ID tie-breaker)');
        return { resolved: local, conflicts, strategy: 'tie_local' };
      } else {
        safeLog('Conflict resolution: Remote wins (device ID tie-breaker)');
        return { resolved: remote, conflicts, strategy: 'tie_remote' };
      }
    }
  }

  /**
   * Set conflict resolution strategy
   * @param {string} strategy - Strategy from ConflictStrategy
   */
  setConflictStrategy(strategy) {
    if (Object.values(ConflictStrategy).includes(strategy)) {
      this.conflictStrategy = strategy;
      safeLog(`Conflict strategy set to: ${strategy}`);
    }
  }

  /**
   * Resolve conflict with user decision
   *
   * @param {string} vaultId - Vault ID
   * @param {string} resolution - 'local' or 'remote'
   * @returns {Promise<CloudResult>}
   */
  async resolveConflictManually(vaultId, resolution) {
    if (resolution === 'local') {
      // Force push local
      const localData = await this.getLocalData();
      const encrypted = await this.encryptToBuffer(localData);
      return await this.provider.uploadVault(vaultId, encrypted);
    } else {
      // Force pull remote
      const result = await this.provider.downloadVault(vaultId);
      if (result.isSuccess) {
        const remoteData = await this.decryptFromBuffer(result.data.encryptedContent);
        await this.setLocalData(remoteData);
        return CloudResult.success({ action: 'pulled', timestamp: Date.now() });
      }
      return result;
    }
  }

  /**
   * Get local data to sync
   */
  async getLocalData() {
    const data = {
      passwords: historyManager.getAllPasswords(),
      presets: presetManager.getAllPresets(),
      settings: this.getSettings(),
      timestamp: Date.now(),
      deviceId: this.deviceId,
      version: '1.0'
    };

    return data;
  }

  /**
   * Set local data from sync
   */
  async setLocalData(data) {
    // Update history
    if (data.passwords && Array.isArray(data.passwords)) {
      historyManager.clearHistory();
      data.passwords.forEach(pwd => {
        historyManager.addPassword(pwd);
      });
    }

    // Update presets
    if (data.presets && Array.isArray(data.presets)) {
      // Clear existing presets (except default)
      const allPresets = presetManager.getAllPresets();
      allPresets.forEach(preset => {
        if (!preset.isDefault) {
          presetManager.deletePreset(preset.id);
        }
      });

      // Add synced presets
      data.presets.forEach(preset => {
        if (!preset.isDefault) {
          presetManager.savePreset(preset.name, preset.description, preset.config);
        }
      });
    }

    // Update settings
    if (data.settings) {
      this.setSettings(data.settings);
    }

    safeLog('Local data updated from sync');
  }

  /**
   * Get settings (placeholder - extend as needed)
   */
  getSettings() {
    return {
      theme: localStorage.getItem('theme') || 'dark',
      language: localStorage.getItem('language') || 'fr'
    };
  }

  /**
   * Set settings (placeholder - extend as needed)
   */
  setSettings(settings) {
    if (settings.theme) {
      localStorage.setItem('theme', settings.theme);
    }
    if (settings.language) {
      localStorage.setItem('language', settings.language);
    }
  }

  /**
   * Get or create device ID
   */
  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('sync_device_id');

    if (!deviceId) {
      // Generate cryptographically secure random device ID using UUID
      deviceId = 'device_' + crypto.randomUUID();
      localStorage.setItem('sync_device_id', deviceId);
    }

    return deviceId;
  }

  /**
   * Get or create salt for key derivation
   *
   * Uses 32-byte salt for Android VaultCryptoManager compatibility.
   * (libsodium uses first 16 bytes internally)
   */
  getOrCreateSalt() {
    let saltHex = localStorage.getItem('sync_salt');

    if (!saltHex) {
      // Generate 32-byte random salt using vault-crypto
      const salt = vaultCrypto.generateSalt();
      saltHex = vaultCrypto.bytesToHex(salt);
      localStorage.setItem('sync_salt', saltHex);
    }

    // Convert hex to Buffer
    return vaultCrypto.hexToBytes(saltHex);
  }

  /**
   * Start auto-sync timer
   * @param {number} interval - Sync interval in ms (optional, default 5 minutes)
   */
  startAutoSync(interval = null) {
    if (this.syncTimer) return;

    if (interval) {
      this.syncInterval = interval;
    }

    this.syncTimer = setInterval(async () => {
      try {
        // Skip if already syncing
        if (this.syncState === SyncState.SYNCING) {
          safeLog('Auto-sync skipped: sync already in progress');
          return;
        }

        const result = await this.sync();

        // Handle result
        if (result.isError) {
          safeLog(`Auto-sync failed: ${result.message}`);

          // If auth expired, stop auto-sync
          if (result.requiresReauth()) {
            this.stopAutoSync();
            safeLog('Auto-sync stopped: authentication required');
          }
        }
      } catch (e) {
        safeLog(`Auto-sync error: ${e.message}`);
      }
    }, this.syncInterval);

    safeLog(`Auto-sync started (interval: ${this.syncInterval}ms)`);
  }

  /**
   * Stop auto-sync timer
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      safeLog('Auto-sync stopped');
    }
  }

  /**
   * Manual sync trigger
   */
  async syncNow() {
    return await this.sync();
  }

  /**
   * Get sync status
   * @returns {Object} Sync status object
   */
  getStatus() {
    return {
      isLocked: this.isLocked,
      provider: this.provider ? this.provider.name : null,
      providerId: this.provider ? this.provider.id : null,
      providerConnected: this.provider ? this.provider.isConnected() : false,
      deviceId: this.deviceId,
      autoSyncEnabled: !!this.syncTimer,
      syncState: this.syncState,
      lastSyncTime: this.lastSyncTime,
      lastSyncError: this.lastSyncError ? {
        errorType: this.lastSyncError.errorType,
        message: this.lastSyncError.message
      } : null,
      conflictStrategy: this.conflictStrategy
    };
  }

  /**
   * Delete all remote data for a vault
   *
   * @param {string} vaultId - Vault ID to delete
   * @returns {Promise<CloudResult<boolean>>}
   */
  async deleteRemoteData(vaultId) {
    if (!this.provider) {
      return CloudResult.error(CloudErrorType.GENERIC, t('errors.sync.noProvider'));
    }

    // Authenticate first
    const authResult = await this.provider.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    // Find file ID for this vault
    const listResult = await this.provider.listVaults();
    if (listResult.isError) {
      return listResult;
    }

    const vault = listResult.data.find(v => v.vaultId === vaultId);
    if (!vault) {
      return CloudResult.error(CloudErrorType.NOT_FOUND, t('errors.sync.vaultNotFound', { vaultId }));
    }

    return await this.provider.deleteVault(vault.fileId);
  }

  /**
   * Disconnect from cloud provider
   *
   * @returns {Promise<CloudResult<boolean>>}
   */
  async disconnect() {
    if (!this.provider) {
      return CloudResult.success(true);
    }

    this.stopAutoSync();
    const result = await this.provider.disconnect();

    if (result.isSuccess) {
      this.emitEvent(SyncEvents.DISCONNECTED, { provider: this.provider.name });
    }

    return result;
  }

  /**
   * Connect to a provider
   *
   * @param {CloudProvider} provider - Provider instance
   * @returns {Promise<CloudResult<boolean>>}
   */
  async connect(provider) {
    this.provider = provider;

    const authResult = await provider.authenticate();

    if (authResult.isSuccess) {
      this.emitEvent(SyncEvents.CONNECTED, {
        provider: provider.name,
        providerId: provider.id
      });
    }

    return authResult;
  }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
export { SyncService };
