/**
 * @fileoverview Import Parsers
 * Pure parsing functions for various password manager formats
 */

import { t } from '../../utils/i18n.js';

/**
 * Parse a CSV line handling quoted values
 * @param {string} line - CSV line to parse
 * @returns {string[]} Parsed values
 */
export function parseCSVLine(line) {
  const result = [];
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
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(v => v.trim());
}

/**
 * Detect CSV format based on headers
 * @param {string[]} headers - Lowercase header names
 * @returns {string} Format identifier
 */
export function detectCSVFormat(headers) {
  const headerStr = headers.join(',');

  // KeePass format: Group,Title,Username,Password,URL,Notes,TOTP,Icon,Last Modified,Created
  if (headerStr.includes('group') && headerStr.includes('title') &&
    (headerStr.includes('username') || headerStr.includes('user name'))) {
    return 'keepass';
  }

  // LastPass format: url,username,password,totp,extra,name,grouping,fav
  if (headerStr.includes('grouping') || (headerStr.includes('extra') && headerStr.includes('totp'))) {
    return 'lastpass';
  }

  // 1Password format: Title,Url,Username,Password,Notes,OTPAuth,Favorite,Archive
  if (headerStr.includes('title') && (headerStr.includes('otpauth') || headerStr.includes('archive'))) {
    return '1password';
  }

  // Bitwarden format: folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
  if (headerStr.includes('login_uri') || headerStr.includes('login_username') || headerStr.includes('reprompt')) {
    return 'bitwarden';
  }

  // Chrome format: name,url,username,password
  if (headers.length === 4 && headerStr.includes('name') && headerStr.includes('url')) {
    return 'chrome';
  }

  // Firefox format: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
  if (headerStr.includes('httprealm') || headerStr.includes('formactionorigin')) {
    return 'firefox';
  }

  return 'generic';
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain or original URL
 */
function extractDomainFromUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Map CSV row to entry object based on format
 * @param {string[]} headers - Header names
 * @param {string[]} values - Row values
 * @param {string} format - Detected format
 * @returns {Object} Entry object
 */
export function mapCSVToEntry(headers, values, format) {
  const row = {};
  headers.forEach((h, i) => {
    row[h] = values[i] || '';
  });

  switch (format) {
    case 'keepass':
      return {
        title: row['title'] || row['entry'] || t('import.defaults.keepass'),
        username: row['username'] || row['user name'] || row['login'] || '',
        password: row['password'] || '',
        url: row['url'] || row['web site'] || '',
        totp: row['totp'] || row['otp'] || row['time-based one-time password'] || '',
        notes: row['notes'] || row['comments'] || '',
        folder: row['group'] || row['path'] || ''
      };

    case 'lastpass':
      return {
        title: row['name'] || row['url'] || t('import.defaults.lastpass'),
        username: row['username'] || '',
        password: row['password'] || '',
        url: row['url'] || '',
        totp: row['totp'] || '',
        notes: row['extra'] || ''
      };

    case '1password': {
      // Extract secret from otpauth:// URI
      let otpSecret = row['otpauth'] || '';
      if (otpSecret.startsWith('otpauth://')) {
        try {
          const url = new URL(otpSecret);
          otpSecret = url.searchParams.get('secret') || '';
        } catch { /* Invalid otpauth URL - ignore */ }
      }
      return {
        title: row['title'] || row['url'] || t('import.defaults.onepassword'),
        username: row['username'] || '',
        password: row['password'] || '',
        url: row['url'] || '',
        totp: otpSecret,
        notes: row['notes'] || ''
      };
    }

    case 'bitwarden':
      return {
        title: row['name'] || row['login_uri'] || t('import.defaults.bitwarden'),
        username: row['login_username'] || '',
        password: row['login_password'] || '',
        url: row['login_uri'] || '',
        totp: row['login_totp'] || '',
        notes: row['notes'] || ''
      };

    case 'chrome':
      return {
        title: row['name'] || row['url'] || t('import.defaults.chrome'),
        username: row['username'] || '',
        password: row['password'] || '',
        url: row['url'] || '',
        totp: '',
        notes: row['note'] || ''
      };

    case 'firefox':
      return {
        title: extractDomainFromUrl(row['url']) || t('import.defaults.firefox'),
        username: row['username'] || '',
        password: row['password'] || '',
        url: row['url'] || '',
        totp: '',
        notes: ''
      };

    default:
      // Generic - try common header names
      return {
        title: row['name'] || row['title'] || row['site'] || row['url'] || t('import.defaults.untitled'),
        username: row['username'] || row['login'] || row['email'] || row['user'] || '',
        password: row['password'] || row['pass'] || row['pwd'] || '',
        url: row['url'] || row['website'] || row['site'] || row['uri'] || '',
        totp: row['totp'] || row['otp'] || row['2fa'] || row['authenticator'] || '',
        notes: row['notes'] || row['note'] || row['extra'] || row['comments'] || ''
      };
  }
}

/**
 * Parse a single KeePass XML entry element
 * @param {Element} entryEl - XML Entry element
 * @returns {Object} Parsed entry object
 */
export function parseKeePassEntry(entryEl) {
  const entry = {
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    totp: ''
  };

  // Parse String elements
  const strings = entryEl.querySelectorAll('String');
  for (const stringEl of strings) {
    const key = stringEl.querySelector('Key')?.textContent || '';
    const valueEl = stringEl.querySelector('Value');
    const value = valueEl?.textContent || '';

    switch (key) {
      case 'Title':
        entry.title = value;
        break;
      case 'UserName':
        entry.username = value;
        break;
      case 'Password':
        entry.password = value;
        break;
      case 'URL':
        entry.url = value;
        break;
      case 'Notes':
        entry.notes = value;
        break;
      case 'otp':
      case 'TOTP Seed':
      case 'TOTP':
        entry.totp = value;
        break;
    }
  }

  // Try to extract TOTP from notes if it contains otpauth://
  if (!entry.totp && entry.notes) {
    const otpMatch = entry.notes.match(/otpauth:\/\/totp[^\s]+/);
    if (otpMatch) {
      try {
        const url = new URL(otpMatch[0]);
        entry.totp = url.searchParams.get('secret') || '';
      } catch { /* Invalid otpauth URL - ignore */ }
    }
  }

  return entry;
}

/**
 * Parse KeePass XML and return entries array
 * @param {string} xmlText - KeePass XML content
 * @returns {Object} Parsed result with entries and groups
 */
export function parseKeePassXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(t('vault.messages.invalidXmlFormat'));
  }

  // Check if it's a KeePass file
  const root = doc.querySelector('KeePassFile');
  if (!root) {
    throw new Error(t('vault.messages.notKeePassFile'));
  }

  const entries = [];
  const groups = [];

  // Process all groups recursively
  const processGroup = (groupEl, parentPath = '', parentId = null) => {
    const nameEl = groupEl.querySelector(':scope > Name');
    const groupName = nameEl?.textContent || '';
    const currentPath = parentPath ? `${parentPath}/${groupName}` : groupName;

    // Skip Recycle Bin
    if (groupName === 'Recycle Bin' || groupName === 'Corbeille') {
      return;
    }

    // Add group if it has a meaningful name and not root
    let groupId = null;
    if (groupName && groupName !== 'Root' && groupName !== 'Racine') {
      groupId = `group-${Date.now()}-${crypto.randomUUID().slice(0, 9)}`;
      groups.push({
        id: groupId,
        name: groupName,
        path: currentPath,
        parentId: parentId
      });
    }

    // Process entries in this group
    const entryEls = groupEl.querySelectorAll(':scope > Entry');
    for (const entryEl of entryEls) {
      const entry = parseKeePassEntry(entryEl);
      if (entry.title && (entry.username || entry.password || entry.url)) {
        entries.push({
          ...entry,
          groupPath: currentPath,
          groupId: groupId
        });
      }
    }

    // Process subgroups
    const subGroups = groupEl.querySelectorAll(':scope > Group');
    for (const subGroup of subGroups) {
      processGroup(subGroup, currentPath, groupId);
    }
  };

  // Find root group(s)
  const rootGroups = doc.querySelectorAll('Root > Group');
  for (const rootGroup of rootGroups) {
    processGroup(rootGroup);
  }

  return { entries, groups };
}

/**
 * Parse CSV text and return entries array
 * @param {string} csvText - CSV content
 * @returns {Object} Parsed result with entries and format info
 */
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error(t('vault.messages.emptyCsvFile'));
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const format = detectCSVFormat(headers);

  const formatNames = {
    keepass: 'KeePass',
    bitwarden: 'Bitwarden',
    lastpass: 'LastPass',
    '1password': '1Password',
    chrome: 'Chrome/Edge',
    firefox: 'Firefox',
    generic: 'Generic format'
  };

  const entries = [];
  const skippedRows = [];
  const headerCount = headers.length;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Skip completely empty rows
    if (values.length === 0 || values.every(v => !v)) continue;

    // Validate column count - allow some flexibility but detect severely malformed rows
    // Too few columns: might be missing required fields
    // Too many columns: might indicate parsing issues
    if (values.length < Math.min(2, headerCount) || values.length > headerCount + 5) {
      skippedRows.push(i + 1); // 1-based line number
      continue;
    }

    const entry = mapCSVToEntry(headers, values, format);
    if (entry && entry.title && entry.password) {
      entries.push(entry);
    }
  }

  return {
    entries,
    format,
    formatName: formatNames[format],
    withTotp: entries.filter(e => e.totp).length,
    skippedRows: skippedRows.length > 0 ? skippedRows : null
  };
}
