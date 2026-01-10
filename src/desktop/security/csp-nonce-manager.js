/*
 * Copyright 2026 Julien Bombled
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

/**
 * CSP Nonce Manager for Electron
 *
 * Implements nonce-based Content Security Policy to replace 'unsafe-inline'
 * for style-src directive. This provides stronger protection against CSS
 * injection attacks while maintaining dynamic styling functionality.
 *
 * How it works:
 * 1. Generate a cryptographically random nonce on each page load
 * 2. Inject the nonce into all inline <style> tags
 * 3. Set CSP header with 'nonce-{value}' instead of 'unsafe-inline'
 *
 * @module csp-nonce-manager
 */

import crypto from 'node:crypto';

/**
 * CSP Nonce Manager
 */
class CSPNonceManager {
  constructor() {
    this.currentNonce = null;
    this.nonceLength = 32; // 256 bits
  }

  /**
   * Generate a new cryptographically secure nonce
   * @returns {string} Base64-encoded nonce
   */
  generateNonce() {
    const buffer = crypto.randomBytes(this.nonceLength);
    this.currentNonce = buffer.toString('base64');
    return this.currentNonce;
  }

  /**
   * Get the current nonce (generates new one if none exists)
   * @returns {string} Current nonce
   */
  getNonce() {
    if (!this.currentNonce) {
      return this.generateNonce();
    }
    return this.currentNonce;
  }

  /**
   * Clear the current nonce (call on page reload)
   */
  clearNonce() {
    this.currentNonce = null;
  }

  /**
   * Build CSP header with nonce
   * @param {Object} options - CSP options
   * @returns {string} Complete CSP header value
   */
  buildCSPHeader(options = {}) {
    const nonce = this.getNonce();

    const directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'wasm-unsafe-eval'"],
      'style-src': ["'self'", `'nonce-${nonce}'`],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': [
        "'self'",
        'https://api.pwnedpasswords.com',
        'https://www.googleapis.com',
        'https://oauth2.googleapis.com',
        'https://accounts.google.com'
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'child-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    };

    // Merge with custom options
    for (const [key, value] of Object.entries(options)) {
      if (directives[key]) {
        directives[key] = [...directives[key], ...value];
      } else {
        directives[key] = value;
      }
    }

    // Build header string
    const parts = [];
    for (const [directive, values] of Object.entries(directives)) {
      if (values.length === 0) {
        parts.push(directive);
      } else {
        parts.push(`${directive} ${values.join(' ')}`);
      }
    }

    return parts.join('; ');
  }

  /**
   * Create CSP meta tag content for HTML injection
   * @returns {string} CSP meta tag
   */
  createMetaTag() {
    const csp = this.buildCSPHeader();
    return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  }

  /**
   * Transform HTML to add nonce to style tags
   * @param {string} html - Original HTML
   * @returns {string} Transformed HTML with nonces
   */
  injectNonceIntoStyles(html) {
    const nonce = this.getNonce();

    // Add nonce to inline <style> tags
    return html.replace(
      /<style(?![^>]*\bnonce=)/gi,
      `<style nonce="${nonce}"`
    );
  }

  /**
   * Get nonce attribute for dynamic style elements
   * @returns {string} Nonce attribute string
   */
  getNonceAttribute() {
    return `nonce="${this.getNonce()}"`;
  }
}

/**
 * Electron session CSP handler
 * Intercepts requests to add CSP headers
 */
class ElectronCSPHandler {
  constructor(session, nonceManager) {
    this.session = session;
    this.nonceManager = nonceManager;
  }

  /**
   * Install CSP header interceptor
   */
  install() {
    // Intercept response headers to add CSP
    this.session.webRequest.onHeadersReceived((details, callback) => {
      // Generate new nonce for each navigation
      if (details.resourceType === 'mainFrame') {
        this.nonceManager.generateNonce();
      }

      const csp = this.nonceManager.buildCSPHeader();

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      });
    });
  }

  /**
   * Remove CSP interceptor
   */
  uninstall() {
    this.session.webRequest.onHeadersReceived(null);
  }
}

// Export singleton and classes
const cspNonceManager = new CSPNonceManager();

export {
  CSPNonceManager,
  ElectronCSPHandler,
  cspNonceManager as default
};
