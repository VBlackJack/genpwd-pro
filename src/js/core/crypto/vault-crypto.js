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
 * Vault Crypto Manager for Electron/Node.js
 *
 * Mirrors the Android VaultCryptoManager implementation for cross-platform compatibility.
 *
 * Uses:
 * - Argon2id (via hash-wasm) for key derivation
 * - AES-256-GCM (via Node crypto) for encryption
 *
 * ARCHITECTURE NOTE:
 * This module uses AES-256-GCM for cross-platform compatibility with the Android app.
 * The desktop vault (src/desktop/vault/crypto/) uses XSalsa20-Poly1305 via TweetNaCl.
 * These are intentionally different:
 *   - vault-crypto.js (AES-GCM): For import/export and cross-platform sync
 *   - crypto-engine.js (XSalsa20): For local vault storage in Electron
 *
 * Data encrypted with one engine CANNOT be decrypted by the other.
 *
 * IMPORTANT: This module must run in the Electron Main Process or Preload context
 * to avoid blocking the UI during Argon2 hashing.
 *
 * @module vault-crypto
 */

import crypto from 'node:crypto';

// Use hash-wasm for Argon2id (pure WASM - no native compilation required)
let argon2id = null;

try {
  const hashWasm = await import('hash-wasm');
  argon2id = hashWasm.argon2id;
} catch {
  console.warn('hash-wasm not available - Argon2 operations will fail');
}

/**
 * Argon2id parameters matching Android VaultCryptoManager
 * @constant
 */
const ARGON2_CONFIG = {
  iterations: 3,           // t_cost: time cost (iterations)
  memory: 65536,           // m_cost: 64 MB in KB
  parallelism: 4,          // p_cost: parallelism factor
  hashLength: 32           // Output 32 bytes (256 bits) for AES-256
};

/**
 * AES-GCM configuration
 * @constant
 */
const AES_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,           // 256 bits
  ivLength: 12,            // 96 bits (GCM standard)
  tagLength: 16            // 128 bits authentication tag
};

/**
 * Salt configuration
 * @constant
 */
const SALT_CONFIG = {
  length: 32,              // 32 bytes for storage
  libsodiumLength: 16      // libsodium uses 16 bytes
};

/**
 * VaultCryptoManager - Cross-platform crypto implementation
 *
 * Provides Android-compatible encryption/decryption for vault data.
 */
class VaultCryptoManager {
  constructor() {
    this.config = {
      argon2: { ...ARGON2_CONFIG },
      aes: { ...AES_CONFIG },
      salt: { ...SALT_CONFIG }
    };
  }

  /**
   * Generate a cryptographically secure random salt
   * @returns {Buffer} 32-byte random salt
   */
  generateSalt() {
    return crypto.randomBytes(this.config.salt.length);
  }

  /**
   * Generate a cryptographically secure random IV for GCM
   * @returns {Buffer} 12-byte random IV
   */
  generateIV() {
    return crypto.randomBytes(this.config.aes.ivLength);
  }

  /**
   * Generate a random AES-256 key
   * @returns {Buffer} 32-byte random key
   */
  generateAESKey() {
    return crypto.randomBytes(this.config.aes.keyLength);
  }

  /**
   * Derive a key from master password using Argon2id
   *
   * Parameters match Android VaultCryptoManager:
   * - Memory: 64MB
   * - Iterations: 3
   * - Parallelism: 4
   *
   * @param {string} masterPassword - The master password
   * @param {Buffer} salt - 32-byte salt (uses first 16 bytes for libsodium compatibility)
   * @param {Object} params - Optional Argon2id parameters override
   * @returns {Promise<Buffer>} Derived 32-byte key
   * @throws {Error} If Argon2 is not available or derivation fails
   */
  async deriveKey(masterPassword, salt, params = {}) {
    if (!Buffer.isBuffer(salt) || salt.length !== this.config.salt.length) {
      throw new Error(`Salt must be a Buffer of ${this.config.salt.length} bytes`);
    }

    if (!argon2id) {
      throw new Error('hash-wasm not available. Cannot derive key.');
    }

    const config = {
      ...this.config.argon2,
      ...params
    };

    // Use first 16 bytes of salt for libsodium compatibility
    const libsodiumSalt = salt.slice(0, this.config.salt.libsodiumLength);

    // Use hash-wasm Argon2id (pure WASM - works everywhere)
    const hash = await argon2id({
      password: masterPassword,
      salt: libsodiumSalt,
      iterations: config.iterations,
      memorySize: config.memory,
      parallelism: config.parallelism,
      hashLength: config.hashLength,
      outputType: 'binary'
    });
    return Buffer.from(hash);
  }

  /**
   * Hash a password with Argon2id for storage/verification
   *
   * Returns standard PHC format for Android compatibility:
   * $argon2id$v=19$m=65536,t=3,p=4$<base64-salt>$<base64-hash>
   *
   * Parameters match Android VaultCryptoManager EXACTLY:
   * - Memory: 65536 KB (64 MB)
   * - Iterations: 3
   * - Parallelism: 4
   * - Hash Length: 32 bytes
   *
   * @param {string} masterPassword - The password to hash
   * @param {Buffer} salt - Salt for hashing (uses first 16 bytes)
   * @param {Object} params - Optional Argon2id parameters override
   * @returns {Promise<string>} Standard PHC-formatted Argon2id hash string
   */
  async hashPassword(masterPassword, salt, params = {}) {
    if (!argon2id) {
      throw new Error('hash-wasm not available. Cannot hash password.');
    }

    const config = {
      ...this.config.argon2,
      ...params
    };

    // Generate new salt if not provided or use first 16 bytes
    const hashSalt = salt
      ? salt.slice(0, this.config.salt.libsodiumLength)
      : crypto.randomBytes(this.config.salt.libsodiumLength);

    // Hash with hash-wasm
    const hash = await argon2id({
      password: masterPassword,
      salt: hashSalt,
      iterations: config.iterations,
      memorySize: config.memory,
      parallelism: config.parallelism,
      hashLength: config.hashLength,
      outputType: 'binary'
    });

    // Standard PHC format: $argon2id$v=19$m=M,t=T,p=P$<base64-salt>$<base64-hash>
    // Note: Argon2 version is always 19 (0x13)
    const saltB64 = Buffer.from(hashSalt).toString('base64').replace(/=+$/, '');
    const hashB64 = Buffer.from(hash).toString('base64').replace(/=+$/, '');
    return `$argon2id$v=19$m=${config.memory},t=${config.iterations},p=${config.parallelism}$${saltB64}$${hashB64}`;
  }

  /**
   * Verify a password against a stored Argon2id hash
   *
   * Supports standard PHC format: $argon2id$v=19$m=65536,t=3,p=4$<base64-salt>$<base64-hash>
   * Also supports legacy custom format for backwards compatibility: $genpwd$v1$...
   *
   * @param {string} storedHash - PHC-formatted or legacy hash string
   * @param {string} masterPassword - Password to verify
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(storedHash, masterPassword) {
    if (!argon2id) {
      throw new Error('hash-wasm not available. Cannot verify password.');
    }

    try {
      const parts = storedHash.split('$');

      // Standard PHC format: $argon2id$v=19$m=M,t=T,p=P$salt$hash
      // parts[0] = '' (empty before first $)
      // parts[1] = 'argon2id'
      // parts[2] = 'v=19'
      // parts[3] = 'm=65536,t=3,p=4'
      // parts[4] = base64 salt
      // parts[5] = base64 hash
      if (parts.length >= 6 && parts[1] === 'argon2id') {
        // Parse version (should be v=19)
        const versionMatch = parts[2].match(/v=(\d+)/);
        if (!versionMatch || versionMatch[1] !== '19') {
          return false;
        }

        // Parse parameters: m=65536,t=3,p=4
        const paramParts = parts[3].split(',');
        const paramMap = {};
        for (const p of paramParts) {
          const [key, val] = p.split('=');
          paramMap[key] = parseInt(val, 10);
        }

        const memory = paramMap.m;
        const iterations = paramMap.t;
        const parallelism = paramMap.p;

        // Decode base64 salt and expected hash (handle missing padding)
        const saltB64 = parts[4];
        const expectedHashB64 = parts[5];

        const salt = Buffer.from(saltB64, 'base64');
        const expectedHash = Buffer.from(expectedHashB64, 'base64');

        // Recompute hash with same parameters
        const computedHash = await argon2id({
          password: masterPassword,
          salt: salt,
          iterations: iterations,
          memorySize: memory,
          parallelism: parallelism,
          hashLength: expectedHash.length,
          outputType: 'binary'
        });

        // Constant-time comparison
        if (expectedHash.length !== computedHash.length) {
          return false;
        }
        return crypto.timingSafeEqual(expectedHash, Buffer.from(computedHash));
      }

      // Legacy format: $genpwd$v1$t=T$m=M$p=P$SALT_HEX$HASH_HEX
      if (parts.length >= 8 && parts[1] === 'genpwd' && parts[2] === 'v1') {
        // Safe parsing with bounds checking
        const iterParts = parts[3]?.split('=') || [];
        const memParts = parts[4]?.split('=') || [];
        const parParts = parts[5]?.split('=') || [];

        if (iterParts.length < 2 || memParts.length < 2 || parParts.length < 2) {
          return false; // Invalid format
        }

        const iterations = parseInt(iterParts[1], 10);
        const memory = parseInt(memParts[1], 10);
        const parallelism = parseInt(parParts[1], 10);
        const salt = Buffer.from(parts[6], 'hex');
        const expectedHash = parts[7];

        const computedHash = await argon2id({
          password: masterPassword,
          salt: salt,
          iterations: iterations,
          memorySize: memory,
          parallelism: parallelism,
          hashLength: this.config.argon2.hashLength,
          outputType: 'binary'
        });

        const computedHex = Buffer.from(computedHash).toString('hex');
        return crypto.timingSafeEqual(
          Buffer.from(expectedHash, 'hex'),
          Buffer.from(computedHex, 'hex')
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt data with AES-256-GCM
   *
   * @param {Buffer} plaintext - Data to encrypt
   * @param {Buffer} key - 32-byte encryption key
   * @param {Buffer} iv - 12-byte IV
   * @returns {Buffer} Encrypted data with authentication tag appended
   */
  encryptAESGCM(plaintext, key, iv) {
    if (!Buffer.isBuffer(key) || key.length !== this.config.aes.keyLength) {
      throw new Error(`Key must be a Buffer of ${this.config.aes.keyLength} bytes`);
    }
    if (!Buffer.isBuffer(iv) || iv.length !== this.config.aes.ivLength) {
      throw new Error(`IV must be a Buffer of ${this.config.aes.ivLength} bytes`);
    }

    const cipher = crypto.createCipheriv(this.config.aes.algorithm, key, iv, {
      authTagLength: this.config.aes.tagLength
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Return ciphertext + tag (same format as Android)
    return Buffer.concat([encrypted, tag]);
  }

  /**
   * Decrypt data with AES-256-GCM
   *
   * @param {Buffer} ciphertext - Encrypted data with authentication tag appended
   * @param {Buffer} key - 32-byte decryption key
   * @param {Buffer} iv - 12-byte IV
   * @returns {Buffer} Decrypted data
   * @throws {Error} If authentication fails
   */
  decryptAESGCM(ciphertext, key, iv) {
    if (!Buffer.isBuffer(key) || key.length !== this.config.aes.keyLength) {
      throw new Error(`Key must be a Buffer of ${this.config.aes.keyLength} bytes`);
    }
    if (!Buffer.isBuffer(iv) || iv.length !== this.config.aes.ivLength) {
      throw new Error(`IV must be a Buffer of ${this.config.aes.ivLength} bytes`);
    }
    if (!Buffer.isBuffer(ciphertext) || ciphertext.length < this.config.aes.tagLength) {
      throw new Error('Ciphertext too short');
    }

    // Extract tag from end of ciphertext
    const tagStart = ciphertext.length - this.config.aes.tagLength;
    const encrypted = ciphertext.slice(0, tagStart);
    const tag = ciphertext.slice(tagStart);

    const decipher = crypto.createDecipheriv(this.config.aes.algorithm, key, iv, {
      authTagLength: this.config.aes.tagLength
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  /**
   * Encrypt a string with AES-256-GCM
   *
   * @param {string} plaintext - String to encrypt
   * @param {Buffer} key - 32-byte encryption key
   * @param {Buffer} iv - 12-byte IV
   * @returns {Buffer} Encrypted data
   */
  encryptString(plaintext, key, iv) {
    return this.encryptAESGCM(Buffer.from(plaintext, 'utf8'), key, iv);
  }

  /**
   * Decrypt to a string with AES-256-GCM
   *
   * @param {Buffer} ciphertext - Encrypted data
   * @param {Buffer} key - 32-byte decryption key
   * @param {Buffer} iv - 12-byte IV
   * @returns {string} Decrypted string
   */
  decryptString(ciphertext, key, iv) {
    return this.decryptAESGCM(ciphertext, key, iv).toString('utf8');
  }

  /**
   * Encrypt bytes with auto-generated IV (KeePass-style)
   *
   * Format: IV (12 bytes) + Ciphertext + Tag
   *
   * @param {Buffer} plaintext - Data to encrypt
   * @param {Buffer} key - 32-byte encryption key
   * @returns {Buffer} IV + encrypted data
   */
  encryptBytes(plaintext, key) {
    const iv = this.generateIV();
    const encrypted = this.encryptAESGCM(plaintext, key, iv);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt bytes with embedded IV (KeePass-style)
   *
   * Format: IV (12 bytes) + Ciphertext + Tag
   *
   * @param {Buffer} ciphertext - IV + encrypted data
   * @param {Buffer} key - 32-byte decryption key
   * @returns {Buffer} Decrypted data
   */
  decryptBytes(ciphertext, key) {
    if (!Buffer.isBuffer(ciphertext) || ciphertext.length <= this.config.aes.ivLength) {
      throw new Error('Ciphertext too short (must contain IV)');
    }

    const iv = ciphertext.slice(0, this.config.aes.ivLength);
    const encrypted = ciphertext.slice(this.config.aes.ivLength);
    return this.decryptAESGCM(encrypted, key, iv);
  }

  /**
   * Create a new vault with all necessary cryptographic materials
   *
   * This function:
   * 1. Generates a random salt
   * 2. Derives a key from the master password (Argon2id)
   * 3. Generates a random AES-256 vault key
   * 4. Encrypts the vault key with the derived key
   * 5. Hashes the master password for verification
   *
   * @param {string} masterPassword - Master password for the vault
   * @param {Object} params - Optional Argon2id parameters override
   * @returns {Promise<Object>} Vault creation result
   */
  async createVault(masterPassword, params = {}) {
    // 1. Generate random salt
    const salt = this.generateSalt();

    // 2. Derive key from master password
    const derivedKey = await this.deriveKey(masterPassword, salt, params);

    // 3. Generate random vault key
    const vaultKey = this.generateAESKey();

    // 4. Encrypt vault key with derived key
    const keyIv = this.generateIV();
    const encryptedKey = this.encryptAESGCM(vaultKey, derivedKey, keyIv);

    // 5. Hash master password for verification
    const passwordHash = await this.hashPassword(masterPassword, salt, params);

    return {
      salt: this.bytesToHex(salt),
      masterPasswordHash: passwordHash,
      encryptedKey: this.bytesToHex(encryptedKey),
      keyIv: this.bytesToHex(keyIv),
      derivedKey: derivedKey // Don't store this!
    };
  }

  /**
   * Unlock an existing vault
   *
   * @param {string} masterPassword - Master password
   * @param {string} saltHex - Stored salt (hex string)
   * @param {string} encryptedKeyHex - Encrypted vault key (hex string)
   * @param {string} keyIvHex - Key IV (hex string)
   * @param {Object} params - Optional Argon2id parameters override
   * @returns {Promise<Buffer|null>} Decrypted vault key, or null if password incorrect
   */
  async unlockVault(masterPassword, saltHex, encryptedKeyHex, keyIvHex, params = {}) {
    try {
      // 1. Derive key from master password
      const derivedKey = await this.deriveKey(
        masterPassword,
        this.hexToBytes(saltHex),
        params
      );

      // 2. Decrypt vault key
      const vaultKey = this.decryptAESGCM(
        this.hexToBytes(encryptedKeyHex),
        derivedKey,
        this.hexToBytes(keyIvHex)
      );

      return vaultKey;
    } catch {
      return null;
    }
  }

  /**
   * Derive key with optional key file (KeePass-style multi-factor)
   *
   * @param {string} masterPassword - Master password
   * @param {Buffer} salt - Salt for Argon2id
   * @param {Buffer|null} keyFileContent - Optional key file content
   * @param {Object} params - Optional Argon2id parameters
   * @returns {Promise<Buffer>} Derived key
   */
  async deriveKeyWithKeyFile(masterPassword, salt, keyFileContent = null, params = {}) {
    if (keyFileContent) {
      // Create composite key
      const passwordHash = crypto.createHash('sha256')
        .update(masterPassword)
        .digest();

      const keyFileHash = crypto.createHash('sha256')
        .update(keyFileContent)
        .digest();

      // Combine hashes
      const combined = Buffer.concat([passwordHash, keyFileHash]);
      const compositeHash = crypto.createHash('sha256')
        .update(combined)
        .digest();

      // Use hex string as password for Argon2id
      return this.deriveKey(this.bytesToHex(compositeHash), salt, params);
    }

    return this.deriveKey(masterPassword, salt, params);
  }

  /**
   * Hash a file with SHA-256 (for key files)
   *
   * @param {Buffer} fileContent - File content
   * @returns {Buffer} SHA-256 hash
   */
  hashFile(fileContent) {
    return crypto.createHash('sha256').update(fileContent).digest();
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Convert bytes to hex string
   * @param {Buffer} bytes - Bytes to convert
   * @returns {string} Hex string
   */
  bytesToHex(bytes) {
    return bytes.toString('hex');
  }

  /**
   * Convert hex string to bytes
   * @param {string} hex - Hex string
   * @returns {Buffer} Bytes
   */
  hexToBytes(hex) {
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    return Buffer.from(hex, 'hex');
  }

  /**
   * Convert bytes to base64
   * @param {Buffer} bytes - Bytes to convert
   * @returns {string} Base64 string
   */
  bytesToBase64(bytes) {
    return bytes.toString('base64');
  }

  /**
   * Convert base64 to bytes
   * @param {string} base64 - Base64 string
   * @returns {Buffer} Bytes
   */
  base64ToBytes(base64) {
    return Buffer.from(base64, 'base64');
  }

  // ========================================
  // Memory Security
  // ========================================

  /**
   * Wipe a buffer (best effort memory clearing)
   *
   * Note: Due to V8's garbage collection, this is not guaranteed to
   * completely remove data from memory. For maximum security, use
   * hardware-backed keystores when available.
   *
   * @param {Buffer} buffer - Buffer to wipe
   */
  wipeBuffer(buffer) {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }

  /**
   * Wipe a string (by overwriting if possible)
   *
   * Note: JavaScript strings are immutable, so this is mostly symbolic.
   * The GC will eventually reclaim the memory.
   *
   * @param {string} str - String to "wipe" (returns empty string)
   * @returns {string} Empty string
   */
  wipeString(_str) {
    // Cannot modify string in place in JS
    // Return empty string and let GC handle original
    return '';
  }
}

// Export singleton instance and class
const vaultCrypto = new VaultCryptoManager();

export default vaultCrypto;
export { VaultCryptoManager, ARGON2_CONFIG, AES_CONFIG, SALT_CONFIG };
