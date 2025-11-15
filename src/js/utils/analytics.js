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

// src/js/utils/analytics.js - Privacy-friendly analytics

import { safeLog } from './logger.js';
import { safeGetItem, safeSetItem } from './storage-helper.js';
import { ANALYTICS } from '../config/ui-constants.js';

/**
 * Privacy-friendly analytics configuration
 *
 * Supports:
 * - Plausible Analytics (https://plausible.io)
 * - Umami Analytics (https://umami.is)
 * - Custom endpoint
 *
 * Features:
 * - No cookies
 * - No personal data
 * - GDPR compliant
 * - User opt-out support
 */

const ANALYTICS_CONFIG = {
  // Analytics provider: 'plausible', 'umami', 'custom', or 'none'
  provider: 'none',

  // Plausible configuration
  plausible: {
    domain: 'genpwd.app', // Your domain
    apiHost: 'https://plausible.io', // Or self-hosted instance
    trackLocalhost: false
  },

  // Umami configuration
  umami: {
    websiteId: '', // Your website ID from Umami
    apiHost: 'https://analytics.umami.is', // Or self-hosted instance
    trackLocalhost: false
  },

  // Custom endpoint configuration
  custom: {
    endpoint: '', // Your custom analytics endpoint
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },

  // User consent (GDPR)
  requireConsent: true,
  consentStorageKey: 'genpwd_analytics_consent',

  // Event batching
  batchEvents: true,
  batchSize: ANALYTICS.BATCH_SIZE,
  batchInterval: ANALYTICS.BATCH_INTERVAL,

  // Debug mode
  debug: false
};

class Analytics {
  constructor(config = {}) {
    this.config = { ...ANALYTICS_CONFIG, ...config };
    this.eventQueue = [];
    this.batchTimer = null;
    this.consent = this.loadConsent();

    if (this.config.provider !== 'none' && this.hasConsent()) {
      this.init();
    }
  }

  /**
   * Initialize analytics
   */
  init() {
    safeLog('[Analytics] Initializing...');

    switch (this.config.provider) {
      case 'plausible':
        this.initPlausible();
        break;
      case 'umami':
        this.initUmami();
        break;
      case 'custom':
        this.initCustom();
        break;
      default:
        safeLog('[Analytics] No provider configured');
    }

    // Start batch timer if enabled
    if (this.config.batchEvents) {
      this.startBatchTimer();
    }
  }

  /**
   * Initialize Plausible Analytics
   */
  initPlausible() {
    if (!this.config.plausible.domain) {
      safeLog('[Analytics] Plausible domain not configured');
      return;
    }

    // Don't track localhost unless explicitly enabled
    if (!this.config.plausible.trackLocalhost && this.isLocalhost()) {
      safeLog('[Analytics] Skipping Plausible on localhost');
      return;
    }

    // Load Plausible script
    const script = document.createElement('script');
    script.defer = true;
    script.dataset.domain = this.config.plausible.domain;
    script.src = `${this.config.plausible.apiHost}/js/script.js`;
    document.head.appendChild(script);

    safeLog('[Analytics] Plausible initialized');
  }

  /**
   * Initialize Umami Analytics
   */
  initUmami() {
    if (!this.config.umami.websiteId) {
      safeLog('[Analytics] Umami website ID not configured');
      return;
    }

    // Don't track localhost unless explicitly enabled
    if (!this.config.umami.trackLocalhost && this.isLocalhost()) {
      safeLog('[Analytics] Skipping Umami on localhost');
      return;
    }

    // Load Umami script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = this.config.umami.websiteId;
    script.src = `${this.config.umami.apiHost}/script.js`;
    document.head.appendChild(script);

    safeLog('[Analytics] Umami initialized');
  }

  /**
   * Initialize custom analytics
   */
  initCustom() {
    if (!this.config.custom.endpoint) {
      safeLog('[Analytics] Custom endpoint not configured');
      return;
    }

    safeLog('[Analytics] Custom analytics initialized');
  }

  /**
   * Check if running on localhost
   */
  isLocalhost() {
    return location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1' ||
           location.hostname === '';
  }

  /**
   * Load consent from storage
   */
  loadConsent() {
    if (!this.config.requireConsent) {
      return true;
    }

    try {
      const stored = safeGetItem(this.config.consentStorageKey);
      return stored === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has given consent
   */
  hasConsent() {
    return this.consent === true || !this.config.requireConsent;
  }

  /**
   * Set user consent
   */
  setConsent(granted) {
    this.consent = granted;

    try {
      safeSetItem(this.config.consentStorageKey, String(granted));
    } catch (error) {
      safeLog('[Analytics] Failed to save consent:', error);
    }

    if (granted && this.config.provider !== 'none') {
      this.init();
    }
  }

  /**
   * Track page view
   */
  trackPageView(url = null, options = {}) {
    if (!this.hasConsent()) {
      return;
    }

    const pageUrl = url || window.location.pathname;

    const event = {
      type: 'pageview',
      url: pageUrl,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      ...options
    };

    this.sendEvent(event);
  }

  /**
   * Track custom event
   */
  trackEvent(eventName, properties = {}) {
    if (!this.hasConsent()) {
      return;
    }

    const event = {
      type: 'event',
      name: eventName,
      properties: this.sanitizeProperties(properties),
      url: window.location.pathname,
      timestamp: new Date().toISOString()
    };

    this.sendEvent(event);
  }

  /**
   * Sanitize event properties (remove sensitive data)
   */
  sanitizeProperties(properties) {
    const sanitized = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip sensitive keys
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('key')) {
        continue;
      }

      // Only allow primitive types
      if (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Send event
   */
  sendEvent(event) {
    if (this.config.debug) {
      console.log('[Analytics] Event:', event);
    }

    if (this.config.batchEvents) {
      // SECURITY: Prevent unbounded queue growth - max 1000 events
      const MAX_QUEUE_SIZE = 1000;
      if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
        // FIFO: Remove oldest event when queue is full
        this.eventQueue.shift();
        safeLog('[Analytics] Queue full, dropped oldest event');
      }

      this.eventQueue.push(event);

      if (this.eventQueue.length >= this.config.batchSize) {
        this.flushEvents();
      }
    } else {
      this.sendEventNow(event);
    }
  }

  /**
   * Send event immediately
   */
  async sendEventNow(event) {
    switch (this.config.provider) {
      case 'plausible':
        this.sendToPlausible(event);
        break;
      case 'umami':
        this.sendToUmami(event);
        break;
      case 'custom':
        await this.sendToCustom(event);
        break;
    }
  }

  /**
   * Send event to Plausible
   */
  sendToPlausible(event) {
    if (typeof window.plausible !== 'function') {
      return;
    }

    if (event.type === 'pageview') {
      window.plausible('pageview');
    } else if (event.type === 'event') {
      window.plausible(event.name, { props: event.properties });
    }
  }

  /**
   * Send event to Umami
   */
  sendToUmami(event) {
    if (typeof window.umami !== 'object') {
      return;
    }

    if (event.type === 'pageview') {
      window.umami.track();
    } else if (event.type === 'event') {
      window.umami.track(event.name, event.properties);
    }
  }

  /**
   * Send event to custom endpoint
   */
  async sendToCustom(event) {
    try {
      await fetch(this.config.custom.endpoint, {
        method: this.config.custom.method,
        headers: this.config.custom.headers,
        body: JSON.stringify(event)
      });
    } catch (error) {
      safeLog('[Analytics] Failed to send event:', error);
    }
  }

  /**
   * Start batch timer
   */
  startBatchTimer() {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushEvents();
      }
    }, this.config.batchInterval);
  }

  /**
   * Flush queued events
   */
  flushEvents() {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      this.sendEventNow(event);
    }

    if (this.config.debug) {
      console.log(`[Analytics] Flushed ${events.length} events`);
    }
  }

  /**
   * Stop analytics
   */
  stop() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.flushEvents();
  }
}

// Create singleton instance
const analytics = new Analytics();

// Expose for debugging
if (typeof window !== 'undefined') {
  window.genpwdAnalytics = analytics;
}

export { analytics, Analytics, ANALYTICS_CONFIG };
export default analytics;

/**
 * Convenience functions
 */
export const trackPageView = (url, options) => analytics.trackPageView(url, options);
export const trackEvent = (name, properties) => analytics.trackEvent(name, properties);
export const setAnalyticsConsent = (granted) => analytics.setConsent(granted);
