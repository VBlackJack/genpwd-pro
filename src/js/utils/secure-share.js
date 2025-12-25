/**
 * @fileoverview Secure Sharing
 * Generate encrypted shareable entries
 *
 * @version 2.6.8
 */

import { safeLog } from './logger.js';
import { PBKDF2 } from '../config/crypto-constants.js';

// Share format version
const SHARE_VERSION = 1;

// Default expiration (24 hours in ms)
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a secure shareable payload for an entry
 * @param {Object} entry - Vault entry to share
 * @param {string} passphrase - Encryption passphrase
 * @param {Object} [options]
 * @param {number} [options.expiresIn] - Expiration time in ms
 * @param {boolean} [options.includeNotes=false] - Include notes
 * @returns {Promise<string>} Base64-encoded encrypted payload
 */
export async function createShare(entry, passphrase, options = {}) {
  const {
    expiresIn = DEFAULT_EXPIRY_MS,
    includeNotes = false
  } = options;

  // Build shareable data
  const shareData = {
    v: SHARE_VERSION,
    type: entry.type,
    title: entry.title,
    data: {},
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresIn).toISOString()
  };

  // Include relevant fields based on type
  switch (entry.type) {
    case 'login':
      shareData.data.username = entry.data?.username || '';
      shareData.data.password = entry.data?.password || '';
      shareData.data.url = entry.data?.url || '';
      if (entry.data?.totp) shareData.data.totp = entry.data.totp;
      break;
    case 'card':
      shareData.data.holder = entry.data?.holder || '';
      shareData.data.number = entry.data?.number || '';
      shareData.data.expiry = entry.data?.expiry || '';
      shareData.data.cvv = entry.data?.cvv || '';
      break;
    case 'note':
      shareData.data.content = entry.data?.content || '';
      break;
    case 'identity':
      shareData.data.fullName = entry.data?.fullName || '';
      shareData.data.email = entry.data?.email || '';
      shareData.data.phone = entry.data?.phone || '';
      break;
  }

  if (includeNotes && entry.notes) {
    shareData.notes = entry.notes;
  }

  // Encrypt the data
  const encrypted = await encryptPayload(JSON.stringify(shareData), passphrase);

  // Create final shareable string
  const shareString = `GENPWD:${SHARE_VERSION}:${encrypted}`;

  safeLog(`[SecureShare] Created share for "${entry.title}"`);
  return shareString;
}

/**
 * Decrypt and parse a shared payload
 * @param {string} shareString - The shared encrypted string
 * @param {string} passphrase - Decryption passphrase
 * @returns {Promise<Object|null>} Decrypted entry data or null if invalid
 */
export async function openShare(shareString, passphrase) {
  try {
    // Validate format
    if (!shareString.startsWith('GENPWD:')) {
      throw new Error('Invalid format');
    }

    const parts = shareString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid format');
    }

    const version = parseInt(parts[1], 10);
    const encrypted = parts[2];

    if (version !== SHARE_VERSION) {
      throw new Error('Unsupported version');
    }

    // Decrypt
    const decrypted = await decryptPayload(encrypted, passphrase);
    const shareData = JSON.parse(decrypted);

    // Check expiration
    if (shareData.expiresAt && new Date(shareData.expiresAt) < new Date()) {
      throw new Error('Share expired');
    }

    safeLog(`[SecureShare] Opened share: "${shareData.title}"`);
    return shareData;
  } catch (error) {
    safeLog(`[SecureShare] Open error: ${error.message}`);
    return null;
  }
}

/**
 * Encrypt payload using AES-GCM
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<string>} Base64-encoded encrypted data
 */
async function encryptPayload(plaintext, passphrase) {
  // Derive key from passphrase
  const encoder = new TextEncoder();
  const passphraseData = encoder.encode(passphrase);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive key using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseData,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: PBKDF2.ALGORITHM,
      salt,
      iterations: PBKDF2.ITERATIONS,
      hash: PBKDF2.HASH
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const plaintextData = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextData
  );

  // Combine salt + iv + ciphertext
  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Base64 encode
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt payload
 * @param {string} encryptedBase64
 * @param {string} passphrase
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decryptPayload(encryptedBase64, passphrase) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Base64 decode
  const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Extract parts
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  // Derive key
  const passphraseData = encoder.encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseData,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: PBKDF2.ALGORITHM,
      salt,
      iterations: PBKDF2.ITERATIONS,
      hash: PBKDF2.HASH
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Generate a simple random passphrase for share links
 * @param {number} [wordCount=4] - Number of words
 * @returns {string}
 */
export function generateSimplePassphrase(wordCount = 4) {
  const words = [
    'apple', 'banana', 'cherry', 'dragon', 'eagle', 'forest', 'garden', 'harbor',
    'island', 'jungle', 'knight', 'lemon', 'mountain', 'nature', 'ocean', 'palace',
    'queen', 'river', 'storm', 'tiger', 'umbrella', 'valley', 'winter', 'xenon',
    'yellow', 'zebra', 'alpha', 'brave', 'crystal', 'diamond', 'ember', 'falcon',
    'golden', 'horizon', 'ivory', 'jasper', 'karma', 'lunar', 'maple', 'noble'
  ];

  // Use CSPRNG for secure word selection
  const randomBytes = new Uint8Array(wordCount);
  crypto.getRandomValues(randomBytes);

  const selected = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = randomBytes[i] % words.length;
    selected.push(words[idx]);
  }

  return selected.join('-');
}

/**
 * Format share for display
 * @param {Object} shareData - Decrypted share data
 * @returns {string} Formatted display string
 */
export function formatShareForDisplay(shareData) {
  const lines = [];
  lines.push(`Type: ${shareData.type}`);
  lines.push(`Title: ${shareData.title}`);

  if (shareData.data.username) lines.push(`Username: ${shareData.data.username}`);
  if (shareData.data.password) lines.push(`Password: ${shareData.data.password}`);
  if (shareData.data.url) lines.push(`URL: ${shareData.data.url}`);
  if (shareData.data.totp) lines.push(`TOTP: ${shareData.data.totp}`);
  if (shareData.notes) lines.push(`Notes: ${shareData.notes}`);

  lines.push(`Expires: ${new Date(shareData.expiresAt).toLocaleString('en-US')}`);

  return lines.join('\n');
}

export default {
  createShare,
  openShare,
  generateSimplePassphrase,
  formatShareForDisplay,
  SHARE_VERSION
};
