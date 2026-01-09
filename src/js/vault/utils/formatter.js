/**
 * @fileoverview Vault Formatter Utilities
 * Pure functions for formatting data display
 */

import { t, i18n } from '../../utils/i18n.js';

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format date to localized date string
 * @param {string|Date} dateStr - Date to format
 * @param {string} locale - Locale code (uses app locale if not specified)
 * @returns {string} Formatted date
 */
export function formatDate(dateStr, locale = null) {
  if (!dateStr) return '';
  const effectiveLocale = locale || i18n.getLocale() || navigator.language || 'en-US';
  return new Date(dateStr).toLocaleDateString(effectiveLocale);
}

/**
 * Format date to localized datetime string
 * @param {string|Date} dateStr - Date to format
 * @param {string} locale - Locale code (uses app locale if not specified)
 * @returns {string} Formatted datetime
 */
export function formatDateTime(dateStr, locale = null) {
  if (!dateStr) return '';
  const effectiveLocale = locale || i18n.getLocale() || navigator.language || 'en-US';
  return new Date(dateStr).toLocaleString(effectiveLocale);
}

/**
 * Mask a password for display in history
 * Shows first 2 and last 2 characters with dots in between
 * @param {string} password - Password to mask
 * @returns {string} Masked password
 */
export function maskHistoryPassword(password) {
  if (!password) return '';
  if (password.length <= 4) return '••••';
  return password.substring(0, 2) + '•'.repeat(Math.min(password.length - 4, 6)) + password.slice(-2);
}

/**
 * Get relative time string (e.g., "5 min ago", "2d ago")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diff = now - dateObj;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('vault.relativeTime.justNow');
  if (minutes < 60) return t('vault.relativeTime.minAgo', { count: minutes });
  if (hours < 24) return t('vault.relativeTime.hoursAgo', { count: hours });
  if (days < 7) return t('vault.relativeTime.daysAgo', { count: days });
  if (days < 30) return t('vault.relativeTime.weeksAgo', { count: Math.floor(days / 7) });
  return t('vault.relativeTime.monthsAgo', { count: Math.floor(days / 30) });
}

/**
 * Alias for getRelativeTime for consistent naming
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  return getRelativeTime(date);
}

/**
 * Format time in MM:SS format
 * @param {number} seconds - Seconds to format
 * @returns {string} Formatted time
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format breach count for display
 * @param {number} count - Breach count
 * @returns {string} Formatted count
 */
export function formatBreachCount(count) {
  if (count >= 1000000) return `${Math.floor(count / 1000000)}M+`;
  if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
  return String(count);
}
