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
 * Security Audit Logger
 *
 * Logs security-relevant events for vault access, authentication failures,
 * and other security-critical operations. Logs are stored locally with
 * automatic rotation to prevent disk exhaustion.
 *
 * Log entries include:
 * - Timestamp (ISO 8601)
 * - Event type (success/failure/warning)
 * - Event category (auth, vault, export, etc.)
 * - Event details (sanitized, no sensitive data)
 *
 * @module audit-logger
 */

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// ==================== DEVELOPMENT LOGGING ====================
// Only log errors in development to prevent information disclosure in production
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Safe error logging wrapper - only logs in development builds
 * @param  {...any} args
 */
function devError(...args) {
  if (IS_DEV) console.error(...args);
}

/**
 * Audit event types
 * @enum {string}
 */
const AuditEventType = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * Audit event categories
 * @enum {string}
 */
const AuditCategory = {
  AUTH: 'AUTH',
  VAULT: 'VAULT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  CRYPTO: 'CRYPTO',
  SESSION: 'SESSION',
  BIOMETRIC: 'BIOMETRIC',
  RATE_LIMIT: 'RATE_LIMIT',
  DURESS: 'DURESS'
};

/**
 * Audit Logger class
 */
class AuditLogger {
  constructor() {
    this.logDir = null;
    this.logFile = null;
    this.maxLogSize = 5 * 1024 * 1024; // 5 MB
    this.maxLogFiles = 5;
    this.enabled = true;
    this.initialized = false;
  }

  /**
   * Initialize the audit logger
   * Creates log directory if needed
   */
  initialize() {
    if (this.initialized) return;

    try {
      const userDataPath = app.getPath('userData');
      this.logDir = path.join(userDataPath, 'audit-logs');

      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
      }

      this.logFile = path.join(this.logDir, 'audit.log');
      this.initialized = true;

      // Log initialization
      this.log(AuditEventType.INFO, AuditCategory.SESSION, 'Audit logger initialized');
    } catch (error) {
      devError('[AuditLogger] Failed to initialize:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Format log entry
   * @param {string} type - Event type
   * @param {string} category - Event category
   * @param {string} message - Event message
   * @param {Object} details - Additional details (optional)
   * @returns {string} Formatted log line
   */
  formatEntry(type, category, message, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      category,
      message,
      pid: process.pid,
      ...this.sanitizeDetails(details)
    };

    return JSON.stringify(entry);
  }

  /**
   * Sanitize log details to prevent sensitive data leakage
   * @param {Object} details - Raw details
   * @returns {Object} Sanitized details
   */
  sanitizeDetails(details) {
    const sanitized = {};

    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive fields
      if (['password', 'key', 'secret', 'token', 'credential', 'masterPassword'].includes(key.toLowerCase())) {
        continue;
      }

      // Truncate long values
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // Shallow sanitize nested objects
        sanitized[key] = '[Object]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Write log entry to file
   * @param {string} type - Event type
   * @param {string} category - Event category
   * @param {string} message - Event message
   * @param {Object} details - Additional details
   */
  log(type, category, message, details = {}) {
    if (!this.enabled) return;

    // Lazy initialization
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.initialized) return;

    try {
      // Check log rotation
      this.rotateIfNeeded();

      // Write entry
      const entry = this.formatEntry(type, category, message, details);
      fs.appendFileSync(this.logFile, entry + '\n', { mode: 0o600 });
    } catch (error) {
      // Silent fail to prevent disrupting application
      devError('[AuditLogger] Write error:', error.message);
    }
  }

  /**
   * Rotate log file if it exceeds size limit
   */
  rotateIfNeeded() {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const stats = fs.statSync(this.logFile);
      if (stats.size < this.maxLogSize) return;

      // Rotate existing files
      for (let i = this.maxLogFiles - 1; i >= 0; i--) {
        const oldPath = i === 0 ? this.logFile : `${this.logFile}.${i}`;
        const newPath = `${this.logFile}.${i + 1}`;

        if (fs.existsSync(oldPath)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }
    } catch (error) {
      devError('[AuditLogger] Rotation error:', error.message);
    }
  }

  // Convenience methods for common events

  /**
   * Log successful authentication
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {string} method - Auth method (password, biometric, etc.)
   */
  authSuccess(vaultId, method = 'password') {
    this.log(AuditEventType.SUCCESS, AuditCategory.AUTH, 'Authentication successful', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown',
      method
    });
  }

  /**
   * Log failed authentication
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {string} reason - Failure reason
   */
  authFailure(vaultId, reason = 'invalid_credentials') {
    this.log(AuditEventType.FAILURE, AuditCategory.AUTH, 'Authentication failed', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown',
      reason
    });
  }

  /**
   * Log vault unlock
   * @param {string} vaultId - Vault identifier (truncated)
   */
  vaultUnlocked(vaultId) {
    this.log(AuditEventType.SUCCESS, AuditCategory.VAULT, 'Vault unlocked', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Log vault lock
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {string} reason - Lock reason (manual, timeout, screen_lock, etc.)
   */
  vaultLocked(vaultId, reason = 'manual') {
    this.log(AuditEventType.INFO, AuditCategory.VAULT, 'Vault locked', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown',
      reason
    });
  }

  /**
   * Log vault creation
   * @param {string} vaultId - Vault identifier (truncated)
   */
  vaultCreated(vaultId) {
    this.log(AuditEventType.SUCCESS, AuditCategory.VAULT, 'Vault created', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Log vault deletion
   * @param {string} vaultId - Vault identifier (truncated)
   */
  vaultDeleted(vaultId) {
    this.log(AuditEventType.WARNING, AuditCategory.VAULT, 'Vault deleted', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Log vault export
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {string} format - Export format
   */
  vaultExported(vaultId, format = 'json') {
    this.log(AuditEventType.WARNING, AuditCategory.EXPORT, 'Vault exported', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown',
      format
    });
  }

  /**
   * Log vault import
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {string} source - Import source
   */
  vaultImported(vaultId, source = 'file') {
    this.log(AuditEventType.INFO, AuditCategory.IMPORT, 'Vault imported', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown',
      source
    });
  }

  /**
   * Log rate limit triggered
   * @param {string} identifier - Rate limit identifier
   * @param {number} lockoutSeconds - Lockout duration
   */
  rateLimitTriggered(identifier, lockoutSeconds) {
    this.log(AuditEventType.WARNING, AuditCategory.RATE_LIMIT, 'Rate limit triggered', {
      identifier: identifier ? identifier.substring(0, 8) + '...' : 'unknown',
      lockoutSeconds
    });
  }

  /**
   * Log biometric authentication attempt
   * @param {string} vaultId - Vault identifier (truncated)
   * @param {boolean} success - Whether auth succeeded
   */
  biometricAuth(vaultId, success) {
    this.log(
      success ? AuditEventType.SUCCESS : AuditEventType.FAILURE,
      AuditCategory.BIOMETRIC,
      success ? 'Biometric authentication successful' : 'Biometric authentication failed',
      { vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown' }
    );
  }

  /**
   * Log duress mode activation
   * @param {string} vaultId - Vault identifier (truncated)
   */
  duressActivated(vaultId) {
    this.log(AuditEventType.WARNING, AuditCategory.DURESS, 'Duress mode activated', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Log session timeout
   * @param {string} vaultId - Vault identifier (truncated)
   */
  sessionTimeout(vaultId) {
    this.log(AuditEventType.INFO, AuditCategory.SESSION, 'Session timeout', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Log password change
   * @param {string} vaultId - Vault identifier (truncated)
   */
  passwordChanged(vaultId) {
    this.log(AuditEventType.SUCCESS, AuditCategory.AUTH, 'Password changed', {
      vaultId: vaultId ? vaultId.substring(0, 8) + '...' : 'unknown'
    });
  }

  /**
   * Get recent audit logs
   * @param {number} limit - Maximum entries to return
   * @returns {Array} Recent log entries
   */
  getRecentLogs(limit = 100) {
    if (!this.initialized || !fs.existsSync(this.logFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries = lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      return entries;
    } catch (error) {
      devError('[AuditLogger] Read error:', error.message);
      return [];
    }
  }

  /**
   * Clear all audit logs (for testing/development)
   * SECURITY: This should only be available in development mode
   */
  clearLogs() {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('[AuditLogger] clearLogs() is only available in development mode');
      return;
    }

    try {
      // Delete all log files
      for (let i = 0; i <= this.maxLogFiles; i++) {
        const logPath = i === 0 ? this.logFile : `${this.logFile}.${i}`;
        if (fs.existsSync(logPath)) {
          fs.unlinkSync(logPath);
        }
      }
    } catch (error) {
      devError('[AuditLogger] Clear error:', error.message);
    }
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();

export {
  AuditLogger,
  AuditEventType,
  AuditCategory,
  auditLogger as default
};
