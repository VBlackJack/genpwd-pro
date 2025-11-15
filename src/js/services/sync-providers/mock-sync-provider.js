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

// src/js/services/sync-providers/mock-sync-provider.js - Mock Sync Provider

import { SyncProvider } from './sync-provider-interface.js';
import { safeLog } from '../../utils/logger.js';

/**
 * Mock Sync Provider
 * In-memory provider for testing and development
 * Does not persist data across page reloads
 */
export class MockSyncProvider extends SyncProvider {
  constructor() {
    super();
    this.storage = new Map();
    this.connected = false;
    this.config = {};
    this.lastSyncTime = 0;
    this.quota = {
      used: 0,
      total: 1024 * 1024 * 100, // 100MB mock quota
      available: 1024 * 1024 * 100
    };

    safeLog('MockSyncProvider created');
  }

  get name() {
    return 'Mock Sync Provider';
  }

  get type() {
    return 'mock';
  }

  /**
   * Initialize the provider
   */
  async init(config) {
    this.config = config || {};
    safeLog('MockSyncProvider initialized', this.config);
    return Promise.resolve();
  }

  /**
   * Connect (always succeeds for mock)
   */
  async connect() {
    // Simulate network delay
    await this.simulateDelay(100);

    this.connected = true;
    safeLog('MockSyncProvider connected');
    return true;
  }

  /**
   * Disconnect
   */
  async disconnect() {
    this.connected = false;
    safeLog('MockSyncProvider disconnected');
    return Promise.resolve();
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Push data to mock storage
   */
  async push(data) {
    if (!this.connected) {
      return {
        success: false,
        timestamp: Date.now(),
        error: 'Not connected'
      };
    }

    try {
      // Simulate network delay
      await this.simulateDelay(200);

      // Store data
      this.storage.set('latest', data);
      this.lastSyncTime = Date.now();

      // Update quota
      const dataSize = JSON.stringify(data).length;
      this.quota.used = dataSize;
      this.quota.available = this.quota.total - dataSize;

      safeLog('MockSyncProvider: Data pushed', { size: dataSize });

      return {
        success: true,
        timestamp: this.lastSyncTime
      };

    } catch (error) {
      safeLog(`MockSyncProvider: Push failed - ${error.message}`);
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * Pull data from mock storage
   */
  async pull() {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      // Simulate network delay
      await this.simulateDelay(200);

      const data = this.storage.get('latest');

      if (data) {
        safeLog('MockSyncProvider: Data pulled');
      } else {
        safeLog('MockSyncProvider: No data to pull');
      }

      return data || null;

    } catch (error) {
      safeLog(`MockSyncProvider: Pull failed - ${error.message}`);
      throw error;
    }
  }

  /**
   * Two-way sync
   */
  async sync(localData) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      // Simulate network delay
      await this.simulateDelay(300);

      const remoteData = this.storage.get('latest');

      if (!remoteData) {
        // No remote data, push local
        await this.push(localData);
        safeLog('MockSyncProvider: Sync - pushed local data');
        return {
          action: 'push',
          data: localData,
          conflicts: 0,
          timestamp: Date.now()
        };
      }

      // Compare timestamps (simple conflict resolution)
      const localTimestamp = localData.timestamp || 0;
      const remoteTimestamp = remoteData.timestamp || 0;

      if (localTimestamp > remoteTimestamp) {
        // Local is newer, push
        await this.push(localData);
        safeLog('MockSyncProvider: Sync - local newer, pushed');
        return {
          action: 'push',
          data: localData,
          conflicts: 0,
          timestamp: Date.now()
        };
      } else if (remoteTimestamp > localTimestamp) {
        // Remote is newer, pull
        safeLog('MockSyncProvider: Sync - remote newer, pulled');
        return {
          action: 'pull',
          data: remoteData,
          conflicts: 0,
          timestamp: Date.now()
        };
      } else {
        // Same timestamp, no changes
        safeLog('MockSyncProvider: Sync - no changes');
        return {
          action: 'none',
          data: localData,
          conflicts: 0,
          timestamp: Date.now()
        };
      }

    } catch (error) {
      safeLog(`MockSyncProvider: Sync failed - ${error.message}`);
      throw error;
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime() {
    return this.lastSyncTime;
  }

  /**
   * Get server timestamp (just current time for mock)
   */
  async getServerTimestamp() {
    await this.simulateDelay(50);
    return Date.now();
  }

  /**
   * Get quota info
   */
  async getQuota() {
    await this.simulateDelay(50);
    return { ...this.quota };
  }

  /**
   * Delete all data
   */
  async deleteAll() {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    await this.simulateDelay(100);

    this.storage.clear();
    this.lastSyncTime = 0;
    this.quota.used = 0;
    this.quota.available = this.quota.total;

    safeLog('MockSyncProvider: All data deleted');
    return true;
  }

  /**
   * Simulate network delay
   */
  async simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current storage (for testing)
   */
  getStorage() {
    return this.storage;
  }

  /**
   * Clear storage (for testing)
   */
  clearStorage() {
    this.storage.clear();
    this.quota.used = 0;
    this.quota.available = this.quota.total;
  }
}

export default MockSyncProvider;
