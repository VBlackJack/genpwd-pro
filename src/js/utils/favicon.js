/**
 * @fileoverview Favicon Auto-fetch
 * Fetches site icons from URLs for vault entries
 *
 * @version 2.6.8
 */

import { safeLog } from './logger.js';

// Favicon service providers
const FAVICON_SERVICES = {
  google: (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  duckduckgo: (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  fallback: (domain) => `https://${domain}/favicon.ico`
};

// Cache for favicons (in-memory, session-based)
const faviconCache = new Map();

// Default icon as data URI (simple globe icon)
const DEFAULT_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`)}`;

/**
 * Extract domain from URL
 * @param {string} url - Full URL or partial URL
 * @returns {string|null} Domain name or null
 */
export function extractDomain(url) {
  if (!url) return null;

  try {
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `https://${url}`;
    }

    const urlObj = new URL(fullUrl);
    return urlObj.hostname;
  } catch (e) {
    // Try to extract domain from simple string
    const match = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Get favicon URL for a domain
 * @param {string} domain - Domain name
 * @param {string} [service='google'] - Favicon service to use
 * @returns {string} Favicon URL
 */
export function getFaviconUrl(domain, service = 'google') {
  if (!domain) return DEFAULT_ICON;

  const serviceFunc = FAVICON_SERVICES[service] || FAVICON_SERVICES.google;
  return serviceFunc(domain);
}

/**
 * Check if an image URL is valid/loadable
 * @param {string} url - Image URL
 * @param {number} [timeout=3000] - Timeout in ms
 * @returns {Promise<boolean>}
 */
async function isImageValid(url, timeout = 3000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      // Check if image has actual content (not just 1x1 pixel)
      resolve(img.width > 1 && img.height > 1);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.src = url;
  });
}

/**
 * Fetch and cache favicon for a URL
 * @param {string} url - Website URL
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Force refresh from network
 * @returns {Promise<string>} Favicon URL (or default)
 */
export async function fetchFavicon(url, options = {}) {
  const { forceRefresh = false } = options;

  const domain = extractDomain(url);
  if (!domain) return DEFAULT_ICON;

  // Check cache
  if (!forceRefresh && faviconCache.has(domain)) {
    return faviconCache.get(domain);
  }

  // Try Google first (most reliable)
  const googleUrl = getFaviconUrl(domain, 'google');
  if (await isImageValid(googleUrl)) {
    faviconCache.set(domain, googleUrl);
    safeLog(`[Favicon] Fetched favicon for ${domain} (Google)`);
    return googleUrl;
  }

  // Try DuckDuckGo
  const ddgUrl = getFaviconUrl(domain, 'duckduckgo');
  if (await isImageValid(ddgUrl)) {
    faviconCache.set(domain, ddgUrl);
    safeLog(`[Favicon] Fetched favicon for ${domain} (DuckDuckGo)`);
    return ddgUrl;
  }

  // Try direct favicon.ico
  const directUrl = getFaviconUrl(domain, 'fallback');
  if (await isImageValid(directUrl)) {
    faviconCache.set(domain, directUrl);
    safeLog(`[Favicon] Fetched favicon for ${domain} (direct)`);
    return directUrl;
  }

  // Use default
  faviconCache.set(domain, DEFAULT_ICON);
  safeLog(`[Favicon] Using default icon for ${domain}`);
  return DEFAULT_ICON;
}

/**
 * Get cached favicon synchronously (returns default if not cached)
 * @param {string} url - Website URL
 * @returns {string} Favicon URL
 */
export function getCachedFavicon(url) {
  const domain = extractDomain(url);
  if (!domain) return DEFAULT_ICON;
  return faviconCache.get(domain) || DEFAULT_ICON;
}

/**
 * Preload favicons for multiple URLs
 * @param {string[]} urls - List of URLs
 * @returns {Promise<Map<string, string>>} Map of domain to favicon URL
 */
export async function preloadFavicons(urls) {
  const uniqueDomains = [...new Set(urls.map(extractDomain).filter(Boolean))];

  const results = await Promise.allSettled(
    uniqueDomains.map(domain =>
      fetchFavicon(domain).then(favicon => ({ domain, favicon }))
    )
  );

  const resultMap = new Map();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      resultMap.set(result.value.domain, result.value.favicon);
    }
  }

  safeLog(`[Favicon] Preloaded ${resultMap.size} favicons`);
  return resultMap;
}

/**
 * Clear favicon cache
 */
export function clearFaviconCache() {
  faviconCache.clear();
  safeLog('[Favicon] Cache cleared');
}

/**
 * Get default icon
 * @returns {string}
 */
export function getDefaultIcon() {
  return DEFAULT_ICON;
}

/**
 * Create favicon img element
 * @param {string} url - Website URL
 * @param {Object} [options]
 * @param {string} [options.className='vault-favicon'] - CSS class
 * @param {string} [options.alt='Site icon'] - Alt text
 * @returns {HTMLImageElement}
 */
export function createFaviconElement(url, options = {}) {
  const { className = 'vault-favicon', alt = 'Site icon' } = options;

  const img = document.createElement('img');
  img.className = className;
  img.alt = alt;
  img.loading = 'lazy';

  // Start with default, then load actual favicon
  img.src = DEFAULT_ICON;

  if (url) {
    fetchFavicon(url).then(faviconUrl => {
      if (faviconUrl !== DEFAULT_ICON) {
        img.src = faviconUrl;
      }
    }).catch(() => {
      // Keep default icon
    });
  }

  // Handle load errors gracefully
  img.onerror = () => {
    img.src = DEFAULT_ICON;
  };

  return img;
}

export default {
  extractDomain,
  getFaviconUrl,
  fetchFavicon,
  getCachedFavicon,
  preloadFavicons,
  clearFaviconCache,
  getDefaultIcon,
  createFaviconElement
};
