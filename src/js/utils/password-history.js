/**
 * @fileoverview Password History Manager
 * Tracks password changes per entry with restore capability
 *
 * @version 2.6.7
 */

import { safeLog } from './logger.js';

// Maximum history entries to keep per password
const MAX_HISTORY_SIZE = 10;

/**
 * @typedef {Object} PasswordHistoryEntry
 * @property {string} password - The previous password
 * @property {string} changedAt - ISO timestamp when changed
 * @property {string} [reason] - Optional reason for change
 */

/**
 * Add current password to history before changing
 * @param {Object} entry - Vault entry
 * @param {string} newPassword - The new password being set
 * @param {string} [reason] - Optional reason for change
 * @returns {Object} Updated entry with history
 */
export function addToHistory(entry, newPassword, reason = '') {
  if (!entry || !entry.data?.password) return entry;

  // Don't add if password is the same
  if (entry.data.password === newPassword) return entry;

  // Initialize history array if not exists
  const history = entry.data.passwordHistory || [];

  // Add current password to history
  const historyEntry = {
    password: entry.data.password,
    changedAt: new Date().toISOString(),
    reason: reason || 'Changement manuel'
  };

  // Add to beginning (most recent first)
  history.unshift(historyEntry);

  // Trim to max size
  if (history.length > MAX_HISTORY_SIZE) {
    history.length = MAX_HISTORY_SIZE;
  }

  safeLog(`[PasswordHistory] Added to history for entry ${entry.id}, total: ${history.length}`);

  return {
    ...entry,
    data: {
      ...entry.data,
      passwordHistory: history
    }
  };
}

/**
 * Get password history for an entry
 * @param {Object} entry - Vault entry
 * @returns {PasswordHistoryEntry[]}
 */
export function getHistory(entry) {
  return entry?.data?.passwordHistory || [];
}

/**
 * Check if entry has password history
 * @param {Object} entry - Vault entry
 * @returns {boolean}
 */
export function hasHistory(entry) {
  return (entry?.data?.passwordHistory?.length || 0) > 0;
}

/**
 * Restore a password from history
 * @param {Object} entry - Vault entry
 * @param {number} historyIndex - Index in history array to restore
 * @returns {Object} Updated entry with restored password
 */
export function restoreFromHistory(entry, historyIndex) {
  const history = getHistory(entry);

  if (historyIndex < 0 || historyIndex >= history.length) {
    throw new Error('Invalid history index');
  }

  const toRestore = history[historyIndex];

  // Add current password to history first
  const updatedEntry = addToHistory(entry, toRestore.password, 'Restauration');

  // Set the restored password
  return {
    ...updatedEntry,
    data: {
      ...updatedEntry.data,
      password: toRestore.password
    }
  };
}

/**
 * Clear password history for an entry
 * @param {Object} entry - Vault entry
 * @returns {Object} Updated entry without history
 */
export function clearHistory(entry) {
  if (!entry?.data) return entry;

  const { passwordHistory, ...restData } = entry.data;

  safeLog(`[PasswordHistory] Cleared history for entry ${entry.id}`);

  return {
    ...entry,
    data: restData
  };
}

/**
 * Format history entry for display
 * @param {PasswordHistoryEntry} historyEntry
 * @param {number} index
 * @returns {Object}
 */
export function formatHistoryEntry(historyEntry, index) {
  const date = new Date(historyEntry.changedAt);
  const relativeTime = getRelativeTime(date);

  return {
    index,
    password: historyEntry.password,
    maskedPassword: maskPassword(historyEntry.password),
    changedAt: historyEntry.changedAt,
    formattedDate: date.toLocaleDateString('fr-FR'),
    formattedTime: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    relativeTime,
    reason: historyEntry.reason || ''
  };
}

/**
 * Get relative time string
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

/**
 * Mask password for display
 * @param {string} password
 * @returns {string}
 */
function maskPassword(password) {
  if (!password) return '';
  if (password.length <= 4) return '****';
  return password.substring(0, 2) + '•'.repeat(Math.min(password.length - 4, 8)) + password.slice(-2);
}

/**
 * Check if password exists in history (duplicate detection)
 * @param {Object} entry - Vault entry
 * @param {string} password - Password to check
 * @returns {boolean}
 */
export function isInHistory(entry, password) {
  const history = getHistory(entry);
  return history.some(h => h.password === password);
}

export default {
  addToHistory,
  getHistory,
  hasHistory,
  restoreFromHistory,
  clearHistory,
  formatHistoryEntry,
  isInHistory,
  MAX_HISTORY_SIZE
};
