/**
 * TOTP Service - RFC 6238 Time-Based One-Time Password
 * GenPwd Pro - Secure Password Vault
 *
 * Generates 2FA codes from secrets stored in entry.otpConfig
 * Uses Web Crypto API for browser compatibility
 */

/**
 * Base32 alphabet for decoding OTP secrets
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 encoded string to Uint8Array
 * @param {string} encoded - Base32 encoded string
 * @returns {Uint8Array}
 */
function base32Decode(encoded) {
  // Clean input: uppercase, remove spaces and padding
  const clean = encoded.toUpperCase().replace(/[\s=]/g, '');

  if (clean.length === 0) {
    return new Uint8Array(0);
  }

  // Calculate output length
  const outputLength = Math.floor((clean.length * 5) / 8);
  const result = new Uint8Array(outputLength);

  let buffer = 0;
  let bitsLeft = 0;
  let index = 0;

  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

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
 * @param {number} num - Number to convert
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
 * @param {string} algorithm - Algorithm name (SHA1, SHA256, SHA512)
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
 * @param {Uint8Array} key - Secret key
 * @param {Uint8Array} message - Message to sign
 * @param {string} algorithm - Hash algorithm
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
 * @param {Uint8Array} secret - Decoded secret key
 * @param {number} counter - Counter value
 * @param {number} digits - Number of digits (default 6)
 * @param {string} algorithm - Hash algorithm (default SHA-1)
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
 * @param {Object} options - TOTP options
 * @param {number} [options.period=30] - Time period in seconds
 * @param {number} [options.digits=6] - Number of digits
 * @param {string} [options.algorithm='SHA1'] - Hash algorithm
 * @param {number} [options.timestamp] - Optional timestamp (defaults to now)
 * @returns {Promise<{code: string, remainingSeconds: number, period: number}>}
 */
export async function generateTOTP(secret, options = {}) {
  const {
    period = 30,
    digits = 6,
    algorithm = 'SHA1',
    timestamp = Date.now()
  } = options;

  // Decode secret
  const secretBytes = base32Decode(secret);
  if (secretBytes.length === 0) {
    throw new Error('Invalid or empty TOTP secret');
  }

  // Calculate counter (time step)
  const timeSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(timeSeconds / period);

  // Calculate remaining seconds
  const remainingSeconds = period - (timeSeconds % period);

  // Generate code
  const code = await generateHOTP(secretBytes, counter, digits, getAlgorithmName(algorithm));

  return {
    code,
    remainingSeconds,
    period
  };
}

/**
 * Format TOTP code with space separator (e.g., "123 456")
 * @param {string} code - Raw TOTP code
 * @returns {string}
 */
export function formatTOTPCode(code) {
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  } else if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

/**
 * Parse an OTP URI (otpauth://...)
 * @param {string} uri - OTP URI
 * @returns {Object|null}
 */
export function parseOTPUri(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') return null;

    const type = url.host; // 'totp' or 'hotp'
    const label = decodeURIComponent(url.pathname.slice(1));
    const params = url.searchParams;

    return {
      type,
      label,
      secret: params.get('secret') || '',
      issuer: params.get('issuer') || '',
      algorithm: params.get('algorithm') || 'SHA1',
      digits: parseInt(params.get('digits') || '6', 10),
      period: parseInt(params.get('period') || '30', 10),
      counter: parseInt(params.get('counter') || '0', 10)
    };
  } catch {
    return null;
  }
}

/**
 * Build an OTP URI from config
 * @param {Object} config - OTP configuration
 * @returns {string}
 */
export function buildOTPUri(config) {
  const {
    type = 'totp',
    label = 'Unknown',
    secret,
    issuer,
    algorithm = 'SHA1',
    digits = 6,
    period = 30
  } = config;

  const params = new URLSearchParams();
  params.set('secret', secret);
  if (issuer) params.set('issuer', issuer);
  if (algorithm !== 'SHA1') params.set('algorithm', algorithm);
  if (digits !== 6) params.set('digits', digits.toString());
  if (period !== 30) params.set('period', period.toString());

  return `otpauth://${type}/${encodeURIComponent(label)}?${params.toString()}`;
}

/**
 * TOTP Manager class for handling auto-refresh
 */
export class TOTPManager {
  #listeners = new Map();
  #intervalId = null;
  #cache = new Map();

  /**
   * Start watching a TOTP secret
   * @param {string} id - Unique identifier for this TOTP
   * @param {Object} otpConfig - OTP configuration from entry
   * @param {Function} callback - Called with {code, remainingSeconds, period}
   * @returns {Function} Cleanup function
   */
  watch(id, otpConfig, callback) {
    if (!otpConfig?.secret) {
      console.warn('[TOTP] No secret provided for', id);
      return () => {};
    }

    // Store listener
    this.#listeners.set(id, { otpConfig, callback });

    // Start interval if not running
    if (!this.#intervalId) {
      this.#startInterval();
    }

    // Generate immediately
    this.#updateTOTP(id, otpConfig, callback);

    // Return cleanup function
    return () => this.unwatch(id);
  }

  /**
   * Stop watching a TOTP
   * @param {string} id - TOTP identifier
   */
  unwatch(id) {
    this.#listeners.delete(id);
    this.#cache.delete(id);

    // Stop interval if no more listeners
    if (this.#listeners.size === 0 && this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  /**
   * Stop all watchers
   */
  destroy() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
    this.#listeners.clear();
    this.#cache.clear();
  }

  /**
   * Start the update interval
   */
  #startInterval() {
    // Update every second for smooth countdown
    this.#intervalId = setInterval(() => {
      for (const [id, { otpConfig, callback }] of this.#listeners) {
        this.#updateTOTP(id, otpConfig, callback);
      }
    }, 1000);
  }

  /**
   * Update a single TOTP
   */
  async #updateTOTP(id, otpConfig, callback) {
    try {
      const result = await generateTOTP(otpConfig.secret, {
        period: otpConfig.period || 30,
        digits: otpConfig.digits || 6,
        algorithm: otpConfig.algorithm || 'SHA1'
      });

      // Only call callback if code changed or first time
      const cached = this.#cache.get(id);
      if (!cached || cached.code !== result.code || cached.remainingSeconds !== result.remainingSeconds) {
        this.#cache.set(id, result);
        callback(result);
      }
    } catch (error) {
      console.error('[TOTP] Error generating code:', error);
      callback({ code: '------', remainingSeconds: 0, period: 30, error });
    }
  }

  /**
   * Get current TOTP for an entry (one-shot)
   * @param {Object} otpConfig - OTP configuration
   * @returns {Promise<{code: string, remainingSeconds: number}>}
   */
  async getCode(otpConfig) {
    if (!otpConfig?.secret) {
      throw new Error('No TOTP secret configured');
    }

    return generateTOTP(otpConfig.secret, {
      period: otpConfig.period || 30,
      digits: otpConfig.digits || 6,
      algorithm: otpConfig.algorithm || 'SHA1'
    });
  }
}

// Singleton instance
export const totpManager = new TOTPManager();
