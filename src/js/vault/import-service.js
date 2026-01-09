/**
 * @fileoverview Import Service for GenPwd Pro
 * Parses external password manager exports and converts them to VaultEntry format.
 *
 * Supported formats:
 * - KeePass 2.x XML export
 * - Generic CSV (with intelligent column detection)
 * - Bitwarden CSV/JSON
 * - 1Password CSV
 *
 * @license Apache-2.0
 */

import { VaultEntry, VaultGroup, ENTRY_TYPES, FIELD_KINDS, generateUUID } from './models.js';
import { safeLog } from '../utils/logger.js';
import i18n from '../utils/i18n.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common CSV column name mappings
 */
const CSV_COLUMN_MAPPINGS = Object.freeze({
  // Title
  title: ['title', 'name', 'entry', 'account', 'site', 'service', 'label', 'titre', 'nom'],
  // Username
  username: ['username', 'user', 'login', 'email', 'e-mail', 'account', 'login_username', 'identifiant', 'utilisateur'],
  // Password
  password: ['password', 'pass', 'pwd', 'secret', 'login_password', 'mot de passe', 'mdp'],
  // URL
  url: ['url', 'uri', 'website', 'site', 'link', 'login_uri', 'web', 'adresse'],
  // Notes
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'memo', 'remarques'],
  // TOTP
  totp: ['totp', 'otp', '2fa', 'authenticator', 'login_totp', 'otpauth'],
  // Group/Folder
  group: ['group', 'folder', 'category', 'path', 'dossier', 'groupe', 'catégorie'],
  // Tags
  tags: ['tags', 'labels', 'keywords', 'étiquettes']
});

/**
 * KeePass icon ID to emoji mapping (subset of common icons)
 */
const KEEPASS_ICONS = Object.freeze({
  0: '🔑',   // Key
  1: '🌐',   // World
  2: '⚠️',   // Warning
  3: '🖥️',   // Server
  4: '📁',   // Folder
  5: '👤',   // User
  6: '📧',   // Email
  7: '⚙️',   // Settings
  8: '📝',   // Note
  9: '💳',   // Card
  10: '🏠',  // Home
  11: '⭐',  // Star
  12: '🔒',  // Lock
  19: '🔐',  // Secure
  23: '💰',  // Money
  30: '📱',  // Phone
  41: '🛡️',  // Shield
  68: '🎮'   // Game
});

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * @typedef {Object} ImportResult
 * @property {VaultEntry[]} entries - Imported entries
 * @property {VaultGroup[]} groups - Imported groups (folders)
 * @property {Object} stats - Import statistics
 * @property {string[]} warnings - Non-fatal issues encountered
 * @property {string[]} errors - Fatal errors (entry skipped)
 */

/**
 * @typedef {Object} ImportStats
 * @property {number} totalEntries - Total entries found
 * @property {number} importedEntries - Successfully imported entries
 * @property {number} skippedEntries - Entries skipped due to errors
 * @property {number} totalGroups - Total groups/folders found
 * @property {number} importedGroups - Successfully imported groups
 * @property {number} customFieldsCount - Total custom fields imported
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// generateUUID imported from models.js

/**
 * Parse ISO date string or KeePass date format to timestamp
 * @param {string} dateStr
 * @returns {number|null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.getTime();
  } catch {
    return null;
  }
}

/**
 * Normalize a string for column matching
 * @param {string} str
 * @returns {string}
 */
function normalizeColumnName(str) {
  return str.toLowerCase().trim().replace(/[_\-\s]+/g, '');
}

/**
 * Detect the column type from its header name
 * @param {string} header
 * @returns {string|null}
 */
function detectColumnType(header) {
  const normalized = normalizeColumnName(header);

  for (const [type, aliases] of Object.entries(CSV_COLUMN_MAPPINGS)) {
    for (const alias of aliases) {
      if (normalizeColumnName(alias) === normalized || normalized.includes(normalizeColumnName(alias))) {
        return type;
      }
    }
  }
  return null;
}

/**
 * Validate Base32 encoded string
 * @param {string} str - String to validate
 * @returns {boolean} True if valid Base32
 */
function isValidBase32(str) {
  if (!str || typeof str !== 'string') return false;
  // Base32 alphabet: A-Z and 2-7, with optional padding (=)
  const base32Pattern = /^[A-Z2-7]+=*$/i;
  const cleaned = str.replace(/\s/g, '').toUpperCase();
  // Must be at least 16 chars for reasonable entropy
  return cleaned.length >= 16 && base32Pattern.test(cleaned);
}

/**
 * Parse TOTP URI into OtpConfig
 * @param {string} uri - otpauth:// URI
 * @returns {Object|null}
 */
function parseTotpUri(uri) {
  if (!uri || !uri.startsWith('otpauth://totp/')) return null;

  try {
    const url = new URL(uri);
    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    // Validate secret is valid Base32
    const cleanedSecret = secret.toUpperCase().replace(/\s/g, '');
    if (!isValidBase32(cleanedSecret)) {
      safeLog('[Import] Invalid TOTP secret format - not valid Base32');
      return null;
    }

    // Validate digits (must be 6 or 8)
    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    if (digits !== 6 && digits !== 8) {
      safeLog('[Import] Invalid TOTP digits - must be 6 or 8');
      return null;
    }

    // Validate period (must be positive)
    const period = parseInt(url.searchParams.get('period') || '30', 10);
    if (period < 1 || period > 300) {
      safeLog('[Import] Invalid TOTP period - must be between 1 and 300');
      return null;
    }

    return {
      secret: cleanedSecret,
      algorithm: url.searchParams.get('algorithm') || 'SHA1',
      digits,
      period
    };
  } catch {
    return null;
  }
}

/**
 * Sanitize text content from XML
 * @param {string} text
 * @returns {string}
 */
function sanitizeXmlText(text) {
  if (!text) return '';
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

// ============================================================================
// CSV PARSER
// ============================================================================

/**
 * Parse CSV content into rows
 * Handles quoted fields, escaped quotes, and various line endings
 * @param {string} content
 * @returns {string[][]}
 */
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // Skip CR, handle in LF
      } else if (char === '\n') {
        currentRow.push(currentField);
        if (currentRow.some(f => f.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Handle last field/row
  currentRow.push(currentField);
  if (currentRow.some(f => f.trim())) {
    rows.push(currentRow);
  }

  return rows;
}

// ============================================================================
// KEEPASS XML PARSER
// ============================================================================

/**
 * Parse KeePass 2.x XML export
 * @param {string} xmlContent
 * @returns {ImportResult}
 */
export function parseKeePassXML(xmlContent) {
  const result = {
    entries: [],
    groups: [],
    stats: {
      totalEntries: 0,
      importedEntries: 0,
      skippedEntries: 0,
      totalGroups: 0,
      importedGroups: 0,
      customFieldsCount: 0
    },
    warnings: [],
    errors: []
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      result.errors.push('Invalid XML format: ' + parseError.textContent.substring(0, 100));
      return result;
    }

    // Find root group
    const rootGroup = doc.querySelector('Root > Group');
    if (!rootGroup) {
      result.errors.push('No root group found in KeePass XML');
      return result;
    }

    // Process groups recursively
    const groupMap = new Map(); // UUID -> { id, name, parentId, path }

    function processGroup(groupElement, parentId = null, pathPrefix = '') {
      const nameEl = groupElement.querySelector(':scope > Name');
      const uuidEl = groupElement.querySelector(':scope > UUID');

      const name = sanitizeXmlText(nameEl?.textContent) || i18n.t('import.defaults.untitledGroup');
      const uuid = sanitizeXmlText(uuidEl?.textContent) || generateUUID();
      const path = pathPrefix ? `${pathPrefix}/${name}` : name;

      // Skip recycle bin and backup groups
      const isRecycleBin = name.toLowerCase().includes('recycle') ||
        name.toLowerCase().includes('corbeille') ||
        name.toLowerCase().includes('backup');

      if (!isRecycleBin && parentId !== null) {
        result.stats.totalGroups++;
        const groupId = generateUUID();
        groupMap.set(uuid, { id: groupId, name, parentId, path });

        try {
          const group = new VaultGroup({
            id: groupId,
            name,
            parentId,
            icon: null,
            color: null
          });
          result.groups.push(group);
          result.stats.importedGroups++;
        } catch (e) {
          result.warnings.push(`Failed to create group "${name}": ${e.message}`);
        }
      }

      // Process child groups
      const childGroups = groupElement.querySelectorAll(':scope > Group');
      const currentGroupId = groupMap.get(uuid)?.id || null;

      for (const childGroup of childGroups) {
        processGroup(childGroup, currentGroupId, path);
      }

      // Process entries in this group (skip recycle bin entries)
      if (!isRecycleBin) {
        const entries = groupElement.querySelectorAll(':scope > Entry');
        for (const entryEl of entries) {
          processEntry(entryEl, currentGroupId, path);
        }
      }
    }

    function processEntry(entryEl, groupId, groupPath) {
      result.stats.totalEntries++;

      try {
        // Get standard fields
        const strings = entryEl.querySelectorAll(':scope > String');
        const fieldMap = new Map();

        for (const strEl of strings) {
          const key = sanitizeXmlText(strEl.querySelector('Key')?.textContent);
          const value = sanitizeXmlText(strEl.querySelector('Value')?.textContent);
          const isProtected = strEl.querySelector('Value')?.getAttribute('Protected') === 'True';
          fieldMap.set(key, { value, isProtected });
        }

        const title = fieldMap.get('Title')?.value || i18n.t('import.defaults.untitledEntry');
        const username = fieldMap.get('UserName')?.value || '';
        const password = fieldMap.get('Password')?.value || '';
        const url = fieldMap.get('URL')?.value || '';
        const notes = fieldMap.get('Notes')?.value || '';

        // Get dates
        const timesEl = entryEl.querySelector('Times');
        const creationTime = parseDate(timesEl?.querySelector('CreationTime')?.textContent);
        const lastModTime = parseDate(timesEl?.querySelector('LastModificationTime')?.textContent);
        const lastAccessTime = parseDate(timesEl?.querySelector('LastAccessTime')?.textContent);
        const expiryTime = timesEl?.querySelector('Expires')?.textContent === 'True'
          ? parseDate(timesEl?.querySelector('ExpiryTime')?.textContent)
          : null;

        // Get icon
        const iconId = parseInt(entryEl.querySelector('IconID')?.textContent || '0', 10);
        const icon = KEEPASS_ICONS[iconId] || null;

        // Get tags
        const tagsEl = entryEl.querySelector('Tags');
        const tags = tagsEl?.textContent
          ? sanitizeXmlText(tagsEl.textContent).split(/[,;]/).map(t => t.trim()).filter(Boolean)
          : [];

        // Add group path as a tag for easier organization
        if (groupPath && !tags.includes(groupPath)) {
          tags.unshift(groupPath.replace(/\//g, ' > '));
        }

        // Process custom fields
        const customFields = [];
        const standardKeys = new Set(['Title', 'UserName', 'Password', 'URL', 'Notes']);

        for (const [key, data] of fieldMap) {
          if (!standardKeys.has(key) && key && data.value) {
            result.stats.customFieldsCount++;

            // Detect field kind
            let kind = FIELD_KINDS.TEXT;
            if (data.isProtected || key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
              kind = FIELD_KINDS.PASSWORD;
            } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
              kind = FIELD_KINDS.URL;
            } else if (key.toLowerCase().includes('email') || key.toLowerCase().includes('mail')) {
              kind = FIELD_KINDS.EMAIL;
            } else if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')) {
              kind = FIELD_KINDS.PHONE;
            } else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('birth')) {
              kind = FIELD_KINDS.DATE;
            }

            customFields.push({
              id: generateUUID(),
              label: key,
              value: data.value,
              kind,
              isSecured: data.isProtected
            });
          }
        }

        // Check for TOTP (AutoType or custom field)
        let otpConfig = null;
        const otpField = fieldMap.get('TOTP Seed') || fieldMap.get('otp') || fieldMap.get('TimeOtp-Secret-Base32');
        if (otpField?.value) {
          otpConfig = {
            secret: otpField.value.toUpperCase().replace(/\s/g, ''),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
          };
        }

        // Determine entry type based on content
        let type = ENTRY_TYPES.LOGIN;
        if (!username && !password && notes) {
          type = ENTRY_TYPES.SECURE_NOTE;
        } else if (title.toLowerCase().includes('card') || title.toLowerCase().includes('carte')) {
          type = ENTRY_TYPES.CREDIT_CARD;
        }

        // Create the entry
        const entry = new VaultEntry({
          id: generateUUID(),
          title,
          type,
          username,
          secret: password ? [password] : [],
          notes,
          uri: url,
          tags,
          otpConfig,
          folderId: groupId,
          fields: customFields,
          metadata: {
            createdAt: creationTime || Date.now(),
            updatedAt: lastModTime || Date.now(),
            lastUsedAt: lastAccessTime,
            expiresAt: expiryTime,
            usageCount: 0
          },
          color: null,
          icon
        });

        result.entries.push(entry);
        result.stats.importedEntries++;

      } catch (e) {
        result.stats.skippedEntries++;
        result.errors.push(`Failed to import entry: ${e.message}`);
      }
    }

    // Start processing from root
    processGroup(rootGroup, null, '');

    safeLog(`[ImportService] KeePass XML: ${result.stats.importedEntries}/${result.stats.totalEntries} entries, ${result.stats.importedGroups} groups`);

  } catch (e) {
    result.errors.push(`XML parsing failed: ${e.message}`);
  }

  return result;
}

// ============================================================================
// GENERIC CSV PARSER
// ============================================================================

/**
 * Parse generic CSV export
 * Intelligently detects column types from headers
 * @param {string} csvContent
 * @param {Object} [options]
 * @param {Object} [options.columnMap] - Manual column mapping override
 * @returns {ImportResult}
 */
export function parseGenericCSV(csvContent, options = {}) {
  const result = {
    entries: [],
    groups: [],
    stats: {
      totalEntries: 0,
      importedEntries: 0,
      skippedEntries: 0,
      totalGroups: 0,
      importedGroups: 0,
      customFieldsCount: 0
    },
    warnings: [],
    errors: []
  };

  try {
    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      result.errors.push('CSV file is empty or has no data rows');
      return result;
    }

    // First row is headers
    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

    // Detect column types
    const columnTypes = new Map();
    const unmappedColumns = [];

    headers.forEach((header, index) => {
      if (options.columnMap && options.columnMap[header]) {
        columnTypes.set(options.columnMap[header], index);
      } else {
        const type = detectColumnType(header);
        if (type) {
          columnTypes.set(type, index);
        } else if (header) {
          unmappedColumns.push({ header, index });
        }
      }
    });

    // Warn about required columns
    if (!columnTypes.has('title') && !columnTypes.has('username') && !columnTypes.has('url')) {
      result.warnings.push('Could not detect title, username, or URL columns. Import may be incomplete.');
    }

    // Track unique groups
    const groupMap = new Map();

    // Process each row
    for (const row of dataRows) {
      result.stats.totalEntries++;

      try {
        // Extract standard fields
        const getValue = (type) => {
          const idx = columnTypes.get(type);
          return idx !== undefined ? (row[idx] || '').trim() : '';
        };

        let title = getValue('title');
        const username = getValue('username');
        const password = getValue('password');
        const url = getValue('url');
        const notes = getValue('notes');
        const totpUri = getValue('totp');
        const groupPath = getValue('group');
        const tagsStr = getValue('tags');

        // Generate title from URL or username if missing
        if (!title) {
          if (url) {
            try {
              const urlObj = new URL(url);
              title = urlObj.hostname.replace('www.', '');
            } catch {
              title = url.substring(0, 50);
            }
          } else if (username) {
            title = username;
          } else {
            title = i18n.t('import.defaults.importEntry', { count: result.stats.totalEntries });
          }
        }

        // Handle group/folder
        let groupId = null;
        if (groupPath) {
          if (!groupMap.has(groupPath)) {
            const newGroupId = generateUUID();
            groupMap.set(groupPath, newGroupId);

            // Create group hierarchy
            const pathParts = groupPath.split(/[\/\\>]+/).map(p => p.trim()).filter(Boolean);
            let parentId = null;

            for (let i = 0; i < pathParts.length; i++) {
              const partPath = pathParts.slice(0, i + 1).join('/');
              if (!groupMap.has(partPath)) {
                const partGroupId = generateUUID();
                groupMap.set(partPath, partGroupId);

                result.groups.push(new VaultGroup({
                  id: partGroupId,
                  name: pathParts[i],
                  parentId,
                  icon: null,
                  color: null
                }));
                result.stats.importedGroups++;
                parentId = partGroupId;
              } else {
                parentId = groupMap.get(partPath);
              }
            }
          }
          groupId = groupMap.get(groupPath);
        }

        // Parse tags
        const tags = tagsStr
          ? tagsStr.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
          : [];

        // Parse TOTP
        const otpConfig = parseTotpUri(totpUri);

        // Handle unmapped columns as custom fields
        const customFields = [];
        for (const { header, index } of unmappedColumns) {
          const value = (row[index] || '').trim();
          if (value && !['', '-', 'n/a', 'none'].includes(value.toLowerCase())) {
            result.stats.customFieldsCount++;
            customFields.push({
              id: generateUUID(),
              label: header,
              value,
              kind: FIELD_KINDS.TEXT,
              isSecured: false
            });
          }
        }

        // Determine entry type
        let type = ENTRY_TYPES.LOGIN;
        const titleLower = title.toLowerCase();
        if (titleLower.includes('card') || titleLower.includes('carte') || titleLower.includes('credit')) {
          type = ENTRY_TYPES.CREDIT_CARD;
        } else if (!username && !password && notes) {
          type = ENTRY_TYPES.SECURE_NOTE;
        }

        // Create entry
        const entry = new VaultEntry({
          id: generateUUID(),
          title,
          type,
          username,
          secret: password ? [password] : [],
          notes,
          uri: url,
          tags,
          otpConfig,
          groupId,
          fields: customFields,
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastUsedAt: null,
            expiresAt: null,
            usageCount: 0
          },
          color: null,
          icon: null
        });

        result.entries.push(entry);
        result.stats.importedEntries++;

      } catch (e) {
        result.stats.skippedEntries++;
        result.errors.push(`Row ${result.stats.totalEntries}: ${e.message}`);
      }
    }

    result.stats.totalGroups = groupMap.size;
    safeLog(`[ImportService] CSV: ${result.stats.importedEntries}/${result.stats.totalEntries} entries, ${result.stats.importedGroups} groups`);

  } catch (e) {
    result.errors.push(`CSV parsing failed: ${e.message}`);
  }

  return result;
}

// ============================================================================
// JSON SECURITY UTILITIES
// ============================================================================

/**
 * Check if an object key is a prototype pollution vector
 * @param {string} key - Object key to check
 * @returns {boolean} True if key is dangerous
 */
function isDangerousKey(key) {
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
  return DANGEROUS_KEYS.includes(key);
}

/**
 * Recursively validate and sanitize JSON object to prevent prototype pollution
 * @param {*} obj - Object to validate
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum allowed depth
 * @returns {*} Sanitized object
 * @throws {Error} If validation fails
 */
function sanitizeJsonObject(obj, depth = 0, maxDepth = 20) {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    throw new Error('JSON structure too deeply nested');
  }

  // Handle primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonObject(item, depth + 1, maxDepth));
  }

  // Handle objects - create clean object without dangerous keys
  const sanitized = Object.create(null);
  for (const key of Object.keys(obj)) {
    if (isDangerousKey(key)) {
      // Skip dangerous keys silently
      continue;
    }
    sanitized[key] = sanitizeJsonObject(obj[key], depth + 1, maxDepth);
  }

  return sanitized;
}

/**
 * Safely parse and validate JSON content
 * @param {string} jsonContent - Raw JSON string
 * @returns {Object} Parsed and sanitized object
 * @throws {Error} If parsing or validation fails
 */
function safeJsonParse(jsonContent) {
  // Parse JSON
  const parsed = JSON.parse(jsonContent);

  // Must be an object (Bitwarden exports are always objects)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid JSON structure: expected object');
  }

  // Sanitize to prevent prototype pollution
  return sanitizeJsonObject(parsed);
}

/**
 * Validate Bitwarden JSON structure
 * @param {Object} data - Parsed JSON data
 * @returns {Object} Validation result with isValid and errors
 */
function validateBitwardenSchema(data) {
  const errors = [];

  // Check for expected Bitwarden structure
  if (data.encrypted === true) {
    errors.push('Encrypted Bitwarden exports are not supported. Please export unencrypted.');
    return { isValid: false, errors };
  }

  // Validate folders array if present
  if (data.folders !== undefined) {
    if (!Array.isArray(data.folders)) {
      errors.push('Invalid folders format: expected array');
    } else {
      for (let i = 0; i < data.folders.length; i++) {
        const folder = data.folders[i];
        if (typeof folder !== 'object' || folder === null) {
          errors.push(`Invalid folder at index ${i}`);
        }
      }
    }
  }

  // Validate items array if present
  if (data.items !== undefined) {
    if (!Array.isArray(data.items)) {
      errors.push('Invalid items format: expected array');
    } else {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (typeof item !== 'object' || item === null) {
          errors.push(`Invalid item at index ${i}`);
        }
      }
    }
  }

  // At least one of folders or items should exist
  if (!data.folders && !data.items) {
    errors.push('No folders or items found in export');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================================
// BITWARDEN PARSER
// ============================================================================

/**
 * Parse Bitwarden JSON export
 * @param {string} jsonContent
 * @returns {ImportResult}
 */
export function parseBitwardenJSON(jsonContent) {
  const result = {
    entries: [],
    groups: [],
    stats: {
      totalEntries: 0,
      importedEntries: 0,
      skippedEntries: 0,
      totalGroups: 0,
      importedGroups: 0,
      customFieldsCount: 0
    },
    warnings: [],
    errors: []
  };

  try {
    // Safe parse with prototype pollution protection
    const data = safeJsonParse(jsonContent);

    // Validate schema structure
    const validation = validateBitwardenSchema(data);
    if (!validation.isValid) {
      result.errors.push(...validation.errors);
      return result;
    }

    // Process folders
    const folderMap = new Map();
    if (data.folders) {
      for (const folder of data.folders) {
        result.stats.totalGroups++;
        const groupId = generateUUID();
        folderMap.set(folder.id, groupId);

        result.groups.push(new VaultGroup({
          id: groupId,
          name: folder.name || i18n.t('import.defaults.folder'),
          parentId: null,
          icon: null,
          color: null
        }));
        result.stats.importedGroups++;
      }
    }

    // Process items
    if (data.items) {
      for (const item of data.items) {
        result.stats.totalEntries++;

        try {
          // Map Bitwarden type to our type
          let type = ENTRY_TYPES.LOGIN;
          if (item.type === 2) type = ENTRY_TYPES.SECURE_NOTE;
          if (item.type === 3) type = ENTRY_TYPES.CREDIT_CARD;
          if (item.type === 4) type = ENTRY_TYPES.IDENTITY;

          const login = item.login || {};
          const card = item.card || {};

          // Get group ID
          const groupId = item.folderId ? folderMap.get(item.folderId) || null : null;

          // Process custom fields
          const customFields = [];
          if (item.fields) {
            for (const field of item.fields) {
              result.stats.customFieldsCount++;
              customFields.push({
                id: generateUUID(),
                label: field.name || i18n.t('import.defaults.customField'),
                value: field.value || '',
                kind: field.type === 1 ? FIELD_KINDS.HIDDEN : FIELD_KINDS.TEXT,
                isSecured: field.type === 1
              });
            }
          }

          // Parse TOTP
          let otpConfig = null;
          if (login.totp) {
            otpConfig = parseTotpUri(login.totp) || {
              secret: login.totp.toUpperCase().replace(/\s/g, ''),
              algorithm: 'SHA1',
              digits: 6,
              period: 30
            };
          }

          // Build entry based on type
          let username = '';
          let password = '';
          let uri = '';
          let notes = item.notes || '';

          if (type === ENTRY_TYPES.LOGIN) {
            username = login.username || '';
            password = login.password || '';
            uri = login.uris?.[0]?.uri || '';
          } else if (type === ENTRY_TYPES.CREDIT_CARD) {
            // Store card data in custom fields
            const t = i18n.t.bind(i18n);
            if (card.cardholderName) customFields.push({ id: generateUUID(), label: t('vault.labels.cardholder'), value: card.cardholderName, kind: FIELD_KINDS.TEXT, isSecured: false });
            if (card.number) customFields.push({ id: generateUUID(), label: t('vault.labels.cardNumber'), value: card.number, kind: FIELD_KINDS.PASSWORD, isSecured: true });
            if (card.expMonth && card.expYear) customFields.push({ id: generateUUID(), label: t('vault.labels.expiry'), value: `${card.expMonth}/${card.expYear}`, kind: FIELD_KINDS.TEXT, isSecured: false });
            if (card.code) customFields.push({ id: generateUUID(), label: t('vault.labels.cvv'), value: card.code, kind: FIELD_KINDS.PASSWORD, isSecured: true });
          }

          const entry = new VaultEntry({
            id: generateUUID(),
            title: item.name || i18n.t('vault.labels.untitled'),
            type,
            username,
            secret: password ? [password] : [],
            notes,
            uri,
            tags: [],
            otpConfig,
            groupId,
            fields: customFields,
            metadata: {
              createdAt: parseDate(item.creationDate) || Date.now(),
              updatedAt: parseDate(item.revisionDate) || Date.now(),
              lastUsedAt: null,
              expiresAt: null,
              usageCount: 0
            },
            color: null,
            icon: item.favorite ? '⭐' : null
          });

          result.entries.push(entry);
          result.stats.importedEntries++;

        } catch (e) {
          result.stats.skippedEntries++;
          result.errors.push(`Item "${item.name}": ${e.message}`);
        }
      }
    }

    safeLog(`[ImportService] Bitwarden: ${result.stats.importedEntries}/${result.stats.totalEntries} entries`);

  } catch (e) {
    result.errors.push(`JSON parsing failed: ${e.message}`);
  }

  return result;
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Detect the format of the import file
 * @param {string} content
 * @param {string} [filename]
 * @returns {'keepass-xml' | 'bitwarden-json' | 'csv' | 'unknown'}
 */
export function detectImportFormat(content, filename = '') {
  const trimmed = content.trim();
  const lowerFilename = filename.toLowerCase();

  // KeePass XML
  if (trimmed.startsWith('<?xml') && trimmed.includes('<KeePassFile>')) {
    return 'keepass-xml';
  }

  // Bitwarden JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.items || json.folders || json.encrypted) {
        return 'bitwarden-json';
      }
    } catch {
      // Not valid JSON
    }
  }

  // Check file extension
  if (lowerFilename.endsWith('.xml') && trimmed.includes('<KeePassFile>')) {
    return 'keepass-xml';
  }
  if (lowerFilename.endsWith('.json')) {
    return 'bitwarden-json';
  }
  if (lowerFilename.endsWith('.csv')) {
    return 'csv';
  }

  // Default to CSV if it looks like CSV
  if (trimmed.includes(',') && trimmed.includes('\n')) {
    return 'csv';
  }

  return 'unknown';
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

/**
 * Import data from a file
 * @param {string} content - File content
 * @param {Object} [options]
 * @param {string} [options.filename] - Original filename for format detection
 * @param {string} [options.format] - Force specific format
 * @param {Object} [options.csvColumnMap] - Manual CSV column mapping
 * @returns {ImportResult}
 */
export function importFromFile(content, options = {}) {
  const format = options.format || detectImportFormat(content, options.filename);

  safeLog(`[ImportService] Detected format: ${format}`);

  switch (format) {
    case 'keepass-xml':
      return parseKeePassXML(content);

    case 'bitwarden-json':
      return parseBitwardenJSON(content);

    case 'csv':
      return parseGenericCSV(content, { columnMap: options.csvColumnMap });

    default:
      return {
        entries: [],
        groups: [],
        stats: { totalEntries: 0, importedEntries: 0, skippedEntries: 0, totalGroups: 0, importedGroups: 0, customFieldsCount: 0 },
        warnings: [],
        errors: [`Unknown or unsupported file format. Supported: KeePass XML, Bitwarden JSON, CSV`]
      };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  importFromFile,
  detectImportFormat,
  parseKeePassXML,
  parseGenericCSV,
  parseBitwardenJSON
};
