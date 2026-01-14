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

// src/desktop/vault/sync/sync-crypto.js - E2E Encryption Envelope for Cloud Sync
// Adds an additional encryption layer for cloud-synced data

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { argon2id } from 'hash-wasm';

/**
 * Sync Envelope Schema Version
 */
const ENVELOPE_VERSION = '1.0';

/**
 * Encryption algorithm for envelope
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Key derivation parameters for sync key
 * Lighter than vault KDF since vault is already encrypted
 */
const SYNC_KDF_PARAMS = {
  memory: 32768,      // 32 MB
  iterations: 2,
  parallelism: 2,
  hashLength: 32
};

/**
 * Sync Envelope Structure
 * @typedef {Object} SyncEnvelope
 * @property {string} version - Envelope version
 * @property {string} algorithm - Encryption algorithm
 * @property {string} salt - Base64 salt for key derivation
 * @property {string} iv - Base64 initialization vector
 * @property {string} authTag - Base64 authentication tag
 * @property {string} ciphertext - Base64 encrypted data
 * @property {string} checksum - SHA-256 of original data for integrity
 * @property {number} timestamp - Encryption timestamp
 */

/**
 * Derive sync encryption key from user secret
 * @param {string} secret - User-provided sync secret or derived from master password
 * @param {Uint8Array} salt - Random salt
 * @returns {Promise<Buffer>} 32-byte encryption key
 */
async function deriveSyncKey(secret, salt) {
  const key = await argon2id({
    password: secret,
    salt,
    parallelism: SYNC_KDF_PARAMS.parallelism,
    iterations: SYNC_KDF_PARAMS.iterations,
    memorySize: SYNC_KDF_PARAMS.memory,
    hashLength: SYNC_KDF_PARAMS.hashLength,
    outputType: 'binary'
  });
  return Buffer.from(key);
}

/**
 * Calculate SHA-256 checksum of data
 * @param {Buffer} data - Data to checksum
 * @returns {string} Hex-encoded checksum
 */
function calculateChecksum(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt data with E2E envelope
 * @param {Buffer} data - Data to encrypt (already encrypted vault)
 * @param {string} syncSecret - Sync encryption secret
 * @returns {Promise<SyncEnvelope>} Encrypted envelope
 */
export async function encryptEnvelope(data, syncSecret) {
  if (!data || !syncSecret) {
    throw new Error('Data and sync secret are required');
  }

  // Generate random salt and IV
  const salt = randomBytes(32);
  const iv = randomBytes(12); // 96 bits for GCM

  // Derive encryption key
  const key = await deriveSyncKey(syncSecret, salt);

  // Calculate checksum before encryption
  const checksum = calculateChecksum(data);

  // Encrypt with AES-256-GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Wipe key from memory
  key.fill(0);

  return {
    version: ENVELOPE_VERSION,
    algorithm: ALGORITHM,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    checksum,
    timestamp: Date.now()
  };
}

/**
 * Decrypt E2E envelope
 * @param {SyncEnvelope} envelope - Encrypted envelope
 * @param {string} syncSecret - Sync encryption secret
 * @returns {Promise<Buffer>} Decrypted data
 */
export async function decryptEnvelope(envelope, syncSecret) {
  if (!envelope || !syncSecret) {
    throw new Error('Envelope and sync secret are required');
  }

  // Validate envelope structure
  if (envelope.version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: ${envelope.version}`);
  }

  if (envelope.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${envelope.algorithm}`);
  }

  // Decode components
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  // Derive decryption key
  const key = await deriveSyncKey(syncSecret, salt);

  try {
    // Decrypt with AES-256-GCM
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    // Verify checksum
    const computedChecksum = calculateChecksum(decrypted);
    if (computedChecksum !== envelope.checksum) {
      throw new Error('Checksum verification failed - data may be corrupted');
    }

    return decrypted;
  } finally {
    // Wipe key from memory
    key.fill(0);
  }
}

/**
 * Serialize envelope to JSON string
 * @param {SyncEnvelope} envelope - Envelope to serialize
 * @returns {string} JSON string
 */
export function serializeEnvelope(envelope) {
  return JSON.stringify(envelope);
}

/**
 * Parse envelope from JSON string
 * @param {string} json - JSON string
 * @returns {SyncEnvelope} Parsed envelope
 */
export function parseEnvelope(json) {
  const envelope = JSON.parse(json);

  // Validate required fields
  const requiredFields = ['version', 'algorithm', 'salt', 'iv', 'authTag', 'ciphertext', 'checksum'];
  for (const field of requiredFields) {
    if (!envelope[field]) {
      throw new Error(`Invalid envelope: missing ${field}`);
    }
  }

  return envelope;
}

/**
 * Generate a sync secret from master password
 * Uses HKDF-like expansion to derive a separate secret
 * @param {string} masterPassword - User's master password
 * @param {string} vaultId - Vault identifier for domain separation
 * @returns {Promise<string>} Derived sync secret (hex-encoded)
 */
export async function deriveSyncSecret(masterPassword, vaultId) {
  const salt = Buffer.from(`genpwd-sync-${vaultId}`, 'utf8');

  const key = await argon2id({
    password: masterPassword,
    salt,
    parallelism: 1,
    iterations: 1,
    memorySize: 4096,  // Light KDF for derivation
    hashLength: 32,
    outputType: 'hex'
  });

  return key;
}

/**
 * Check if data is an encrypted envelope
 * @param {Buffer|string} data - Data to check
 * @returns {boolean} True if data appears to be an envelope
 */
export function isEnvelope(data) {
  try {
    const str = Buffer.isBuffer(data) ? data.toString('utf8') : data;
    const parsed = JSON.parse(str);
    return parsed.version === ENVELOPE_VERSION && parsed.algorithm === ALGORITHM;
  } catch {
    return false;
  }
}

export default {
  encryptEnvelope,
  decryptEnvelope,
  serializeEnvelope,
  parseEnvelope,
  deriveSyncSecret,
  isEnvelope,
  ENVELOPE_VERSION
};
