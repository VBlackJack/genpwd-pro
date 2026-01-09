/**
 * @fileoverview Favicon Manager
 * Handles favicon fetching, caching, and rendering
 *
 * PRIVACY NOTE: This module uses Google's favicon service by default.
 * Domain names are sent to Google to retrieve favicons. Users concerned
 * about privacy can disable favicon fetching in settings.
 *
 * SECURITY: Domain validation prevents SSRF attacks by blocking:
 * - Private IP addresses (10.x, 192.168.x, 172.16-31.x, 127.x)
 * - Localhost and local domains
 * - IP addresses (only domain names allowed)
 */

/**
 * Check if a domain is potentially unsafe (SSRF protection)
 * @param {string} domain - Domain to check
 * @returns {boolean} True if domain should be blocked
 */
function isUnsafeDomain(domain) {
  if (!domain || typeof domain !== 'string') return true;

  const lowerDomain = domain.toLowerCase().trim();

  // Block empty or too short domains
  if (lowerDomain.length < 3) return true;

  // Block IP addresses (IPv4 and IPv6)
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-f:]+)$/i;
  if (ipv4Pattern.test(lowerDomain) || (lowerDomain.includes(':') && ipv6Pattern.test(lowerDomain))) {
    return true;
  }

  // Block localhost and local domains
  const blockedPatterns = [
    'localhost',
    '.local',
    '.internal',
    '.lan',
    '.home',
    '.corp',
    '.private',
    '.localhost',
    '.localdomain',
    '.intranet',
    '127.',
    '10.',
    '192.168.',
    '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.',
    '169.254.',
    '0.0.0.0',
    '::1',
    'fe80::'
  ];

  for (const pattern of blockedPatterns) {
    if (lowerDomain === pattern || lowerDomain.startsWith(pattern) || lowerDomain.endsWith(pattern)) {
      return true;
    }
  }

  // Must have at least one dot (valid domain)
  if (!lowerDomain.includes('.')) return true;

  // Block domains that are just TLDs
  const parts = lowerDomain.split('.');
  if (parts.length < 2 || parts.some(p => p.length === 0)) return true;

  return false;
}

/**
 * Sanitize domain for safe use in URLs
 * @param {string} domain - Raw domain
 * @returns {string|null} Sanitized domain or null if unsafe
 */
function sanitizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;

  // Remove any potential URL encoding attacks
  let cleaned = domain.trim().toLowerCase();

  // Remove any protocol or path that might have slipped through
  cleaned = cleaned.replace(/^(https?:\/\/)?/i, '');
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.split(':')[0]; // Remove port

  // Validate domain format (alphanumeric, dots, and hyphens only)
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  if (!domainPattern.test(cleaned)) return null;

  // Check for unsafe domains (SSRF protection)
  if (isUnsafeDomain(cleaned)) return null;

  return cleaned;
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string|null} Domain or null if invalid
 */
export function extractDomain(url) {
  if (!url) return null;
  try {
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `https://${url}`;
    }
    const hostname = new URL(fullUrl).hostname;
    return sanitizeDomain(hostname);
  } catch {
    const match = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
    return match ? sanitizeDomain(match[1]) : null;
  }
}

/**
 * Get favicon URL from Google's favicon service
 * Note: This sends the domain to Google's servers
 * @param {string} domain - Domain to get favicon for (must be sanitized)
 * @returns {string|null} Favicon URL or null if domain is unsafe
 */
export function getFaviconUrl(domain) {
  // Re-validate domain before constructing URL
  const safeDomain = sanitizeDomain(domain);
  if (!safeDomain) return null;

  // Use encodeURIComponent to prevent URL injection
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(safeDomain)}&sz=64`;
}

/**
 * Get default placeholder SVG for missing favicons
 * @returns {string} SVG markup
 */
export function getDefaultFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`;
}

/**
 * Render favicon HTML with fallback placeholder
 * @param {string} url - URL to get favicon for
 * @param {number} size - Size in pixels (default: 20)
 * @returns {string} HTML string
 */
export function renderFaviconImg(url, size = 20) {
  const domain = extractDomain(url);
  const placeholder = `<span class="vault-favicon-placeholder" role="img" aria-label="Website icon" data-favicon-size="${size}">${getDefaultFaviconSvg()}</span>`;

  if (!domain) {
    return placeholder;
  }

  const faviconUrl = getFaviconUrl(domain);
  // Return placeholder if domain was rejected for security reasons
  if (!faviconUrl) {
    return placeholder;
  }

  // Use data attribute for JS-based error handling instead of inline onerror
  return `<img src="${faviconUrl}"
               class="vault-favicon"
               data-favicon-size="${size}"
               data-favicon-fallback="true"
               alt=""
               loading="lazy">
          <span class="vault-favicon-placeholder vault-favicon-hidden" role="img" aria-label="Website icon" data-favicon-size="${size}">${getDefaultFaviconSvg()}</span>`;
}

/**
 * Initialize favicon error handling for all favicon images
 * Call this after rendering favicon elements to set up error handlers
 * @param {HTMLElement} container - Container to search for favicon images
 */
export function initFaviconErrorHandlers(container = document) {
  container.querySelectorAll('img[data-favicon-fallback="true"]').forEach(img => {
    if (!img.dataset.errorHandlerAttached) {
      img.dataset.errorHandlerAttached = 'true';

      // Capture fallback reference at attach time to avoid stale DOM lookup
      const fallback = img.nextElementSibling?.classList.contains('vault-favicon-placeholder')
        ? img.nextElementSibling
        : null;

      const showFallback = () => {
        img.classList.add('vault-favicon-hidden');
        if (fallback) {
          fallback.classList.remove('vault-favicon-hidden');
          fallback.classList.add('vault-favicon-visible');
        }
      };

      // Check if image already errored before handler was attached
      if (img.complete && img.naturalWidth === 0) {
        showFallback();
      } else {
        img.addEventListener('error', showFallback, { once: true });
      }
    }
  });
}

/**
 * Preload favicons for entries with URLs
 * @param {Array} entries - Vault entries
 * @param {Map} cache - Cache map to track loaded favicons
 */
export function preloadFavicons(entries, cache) {
  const urls = entries
    .filter(e => e.data?.url)
    .map(e => e.data.url);

  const uniqueDomains = [...new Set(urls.map(u => extractDomain(u)).filter(Boolean))];

  // Preload images (browser will cache them)
  for (const domain of uniqueDomains) {
    if (!cache.has(domain)) {
      const faviconUrl = getFaviconUrl(domain);
      // Skip unsafe domains
      if (!faviconUrl) {
        cache.set(domain, false); // Mark as skipped
        continue;
      }
      const img = new Image();
      img.src = faviconUrl;
      cache.set(domain, true);
    }
  }
}
