/**
 * @fileoverview Inactivity Manager
 * Tracks user activity and triggers auto-lock after inactivity period.
 *
 * Features:
 * - Listens to global events: mousemove, keydown, click, scroll, focus
 * - Configurable timeout (default 5 minutes)
 * - Throttled event handling to prevent performance issues
 * - Callback-based lock trigger
 * - Persists settings to localStorage
 *
 * @license Apache-2.0
 */

import { safeLog } from './logger.js';
import { SECURITY_TIMEOUTS } from '../config/ui-constants.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'security-auto-lock-timeout';
// Use centralized constant for default (5 minutes)
const DEFAULT_TIMEOUT_MS = SECURITY_TIMEOUTS.AUTO_LOCK_DEFAULT_MS;
const THROTTLE_MS = 1000; // Throttle activity events to 1/second

/**
 * Available timeout options (in seconds)
 */
export const AUTO_LOCK_OPTIONS = Object.freeze([
  { value: 0, label: 'Disabled', ms: 0 },
  { value: 60, label: '1 minute', ms: 60 * 1000 },
  { value: 120, label: '2 minutes', ms: 2 * 60 * 1000 },
  { value: 300, label: '5 minutes', ms: 5 * 60 * 1000 },
  { value: 600, label: '10 minutes', ms: 10 * 60 * 1000 },
  { value: 900, label: '15 minutes', ms: 15 * 60 * 1000 },
  { value: 1800, label: '30 minutes', ms: 30 * 60 * 1000 }
]);

// ============================================================================
// INACTIVITY MANAGER CLASS
// ============================================================================

/**
 * Singleton Inactivity Manager
 * Tracks user activity and triggers lock callback after inactivity
 */
class InactivityManager {
  /** @type {InactivityManager|null} */
  static #instance = null;

  /** @type {number} */
  #timeoutMs = DEFAULT_TIMEOUT_MS;

  /** @type {number|null} */
  #timerId = null;

  /** @type {number} */
  #lastActivity = Date.now();

  /** @type {Function|null} */
  #onLockCallback = null;

  /** @type {Function|null} */
  #onWarningCallback = null;

  /** @type {number|null} */
  #warningTimerId = null;

  /** @type {number} */
  #warningBeforeMs = 60 * 1000; // Warn 60 seconds before lock

  /** @type {boolean} */
  #isActive = false;

  /** @type {boolean} */
  #isPaused = false;

  /** @type {number} */
  #lastThrottledEvent = 0;

  /** @type {AbortController|null} */
  #eventController = null;

  /**
   * Get singleton instance
   * @returns {InactivityManager}
   */
  static getInstance() {
    if (!InactivityManager.#instance) {
      InactivityManager.#instance = new InactivityManager();
    }
    return InactivityManager.#instance;
  }

  constructor() {
    // Prevent direct instantiation
    if (InactivityManager.#instance) {
      return InactivityManager.#instance;
    }
    this.#loadSettings();
  }

  // ==================== CONFIGURATION ====================

  /**
   * Load settings from localStorage
   * @private
   */
  #loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const value = parseInt(stored, 10);
        if (!isNaN(value) && value >= 0) {
          this.#timeoutMs = value * 1000;
        }
      }
    } catch {
      // Use default
    }
  }

  /**
   * Save settings to localStorage
   * @private
   */
  #saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, Math.floor(this.#timeoutMs / 1000).toString());
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get current timeout in seconds
   * @returns {number}
   */
  getTimeout() {
    return Math.floor(this.#timeoutMs / 1000);
  }

  /**
   * Set timeout in seconds
   * @param {number} seconds - Timeout in seconds (0 to disable)
   */
  setTimeout(seconds) {
    this.#timeoutMs = seconds * 1000;
    this.#saveSettings();

    // Restart timer if active
    if (this.#isActive && this.#timeoutMs > 0) {
      this.#restartTimer();
    } else if (this.#timeoutMs === 0) {
      this.#clearTimers();
    }

    safeLog(`[InactivityManager] Timeout set to ${seconds}s`);
  }

  /**
   * Set warning callback (called before lock)
   * @param {Function} callback - Warning callback (receives seconds remaining)
   */
  setWarningCallback(callback) {
    this.#onWarningCallback = callback;
  }

  /**
   * Set warning time before lock
   * @param {number} seconds - Seconds before lock to trigger warning
   */
  setWarningTime(seconds) {
    this.#warningBeforeMs = seconds * 1000;
  }

  // ==================== LIFECYCLE ====================

  /**
   * Start tracking inactivity
   * @param {Function} onLock - Callback when lock should occur
   */
  start(onLock) {
    if (this.#isActive) {
      safeLog('[InactivityManager] Already active');
      return;
    }

    this.#onLockCallback = onLock;
    this.#isActive = true;
    this.#isPaused = false;
    this.#lastActivity = Date.now();

    // Attach global event listeners
    this.#attachEventListeners();

    // Start timer
    if (this.#timeoutMs > 0) {
      this.#restartTimer();
    }

    safeLog(`[InactivityManager] Started with ${this.#timeoutMs / 1000}s timeout`);
  }

  /**
   * Stop tracking inactivity
   */
  stop() {
    if (!this.#isActive) return;

    this.#clearTimers();
    this.#detachEventListeners();
    this.#isActive = false;
    this.#isPaused = false;
    this.#onLockCallback = null;

    safeLog('[InactivityManager] Stopped');
  }

  /**
   * Pause inactivity tracking (e.g., during modal dialogs)
   */
  pause() {
    if (!this.#isActive || this.#isPaused) return;

    this.#isPaused = true;
    this.#clearTimers();
    safeLog('[InactivityManager] Paused');
  }

  /**
   * Resume inactivity tracking
   */
  resume() {
    if (!this.#isActive || !this.#isPaused) return;

    this.#isPaused = false;
    this.recordActivity();
    safeLog('[InactivityManager] Resumed');
  }

  // ==================== ACTIVITY TRACKING ====================

  /**
   * Record user activity (resets timer)
   */
  recordActivity() {
    if (!this.#isActive || this.#isPaused) return;

    // Throttle to prevent excessive timer resets
    const now = Date.now();
    if (now - this.#lastThrottledEvent < THROTTLE_MS) {
      return;
    }
    this.#lastThrottledEvent = now;
    this.#lastActivity = now;

    // Restart timer
    if (this.#timeoutMs > 0) {
      this.#restartTimer();
    }

    // Also notify main process
    if (window.vault?.resetActivity) {
      window.vault.resetActivity();
    }
  }

  /**
   * Get time remaining until lock (in seconds)
   * @returns {number}
   */
  getTimeRemaining() {
    if (!this.#isActive || this.#timeoutMs === 0) {
      return Infinity;
    }
    const elapsed = Date.now() - this.#lastActivity;
    return Math.max(0, Math.floor((this.#timeoutMs - elapsed) / 1000));
  }

  /**
   * Check if currently active
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive && !this.#isPaused;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Attach global event listeners
   * @private
   */
  #attachEventListeners() {
    this.#eventController = new AbortController();
    const signal = this.#eventController.signal;
    const opts = { passive: true, signal };

    // Throttled activity handler
    const handler = () => this.recordActivity();

    // Track various activity types
    document.addEventListener('mousemove', handler, opts);
    document.addEventListener('mousedown', handler, opts);
    document.addEventListener('keydown', handler, opts);
    document.addEventListener('scroll', handler, opts);
    document.addEventListener('touchstart', handler, opts);

    // Window focus also counts as activity
    window.addEventListener('focus', handler, opts);

    // Visibility change - pause when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Don't pause, let timer continue in background
      } else {
        // User returned, record activity
        this.recordActivity();
      }
    }, { signal });
  }

  /**
   * Detach global event listeners
   * @private
   */
  #detachEventListeners() {
    if (this.#eventController) {
      this.#eventController.abort();
      this.#eventController = null;
    }
  }

  /**
   * Restart the inactivity timer
   * @private
   */
  #restartTimer() {
    this.#clearTimers();

    if (this.#timeoutMs <= 0) return;

    // Set main lock timer
    this.#timerId = window.setTimeout(() => {
      this.#triggerLock();
    }, this.#timeoutMs);

    // Set warning timer (if callback is set and there's enough time)
    if (this.#onWarningCallback && this.#timeoutMs > this.#warningBeforeMs) {
      this.#warningTimerId = window.setTimeout(() => {
        const remaining = Math.floor(this.#warningBeforeMs / 1000);
        this.#onWarningCallback(remaining);
      }, this.#timeoutMs - this.#warningBeforeMs);
    }
  }

  /**
   * Clear all timers
   * @private
   */
  #clearTimers() {
    if (this.#timerId) {
      window.clearTimeout(this.#timerId);
      this.#timerId = null;
    }
    if (this.#warningTimerId) {
      window.clearTimeout(this.#warningTimerId);
      this.#warningTimerId = null;
    }
  }

  /**
   * Trigger lock callback
   * @private
   */
  #triggerLock() {
    safeLog('[InactivityManager] Inactivity timeout - triggering lock');

    this.#clearTimers();

    if (this.#onLockCallback) {
      try {
        this.#onLockCallback();
      } catch (error) {
        safeLog('[InactivityManager] Lock callback error:', error);
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get the singleton inactivity manager instance
 * @returns {InactivityManager}
 */
export function getInactivityManager() {
  return InactivityManager.getInstance();
}

/**
 * Initialize inactivity manager with lock callback
 * @param {Function} onLock - Callback when lock should occur
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutSeconds] - Override timeout
 * @param {Function} [options.onWarning] - Warning callback
 * @returns {InactivityManager}
 */
export function initInactivityManager(onLock, options = {}) {
  const manager = getInactivityManager();

  if (options.timeoutSeconds !== undefined) {
    manager.setTimeout(options.timeoutSeconds);
  }

  if (options.onWarning) {
    manager.setWarningCallback(options.onWarning);
  }

  manager.start(onLock);
  return manager;
}

export default InactivityManager;
