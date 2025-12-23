/**
 * @fileoverview Vault Data Models
 * Defines the structure of all vault entities
 *
 * Hierarchy:
 *   Vault (.gpd file)
 *   ├── Metadata (name, timestamps, settings)
 *   ├── Folders[] (hierarchical organization)
 *   ├── Entries[] (password entries, notes, cards, etc.)
 *   ├── Tags[] (categorization)
 *   └── Presets[] (password generation presets)
 */

/**
 * @typedef {'login'|'note'|'card'|'identity'|'ssh'|'preset'} EntryType
 */

/**
 * @typedef {Object} VaultMetadata
 * @property {string} id - Unique vault ID
 * @property {string} name - Vault display name
 * @property {string} [description] - Optional description
 * @property {string} version - Vault format version
 * @property {string} createdAt - ISO timestamp
 * @property {string} modifiedAt - ISO timestamp
 * @property {number} entryCount - Number of entries
 * @property {Object} settings - Vault-specific settings
 */

/**
 * @typedef {Object} VaultFolder
 * @property {string} id - Folder ID
 * @property {string} name - Folder name
 * @property {string|null} parentId - Parent folder ID (null for root)
 * @property {string} icon - Folder icon (emoji or icon name)
 * @property {number} order - Display order
 * @property {string} createdAt - ISO timestamp
 * @property {string} modifiedAt - ISO timestamp
 */

/**
 * @typedef {Object} VaultTag
 * @property {string} id - Tag ID
 * @property {string} name - Tag name
 * @property {string} color - Tag color (hex)
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} CustomField
 * @property {string} name - Field name
 * @property {string} value - Field value
 * @property {'text'|'hidden'|'url'|'date'|'boolean'} type - Field type
 * @property {boolean} [protected] - If true, value is encrypted
 */

/**
 * @typedef {Object} TOTPConfig
 * @property {string} secret - TOTP secret (base32)
 * @property {number} [period] - Period in seconds (default: 30)
 * @property {number} [digits] - Number of digits (default: 6)
 * @property {'SHA1'|'SHA256'|'SHA512'} [algorithm] - Hash algorithm
 */

/**
 * @typedef {Object} VaultEntry
 * @property {string} id - Entry ID
 * @property {EntryType} type - Entry type
 * @property {string} title - Entry title
 * @property {string} icon - Entry icon (emoji or icon name)
 * @property {string|null} folderId - Parent folder ID
 * @property {string[]} tagIds - Associated tag IDs
 * @property {boolean} favorite - Is favorite
 * @property {string} createdAt - ISO timestamp
 * @property {string} modifiedAt - ISO timestamp
 * @property {string} [notes] - Free-text notes
 * @property {CustomField[]} customFields - Additional fields
 * @property {Object} data - Type-specific data (encrypted)
 */

/**
 * @typedef {Object} LoginData
 * @property {string} [url] - Website URL
 * @property {string} [username] - Username/email
 * @property {string} [password] - Password (encrypted)
 * @property {TOTPConfig} [totp] - TOTP configuration
 * @property {string[]} [history] - Previous passwords
 */

/**
 * @typedef {Object} CardData
 * @property {string} cardholderName - Name on card
 * @property {string} number - Card number (encrypted)
 * @property {string} expiry - Expiry date (MM/YY)
 * @property {string} cvv - CVV (encrypted)
 * @property {string} [pin] - PIN (encrypted)
 * @property {'visa'|'mastercard'|'amex'|'discover'|'other'} [brand]
 */

/**
 * @typedef {Object} IdentityData
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [country]
 * @property {string} [postalCode]
 * @property {string} [ssn] - Social security number (encrypted)
 * @property {string} [passport] - Passport number (encrypted)
 * @property {string} [license] - Driver's license (encrypted)
 */

/**
 * @typedef {Object} SSHKeyData
 * @property {string} privateKey - Private key (encrypted)
 * @property {string} [publicKey] - Public key
 * @property {string} [passphrase] - Key passphrase (encrypted)
 * @property {'rsa'|'ed25519'|'ecdsa'} keyType
 * @property {string} [fingerprint] - Key fingerprint
 * @property {string} [host] - Associated host
 */

/**
 * @typedef {Object} PresetData
 * @property {Object} config - Password generation configuration
 * @property {string} config.mode - Generation mode
 * @property {number} config.length - Password length
 * @property {string} config.policy - Security policy
 * @property {number} config.digits - Number of digits
 * @property {number} config.specials - Number of special chars
 * @property {string} config.customSpecials - Custom special chars
 * @property {string} config.placeDigits - Digit placement
 * @property {string} config.placeSpecials - Special placement
 * @property {string} config.caseMode - Case mode
 * @property {number} config.quantity - Generation quantity
 * @property {boolean} isDefault - Is default preset
 */

/**
 * @typedef {Object} VaultData
 * @property {VaultMetadata} metadata - Vault metadata
 * @property {VaultFolder[]} folders - All folders
 * @property {VaultEntry[]} entries - All entries
 * @property {VaultTag[]} tags - All tags
 */

/**
 * @typedef {Object} VaultFile
 * @property {Object} header - Unencrypted header
 * @property {string} header.version - File format version
 * @property {string} header.vaultId - Vault ID
 * @property {Object} header.keyData - Key derivation data
 * @property {Object} encryptedData - Encrypted vault data
 */

// Factory functions for creating entities

/**
 * Create new vault metadata
 * @param {string} name - Vault name
 * @param {string} [description] - Optional description
 * @returns {VaultMetadata}
 */
export function createMetadata(name, description = '') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    description,
    version: '1.0.0',
    createdAt: now,
    modifiedAt: now,
    entryCount: 0,
    settings: {
      autoLockMinutes: 5,
      clipboardClearSeconds: 30,
      showPasswordStrength: true
    }
  };
}

/**
 * Create new folder
 * @param {string} name - Folder name
 * @param {string|null} [parentId] - Parent folder ID
 * @returns {VaultFolder}
 */
export function createFolder(name, parentId = null) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    parentId,
    icon: '📁',
    order: 0,
    createdAt: now,
    modifiedAt: now
  };
}

/**
 * Create new tag
 * @param {string} name - Tag name
 * @param {string} [color] - Tag color
 * @returns {VaultTag}
 */
export function createTag(name, color = '#6366f1') {
  return {
    id: crypto.randomUUID(),
    name,
    color,
    createdAt: new Date().toISOString()
  };
}

/** Valid entry types */
const VALID_ENTRY_TYPES = ['login', 'note', 'card', 'identity', 'ssh', 'preset'];

/**
 * Create new entry
 * @param {EntryType} type - Entry type
 * @param {string} title - Entry title
 * @param {Object} data - Type-specific data
 * @returns {VaultEntry}
 * @throws {Error} If type or title is invalid
 */
export function createEntry(type, title, data = {}) {
  // Validate type
  if (!type || !VALID_ENTRY_TYPES.includes(type)) {
    throw new Error(`Invalid entry type: ${type}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
  }

  // Validate title
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Entry title must be a non-empty string');
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    title: title.trim(),
    icon: getDefaultIcon(type),
    folderId: data.folderId || null,
    tagIds: Array.isArray(data.tagIds) ? data.tagIds : [],
    favorite: data.favorite === true,
    createdAt: now,
    modifiedAt: now,
    notes: typeof data.notes === 'string' ? data.notes : '',
    customFields: Array.isArray(data.customFields) ? data.customFields : [],
    attachments: [],
    data
  };
}

/**
 * Get default icon for entry type
 * @param {EntryType} type - Entry type
 * @returns {string} Emoji icon
 */
function getDefaultIcon(type) {
  const icons = {
    login: '🔑',
    note: '📝',
    card: '💳',
    identity: '👤',
    ssh: '🔐',
    preset: '⚙️'
  };
  return icons[type] || '📄';
}

/**
 * Create empty vault data
 * @param {string} name - Vault name
 * @returns {VaultData}
 */
export function createEmptyVault(name) {
  return {
    metadata: createMetadata(name),
    folders: [],
    entries: [],
    tags: []
  };
}

/**
 * @typedef {Object} VaultSlot
 * @property {string} salt - Base64 salt for KDF
 * @property {string} iv - Base64 IV for Key Decryption
 * @property {number} iterations - KDF iterations
 * @property {string} encryptedKey - Base64 Encrypted Master Key
 */

/**
 * @typedef {Object} VaultFileV3
 * @property {string} version - '3.0.0'
 * @property {VaultSlot[]} slots - Array of 2 slots (Real & Decoy)
 * @property {string[]} payloads - Array of 2 base64 blobs (Encrypted Data)
 */

export const VAULT_FORMAT_VERSION = '3.0.0';
export const LEGACY_FORMAT_VERSION = '1.0.0';
