/**
 * @fileoverview TOTP (Time-based One-Time Password) Generator
 * RFC 6238 compliant implementation
 *
 * @version 2.6.7
 */

import { safeLog } from './logger.js';

/**
 * Convert Base32 string to Uint8Array
 * @param {string} base32 - Base32 encoded string
 * @returns {Uint8Array}
 */
function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedInput = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');

  let bits = '';
  for (const char of cleanedInput) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

/**
 * Convert number to 8-byte big-endian buffer
 * @param {number} num - Counter value
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
 * Calculate HMAC-SHA1
 * @param {Uint8Array} key - Secret key
 * @param {Uint8Array} message - Message to sign
 * @returns {Promise<Uint8Array>}
 */
async function hmacSha1(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

/**
 * Generate TOTP code
 * @param {string} secret - Base32 encoded secret
 * @param {Object} options - TOTP options
 * @param {number} [options.period=30] - Time step in seconds
 * @param {number} [options.digits=6] - Number of digits in OTP
 * @param {number} [options.timestamp] - Unix timestamp (ms), defaults to now
 * @returns {Promise<{code: string, remaining: number, period: number}>}
 */
export async function generateTOTP(secret, options = {}) {
  const {
    period = 30,
    digits = 6,
    timestamp = Date.now()
  } = options;

  try {
    // Decode secret
    const key = base32ToBytes(secret);
    if (key.length === 0) {
      throw new Error('Invalid secret key');
    }

    // Calculate counter (time steps since epoch)
    const timeStep = Math.floor(timestamp / 1000 / period);
    const counter = intToBytes(timeStep);

    // Generate HMAC-SHA1
    const hmac = await hmacSha1(key, counter);

    // Dynamic truncation (RFC 4226)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    // Generate OTP
    const otp = binary % Math.pow(10, digits);
    const code = otp.toString().padStart(digits, '0');

    // Calculate remaining time
    const elapsed = (timestamp / 1000) % period;
    const remaining = Math.ceil(period - elapsed);

    return { code, remaining, period };
  } catch (error) {
    safeLog(`[TOTP] Error generating code: ${error.message}`);
    throw error;
  }
}

/**
 * Parse otpauth:// URI
 * @param {string} uri - otpauth:// URI
 * @returns {{secret: string, issuer: string, account: string, period: number, digits: number, algorithm: string}}
 */
export function parseOTPAuthURI(uri) {
  if (!uri.startsWith('otpauth://totp/')) {
    throw new Error('Invalid OTPAuth URI: must start with otpauth://totp/');
  }

  const url = new URL(uri);
  const params = url.searchParams;

  // Extract label (issuer:account or just account)
  let label = decodeURIComponent(url.pathname.replace('/totp/', ''));
  let issuer = '';
  let account = label;

  if (label.includes(':')) {
    [issuer, account] = label.split(':');
  }

  // Override issuer if provided as parameter
  if (params.has('issuer')) {
    issuer = params.get('issuer');
  }

  const secret = params.get('secret');
  if (!secret) {
    throw new Error('Invalid OTPAuth URI: missing secret');
  }

  return {
    secret: secret.toUpperCase().replace(/\s/g, ''),
    issuer,
    account,
    period: parseInt(params.get('period')) || 30,
    digits: parseInt(params.get('digits')) || 6,
    algorithm: (params.get('algorithm') || 'SHA1').toUpperCase()
  };
}

/**
 * Build otpauth:// URI
 * @param {Object} params - OTP parameters
 * @param {string} params.secret - Base32 encoded secret
 * @param {string} [params.issuer] - Service name
 * @param {string} [params.account] - User account
 * @param {number} [params.period=30] - Time step
 * @param {number} [params.digits=6] - Code length
 * @returns {string}
 */
export function buildOTPAuthURI(params) {
  const { secret, issuer = '', account = 'user', period = 30, digits = 6 } = params;

  const label = issuer ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` : encodeURIComponent(account);

  const url = new URL(`otpauth://totp/${label}`);
  url.searchParams.set('secret', secret.toUpperCase().replace(/\s/g, ''));

  if (issuer) {
    url.searchParams.set('issuer', issuer);
  }

  if (period !== 30) {
    url.searchParams.set('period', period.toString());
  }

  if (digits !== 6) {
    url.searchParams.set('digits', digits.toString());
  }

  return url.toString();
}

/**
 * Validate Base32 secret
 * @param {string} secret - Base32 string to validate
 * @returns {boolean}
 */
export function isValidBase32(secret) {
  if (!secret || typeof secret !== 'string') return false;
  const cleaned = secret.toUpperCase().replace(/\s/g, '');
  return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.length >= 16;
}

/**
 * Generate a random Base32 secret
 * @param {number} [length=20] - Number of bytes for secret
 * @returns {string} Base32 encoded secret
 */
export function generateSecret(length = 20) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  let result = '';
  for (const byte of bytes) {
    result += alphabet[byte % 32];
  }

  return result;
}

/**
 * TOTP Manager for vault entries
 */
export class TOTPManager {
  constructor() {
    this.timers = new Map();
    this.callbacks = new Map();
  }

  /**
   * Subscribe to TOTP updates for an entry
   * @param {string} entryId - Vault entry ID
   * @param {string} secret - Base32 secret
   * @param {Function} callback - Called with {code, remaining, period}
   * @param {Object} [options] - TOTP options
   */
  subscribe(entryId, secret, callback, options = {}) {
    // Clear existing timer
    this.unsubscribe(entryId);

    const update = async () => {
      try {
        const result = await generateTOTP(secret, options);
        callback(result);
      } catch (error) {
        callback({ code: '------', remaining: 0, period: 30, error: error.message });
      }
    };

    // Initial update
    update();

    // Update every second
    const timer = setInterval(update, 1000);
    this.timers.set(entryId, timer);
    this.callbacks.set(entryId, callback);
  }

  /**
   * Unsubscribe from TOTP updates
   * @param {string} entryId - Vault entry ID
   */
  unsubscribe(entryId) {
    const timer = this.timers.get(entryId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(entryId);
      this.callbacks.delete(entryId);
    }
  }

  /**
   * Unsubscribe all
   */
  clear() {
    for (const [entryId] of this.timers) {
      this.unsubscribe(entryId);
    }
  }
}

// Singleton instance
export const totpManager = new TOTPManager();

export default {
  generateTOTP,
  parseOTPAuthURI,
  buildOTPAuthURI,
  isValidBase32,
  generateSecret,
  TOTPManager,
  totpManager
};
