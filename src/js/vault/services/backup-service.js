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

/**
 * @fileoverview Backup Service
 * Tracks backup/export timestamps for vault data
 * (BMAD Anxiety reduction - visible backup status)
 */

import { safeLog } from '../../utils/logger.js';

const STORAGE_KEY = 'genpwd-vault-backup-timestamps';
const BACKUP_REMINDER_DAYS = 7;

/** Backup status states */
export const BACKUP_STATUS = {
  NEVER: 'never',
  RECENT: 'recent',
  RECOMMENDED: 'recommended'
};

// Singleton instance
let backupServiceInstance = null;

/**
 * Get or create the backup service instance
 * @returns {Object} Backup service
 */
export function getBackupService() {
  if (backupServiceInstance) {
    return backupServiceInstance;
  }

  backupServiceInstance = {
    /**
     * Get last backup timestamp for a vault
     * @param {string} vaultId - Vault identifier (optional, defaults to 'default')
     * @returns {number|null} Timestamp or null if never backed up
     */
    getLastBackupTime(vaultId = 'default') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;

        const timestamps = JSON.parse(data);
        return timestamps[vaultId] || null;
      } catch (e) {
        safeLog('[BackupService] Failed to get backup time:', e?.message);
        return null;
      }
    },

    /**
     * Record a backup timestamp
     * @param {string} vaultId - Vault identifier (optional)
     * @param {string} format - Export format used (json, csv, etc.)
     */
    recordBackup(vaultId = 'default', format = 'json') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        const timestamps = data ? JSON.parse(data) : {};

        timestamps[vaultId] = {
          timestamp: Date.now(),
          format
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
        safeLog('[BackupService] Backup recorded');
      } catch (e) {
        safeLog('[BackupService] Failed to record backup:', e?.message);
      }
    },

    /**
     * Get backup status for a vault
     * @param {string} vaultId - Vault identifier
     * @returns {string} One of BACKUP_STATUS values
     */
    getBackupStatus(vaultId = 'default') {
      const backupData = this.getLastBackupData(vaultId);
      if (!backupData) return BACKUP_STATUS.NEVER;

      const daysSince = (Date.now() - backupData.timestamp) / (1000 * 60 * 60 * 24);
      return daysSince > BACKUP_REMINDER_DAYS ? BACKUP_STATUS.RECOMMENDED : BACKUP_STATUS.RECENT;
    },

    /**
     * Get full backup data including format
     * @param {string} vaultId - Vault identifier
     * @returns {Object|null} Backup data or null
     */
    getLastBackupData(vaultId = 'default') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;

        const timestamps = JSON.parse(data);
        const entry = timestamps[vaultId];

        // Handle legacy format (just timestamp number)
        if (typeof entry === 'number') {
          return { timestamp: entry, format: 'unknown' };
        }

        return entry || null;
      } catch (e) {
        safeLog('[BackupService] Failed to get backup data:', e?.message);
        return null;
      }
    },

    /**
     * Check if backup reminder is needed
     * @param {string} vaultId - Vault identifier
     * @returns {boolean} True if backup is recommended
     */
    needsBackupReminder(vaultId = 'default') {
      return this.getBackupStatus(vaultId) !== BACKUP_STATUS.RECENT;
    },

    /**
     * Get days since last backup
     * @param {string} vaultId - Vault identifier
     * @returns {number|null} Days since backup or null if never
     */
    getDaysSinceBackup(vaultId = 'default') {
      const backupData = this.getLastBackupData(vaultId);
      if (!backupData) return null;

      return Math.floor((Date.now() - backupData.timestamp) / (1000 * 60 * 60 * 24));
    },

    /**
     * Format last backup time for display
     * @param {string} vaultId - Vault identifier
     * @param {Function} t - Translation function
     * @returns {string} Formatted backup time
     */
    formatLastBackup(vaultId = 'default', t = (k) => k) {
      const backupData = this.getLastBackupData(vaultId);
      if (!backupData) {
        return t('vault.backup.never');
      }

      const date = new Date(backupData.timestamp);
      const daysSince = this.getDaysSinceBackup(vaultId);

      if (daysSince === 0) {
        return t('vault.backup.today');
      } else if (daysSince === 1) {
        return t('vault.backup.yesterday');
      } else if (daysSince < 7) {
        return t('vault.backup.daysAgo', { days: daysSince });
      } else {
        return t('vault.backup.lastBackup', { date: date.toLocaleDateString() });
      }
    },

    /**
     * Clear backup history for a vault
     * @param {string} vaultId - Vault identifier
     */
    clearBackupHistory(vaultId = 'default') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        const timestamps = JSON.parse(data);
        delete timestamps[vaultId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
      } catch (e) {
        safeLog('[BackupService] Failed to clear backup history:', e?.message);
      }
    }
  };

  return backupServiceInstance;
}

/**
 * Create a backup service instance (factory function)
 * @returns {Object} Backup service
 */
export function createBackupService() {
  return getBackupService();
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetBackupService() {
  backupServiceInstance = null;
}
