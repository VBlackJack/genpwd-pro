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

// src/js/utils/storage-helper.js - Safe localStorage operations with quota management

import { safeLog } from './logger.js';
import { SIZE_LIMITS } from '../config/ui-constants.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/**
 * Estimates the size of data in bytes (approximation)
 * @param {*} data - Data to estimate size
 * @returns {number} Estimated size in bytes
 */
function estimateSize(data) {
  if (data === null || data === undefined) return 0;

  const str = typeof data === 'string' ? data : JSON.stringify(data);
  // Each character is approximately 2 bytes in UTF-16
  return str.length * 2;
}

/**
 * Checks if there's enough localStorage space for the data
 * @param {string} key - Storage key
 * @param {*} data - Data to store
 * @returns {boolean} true if space is available
 */
function checkQuota(key, data) {
  const dataSize = estimateSize(data);

  // Chrome/Edge: ~5MB, Firefox: ~10MB, Safari: ~5MB
  // Use conservative 5MB limit
  if (dataSize > SIZE_LIMITS.MAX_STORAGE_SIZE) {
    safeLog(`Storage quota exceeded: ${key} (${dataSize} bytes > ${SIZE_LIMITS.MAX_STORAGE_SIZE} bytes)`);
    return false;
  }

  return true;
}

/**
 * Attempts to free up localStorage space
 * @param {number} bytesNeeded - Bytes to free
 * @returns {boolean} true if space was freed
 */
function freeSpace(bytesNeeded) {
  try {
    // Get all keys sorted by last access time (if available)
    const keys = Object.keys(localStorage);
    const keysToRemove = [];

    // Remove old history items first (LRU strategy)
    for (const key of keys) {
      if (key.startsWith('genpwd_history_old_') ||
          key.startsWith('temp_') ||
          key.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }

    let freedBytes = 0;
    for (const key of keysToRemove) {
      const itemSize = estimateSize(localStorage.getItem(key));
      localStorage.removeItem(key);
      freedBytes += itemSize;

      if (freedBytes >= bytesNeeded) {
        safeLog(`Freed ${freedBytes} bytes from localStorage`);
        return true;
      }
    }

    return false;
  } catch (error) {
    safeLog(`Error freeing localStorage space: ${error.message}`);
    return false;
  }
}

/**
 * Safely sets an item in localStorage with quota checking
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON.stringify if not string)
 * @returns {boolean} true if successful
 */
export function safeSetItem(key, value) {
  if (!key || typeof key !== 'string') {
    safeLog('safeSetItem: invalid key');
    return false;
  }

  try {
    const data = typeof value === 'string' ? value : JSON.stringify(value);

    // Check quota before attempting to write
    if (!checkQuota(key, data)) {
      // Try to free space
      const dataSize = estimateSize(data);
      if (freeSpace(dataSize)) {
        // Retry after freeing space
        localStorage.setItem(key, data);
        invalidateStorageInfoCache(); // Invalidate cache after modification
        return true;
      }

      throw new Error(`Insufficient storage space for ${key}`);
    }

    localStorage.setItem(key, data);
    invalidateStorageInfoCache(); // Invalidate cache after modification
    return true;

  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      safeLog(`localStorage quota exceeded for ${key}. Attempting to free space...`);

      // Try to free space and retry once
      const dataSize = estimateSize(value);
      if (freeSpace(dataSize)) {
        try {
          const data = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(key, data);
          invalidateStorageInfoCache(); // Invalidate cache after modification
          safeLog(`Successfully stored ${key} after freeing space`);
          return true;
        } catch (retryError) {
          safeLog(`Failed to store ${key} even after freeing space: ${retryError.message}`);
          showToast(t('toast.storageQuotaExceeded'), 'error');
          return false;
        }
      }

      safeLog(`Unable to free enough space for ${key}`);
      showToast(t('toast.storageQuotaExceeded'), 'error');
      return false;
    }

    safeLog(`Error setting localStorage item ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Safely gets an item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Stored value or default value
 */
export function safeGetItem(key, defaultValue = null) {
  if (!key || typeof key !== 'string') {
    safeLog('safeGetItem: invalid key');
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    safeLog(`Error getting localStorage item ${key}: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Safely removes an item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} true if successful
 */
export function safeRemoveItem(key) {
  if (!key || typeof key !== 'string') {
    safeLog('safeRemoveItem: invalid key');
    return false;
  }

  try {
    localStorage.removeItem(key);
    invalidateStorageInfoCache(); // Invalidate cache after modification
    return true;
  } catch (error) {
    safeLog(`Error removing localStorage item ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Cache for storage info to avoid expensive recalculation
 * @private
 */
let cachedStorageInfo = null;
let lastStorageInfoCalculation = 0;
const STORAGE_INFO_CACHE_TTL = 5000; // 5 seconds cache TTL

/**
 * Gets the current localStorage usage (cached for performance)
 *
 * Performance optimization: This function calculates the size of all localStorage items,
 * which can be expensive if called frequently. Results are cached for 5 seconds.
 *
 * @param {boolean} forceRefresh - Force cache refresh (default: false)
 * @returns {Object} { used: number, estimated: number, keys: number, percentUsed: string }
 */
export function getStorageInfo(forceRefresh = false) {
  try {
    const now = Date.now();

    // Return cached result if available and not expired
    if (!forceRefresh && cachedStorageInfo && (now - lastStorageInfoCalculation) < STORAGE_INFO_CACHE_TTL) {
      return { ...cachedStorageInfo }; // Return defensive copy
    }

    // Recalculate storage info
    const keys = Object.keys(localStorage);
    let totalSize = 0;

    for (const key of keys) {
      const item = localStorage.getItem(key);
      totalSize += estimateSize(item) + estimateSize(key);
    }

    const info = {
      used: totalSize,
      estimated: SIZE_LIMITS.MAX_STORAGE_SIZE,
      keys: keys.length,
      percentUsed: ((totalSize / SIZE_LIMITS.MAX_STORAGE_SIZE) * 100).toFixed(2)
    };

    // Update cache
    cachedStorageInfo = info;
    lastStorageInfoCalculation = now;

    return { ...info }; // Return defensive copy
  } catch (error) {
    safeLog(`Error getting storage info: ${error.message}`);
    return { used: 0, estimated: SIZE_LIMITS.MAX_STORAGE_SIZE, keys: 0, percentUsed: '0.00' };
  }
}

/**
 * Invalidates the storage info cache
 * Should be called after any localStorage modification
 */
export function invalidateStorageInfoCache() {
  cachedStorageInfo = null;
  lastStorageInfoCalculation = 0;
}

/**
 * Clears all localStorage data (with confirmation)
 * @returns {boolean} true if cleared
 */
export function clearAllStorage() {
  try {
    localStorage.clear();
    invalidateStorageInfoCache(); // Invalidate cache after modification
    safeLog('localStorage cleared');
    return true;
  } catch (error) {
    safeLog(`Error clearing localStorage: ${error.message}`);
    return false;
  }
}

export default {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  getStorageInfo,
  invalidateStorageInfoCache,
  clearAllStorage
};
