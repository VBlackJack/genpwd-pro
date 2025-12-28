/**
 * @fileoverview Breach Check Service
 * Check passwords against Have I Been Pwned API
 */

/**
 * Calculate SHA-1 hash of a string
 * @param {string} str - String to hash
 * @returns {Promise<string>} Uppercase hex hash
 */
async function sha1(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Format breach count for display
 * @param {number} count - Breach count
 * @returns {string} Formatted count
 */
export function formatBreachCount(count) {
  if (count >= 1000000) return `${Math.floor(count / 1000000)}M+`;
  if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
  return String(count);
}

/**
 * Create breach check service
 * @param {Object} options
 * @param {Function} options.onProgress - Progress callback (checked, total)
 * @param {Function} options.onComplete - Completion callback (results)
 * @param {Function} options.onError - Error callback
 * @returns {Object} Breach check service
 */
export function createBreachCheckService(options = {}) {
  const { onProgress, onComplete, onError } = options;

  // In-memory cache for session
  const cache = new Map();

  /**
   * Check a single password against HIBP
   * @param {string} password - Password to check
   * @returns {Promise<number>} Breach count (0 if not found)
   */
  async function checkPassword(password) {
    if (!password) return 0;

    const hash = await sha1(password);

    // Check cache first
    if (cache.has(hash)) {
      return cache.get(hash);
    }

    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' }
      });

      if (!response.ok) {
        throw new Error(`HIBP API error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\r\n');

      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix === suffix) {
          const count = parseInt(countStr, 10) || 0;
          cache.set(hash, count);
          return count;
        }
      }

      // Not found in breaches
      cache.set(hash, 0);
      return 0;
    } catch (error) {
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Check multiple entries for breaches
   * @param {Array} entries - Entries to check (must have type, data.password)
   * @returns {Promise<Object>} Results with compromised entries
   */
  async function checkEntries(entries) {
    const logins = entries.filter(e => e.type === 'login' && e.data?.password);
    const compromised = [];
    let checked = 0;
    let newChecks = 0;

    for (const entry of logins) {
      try {
        const hash = await sha1(entry.data.password);

        // Check cache first
        if (cache.has(hash)) {
          const cachedCount = cache.get(hash);
          if (cachedCount > 0) {
            compromised.push({ entry, count: cachedCount });
          }
          checked++;
          if (onProgress) onProgress(checked, logins.length);
          continue;
        }

        // Check against API
        const count = await checkPassword(entry.data.password);
        if (count > 0) {
          compromised.push({ entry, count });
        }
        newChecks++;
        checked++;

        if (onProgress) onProgress(checked, logins.length);

        // Small delay to avoid rate limiting (only for new checks)
        if (newChecks > 0 && checked < logins.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (err) {
        // Continue with other entries on error
        checked++;
        if (onProgress) onProgress(checked, logins.length);
      }
    }

    const results = {
      totalChecked: logins.length,
      compromisedCount: compromised.length,
      compromised,
      checkedAt: Date.now()
    };

    if (onComplete) onComplete(results);
    return results;
  }

  /**
   * Clear the cache
   */
  function clearCache() {
    cache.clear();
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  function getCacheStats() {
    return {
      size: cache.size,
      compromised: Array.from(cache.values()).filter(v => v > 0).length
    };
  }

  return {
    checkPassword,
    checkEntries,
    clearCache,
    getCacheStats,
    formatBreachCount
  };
}

/**
 * Get singleton breach check service
 * @returns {Object} Breach check service instance
 */
let _breachService = null;
export function getBreachCheckService() {
  if (!_breachService) {
    _breachService = createBreachCheckService();
  }
  return _breachService;
}
