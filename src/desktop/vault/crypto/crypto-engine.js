/**
 * @fileoverview High-level Cryptographic Engine for Vault
 * Combines Argon2id KDF with XSalsa20-Poly1305 encryption
 *
 * Usage:
 *   const engine = new CryptoEngine();
 *   const { salt, verifier } = await engine.createVaultKey(password);
 *   const key = await engine.deriveVaultKey(password, salt);
 *   const encrypted = engine.encrypt(data, key);
 *   const decrypted = engine.decrypt(encrypted, key);
 */

import { deriveKey, generateSalt, DEFAULT_PARAMS } from './argon2-kdf.js';
import {
  encryptObject,
  decryptObject,
  encryptString,
  decryptString,
  wipeKey,
  ALGORITHM
} from './xchacha20.js';

/**
 * @typedef {Object} VaultKeyData
 * @property {string} salt - Base64 encoded salt
 * @property {string} verifier - Base64 encoded key verifier (for password check)
 * @property {Object} kdfParams - KDF parameters used
 * @property {string} algorithm - Encryption algorithm
 */

/**
 * High-level cryptographic engine for vault operations
 */
export class CryptoEngine {
  /**
   * Create new vault encryption key from password
   * @param {string} password - Master password
   * @returns {Promise<{key: Uint8Array, keyData: VaultKeyData}>}
   */
  async createVaultKey(password) {
    const salt = generateSalt(32);
    const key = await deriveKey(password, salt);

    // Create a verifier (hash of the key) to validate password without storing key
    const verifier = await this.#createVerifier(key);

    const keyData = {
      salt: this.#arrayToBase64(salt),
      verifier: this.#arrayToBase64(verifier),
      kdfParams: DEFAULT_PARAMS,
      algorithm: ALGORITHM
    };

    return { key, keyData };
  }

  /**
   * Derive vault key from password using stored parameters
   * @param {string} password - Master password
   * @param {VaultKeyData} keyData - Stored key derivation data
   * @returns {Promise<Uint8Array>} Derived encryption key
   */
  async deriveVaultKey(password, keyData) {
    const salt = this.#base64ToArray(keyData.salt);
    const key = await deriveKey(password, salt, keyData.kdfParams);
    return key;
  }

  /**
   * Verify password against stored key data
   * @param {string} password - Password to verify
   * @param {VaultKeyData} keyData - Stored key derivation data
   * @returns {Promise<{valid: boolean, key: Uint8Array|null}>}
   */
  async verifyPassword(password, keyData) {
    const key = await this.deriveVaultKey(password, keyData);
    const expectedVerifier = this.#base64ToArray(keyData.verifier);
    const actualVerifier = await this.#createVerifier(key);

    // Constant-time comparison
    const valid = this.#constantTimeCompare(expectedVerifier, actualVerifier);

    if (!valid) {
      wipeKey(key);
      return { valid: false, key: null };
    }

    return { valid: true, key };
  }

  /**
   * Encrypt vault data
   * @param {Object} data - Data to encrypt
   * @param {Uint8Array} key - Encryption key
   * @returns {Object} Encrypted payload
   */
  encrypt(data, key) {
    return encryptObject(data, key);
  }

  /**
   * Decrypt vault data
   * @param {Object} payload - Encrypted payload
   * @param {Uint8Array} key - Encryption key
   * @returns {Object} Decrypted data
   * @throws {Error} If decryption fails
   */
  decrypt(payload, key) {
    return decryptObject(payload, key);
  }

  /**
   * Encrypt a single string value
   * @param {string} value - String to encrypt
   * @param {Uint8Array} key - Encryption key
   * @returns {Object} Encrypted payload
   */
  encryptValue(value, key) {
    return encryptString(value, key);
  }

  /**
   * Decrypt a single string value
   * @param {Object} payload - Encrypted payload
   * @param {Uint8Array} key - Encryption key
   * @returns {string} Decrypted string
   */
  decryptValue(payload, key) {
    return decryptString(payload, key);
  }

  /**
   * Securely wipe key from memory
   * @param {Uint8Array} key - Key to wipe
   */
  wipeKey(key) {
    wipeKey(key);
  }

  /**
   * Generate random ID for entries
   * @param {number} length - ID length in bytes
   * @returns {string} Random hex ID
   */
  generateId(length = 16) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create verifier hash from key (used to validate password)
   * @private
   * @param {Uint8Array} key - Encryption key
   * @returns {Promise<Uint8Array>} Verifier hash
   */
  async #createVerifier(key) {
    // Use SHA-256 hash of the key as verifier
    const hashBuffer = await crypto.subtle.digest('SHA-256', key);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Constant-time array comparison
   * @private
   * @param {Uint8Array} a - First array
   * @param {Uint8Array} b - Second array
   * @returns {boolean} True if equal
   */
  #constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  /**
   * Convert Uint8Array to Base64
   * @private
   * @param {Uint8Array} array - Array to convert
   * @returns {string} Base64 string
   */
  #arrayToBase64(array) {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Convert Base64 to Uint8Array
   * @private
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} Converted array
   */
  #base64ToArray(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Export singleton instance
export const cryptoEngine = new CryptoEngine();
export default cryptoEngine;
