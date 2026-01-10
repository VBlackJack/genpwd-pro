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

/**
 * @fileoverview Crypto module for Chrome extension
 * PBKDF2 key derivation and AES-256-GCM encryption/decryption
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const TAG_LENGTH = 128; // bits

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate Base64 string format
 * @param {string} str - String to validate
 * @returns {boolean}
 */
function isValidBase64(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(str)) return false;
  const len = str.replace(/=/g, '').length;
  return len % 4 !== 1;
}

/**
 * Convert Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  if (typeof base64 !== 'string') {
    throw new TypeError('Expected string for Base64 input');
  }
  const trimmed = base64.trim();
  if (!isValidBase64(trimmed)) {
    throw new Error('Invalid Base64 format');
  }
  try {
    const binString = atob(trimmed);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
  } catch (e) {
    throw new Error(`Base64 decode failed: ${e.message}`);
  }
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

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - User password
 * @param {Uint8Array} salt - Salt bytes
 * @param {Object} kdfParams - KDF parameters
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt, kdfParams) {
  const passwordBytes = textToBytes(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: kdfParams.iterations || 600000,
      hash: kdfParams.hash || 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

// ============================================================================
// DECRYPTION
// ============================================================================

/**
 * Decrypt data using AES-256-GCM
 * @param {{nonce: string, ciphertext: string, tag: string}} encrypted
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>}
 */
export async function decryptData(encrypted, key) {
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
