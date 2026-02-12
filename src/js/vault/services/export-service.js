/**
 * @fileoverview Export Service
 * Handles exporting vault entries to various formats
 *
 * SECURITY WARNING: All exports are in PLAINTEXT and contain unencrypted
 * passwords and sensitive data. Users should be warned before exporting.
 */

import i18n from '../../utils/i18n.js';

// ============================================================================
// EXPORT SECURITY INFORMATION
// ============================================================================

/**
 * Export format security metadata
 * All current formats export in PLAINTEXT - passwords are NOT encrypted
 */
export const EXPORT_SECURITY = Object.freeze({
  json: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextJson'
  },
  csv: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextCsv'
  },
  keepass: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextXml'
  },
  bitwarden: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextCsv'
  },
  lastpass: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextCsv'
  },
  '1password': {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextCsv'
  },
  chrome: {
    encrypted: false,
    containsPasswords: true,
    warningKey: 'vault.export.warnings.plaintextCsv'
  }
});

/**
 * Check if export format contains unencrypted sensitive data
 * @param {string} format - Export format
 * @returns {boolean} True if export is unencrypted plaintext
 */
export function isPlaintextExport(format) {
  const security = EXPORT_SECURITY[format];
  return security ? !security.encrypted && security.containsPasswords : true;
}

/**
 * Get security warning for export format
 * @param {string} format - Export format
 * @returns {string} Warning message i18n key
 */
export function getExportWarningKey(format) {
  const security = EXPORT_SECURITY[format];
  return security?.warningKey || 'vault.export.warnings.plaintextGeneric';
}

/**
 * Escape CSV special characters
 * @param {*} val - Value to escape
 * @returns {string} Escaped CSV value
 */
function escapeCSV(val) {
  // Handle null, undefined, and non-string types safely
  // Note: 0 and false are falsy but valid values
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escape XML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped XML string
 */
function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate UUID v4 using CSPRNG
 * @returns {string} UUID string
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().toUpperCase();
  }
  // Fallback using crypto.getRandomValues (CSPRNG)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`.toUpperCase();
}

/**
 * Format date for KeePass XML (ISO format)
 * @param {string|Date} dateStr - Date to format
 * @returns {string} ISO date string
 */
function formatDateISO(dateStr) {
  if (!dateStr) return new Date().toISOString();
  return new Date(dateStr).toISOString();
}

/**
 * Build CSV row from fields
 * @param {Array} fields - Field values
 * @returns {string} CSV row
 */
function buildCSVRow(fields) {
  return fields.map(escapeCSV).join(',');
}

/**
 * Export entries to JSON format
 * @param {Array} entries - Entries to export
 * @returns {string} JSON string
 */
export function exportToJSON(entries) {
  const exportData = {
    version: '3.1.2',
    exportedAt: new Date().toISOString(),
    entries: entries.map(e => ({
      type: e.type,
      title: e.title,
      data: e.data,
      notes: e.notes,
      favorite: e.favorite,
      folderId: e.folderId,
      createdAt: e.createdAt,
      modifiedAt: e.modifiedAt
    }))
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export entries to CSV format
 * @param {Array} entries - Entries to export
 * @param {string} format - CSV format (bitwarden, lastpass, 1password, chrome)
 * @returns {string} CSV string
 */
export function exportToCSV(entries, format = 'chrome') {
  const logins = entries.filter(e => e.type === 'login');
  let headers, mapRow;

  switch (format) {
    case 'bitwarden':
      headers = ['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'];
      mapRow = (e) => ['', e.favorite ? '1' : '', 'login', e.title, e.notes || '', '', '0', e.data?.url || '', e.data?.username || '', e.data?.password || '', e.data?.totp || ''];
      break;

    case 'lastpass':
      headers = ['url', 'username', 'password', 'totp', 'extra', 'name', 'grouping', 'fav'];
      mapRow = (e) => [e.data?.url || '', e.data?.username || '', e.data?.password || '', e.data?.totp || '', e.notes || '', e.title, '', e.favorite ? '1' : '0'];
      break;

    case '1password':
      headers = ['Title', 'Url', 'Username', 'Password', 'OTPAuth', 'Notes'];
      mapRow = (e) => {
        let otpauth = '';
        if (e.data?.totp) {
          const issuer = e.title || 'GenPwd';
          const account = e.data?.username || 'user';
          otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${e.data.totp}&issuer=${encodeURIComponent(issuer)}`;
        }
        return [e.title, e.data?.url || '', e.data?.username || '', e.data?.password || '', otpauth, e.notes || ''];
      };
      break;

    case 'chrome':
    default:
      headers = ['name', 'url', 'username', 'password', 'note'];
      mapRow = (e) => [e.title, e.data?.url || '', e.data?.username || '', e.data?.password || '', e.notes || ''];
      break;
  }

  const rows = [buildCSVRow(headers)];
  for (const entry of logins) {
    rows.push(buildCSVRow(mapRow(entry)));
  }

  return rows.join('\r\n');
}

/**
 * Build KeePass entry XML
 * @param {Object} entry - Entry object
 * @returns {string} XML string
 */
function buildKeePassEntry(entry) {
  const uuid = generateUUID();
  const createdAt = formatDateISO(entry.createdAt);
  const modifiedAt = formatDateISO(entry.modifiedAt);

  // Build notes with extra info for non-login types
  let notes = entry.notes || '';
  if (entry.type === 'card') {
    notes = `Type: Bank card\n` +
      `Holder: ${entry.data?.holder || ''}\n` +
      `Number: ${entry.data?.number || ''}\n` +
      `Expiry: ${entry.data?.expiry || ''}\n` +
      `CVV: ${entry.data?.cvv || ''}\n` +
      (notes ? `\n${notes}` : '');
  } else if (entry.type === 'identity') {
    notes = `Type: Identity\n` +
      `Name: ${entry.data?.fullName || ''}\n` +
      `Email: ${entry.data?.email || ''}\n` +
      `Phone: ${entry.data?.phone || ''}\n` +
      (notes ? `\n${notes}` : '');
  } else if (entry.type === 'note') {
    notes = entry.data?.content || notes;
  }

  // Add TOTP to notes if present
  if (entry.data?.totp) {
    const issuer = escapeXML(entry.title || 'GenPwd');
    const account = escapeXML(entry.data?.username || 'user');
    const totpUri = `otpauth://totp/${issuer}:${account}?secret=${entry.data.totp}&issuer=${issuer}`;
    notes += (notes ? '\n\n' : '') + `TOTP: ${totpUri}`;
  }

  return `
			<Entry>
				<UUID>${uuid}</UUID>
				<IconID>0</IconID>
				<ForegroundColor />
				<BackgroundColor />
				<OverrideURL />
				<Tags>${entry.favorite ? 'Favorite' : ''}</Tags>
				<Times>
					<CreationTime>${createdAt}</CreationTime>
					<LastModificationTime>${modifiedAt}</LastModificationTime>
					<LastAccessTime>${modifiedAt}</LastAccessTime>
					<ExpiryTime>${entry.data?.expiresAt ? formatDateISO(entry.data.expiresAt) : modifiedAt}</ExpiryTime>
					<Expires>${entry.data?.expiresAt ? 'True' : 'False'}</Expires>
					<UsageCount>0</UsageCount>
				</Times>
				<String>
					<Key>Title</Key>
					<Value>${escapeXML(entry.title)}</Value>
				</String>
				<String>
					<Key>UserName</Key>
					<Value>${escapeXML(entry.data?.username || entry.data?.email || '')}</Value>
				</String>
				<String>
					<Key>Password</Key>
					<Value Protected="True">${escapeXML(entry.data?.password || '')}</Value>
				</String>
				<String>
					<Key>URL</Key>
					<Value>${escapeXML(entry.data?.url || '')}</Value>
				</String>
				<String>
					<Key>Notes</Key>
					<Value>${escapeXML(notes)}</Value>
				</String>
			</Entry>`;
}

/**
 * Build KeePass group (folder) XML
 * @param {string} name - Group name
 * @param {Array} entries - Group entries
 * @param {boolean} isRoot - Is root group
 * @returns {string} XML string
 */
function buildKeePassGroup(name, entries, isRoot = false) {
  const uuid = generateUUID();
  const entriesXML = entries.map(buildKeePassEntry).join('');

  return `
		<Group>
			<UUID>${uuid}</UUID>
			<Name>${escapeXML(name)}</Name>
			<Notes />
			<IconID>${isRoot ? '48' : '0'}</IconID>
			<IsExpanded>True</IsExpanded>
			<DefaultAutoTypeSequence />
			<EnableAutoType>null</EnableAutoType>
			<EnableSearching>null</EnableSearching>
			<LastTopVisibleEntry>AAAAAAAAAAAAAAAAAAAAAA==</LastTopVisibleEntry>
			${entriesXML}
		</Group>`;
}

/**
 * Export entries to KeePass 2.x XML format
 * @param {Array} entries - Entries to export
 * @param {Array} folders - Folder definitions
 * @returns {string} XML string
 */
export function exportToKeePassXML(entries, folders = []) {
  // Group entries by folder
  const entriesByFolder = new Map();
  entriesByFolder.set('', []); // Root entries

  for (const entry of entries) {
    const folderId = entry.folderId || '';
    if (!entriesByFolder.has(folderId)) {
      entriesByFolder.set(folderId, []);
    }
    entriesByFolder.get(folderId).push(entry);
  }

  // Build folder groups
  let groupsXML = '';
  const rootEntries = entriesByFolder.get('') || [];

  // Add folder groups
  for (const [folderId, folderEntries] of entriesByFolder) {
    if (folderId === '') continue; // Skip root
    const folder = folders.find(f => f.id === folderId);
    const folderName = folder?.name || i18n.t('import.defaults.folder');
    groupsXML += buildKeePassGroup(folderName, folderEntries);
  }

  // Build full XML
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<KeePassFile>
	<Meta>
		<Generator>GenPwd Pro</Generator>
		<DatabaseName>GenPwd Pro Export</DatabaseName>
		<DatabaseDescription>Exported from GenPwd Pro</DatabaseDescription>
		<DefaultUserName />
		<MaintenanceHistoryDays>365</MaintenanceHistoryDays>
		<Color />
		<MasterKeyChanged>${now}</MasterKeyChanged>
		<RecycleBinEnabled>False</RecycleBinEnabled>
	</Meta>
	<Root>
		<Group>
			<UUID>${generateUUID()}</UUID>
			<Name>GenPwd Pro</Name>
			<Notes>Exported from GenPwd Pro - ${now}</Notes>
			<IconID>48</IconID>
			<IsExpanded>True</IsExpanded>
			${rootEntries.map(buildKeePassEntry).join('')}
			${groupsXML}
		</Group>
	</Root>
</KeePassFile>`;

  return xml;
}

/**
 * Perform export and trigger download
 * @param {Array} entries - Entries to export
 * @param {string} format - Export format
 * @param {Array} folders - Folder definitions (for KeePass)
 * @returns {Object} Export result with filename and content
 */
export function performExport(entries, format, folders = []) {
  if (!entries || entries.length === 0) {
    throw new Error('No entries to export');
  }

  const date = new Date().toISOString().split('T')[0];
  let content, filename, mimeType;

  if (format === 'json') {
    content = exportToJSON(entries);
    filename = `vault-export-${date}.json`;
    mimeType = 'application/json';
  } else if (format === 'keepass') {
    content = exportToKeePassXML(entries, folders);
    filename = `vault-export-${date}.xml`;
    mimeType = 'application/xml;charset=utf-8';
  } else {
    content = exportToCSV(entries, format);
    filename = `vault-export-${format}-${date}.csv`;
    mimeType = 'text/csv;charset=utf-8';
    // Add BOM for Excel compatibility
    content = '\ufeff' + content;
  }

  return { content, filename, mimeType };
}

/**
 * Download exported content
 * @param {string} content - Content to download
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
export function downloadExport(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Create export service instance
 * @param {Object} options
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @returns {Object} Export service
 */
export function createExportService(options = {}) {
  const { onSuccess, onError } = options;

  return {
    /**
     * Export entries with the specified format
     * @param {Array} entries - Entries to export
     * @param {string} format - Export format
     * @param {Array} folders - Folder definitions
     */
    export(entries, format, folders = []) {
      try {
        const result = performExport(entries, format, folders);
        downloadExport(result.content, result.filename, result.mimeType);
        if (onSuccess) {
          onSuccess({ count: entries.length, format, filename: result.filename });
        }
      } catch (error) {
        if (onError) {
          onError(error);
        } else {
          throw error;
        }
      }
    }
  };
}
