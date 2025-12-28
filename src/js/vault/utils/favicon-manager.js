/**
 * @fileoverview Favicon Manager
 * Handles favicon fetching and caching for URLs
 */

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string|null} Domain or null
 */
export function extractDomain(url) {
  if (!url) return null;
  try {
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `https://${url}`;
    }
    return new URL(fullUrl).hostname;
  } catch (e) {
    const match = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Get favicon URL for a domain using Google's favicon service
 * @param {string} domain - Domain to get favicon for
 * @returns {string} Favicon URL
 */
export function getFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/**
 * Get default favicon SVG placeholder
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
 * Render favicon image HTML with fallback
 * @param {string} url - URL to get favicon for
 * @param {number} size - Icon size (default: 20)
 * @returns {string} HTML markup
 */
export function renderFaviconImg(url, size = 20) {
  const domain = extractDomain(url);
  if (!domain) {
    return `<span class="vault-favicon-placeholder" data-favicon-size="${size}">${getDefaultFaviconSvg()}</span>`;
  }
  const faviconUrl = getFaviconUrl(domain);
  return `<img src="${faviconUrl}"
               class="vault-favicon"
               data-favicon-size="${size}"
               alt=""
               loading="lazy"
               onerror="this.classList.add('vault-favicon-hidden');this.nextElementSibling.classList.add('vault-favicon-visible')">
          <span class="vault-favicon-placeholder vault-favicon-hidden" data-favicon-size="${size}">${getDefaultFaviconSvg()}</span>`;
}

/**
 * Create a favicon cache manager
 * @returns {Object} Cache manager with preload method
 */
export function createFaviconCache() {
  const cache = new Map();

  return {
    /**
     * Preload favicons for a list of entries
     * @param {Array} entries - Entries with data.url
     */
    preload(entries) {
      const urls = entries
        .filter(e => e.data?.url)
        .map(e => e.data.url);

      const uniqueDomains = [...new Set(urls.map(u => extractDomain(u)).filter(Boolean))];

      for (const domain of uniqueDomains) {
        if (!cache.has(domain)) {
          const img = new Image();
          img.src = getFaviconUrl(domain);
          cache.set(domain, true);
        }
      }
    },

    /**
     * Check if domain is cached
     * @param {string} domain - Domain to check
     * @returns {boolean}
     */
    has(domain) {
      return cache.has(domain);
    }
  };
}
