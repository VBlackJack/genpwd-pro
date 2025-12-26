/**
 * @fileoverview CSV Import for Password Managers
 * Supports: Bitwarden, LastPass, 1Password, Chrome/Edge, Firefox
 *
 * @version 2.6.8
 */

import { safeLog } from './logger.js';

/**
 * CSV Parser - handles quoted fields and escapes
 * @param {string} csv - Raw CSV content
 * @returns {string[][]} Parsed rows
 */
function parseCSV(csv) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField);
        if (currentRow.some(f => f.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  // Last field/row
  if (currentField || currentRow.length) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detect CSV format based on headers
 * @param {string[]} headers - CSV header row
 * @returns {'bitwarden'|'lastpass'|'1password'|'chrome'|'firefox'|'generic'|null}
 */
function detectFormat(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim());

  // Bitwarden: folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
  if (normalized.includes('login_username') && normalized.includes('login_password')) {
    return 'bitwarden';
  }

  // LastPass: url,username,password,totp,extra,name,grouping,fav
  if (normalized.includes('grouping') && normalized.includes('extra')) {
    return 'lastpass';
  }

  // 1Password: Title,Url,Username,Password,OTPAuth,Notes
  if (normalized.includes('title') && normalized.includes('otpauth')) {
    return '1password';
  }

  // Chrome/Edge: name,url,username,password
  if (normalized.length === 4 && normalized.includes('name') && normalized.includes('url') && normalized.includes('username') && normalized.includes('password')) {
    return 'chrome';
  }

  // Firefox: "url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"
  if (normalized.includes('httprealm') || normalized.includes('formactionorigin')) {
    return 'firefox';
  }

  // Generic - has at least password column
  if (normalized.includes('password') || normalized.includes('mot de passe')) {
    return 'generic';
  }

  return null;
}

/**
 * Parse Bitwarden CSV
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parseBitwarden(rows, headers) {
  const entries = [];
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const folderIdx = idx('folder');
  const typeIdx = idx('type');
  const nameIdx = idx('name');
  const notesIdx = idx('notes');
  const uriIdx = idx('login_uri');
  const usernameIdx = idx('login_username');
  const passwordIdx = idx('login_password');
  const totpIdx = idx('login_totp');
  const favoriteIdx = idx('favorite');

  for (const row of rows) {
    const type = row[typeIdx]?.toLowerCase() || 'login';
    if (type !== 'login') continue; // Only import logins for now

    entries.push({
      type: 'login',
      title: row[nameIdx] || 'Untitled',
      folder: row[folderIdx] || null,
      data: {
        username: row[usernameIdx] || '',
        password: row[passwordIdx] || '',
        url: row[uriIdx] || '',
        totp: row[totpIdx] || ''
      },
      notes: row[notesIdx] || '',
      favorite: row[favoriteIdx] === '1' || row[favoriteIdx]?.toLowerCase() === 'true'
    });
  }

  return entries;
}

/**
 * Parse LastPass CSV
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parseLastPass(rows, headers) {
  const entries = [];
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const urlIdx = idx('url');
  const usernameIdx = idx('username');
  const passwordIdx = idx('password');
  const totpIdx = idx('totp');
  const extraIdx = idx('extra');
  const nameIdx = idx('name');
  const groupIdx = idx('grouping');
  const favIdx = idx('fav');

  for (const row of rows) {
    entries.push({
      type: 'login',
      title: row[nameIdx] || row[urlIdx] || 'Sans titre',
      folder: row[groupIdx] || null,
      data: {
        username: row[usernameIdx] || '',
        password: row[passwordIdx] || '',
        url: row[urlIdx] || '',
        totp: row[totpIdx] || ''
      },
      notes: row[extraIdx] || '',
      favorite: row[favIdx] === '1' || row[favIdx]?.toLowerCase() === 'true'
    });
  }

  return entries;
}

/**
 * Parse 1Password CSV
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parse1Password(rows, headers) {
  const entries = [];
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const titleIdx = idx('title');
  const urlIdx = idx('url');
  const usernameIdx = idx('username');
  const passwordIdx = idx('password');
  const otpIdx = idx('otpauth');
  const notesIdx = idx('notes');
  const tagsIdx = idx('tags');

  for (const row of rows) {
    let totp = row[otpIdx] || '';
    // 1Password exports otpauth:// URIs, extract secret
    if (totp.startsWith('otpauth://')) {
      try {
        const url = new URL(totp);
        totp = url.searchParams.get('secret') || '';
      } catch { /* Invalid otpauth URL - use raw value */ }
    }

    entries.push({
      type: 'login',
      title: row[titleIdx] || 'Untitled',
      folder: null,
      data: {
        username: row[usernameIdx] || '',
        password: row[passwordIdx] || '',
        url: row[urlIdx] || '',
        totp
      },
      notes: row[notesIdx] || '',
      tags: row[tagsIdx]?.split(',').map(t => t.trim()).filter(Boolean) || [],
      favorite: false
    });
  }

  return entries;
}

/**
 * Parse Chrome/Edge CSV
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parseChrome(rows, headers) {
  const entries = [];
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const nameIdx = idx('name');
  const urlIdx = idx('url');
  const usernameIdx = idx('username');
  const passwordIdx = idx('password');
  const noteIdx = idx('note') !== -1 ? idx('note') : idx('notes');

  for (const row of rows) {
    entries.push({
      type: 'login',
      title: row[nameIdx] || new URL(row[urlIdx] || 'https://unknown').hostname || 'Untitled',
      folder: null,
      data: {
        username: row[usernameIdx] || '',
        password: row[passwordIdx] || '',
        url: row[urlIdx] || '',
        totp: ''
      },
      notes: row[noteIdx] || '',
      favorite: false
    });
  }

  return entries;
}

/**
 * Parse Firefox CSV
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parseFirefox(rows, headers) {
  const entries = [];
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const urlIdx = idx('url');
  const usernameIdx = idx('username');
  const passwordIdx = idx('password');

  for (const row of rows) {
    let title = 'Untitled';
    try {
      title = new URL(row[urlIdx] || '').hostname;
    } catch { /* Invalid URL - use default title */ }

    entries.push({
      type: 'login',
      title,
      folder: null,
      data: {
        username: row[usernameIdx] || '',
        password: row[passwordIdx] || '',
        url: row[urlIdx] || '',
        totp: ''
      },
      notes: '',
      favorite: false
    });
  }

  return entries;
}

/**
 * Parse Generic CSV (auto-detect columns)
 * @param {string[][]} rows - Parsed CSV rows
 * @param {string[]} headers - Header row
 * @returns {ImportEntry[]}
 */
function parseGeneric(rows, headers) {
  const entries = [];
  const normalized = headers.map(h => h.toLowerCase().trim());

  // Find columns by common names
  const findCol = (...names) => {
    for (const name of names) {
      const idx = normalized.findIndex(h => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const titleIdx = findCol('title', 'name', 'nom', 'site');
  const urlIdx = findCol('url', 'website', 'site', 'adresse');
  const usernameIdx = findCol('username', 'user', 'login', 'email', 'identifiant');
  const passwordIdx = findCol('password', 'pass', 'mot de passe', 'mdp');
  const notesIdx = findCol('notes', 'note', 'comment', 'remarque');
  const totpIdx = findCol('totp', 'otp', '2fa', 'authenticator');

  for (const row of rows) {
    let title = titleIdx !== -1 ? row[titleIdx] : '';
    if (!title && urlIdx !== -1 && row[urlIdx]) {
      try {
        title = new URL(row[urlIdx]).hostname;
      } catch {
        title = row[urlIdx];
      }
    }

    entries.push({
      type: 'login',
      title: title || 'Untitled',
      folder: null,
      data: {
        username: usernameIdx !== -1 ? row[usernameIdx] || '' : '',
        password: passwordIdx !== -1 ? row[passwordIdx] || '' : '',
        url: urlIdx !== -1 ? row[urlIdx] || '' : '',
        totp: totpIdx !== -1 ? row[totpIdx] || '' : ''
      },
      notes: notesIdx !== -1 ? row[notesIdx] || '' : '',
      favorite: false
    });
  }

  return entries;
}

/**
 * @typedef {Object} ImportEntry
 * @property {'login'|'note'|'card'|'identity'} type
 * @property {string} title
 * @property {string|null} folder
 * @property {Object} data
 * @property {string} [notes]
 * @property {boolean} [favorite]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} ImportResult
 * @property {boolean} success
 * @property {ImportEntry[]} entries
 * @property {string} format
 * @property {number} total
 * @property {number} skipped
 * @property {string} [error]
 */

/**
 * Import CSV file content
 * @param {string} csvContent - Raw CSV content
 * @returns {ImportResult}
 */
export function importCSV(csvContent) {
  try {
    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      return { success: false, entries: [], format: 'unknown', total: 0, skipped: 0, error: 'Empty or invalid CSV file' };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const format = detectFormat(headers);

    if (!format) {
      return { success: false, entries: [], format: 'unknown', total: 0, skipped: 0, error: 'Unrecognized CSV format' };
    }

    let entries = [];
    switch (format) {
      case 'bitwarden':
        entries = parseBitwarden(dataRows, headers);
        break;
      case 'lastpass':
        entries = parseLastPass(dataRows, headers);
        break;
      case '1password':
        entries = parse1Password(dataRows, headers);
        break;
      case 'chrome':
        entries = parseChrome(dataRows, headers);
        break;
      case 'firefox':
        entries = parseFirefox(dataRows, headers);
        break;
      case 'generic':
        entries = parseGeneric(dataRows, headers);
        break;
    }

    // Filter out entries without password
    const validEntries = entries.filter(e => e.data?.password);
    const skipped = entries.length - validEntries.length;

    safeLog(`[CSVImport] Imported ${validEntries.length} entries from ${format} format (${skipped} skipped)`);

    return {
      success: true,
      entries: validEntries,
      format,
      total: validEntries.length,
      skipped
    };
  } catch (error) {
    safeLog(`[CSVImport] Error: ${error.message}`);
    return { success: false, entries: [], format: 'unknown', total: 0, skipped: 0, error: error.message };
  }
}

/**
 * Get format display name
 * @param {string} format
 * @returns {string}
 */
export function getFormatDisplayName(format) {
  const names = {
    bitwarden: 'Bitwarden',
    lastpass: 'LastPass',
    '1password': '1Password',
    chrome: 'Chrome / Edge',
    firefox: 'Firefox',
    generic: 'Generic Format'
  };
  return names[format] || format;
}

/**
 * Validate CSV file
 * @param {File} file
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateCSVFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (!file.name.endsWith('.csv')) {
    return { valid: false, error: 'File must be in CSV format' };
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return { valid: false, error: 'File is too large (max 10 MB)' };
  }

  return { valid: true };
}

// Note: Use named exports directly - default export removed for consistency
