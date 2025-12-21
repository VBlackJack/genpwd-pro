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

// src/js/core/sync/models.js - Cloud Sync Data Models
// Mirrors Android CloudResult architecture for cross-platform consistency

/**
 * Cloud Error Types
 * Maps to Android CloudErrorType enum for consistent error handling
 */
export const CloudErrorType = Object.freeze({
  /** Authentication token expired or invalid - requires re-login */
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  /** Permission denied (403) - user revoked access or insufficient scopes */
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  /** Network error - no internet, timeout, DNS failure */
  NETWORK: 'NETWORK',

  /** Storage quota exceeded on cloud provider */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  /** Conflict detected - remote file was modified */
  CONFLICT: 'CONFLICT',

  /** Resource not found (404) */
  NOT_FOUND: 'NOT_FOUND',

  /** Rate limited (429) - too many requests */
  RATE_LIMITED: 'RATE_LIMITED',

  /** Provider-specific error */
  PROVIDER_ERROR: 'PROVIDER_ERROR',

  /** Generic/unknown error */
  GENERIC: 'GENERIC'
});

/**
 * CloudResult - Functional Result Type for Cloud Operations
 *
 * Provides a type-safe way to handle success/error states without exceptions.
 * Mirrors Android's sealed class CloudResult<T> pattern.
 *
 * @template T - The type of data on success
 *
 * @example
 * // Creating results
 * const success = CloudResult.success({ fileId: 'abc123' });
 * const error = CloudResult.error(CloudErrorType.NETWORK, 'Connection timeout');
 *
 * // Handling results
 * if (result.isSuccess) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Error:', result.errorType, result.message);
 * }
 *
 * // Functional style
 * result.map(data => transform(data))
 *       .onSuccess(data => console.log(data))
 *       .onError((type, msg) => showError(msg));
 */
export class CloudResult {
  /**
   * @param {boolean} success - Whether operation succeeded
   * @param {T|null} data - Result data (on success)
   * @param {string|null} errorType - Error type from CloudErrorType (on error)
   * @param {string|null} message - Error message (on error)
   * @param {Error|null} cause - Original error/exception (optional)
   */
  constructor(success, data = null, errorType = null, message = null, cause = null) {
    this._success = success;
    this._data = data;
    this._errorType = errorType;
    this._message = message;
    this._cause = cause;

    // Freeze to prevent modification
    Object.freeze(this);
  }

  // ==================== Static Factories ====================

  /**
   * Create a success result
   * @template T
   * @param {T} data - The success data
   * @returns {CloudResult<T>}
   */
  static success(data) {
    return new CloudResult(true, data, null, null, null);
  }

  /**
   * Create an error result
   * @param {string} errorType - Error type from CloudErrorType
   * @param {string} message - Human-readable error message
   * @param {Error|null} cause - Original exception (optional)
   * @returns {CloudResult<null>}
   */
  static error(errorType, message, cause = null) {
    return new CloudResult(false, null, errorType, message, cause);
  }

  /**
   * Create error from HTTP status code
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   * @returns {CloudResult<null>}
   */
  static fromHttpStatus(status, message = '') {
    const errorMap = {
      401: CloudErrorType.AUTH_EXPIRED,
      403: CloudErrorType.PERMISSION_DENIED,
      404: CloudErrorType.NOT_FOUND,
      409: CloudErrorType.CONFLICT,
      429: CloudErrorType.RATE_LIMITED,
      507: CloudErrorType.QUOTA_EXCEEDED
    };

    const errorType = errorMap[status] || CloudErrorType.GENERIC;
    const defaultMessages = {
      401: 'Authentication expired. Please sign in again.',
      403: 'Permission denied. Please re-authorize the app.',
      404: 'Resource not found.',
      409: 'Conflict detected. Remote file was modified.',
      429: 'Too many requests. Please try again later.',
      507: 'Storage quota exceeded.'
    };

    return CloudResult.error(
      errorType,
      message || defaultMessages[status] || `HTTP Error ${status}`
    );
  }

  /**
   * Create error from network/fetch exception
   * @param {Error} error - The caught error
   * @returns {CloudResult<null>}
   */
  static fromNetworkError(error) {
    // Detect network-specific errors
    const networkErrors = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'fetch failed'];
    const isNetworkError = networkErrors.some(code =>
      error.message?.includes(code) || error.code === code
    );

    if (isNetworkError || error.name === 'TypeError') {
      return CloudResult.error(
        CloudErrorType.NETWORK,
        'Network error. Please check your internet connection.',
        error
      );
    }

    return CloudResult.error(
      CloudErrorType.GENERIC,
      error.message || 'An unexpected error occurred',
      error
    );
  }

  // ==================== Properties ====================

  /** @returns {boolean} True if operation succeeded */
  get isSuccess() {
    return this._success;
  }

  /** @returns {boolean} True if operation failed */
  get isError() {
    return !this._success;
  }

  /** @returns {T|null} The success data (null if error) */
  get data() {
    return this._data;
  }

  /** @returns {string|null} Error type from CloudErrorType (null if success) */
  get errorType() {
    return this._errorType;
  }

  /** @returns {string|null} Error message (null if success) */
  get message() {
    return this._message;
  }

  /** @returns {Error|null} Original exception (optional) */
  get cause() {
    return this._cause;
  }

  // ==================== Functional Methods ====================

  /**
   * Transform success data
   * @template U
   * @param {function(T): U} fn - Transform function
   * @returns {CloudResult<U>} New result with transformed data (or same error)
   */
  map(fn) {
    if (this.isSuccess) {
      try {
        return CloudResult.success(fn(this._data));
      } catch (error) {
        return CloudResult.error(CloudErrorType.GENERIC, error.message, error);
      }
    }
    return this;
  }

  /**
   * Chain async operations
   * @template U
   * @param {function(T): Promise<CloudResult<U>>} fn - Async transform
   * @returns {Promise<CloudResult<U>>}
   */
  async flatMap(fn) {
    if (this.isSuccess) {
      try {
        return await fn(this._data);
      } catch (error) {
        return CloudResult.fromNetworkError(error);
      }
    }
    return this;
  }

  /**
   * Execute callback on success
   * @param {function(T): void} fn - Success callback
   * @returns {CloudResult<T>} Same result for chaining
   */
  onSuccess(fn) {
    if (this.isSuccess) {
      fn(this._data);
    }
    return this;
  }

  /**
   * Execute callback on error
   * @param {function(string, string, Error|null): void} fn - Error callback (type, message, cause)
   * @returns {CloudResult<T>} Same result for chaining
   */
  onError(fn) {
    if (this.isError) {
      fn(this._errorType, this._message, this._cause);
    }
    return this;
  }

  /**
   * Get data or default value
   * @param {T} defaultValue - Value to return on error
   * @returns {T}
   */
  getOrDefault(defaultValue) {
    return this.isSuccess ? this._data : defaultValue;
  }

  /**
   * Get data or throw error
   * @returns {T}
   * @throws {Error} If result is an error
   */
  getOrThrow() {
    if (this.isError) {
      const error = new Error(this._message);
      error.errorType = this._errorType;
      error.cause = this._cause;
      throw error;
    }
    return this._data;
  }

  /**
   * Check if error is recoverable (can retry)
   * @returns {boolean}
   */
  isRecoverable() {
    const recoverableTypes = [
      CloudErrorType.NETWORK,
      CloudErrorType.RATE_LIMITED
    ];
    return this.isError && recoverableTypes.includes(this._errorType);
  }

  /**
   * Check if error requires re-authentication
   * @returns {boolean}
   */
  requiresReauth() {
    return this.isError && (
      this._errorType === CloudErrorType.AUTH_EXPIRED ||
      this._errorType === CloudErrorType.PERMISSION_DENIED
    );
  }

  // ==================== Serialization ====================

  /**
   * Convert to plain object (for IPC/logging)
   * @returns {Object}
   */
  toJSON() {
    return {
      success: this._success,
      data: this._data,
      errorType: this._errorType,
      message: this._message
    };
  }

  /**
   * Create from plain object
   * @param {Object} obj - Plain object
   * @returns {CloudResult}
   */
  static fromJSON(obj) {
    if (obj.success) {
      return CloudResult.success(obj.data);
    }
    return CloudResult.error(obj.errorType, obj.message);
  }
}

/**
 * Vault Sync Metadata
 * Represents metadata about a synced vault file
 */
export class VaultSyncMetadata {
  /**
   * @param {string} fileId - Cloud provider file ID
   * @param {string} vaultId - Local vault ID
   * @param {string} name - Vault name
   * @param {number} modifiedTime - Last modified timestamp (ms)
   * @param {number} size - File size in bytes
   * @param {string} checksum - Content hash/ETag
   */
  constructor(fileId, vaultId, name, modifiedTime, size = 0, checksum = '') {
    this.fileId = fileId;
    this.vaultId = vaultId;
    this.name = name;
    this.modifiedTime = modifiedTime;
    this.size = size;
    this.checksum = checksum;
  }

  /**
   * Create from Google Drive file metadata
   * @param {Object} driveFile - Google Drive file object
   * @returns {VaultSyncMetadata}
   */
  static fromDriveFile(driveFile) {
    // Extract vaultId from filename (format: vault_{vaultId}.gpv)
    const match = driveFile.name?.match(/^vault_(.+)\.gpv$/);
    const vaultId = match ? match[1] : driveFile.id;

    return new VaultSyncMetadata(
      driveFile.id,
      vaultId,
      driveFile.name || 'Unknown',
      driveFile.modifiedTime ? new Date(driveFile.modifiedTime).getTime() : Date.now(),
      parseInt(driveFile.size || '0', 10),
      driveFile.md5Checksum || ''
    );
  }
}

/**
 * Vault Sync Data
 * Contains the encrypted vault content and metadata
 */
export class VaultSyncData {
  /**
   * @param {VaultSyncMetadata} metadata - File metadata
   * @param {ArrayBuffer|null} encryptedContent - Encrypted vault data
   */
  constructor(metadata, encryptedContent = null) {
    this.metadata = metadata;
    this.encryptedContent = encryptedContent;
  }
}

/**
 * Sync State
 * Tracks the current sync operation state
 */
export const SyncState = Object.freeze({
  IDLE: 'IDLE',
  SYNCING: 'SYNCING',
  UPLOADING: 'UPLOADING',
  DOWNLOADING: 'DOWNLOADING',
  RESOLVING_CONFLICT: 'RESOLVING_CONFLICT',
  ERROR: 'ERROR'
});

/**
 * Conflict Resolution Strategy
 */
export const ConflictStrategy = Object.freeze({
  /** Keep local version, overwrite remote */
  LOCAL_WINS: 'LOCAL_WINS',

  /** Keep remote version, overwrite local */
  REMOTE_WINS: 'REMOTE_WINS',

  /** Keep both versions (create backup) */
  KEEP_BOTH: 'KEEP_BOTH',

  /** Merge changes (if possible) */
  MERGE: 'MERGE',

  /** Ask user to decide */
  ASK_USER: 'ASK_USER'
});
