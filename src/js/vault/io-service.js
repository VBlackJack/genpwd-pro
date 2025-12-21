/**
 * @fileoverview Vault I/O Service
 * Handles serialization and deserialization of vault data.
 *
 * This module provides functions to:
 * - Export vault data to encrypted file format (.gpdb)
 * - Import vault data from encrypted files
 * - Handle the transformation between in-memory and persisted formats
 *
 * File Format (.gpdb v2):
 * {
 *   "format": "gpdb",
 *   "version": 2,
 *   "createdAt": ISO date string,
 *   "modifiedAt": ISO date string,
 *   "kdf": { algorithm, iterations, memory, parallelism, salt },
 *   "encrypted": {
 *     "algorithm": "AES-256-GCM",
 *     "nonce": base64 string,
 *     "ciphertext": base64 string,
 *     "tag": base64 string
 *   }
 * }
 *
 * @license Apache-2.0
 */

import { VaultEntry, VaultGroup, ENTRY_TYPES, FIELD_KINDS } from './models.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const GPDB_FORMAT = 'gpdb';
const GPDB_VERSION = 2;
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 128; // bits

// Default KDF parameters (Argon2id-like via PBKDF2 fallback)
const DEFAULT_KDF_PARAMS = {
  algorithm: 'PBKDF2',
  iterations: 600000,
  hash: 'SHA-256',
  saltLength: 32
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes
 * @returns {Uint8Array}
 */
function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert Uint8Array to Base64 string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
}

/**
 * Convert Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

/**
 * Encode text to UTF-8 bytes
 * @param {string} text
 * @returns {Uint8Array}
 */
function textToBytes(text) {
  return new TextEncoder().encode(text);
}

/**
 * Decode UTF-8 bytes to text
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

/**
 * Securely wipe bytes from memory
 * @param {Uint8Array} bytes
 */
function wipeBytes(bytes) {
  if (bytes && bytes.fill) {
    crypto.getRandomValues(bytes);
    bytes.fill(0);
  }
}

// ============================================================================
// KDF (Key Derivation)
// ============================================================================

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - User password
 * @param {Uint8Array} salt - Random salt
 * @param {Object} kdfParams - KDF parameters
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt, kdfParams) {
  const passwordBytes = textToBytes(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: kdfParams.iterations || DEFAULT_KDF_PARAMS.iterations,
      hash: kdfParams.hash || DEFAULT_KDF_PARAMS.hash
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Derive raw key bytes for verification
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {Object} kdfParams
 * @returns {Promise<Uint8Array>}
 */
async function deriveKeyBytes(password, salt, kdfParams) {
  const passwordBytes = textToBytes(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: kdfParams.iterations || DEFAULT_KDF_PARAMS.iterations,
      hash: kdfParams.hash || DEFAULT_KDF_PARAMS.hash
    },
    keyMaterial,
    256
  );

  return new Uint8Array(keyBits);
}

// ============================================================================
// ENCRYPTION / DECRYPTION
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - JSON string to encrypt
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<{nonce: string, ciphertext: string, tag: string}>}
 */
async function encryptData(plaintext, key) {
  const nonce = getRandomBytes(NONCE_LENGTH);
  const plaintextBytes = textToBytes(plaintext);

  const ciphertextWithTag = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: TAG_LENGTH
    },
    key,
    plaintextBytes
  );

  // Split ciphertext and tag (tag is last 16 bytes)
  const ciphertextBytes = new Uint8Array(ciphertextWithTag);
  const tagLength = TAG_LENGTH / 8;
  const ciphertext = ciphertextBytes.slice(0, -tagLength);
  const tag = ciphertextBytes.slice(-tagLength);

  return {
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    tag: bytesToBase64(tag)
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {{nonce: string, ciphertext: string, tag: string}} encrypted
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>}
 */
async function decryptData(encrypted, key) {
  const nonce = base64ToBytes(encrypted.nonce);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const tag = base64ToBytes(encrypted.tag);

  // Combine ciphertext and tag (WebCrypto expects them together)
  const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(tag, ciphertext.length);

  const plaintextBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: TAG_LENGTH
    },
    key,
    ciphertextWithTag
  );

  return bytesToText(new Uint8Array(plaintextBytes));
}

// ============================================================================
// VAULT SERIALIZATION
// ============================================================================

/**
 * Serialize vault data to plain object
 * @param {Object} vaultData - Vault data structure
 * @returns {Object}
 */
function serializeVaultData(vaultData) {
  const { entries, groups, tags, metadata } = vaultData;

  return {
    metadata: {
      ...metadata,
      exportedAt: new Date().toISOString()
    },
    entries: entries.map(entry => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      username: entry.username || entry.data?.username,
      secret: entry.secret || (entry.data?.password ? [entry.data.password] : []),
      notes: entry.notes || entry.data?.notes,
      uri: entry.uri || entry.data?.url,
      tags: entry.tags || [],
      otpConfig: entry.otpConfig || (entry.data?.totp ? { secret: entry.data.totp } : null),
      groupId: entry.groupId || entry.folderId,
      fields: entry.fields || entry.data?.fields || [],
      metadata: entry.metadata || {
        createdAt: entry.createdAt ? new Date(entry.createdAt).getTime() : Date.now(),
        updatedAt: entry.modifiedAt ? new Date(entry.modifiedAt).getTime() : Date.now(),
        lastUsedAt: null,
        expiresAt: entry.data?.expiresAt ? new Date(entry.data.expiresAt).getTime() : null,
        usageCount: 0
      },
      color: entry.color || null,
      icon: entry.icon || null,
      favorite: entry.favorite || false,
      // Preserve extra data fields
      data: entry.data || {}
    })),
    groups: (groups || []).map(group => ({
      id: group.id,
      name: group.name,
      parentId: group.parentId || null,
      icon: group.icon || null,
      color: group.color || null
    })),
    tags: (tags || []).map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color || '#6b7280'
    }))
  };
}

/**
 * Deserialize vault data from plain object
 * Reconstructs VaultEntry instances with Object.freeze
 * @param {Object} data - Parsed vault data
 * @returns {Object}
 */
function deserializeVaultData(data) {
  const entries = (data.entries || []).map(entry => {
    try {
      return new VaultEntry({
        id: entry.id,
        title: entry.title,
        type: entry.type || ENTRY_TYPES.LOGIN,
        username: entry.username || entry.data?.username || '',
        secret: Array.isArray(entry.secret) ? entry.secret : (entry.secret ? [entry.secret] : []),
        notes: entry.notes || entry.data?.notes || '',
        uri: entry.uri || entry.data?.url || '',
        tags: entry.tags || [],
        otpConfig: entry.otpConfig || null,
        groupId: entry.groupId || entry.folderId || null,
        fields: (entry.fields || entry.data?.fields || []).map(f => ({
          id: f.id,
          label: f.label,
          value: f.value,
          kind: f.kind || FIELD_KINDS.TEXT,
          isSecured: f.isSecured || false
        })),
        metadata: entry.metadata || null,
        color: entry.color || null,
        icon: entry.icon || null
      });
    } catch (e) {
      // Fallback for entries that don't match VaultEntry requirements
      console.warn(`[io-service] Could not deserialize entry ${entry.id}: ${e.message}`);
      return {
        ...entry,
        _deserializeError: e.message
      };
    }
  });

  const groups = (data.groups || data.folders || []).map(group => ({
    id: group.id,
    name: group.name,
    parentId: group.parentId || null,
    icon: group.icon || null,
    color: group.color || null
  }));

  const tags = (data.tags || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color || '#6b7280'
  }));

  return {
    metadata: data.metadata || {},
    entries,
    groups,
    tags
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export vault to encrypted buffer
 * @param {Object} vaultData - Vault data { entries, groups, tags, metadata }
 * @param {string} password - Master password for encryption
 * @param {Object} [options] - Export options
 * @param {Object} [options.kdfParams] - Custom KDF parameters
 * @returns {Promise<{data: Object, salt: Uint8Array}>}
 */
export async function exportVaultToBuffer(vaultData, password, options = {}) {
  const kdfParams = { ...DEFAULT_KDF_PARAMS, ...options.kdfParams };

  // Generate salt
  const salt = getRandomBytes(kdfParams.saltLength || 32);

  // Derive encryption key
  const key = await deriveKey(password, salt, kdfParams);

  // Serialize vault data
  const serialized = serializeVaultData(vaultData);
  const plaintext = JSON.stringify(serialized);

  // Encrypt
  const encrypted = await encryptData(plaintext, key);

  // Create file structure
  const now = new Date().toISOString();
  const fileData = {
    format: GPDB_FORMAT,
    version: GPDB_VERSION,
    createdAt: vaultData.metadata?.createdAt || now,
    modifiedAt: now,
    kdf: {
      algorithm: kdfParams.algorithm,
      iterations: kdfParams.iterations,
      hash: kdfParams.hash,
      salt: bytesToBase64(salt)
    },
    encrypted: {
      algorithm: ENCRYPTION_ALGORITHM,
      ...encrypted
    }
  };

  return { data: fileData, salt };
}

/**
 * Export vault to JSON string (ready for file save)
 * @param {Object} vaultData
 * @param {string} password
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function exportVaultToJSON(vaultData, password, options = {}) {
  const { data } = await exportVaultToBuffer(vaultData, password, options);
  return JSON.stringify(data, null, 2);
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Import vault from encrypted file data
 * @param {Object|string} fileData - File content (JSON or parsed object)
 * @param {string} password - Master password for decryption
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function importVaultFromBuffer(fileData, password) {
  try {
    // Parse if string
    const parsed = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    // Validate format
    if (parsed.format !== GPDB_FORMAT) {
      return { success: false, error: 'Invalid file format. Expected GPDB vault file.' };
    }

    if (!parsed.version || parsed.version < 1) {
      return { success: false, error: 'Invalid file version.' };
    }

    // Handle version differences
    if (parsed.version === 1) {
      return importV1Vault(parsed, password);
    }

    // Version 2+
    if (!parsed.kdf || !parsed.encrypted) {
      return { success: false, error: 'Missing encryption data.' };
    }

    // Extract salt
    const salt = base64ToBytes(parsed.kdf.salt);

    // Derive key
    const key = await deriveKey(password, salt, parsed.kdf);

    // Decrypt
    let plaintext;
    try {
      plaintext = await decryptData(parsed.encrypted, key);
    } catch (e) {
      return { success: false, error: 'Invalid password or corrupted data.' };
    }

    // Parse decrypted data
    const decryptedData = JSON.parse(plaintext);

    // Deserialize to VaultEntry instances
    const vaultData = deserializeVaultData(decryptedData);

    return {
      success: true,
      data: vaultData,
      metadata: {
        format: parsed.format,
        version: parsed.version,
        createdAt: parsed.createdAt,
        modifiedAt: parsed.modifiedAt
      }
    };
  } catch (error) {
    console.error('[io-service] Import error:', error);
    return { success: false, error: error.message || 'Failed to import vault.' };
  }
}

/**
 * Import legacy V1 vault format
 * @param {Object} parsed
 * @param {string} password
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
async function importV1Vault(parsed, password) {
  // V1 format used different structure
  // This is a placeholder for backward compatibility
  if (!parsed.header?.keyData || !parsed.encryptedData) {
    return { success: false, error: 'Invalid V1 vault format.' };
  }

  return {
    success: false,
    error: 'V1 vault format requires migration. Use the desktop app to upgrade.'
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Verify password without full decryption
 * @param {Object|string} fileData - File content
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(fileData, password) {
  try {
    const parsed = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    if (parsed.format !== GPDB_FORMAT || !parsed.kdf?.salt || !parsed.encrypted) {
      return false;
    }

    const salt = base64ToBytes(parsed.kdf.salt);
    const key = await deriveKey(password, salt, parsed.kdf);

    // Try to decrypt first 16 bytes (should succeed if password is correct)
    await decryptData(parsed.encrypted, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get vault metadata without decryption
 * @param {Object|string} fileData - File content
 * @returns {{format: string, version: number, createdAt: string, modifiedAt: string}|null}
 */
export function getVaultMetadata(fileData) {
  try {
    const parsed = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    if (parsed.format !== GPDB_FORMAT) {
      return null;
    }

    return {
      format: parsed.format,
      version: parsed.version,
      createdAt: parsed.createdAt,
      modifiedAt: parsed.modifiedAt,
      kdfAlgorithm: parsed.kdf?.algorithm,
      encryptionAlgorithm: parsed.encrypted?.algorithm
    };
  } catch {
    return null;
  }
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

/**
 * Vault I/O Service singleton
 */
export const VaultIOService = {
  exportVaultToBuffer,
  exportVaultToJSON,
  importVaultFromBuffer,
  verifyPassword,
  getVaultMetadata,
  serializeVaultData,
  deserializeVaultData,

  // Constants
  GPDB_FORMAT,
  GPDB_VERSION,
  DEFAULT_KDF_PARAMS
};

export default VaultIOService;
