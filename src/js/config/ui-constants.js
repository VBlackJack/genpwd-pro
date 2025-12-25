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

// src/js/config/ui-constants.js - UI timing and interaction constants
// Centralized constants to avoid magic numbers throughout the codebase

/**
 * Animation and transition durations (in milliseconds)
 */
export const ANIMATION_DURATION = {
  // Modal animations
  MODAL_FADE_IN: 10,
  MODAL_FADE_OUT: 300, // Used consistently across modal-manager, vault-ui, etc.

  // Toast notifications
  TOAST_DISPLAY: 3000,
  TOAST_DISPLAY_ERROR: 7000, // Longer display for error messages (7s for readability)
  TOAST_FADE_IN: 150,
  TOAST_FADE_OUT: 300,

  // UI interactions
  DOUBLE_CLICK_DELAY: 250,
  INITIAL_GENERATION_DELAY: 300,
  ANIMATION_END_FALLBACK: 300,

  // Debouncing
  DEBOUNCE_INPUT: 300,
  DEBOUNCE_RESIZE: 250,
  DEBOUNCE_SCROLL: 100,

  // Tooltips
  TOOLTIP_SHOW_DELAY: 500,
  TOOLTIP_HIDE_DELAY: 100
};

/**
 * Size limits and constraints
 */
export const SIZE_LIMITS = {
  // LocalStorage
  MAX_STORAGE_SIZE: 5242880, // 5MB in bytes
  MAX_HISTORY_ITEMS: 100,
  MAX_PRESET_COUNT: 50,

  // Input fields
  MAX_PRESET_NAME_LENGTH: 50,
  MAX_PRESET_DESC_LENGTH: 200,
  MIN_PRESET_NAME_LENGTH: 3,
  MAX_CUSTOM_SPECIALS_LENGTH: 20, // Maximum custom special characters
  MAX_LEET_WORD_LENGTH: 50, // Maximum word length for leet mode

  // Generated passwords
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 8,
  // Note: MAX_QUANTITY and MIN_QUANTITY for generation limits are in constants.js (LIMITS object)
  // Import from constants.js instead of duplicating here

  // Dictionary words
  MAX_DICTIONARY_WORD_LENGTH: 12,
  MIN_DICTIONARY_WORD_LENGTH: 3
};

/**
 * UI interaction thresholds
 */
export const INTERACTION = {
  // Click detection
  MAX_CLICK_DURATION: 200, // ms - distinguish click from drag
  MIN_DOUBLE_CLICK_INTERVAL: 100, // ms
  MAX_DOUBLE_CLICK_INTERVAL: 500, // ms

  // Scrolling
  SCROLL_THRESHOLD: 50, // px - minimum scroll to trigger actions

  // Touch interactions
  TOUCH_SLOP: 10, // px - ignore touches that move less than this
  LONG_PRESS_DURATION: 500 // ms
};

/**
 * Security timeouts (centralized to ensure consistency)
 * NOTE: Use single source of truth (MS values). Compute seconds/minutes: value / 1000 or value / 60000
 */
export const SECURITY_TIMEOUTS = {
  // Clipboard auto-clear options (in ms)
  CLIPBOARD_TTL_MS: 30000, // Default: 30 seconds
  CLIPBOARD_TTL_OPTIONS: [15000, 30000, 60000, 120000], // 15s, 30s, 1min, 2min

  // Vault auto-lock (5 minutes = 300 seconds)
  AUTO_LOCK_DEFAULT_MS: 300000,

  // Sync interval (5 minutes)
  SYNC_INTERVAL_MS: 300000,

  // Inactivity warning (1 minute before lock)
  INACTIVITY_WARNING_MS: 60000,

  // Security lockout
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 300000 // 5 minutes after max failed attempts
};

/**
 * TOTP defaults (RFC 6238)
 */
export const TOTP_DEFAULTS = {
  PERIOD: 30, // seconds
  DIGITS: 6,
  ALGORITHM: 'SHA1'
};

/**
 * Cache configuration (unified from crypto-constants.js + ui-constants.js)
 */
export const CACHE = {
  // Dictionary cache
  DICTIONARY_TTL: 3600000, // 1 hour in ms
  MAX_CACHED_DICTIONARIES: 5,

  // DOM element cache
  MAX_CACHED_ELEMENTS: 50,
  CACHE_CLEANUP_INTERVAL: 300000, // 5 minutes

  // HIBP breach cache (merged from crypto-constants.js)
  HIBP_TTL: 3600000, // 1 hour

  // General default TTL
  DEFAULT_TTL: 3600000 // 1 hour
};

/**
 * Accessibility constants
 */
export const A11Y = {
  // Focus management
  FOCUS_VISIBLE_TIMEOUT: 100, // ms
  FOCUS_TRAP_CYCLE_DELAY: 50, // ms

  // Announcements
  ANNOUNCE_DEBOUNCE: 500, // ms

  // Keyboard navigation
  KEYBOARD_REPEAT_DELAY: 500, // ms
  KEYBOARD_REPEAT_RATE: 50 // ms
};

/**
 * Error handling configuration
 */
export const ERROR_HANDLING = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000, // ms - exponential backoff base
  RETRY_MAX_DELAY: 10000, // ms

  // Timeout configuration
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  FETCH_TIMEOUT: 10000, // 10 seconds
  API_TIMEOUT: 15000 // 15 seconds
};

/**
 * Performance thresholds
 */
export const PERFORMANCE = {
  // Monitoring
  SLOW_OPERATION_THRESHOLD: 1000, // ms - log if operation takes longer
  MEMORY_WARNING_THRESHOLD: 50000000, // 50MB

  // Optimization
  VIRTUAL_SCROLL_BUFFER: 10, // items
  LAZY_LOAD_THRESHOLD: 300, // px from viewport

  // Batching
  MAX_BATCH_SIZE: 100,
  BATCH_DELAY: 50 // ms
};

/**
 * Development and debugging
 */
export const DEBUG = {
  // Logging
  LOG_THROTTLE: 1000, // ms - throttle similar log messages
  MAX_LOG_BUFFER_SIZE: 1000,

  // Testing
  TEST_TIMEOUT: 5000, // ms

  // Mock delays (for testing loading states)
  MOCK_API_DELAY: 500 // ms
};

/**
 * Analytics configuration constants
 */
export const ANALYTICS = {
  // Event batching
  BATCH_INTERVAL: 5000, // ms - flush events every 5 seconds
  BATCH_SIZE: 10, // events - flush when queue reaches this size

  // Network
  REQUEST_TIMEOUT: 10000 // ms - analytics request timeout
};

/**
 * Time conversion constants (avoid magic numbers for time calculations)
 */
export const TIME_UNITS = {
  // Milliseconds per time unit
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60000,
  MS_PER_HOUR: 3600000,
  MS_PER_DAY: 86400000,

  // Password age thresholds (in days)
  PASSWORD_RENEWAL_DAYS: 365,    // Consider password old after 1 year
  PASSWORD_WARNING_DAYS: 180,    // Show warning after 6 months
  PASSWORD_ATTENTION_DAYS: 90,   // Needs attention after 3 months

  // File size units
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1048576  // 1024 * 1024
};

// Object.freeze all exported objects to prevent mutations
Object.freeze(ANIMATION_DURATION);
Object.freeze(SIZE_LIMITS);
Object.freeze(INTERACTION);
Object.freeze(SECURITY_TIMEOUTS);
Object.freeze(TOTP_DEFAULTS);
Object.freeze(CACHE);
Object.freeze(A11Y);
Object.freeze(ERROR_HANDLING);
Object.freeze(PERFORMANCE);
Object.freeze(DEBUG);
Object.freeze(ANALYTICS);
Object.freeze(TIME_UNITS);
