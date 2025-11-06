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

// src/js/config/sentry-config.js - Sentry error tracking configuration

/**
 * Sentry configuration for GenPwd Pro
 *
 * To enable Sentry, you need to:
 * 1. Sign up for Sentry at https://sentry.io
 * 2. Create a new project
 * 3. Get your DSN (Data Source Name)
 * 4. Set SENTRY_DSN environment variable or update the DSN below
 * 5. Install Sentry SDK: npm install @sentry/browser
 */

export const SENTRY_CONFIG = {
  // Set your Sentry DSN here or use environment variable
  dsn: (typeof process !== 'undefined' && process.env?.SENTRY_DSN) || '',

  // Enable/disable Sentry
  enabled: false, // Set to true when DSN is configured

  // Environment (development, staging, production)
  environment: (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development',

  // Release version
  release: 'genpwd-pro@2.5.2',

  // Sample rate for performance monitoring (0.0 to 1.0)
  tracesSampleRate: 0.1,

  // Sample rate for sessions (0.0 to 1.0)
  replaysSessionSampleRate: 0.1,

  // Sample rate for errors (0.0 to 1.0)
  replaysOnErrorSampleRate: 1.0,

  // Integration options
  integrations: {
    // Breadcrumbs for console, DOM, fetch, history, etc.
    breadcrumbs: true,

    // Capture unhandled promise rejections
    globalHandlers: true,

    // HTTP client monitoring
    httpClient: true,

    // Deduplicate identical errors
    dedupe: true,

    // Session replay (requires additional setup)
    replay: false
  },

  // Before send hook - sanitize sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from error messages
    if (event.message) {
      event.message = sanitizeSensitiveData(event.message);
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message) {
          breadcrumb.message = sanitizeSensitiveData(breadcrumb.message);
        }
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(breadcrumb.data);
        }
        return breadcrumb;
      });
    }

    // Sanitize context data
    if (event.contexts) {
      event.contexts = sanitizeObject(event.contexts);
    }

    // Sanitize extra data
    if (event.extra) {
      event.extra = sanitizeObject(event.extra);
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',

    // Random plugins/extensions
    'Can\'t execute code from freed script',

    // Network errors (often not actionable)
    'NetworkError',
    'Network request failed',

    // Script loading errors (often CDN issues)
    'Script error',

    // ResizeObserver loop limit exceeded (benign)
    'ResizeObserver loop limit exceeded'
  ],

  // Deny URLs (don't report errors from these sources)
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,

    // Facebook flakiness
    /graph\.facebook\.com/i,

    // Google Analytics
    /google-analytics\.com/i
  ]
};

/**
 * Sanitize sensitive data from strings
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeSensitiveData(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Replace potential passwords (8+ chars, mixed case, special chars)
  str = str.replace(/[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}/g, '[REDACTED]');

  // Replace email addresses
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Replace potential API keys (alphanumeric strings 20+ chars)
  str = str.replace(/[A-Za-z0-9]{20,}/g, '[API_KEY]');

  // Replace credit card numbers
  str = str.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

  // Replace phone numbers
  str = str.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

  return str;
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys entirely
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('credential')) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Initialize Sentry
 * Note: Requires @sentry/browser package
 */
export async function initSentry() {
  if (!SENTRY_CONFIG.enabled || !SENTRY_CONFIG.dsn) {
    console.log('[Sentry] Not enabled or DSN not configured');
    return false;
  }

  try {
    // Dynamically import Sentry (optional dependency)
    const Sentry = await import('@sentry/browser');

    Sentry.init({
      dsn: SENTRY_CONFIG.dsn,
      environment: SENTRY_CONFIG.environment,
      release: SENTRY_CONFIG.release,
      tracesSampleRate: SENTRY_CONFIG.tracesSampleRate,
      beforeSend: SENTRY_CONFIG.beforeSend,
      ignoreErrors: SENTRY_CONFIG.ignoreErrors,
      denyUrls: SENTRY_CONFIG.denyUrls,

      integrations: [
        new Sentry.BrowserTracing(),
        ...(SENTRY_CONFIG.integrations.replay ? [new Sentry.Replay()] : [])
      ],

      // Session replay options
      replaysSessionSampleRate: SENTRY_CONFIG.replaysSessionSampleRate,
      replaysOnErrorSampleRate: SENTRY_CONFIG.replaysOnErrorSampleRate
    });

    console.log('[Sentry] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
    return false;
  }
}

/**
 * Capture exception manually
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export async function captureException(error, context = {}) {
  if (!SENTRY_CONFIG.enabled) {
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.captureException(error, {
      contexts: sanitizeObject(context)
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture exception:', err);
  }
}

/**
 * Capture message manually
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export async function captureMessage(message, level = 'info', context = {}) {
  if (!SENTRY_CONFIG.enabled) {
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.captureMessage(sanitizeSensitiveData(message), {
      level,
      contexts: sanitizeObject(context)
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture message:', err);
  }
}

/**
 * Add breadcrumb
 * @param {Object} breadcrumb - Breadcrumb object
 */
export async function addBreadcrumb(breadcrumb) {
  if (!SENTRY_CONFIG.enabled) {
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.addBreadcrumb({
      ...breadcrumb,
      message: breadcrumb.message ? sanitizeSensitiveData(breadcrumb.message) : undefined,
      data: breadcrumb.data ? sanitizeObject(breadcrumb.data) : undefined
    });
  } catch (err) {
    console.error('[Sentry] Failed to add breadcrumb:', err);
  }
}

/**
 * Set user context
 * @param {Object} user - User information (will be sanitized)
 */
export async function setUser(user) {
  if (!SENTRY_CONFIG.enabled) {
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.setUser(sanitizeObject(user));
  } catch (err) {
    console.error('[Sentry] Failed to set user:', err);
  }
}

export default {
  config: SENTRY_CONFIG,
  init: initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser
};
