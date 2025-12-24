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

// src/js/core/sync/providers/google-drive-provider.js - Google Drive Cloud Provider
// Implements CloudProvider interface for Google Drive API v3

import { CloudProvider } from '../cloud-provider.js';
import { CloudResult, CloudErrorType, VaultSyncMetadata, VaultSyncData } from '../models.js';
import { safeLog } from '../../../utils/logger.js';

/**
 * Google Drive API Configuration
 */
const DRIVE_CONFIG = {
  // API endpoints
  API_BASE: 'https://www.googleapis.com/drive/v3',
  UPLOAD_BASE: 'https://www.googleapis.com/upload/drive/v3',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',

  // OAuth scopes - appDataFolder keeps files hidden from user
  SCOPES: [
    'https://www.googleapis.com/auth/drive.appdata'
  ],

  // File properties
  MIME_TYPE: 'application/octet-stream',
  APP_FOLDER: 'appDataFolder',

  // Request settings
  MAX_RETRIES: 3,
  CHUNK_SIZE: 5 * 1024 * 1024 // 5MB for resumable uploads
};

/**
 * Google Drive Cloud Provider
 *
 * Implements secure vault synchronization via Google Drive API.
 * Uses appDataFolder for hidden, app-specific storage.
 *
 * SECURITY:
 * - Only handles encrypted data (ArrayBuffer)
 * - Uses appDataFolder scope (not full Drive access)
 * - Tokens stored securely via CredentialManager (TODO)
 */
export class GoogleDriveProvider extends CloudProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.clientId - OAuth client ID
   * @param {string} config.clientSecret - OAuth client secret (for desktop apps)
   * @param {string} config.redirectUri - OAuth redirect URI
   */
  constructor(config = {}) {
    super('Google Drive', 'google-drive');

    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.redirectUri = config.redirectUri || 'http://localhost:8080/oauth/callback';

    // Cache for file metadata
    this._fileCache = new Map();

    safeLog('GoogleDriveProvider initialized');
  }

  // ==================== Authentication ====================

  /**
   * Authenticate with Google Drive
   *
   * Flow:
   * 1. Check for stored refresh token
   * 2. If exists, refresh access token
   * 3. If not, return error requiring OAuth flow
   *
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async authenticate() {
    safeLog('GoogleDrive: Starting authentication...');

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
      'No valid credentials. Please sign in with Google.'
    );
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<CloudResult<{accessToken: string, expiresAt: number}>>}
   */
  async refreshAccessToken() {
    safeLog('GoogleDrive: Refreshing access token...');

    try {
      const response = await fetch(DRIVE_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this._refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const error = await response.json();

        // Check for revoked/invalid refresh token
        if (error.error === 'invalid_grant') {
          this.clearTokens();
          return CloudResult.error(
            CloudErrorType.AUTH_EXPIRED,
            'Google access was revoked. Please sign in again.'
          );
        }

        return CloudResult.fromHttpStatus(response.status, error.error_description);
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);

      this.setTokens(data.access_token, this._refreshToken, expiresAt);

      safeLog('GoogleDrive: Access token refreshed successfully');

      return CloudResult.success({
        accessToken: data.access_token,
        expiresAt
      });

    } catch (error) {
      return CloudResult.fromNetworkError(error);
    }
  }

  /**
   * Exchange authorization code for tokens
   * Called after OAuth redirect
   *
   * @param {string} authCode - Authorization code from OAuth
   * @returns {Promise<CloudResult<{accessToken: string, refreshToken: string, expiresAt: number}>>}
   */
  async exchangeAuthCode(authCode) {
    safeLog('GoogleDrive: Exchanging auth code for tokens...');

    try {
      const response = await fetch(DRIVE_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: authCode,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code'
        })
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

      safeLog('GoogleDrive: Authentication successful');

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
   * Get OAuth authorization URL
   * @returns {string}
   */
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: DRIVE_CONFIG.SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${DRIVE_CONFIG.AUTH_URL}?${params.toString()}`;
  }

  // ==================== Vault Operations ====================

  /**
   * Upload encrypted vault to Google Drive appDataFolder
   *
   * @param {string} vaultId - Local vault identifier
   * @param {ArrayBuffer} encryptedData - Encrypted vault content
   * @param {Object} options - Upload options (unused)
   * @returns {Promise<CloudResult<string>>} - File ID on success
   */
  async uploadVault(vaultId, encryptedData, options = {}) {
    safeLog(`GoogleDrive: Uploading vault ${vaultId}...`);

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

    // Check for existing file
    let fileId = options.existingFileId;
    if (!fileId) {
      const existingResult = await this.findVaultFile(vaultId);
      if (existingResult.isSuccess && existingResult.data) {
        fileId = existingResult.data.fileId;
      }
    }

    return await this.retryWithBackoff(async () => {
      if (fileId) {
        // Update existing file
        return await this.updateFile(fileId, encryptedData);
      } else {
        // Create new file
        return await this.createFile(filename, encryptedData);
      }
    });
  }

  /**
   * Create new file in appDataFolder
   * @private
   */
  async createFile(filename, data) {
    const metadata = {
      name: filename,
      parents: [DRIVE_CONFIG.APP_FOLDER],
      mimeType: DRIVE_CONFIG.MIME_TYPE
    };

    // Use multipart upload for small files
    const boundary = '-------GenPwdProBoundary' + Date.now();

    const body = this.buildMultipartBody(metadata, data, boundary);

    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.UPLOAD_BASE}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );

    if (result.isError) {
      return result;
    }

    const fileData = await result.data.json();
    safeLog(`GoogleDrive: Created file ${fileData.id}`);

    // Update cache
    this._fileCache.set(filename, fileData.id);

    return CloudResult.success(fileData.id);
  }

  /**
   * Update existing file
   * @private
   */
  async updateFile(fileId, data) {
    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': DRIVE_CONFIG.MIME_TYPE
        },
        body: data
      }
    );

    if (result.isError) {
      return result;
    }

    const fileData = await result.data.json();
    safeLog(`GoogleDrive: Updated file ${fileData.id}`);

    return CloudResult.success(fileData.id);
  }

  /**
   * Download encrypted vault from Google Drive
   *
   * @param {string} vaultId - Local vault identifier
   * @param {string} fileId - Cloud file ID (optional)
   * @returns {Promise<CloudResult<VaultSyncData>>}
   */
  async downloadVault(vaultId, fileId = null, options = {}) {
    safeLog(`GoogleDrive: Downloading vault ${vaultId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    // Find file if ID not provided
    if (!fileId) {
      const findResult = await this.findVaultFile(vaultId, options);
      if (findResult.isError) {
        return findResult;
      }
      if (!findResult.data) {
        return CloudResult.error(
          CloudErrorType.NOT_FOUND,
          `Vault ${vaultId} not found in Google Drive`
        );
      }
      fileId = findResult.data.fileId;
    }

    return await this.retryWithBackoff(async () => {
      // Get file metadata first
      const metaResult = await this.getFileMetadata(fileId);
      if (metaResult.isError) {
        return metaResult;
      }

      // Download file content
      const contentResult = await this.fetchWithAuth(
        `${DRIVE_CONFIG.API_BASE}/files/${fileId}?alt=media`,
        { method: 'GET' }
      );

      if (contentResult.isError) {
        return contentResult;
      }

      const encryptedContent = await contentResult.data.arrayBuffer();

      safeLog(`GoogleDrive: Downloaded ${encryptedContent.byteLength} bytes`);

      return CloudResult.success(new VaultSyncData(
        metaResult.data,
        encryptedContent
      ));
    });
  }

  /**
   * List all vault files in appDataFolder
   *
   * @returns {Promise<CloudResult<VaultSyncMetadata[]>>}
   */
  async listVaults() {
    safeLog('GoogleDrive: Listing vaults...');

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const params = new URLSearchParams({
      spaces: DRIVE_CONFIG.APP_FOLDER,
      q: "name contains 'vault_' and name contains '.gpv'",
      fields: 'files(id,name,modifiedTime,size,md5Checksum)',
      pageSize: '100'
    });

    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.API_BASE}/files?${params.toString()}`,
      { method: 'GET' }
    );

    if (result.isError) {
      return result;
    }

    const data = await result.data.json();
    const vaults = (data.files || []).map(file => VaultSyncMetadata.fromDriveFile(file));

    safeLog(`GoogleDrive: Found ${vaults.length} vaults`);

    // Update cache
    vaults.forEach(v => this._fileCache.set(v.name, v.fileId));

    return CloudResult.success(vaults);
  }

  /**
   * Delete a vault file from Google Drive
   *
   * @param {string} fileId - File ID to delete
   * @returns {Promise<CloudResult<boolean>>}
   */
  async deleteVault(fileId) {
    safeLog(`GoogleDrive: Deleting file ${fileId}...`);

    // Ensure authenticated
    const authResult = await this.authenticate();
    if (authResult.isError) {
      return authResult;
    }

    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.API_BASE}/files/${fileId}`,
      { method: 'DELETE' }
    );

    if (result.isError) {
      return result;
    }

    safeLog(`GoogleDrive: Deleted file ${fileId}`);

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
    safeLog('GoogleDrive: Disconnecting...');

    if (this._accessToken) {
      try {
        // Revoke token
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this._accessToken}`, {
          method: 'POST'
        });
      } catch (error) {
        safeLog(`GoogleDrive: Token revocation failed: ${error.message}`);
      }
    }

    this.clearTokens();
    this._fileCache.clear();

    return CloudResult.success(true);
  }

  // ==================== Helper Methods ====================

  /**
   * Find vault file by vaultId
   * @private
   */
  async findVaultFile(vaultId) {
    const filename = this.getVaultFilename(vaultId);

    // Check cache first
    if (this._fileCache.has(filename)) {
      const fileId = this._fileCache.get(filename);
      return CloudResult.success({ fileId, name: filename });
    }

    // Query API
    const params = new URLSearchParams({
      spaces: DRIVE_CONFIG.APP_FOLDER,
      q: `name = '${filename}'`,
      fields: 'files(id,name,modifiedTime,size,md5Checksum)'
    });

    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.API_BASE}/files?${params.toString()}`,
      { method: 'GET' }
    );

    if (result.isError) {
      return result;
    }

    const data = await result.data.json();
    const files = data.files || [];

    if (files.length === 0) {
      return CloudResult.success(null);
    }

    const file = files[0];
    this._fileCache.set(filename, file.id);

    return CloudResult.success(VaultSyncMetadata.fromDriveFile(file));
  }

  /**
   * Get file metadata by ID
   * @private
   */
  async getFileMetadata(fileId) {
    const params = new URLSearchParams({
      fields: 'id,name,modifiedTime,size,md5Checksum'
    });

    const result = await this.fetchWithAuth(
      `${DRIVE_CONFIG.API_BASE}/files/${fileId}?${params.toString()}`,
      { method: 'GET' }
    );

    if (result.isError) {
      return result;
    }

    const file = await result.data.json();
    return CloudResult.success(VaultSyncMetadata.fromDriveFile(file));
  }

  /**
   * Build multipart request body for file upload
   * @private
   */
  buildMultipartBody(metadata, data, boundary) {
    const metadataJson = JSON.stringify(metadata);

    // Create parts
    const parts = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadataJson,
      `--${boundary}`,
      `Content-Type: ${DRIVE_CONFIG.MIME_TYPE}`,
      'Content-Transfer-Encoding: base64',
      '',
      this.arrayBufferToBase64(data),
      `--${boundary}--`
    ];

    return parts.join('\r\n');
  }

  /**
   * Convert ArrayBuffer to Base64
   * @private
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Store tokens securely (via IPC to main process)
   * @param {Object} tokens
   */
  async storeTokens(tokens) {
    // Attempt to use secure storage if available
    if (window.electronAPI && await window.electronAPI.isSecureStorageAvailable()) {
      try {
        const encryptedAccess = await window.electronAPI.encryptSecret(tokens.accessToken);
        // Refresh token is critical, ensure it is encrypted
        const encryptedRefresh = tokens.refreshToken
          ? await window.electronAPI.encryptSecret(tokens.refreshToken)
          : null;

        const secureData = {
          accessToken: encryptedAccess.data,
          refreshToken: encryptedRefresh ? encryptedRefresh.data : null,
          expiresAt: tokens.expiresAt,
          isEncrypted: true
        };

        localStorage.setItem('genpwd_gdrive_tokens', JSON.stringify(secureData));
        safeLog('GoogleDrive: Tokens stored using secure storage');
        return;
      } catch (error) {
        safeLog(`GoogleDrive: Secure storage failed, falling back to localStorage: ${error.message}`);
      }
    }

    // SECURITY: Refuse to store tokens insecurely - require Electron secure storage
    if (!window.electronAPI) {
      safeLog('GoogleDrive: Cannot store tokens - secure storage not available (web mode)');
      // Store only in memory for this session - user will need to re-authenticate
      this.tokens = tokens;
      return;
    }

    // If we get here in Electron, secure storage failed - don't fall back to insecure
    throw new Error('Secure storage required but failed - cannot store OAuth tokens');
  }

  /**
   * Load stored tokens
   * @returns {Promise<Object|null>}
   */
  async loadStoredTokens() {
    const stored = localStorage.getItem('genpwd_gdrive_tokens');
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);

      // Handle encrypted data
      if (data.isEncrypted && window.electronAPI) {
        try {
          // Decrypt access token
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
          safeLog('[GoogleDrive] Failed to decrypt tokens:', error.message);
          return null;
        }
      }

      // Legacy/Plain data
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
      safeLog('GoogleDrive: Loaded stored tokens');
    }
  }
}

// Export singleton factory
let _instance = null;

/**
 * Get or create GoogleDriveProvider instance
 * @param {Object} config - Provider configuration
 * @returns {GoogleDriveProvider}
 */
export function getGoogleDriveProvider(config = {}) {
  if (!_instance) {
    _instance = new GoogleDriveProvider(config);
  }
  return _instance;
}
