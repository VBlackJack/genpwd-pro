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

// src/js/utils/sentry-manager.js - Privacy-Respecting Error Monitoring
// Opt-in error reporting with full data anonymization

import { safeLog } from './logger.js';

/**
 * Sentry Manager - Privacy-First Error Monitoring
 *
 * PRIVACY PRINCIPLES:
 * 1. Opt-in only - requires explicit user consent
 * 2. No PII collection - all data anonymized
 * 3. No passwords or vault content - ever
 * 4. User can disable anytime
 * 5. Clear data retention policy
 *
 * COLLECTED DATA:
 * - Error messages (sanitized)
 * - Stack traces (no file paths with usernames)
 * - App version
 * - OS type (not full version)
 * - Performance metrics (anonymized)
 *
 * NEVER COLLECTED:
 * - Passwords
 * - Vault contents
 * - Personal information
 * - File paths with usernames
 * - IP addresses (anonymized by Sentry)
 */

// Consent storage key
const CONSENT_KEY = 'genpwd_sentry_consent';
const CONSENT_VERSION = '1.0';

// Sensitive data patterns to scrub
const SENSITIVE_PATTERNS = [
  // File paths with usernames
  /\/Users\/[^\/]+\//gi,
  /C:\\Users\\[^\\]+\\/gi,
  /\/home\/[^\/]+\//gi,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  // UUIDs (vault IDs)
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  // Base64 encoded data (potential secrets)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // API keys / tokens
  /[a-zA-Z0-9_-]{32,}/g
];

/**
 * Consent state object
 * @typedef {Object} ConsentState
 * @property {boolean} enabled - Whether monitoring is enabled
 * @property {number} timestamp - When consent was given/revoked
 * @property {string} version - Consent policy version
 */

/**
 * Get current consent state
 * @returns {ConsentState|null}
 */
export function getConsentState() {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Set consent state
 * @param {boolean} enabled - Whether user consents to monitoring
 */
export function setConsent(enabled) {
  const state = {
    enabled,
    timestamp: Date.now(),
    version: CONSENT_VERSION
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  safeLog(`Sentry consent ${enabled ? 'granted' : 'revoked'}`);

  // If disabling, also clear any cached data
  if (!enabled) {
    clearSentryData();
  }
}

/**
 * Check if user has given consent
 * @returns {boolean}
 */
export function hasConsent() {
  const state = getConsentState();
  return state?.enabled === true && state?.version === CONSENT_VERSION;
}

/**
 * Check if consent prompt should be shown
 * (First run or consent version changed)
 * @returns {boolean}
 */
export function shouldShowConsentPrompt() {
  const state = getConsentState();
  // No consent record = first run
  if (!state) return true;
  // Consent version changed = need new consent
  if (state.version !== CONSENT_VERSION) return true;
  return false;
}

/**
 * Scrub sensitive data from string
 * @param {string} input - String to sanitize
 * @returns {string} - Sanitized string
 */
export function scrubSensitiveData(input) {
  if (!input || typeof input !== 'string') return input;

  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Sanitize error object for reporting
 * @param {Error} error - Error to sanitize
 * @returns {Object} - Sanitized error data
 */
export function sanitizeError(error) {
  if (!error) return null;

  return {
    name: error.name || 'Error',
    message: scrubSensitiveData(error.message || 'Unknown error'),
    stack: error.stack ? scrubSensitiveData(error.stack) : null
  };
}

/**
 * Anonymize event before sending to Sentry
 * This is the beforeSend hook for Sentry
 * @param {Object} event - Sentry event
 * @returns {Object|null} - Modified event or null to drop
 */
export function beforeSend(event) {
  // Check consent at send time (user may have revoked)
  if (!hasConsent()) {
    return null;
  }

  // Scrub exception messages
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(exc => ({
      ...exc,
      value: scrubSensitiveData(exc.value),
      stacktrace: exc.stacktrace ? {
        ...exc.stacktrace,
        frames: exc.stacktrace.frames?.map(frame => ({
          ...frame,
          filename: scrubSensitiveData(frame.filename),
          abs_path: scrubSensitiveData(frame.abs_path)
        }))
      } : null
    }));
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(crumb => ({
      ...crumb,
      message: scrubSensitiveData(crumb.message),
      data: crumb.data ? Object.fromEntries(
        Object.entries(crumb.data).map(([k, v]) => [k, scrubSensitiveData(String(v))])
      ) : null
    }));
  }

  // Remove user data
  delete event.user;

  // Remove request data (URLs may contain sensitive info)
  delete event.request;

  // Keep only essential context
  if (event.contexts) {
    event.contexts = {
      os: event.contexts.os ? {
        name: event.contexts.os.name
        // Remove version, build, etc.
      } : null,
      browser: event.contexts.browser ? {
        name: event.contexts.browser.name
      } : null,
      app: event.contexts.app ? {
        app_version: event.contexts.app.app_version
      } : null
    };
  }

  return event;
}

/**
 * Initialize Sentry SDK (if consent given)
 * @param {Object} config - Sentry configuration
 * @returns {boolean} - Whether Sentry was initialized
 */
export async function initSentry(config = {}) {
  if (!hasConsent()) {
    safeLog('Sentry: Not initialized (no consent)');
    return false;
  }

  // Check if Sentry is available (loaded via script tag or bundled)
  if (typeof window.Sentry === 'undefined') {
    safeLog('Sentry: SDK not available');
    return false;
  }

  try {
    window.Sentry.init({
      dsn: config.dsn || '',
      release: config.release || 'genpwd-pro@unknown',
      environment: config.environment || 'production',

      // Performance monitoring (low sample rate)
      tracesSampleRate: 0.1,

      // Error sampling (capture all errors, but anonymized)
      sampleRate: 1.0,

      // Privacy: Anonymize before sending
      beforeSend,

      // Disable session tracking
      autoSessionTracking: false,

      // Disable integrations that collect sensitive data
      integrations: function(integrations) {
        return integrations.filter(integration => {
          // Remove breadcrumb integrations that capture user input
          return integration.name !== 'Breadcrumbs' &&
                 integration.name !== 'HttpClient';
        });
      },

      // Additional privacy settings
      sendDefaultPii: false,
      attachStacktrace: true,

      // Custom tags
      initialScope: {
        tags: {
          'privacy.consent': 'true',
          'privacy.version': CONSENT_VERSION
        }
      }
    });

    safeLog('Sentry: Initialized with privacy protections');
    return true;

  } catch (error) {
    safeLog(`Sentry: Initialization failed: ${error.message}`);
    return false;
  }
}

/**
 * Capture exception (with consent check)
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  if (!hasConsent()) return;
  if (typeof window.Sentry === 'undefined') return;

  try {
    window.Sentry.captureException(error, {
      extra: Object.fromEntries(
        Object.entries(context).map(([k, v]) => [k, scrubSensitiveData(String(v))])
      )
    });
  } catch (err) {
    safeLog(`Sentry: Failed to capture exception: ${err.message}`);
  }
}

/**
 * Capture message (with consent check)
 * @param {string} message - Message to capture
 * @param {string} level - Log level (info, warning, error)
 */
export function captureMessage(message, level = 'info') {
  if (!hasConsent()) return;
  if (typeof window.Sentry === 'undefined') return;

  try {
    window.Sentry.captureMessage(scrubSensitiveData(message), level);
  } catch (err) {
    safeLog(`Sentry: Failed to capture message: ${err.message}`);
  }
}

/**
 * Add breadcrumb (with sanitization)
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  if (!hasConsent()) return;
  if (typeof window.Sentry === 'undefined') return;

  try {
    window.Sentry.addBreadcrumb({
      ...breadcrumb,
      message: scrubSensitiveData(breadcrumb.message)
    });
  } catch (err) {
    // Silently fail
  }
}

/**
 * Clear all Sentry data and disable
 */
export function clearSentryData() {
  if (typeof window.Sentry !== 'undefined') {
    try {
      // Close Sentry client
      window.Sentry.close(2000);
    } catch {
      // Ignore errors
    }
  }
  safeLog('Sentry: Data cleared');
}

/**
 * Get monitoring statistics
 * @returns {Object} - Stats about monitoring
 */
export function getMonitoringStats() {
  const consent = getConsentState();
  return {
    enabled: hasConsent(),
    consentTimestamp: consent?.timestamp || null,
    consentVersion: consent?.version || null,
    sdkAvailable: typeof window.Sentry !== 'undefined'
  };
}

export default {
  initSentry,
  hasConsent,
  setConsent,
  shouldShowConsentPrompt,
  captureException,
  captureMessage,
  addBreadcrumb,
  clearSentryData,
  getMonitoringStats,
  scrubSensitiveData,
  sanitizeError,
  beforeSend
};
