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
// src/js/utils/logger.js - Secure logging system with levels

const MAX_LOG_LINES = 100;
const LOG_TRIM_SIZE = 50;

/**
 * Log levels (higher number = more important)
 * @enum {number}
 */
export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

/**
 * Log level labels and colors for display
 */
const LOG_CONFIG = {
  [LOG_LEVEL.DEBUG]: { label: 'DEBUG', color: '#888', console: 'log' },
  [LOG_LEVEL.INFO]: { label: 'INFO', color: '#2196F3', console: 'info' },
  [LOG_LEVEL.WARN]: { label: 'WARN', color: '#FF9800', console: 'warn' },
  [LOG_LEVEL.ERROR]: { label: 'ERROR', color: '#f44336', console: 'error' }
};

/**
 * Detect environment based on various indicators
 * @returns {'development'|'production'}
 */
function detectEnvironment() {
  // Check NODE_ENV if available (for build tools)
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }

  // Check if running on localhost
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'development';
    }
  }

  // Check if minified (production builds are usually minified)
  // This is a heuristic: if function names are preserved, likely dev mode
  const funcStr = detectEnvironment.toString();
  if (funcStr.includes('detectEnvironment') && funcStr.length > 200) {
    return 'development';
  }

  // Default to production for safety
  return 'production';
}

/**
 * Current environment
 */
const ENVIRONMENT = detectEnvironment();

/**
 * Current log level based on environment
 * Development: DEBUG (show all logs)
 * Production: ERROR (show only errors)
 */
let currentLogLevel = ENVIRONMENT === 'production' ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG;

/**
 * Set the minimum log level
 * @param {number} level - Log level from LOG_LEVEL enum
 */
export function setLogLevel(level) {
  if (typeof level === 'number' && level >= LOG_LEVEL.DEBUG && level <= LOG_LEVEL.NONE) {
    currentLogLevel = level;
  }
}

/**
 * Get current log level
 * @returns {number}
 */
export function getLogLevel() {
  return currentLogLevel;
}

/**
 * Format current time
 * @returns {string}
 */
function nowTime() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

/**
 * Internal log function with level support
 * @param {string} msg - Message to log
 * @param {number} level - Log level
 */
function logWithLevel(msg, level = LOG_LEVEL.INFO) {
  // Skip if log level is too low
  if (level < currentLogLevel) {
    return;
  }

  const config = LOG_CONFIG[level];
  if (!config) {
    return;
  }

  // Log to browser console
  const consoleMethod = console[config.console] || console.log;
  consoleMethod(`[${config.label}] ${msg}`);

  // Update UI log display (only in development or for WARN/ERROR)
  if (ENVIRONMENT === 'development' || level >= LOG_LEVEL.WARN) {
    requestAnimationFrame(() => {
      const el = document.getElementById('logs');
      if (!el) return;

      try {
        if (el.textContent.trim() === '[--:--:--] Awaiting initialization...') {
          el.textContent = '';
        }

        const newLine = `[${nowTime()}] [${config.label}] ${msg}\n`;
        el.textContent += newLine;

        const lines = el.textContent.split('\n');
        if (lines.length > MAX_LOG_LINES) {
          el.textContent = lines.slice(-LOG_TRIM_SIZE).join('\n');
          el.textContent = `[${nowTime()}] ...previous logs truncated...\n` + el.textContent;
        }

        el.scrollTop = el.scrollHeight;
      } catch (e) {
        console.error('Error in logWithLevel:', e);
      }
    });
  }
}

/**
 * Log a debug message
 * @param {string} msg - Message to log
 */
export function logDebug(msg) {
  logWithLevel(msg, LOG_LEVEL.DEBUG);
}

/**
 * Log an info message
 * @param {string} msg - Message to log
 */
export function logInfo(msg) {
  logWithLevel(msg, LOG_LEVEL.INFO);
}

/**
 * Log a warning message
 * @param {string} msg - Message to log
 */
export function logWarn(msg) {
  logWithLevel(msg, LOG_LEVEL.WARN);
}

/**
 * Log an error message
 * @param {string} msg - Message to log
 */
export function logError(msg) {
  logWithLevel(msg, LOG_LEVEL.ERROR);
}

/**
 * Generic log function with level parameter
 * @param {string} msg - Message to log
 * @param {number} level - Log level (default: INFO)
 */
export function safeLog(msg, level = LOG_LEVEL.INFO) {
  logWithLevel(msg, level);
}

/**
 * Clear all logs from UI
 */
export function clearLogs() {
  const logsEl = document.getElementById('logs');
  if (logsEl) {
    logsEl.textContent = '';
    safeLog('Logs cleared', LOG_LEVEL.INFO);
  }
}

// Log initialization info
if (ENVIRONMENT === 'development') {
  console.log(`%c[Logger] Environment: ${ENVIRONMENT}, Log Level: ${LOG_CONFIG[currentLogLevel].label}`, 'color: #4CAF50; font-weight: bold;');
}
