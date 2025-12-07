/**
 * @fileoverview Have I Been Pwned (HIBP) Breach Check
 * Uses k-anonymity model - only sends first 5 chars of SHA-1 hash
 *
 * @version 2.6.7
 */

import { safeLog } from './logger.js';

const HIBP_API_URL = 'https://api.pwnedpasswords.com/range/';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

/**
 * Cache for breach check results
 * @type {Map<string, {count: number, timestamp: number}>}
 */
const breachCache = new Map();

/**
 * Calculate SHA-1 hash of a string
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Uppercase hex SHA-1 hash
 */
async function sha1(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check if a password has been breached using HIBP API
 * Uses k-anonymity: only sends first 5 chars of SHA-1 hash
 *
 * @param {string} password - Password to check
 * @returns {Promise<{breached: boolean, count: number, error?: string}>}
 */
export async function checkPasswordBreach(password) {
  if (!password || typeof password !== 'string') {
    return { breached: false, count: 0, error: 'Invalid password' };
  }

  try {
    // Calculate SHA-1 hash
    const hash = await sha1(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Check cache first
    const cacheKey = hash;
    const cached = breachCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      safeLog(`[BreachCheck] Cache hit for prefix ${prefix}`);
      return { breached: cached.count > 0, count: cached.count };
    }

    // Query HIBP API with prefix only (k-anonymity)
    const response = await fetch(`${HIBP_API_URL}${prefix}`, {
      headers: {
        'Add-Padding': 'true' // Prevent response size analysis
      }
    });

    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }

    const text = await response.text();

    // Parse response - format: SUFFIX:COUNT\r\n
    const lines = text.split('\r\n');
    let breachCount = 0;

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        breachCount = parseInt(countStr, 10) || 0;
        break;
      }
    }

    // Cache result
    breachCache.set(cacheKey, { count: breachCount, timestamp: Date.now() });

    safeLog(`[BreachCheck] Password ${breachCount > 0 ? 'FOUND' : 'not found'} in breaches (${breachCount} times)`);

    return { breached: breachCount > 0, count: breachCount };
  } catch (error) {
    safeLog(`[BreachCheck] Error: ${error.message}`);
    return { breached: false, count: 0, error: error.message };
  }
}

/**
 * Check multiple passwords for breaches
 * @param {string[]} passwords - Array of passwords to check
 * @returns {Promise<Map<string, {breached: boolean, count: number}>>}
 */
export async function checkMultiplePasswords(passwords) {
  const results = new Map();

  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 200; // ms between batches

  for (let i = 0; i < passwords.length; i += BATCH_SIZE) {
    const batch = passwords.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (pwd) => {
        const result = await checkPasswordBreach(pwd);
        return { password: pwd, result };
      })
    );

    for (const { password, result } of batchResults) {
      results.set(password, result);
    }

    // Delay between batches (except last)
    if (i + BATCH_SIZE < passwords.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
}

/**
 * Format breach count for display
 * @param {number} count - Number of times password was seen in breaches
 * @returns {string} Formatted string
 */
export function formatBreachCount(count) {
  if (count === 0) return 'Non compromis';
  if (count < 10) return `Compromis ${count} fois`;
  if (count < 100) return `Compromis ${count}+ fois`;
  if (count < 1000) return `Compromis ${count}+ fois`;
  if (count < 1000000) return `Compromis ${Math.floor(count / 1000)}K+ fois`;
  return `Compromis ${Math.floor(count / 1000000)}M+ fois`;
}

/**
 * Get breach severity level
 * @param {number} count - Number of times password was seen
 * @returns {'safe'|'warning'|'danger'|'critical'}
 */
export function getBreachSeverity(count) {
  if (count === 0) return 'safe';
  if (count < 10) return 'warning';
  if (count < 1000) return 'danger';
  return 'critical';
}

/**
 * Clear the breach check cache
 */
export function clearBreachCache() {
  breachCache.clear();
  safeLog('[BreachCheck] Cache cleared');
}

export default {
  checkPasswordBreach,
  checkMultiplePasswords,
  formatBreachCount,
  getBreachSeverity,
  clearBreachCache
};
