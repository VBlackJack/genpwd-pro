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

// src/js/core/sync/providers/dropbox-provider.js - Dropbox Cloud Provider
// Implements CloudProvider interface for Dropbox API v2

import { CloudProvider } from '../cloud-provider.js';
import { CloudResult, CloudErrorType, VaultSyncMetadata, VaultSyncData } from '../models.js';
import { safeLog } from '../../../utils/logger.js';

/**
 * Dropbox API Configuration
 * Uses Dropbox API v2
 */
const DROPBOX_CONFIG = {
  // API endpoints
  API_BASE: 'https://api.dropboxapi.com/2',
  CONTENT_BASE: 'https://content.dropboxapi.com/2',
  AUTH_URL: 'https://www.dropbox.com/oauth2/authorize',
  TOKEN_URL: 'https://api.dropboxapi.com/oauth2/token',

  // App folder path (set by Dropbox when app uses App Folder permission)
  APP_FOLDER: '',  // Root of app folder (Dropbox manages this)

  // Request settings
  MAX_RETRIES: 3,
  CHUNK_SIZE: 4 * 1024 * 1024 // 4MB for chunk uploads
};

/**
 * Dropbox Cloud Provider
 *
 * Implements secure vault synchronization via Dropbox API v2.
 * Uses App Folder permission for sandboxed storage.
 *
 * SECURITY:
 * - Only handles encrypted data (ArrayBuffer)
 * - Uses App Folder permission (not full Dropbox access)
 * - Tokens stored securely via Electron SafeStorage
 * - PKCE flow for secure OAuth
 */
export class DropboxProvider extends CloudProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.clientId - Dropbox App Key
   * @param {string} config.clientSecret - Dropbox App Secret (optional for PKCE)
   * @param {string} config.redirectUri - OAuth redirect URI
   */
  constructor(config = {}) {
    super('Dropbox', 'dropbox');

    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectUri = config.redirectUri || 'http://localhost:8080/oauth/callback';

    // PKCE code verifier
    this._codeVerifier = null;

    // Cache for file metadata
    this._fileCache = new Map();

    safeLog('DropboxProvider initialized');
  }

  // ==================== Authentication ====================

  /**
   * Authenticate with Dropbox
   *
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async authenticate() {
    safeLog('Dropbox: Starting authentication...');

    // If we have a valid token, return it
    if (this._accessToken && !this.isTokenExpired()) {
      return CloudResult.success({
        accessToken: this._accessToken,
        expiresAt: this._tokenExpiry
      });
    }

    // Try to refresh using stored refresh token
    if (this._refreshToken) {
      return await this.refreshAccessToken();
    }

    // No refresh token - need OAuth flow
    return CloudResult.error(
      CloudErrorType.AUTH_EXPIRED,
      'No valid credentials. Please sign in with Dropbox.'
    );
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async refreshAccessToken() {
    safeLog('Dropbox: Refreshing access token...');

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
        client_id: this.clientId
      });

      // Add client secret if available
      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(DROPBOX_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!response.ok) {
        const error = await response.json();

        // Check for revoked/invalid refresh token
        if (error.error === 'invalid_grant') {
          this.clearTokens();
          return CloudResult.error(
            CloudErrorType.AUTH_EXPIRED,
            'Dropbox access was revoked. Please sign in again.'
          );
        }

        return CloudResult.fromHttpStatus(response.status, error.error_description);
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);

      this.setTokens(data.access_token, this._refreshToken, expiresAt);

      safeLog('Dropbox: Access token refreshed successfully');

      return CloudResult.success({
        accessToken: data.access_token,
        expiresAt
      });

    } catch (error) {
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Exchange authorization code for tokens (PKCE flow)
   *
   * @param {string} authCode - Authorization code from OAuth
   * @returns {Promise<CloudResult<{accessToken: string, refreshToken: string, expiresAt: number}>>}
   */
  async exchangeAuthCode(authCode) {
    safeLog('Dropbox: Exchanging auth code for tokens...');

    if (!this._codeVerifier) {
      return CloudResult.error(
        CloudErrorType.GENERIC,
        'PKCE code verifier not set. Start OAuth flow first.'
      );
    }

    try {
      const body = new URLSearchParams({
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: this._codeVerifier
      });

      // Add client secret if available
      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(DROPBOX_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!response.ok) {
        const error = await response.json();
        return CloudResult.error(
          CloudErrorType.AUTH_EXPIRED,
          error.error_description || 'Failed to exchange authorization code'
        );
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);

      this.setTokens(data.access_token, data.refresh_token, expiresAt);

      // Clear code verifier
      this._codeVerifier = null;

      safeLog('Dropbox: Authentication successful');

      return CloudResult.success({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      });

    } catch (error) {
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Get OAuth authorization URL with PKCE
   * @returns {Promise<string>}
   */
  async getAuthUrl() {
    // Generate PKCE parameters
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this._codeVerifier = this._base64UrlEncode(array);

    // Compute SHA-256 challenge
    const encoder = new TextEncoder();
    const data = encoder.encode(this._codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const challenge = this._base64UrlEncode(new Uint8Array(hashBuffer));

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline'  // Request refresh token
    });

    return `${DROPBOX_CONFIG.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Base64 URL encode (RFC 7636)
   * @private
   */
  _base64UrlEncode(buffer) {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // ==================== Vault Operations ====================

  /**
   * Upload encrypted vault to Dropbox App Folder
   *
   * @param {string} vaultId - Local vault identifier
   * @param {ArrayBuffer} encryptedData - Encrypted vault content
   * @param {Object} options - Upload options
   * @returns {Promise<CloudResult<string>>} - File ID on success
   */
  async uploadVault(vaultId, encryptedData, options = {}) {
    safeLog(`Dropbox: Uploading vault ${vaultId}...`);

    // Validate encrypted data
    if (!this.validateEncryptedData(encryptedData)) {
      return CloudResult.error(
        CloudErrorType.GENERIC,
        'Invalid encrypted data format'
      );
    }

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const filename = this.getVaultFilename(vaultId);
    const path = `/${filename}`;

    return await this.retryWithBackoff(async () => {
      // Dropbox uses files/upload endpoint for small files
      const response = await fetch(`${DROPBOX_CONFIG.CONTENT_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path,
            mode: 'overwrite',
            autorename: false,
            mute: true
          })
        },
        body: encryptedData
      });

      if (!response.ok) {
        const error = await response.json();
        return CloudResult.fromHttpStatus(response.status, error.error_summary || 'Upload failed');
      }

      const fileData = await response.json();
      safeLog(`Dropbox: Uploaded file ${fileData.id}`);

      // Update cache
      this._fileCache.set(filename, fileData.id);

      return CloudResult.success(fileData.id);
    });
  }

  /**
   * Download encrypted vault from Dropbox
   *
   * @param {string} vaultId - Local vault identifier
   * @param {string} fileId - Cloud file ID (optional)
   * @returns {Promise<CloudResult<VaultSyncData>>}
   */
  async downloadVault(vaultId, fileId = null) {
    safeLog(`Dropbox: Downloading vault ${vaultId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const filename = this.getVaultFilename(vaultId);
    const path = `/${filename}`;

    return await this.retryWithBackoff(async () => {
      // Download file with metadata in response headers
      const response = await fetch(`${DROPBOX_CONFIG.CONTENT_BASE}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path })
        }
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Path not found
          return CloudResult.error(
            CloudErrorType.NOT_FOUND,
            `Vault ${vaultId} not found in Dropbox`
          );
        }
        const error = await response.json();
        return CloudResult.fromHttpStatus(response.status, error.error_summary || 'Download failed');
      }

      // Metadata is in Dropbox-API-Result header
      const metadataHeader = response.headers.get('Dropbox-API-Result');
      const metadata = metadataHeader ? JSON.parse(metadataHeader) : {};

      const encryptedContent = await response.arrayBuffer();

      safeLog(`Dropbox: Downloaded ${encryptedContent.byteLength} bytes`);

      // Convert Dropbox metadata to VaultSyncMetadata
      const syncMetadata = new VaultSyncMetadata(
        metadata.id || '',
        vaultId,
        metadata.name || filename,
        metadata.server_modified ? new Date(metadata.server_modified).getTime() : Date.now(),
        metadata.size || encryptedContent.byteLength,
        metadata.content_hash || ''
      );

      return CloudResult.success(new VaultSyncData(syncMetadata, encryptedContent));
    });
  }

  /**
   * List all vault files in App Folder
   *
   * @returns {Promise<CloudResult<VaultSyncMetadata[]>>}
   */
  async listVaults() {
    safeLog('Dropbox: Listing vaults...');

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    try {
      const response = await fetch(`${DROPBOX_CONFIG.API_BASE}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: '',  // Root of app folder
          recursive: false,
          include_deleted: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return CloudResult.fromHttpStatus(response.status, error.error_summary || 'List failed');
      }

      const data = await response.json();
      const entries = data.entries || [];

      // Filter for vault files
      const vaults = entries
        .filter(entry => entry['.tag'] === 'file' &&
                        entry.name.startsWith('vault_') &&
                        entry.name.endsWith('.gpv'))
        .map(entry => {
          // Extract vaultId from filename
          const match = entry.name.match(/^vault_(.+)\.gpv$/);
          const vaultId = match ? match[1] : entry.name;

          return new VaultSyncMetadata(
            entry.id,
            vaultId,
            entry.name,
            new Date(entry.server_modified).getTime(),
            entry.size,
            entry.content_hash || ''
          );
        });

      safeLog(`Dropbox: Found ${vaults.length} vaults`);

      // Update cache
      vaults.forEach(v => this._fileCache.set(v.name, v.fileId));

      return CloudResult.success(vaults);

    } catch (error) {
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Delete a vault file from Dropbox
   *
   * @param {string} fileId - File ID or path to delete
   * @returns {Promise<CloudResult<boolean>>}
   */
  async deleteVault(fileId) {
    safeLog(`Dropbox: Deleting file ${fileId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    try {
      // Find the path for this file ID
      let path = fileId;
      if (fileId.startsWith('id:')) {
        // It's a file ID, need to get metadata first
        const metaResponse = await fetch(`${DROPBOX_CONFIG.API_BASE}/files/get_metadata`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this._accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ path: fileId })
        });

        if (metaResponse.ok) {
          const meta = await metaResponse.json();
          path = meta.path_lower || meta.path_display;
        }
      }

      const response = await fetch(`${DROPBOX_CONFIG.API_BASE}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path })
      });

      if (!response.ok) {
        const error = await response.json();
        return CloudResult.fromHttpStatus(response.status, error.error_summary || 'Delete failed');
      }

      safeLog(`Dropbox: Deleted file ${fileId}`);

      // Clear from cache
      for (const [name, id] of this._fileCache) {
        if (id === fileId) {
          this._fileCache.delete(name);
          break;
        }
      }

      return CloudResult.success(true);

    } catch (error) {
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Disconnect and revoke access
   *
   * @returns {Promise<CloudResult<boolean>>}
   */
  async disconnect() {
    safeLog('Dropbox: Disconnecting...');

    if (this._accessToken) {
      try {
        // Revoke token via Dropbox API
        await fetch(`${DROPBOX_CONFIG.API_BASE}/auth/token/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this._accessToken}`
          }
        });
        safeLog('Dropbox: Token revoked successfully');
      } catch (error) {
        safeLog(`Dropbox: Token revocation failed: ${error.message}`);
      }
    }

    this.clearTokens();
    this._fileCache.clear();
    this._codeVerifier = null;

    // Clear stored tokens
    localStorage.removeItem('genpwd_dropbox_tokens');

    return CloudResult.success(true);
  }

  // ==================== Token Storage ====================

  /**
   * Store tokens securely
   * @param {Object} tokens
   */
  async storeTokens(tokens) {
    if (window.electronAPI && await window.electronAPI.isSecureStorageAvailable()) {
      try {
        const encryptedAccess = await window.electronAPI.encryptSecret(tokens.accessToken);
        const encryptedRefresh = tokens.refreshToken
          ? await window.electronAPI.encryptSecret(tokens.refreshToken)
          : null;

        const secureData = {
          accessToken: encryptedAccess.data,
          refreshToken: encryptedRefresh ? encryptedRefresh.data : null,
          expiresAt: tokens.expiresAt,
          isEncrypted: true
        };

        localStorage.setItem('genpwd_dropbox_tokens', JSON.stringify(secureData));
        safeLog('Dropbox: Tokens stored using secure storage');
        return;
      } catch (error) {
        safeLog(`Dropbox: Secure storage failed: ${error.message}`);
      }
    }

    // Web mode - store in memory only
    if (!window.electronAPI) {
      safeLog('Dropbox: Cannot persist tokens - secure storage not available');
      return;
    }

    throw new Error('Secure storage required but failed');
  }

  /**
   * Load stored tokens
   * @returns {Promise<Object|null>}
   */
  async loadStoredTokens() {
    const stored = localStorage.getItem('genpwd_dropbox_tokens');
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);

      if (data.isEncrypted && window.electronAPI) {
        try {
          const accessResult = await window.electronAPI.decryptSecret(data.accessToken);
          if (!accessResult.success) throw new Error(accessResult.error);

          let refreshToken = null;
          if (data.refreshToken) {
            const refreshResult = await window.electronAPI.decryptSecret(data.refreshToken);
            if (!refreshResult.success) throw new Error(refreshResult.error);
            refreshToken = refreshResult.data;
          }

          return {
            accessToken: accessResult.data,
            refreshToken,
            expiresAt: data.expiresAt
          };
        } catch (error) {
          safeLog(`Dropbox: Failed to decrypt tokens: ${error.message}`);
          return null;
        }
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Initialize provider with stored tokens
   */
  async init() {
    const tokens = await this.loadStoredTokens();
    if (tokens) {
      this.setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
      safeLog('Dropbox: Loaded stored tokens');
    }
  }
}

// Export singleton factory
let _instance = null;

/**
 * Get or create DropboxProvider instance
 * @param {Object} config - Provider configuration
 * @returns {DropboxProvider}
 */
export function getDropboxProvider(config = {}) {
  if (!_instance) {
    _instance = new DropboxProvider(config);
  }
  return _instance;
}
