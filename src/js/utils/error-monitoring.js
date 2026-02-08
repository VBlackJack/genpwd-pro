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

// src/js/utils/error-monitoring.js - Error monitoring system

import { isDevelopment } from './environment.js';
import { safeLog } from './logger.js';

/**
 * Error monitoring configuration
 */
const monitoringConfig = {
  enabled: !isDevelopment(),
  maxErrors: 50, // Maximum errors to keep in memory
  // URL of your monitoring service (Sentry, LogRocket, etc.)
  // endpoint: 'https://your-monitoring-service.com/api/errors',
  endpoint: null, // Disabled by default
  apiKey: null
};

/**
 * In-memory error storage
 */
const errorLog = [];

/**
 * Sanitizes sensitive data from an error before sending
 * @param {Error} error - Error to sanitize
 * @returns {Object} Sanitized error
 */
function sanitizeError(error) {
  const sanitized = {
    message: error.message || 'Unknown error',
    stack: error.stack || '',
    name: error.name || 'Error',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    // Remove sensitive parameters from URL
    cleanUrl: window.location.origin + window.location.pathname
  };

  // Remove potentially sensitive information from stack trace
  if (sanitized.stack) {
    sanitized.stack = sanitized.stack
      .split('\n')
      .slice(0, 10) // Limit to 10 lines
      .join('\n');
  }

  return sanitized;
}

/**
 * Logs an error locally
 * @param {Error} error - Error to log
 */
function logErrorLocally(error) {
  const sanitized = sanitizeError(error);

  errorLog.push(sanitized);

  // Keep only the last N errors
  if (errorLog.length > monitoringConfig.maxErrors) {
    errorLog.shift();
  }

  // In development, log to console
  if (isDevelopment()) {
    console.error('Error logged:', sanitized);
  }
}

/**
 * Sends an error to a remote monitoring service
 * @param {Error} error - Error to send
 */
async function sendErrorToMonitoring(error) {
  // Don't send in development
  if (isDevelopment() || !monitoringConfig.enabled || !monitoringConfig.endpoint) {
    return;
  }

  try {
    const sanitized = sanitizeError(error);

    // Example: send to Sentry or similar service
    await fetch(monitoringConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(monitoringConfig.apiKey && { 'Authorization': `Bearer ${monitoringConfig.apiKey}` })
      },
      body: JSON.stringify({
        error: sanitized,
        app: {
          name: 'GenPwd Pro',
          version: '3.1.0', // Synchronized with package.json
          environment: isDevelopment() ? 'development' : 'production'
        }
      })
    });
  } catch (sendError) {
    // On send failure, don't create an infinite loop
    console.warn('Failed to send error to monitoring service:', sendError);
  }
}

/**
 * Handles a global error
 * @param {Error} error - Error to handle
 * @param {Object} context - Additional context
 */
export function reportError(error, context = {}) {
  // Add context to error
  if (context && Object.keys(context).length > 0) {
    error.context = context;
  }

  // Log locally
  logErrorLocally(error);

  // Send to monitoring service (fire-and-forget with minimal logging on failure)
  sendErrorToMonitoring(error).catch((monitoringError) => {
    // Log monitoring failure locally but don't break the app
    try {
      logErrorLocally(new Error(`Monitoring service failed: ${monitoringError.message}`));
    } catch (_e) {
      console.warn('Error monitoring: both remote and local logging failed');
    }
  });
}

/**
 * Configures error monitoring
 * @param {Object} config - Configuration
 * @param {boolean} config.enabled - Enable monitoring
 * @param {string} config.endpoint - Monitoring service URL
 * @param {string} config.apiKey - Service API key
 */
export function configureMonitoring(config) {
  Object.assign(monitoringConfig, config);
}

/**
 * Gets locally logged errors
 * @returns {Array} List of errors
 */
export function getErrorLog() {
  return [...errorLog];
}

/**
 * Clears the local error log
 */
export function clearErrorLog() {
  errorLog.length = 0;
}

/**
 * Initializes the global error monitoring system
 */
export function initErrorMonitoring() {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    const error = new Error(event.message);
    error.stack = event.error?.stack;
    error.filename = event.filename;
    error.lineno = event.lineno;
    error.colno = event.colno;

    reportError(error, {
      type: 'uncaught_error',
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    reportError(error, {
      type: 'unhandled_rejection',
      promise: true
    });

    // Only prevent default in production to avoid hiding errors during development
    if (!isDevelopment()) {
      event.preventDefault();
    }
  });

  safeLog('Error monitoring initialized');
}

/**
 * Wrapper to execute code with error handling
 * @param {Function} fn - Function to execute
 * @param {Object} context - Context for reporting
 * @returns {*} Function result or null on error
 */
export async function withErrorHandling(fn, context = {}) {
  try {
    return await fn();
  } catch (error) {
    reportError(error, context);
    return null;
  }
}

// Export des stats d'erreurs
export const errorStats = {
  get count() {
    return errorLog.length;
  },
  get recent() {
    return errorLog.slice(-5);
  },
  get all() {
    return getErrorLog();
  }
};
