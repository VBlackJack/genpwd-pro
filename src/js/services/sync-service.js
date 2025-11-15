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

/**
 * Sync Service
 * Provides end-to-end encrypted synchronization with conflict resolution
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
    this.config = {
      pbkdf2Iterations: 600000, // OWASP 2023 recommendation
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12, // 96 bits for GCM
      tagLength: 128 // 128-bit authentication tag
    };

    safeLog('SyncService initialized', { deviceId: this.deviceId });
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
   * Derives encryption key from master password
   */
  async unlock(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters');
    }

    try {
      // Generate or retrieve salt
      this.salt = this.getOrCreateSalt();

      // Derive encryption key
      this.encryptionKey = await this.deriveKey(masterPassword, this.salt);

      this.isLocked = false;

      safeLog('SyncService unlocked');

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
   */
  lock() {
    this.encryptionKey = null;
    this.isLocked = true;

    this.stopAutoSync();

    safeLog('SyncService locked');
  }

  /**
   * Derive encryption key from master password using PBKDF2
   */
  async deriveKey(password, salt) {
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.config.pbkdf2Iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.config.algorithm,
        length: this.config.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  async encrypt(data) {
    if (this.isLocked) {
      throw new Error('SyncService is locked. Call unlock() first.');
    }

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));

    // Prepare data
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.config.algorithm,
        iv: iv,
        tagLength: this.config.tagLength
      },
      this.encryptionKey,
      plaintext
    );

    // Package encrypted data
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
      version: '1.0',
      timestamp: Date.now(),
      deviceId: this.deviceId
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  async decrypt(encryptedPackage) {
    if (this.isLocked) {
      throw new Error('SyncService is locked. Call unlock() first.');
    }

    // Extract IV and encrypted data
    const iv = new Uint8Array(encryptedPackage.iv);
    const encrypted = new Uint8Array(encryptedPackage.data);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.config.algorithm,
        iv: iv,
        tagLength: this.config.tagLength
      },
      this.encryptionKey,
      encrypted
    );

    // Parse JSON
    const plaintext = new TextDecoder().decode(decrypted);
    return JSON.parse(plaintext);
  }

  /**
   * Sync local data with remote
   * Uses Last-Write-Wins conflict resolution
   */
  async sync() {
    if (this.isLocked) {
      throw new Error('SyncService is locked. Call unlock() first.');
    }

    if (!this.provider) {
      throw new Error('No sync provider configured');
    }

    if (!this.provider.isConnected()) {
      await this.provider.connect();
    }

    try {
      safeLog('Starting sync...');

      // 1. Get local data
      const localData = await this.getLocalData();

      // 2. Encrypt local data
      const encryptedLocal = await this.encrypt(localData);

      // 3. Pull remote data
      const encryptedRemote = await this.provider.pull();

      if (!encryptedRemote) {
        // No remote data, push local
        safeLog('No remote data, pushing local');
        await this.provider.push(encryptedLocal);

        return {
          action: 'push',
          conflicts: 0,
          timestamp: Date.now()
        };
      }

      // 4. Decrypt remote data
      const remoteData = await this.decrypt(encryptedRemote);

      // 5. Resolve conflicts (Last-Write-Wins)
      const { resolved, conflicts } = this.resolveConflicts(localData, remoteData);

      // 6. Update local data if remote was newer
      if (resolved !== localData) {
        await this.setLocalData(resolved);
      }

      // 7. Encrypt and push resolved data
      const encryptedResolved = await this.encrypt(resolved);
      await this.provider.push(encryptedResolved);

      safeLog(`Sync complete: ${conflicts} conflicts resolved`);

      return {
        action: conflicts > 0 ? 'merge' : 'sync',
        conflicts: conflicts,
        timestamp: Date.now()
      };

    } catch (error) {
      safeLog(`Sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve conflicts using Last-Write-Wins (LWW)
   */
  resolveConflicts(local, remote) {
    let _conflicts = 0;

    // Compare top-level timestamps
    const localTimestamp = local.timestamp || 0;
    const remoteTimestamp = remote.timestamp || 0;

    if (localTimestamp > remoteTimestamp) {
      // Local is newer, keep local
      safeLog('Conflict resolution: Local wins');
      return { resolved: local, conflicts: 0 };
    } else if (remoteTimestamp > localTimestamp) {
      // Remote is newer, keep remote
      safeLog('Conflict resolution: Remote wins');
      return { resolved: remote, conflicts: 0 };
    } else {
      // Same timestamp, compare device ID (deterministic)
      if (local.deviceId > remote.deviceId) {
        safeLog('Conflict resolution: Local wins (same timestamp, device ID tie-breaker)');
        return { resolved: local, conflicts: 0 };
      } else {
        safeLog('Conflict resolution: Remote wins (same timestamp, device ID tie-breaker)');
        return { resolved: remote, conflicts: 0 };
      }
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
      // Generate random device ID
      deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('sync_device_id', deviceId);
    }

    return deviceId;
  }

  /**
   * Get or create salt for key derivation
   */
  getOrCreateSalt() {
    let saltHex = localStorage.getItem('sync_salt');

    if (!saltHex) {
      // Generate random salt
      const salt = crypto.getRandomValues(new Uint8Array(16));
      saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('sync_salt', saltHex);
    }

    // Convert hex to Uint8Array
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return salt;
  }

  /**
   * Start auto-sync timer
   */
  startAutoSync() {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        safeLog(`Auto-sync failed: ${error.message}`);
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
   */
  getStatus() {
    return {
      isLocked: this.isLocked,
      provider: this.provider ? this.provider.name : null,
      providerConnected: this.provider ? this.provider.isConnected() : false,
      deviceId: this.deviceId,
      autoSyncEnabled: !!this.syncTimer
    };
  }

  /**
   * Delete all remote data
   */
  async deleteRemoteData() {
    if (!this.provider) {
      throw new Error('No sync provider configured');
    }

    if (!this.provider.isConnected()) {
      await this.provider.connect();
    }

    return await this.provider.deleteAll();
  }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
export { SyncService };
