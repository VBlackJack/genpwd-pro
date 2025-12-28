/**
 * @fileoverview Secure Storage Utilities
 * Provides encrypted localStorage with AES-GCM encryption
 * Uses Web Crypto API for secure key derivation and encryption
 */

import { safeLog } from './logger.js';

const STORAGE_PREFIX = 'genpwd_secure_';
const SALT_KEY = 'genpwd_storage_salt';
const IV_BYTES = 12;
const SALT_BYTES = 16;
const KEY_ITERATIONS = 100000;

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes
 * @returns {Uint8Array}
 */
function getRandomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an encryption key from a password/master key
 * @param {string|Uint8Array} password - Password or master key
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = typeof password === 'string'
    ? encoder.encode(password)
    : password;

  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create storage salt
 * @returns {Uint8Array}
 */
function getOrCreateSalt() {
  try {
    const storedSalt = localStorage.getItem(SALT_KEY);
    if (storedSalt) {
      return base64ToBuffer(storedSalt);
    }
    const newSalt = getRandomBytes(SALT_BYTES);
    localStorage.setItem(SALT_KEY, bufferToBase64(newSalt));
    return newSalt;
  } catch (e) {
    safeLog(`[SecureStorage] Salt error: ${e.message}`);
    return getRandomBytes(SALT_BYTES);
  }
}

/**
 * Encrypt data with AES-GCM
 * @param {string} data - Data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<string>} Base64 encoded ciphertext with IV
 */
async function encrypt(data, key) {
  const encoder = new TextEncoder();
  const iv = getRandomBytes(IV_BYTES);
  const plaintext = encoder.encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // Combine IV + ciphertext
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);

  return bufferToBase64(result);
}

/**
 * Decrypt data with AES-GCM
 * @param {string} encryptedData - Base64 encoded ciphertext with IV
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<string|null>} Decrypted string or null on failure
 */
async function decrypt(encryptedData, key) {
  try {
    const data = base64ToBuffer(encryptedData);
    const iv = data.slice(0, IV_BYTES);
    const ciphertext = data.slice(IV_BYTES);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (e) {
    safeLog(`[SecureStorage] Decrypt error: ${e.message}`);
    return null;
  }
}

/**
 * SecureStorage class for encrypted localStorage
 */
export class SecureStorage {
  #key = null;
  #initialized = false;

  /**
   * Initialize secure storage with a password/master key
   * @param {string|Uint8Array} password - Password or master key for encryption
   * @returns {Promise<boolean>} Success status
   */
  async initialize(password) {
    try {
      const salt = getOrCreateSalt();
      this.#key = await deriveKey(password, salt);
      this.#initialized = true;
      safeLog('[SecureStorage] Initialized');
      return true;
    } catch (e) {
      safeLog(`[SecureStorage] Init error: ${e.message}`);
      return false;
    }
  }

  /**
   * Check if storage is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * Securely store an item
   * @param {string} key - Storage key
   * @param {*} value - Value to store (will be JSON stringified)
   * @returns {Promise<boolean>} Success status
   */
  async setItem(key, value) {
    if (!this.#initialized || !this.#key) {
      safeLog('[SecureStorage] Not initialized');
      return false;
    }

    try {
      const json = JSON.stringify(value);
      const encrypted = await encrypt(json, this.#key);
      localStorage.setItem(STORAGE_PREFIX + key, encrypted);
      return true;
    } catch (e) {
      safeLog(`[SecureStorage] setItem error: ${e.message}`);
      return false;
    }
  }

  /**
   * Retrieve a securely stored item
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found or decryption fails
   * @returns {Promise<*>} Stored value or default
   */
  async getItem(key, defaultValue = null) {
    if (!this.#initialized || !this.#key) {
      safeLog('[SecureStorage] Not initialized');
      return defaultValue;
    }

    try {
      const encrypted = localStorage.getItem(STORAGE_PREFIX + key);
      if (!encrypted) return defaultValue;

      const decrypted = await decrypt(encrypted, this.#key);
      if (decrypted === null) return defaultValue;

      return JSON.parse(decrypted);
    } catch (e) {
      safeLog(`[SecureStorage] getItem error: ${e.message}`);
      return defaultValue;
    }
  }

  /**
   * Remove a securely stored item
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  removeItem(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return true;
    } catch (e) {
      safeLog(`[SecureStorage] removeItem error: ${e.message}`);
      return false;
    }
  }

  /**
   * Clear all securely stored items
   * @returns {boolean} Success status
   */
  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      safeLog(`[SecureStorage] Cleared ${keysToRemove.length} items`);
      return true;
    } catch (e) {
      safeLog(`[SecureStorage] clear error: ${e.message}`);
      return false;
    }
  }

  /**
   * List all secure storage keys
   * @returns {string[]} Array of key names (without prefix)
   */
  keys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key.slice(STORAGE_PREFIX.length));
      }
    }
    return keys;
  }

  /**
   * Destroy the storage instance and wipe the key
   */
  destroy() {
    this.#key = null;
    this.#initialized = false;
    safeLog('[SecureStorage] Destroyed');
  }
}

// Singleton instance
let secureStorageInstance = null;

/**
 * Get or create the secure storage singleton
 * @returns {SecureStorage}
 */
export function getSecureStorage() {
  if (!secureStorageInstance) {
    secureStorageInstance = new SecureStorage();
  }
  return secureStorageInstance;
}

export default SecureStorage;
