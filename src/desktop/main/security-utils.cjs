/*
 * Copyright 2026 Julien Bombled
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

/**
 * Security Utilities for Electron Main Process
 *
 * Provides security-related utilities including:
 * - Path validation and sanitization
 * - Admin privilege detection
 * - Secure storage operations
 * - Rate limiting
 *
 * @module security-utils
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { safeStorage, app } = require('electron');

/**
 * Validate and sanitize file paths
 */
class PathValidator {
  /**
   * Create a PathValidator instance
   * @param {Object} options - Configuration options
   * @param {string[]} options.allowedExtensions - Allowed file extensions
   * @param {string[]} options.allowedDirectories - Allowed base directories
   */
  constructor(options = {}) {
    this.allowedExtensions = options.allowedExtensions || ['.gpdb', '.json', '.csv', '.kdbx'];
    this.allowedDirectories = options.allowedDirectories || [];
  }

  /**
   * Validate a file path for security issues
   * @param {string} filePath - Path to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validate(filePath, options = {}) {
    const errors = [];

    // Check for null/undefined
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, errors: ['Invalid file path'] };
    }

    // Check for null bytes (path traversal attack)
    if (filePath.includes('\0')) {
      return { valid: false, errors: ['Invalid path: contains null bytes'] };
    }

    // Normalize path to handle .. traversal
    const normalizedPath = path.normalize(filePath);

    // Check for directory traversal attempts
    if (normalizedPath.includes('..')) {
      errors.push('Invalid path: directory traversal not allowed');
    }

    // Check if path is absolute (required for security)
    if (options.requireAbsolute && !path.isAbsolute(normalizedPath)) {
      errors.push('Invalid path: must be absolute');
    }

    // Check allowed directories
    if (this.allowedDirectories.length > 0 && options.checkAllowedDirs) {
      const isAllowed = this.allowedDirectories.some(dir =>
        normalizedPath.startsWith(path.normalize(dir))
      );
      if (!isAllowed) {
        errors.push('Invalid path: not in allowed directory');
      }
    }

    // Check file extension
    if (options.checkExtension) {
      const ext = path.extname(normalizedPath).toLowerCase();
      if (!this.allowedExtensions.includes(ext)) {
        errors.push(`Invalid file extension. Allowed: ${this.allowedExtensions.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      normalizedPath,
      errors
    };
  }

  /**
   * Check if a path exists and is a file
   * @param {string} filePath - Path to check
   * @returns {Object} Check result
   */
  checkFileExists(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    } catch {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0
      };
    }
  }

  /**
   * Get safe path for user data
   * @param {string} filename - Filename to append
   * @returns {string} Full path in user data directory
   */
  getSafeUserDataPath(filename) {
    const userDataPath = app.getPath('userData');
    const safeName = path.basename(filename); // Remove any directory components
    return path.join(userDataPath, safeName);
  }
}

/**
 * Rate limiter for preventing brute-force attacks
 */
class RateLimiter {
  /**
   * Create a RateLimiter instance
   * @param {Object} options - Configuration options
   * @param {number} options.maxAttempts - Maximum attempts before lockout
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {number} options.lockoutMs - Lockout duration in milliseconds
   */
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 5;
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.lockoutMs = options.lockoutMs || 300000; // 5 minutes

    this.attempts = new Map(); // key -> { count, firstAttempt, lockedUntil }
  }

  /**
   * Check if an action is allowed
   * @param {string} key - Unique identifier (e.g., 'unlock', 'decrypt')
   * @returns {Object} Result with allowed status and wait time
   */
  check(key) {
    const now = Date.now();
    const record = this.attempts.get(key);

    // No previous attempts
    if (!record) {
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      const waitMs = record.lockedUntil - now;
      return {
        allowed: false,
        waitMs,
        waitSeconds: Math.ceil(waitMs / 1000),
        reason: 'lockout'
      };
    }

    // Window expired, reset
    if (now - record.firstAttempt > this.windowMs) {
      this.attempts.delete(key);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Check remaining attempts
    const remaining = this.maxAttempts - record.count;
    return {
      allowed: remaining > 0,
      remainingAttempts: Math.max(0, remaining),
      reason: remaining <= 0 ? 'max_attempts' : null
    };
  }

  /**
   * Record an attempt
   * @param {string} key - Unique identifier
   * @param {boolean} success - Whether the attempt was successful
   */
  record(key, success = false) {
    const now = Date.now();

    // Success resets the counter
    if (success) {
      this.attempts.delete(key);
      return;
    }

    const record = this.attempts.get(key) || {
      count: 0,
      firstAttempt: now,
      lockedUntil: null
    };

    record.count++;

    // Check if we should lock out
    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
    }

    this.attempts.set(key, record);
  }

  /**
   * Reset attempts for a key
   * @param {string} key - Unique identifier
   */
  reset(key) {
    this.attempts.delete(key);
  }

  /**
   * Clear all rate limit records
   */
  clear() {
    this.attempts.clear();
  }
}

/**
 * Secure storage wrapper for OS-level encryption
 */
class SecureStorageWrapper {
  /**
   * Check if secure storage is available
   * @returns {boolean} Whether secure storage can be used
   */
  static isAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Encrypt a string using OS-level encryption
   * @param {string} plaintext - Text to encrypt
   * @returns {string|null} Base64-encoded encrypted data, or null on failure
   */
  static encrypt(plaintext) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const buffer = safeStorage.encryptString(plaintext);
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }

  /**
   * Decrypt a string using OS-level encryption
   * @param {string} encryptedBase64 - Base64-encoded encrypted data
   * @returns {string|null} Decrypted text, or null on failure
   */
  static decrypt(encryptedBase64) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }
}

/**
 * Check if running with elevated (admin) privileges
 * @returns {boolean} Whether running as admin
 */
function isRunningAsAdmin() {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    // Try to access a protected registry key that requires admin
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe development logging
 * Only logs in development/unpackaged builds
 * @param {...any} args - Arguments to log
 */
function devLog(...args) {
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    console.log('[GenPwd Pro]', ...args);
  }
}

/**
 * Safe error logging
 * Only logs in development/unpackaged builds
 * @param {...any} args - Arguments to log
 */
function devError(...args) {
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    console.error('[GenPwd Pro]', ...args);
  }
}

module.exports = {
  PathValidator,
  RateLimiter,
  SecureStorageWrapper,
  isRunningAsAdmin,
  devLog,
  devError
};
