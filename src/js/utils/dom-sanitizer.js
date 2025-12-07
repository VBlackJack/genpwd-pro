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
 * Fallback HTML sanitizer when DOMPurify is not available
 * SECURITY: Always escape HTML to prevent XSS - regex filtering is NOT safe
 * @param {string} html - HTML to sanitize
 * @returns {string} - Escaped HTML (safe but no formatting preserved)
 */
function fallbackSanitize(html) {
  if (typeof html !== 'string') {
    return '';
  }

  // SECURITY FIX: Always escape HTML regardless of environment
  // Regex-based filtering can be bypassed with:
  // - <img src=x onerror=alert(1)>
  // - <svg/onload=alert(1)>
  // - Various encoding attacks
  // The only safe fallback is full HTML escaping
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Use browser's built-in DOM parser for safer sanitization
 * Only allows specific safe tags when DOMPurify unavailable
 * @param {string} html - HTML to sanitize
 * @param {string[]} allowedTags - List of allowed tag names
 * @returns {string} - Sanitized HTML
 */
function fallbackSanitizeWithDOM(html, allowedTags = ['b', 'i', 'em', 'strong', 'u', 'br', 'span', 'p']) {
  if (typeof html !== 'string' || typeof document === 'undefined') {
    return fallbackSanitize(html);
  }

  try {
    // Parse HTML using browser's DOM parser (safer than regex)
    const template = document.createElement('template');
    template.innerHTML = html;
    const doc = template.content;

    // Remove dangerous elements (form allowed for UI components)
    doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(el => el.remove());

    // Remove all event handlers and dangerous attributes
    doc.querySelectorAll('*').forEach(el => {
      // Check if tag is allowed
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        // Replace with text content
        el.replaceWith(document.createTextNode(el.textContent || ''));
        return;
      }

      // Remove all attributes except safe ones
      const safeAttrs = [
        'class', 'id', 'href', 'title', 'target', 'rel',
        // Form attributes
        'type', 'name', 'value', 'placeholder', 'for', 'disabled', 'readonly',
        'required', 'checked', 'selected', 'maxlength', 'minlength', 'rows', 'cols',
        // SVG attributes
        'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
        'width', 'height', 'points', 'transform',
        // Image attributes
        'src', 'alt', 'loading'
      ];
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        // Remove event handlers and dangerous attributes
        if (name.startsWith('on') ||
            name === 'style' ||
            name === 'srcset' ||
            (name === 'href' && attr.value.toLowerCase().includes('javascript:'))) {
          el.removeAttribute(attr.name);
        } else if (!safeAttrs.includes(name) && !name.startsWith('data-') && !name.startsWith('aria-')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML;
  } catch (error) {
    // If DOM parsing fails, fall back to full escaping
    console.warn('[DOM Sanitizer] DOM-based fallback failed, using escape:', error);
    return fallbackSanitize(html);
  }
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

  // Use fallback if DOMPurify is not available
  if (!DOMPurify) {
    // In browser context, use DOM-based sanitization (safer than regex)
    if (typeof document !== 'undefined') {
      const allowedTags = options.ALLOWED_TAGS || [
        'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'div',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'code', 'pre', 'blockquote',
        'button', 'select', 'option', 'label', 'input', 'textarea',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'svg', 'path', 'line', 'circle', 'polyline', 'rect',
        'details', 'summary', 'section', 'header', 'footer', 'nav', 'article', 'aside', 'main',
        'img', 'figure', 'figcaption', 'hr'
      ];
      return fallbackSanitizeWithDOM(html, allowedTags);
    }
    // In Node.js, escape everything
    return fallbackSanitize(html);
  }

  // Default secure configuration
  const defaultConfig = {
    // Allow safe tags including form elements and SVG
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'div',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      // Form elements (needed for UI components)
      'button', 'select', 'option', 'label', 'input', 'textarea',
      // SVG elements
      'svg', 'path', 'line', 'circle', 'polyline', 'rect', 'g',
      // Semantic elements
      'details', 'summary', 'section', 'header', 'footer', 'nav', 'article', 'aside', 'main',
      // Media elements
      'img', 'figure', 'figcaption', 'hr'
    ],

    // Allow safe attributes including form attributes
    ALLOWED_ATTR: [
      'href', 'title', 'class', 'id', 'target', 'rel',
      'data-*', 'aria-*', 'role',
      // Form attributes
      'type', 'name', 'value', 'placeholder', 'for', 'disabled', 'readonly',
      'required', 'checked', 'selected', 'maxlength', 'minlength', 'rows', 'cols',
      // SVG attributes
      'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
      'width', 'height', 'points', 'transform',
      // Image attributes
      'src', 'alt', 'loading'
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

    // Forbid dangerous tags (form/input removed - needed for UI components)
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],

    // Forbid dangerous attributes
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  };

  // Merge default config with custom options
  const config = { ...defaultConfig, ...options };

  try {
    return DOMPurify.sanitize(html, config);
  } catch (error) {
    console.error('[DOM Sanitizer] Sanitization failed:', error);
    // Use DOM-based fallback in browser, escape in Node.js
    if (typeof document !== 'undefined') {
      return fallbackSanitizeWithDOM(html, config.ALLOWED_TAGS);
    }
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
