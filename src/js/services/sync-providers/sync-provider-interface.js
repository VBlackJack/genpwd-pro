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

// src/js/services/sync-providers/sync-provider-interface.js - Sync Provider Interface

/**
 * Sync Provider Interface
 * All sync providers must implement this interface
 *
 * @interface SyncProvider
 */
export class SyncProvider {
  /**
   * Provider name
   * @type {string}
   */
  get name() {
    throw new Error('SyncProvider.name must be implemented');
  }

  /**
   * Provider type
   * @type {'mock'|'localstorage'|'webdav'|'cloud'}
   */
  get type() {
    throw new Error('SyncProvider.type must be implemented');
  }

  /**
   * Initialize the provider with configuration
   * @param {Object} config - Provider configuration
   * @returns {Promise<void>}
   */
  async init(config) {
    throw new Error('SyncProvider.init() must be implemented');
  }

  /**
   * Connect to the provider
   * @returns {Promise<boolean>} - True if connected successfully
   */
  async connect() {
    throw new Error('SyncProvider.connect() must be implemented');
  }

  /**
   * Disconnect from the provider
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('SyncProvider.disconnect() must be implemented');
  }

  /**
   * Check if provider is connected
   * @returns {boolean}
   */
  isConnected() {
    throw new Error('SyncProvider.isConnected() must be implemented');
  }

  /**
   * Push encrypted data to remote
   * @param {Object} data - Encrypted data package
   * @returns {Promise<{success: boolean, timestamp: number, error?: string}>}
   */
  async push(data) {
    throw new Error('SyncProvider.push() must be implemented');
  }

  /**
   * Pull encrypted data from remote
   * @returns {Promise<Object|null>} - Encrypted data package or null
   */
  async pull() {
    throw new Error('SyncProvider.pull() must be implemented');
  }

  /**
   * Sync local data with remote (two-way sync)
   * @param {Object} localData - Local encrypted data
   * @returns {Promise<{action: string, data: Object, conflicts: number}>}
   */
  async sync(localData) {
    throw new Error('SyncProvider.sync() must be implemented');
  }

  /**
   * Get last sync timestamp
   * @returns {Promise<number>} - Timestamp of last sync
   */
  async getLastSyncTime() {
    throw new Error('SyncProvider.getLastSyncTime() must be implemented');
  }

  /**
   * Get server timestamp
   * @returns {Promise<number>} - Server timestamp
   */
  async getServerTimestamp() {
    throw new Error('SyncProvider.getServerTimestamp() must be implemented');
  }

  /**
   * Get quota information
   * @returns {Promise<{used: number, total: number, available: number}>}
   */
  async getQuota() {
    throw new Error('SyncProvider.getQuota() must be implemented');
  }

  /**
   * Delete all remote data
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteAll() {
    throw new Error('SyncProvider.deleteAll() must be implemented');
  }
}

/**
 * Provider Configuration Interface
 * @typedef {Object} ProviderConfig
 * @property {string} [endpoint] - API endpoint URL
 * @property {string} [apiKey] - API key for authentication
 * @property {number} [timeout] - Request timeout in ms
 * @property {number} [retries] - Number of retry attempts
 */

/**
 * Encrypted Data Package
 * @typedef {Object} EncryptedData
 * @property {number[]} iv - Initialization vector
 * @property {number[]} data - Encrypted data bytes
 * @property {string} version - Encryption version
 * @property {number} timestamp - Creation timestamp
 * @property {string} deviceId - Device identifier
 */

/**
 * Sync Result
 * @typedef {Object} SyncResult
 * @property {string} action - Action taken: 'push', 'pull', 'merge', 'conflict'
 * @property {Object} data - Resulting data
 * @property {number} conflicts - Number of conflicts resolved
 * @property {number} timestamp - Sync timestamp
 */

export default SyncProvider;
