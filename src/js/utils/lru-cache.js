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

// src/js/utils/lru-cache.js - LRU (Least Recently Used) Cache implementation

import { safeLog } from './logger.js';
import { SIZE_LIMITS } from '../config/ui-constants.js';

/**
 * LRU Cache implementation
 * Automatically evicts least recently used items when max capacity is reached
 */
export class LRUCache {
  /**
   * @param {number} [maxSize] - Maximum number of items (default: 50)
   */
  constructor(maxSize = SIZE_LIMITS.MAX_CACHED_ELEMENTS) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map maintains insertion order
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // If key exists, delete it first (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      // First entry is oldest (least recently used)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      safeLog(`LRUCache: Evicted "${oldestKey}" (size: ${this.cache.size}/${this.maxSize})`);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get current cache size
   * @returns {number} Number of items in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all keys in cache (ordered by usage, oldest first)
   * @returns {Array<string>} Array of keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in cache
   * @returns {Array<*>} Array of values
   */
  values() {
    return Array.from(this.cache.values());
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: ((this.cache.size / this.maxSize) * 100).toFixed(2),
      oldestKey: this.cache.size > 0 ? this.cache.keys().next().value : null,
      newestKey: this.cache.size > 0 ? Array.from(this.cache.keys()).pop() : null
    };
  }
}

/**
 * Creates a new LRU cache instance
 * @param {number} [maxSize] - Maximum cache size
 * @returns {LRUCache} LRU cache instance
 */
export function createLRUCache(maxSize) {
  return new LRUCache(maxSize);
}

export default LRUCache;
