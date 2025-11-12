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
  MODAL_FADE_OUT: 200,

  // Toast notifications
  TOAST_DISPLAY: 3000,
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

  // Generated passwords
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 8,
  MAX_QUANTITY: 50,
  MIN_QUANTITY: 1,

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
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  // Password generation
  MAX_GENERATIONS_PER_SECOND: 10,
  GENERATION_COOLDOWN: 100, // ms between generations

  // Clipboard operations
  MAX_CLIPBOARD_OPS_PER_MINUTE: 60,
  CLIPBOARD_COOLDOWN: 1000, // ms

  // API calls
  MAX_API_CALLS_PER_MINUTE: 100,
  API_RETRY_DELAY: 2000 // ms
};

/**
 * Cache configuration
 */
export const CACHE = {
  // Dictionary cache
  DICTIONARY_TTL: 3600000, // 1 hour in ms
  MAX_CACHED_DICTIONARIES: 5,

  // DOM element cache
  MAX_CACHED_ELEMENTS: 50,
  CACHE_CLEANUP_INTERVAL: 300000 // 5 minutes
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

// Object.freeze all exported objects to prevent mutations
Object.freeze(ANIMATION_DURATION);
Object.freeze(SIZE_LIMITS);
Object.freeze(INTERACTION);
Object.freeze(RATE_LIMIT);
Object.freeze(CACHE);
Object.freeze(A11Y);
Object.freeze(ERROR_HANDLING);
Object.freeze(PERFORMANCE);
Object.freeze(DEBUG);
Object.freeze(ANALYTICS);
