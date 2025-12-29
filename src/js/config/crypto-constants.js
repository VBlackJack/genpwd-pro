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
 * Centralized cryptographic constants for the application
 * All crypto-related configuration should be defined here for:
 * - Easy auditing and security review
 * - Consistent crypto parameters across the app
 * - Single source of truth for crypto configuration
 */

/**
 * Keyset envelope configuration for Tink AEAD
 * Used in vault/crypto-engine.js for key wrapping
 */
export const KEYSET_ENVELOPE = Object.freeze({
  // Version of the keyset envelope format
  VERSION: 1,

  // Size of the initialization vector in bytes (96 bits for AES-GCM)
  IV_BYTES: 12
});

/**
 * AES-GCM configuration
 * Standard parameters for AES-GCM AEAD mode
 */
export const AES_GCM = Object.freeze({
  // AES key size in bits (256-bit keys)
  KEY_SIZE: 256,

  // GCM authentication tag size in bits (128-bit tags)
  TAG_SIZE: 128,

  // IV/Nonce size in bytes (96 bits = 12 bytes recommended for GCM)
  IV_SIZE: 12
});

/**
 * Key Derivation Function (KDF) configuration
 * These parameters should match the Android app settings
 * See: android/app/build.gradle.kts for Android KDF config
 */
export const KDF = Object.freeze({
  // Default KDF algorithm (SCRYPT or ARGON2ID)
  ALGORITHM: 'SCRYPT',

  // Scrypt parameters (moderate security, balanced performance)
  SCRYPT: Object.freeze({
    // CPU/memory cost parameter (2^15 = 32768)
    COST: 32768,

    // Block size parameter
    BLOCK_SIZE: 8,

    // Parallelization parameter
    PARALLELIZATION: 1,

    // Output key length in bytes (256-bit key)
    KEY_LENGTH: 32
  }),

  // Argon2id parameters (if using Argon2 instead of Scrypt)
  ARGON2ID: Object.freeze({
    // Memory cost in KiB (64 MiB)
    MEMORY: 65536,

    // Number of iterations (3 passes)
    ITERATIONS: 3,

    // Degree of parallelism (4 threads - matches vault-crypto.js and argon2-kdf.js)
    PARALLELISM: 4,

    // Output key length in bytes (256-bit key)
    KEY_LENGTH: 32
  })
});

/**
 * Dictionary integrity validation
 * Timeout for loading dictionary files
 */
export const DICTIONARY = Object.freeze({
  // Maximum time to wait for dictionary fetch (10 seconds)
  LOAD_TIMEOUT: 10000
});

/**
 * Rate limiting configuration for password generation
 * Prevents client-side DoS attacks
 */
export const RATE_LIMITING = Object.freeze({
  // Minimum delay between generations after burst (500ms)
  COOLDOWN_MS: 500,

  // Number of rapid generations allowed (3)
  MAX_BURST: 3,

  // Time window for burst counter reset (2 seconds)
  BURST_WINDOW_MS: 2000
});

/**
 * PBKDF2 configuration for browsers without Argon2 support
 * Used in io-service.js, secure-share.js for WebCrypto API
 * OWASP 2023 recommends 600,000 iterations for PBKDF2-SHA256
 */
export const PBKDF2 = Object.freeze({
  // Algorithm name for WebCrypto API
  ALGORITHM: 'PBKDF2',

  // Hash algorithm for HMAC
  HASH: 'SHA-256',

  // Iteration count (OWASP 2023 recommendation)
  ITERATIONS: 600000,

  // Legacy iteration count (for backwards compatibility with V1 vaults)
  LEGACY_ITERATIONS: 100000,

  // Salt length in bytes (256 bits)
  SALT_LENGTH: 32,

  // Output key length in bytes (256-bit AES key)
  KEY_LENGTH: 32
});

// NOTE: CACHE constants moved to ui-constants.js for unification
// Import { CACHE } from './ui-constants.js' instead

/**
 * Windows Hello authentication timeouts
 * Used in desktop/vault/auth/windows-hello.js
 */
export const WINDOWS_HELLO = Object.freeze({
  // Timeout for availability check (ms)
  AVAILABILITY_TIMEOUT: 15000,

  // Timeout for fallback WinBio service check (ms)
  FALLBACK_CHECK_TIMEOUT: 5000,

  // Timeout for user verification prompt (ms) - longer to allow biometric
  VERIFICATION_TIMEOUT: 60000,

  // Timeout for credential storage operations (ms)
  CREDENTIAL_TIMEOUT: 10000,

  // Credential TTL in milliseconds (30 days)
  // After this period, user must re-authenticate with master password
  CREDENTIAL_TTL_MS: 30 * 24 * 60 * 60 * 1000
});

/**
 * Cryptographic constants validation
 * Run at module load time to ensure all constants are valid
 */
function validateCryptoConstants() {
  // Validate KEYSET_ENVELOPE
  if (KEYSET_ENVELOPE.VERSION < 1) {
    throw new Error('Invalid KEYSET_ENVELOPE.VERSION: must be >= 1');
  }
  if (KEYSET_ENVELOPE.IV_BYTES !== 12) {
    console.warn('Non-standard KEYSET_ENVELOPE.IV_BYTES: recommended value is 12 for AES-GCM');
  }

  // Validate AES_GCM
  if (![128, 192, 256].includes(AES_GCM.KEY_SIZE)) {
    throw new Error('Invalid AES_GCM.KEY_SIZE: must be 128, 192, or 256');
  }
  if (AES_GCM.TAG_SIZE !== 128) {
    console.warn('Non-standard AES_GCM.TAG_SIZE: recommended value is 128 bits');
  }

  // Validate KDF.SCRYPT
  if (KDF.SCRYPT.COST < 1024) {
    console.warn('Low KDF.SCRYPT.COST: may be vulnerable to brute-force attacks');
  }
  if (KDF.SCRYPT.KEY_LENGTH < 16) {
    throw new Error('Invalid KDF.SCRYPT.KEY_LENGTH: must be >= 16 bytes');
  }

  // Validate KDF.ARGON2ID
  if (KDF.ARGON2ID.MEMORY < 8192) {
    console.warn('Low KDF.ARGON2ID.MEMORY: may be vulnerable to brute-force attacks');
  }
  if (KDF.ARGON2ID.ITERATIONS < 1) {
    throw new Error('Invalid KDF.ARGON2ID.ITERATIONS: must be >= 1');
  }
}

// Run validation at module load
validateCryptoConstants();
