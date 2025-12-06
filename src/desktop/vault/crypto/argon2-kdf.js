/**
 * @fileoverview Argon2id Key Derivation Function
 * Uses hash-wasm for pure WASM implementation (no native rebuild needed)
 *
 * Security Parameters (OWASP recommendations for password hashing):
 * - Memory: 64 MB (65536 KB)
 * - Iterations: 3
 * - Parallelism: 4
 * - Output: 32 bytes (256 bits for XChaCha20)
 */

import { argon2id } from 'hash-wasm';

/**
 * @typedef {Object} KdfParams
 * @property {number} memory - Memory cost in KB (default: 65536 = 64MB)
 * @property {number} iterations - Time cost (default: 3)
 * @property {number} parallelism - Parallelism factor (default: 4)
 * @property {number} hashLength - Output key length in bytes (default: 32)
 */

/** @type {KdfParams} */
const DEFAULT_PARAMS = {
  memory: 65536,      // 64 MB
  iterations: 3,
  parallelism: 4,
  hashLength: 32      // 256 bits
};

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes to generate
 * @returns {Uint8Array} Random bytes
 */
export function generateSalt(length = 32) {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derive encryption key from password using Argon2id
 * @param {string} password - User's master password
 * @param {Uint8Array} salt - Random salt (32 bytes recommended)
 * @param {Partial<KdfParams>} [params] - Optional custom parameters
 * @returns {Promise<Uint8Array>} Derived key (32 bytes)
 */
export async function deriveKey(password, salt, params = {}) {
  const config = { ...DEFAULT_PARAMS, ...params };

  const key = await argon2id({
    password,
    salt,
    parallelism: config.parallelism,
    iterations: config.iterations,
    memorySize: config.memory,
    hashLength: config.hashLength,
    outputType: 'binary'
  });

  return new Uint8Array(key);
}

/**
 * Verify password against stored hash
 * @param {string} password - Password to verify
 * @param {Uint8Array} salt - Salt used for original derivation
 * @param {Uint8Array} expectedKey - Expected derived key
 * @param {Partial<KdfParams>} [params] - Parameters used for original derivation
 * @returns {Promise<boolean>} True if password is correct
 */
export async function verifyPassword(password, salt, expectedKey, params = {}) {
  const derivedKey = await deriveKey(password, salt, params);

  // Constant-time comparison to prevent timing attacks
  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < derivedKey.length; i++) {
    result |= derivedKey[i] ^ expectedKey[i];
  }

  return result === 0;
}

/**
 * Benchmark Argon2id to calibrate parameters for target time
 * @param {number} targetMs - Target derivation time in milliseconds
 * @returns {Promise<KdfParams>} Calibrated parameters
 */
export async function calibrateParams(targetMs = 500) {
  const testPassword = 'benchmark_password_12345';
  const testSalt = generateSalt(32);

  let iterations = 1;
  let elapsed = 0;

  // Find optimal iterations for target time
  while (elapsed < targetMs && iterations < 20) {
    const start = performance.now();
    await deriveKey(testPassword, testSalt, {
      ...DEFAULT_PARAMS,
      iterations
    });
    elapsed = performance.now() - start;

    if (elapsed < targetMs) {
      iterations++;
    }
  }

  return {
    ...DEFAULT_PARAMS,
    iterations: Math.max(3, iterations) // Minimum 3 iterations
  };
}

export { DEFAULT_PARAMS };
