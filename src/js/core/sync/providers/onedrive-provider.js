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

// src/js/core/sync/providers/onedrive-provider.js - Microsoft OneDrive Cloud Provider
// Implements CloudProvider interface for Microsoft Graph API

import { CloudProvider } from '../cloud-provider.js';
import { CloudResult, CloudErrorType, VaultSyncMetadata, VaultSyncData } from '../models.js';
import { safeLog } from '../../../utils/logger.js';

/**
 * Microsoft OneDrive API Configuration
 * Uses Microsoft Graph API v1.0
 */
const ONEDRIVE_CONFIG = {
  // API endpoints
  API_BASE: 'https://graph.microsoft.com/v1.0',
  AUTH_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',

  // OAuth scopes - AppFolder keeps files in dedicated app folder
  SCOPES: [
    'Files.ReadWrite.AppFolder',
    'offline_access'
  ],

  // File properties
  MIME_TYPE: 'application/octet-stream',
  APP_FOLDER: '/drive/special/approot',

  // Request settings
  MAX_RETRIES: 3,
  CHUNK_SIZE: 4 * 1024 * 1024 // 4MB for OneDrive chunk uploads
};

/**
 * Microsoft OneDrive Cloud Provider
 *
 * Implements secure vault synchronization via Microsoft Graph API.
 * Uses AppFolder (special/approot) for app-specific storage.
 *
 * SECURITY:
 * - Only handles encrypted data (ArrayBuffer)
 * - Uses Files.ReadWrite.AppFolder scope (not full OneDrive access)
 * - Tokens stored securely via Electron SafeStorage
 */
export class OneDriveProvider extends CloudProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.clientId - OAuth client ID (Azure AD App Registration)
   * @param {string} config.clientSecret - OAuth client secret (optional for PKCE)
   * @param {string} config.redirectUri - OAuth redirect URI
   */
  constructor(config = {}) {
    super('Microsoft OneDrive', 'onedrive');

    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectUri = config.redirectUri || 'http://localhost:8080/oauth/callback';

    // PKCE code verifier for secure auth flow
    this._codeVerifier = null;

    // Cache for file metadata
    this._fileCache = new Map();

    safeLog('OneDriveProvider initialized');
  }

  // ==================== Authentication ====================

  /**
   * Authenticate with Microsoft OneDrive
   *
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async authenticate() {
    safeLog('OneDrive: Starting authentication...');

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
      'No valid credentials. Please sign in with Microsoft.'
    );
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async refreshAccessToken() {
    safeLog('OneDrive: Refreshing access token...');

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        refresh_token: this._refreshToken,
        grant_type: 'refresh_token',
        scope: ONEDRIVE_CONFIG.SCOPES.join(' ')
      });

      // Add client secret if available (confidential client)
      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(ONEDRIVE_CONFIG.TOKEN_URL, {
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
            'Microsoft access was revoked. Please sign in again.'
          );
        }

        return CloudResult.fromHttpStatus(response.status, error.error_description);
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);

      // OneDrive may issue new refresh token
      const refreshToken = data.refresh_token || this._refreshToken;
      this.setTokens(data.access_token, refreshToken, expiresAt);

      safeLog('OneDrive: Access token refreshed successfully');

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
    safeLog('OneDrive: Exchanging auth code for tokens...');

    if (!this._codeVerifier) {
      return CloudResult.error(
        CloudErrorType.GENERIC,
        'PKCE code verifier not set. Start OAuth flow first.'
      );
    }

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        code: authCode,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: this._codeVerifier
      });

      // Add client secret if available
      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(ONEDRIVE_CONFIG.TOKEN_URL, {
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

      // Clear code verifier after successful exchange
      this._codeVerifier = null;

      safeLog('OneDrive: Authentication successful');

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
   * Generate PKCE code verifier and challenge
   * @returns {{verifier: string, challenge: string}}
   */
  generatePKCE() {
    // Generate random 43-character code verifier
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = this._base64UrlEncode(array);

    this._codeVerifier = verifier;

    // Generate SHA-256 challenge
    // Note: For browser, we use SubtleCrypto
    return { verifier, challenge: null }; // Challenge computed async
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
      scope: ONEDRIVE_CONFIG.SCOPES.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      response_mode: 'query'
    });

    return `${ONEDRIVE_CONFIG.AUTH_URL}?${params.toString()}`;
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
   * Upload encrypted vault to OneDrive AppFolder
   *
   * @param {string} vaultId - Local vault identifier
   * @param {ArrayBuffer} encryptedData - Encrypted vault content
   * @param {Object} options - Upload options
   * @returns {Promise<CloudResult<string>>} - File ID on success
   */
  async uploadVault(vaultId, encryptedData, options = {}) {
    safeLog(`OneDrive: Uploading vault ${vaultId}...`);

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

    return await this.retryWithBackoff(async () => {
      // OneDrive: Simple PUT to path creates or updates file
      const url = `${ONEDRIVE_CONFIG.API_BASE}/me${ONEDRIVE_CONFIG.APP_FOLDER}:/${filename}:/content`;

      const result = await this.fetchWithAuth(url, {
        method: 'PUT',
        headers: {
          'Content-Type': ONEDRIVE_CONFIG.MIME_TYPE
        },
        body: encryptedData
      });

      if (result.isError) {
        return result;
      }

      const fileData = await result.data.json();
      safeLog(`OneDrive: Uploaded file ${fileData.id}`);

      // Update cache
      this._fileCache.set(filename, fileData.id);

      return CloudResult.success(fileData.id);
    });
  }

  /**
   * Download encrypted vault from OneDrive
   *
   * @param {string} vaultId - Local vault identifier
   * @param {string} fileId - Cloud file ID (optional)
   * @returns {Promise<CloudResult<VaultSyncData>>}
   */
  async downloadVault(vaultId, fileId = null) {
    safeLog(`OneDrive: Downloading vault ${vaultId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const filename = this.getVaultFilename(vaultId);

    return await this.retryWithBackoff(async () => {
      // Get file metadata first
      const metaUrl = `${ONEDRIVE_CONFIG.API_BASE}/me${ONEDRIVE_CONFIG.APP_FOLDER}:/${filename}`;
      const metaResult = await this.fetchWithAuth(metaUrl, { method: 'GET' });

      if (metaResult.isError) {
        if (metaResult.errorType === CloudErrorType.NOT_FOUND) {
          return CloudResult.error(
            CloudErrorType.NOT_FOUND,
            `Vault ${vaultId} not found in OneDrive`
          );
        }
        return metaResult;
      }

      const metadata = await metaResult.data.json();

      // Download file content
      const contentUrl = `${ONEDRIVE_CONFIG.API_BASE}/me${ONEDRIVE_CONFIG.APP_FOLDER}:/${filename}:/content`;
      const contentResult = await this.fetchWithAuth(contentUrl, { method: 'GET' });

      if (contentResult.isError) {
        return contentResult;
      }

      const encryptedContent = await contentResult.data.arrayBuffer();

      safeLog(`OneDrive: Downloaded ${encryptedContent.byteLength} bytes`);

      // Convert OneDrive metadata to VaultSyncMetadata
      const syncMetadata = new VaultSyncMetadata(
        metadata.id,
        vaultId,
        metadata.name,
        new Date(metadata.lastModifiedDateTime).getTime(),
        metadata.size,
        metadata.file?.hashes?.sha256Hash || ''
      );

      return CloudResult.success(new VaultSyncData(syncMetadata, encryptedContent));
    });
  }

  /**
   * List all vault files in AppFolder
   *
   * @returns {Promise<CloudResult<VaultSyncMetadata[]>>}
   */
  async listVaults() {
    safeLog('OneDrive: Listing vaults...');

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    // List children of AppFolder
    const url = `${ONEDRIVE_CONFIG.API_BASE}/me${ONEDRIVE_CONFIG.APP_FOLDER}/children`;

    const result = await this.fetchWithAuth(url, { method: 'GET' });

    if (result.isError) {
      return result;
    }

    const data = await result.data.json();
    const files = data.value || [];

    // Filter for vault files
    const vaults = files
      .filter(file => file.name.startsWith('vault_') && file.name.endsWith('.gpv'))
      .map(file => {
        // Extract vaultId from filename (vault_{vaultId}.gpv)
        const match = file.name.match(/^vault_(.+)\.gpv$/);
        const vaultId = match ? match[1] : file.name;

        return new VaultSyncMetadata(
          file.id,
          vaultId,
          file.name,
          new Date(file.lastModifiedDateTime).getTime(),
          file.size,
          file.file?.hashes?.sha256Hash || ''
        );
      });

    safeLog(`OneDrive: Found ${vaults.length} vaults`);

    // Update cache
    vaults.forEach(v => this._fileCache.set(v.name, v.fileId));

    return CloudResult.success(vaults);
  }

  /**
   * Delete a vault file from OneDrive
   *
   * @param {string} fileId - File ID to delete
   * @returns {Promise<CloudResult<boolean>>}
   */
  async deleteVault(fileId) {
    safeLog(`OneDrive: Deleting file ${fileId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const url = `${ONEDRIVE_CONFIG.API_BASE}/me/drive/items/${fileId}`;
    const result = await this.fetchWithAuth(url, { method: 'DELETE' });

    if (result.isError) {
      return result;
    }

    safeLog(`OneDrive: Deleted file ${fileId}`);

    // Clear from cache
    for (const [name, id] of this._fileCache) {
      if (id === fileId) {
        this._fileCache.delete(name);
        break;
      }
    }

    return CloudResult.success(true);
  }

  /**
   * Disconnect and revoke access
   *
   * @returns {Promise<CloudResult<boolean>>}
   */
  async disconnect() {
    safeLog('OneDrive: Disconnecting...');

    // Microsoft doesn't have a simple token revocation endpoint like Google
    // The user must revoke access manually at https://account.live.com/consent/Manage
    // We just clear local tokens

    this.clearTokens();
    this._fileCache.clear();
    this._codeVerifier = null;

    // Clear stored tokens
    localStorage.removeItem('genpwd_onedrive_tokens');

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

        localStorage.setItem('genpwd_onedrive_tokens', JSON.stringify(secureData));
        safeLog('OneDrive: Tokens stored using secure storage');
        return;
      } catch (error) {
        safeLog(`OneDrive: Secure storage failed: ${error.message}`);
      }
    }

    // Web mode - store in memory only
    if (!window.electronAPI) {
      safeLog('OneDrive: Cannot persist tokens - secure storage not available');
      return;
    }

    throw new Error('Secure storage required but failed');
  }

  /**
   * Load stored tokens
   * @returns {Promise<Object|null>}
   */
  async loadStoredTokens() {
    const stored = localStorage.getItem('genpwd_onedrive_tokens');
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
          safeLog(`OneDrive: Failed to decrypt tokens: ${error.message}`);
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
      safeLog('OneDrive: Loaded stored tokens');
    }
  }
}

// Export singleton factory
let _instance = null;

/**
 * Get or create OneDriveProvider instance
 * @param {Object} config - Provider configuration
 * @returns {OneDriveProvider}
 */
export function getOneDriveProvider(config = {}) {
  if (!_instance) {
    _instance = new OneDriveProvider(config);
  }
  return _instance;
}
