/**
 * @fileoverview Favicon Manager
 * Handles favicon fetching, caching, and rendering
 */

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
    return new URL(fullUrl).hostname;
  } catch (e) {
    const match = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Get favicon URL from Google's favicon service
 * @param {string} domain - Domain to get favicon for
 * @returns {string} Favicon URL
 */
export function getFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
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
      const img = new Image();
      img.src = getFaviconUrl(domain);
      cache.set(domain, true);
    }
  }
}
