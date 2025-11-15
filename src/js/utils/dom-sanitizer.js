/**
 * DOM Sanitizer - XSS Protection Wrapper for DOMPurify
 *
 * Provides secure HTML sanitization to prevent XSS attacks.
 * Uses DOMPurify library with strict configuration.
 *
 * @module dom-sanitizer
 */

// Conditional DOMPurify loading for browser/Node.js compatibility
let DOMPurify = null;
let importAttempted = false;

/**
 * Lazy load DOMPurify (browser only)
 */
async function ensureDOMPurify() {
  if (importAttempted) {
    return DOMPurify;
  }

  importAttempted = true;

  // Only try to load in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const module = await import('dompurify');
    DOMPurify = module.default || module;
    return DOMPurify;
  } catch (_error) {
    console.warn('[DOM Sanitizer] DOMPurify not available, using fallback');
    return null;
  }
}

// Try to load DOMPurify immediately if in browser
if (typeof window !== 'undefined') {
  ensureDOMPurify().catch(() => {
    // Ignore errors, will use fallback
  });
}

/**
 * Fallback HTML sanitizer for Node.js environment
 * @param {string} html - HTML to sanitize
 * @returns {string} - Sanitized HTML
 */
function fallbackSanitize(html) {
  if (typeof html !== 'string') {
    return '';
  }
  // Basic HTML escaping for test environment
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * @param {string} html - The HTML content to sanitize
 * @param {Object} [options={}] - DOMPurify configuration options
 * @returns {string} - Sanitized HTML safe for innerHTML
 *
 * @example
 * import { sanitizeHTML } from './utils/dom-sanitizer.js';
 *
 * // Basic usage
 * element.innerHTML = sanitizeHTML(userInput);
 *
 * // With custom options
 * element.innerHTML = sanitizeHTML(userInput, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong'] });
 */
export function sanitizeHTML(html, options = {}) {
  if (typeof html !== 'string') {
    console.warn('[DOM Sanitizer] Invalid input type, expected string, got:', typeof html);
    return '';
  }

  // Use fallback if DOMPurify is not available (Node.js environment)
  if (!DOMPurify) {
    return fallbackSanitize(html);
  }

  // Default secure configuration
  const defaultConfig = {
    // Allow only safe tags by default
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'div',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],

    // Allow only safe attributes
    ALLOWED_ATTR: [
      'href', 'title', 'class', 'id', 'target', 'rel',
      'data-*', 'aria-*', 'role'
    ],

    // Allow data attributes
    ALLOW_DATA_ATTR: true,

    // Allow aria attributes for accessibility
    ALLOW_ARIA_ATTR: true,

    // Enforce safe links
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,

    // Keep safe HTML
    KEEP_CONTENT: true,

    // Return a DocumentFragment (safer)
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,

    // Forbid dangerous tags
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],

    // Forbid dangerous attributes
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  };

  // Merge default config with custom options
  const config = { ...defaultConfig, ...options };

  try {
    return DOMPurify.sanitize(html, config);
  } catch (error) {
    console.error('[DOM Sanitizer] Sanitization failed:', error);
    return fallbackSanitize(html);
  }
}

/**
 * Sanitize HTML with minimal allowed tags (text formatting only)
 *
 * @param {string} html - The HTML content to sanitize
 * @returns {string} - Sanitized HTML with only basic text formatting
 *
 * @example
 * import { sanitizeHTMLStrict } from './utils/dom-sanitizer.js';
 * element.innerHTML = sanitizeHTMLStrict(userInput);
 */
export function sanitizeHTMLStrict(html) {
  return sanitizeHTML(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'span'],
    ALLOWED_ATTR: ['class']
  });
}

/**
 * Strip all HTML tags and return plain text
 *
 * @param {string} html - The HTML content to strip
 * @returns {string} - Plain text without HTML tags
 *
 * @example
 * import { stripHTML } from './utils/dom-sanitizer.js';
 * element.textContent = stripHTML(userInput);
 */
export function stripHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }

  if (!DOMPurify) {
    // Fallback: just remove common HTML tags
    return html.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true
  });
}

/**
 * Check if a string contains potentially dangerous HTML
 *
 * @param {string} html - The HTML content to check
 * @returns {boolean} - True if dangerous content is detected
 *
 * @example
 * import { containsDangerousHTML } from './utils/dom-sanitizer.js';
 * if (containsDangerousHTML(userInput)) {
 *   console.warn('Dangerous content detected!');
 * }
 */
export function containsDangerousHTML(html) {
  if (typeof html !== 'string') {
    return false;
  }

  const sanitized = sanitizeHTML(html);
  return html !== sanitized;
}

/**
 * Safe innerHTML setter with automatic sanitization
 *
 * @param {HTMLElement} element - The DOM element
 * @param {string} html - The HTML content to set
 * @param {Object} [options={}] - Sanitization options
 *
 * @example
 * import { safeSetInnerHTML } from './utils/dom-sanitizer.js';
 * safeSetInnerHTML(element, userInput);
 */
export function safeSetInnerHTML(element, html, options = {}) {
  if (!element || !(element instanceof Element)) {
    console.error('[DOM Sanitizer] Invalid element provided');
    return;
  }

  element.innerHTML = sanitizeHTML(html, options);
}

// Export default sanitize function
export default sanitizeHTML;
