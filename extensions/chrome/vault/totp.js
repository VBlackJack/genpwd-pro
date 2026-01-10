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
 * @fileoverview TOTP Service - RFC 6238 Time-Based One-Time Password
 * For Chrome extension autofill
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 encoded string to Uint8Array
 * @param {string} encoded
 * @returns {Uint8Array}
 */
function base32Decode(encoded) {
  const clean = encoded.toUpperCase().replace(/[\s=]/g, '');
  if (clean.length === 0) return new Uint8Array(0);

  const outputLength = Math.floor((clean.length * 5) / 8);
  const result = new Uint8Array(outputLength);

  let buffer = 0;
  let bitsLeft = 0;
  let index = 0;

  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Invalid Base32 character: ${char}`);

    buffer = (buffer << 5) | value;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      result[index++] = (buffer >> bitsLeft) & 0xff;
    }
  }

  return result;
}

/**
 * Convert a number to a big-endian 8-byte Uint8Array
 * @param {number} num
 * @returns {Uint8Array}
 */
function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256);
  }
  return bytes;
}

/**
 * Get the HMAC algorithm name for Web Crypto API
 * @param {string} algorithm
 * @returns {string}
 */
function getAlgorithmName(algorithm) {
  const algMap = {
    'SHA1': 'SHA-1',
    'SHA-1': 'SHA-1',
    'SHA256': 'SHA-256',
    'SHA-256': 'SHA-256',
    'SHA512': 'SHA-512',
    'SHA-512': 'SHA-512'
  };
  return algMap[algorithm?.toUpperCase()] || 'SHA-1';
}

/**
 * Compute HMAC using Web Crypto API
 * @param {Uint8Array} key
 * @param {Uint8Array} message
 * @param {string} algorithm
 * @returns {Promise<Uint8Array>}
 */
async function hmac(key, message, algorithm = 'SHA-1') {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

/**
 * Generate HOTP value (RFC 4226)
 * @param {Uint8Array} secret
 * @param {number} counter
 * @param {number} digits
 * @param {string} algorithm
 * @returns {Promise<string>}
 */
async function generateHOTP(secret, counter, digits = 6, algorithm = 'SHA-1') {
  const counterBytes = intToBytes(counter);
  const hash = await hmac(secret, counterBytes, algorithm);

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Generate TOTP value (RFC 6238)
 * @param {string} secret - Base32 encoded secret
 * @param {Object} options
 * @returns {Promise<{code: string, remainingSeconds: number, period: number}>}
 */
export async function generateTOTP(secret, options = {}) {
  const {
    period = 30,
    digits = 6,
    algorithm = 'SHA1',
    timestamp = Date.now()
  } = options;

  const secretBytes = base32Decode(secret);
  if (secretBytes.length === 0) {
    throw new Error('Invalid or empty TOTP secret');
  }

  const timeSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(timeSeconds / period);
  const remainingSeconds = period - (timeSeconds % period);

  const code = await generateHOTP(secretBytes, counter, digits, getAlgorithmName(algorithm));

  return { code, remainingSeconds, period };
}

/**
 * Format TOTP code with space separator
 * @param {string} code
 * @returns {string}
 */
export function formatTOTPCode(code) {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}

/**
 * TOTP Manager for handling auto-refresh
 */
export class TOTPManager {
  #listeners = new Map();
  #intervalId = null;
  #cache = new Map();

  /**
   * Start watching a TOTP secret
   * @param {string} id
   * @param {Object} otpConfig
   * @param {Function} callback
   * @returns {Function} Cleanup function
   */
  watch(id, otpConfig, callback) {
    if (!otpConfig?.secret) return () => {};

    this.#listeners.set(id, { otpConfig, callback });

    if (!this.#intervalId) {
      this.#intervalId = setInterval(() => this.#updateAll(), 1000);
    }

    this.#updateTOTP(id, otpConfig, callback);
    return () => this.unwatch(id);
  }

  unwatch(id) {
    this.#listeners.delete(id);
    this.#cache.delete(id);
    if (this.#listeners.size === 0 && this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  destroy() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
    this.#listeners.clear();
    this.#cache.clear();
  }

  #updateAll() {
    for (const [id, { otpConfig, callback }] of this.#listeners) {
      this.#updateTOTP(id, otpConfig, callback);
    }
  }

  async #updateTOTP(id, otpConfig, callback) {
    try {
      const result = await generateTOTP(otpConfig.secret, {
        period: otpConfig.period || 30,
        digits: otpConfig.digits || 6,
        algorithm: otpConfig.algorithm || 'SHA1'
      });

      const cached = this.#cache.get(id);
      if (!cached || cached.code !== result.code || cached.remainingSeconds !== result.remainingSeconds) {
        this.#cache.set(id, result);
        callback(result);
      }
    } catch (error) {
      callback({ code: '------', remainingSeconds: 0, period: 30, error });
    }
  }

  async getCode(otpConfig) {
    if (!otpConfig?.secret) throw new Error('No TOTP secret configured');
    return generateTOTP(otpConfig.secret, {
      period: otpConfig.period || 30,
      digits: otpConfig.digits || 6,
      algorithm: otpConfig.algorithm || 'SHA1'
    });
  }
}

export const totpManager = new TOTPManager();
