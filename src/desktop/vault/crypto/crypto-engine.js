/**
 * @fileoverview High-level Cryptographic Engine for Vault
 * Combines Argon2id KDF with XSalsa20-Poly1305 encryption
 *
 * ARCHITECTURE NOTE:
 * This module uses XSalsa20-Poly1305 (via TweetNaCl) for local vault storage.
 * The import/export module (src/js/core/crypto/vault-crypto.js) uses AES-256-GCM
 * for cross-platform compatibility with Android.
 *
 * These are intentionally different:
 *   - crypto-engine.js (XSalsa20): For local vault storage in Electron
 *   - vault-crypto.js (AES-GCM): For import/export and cross-platform sync
 *
 * Data encrypted with one engine CANNOT be decrypted by the other.
 *
 * Usage:
 *   const engine = new CryptoEngine();
 *   const { salt, verifier } = await engine.createVaultKey(password);
 *   const key = await engine.deriveVaultKey(password, salt);
 *   const encrypted = engine.encrypt(data, key);
 *   const decrypted = engine.decrypt(encrypted, key);
 */

import { randomFillSync } from 'node:crypto';
import { deriveKey, generateSalt, DEFAULT_PARAMS } from './argon2-kdf.js';
import {
  encryptObject,
  decryptObject,
  encryptString,
  decryptString,
  wipeKey,
  ALGORITHM
} from './xchacha20.js';
import { t } from '../../utils/i18n-node.js';

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
   * @throws {Error} If keyData is invalid
   */
  async deriveVaultKey(password, keyData) {
    // Validate inputs
    if (!password || typeof password !== 'string') {
      throw new Error(t('errors.crypto.invalidPassword'));
    }
    if (!keyData || typeof keyData !== 'object') {
      throw new Error(t('errors.crypto.invalidKeyData'));
    }
    if (!keyData.salt || typeof keyData.salt !== 'string') {
      throw new Error(t('errors.crypto.invalidSalt'));
    }

    const salt = this.#base64ToArray(keyData.salt);
    if (salt.length < 16) {
      throw new Error(t('errors.crypto.saltTooShort'));
    }

    const key = await deriveKey(password, salt, keyData.kdfParams);
    return key;
  }

  /**
   * Verify password against stored key data
   * @param {string} password - Password to verify
   * @param {VaultKeyData} keyData - Stored key derivation data
   * @returns {Promise<{valid: boolean, key: Uint8Array|null}>}
   * @throws {Error} If keyData is invalid
   */
  async verifyPassword(password, keyData) {
    // Validate keyData.verifier before use
    if (!keyData?.verifier || typeof keyData.verifier !== 'string') {
      throw new Error(t('errors.crypto.invalidVerifier'));
    }

    const key = await this.deriveVaultKey(password, keyData);
    const storedVerifier = this.#base64ToArray(keyData.verifier);

    // Support both legacy (32-byte SHA-256) and current (64-byte Argon2id) verifiers
    if (storedVerifier.length === 64) {
      // Current format: first 32 bytes = verifier salt, last 32 bytes = Argon2id hash
      const verifierSalt = storedVerifier.subarray(0, 32);
      const expectedHash = storedVerifier.subarray(32, 64);
      const actualHash = await this.#recomputeVerifierHash(key, verifierSalt);

      const valid = this.#constantTimeCompare(expectedHash, actualHash);
      if (!valid) {
        wipeKey(key);
        return { valid: false, key: null };
      }
      return { valid: true, key };
    }

    if (storedVerifier.length !== 32) {
      wipeKey(key);
      throw new Error(t('errors.crypto.verifierInvalidSize'));
    }

    // Legacy fallback: 32-byte verifier created with SHA-256 (pre-migration vaults)
    const { createHash } = await import('node:crypto');
    const legacyHash = createHash('sha256').update(key).digest();
    const legacyVerifier = new Uint8Array(legacyHash);

    const valid = this.#constantTimeCompare(storedVerifier, legacyVerifier);

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
    randomFillSync(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Argon2id parameters for verifier derivation.
   * Lower memory than main KDF to keep verification responsive,
   * but still computationally expensive to resist offline brute-force.
   * @type {import('./argon2-kdf.js').KdfParams}
   */
  static #VERIFIER_KDF_PARAMS = Object.freeze({
    memory: 16384,    // 16 MB
    iterations: 3,
    parallelism: 2,
    hashLength: 32    // 256 bits
  });

  /**
   * Create verifier from key using Argon2id with a dedicated salt.
   * Produces a 64-byte result: 32 bytes verifier salt + 32 bytes Argon2id hash.
   * @private
   * @param {Uint8Array} key - Encryption key
   * @returns {Promise<Uint8Array>} Verifier (salt || hash, 64 bytes total)
   */
  async #createVerifier(key) {
    const verifierSalt = generateSalt(32);
    const keyHex = Array.from(key)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const hash = await deriveKey(keyHex, verifierSalt, CryptoEngine.#VERIFIER_KDF_PARAMS);

    // Concatenate: verifierSalt (32) + hash (32) = 64 bytes
    const combined = new Uint8Array(64);
    combined.set(verifierSalt, 0);
    combined.set(hash, 32);
    return combined;
  }

  /**
   * Recompute verifier hash from key using the stored verifier salt.
   * @private
   * @param {Uint8Array} key - Encryption key
   * @param {Uint8Array} verifierSalt - The 32-byte salt extracted from stored verifier
   * @returns {Promise<Uint8Array>} 32-byte Argon2id hash
   */
  async #recomputeVerifierHash(key, verifierSalt) {
    const keyHex = Array.from(key)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return deriveKey(keyHex, verifierSalt, CryptoEngine.#VERIFIER_KDF_PARAMS);
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
    // Use Buffer for Node.js compatibility (btoa is browser-only)
    return Buffer.from(array).toString('base64');
  }

  /**
   * Convert Base64 to Uint8Array
   * @private
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} Converted array
   */
  #base64ToArray(base64) {
    // Use Buffer for Node.js compatibility (atob is browser-only)
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

// Export singleton instance
export const cryptoEngine = new CryptoEngine();
export default cryptoEngine;
