/**
 * @fileoverview XSalsa20-Poly1305 Authenticated Encryption
 * Uses TweetNaCl for cryptographic operations
 *
 * XSalsa20-Poly1305 provides:
 * - 256-bit key
 * - 192-bit nonce (24 bytes) - large enough for random generation
 * - Poly1305 MAC for authentication
 *
 * Note: XSalsa20 is functionally equivalent to XChaCha20 for our purposes
 * Both use extended 24-byte nonces and are considered highly secure
 */

import nacl from 'tweetnacl';
import tweetnaclUtil from 'tweetnacl-util';
import { t } from '../../utils/i18n-node.js';
const { encodeBase64, decodeBase64 } = tweetnaclUtil;

/**
 * @typedef {Object} EncryptedData
 * @property {Uint8Array} nonce - Random nonce (24 bytes)
 * @property {Uint8Array} ciphertext - Encrypted data with MAC
 */

/**
 * @typedef {Object} EncryptedPayload
 * @property {string} nonce - Base64 encoded nonce
 * @property {string} ciphertext - Base64 encoded ciphertext
 * @property {string} algorithm - Encryption algorithm identifier
 */

const ALGORITHM = 'xsalsa20-poly1305';
const NONCE_LENGTH = nacl.secretbox.nonceLength; // 24 bytes
const KEY_LENGTH = nacl.secretbox.keyLength; // 32 bytes

/**
 * Generate random nonce for encryption
 * @returns {Uint8Array} Random 24-byte nonce
 */
export function generateNonce() {
  return nacl.randomBytes(NONCE_LENGTH);
}

/**
 * Encrypt data with XSalsa20-Poly1305
 * @param {Uint8Array} plaintext - Data to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {EncryptedData} Nonce and ciphertext
 * @throws {Error} If key length is invalid
 */
export function encrypt(plaintext, key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }

  const nonce = generateNonce();
  const ciphertext = nacl.secretbox(plaintext, nonce, key);

  return { nonce, ciphertext };
}

/**
 * Decrypt data with XSalsa20-Poly1305
 * @param {Uint8Array} ciphertext - Encrypted data
 * @param {Uint8Array} nonce - Nonce used for encryption
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Uint8Array|null} Decrypted data or null if authentication fails
 * @throws {Error} If key length is invalid
 */
export function decrypt(ciphertext, nonce, key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }

  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${NONCE_LENGTH}, got ${nonce.length}`);
  }

  const plaintext = nacl.secretbox.open(ciphertext, nonce, key);

  if (!plaintext) {
    throw new Error(t('errors.crypto.decryptionFailed'));
  }

  return plaintext;
}

/**
 * Encrypt string data to JSON-serializable payload
 * @param {string} plaintext - String to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {EncryptedPayload} JSON-serializable encrypted payload
 */
export function encryptString(plaintext, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const { nonce, ciphertext } = encrypt(data, key);

  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
    algorithm: ALGORITHM
  };
}

/**
 * Decrypt JSON payload back to string
 * @param {EncryptedPayload} payload - Encrypted payload
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {string} Decrypted string
 * @throws {Error} If decryption fails
 */
export function decryptString(payload, key) {
  if (payload.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
  }

  const nonce = decodeBase64(payload.nonce);
  const ciphertext = decodeBase64(payload.ciphertext);
  const plaintext = decrypt(ciphertext, nonce, key);

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Encrypt object to JSON-serializable payload
 * @param {Object} obj - Object to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {EncryptedPayload} Encrypted payload
 */
export function encryptObject(obj, key) {
  let json;
  try {
    json = JSON.stringify(obj);
  } catch (stringifyError) {
    throw new Error(`Object serialization failed: ${stringifyError.message}`);
  }
  return encryptString(json, key);
}

/**
 * Decrypt payload back to object
 * @param {EncryptedPayload} payload - Encrypted payload
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Object} Decrypted object
 * @throws {Error} If decryption or parsing fails
 */
export function decryptObject(payload, key) {
  const json = decryptString(payload, key);
  try {
    return JSON.parse(json);
  } catch (parseError) {
    throw new Error(`Decryption succeeded but JSON parsing failed: ${parseError.message}`);
  }
}

/**
 * Securely wipe key from memory
 * Note: This is best-effort in JavaScript due to GC
 * @param {Uint8Array} key - Key to wipe
 */
export function wipeKey(key) {
  if (key && key.fill) {
    key.fill(0);
  }
}

export { ALGORITHM, NONCE_LENGTH, KEY_LENGTH };
