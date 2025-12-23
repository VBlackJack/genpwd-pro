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

// src/js/core/sync/cloud-provider.js - Abstract Cloud Provider Interface
// Mirrors Android CloudSyncProvider interface for cross-platform consistency

import { CloudResult, CloudErrorType } from './models.js';
import { safeLog } from '../../utils/logger.js';

/**
 * Abstract Cloud Provider Interface
 *
 * Defines the contract for all cloud sync providers (Google Drive, OneDrive, Dropbox, etc.)
 * All methods return CloudResult for consistent error handling.
 *
 * SECURITY PRINCIPLE:
 * - Providers ONLY handle encrypted data (ArrayBuffer)
 * - Encryption/decryption happens in sync-service.js via vault-crypto.js
 * - Providers never see plaintext vault content
 *
 * @abstract
 */
export class CloudProvider {
  /**
   * @param {string} name - Provider display name
   * @param {string} id - Provider identifier (e.g., 'google-drive', 'onedrive')
   */
  constructor(name, id) {
    if (new.target === CloudProvider) {
      throw new Error('CloudProvider is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.id = id;
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._connected = false;

    safeLog(`CloudProvider initialized: ${name}`);
  }

  // ==================== Abstract Methods ====================
  // Subclasses MUST implement these methods

  /**
   * Authenticate with the cloud provider
   *
   * Implementations should:
   * 1. Check for existing valid tokens
   * 2. Refresh tokens if expired
   * 3. Trigger OAuth flow if no tokens
   *
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   * @abstract
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Upload encrypted vault data to cloud
   *
   * @param {string} vaultId - Local vault identifier
   * @param {ArrayBuffer} encryptedData - Encrypted vault content (NEVER plaintext)
   * @param {Object} options - Upload options
   * @param {string} options.existingFileId - File ID for update (optional)
   * @param {string} options.checksum - Content checksum for conflict detection
   * @returns {Promise<CloudResult<string>>} - File ID on success
   * @abstract
   */
  async uploadVault(_vaultId, _encryptedData, _options = {}) {
    throw new Error('uploadVault() must be implemented by subclass');
  }

  /**
   * Download encrypted vault data from cloud
   *
   * @param {string} vaultId - Local vault identifier
   * @param {string} fileId - Cloud file ID (optional, will search by vaultId if not provided)
   * @returns {Promise<CloudResult<VaultSyncData>>} - Encrypted vault data and metadata
   * @abstract
   */
  async downloadVault(_vaultId, _fileId = null) {
    throw new Error('downloadVault() must be implemented by subclass');
  }

  /**
   * List all synced vaults in cloud storage
   *
   * @returns {Promise<CloudResult<VaultSyncMetadata[]>>} - List of vault metadata
   * @abstract
   */
  async listVaults() {
    throw new Error('listVaults() must be implemented by subclass');
  }

  /**
   * Delete a vault file from cloud storage
   *
   * @param {string} fileId - Cloud file ID to delete
   * @returns {Promise<CloudResult<boolean>>} - True on success
   * @abstract
   */
  async deleteVault(_fileId) {
    throw new Error('deleteVault() must be implemented by subclass');
  }

  /**
   * Revoke access and clear all tokens
   *
   * @returns {Promise<CloudResult<boolean>>}
   * @abstract
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  // ==================== Common Methods ====================
  // Shared functionality for all providers

  /**
   * Check if provider is connected (has valid tokens)
   * @returns {boolean}
   */
  isConnected() {
    return this._connected && this._accessToken && !this.isTokenExpired();
  }

  /**
   * Check if current token is expired
   * @returns {boolean}
   */
  isTokenExpired() {
    if (!this._tokenExpiry) return true;
    // Consider expired 5 minutes before actual expiry
    return Date.now() >= (this._tokenExpiry - 5 * 60 * 1000);
  }

  /**
   * Get current access token
   * @returns {string|null}
   */
  getAccessToken() {
    return this._accessToken;
  }

  /**
   * Set tokens from authentication
   * @param {string} accessToken
   * @param {string|null} refreshToken
   * @param {number} expiresAt - Expiry timestamp in ms
   */
  setTokens(accessToken, refreshToken = null, expiresAt = null) {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._tokenExpiry = expiresAt;
    this._connected = true;
  }

  /**
   * Clear all tokens
   */
  clearTokens() {
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._connected = false;
  }

  /**
   * Generate vault filename for cloud storage
   * @param {string} vaultId - Local vault ID
   * @returns {string} - Filename (e.g., "vault_abc123.gpv")
   */
  getVaultFilename(vaultId) {
    return `vault_${vaultId}.gpv`;
  }

  /**
   * Make authenticated HTTP request
   *
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<CloudResult<Response>>}
   */
  async fetchWithAuth(url, options = {}) {
    // Ensure we have a valid token
    if (!this._accessToken) {
      return CloudResult.error(
        CloudErrorType.AUTH_EXPIRED,
        'No access token. Please authenticate first.'
      );
    }

    if (this.isTokenExpired()) {
      // Try to refresh token
      const refreshResult = await this.authenticate();
      if (refreshResult.isError) {
        return refreshResult;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this._accessToken}`
        }
      });

      // Handle error responses
      if (!response.ok) {
        return CloudResult.fromHttpStatus(response.status, await this.extractErrorMessage(response));
      }

      return CloudResult.success(response);

    } catch (error) {
      safeLog(`Network error in ${this.name}: ${error.message}`);
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Extract error message from HTTP response
   * @param {Response} response
   * @returns {Promise<string>}
   */
  async extractErrorMessage(response) {
    try {
      const body = await response.json();
      return body.error?.message || body.message || body.error || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  }

  /**
   * Retry operation with exponential backoff
   *
   * @param {function(): Promise<CloudResult>} operation - Operation to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} baseDelay - Base delay in ms
   * @returns {Promise<CloudResult>}
   */
  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastResult;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await operation();

      // Success or non-recoverable error - return immediately
      if (lastResult.isSuccess || !lastResult.isRecoverable()) {
        return lastResult;
      }

      // Recoverable error - wait and retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        safeLog(`${this.name}: Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return lastResult;
  }

  /**
   * Validate encrypted data before upload
   * @param {ArrayBuffer} data
   * @returns {boolean}
   */
  validateEncryptedData(data) {
    if (!(data instanceof ArrayBuffer)) {
      safeLog('Invalid data: expected ArrayBuffer');
      return false;
    }

    if (data.byteLength < 32) {
      safeLog('Invalid data: too small to be encrypted vault');
      return false;
    }

    // Check for GPV magic bytes (if applicable)
    // This is a basic sanity check
    return true;
  }

  /**
   * Get provider info for UI display
   * @returns {Object}
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      connected: this.isConnected(),
      tokenExpiry: this._tokenExpiry
    };
  }
}

/**
 * Provider Registry
 * Manages available cloud providers
 */
export class ProviderRegistry {
  constructor() {
    this._providers = new Map();
  }

  /**
   * Register a provider
   * @param {CloudProvider} provider
   */
  register(provider) {
    this._providers.set(provider.id, provider);
    safeLog(`Registered cloud provider: ${provider.name}`);
  }

  /**
   * Get provider by ID
   * @param {string} id
   * @returns {CloudProvider|null}
   */
  get(id) {
    return this._providers.get(id) || null;
  }

  /**
   * List all registered providers
   * @returns {CloudProvider[]}
   */
  list() {
    return Array.from(this._providers.values());
  }

  /**
   * Get all connected providers
   * @returns {CloudProvider[]}
   */
  getConnected() {
    return this.list().filter(p => p.isConnected());
  }
}

// Singleton registry instance
export const providerRegistry = new ProviderRegistry();
