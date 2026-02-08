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

// src/js/services/hibp-service.js - Have I Been Pwned API Service

import { safeLog } from '../utils/logger.js';
import { CACHE } from '../config/ui-constants.js';

/**
 * HIBP Service - Check passwords against Have I Been Pwned database
 * Uses k-anonymity model to preserve privacy
 */
class HIBPService {
  constructor() {
    this.apiUrl = 'https://api.pwnedpasswords.com/range/';
    this.enabled = true;
    this.cache = new Map();
    this.cacheTimeout = CACHE.HIBP_TTL;
    this.rateLimitDelay = 1500; // 1.5 seconds between requests
    this.lastRequestTime = 0;

    safeLog('HIBP Service initialized');
  }

  /**
   * Check if a password has been pwned
   * @param {string} password - Password to check
   * @returns {Promise<{isPwned: boolean, count: number, error?: string}>}
   */
  async checkPassword(password) {
    if (!this.enabled) {
      return { isPwned: false, count: 0, error: 'HIBP checking disabled' };
    }

    if (!password || password.length === 0) {
      return { isPwned: false, count: 0, error: 'Empty password' };
    }

    try {
      // 1. Hash the password with SHA-1
      const hash = await this.sha1Hash(password);
      const hashUpper = hash.toUpperCase();

      // 2. Split hash: first 5 chars (prefix) and remainder (suffix)
      const prefix = hashUpper.substring(0, 5);
      const suffix = hashUpper.substring(5);

      safeLog('Checking password against HIBP database');

      // 3. Check cache first
      const cached = this.getCached(prefix);
      if (cached) {
        safeLog('Using cached HIBP response');
        return this.checkSuffixInResponse(suffix, cached);
      }

      // 4. Rate limiting
      await this.rateLimit();

      // 5. Query HIBP API with k-anonymity (only send first 5 chars)
      const response = await this.queryHIBPAPI(prefix);

      if (!response.ok) {
        throw new Error(`HIBP API error: ${response.status}`);
      }

      const responseText = await response.text();

      // 6. Cache the response
      this.setCached(prefix, responseText);

      // 7. Check if our suffix is in the response
      return this.checkSuffixInResponse(suffix, responseText);

    } catch (error) {
      safeLog(`HIBP check error: ${error.message}`);
      return {
        isPwned: false,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Check multiple passwords in batch
   * @param {string[]} passwords - Array of passwords to check
   * @returns {Promise<Array<{password: string, isPwned: boolean, count: number}>>}
   */
  async checkPasswordBatch(passwords) {
    const results = [];

    for (const password of passwords) {
      const result = await this.checkPassword(password);
      results.push({
        password: password,
        ...result
      });
    }

    return results;
  }

  /**
   * Hash a string with SHA-1
   * @param {string} str - String to hash
   * @returns {Promise<string>} - Hex-encoded hash
   */
  async sha1Hash(str) {
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(str);

    // Hash with SHA-1
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Query HIBP API with hash prefix
   * @param {string} prefix - First 5 characters of SHA-1 hash
   * @returns {Promise<Response>}
   */
  async queryHIBPAPI(prefix) {
    const url = `${this.apiUrl}${prefix}`;

    safeLog(`Querying HIBP API: ${url}`);

    return fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'GenPwd-Pro-v3.1.0',
        'Add-Padding': 'true' // Request padding for additional privacy
      }
    });
  }

  /**
   * Check if suffix exists in HIBP response
   * @param {string} suffix - Hash suffix to find
   * @param {string} response - HIBP API response text
   * @returns {Object} - {isPwned: boolean, count: number}
   */
  checkSuffixInResponse(suffix, response) {
    // Response format: one line per hash suffix
    // Example: "0018A45C4D1DEF81644B54AB7F969B88D65:3"
    //          suffix:count

    const lines = response.split('\n');

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');

      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);
        safeLog(`Password found in breach database! Count: ${count}`);
        return {
          isPwned: true,
          count: count
        };
      }
    }

    safeLog('Password not found in breach database');
    return {
      isPwned: false,
      count: 0
    };
  }

  /**
   * Rate limiting to respect HIBP API limits
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      safeLog(`Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get cached response
   * @param {string} prefix - Hash prefix
   * @returns {string|null} - Cached response or null
   */
  getCached(prefix) {
    const cached = this.cache.get(prefix);

    if (!cached) return null;

    // Check if cache expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(prefix);
      return null;
    }

    return cached.response;
  }

  /**
   * Set cached response
   * @param {string} prefix - Hash prefix
   * @param {string} response - API response
   */
  setCached(prefix, response) {
    this.cache.set(prefix, {
      response: response,
      timestamp: Date.now()
    });

    // Limit cache size to 100 entries
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    safeLog('HIBP cache cleared');
  }

  /**
   * Enable HIBP checking
   */
  enable() {
    this.enabled = true;
    safeLog('HIBP checking enabled');
  }

  /**
   * Disable HIBP checking
   */
  disable() {
    this.enabled = false;
    safeLog('HIBP checking disabled');
  }

  /**
   * Check if HIBP is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    return {
      enabled: this.enabled,
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      rateLimitDelay: this.rateLimitDelay
    };
  }

  /**
   * Get breach severity level based on count
   * @param {number} count - Number of times password appeared in breaches
   * @returns {string} - Severity level: 'critical', 'high', 'medium', 'low'
   */
  getSeverity(count) {
    if (count === 0) return 'safe';
    if (count < 10) return 'low';
    if (count < 100) return 'medium';
    if (count < 1000) return 'high';
    return 'critical';
  }

  /**
   * Get user-friendly message for breach result
   * @param {boolean} isPwned - Whether password is pwned
   * @param {number} count - Breach count
   * @returns {string}
   */
  getMessage(isPwned, count) {
    if (!isPwned) {
      return '✅ This password has not been found in any known data breaches.';
    }

    const severity = this.getSeverity(count);
    const countStr = count.toLocaleString();

    switch (severity) {
      case 'low':
        return `⚠️ This password has been seen ${countStr} time(s) in data breaches. Consider using a different password.`;
      case 'medium':
        return `⚠️ WARNING: This password has been seen ${countStr} times in data breaches. We recommend changing it.`;
      case 'high':
        return `🚨 DANGER: This password has been seen ${countStr} times in data breaches. Do not use this password!`;
      case 'critical':
        return `🔴 CRITICAL: This password has been seen ${countStr} times in data breaches. This is a commonly used password - never use it!`;
      default:
        return `⚠️ This password has been found in data breaches.`;
    }
  }

  /**
   * Get color code for severity
   * @param {string} severity - Severity level
   * @returns {string} - CSS color code
   */
  getSeverityColor(severity) {
    switch (severity) {
      case 'safe': return '#4CAF50'; // Green
      case 'low': return '#FFC107'; // Amber
      case 'medium': return '#FF9800'; // Orange
      case 'high': return '#F44336'; // Red
      case 'critical': return '#B71C1C'; // Dark Red
      default: return '#9E9E9E'; // Gray
    }
  }
}

// Create singleton instance
const hibpService = new HIBPService();

export default hibpService;
export { HIBPService };
