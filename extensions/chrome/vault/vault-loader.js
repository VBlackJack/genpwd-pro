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
 * @fileoverview Vault Loader for Chrome extension
 * Loads and decrypts .gpdb vault files
 */

import { deriveKey, decryptData, base64ToBytes } from './crypto.js';

const GPDB_FORMAT = 'gpdb';

/**
 * Vault session state
 */
let vaultData = null;
let sessionKey = null;
let lockTimeout = null;
let fileData = null;

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load and decrypt a vault file
 * @param {string|Object} fileContent - JSON string or parsed object
 * @param {string} password - Master password
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function loadVault(fileContent, password) {
  try {
    const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;

    if (parsed.format !== GPDB_FORMAT) {
      return { success: false, error: 'Invalid vault format' };
    }

    if (!parsed.kdf || !parsed.encrypted) {
      return { success: false, error: 'Missing encryption data' };
    }

    // Store file data for re-unlock
    fileData = parsed;

    // Extract salt and derive key
    const salt = base64ToBytes(parsed.kdf.salt);
    const key = await deriveKey(password, salt, parsed.kdf);

    // Decrypt
    let plaintext;
    try {
      plaintext = await decryptData(parsed.encrypted, key);
    } catch {
      return { success: false, error: 'Wrong password or corrupted file' };
    }

    // Parse decrypted data
    const decrypted = JSON.parse(plaintext);

    // Store in session
    vaultData = deserializeVaultData(decrypted);
    sessionKey = key;

    // Set auto-lock timeout
    resetLockTimeout();

    return { success: true, data: vaultData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Unlock vault with password (after lock)
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function unlockVault(password) {
  if (!fileData) {
    return { success: false, error: 'No vault loaded' };
  }
  return loadVault(fileData, password);
}

/**
 * Lock the vault (clear session)
 */
export function lockVault() {
  vaultData = null;
  sessionKey = null;
  if (lockTimeout) {
    clearTimeout(lockTimeout);
    lockTimeout = null;
  }
}

/**
 * Check if vault is unlocked
 * @returns {boolean}
 */
export function isUnlocked() {
  return vaultData !== null && sessionKey !== null;
}

/**
 * Check if a vault file is loaded
 * @returns {boolean}
 */
export function hasVaultFile() {
  return fileData !== null;
}

/**
 * Get all entries
 * @returns {Array}
 */
export function getEntries() {
  return vaultData?.entries || [];
}

/**
 * Get entry by ID
 * @param {string} id
 * @returns {Object|null}
 */
export function getEntryById(id) {
  return vaultData?.entries.find(e => e.id === id) || null;
}

/**
 * Get entries matching a domain
 * @param {string} domain
 * @returns {Array}
 */
export function getEntriesForDomain(domain) {
  if (!domain || !vaultData) return [];

  const normalizedDomain = domain.toLowerCase();

  return vaultData.entries.filter(entry => {
    if (!entry.uri) return false;

    try {
      const entryDomain = extractDomain(entry.uri);
      if (!entryDomain) return false;

      // Exact match or subdomain match
      return entryDomain === normalizedDomain ||
             normalizedDomain.endsWith('.' + entryDomain) ||
             entryDomain.endsWith('.' + normalizedDomain);
    } catch {
      return false;
    }
  });
}

/**
 * Search entries by query
 * @param {string} query
 * @returns {Array}
 */
export function searchEntries(query) {
  if (!query || !vaultData) return vaultData?.entries || [];

  const q = query.toLowerCase();
  return vaultData.entries.filter(entry => {
    return (
      entry.title?.toLowerCase().includes(q) ||
      entry.username?.toLowerCase().includes(q) ||
      entry.uri?.toLowerCase().includes(q) ||
      entry.notes?.toLowerCase().includes(q)
    );
  });
}

/**
 * Get all groups/folders
 * @returns {Array}
 */
export function getGroups() {
  return vaultData?.groups || [];
}

/**
 * Reset the auto-lock timeout
 */
export function resetLockTimeout() {
  if (lockTimeout) {
    clearTimeout(lockTimeout);
  }
  lockTimeout = setTimeout(() => {
    lockVault();
  }, SESSION_TIMEOUT_MS);
}

/**
 * Record activity to prevent auto-lock
 */
export function recordActivity() {
  if (isUnlocked()) {
    resetLockTimeout();
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string|null}
 */
function extractDomain(url) {
  try {
    // Add protocol if missing
    let normalizedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      normalizedUrl = 'https://' + url;
    }
    const parsed = new URL(normalizedUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Deserialize vault data
 * @param {Object} data
 * @returns {Object}
 */
function deserializeVaultData(data) {
  const entries = (data.entries || []).map(entry => ({
    id: entry.id,
    title: entry.title || '',
    type: entry.type || 'login',
    username: entry.username || entry.data?.username || '',
    password: Array.isArray(entry.secret) ? entry.secret[0] : (entry.secret || ''),
    notes: entry.notes || entry.data?.notes || '',
    uri: entry.uri || entry.data?.url || '',
    tags: entry.tags || [],
    otpConfig: entry.otpConfig || null,
    folderId: entry.folderId || entry.groupId || null,
    fields: entry.fields || [],
    favorite: entry.favorite || false,
    metadata: entry.metadata || {}
  }));

  const groups = (data.groups || data.folders || []).map(group => ({
    id: group.id,
    name: group.name,
    parentId: group.parentId || null
  }));

  return { entries, groups, tags: data.tags || [] };
}

/**
 * Clear all vault data (for extension unload)
 */
export function clearVault() {
  lockVault();
  fileData = null;
}
