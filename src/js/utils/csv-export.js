/**
 * @fileoverview CSV Export for Password Managers
 * Supports: Bitwarden, LastPass, 1Password, Chrome, Generic
 *
 * @version 2.6.8
 */

import { safeLog } from './logger.js';

/**
 * Escape CSV field value
 * @param {string} value
 * @returns {string}
 */
function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build CSV row
 * @param {string[]} fields
 * @returns {string}
 */
function buildRow(fields) {
  return fields.map(escapeCSV).join(',');
}

/**
 * Export entries to Bitwarden CSV format
 * @param {Array} entries
 * @returns {string}
 */
export function exportToBitwarden(entries) {
  const headers = ['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'];

  const rows = [buildRow(headers)];

  for (const entry of entries) {
    if (entry.type !== 'login') continue;

    const row = [
      '', // folder
      entry.favorite ? '1' : '',
      'login',
      entry.title || '',
      entry.notes || entry.data?.notes || '',
      '', // fields
      '0', // reprompt
      entry.data?.url || '',
      entry.data?.username || '',
      entry.data?.password || '',
      entry.data?.totp || ''
    ];
    rows.push(buildRow(row));
  }

  safeLog(`[CSVExport] Exported ${rows.length - 1} entries to Bitwarden format`);
  return rows.join('\r\n');
}

/**
 * Export entries to LastPass CSV format
 * @param {Array} entries
 * @returns {string}
 */
export function exportToLastPass(entries) {
  const headers = ['url', 'username', 'password', 'totp', 'extra', 'name', 'grouping', 'fav'];

  const rows = [buildRow(headers)];

  for (const entry of entries) {
    if (entry.type !== 'login') continue;

    const row = [
      entry.data?.url || '',
      entry.data?.username || '',
      entry.data?.password || '',
      entry.data?.totp || '',
      entry.notes || entry.data?.notes || '',
      entry.title || '',
      '', // grouping
      entry.favorite ? '1' : '0'
    ];
    rows.push(buildRow(row));
  }

  safeLog(`[CSVExport] Exported ${rows.length - 1} entries to LastPass format`);
  return rows.join('\r\n');
}

/**
 * Export entries to 1Password CSV format
 * @param {Array} entries
 * @returns {string}
 */
export function exportTo1Password(entries) {
  const headers = ['Title', 'Url', 'Username', 'Password', 'OTPAuth', 'Notes'];

  const rows = [buildRow(headers)];

  for (const entry of entries) {
    if (entry.type !== 'login') continue;

    // Build otpauth:// URI if TOTP exists
    let otpauth = '';
    if (entry.data?.totp) {
      const issuer = entry.title || 'GenPwd';
      const account = entry.data?.username || 'user';
      otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${entry.data.totp}&issuer=${encodeURIComponent(issuer)}`;
    }

    const row = [
      entry.title || '',
      entry.data?.url || '',
      entry.data?.username || '',
      entry.data?.password || '',
      otpauth,
      entry.notes || entry.data?.notes || ''
    ];
    rows.push(buildRow(row));
  }

  safeLog(`[CSVExport] Exported ${rows.length - 1} entries to 1Password format`);
  return rows.join('\r\n');
}

/**
 * Export entries to Chrome/Edge CSV format
 * @param {Array} entries
 * @returns {string}
 */
export function exportToChrome(entries) {
  const headers = ['name', 'url', 'username', 'password', 'note'];

  const rows = [buildRow(headers)];

  for (const entry of entries) {
    if (entry.type !== 'login') continue;

    const row = [
      entry.title || '',
      entry.data?.url || '',
      entry.data?.username || '',
      entry.data?.password || '',
      entry.notes || entry.data?.notes || ''
    ];
    rows.push(buildRow(row));
  }

  safeLog(`[CSVExport] Exported ${rows.length - 1} entries to Chrome format`);
  return rows.join('\r\n');
}

/**
 * Export entries to generic CSV format
 * @param {Array} entries
 * @returns {string}
 */
export function exportToGeneric(entries) {
  const headers = ['Title', 'URL', 'Username', 'Password', 'TOTP', 'Notes', 'Type', 'Created', 'Modified'];

  const rows = [buildRow(headers)];

  for (const entry of entries) {
    const row = [
      entry.title || '',
      entry.data?.url || '',
      entry.data?.username || '',
      entry.data?.password || '',
      entry.data?.totp || '',
      entry.notes || entry.data?.notes || '',
      entry.type || 'login',
      entry.createdAt ? new Date(entry.createdAt).toISOString() : '',
      entry.modifiedAt ? new Date(entry.modifiedAt).toISOString() : ''
    ];
    rows.push(buildRow(row));
  }

  safeLog(`[CSVExport] Exported ${rows.length - 1} entries to generic format`);
  return rows.join('\r\n');
}

/**
 * Export formats available
 */
export const EXPORT_FORMATS = [
  { id: 'bitwarden', label: 'Bitwarden', extension: 'csv' },
  { id: 'lastpass', label: 'LastPass', extension: 'csv' },
  { id: '1password', label: '1Password', extension: 'csv' },
  { id: 'chrome', label: 'Chrome / Edge', extension: 'csv' },
  { id: 'generic', label: 'Format générique', extension: 'csv' }
];

/**
 * Export entries to specified format
 * @param {Array} entries
 * @param {string} format
 * @returns {string}
 */
export function exportToFormat(entries, format) {
  switch (format) {
    case 'bitwarden':
      return exportToBitwarden(entries);
    case 'lastpass':
      return exportToLastPass(entries);
    case '1password':
      return exportTo1Password(entries);
    case 'chrome':
      return exportToChrome(entries);
    case 'generic':
    default:
      return exportToGeneric(entries);
  }
}

/**
 * Download CSV file
 * @param {string} content
 * @param {string} filename
 */
export function downloadCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportToBitwarden,
  exportToLastPass,
  exportTo1Password,
  exportToChrome,
  exportToGeneric,
  exportToFormat,
  downloadCSV,
  EXPORT_FORMATS
};
