/**
 * @fileoverview Rate Limiter for Security-Critical Operations
 * Implements exponential backoff for failed authentication attempts
 *
 * SECURITY: Prevents brute-force attacks on password verification
 *
 * Configuration:
 * - 3 attempts: 1 second delay
 * - 5 attempts: 30 second delay
 * - 10 attempts: 5 minute lockout
 * - 15+ attempts: 15 minute lockout
 */

import { safeLog } from './logger.js';

/**
 * Default rate limiting configuration
 */
const DEFAULT_CONFIG = {
  // Thresholds and delays (in milliseconds)
  thresholds: [
    { attempts: 3, delayMs: 1000 },        // 1 second after 3 attempts
    { attempts: 5, delayMs: 30000 },       // 30 seconds after 5 attempts
    { attempts: 10, delayMs: 300000 },     // 5 minutes after 10 attempts
    { attempts: 15, delayMs: 900000 }      // 15 minutes after 15+ attempts
  ],
  // Reset attempts after successful authentication
  resetOnSuccess: true,
  // Reset attempts after this duration of no attempts (30 minutes)
  resetAfterMs: 30 * 60 * 1000,
  // Maximum stored entries (prevent memory exhaustion)
  maxEntries: 100
};

/**
 * Rate limiter instance for tracking failed attempts
 */
class RateLimiter {
  #attempts = new Map();
  #config;

  constructor(config = {}) {
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an operation is allowed for the given identifier
   * @param {string} identifier - Unique identifier (e.g., vaultId, 'global')
   * @returns {{ allowed: boolean, delayMs: number, remainingMs: number, attempts: number }}
   */
  check(identifier) {
    this.#cleanup();

    const entry = this.#attempts.get(identifier);

    if (!entry) {
      return { allowed: true, delayMs: 0, remainingMs: 0, attempts: 0 };
    }

    const now = Date.now();

    // Check if reset period has passed
    if (now - entry.lastAttempt > this.#config.resetAfterMs) {
      this.#attempts.delete(identifier);
      return { allowed: true, delayMs: 0, remainingMs: 0, attempts: 0 };
    }

    // Check if currently locked out
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const remainingMs = entry.lockedUntil - now;
      return {
        allowed: false,
        delayMs: entry.currentDelay,
        remainingMs,
        attempts: entry.count
      };
    }

    // Allowed, return current state
    return {
      allowed: true,
      delayMs: 0,
      remainingMs: 0,
      attempts: entry.count
    };
  }

  /**
   * Record a failed attempt
   * @param {string} identifier - Unique identifier
   * @returns {{ delayMs: number, attempts: number, lockedUntil: number | null }}
   */
  recordFailure(identifier) {
    this.#cleanup();

    const now = Date.now();
    let entry = this.#attempts.get(identifier);

    if (!entry) {
      entry = {
        count: 0,
        lastAttempt: now,
        lockedUntil: null,
        currentDelay: 0
      };
    }

    // Reset if enough time has passed
    if (now - entry.lastAttempt > this.#config.resetAfterMs) {
      entry.count = 0;
      entry.lockedUntil = null;
      entry.currentDelay = 0;
    }

    entry.count++;
    entry.lastAttempt = now;

    // Determine delay based on thresholds
    let delay = 0;
    for (const threshold of this.#config.thresholds) {
      if (entry.count >= threshold.attempts) {
        delay = threshold.delayMs;
      }
    }

    if (delay > 0) {
      entry.lockedUntil = now + delay;
      entry.currentDelay = delay;
    }

    this.#attempts.set(identifier, entry);

    safeLog(`[RateLimiter] Failed attempt ${entry.count} for ${identifier}, delay: ${delay}ms`);

    return {
      delayMs: delay,
      attempts: entry.count,
      lockedUntil: entry.lockedUntil
    };
  }

  /**
   * Record a successful attempt (resets counter)
   * @param {string} identifier - Unique identifier
   */
  recordSuccess(identifier) {
    if (this.#config.resetOnSuccess) {
      this.#attempts.delete(identifier);
      safeLog(`[RateLimiter] Success for ${identifier}, counter reset`);
    }
  }

  /**
   * Get current state for an identifier
   * @param {string} identifier - Unique identifier
   * @returns {{ attempts: number, lockedUntil: number | null, lastAttempt: number | null }}
   */
  getState(identifier) {
    const entry = this.#attempts.get(identifier);
    if (!entry) {
      return { attempts: 0, lockedUntil: null, lastAttempt: null };
    }
    return {
      attempts: entry.count,
      lockedUntil: entry.lockedUntil,
      lastAttempt: entry.lastAttempt
    };
  }

  /**
   * Reset all rate limiting state
   */
  reset() {
    this.#attempts.clear();
    safeLog('[RateLimiter] All rate limits reset');
  }

  /**
   * Reset rate limiting for a specific identifier
   * @param {string} identifier - Unique identifier
   */
  resetFor(identifier) {
    this.#attempts.delete(identifier);
  }

  /**
   * Cleanup old entries to prevent memory exhaustion
   */
  #cleanup() {
    if (this.#attempts.size <= this.#config.maxEntries) {
      return;
    }

    const now = Date.now();
    const toDelete = [];

    for (const [id, entry] of this.#attempts) {
      if (now - entry.lastAttempt > this.#config.resetAfterMs) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.#attempts.delete(id);
    }

    // If still too many, remove oldest entries
    if (this.#attempts.size > this.#config.maxEntries) {
      const sorted = [...this.#attempts.entries()]
        .sort((a, b) => a[1].lastAttempt - b[1].lastAttempt);

      const removeCount = this.#attempts.size - this.#config.maxEntries;
      for (let i = 0; i < removeCount; i++) {
        this.#attempts.delete(sorted[i][0]);
      }
    }
  }
}

// Singleton instance for password attempts
let passwordRateLimiter = null;

/**
 * Get the singleton password rate limiter
 * @returns {RateLimiter}
 */
export function getPasswordRateLimiter() {
  if (!passwordRateLimiter) {
    passwordRateLimiter = new RateLimiter();
  }
  return passwordRateLimiter;
}

/**
 * Format remaining lockout time for display
 * @param {number} remainingMs - Remaining milliseconds
 * @returns {string} Formatted time string
 */
export function formatLockoutTime(remainingMs) {
  if (remainingMs <= 0) return '';

  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

export { RateLimiter };
export default RateLimiter;
