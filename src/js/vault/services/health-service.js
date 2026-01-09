/**
 * @fileoverview Health Service
 * Password health analysis and breach checking
 */

import { t } from '../../utils/i18n.js';
import { safeLog } from '../../utils/logger.js';
import { getPasswordStrength, getPasswordAgeDays, getExpiryStatus } from '../utils/password-utils.js';

/**
 * Calculate SHA-1 hash of text
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Uppercase hex hash
 */
export async function sha1(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Format breach count for display
 * @param {number} count - Number of breaches
 * @returns {string} Formatted string
 */
export function formatBreachCount(count) {
  if (count < 10) return t('vault.health.breachTimes', { count });
  if (count < 1000) return t('vault.health.breachTimesPlus', { count });
  if (count < 1000000) return t('vault.health.breachTimesK', { count: Math.floor(count / 1000) });
  return t('vault.health.breachTimesM', { count: Math.floor(count / 1000000) });
}

/**
 * Calculate health statistics for entries
 * @param {Array} entries - All vault entries
 * @returns {Object} Health statistics
 */
export function calculateHealthStats(entries) {
  const logins = entries.filter(e => e.type === 'login' && e.data?.password);
  const total = logins.length;

  if (total === 0) {
    return {
      score: 100,
      scoreClass: 'excellent',
      status: t('vault.health.noLogins'),
      total: 0,
      strong: 0,
      weak: 0,
      reused: 0,
      old: 0,
      expired: 0,
      expiring: 0,
      issues: []
    };
  }

  // Count by strength
  let strong = 0, weak = 0;
  logins.forEach(entry => {
    const strength = getPasswordStrength(entry.data.password);
    if (strength === 'strong') strong++;
    else if (strength !== 'medium') weak++;
  });

  // Count reused passwords
  const passwordCounts = {};
  logins.forEach(entry => {
    const pwd = entry.data.password;
    passwordCounts[pwd] = (passwordCounts[pwd] || 0) + 1;
  });
  const reused = logins.filter(e => passwordCounts[e.data.password] > 1).length;

  // Count old passwords (by age) and expiring passwords (by expiresAt date)
  let old = 0, expired = 0, expiring = 0;
  logins.forEach(entry => {
    // Check expiration date first
    const expiryStatus = getExpiryStatus(entry);
    if (expiryStatus.status === 'expired') {
      expired++;
    } else if (['today', 'soon', 'warning'].includes(expiryStatus.status)) {
      expiring++;
    }

    // Also check by password age
    const days = getPasswordAgeDays(entry.modifiedAt);
    if (days > 180) old++;
  });

  // Calculate score
  let score = 100;
  if (total > 0) {
    score -= (weak / total) * 40;
    score -= (reused / total) * 25;
    score -= (expired / total) * 20;
    score -= (expiring / total) * 10;
    score -= (old / total) * 5;
  }
  score = Math.max(0, Math.round(score));

  // Determine status
  let status, scoreClass;
  if (score >= 90) {
    status = t('vault.health.excellent');
    scoreClass = 'excellent';
  } else if (score >= 70) {
    status = t('vault.health.good');
    scoreClass = 'good';
  } else if (score >= 50) {
    status = t('vault.health.needsImprovement');
    scoreClass = 'medium';
  } else {
    status = t('vault.health.critical');
    scoreClass = 'poor';
  }

  // Build issues list
  const issues = [];
  if (weak > 0) {
    issues.push({
      severity: 'high',
      icon: '⚠️',
      iconLabel: t('vault.health.iconWarning'),
      message: t('vault.health.weakPasswords', { count: weak }),
      count: weak,
      type: 'weak'
    });
  }
  if (reused > 0) {
    issues.push({
      severity: 'high',
      icon: '🔁',
      iconLabel: t('vault.health.iconReused'),
      message: t('vault.health.reusedPasswords', { count: reused }),
      count: reused,
      type: 'reused'
    });
  }
  if (expired > 0) {
    issues.push({
      severity: 'high',
      icon: '⚠️',
      iconLabel: t('vault.health.iconExpired'),
      message: t('vault.health.expiredPasswords', { count: expired }),
      count: expired,
      type: 'expired'
    });
  }
  if (expiring > 0) {
    issues.push({
      severity: 'medium',
      icon: '⏰',
      iconLabel: t('vault.health.iconExpiring'),
      message: t('vault.health.expiringPasswords', { count: expiring }),
      count: expiring,
      type: 'expiring'
    });
  }
  if (old > 0) {
    issues.push({
      severity: 'low',
      icon: '📅',
      iconLabel: t('vault.health.iconOld'),
      message: t('vault.health.oldPasswords', { count: old }),
      count: old,
      type: 'old'
    });
  }

  return { score, scoreClass, status, total, strong, weak, reused, old, expired, expiring, issues };
}

/**
 * Check a single password against HIBP API
 * @param {string} password - Password to check
 * @param {Map} cache - Cache map (hash -> count)
 * @returns {Promise<number>} Breach count (0 if not found)
 */
export async function checkPasswordBreach(password, cache) {
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

    if (response.ok) {
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

      // Not found in breach database
      cache.set(hash, 0);
      return 0;
    }
  } catch (err) {
    // Network error - don't cache
    throw err;
  }

  return 0;
}

/**
 * Check all entries for breaches
 * @param {Array} entries - Entries to check
 * @param {Map} cache - Cache map
 * @param {Object} options - Options
 * @param {Function} [options.onProgress] - Progress callback (checked, total)
 * @param {number} [options.delay=100] - Delay between API calls (ms)
 * @returns {Promise<Array>} Array of {entry, count} for compromised entries
 */
export async function checkAllBreaches(entries, cache, options = {}) {
  const { onProgress, delay = 100 } = options;

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

      // Call API
      const count = await checkPasswordBreach(entry.data.password, cache);
      if (count > 0) {
        compromised.push({ entry, count });
      }
      newChecks++;
    } catch (err) {
      // Log but continue
      safeLog(`Breach check error for ${entry.id}: ${err.message}`);
    }

    checked++;
    if (onProgress) onProgress(checked, logins.length);

    // Rate limiting delay (only for new API calls)
    if (newChecks > 0 && checked < logins.length) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return compromised;
}

/**
 * Get breach count for an entry from cache
 * @param {Object} entry - Entry to check
 * @param {Map} cache - Cache map
 * @returns {Promise<number>} Breach count or 0
 */
export async function getBreachCount(entry, cache) {
  if (entry.type !== 'login' || !entry.data?.password) return 0;
  const hash = await sha1(entry.data.password);
  return cache.get(hash) || 0;
}

/**
 * Check if entry password is in breach cache
 * @param {Object} entry - Entry to check
 * @param {Map} cache - Cache map
 * @returns {Promise<boolean>} True if breached
 */
export async function isPasswordBreached(entry, cache) {
  const count = await getBreachCount(entry, cache);
  return count > 0;
}
