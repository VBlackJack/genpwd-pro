/**
 * @fileoverview Auto-Lock Service
 * Manages vault auto-lock timer and countdown display
 */

import { getInactivityManager } from '../../utils/inactivity-manager.js';

const STORAGE_KEY = 'genpwd-vault-autolock-timeout';
const DEFAULT_TIMEOUT = 300; // 5 minutes

/**
 * Create an auto-lock service instance
 * @param {Object} options - Service options
 * @param {Function} options.onLock - Callback when vault should lock
 * @param {Function} options.onWarning - Callback for lock warning
 * @param {Function} options.onCountdownUpdate - Callback with {minutes, seconds, isWarning, isCritical}
 * @returns {Object} Auto-lock service instance
 */
export function createAutoLockService(options = {}) {
  const { onLock, onWarning, onCountdownUpdate } = options;

  let timeout = DEFAULT_TIMEOUT;
  let secondsRemaining = DEFAULT_TIMEOUT;
  let timer = null;
  let warningShown = false;

  /**
   * Load timeout from localStorage
   */
  function loadTimeout() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        timeout = parseInt(saved, 10);
      }
    } catch {
      // Use default
    }
    secondsRemaining = timeout;
  }

  /**
   * Save timeout to localStorage
   * @param {number} value - Timeout in seconds
   */
  function saveTimeout(value) {
    timeout = value;
    secondsRemaining = value;
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Format seconds as MM:SS
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted time
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Update countdown display
   */
  function updateCountdown() {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const isWarning = secondsRemaining <= 60 && secondsRemaining > 30;
    const isCritical = secondsRemaining <= 30;

    onCountdownUpdate?.({
      minutes: mins,
      seconds: secs,
      formatted: formatTime(secondsRemaining),
      isWarning,
      isCritical
    });

    // Show warning at 30 seconds
    if (isCritical && secondsRemaining === 30 && !warningShown) {
      warningShown = true;
      onWarning?.();
    }
  }

  /**
   * Start the auto-lock timer
   */
  function start() {
    loadTimeout();

    const inactivityManager = getInactivityManager();
    inactivityManager.setTimeout(timeout);
    inactivityManager.setWarningCallback(() => {
      onWarning?.();
    });
    inactivityManager.start(() => {
      onLock?.();
    });

    // UI countdown timer
    timer = setInterval(() => {
      const remaining = inactivityManager.getTimeRemaining();
      if (remaining !== Infinity) {
        secondsRemaining = remaining;
      } else {
        secondsRemaining--;
      }
      updateCountdown();
    }, 1000);
  }

  /**
   * Stop the auto-lock timer
   */
  function stop() {
    getInactivityManager().stop();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  /**
   * Reset the auto-lock timer (on user activity)
   */
  function reset() {
    secondsRemaining = timeout;
    warningShown = false;
    getInactivityManager().recordActivity();
  }

  /**
   * Get current timeout value
   * @returns {number} Timeout in seconds
   */
  function getTimeout() {
    return timeout;
  }

  /**
   * Set new timeout value
   * @param {number} value - New timeout in seconds
   */
  function setTimeout(value) {
    saveTimeout(value);
    getInactivityManager().setTimeout(value);
  }

  /**
   * Dismiss the warning (user clicked "Stay")
   */
  function dismissWarning() {
    reset();
  }

  return {
    start,
    stop,
    reset,
    getTimeout,
    setTimeout,
    dismissWarning,
    formatTime
  };
}
