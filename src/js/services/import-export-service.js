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

// src/js/services/import-export-service.js - Advanced Import/Export Service

import { safeLog } from '../utils/logger.js';

/**
 * Password Entry Generic Format
 * @typedef {Object} PasswordEntry
 * @property {string} title - Entry title/name
 * @property {string} username - Username/email
 * @property {string} password - Password
 * @property {string} url - Website URL
 * @property {string} notes - Notes/comments
 * @property {string[]} tags - Tags/categories
 * @property {Object} metadata - Additional metadata
 * @property {string} folder - Folder/group
 * @property {Date} createdAt - Creation date
 * @property {Date} modifiedAt - Last modified date
 */

/**
 * ImportExportService - Handles import/export for multiple password managers
 *
 * Supported formats:
 * - KeePass: XML, CSV
 * - Bitwarden: JSON
 * - LastPass: CSV
 * - 1Password: CSV (1PIF as fallback)
 */
class ImportExportService {
  constructor() {
    this.supportedFormats = {
      import: ['keepass-xml', 'keepass-csv', 'bitwarden-json', 'lastpass-csv', '1password-csv', 'generic-json', 'generic-csv'],
      export: ['keepass-csv', 'bitwarden-json', 'lastpass-csv', '1password-csv', 'generic-json', 'generic-csv']
    };

    safeLog('ImportExportService initialized');
  }

  /**
   * Sanitize string to prevent XSS and injection attacks
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  sanitize(str) {
    if (typeof str !== 'string') return '';

    return str
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 10000); // Limit length
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {string} - Validated URL or empty string
   */
  validateUrl(url) {
    if (!url) return '';

    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return url;
      }
    } catch {
      // Invalid URL
    }

    return '';
  }

  /**
   * Parse CSV content (supports multiline fields in quotes)
   * @param {string} csv - CSV content
   * @param {string} delimiter - CSV delimiter (default: ',')
   * @returns {Array<Object>} - Array of row objects
   */
  parseCSV(csv, delimiter = ',') {
    if (!csv || !csv.trim()) return [];

    // Parse all rows first (respects quotes for multiline fields)
    const allRows = this.parseCSVRows(csv, delimiter);
    if (allRows.length === 0) return [];

    // First row is headers
    const headers = allRows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    // Convert remaining rows to objects
    for (let i = 1; i < allRows.length; i++) {
      const values = allRows[i];
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Parse CSV into rows (handles multiline quoted fields)
   * @param {string} csv - CSV content
   * @param {string} delimiter - Delimiter
   * @returns {Array<Array<string>>} - 2D array of values
   */
  parseCSVRows(csv, delimiter = ',') {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // End of row (only if not in quotes)
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in \r\n
        }
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        }
      } else {
        // Regular character (including \n inside quotes)
        currentField += char;
      }
    }

    // Push last field and row if exists
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line (handles quoted values)
   * @param {string} line - CSV line
   * @param {string} delimiter - Delimiter
   * @returns {Array<string>} - Array of values
   */
  parseCSVLine(line, delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Convert array of entries to CSV
   * @param {Array<Object>} entries - Array of entries
   * @param {Array<string>} headers - CSV headers
   * @returns {string} - CSV content
   */
  toCSV(entries, headers) {
    let csv = headers.map(h => `"${h}"`).join(',') + '\n';

    entries.forEach(entry => {
      const row = headers.map(header => {
        const value = entry[header] || '';
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  // ========== KEEPASS ==========

  /**
   * Import from KeePass XML format
   * @param {string} xmlContent - XML file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importKeePassXML(xmlContent) {
    try {
      // SECURITY: Validate XML size (limit to 10MB)
      const MAX_XML_SIZE = 10 * 1024 * 1024; // 10MB
      if (xmlContent.length > MAX_XML_SIZE) {
        throw new Error('XML file too large (max 10MB)');
      }

      // SECURITY: Check for dangerous XML patterns (XXE, billion laughs, etc.)
      const dangerousPatterns = [
        /<!ENTITY/i,           // External entity definitions
        /<!DOCTYPE[^>]*\[/i,   // DOCTYPE with internal subset
        /SYSTEM\s+["']/i,      // System identifiers
        /PUBLIC\s+["']/i,      // Public identifiers
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(xmlContent)) {
          throw new Error('XML contains forbidden patterns (potential XXE attack)');
        }
      }

      // SECURITY: Strip any DOCTYPE declarations entirely
      xmlContent = xmlContent.replace(/<!DOCTYPE[^>]*>/gi, '');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Invalid XML format: ' + parseError.textContent);
      }

      // SECURITY: Validate root element
      if (!xmlDoc.documentElement || xmlDoc.documentElement.nodeName !== 'KeePassFile') {
        // Allow some flexibility for different KeePass formats
        const validRoots = ['KeePassFile', 'database', 'pwlist'];
        if (!validRoots.includes(xmlDoc.documentElement.nodeName)) {
          safeLog('Warning: Unexpected XML root element:', xmlDoc.documentElement.nodeName);
        }
      }

      const entries = [];
      const entryNodes = xmlDoc.querySelectorAll('Entry');

      entryNodes.forEach(entryNode => {
        const entry = {
          title: '',
          username: '',
          password: '',
          url: '',
          notes: '',
          tags: [],
          metadata: {},
          folder: '',
          createdAt: null,
          modifiedAt: null
        };

        // Parse String elements
        const strings = entryNode.querySelectorAll('String');
        strings.forEach(str => {
          const key = str.querySelector('Key')?.textContent;
          const value = str.querySelector('Value')?.textContent || '';

          switch (key) {
            case 'Title':
              entry.title = this.sanitize(value);
              break;
            case 'UserName':
              entry.username = this.sanitize(value);
              break;
            case 'Password':
              entry.password = value; // Don't sanitize password
              break;
            case 'URL':
              entry.url = this.validateUrl(value);
              break;
            case 'Notes':
              entry.notes = this.sanitize(value);
              break;
          }
        });

        // Parse Tags
        const tagsNode = entryNode.querySelector('Tags');
        if (tagsNode) {
          const tagsText = tagsNode.textContent;
          if (tagsText) {
            entry.tags = tagsText.split(/[,;]/).map(t => this.sanitize(t)).filter(t => t);
          }
        }

        // Parse Times
        const times = entryNode.querySelector('Times');
        if (times) {
          const creationTime = times.querySelector('CreationTime')?.textContent;
          const lastModTime = times.querySelector('LastModificationTime')?.textContent;

          if (creationTime) entry.createdAt = new Date(creationTime);
          if (lastModTime) entry.modifiedAt = new Date(lastModTime);
        }

        entries.push(entry);
      });

      safeLog(`KeePass XML: Imported ${entries.length} entries`);
      return entries;
    } catch (error) {
      safeLog(`Error importing KeePass XML: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import from KeePass CSV format
   * @param {string} csvContent - CSV file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importKeePassCSV(csvContent) {
    try {
      const rows = this.parseCSV(csvContent);
      const entries = [];

      rows.forEach(row => {
        entries.push({
          title: this.sanitize(row['Account'] || row['Title'] || row['Name'] || ''),
          username: this.sanitize(row['Login Name'] || row['Username'] || row['User Name'] || ''),
          password: row['Password'] || '',
          url: this.validateUrl(row['Web Site'] || row['URL'] || row['Login URL'] || ''),
          notes: this.sanitize(row['Comments'] || row['Notes'] || ''),
          tags: [],
          metadata: {},
          folder: this.sanitize(row['Group'] || row['Folder'] || ''),
          createdAt: null,
          modifiedAt: null
        });
      });

      safeLog(`KeePass CSV: Imported ${entries.length} entries`);
      return entries;
    } catch (error) {
      safeLog(`Error importing KeePass CSV: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to KeePass CSV format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - CSV content
   */
  exportKeePassCSV(entries) {
    const headers = ['Account', 'Login Name', 'Password', 'Web Site', 'Comments'];

    const rows = entries.map(entry => ({
      'Account': entry.title || '',
      'Login Name': entry.username || '',
      'Password': entry.password || '',
      'Web Site': entry.url || '',
      'Comments': entry.notes || ''
    }));

    return this.toCSV(rows, headers);
  }

  // ========== BITWARDEN ==========

  /**
   * Import from Bitwarden JSON format
   * @param {string} jsonContent - JSON file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importBitwardenJSON(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      const entries = [];

      const items = data.items || [];

      items.forEach(item => {
        // Only process login items
        if (item.type === 1 || !item.type) { // Type 1 = Login
          const login = item.login || {};

          entries.push({
            title: this.sanitize(item.name || ''),
            username: this.sanitize(login.username || ''),
            password: login.password || '',
            url: this.validateUrl((login.uris && login.uris[0]?.uri) || ''),
            notes: this.sanitize(item.notes || ''),
            tags: [],
            metadata: {
              favorite: item.favorite || false,
              folderId: item.folderId || null
            },
            folder: '',
            createdAt: item.creationDate ? new Date(item.creationDate) : null,
            modifiedAt: item.revisionDate ? new Date(item.revisionDate) : null
          });
        }
      });

      safeLog(`Bitwarden JSON: Imported ${entries.length} entries`);
      return entries;
    } catch (error) {
      safeLog(`Error importing Bitwarden JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to Bitwarden JSON format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - JSON content
   */
  exportBitwardenJSON(entries) {
    const data = {
      encrypted: false,
      folders: [],
      items: entries.map((entry, index) => ({
        id: `${index + 1}`,
        organizationId: null,
        folderId: null,
        type: 1, // Login
        name: entry.title || 'Untitled',
        notes: entry.notes || null,
        favorite: false,
        login: {
          username: entry.username || null,
          password: entry.password || null,
          totp: null,
          uris: entry.url ? [{ match: null, uri: entry.url }] : []
        },
        collectionIds: null
      }))
    };

    return JSON.stringify(data, null, 2);
  }

  // ========== LASTPASS ==========

  /**
   * Import from LastPass CSV format
   * @param {string} csvContent - CSV file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importLastPassCSV(csvContent) {
    try {
      const rows = this.parseCSV(csvContent);
      const entries = [];

      rows.forEach(row => {
        entries.push({
          title: this.sanitize(row['name'] || row['Name'] || ''),
          username: this.sanitize(row['username'] || row['Username'] || ''),
          password: row['password'] || row['Password'] || '',
          url: this.validateUrl(row['url'] || row['URL'] || ''),
          notes: this.sanitize(row['extra'] || row['Notes'] || row['note'] || ''),
          tags: [],
          metadata: {},
          folder: this.sanitize(row['grouping'] || row['Folder'] || ''),
          createdAt: null,
          modifiedAt: null
        });
      });

      safeLog(`LastPass CSV: Imported ${entries.length} entries`);
      return entries;
    } catch (error) {
      safeLog(`Error importing LastPass CSV: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to LastPass CSV format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - CSV content
   */
  exportLastPassCSV(entries) {
    const headers = ['url', 'username', 'password', 'extra', 'name', 'grouping', 'fav'];

    const rows = entries.map(entry => ({
      'url': entry.url || '',
      'username': entry.username || '',
      'password': entry.password || '',
      'extra': entry.notes || '',
      'name': entry.title || '',
      'grouping': entry.folder || '',
      'fav': '0'
    }));

    return this.toCSV(rows, headers);
  }

  // ========== 1PASSWORD ==========

  /**
   * Import from 1Password CSV format
   * @param {string} csvContent - CSV file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  import1PasswordCSV(csvContent) {
    try {
      const rows = this.parseCSV(csvContent);
      const entries = [];

      rows.forEach(row => {
        entries.push({
          title: this.sanitize(row['Title'] || row['title'] || row['Name'] || ''),
          username: this.sanitize(row['Username'] || row['username'] || ''),
          password: row['Password'] || row['password'] || '',
          url: this.validateUrl(row['URL'] || row['url'] || row['Website'] || ''),
          notes: this.sanitize(row['Notes'] || row['notes'] || ''),
          tags: (row['Tags'] || row['tags'] || '').split(',').map(t => this.sanitize(t)).filter(t => t),
          metadata: {},
          folder: this.sanitize(row['Folder'] || row['folder'] || row['Category'] || ''),
          createdAt: null,
          modifiedAt: null
        });
      });

      safeLog(`1Password CSV: Imported ${entries.length} entries`);
      return entries;
    } catch (error) {
      safeLog(`Error importing 1Password CSV: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to 1Password CSV format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - CSV content
   */
  export1PasswordCSV(entries) {
    const headers = ['Title', 'URL', 'Username', 'Password', 'Notes', 'Category'];

    const rows = entries.map(entry => ({
      'Title': entry.title || '',
      'URL': entry.url || '',
      'Username': entry.username || '',
      'Password': entry.password || '',
      'Notes': entry.notes || '',
      'Category': entry.folder || 'Login'
    }));

    return this.toCSV(rows, headers);
  }

  // ========== GENERIC FORMATS ==========

  /**
   * Import from generic JSON format
   * @param {string} jsonContent - JSON file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importGenericJSON(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      const entries = Array.isArray(data) ? data : (data.entries || data.passwords || []);

      return entries.map(entry => ({
        title: this.sanitize(entry.title || entry.name || entry.site || ''),
        username: this.sanitize(entry.username || entry.user || entry.email || ''),
        password: entry.password || entry.pass || '',
        url: this.validateUrl(entry.url || entry.website || entry.site || ''),
        notes: this.sanitize(entry.notes || entry.note || entry.comment || ''),
        tags: Array.isArray(entry.tags) ? entry.tags.map(t => this.sanitize(t)) : [],
        metadata: entry.metadata || {},
        folder: this.sanitize(entry.folder || entry.category || entry.group || ''),
        createdAt: entry.createdAt ? new Date(entry.createdAt) : null,
        modifiedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : null
      }));
    } catch (error) {
      safeLog(`Error importing Generic JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to generic JSON format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - JSON content
   */
  exportGenericJSON(entries) {
    const data = {
      version: '1.0',
      exported: new Date().toISOString(),
      source: 'GenPwd Pro',
      count: entries.length,
      entries: entries
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import from generic CSV format
   * @param {string} csvContent - CSV file content
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  importGenericCSV(csvContent) {
    try {
      const rows = this.parseCSV(csvContent);

      return rows.map(row => ({
        title: this.sanitize(row['title'] || row['Title'] || row['name'] || row['Name'] || ''),
        username: this.sanitize(row['username'] || row['Username'] || row['user'] || ''),
        password: row['password'] || row['Password'] || '',
        url: this.validateUrl(row['url'] || row['URL'] || row['website'] || ''),
        notes: this.sanitize(row['notes'] || row['Notes'] || row['note'] || ''),
        tags: [],
        metadata: {},
        folder: this.sanitize(row['folder'] || row['Folder'] || row['category'] || ''),
        createdAt: null,
        modifiedAt: null
      }));
    } catch (error) {
      safeLog(`Error importing Generic CSV: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to generic CSV format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @returns {string} - CSV content
   */
  exportGenericCSV(entries) {
    const headers = ['title', 'username', 'password', 'url', 'notes', 'folder'];

    const rows = entries.map(entry => ({
      'title': entry.title || '',
      'username': entry.username || '',
      'password': entry.password || '',
      'url': entry.url || '',
      'notes': entry.notes || '',
      'folder': entry.folder || ''
    }));

    return this.toCSV(rows, headers);
  }

  // ========== MAIN IMPORT/EXPORT METHODS ==========

  /**
   * Import passwords from file content
   * @param {string} content - File content
   * @param {string} format - Import format
   * @returns {Array<PasswordEntry>} - Array of password entries
   */
  import(content, format) {
    switch (format) {
      case 'keepass-xml':
        return this.importKeePassXML(content);
      case 'keepass-csv':
        return this.importKeePassCSV(content);
      case 'bitwarden-json':
        return this.importBitwardenJSON(content);
      case 'lastpass-csv':
        return this.importLastPassCSV(content);
      case '1password-csv':
        return this.import1PasswordCSV(content);
      case 'generic-json':
        return this.importGenericJSON(content);
      case 'generic-csv':
        return this.importGenericCSV(content);
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  /**
   * Export passwords to specified format
   * @param {Array<PasswordEntry>} entries - Array of password entries
   * @param {string} format - Export format
   * @returns {string} - Exported content
   */
  export(entries, format) {
    switch (format) {
      case 'keepass-csv':
        return this.exportKeePassCSV(entries);
      case 'bitwarden-json':
        return this.exportBitwardenJSON(entries);
      case 'lastpass-csv':
        return this.exportLastPassCSV(entries);
      case '1password-csv':
        return this.export1PasswordCSV(entries);
      case 'generic-json':
        return this.exportGenericJSON(entries);
      case 'generic-csv':
        return this.exportGenericCSV(entries);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get format info
   * @param {string} format - Format identifier
   * @returns {Object} - Format information
   */
  getFormatInfo(format) {
    const formats = {
      'keepass-xml': { name: 'KeePass XML', extension: '.xml', type: 'import' },
      'keepass-csv': { name: 'KeePass CSV', extension: '.csv', type: 'both' },
      'bitwarden-json': { name: 'Bitwarden JSON', extension: '.json', type: 'both' },
      'lastpass-csv': { name: 'LastPass CSV', extension: '.csv', type: 'both' },
      '1password-csv': { name: '1Password CSV', extension: '.csv', type: 'both' },
      'generic-json': { name: 'Generic JSON', extension: '.json', type: 'both' },
      'generic-csv': { name: 'Generic CSV', extension: '.csv', type: 'both' }
    };

    return formats[format] || null;
  }
}

// Create singleton instance
const importExportService = new ImportExportService();

export default importExportService;
export { ImportExportService };
