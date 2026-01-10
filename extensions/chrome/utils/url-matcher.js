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

/**
 * @fileoverview URL matching utilities for autofill
 */

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string|null}
 */
export function extractDomain(url) {
  if (!url) return null;

  try {
    let normalizedUrl = url.trim();

    // Add protocol if missing
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const parsed = new URL(normalizedUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Extract effective domain (eTLD+1)
 * e.g., "accounts.google.com" -> "google.com"
 * @param {string} domain
 * @returns {string}
 */
export function getEffectiveDomain(domain) {
  if (!domain) return '';

  // Common two-part TLDs
  const twoPartTLDs = [
    'co.uk', 'co.jp', 'co.nz', 'co.za', 'com.au', 'com.br', 'com.cn',
    'com.mx', 'com.tw', 'net.au', 'org.uk', 'org.au', 'ac.uk', 'gov.uk'
  ];

  const parts = domain.toLowerCase().split('.');

  if (parts.length <= 2) return domain;

  // Check for two-part TLD
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

/**
 * Check if two domains match (with subdomain support)
 * @param {string} domain1
 * @param {string} domain2
 * @returns {boolean}
 */
export function domainsMatch(domain1, domain2) {
  if (!domain1 || !domain2) return false;

  const d1 = domain1.toLowerCase();
  const d2 = domain2.toLowerCase();

  // Exact match
  if (d1 === d2) return true;

  // Get effective domains
  const eff1 = getEffectiveDomain(d1);
  const eff2 = getEffectiveDomain(d2);

  // Effective domain match
  if (eff1 === eff2) return true;

  // Subdomain match
  if (d1.endsWith('.' + d2) || d2.endsWith('.' + d1)) return true;

  return false;
}

/**
 * Check if URL is secure (HTTPS)
 * @param {string} url
 * @returns {boolean}
 */
export function isSecureUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if URL is a login page (heuristic)
 * @param {string} url
 * @returns {boolean}
 */
export function isLoginPage(url) {
  if (!url) return false;

  const loginPatterns = [
    /login/i,
    /signin/i,
    /sign-in/i,
    /sign_in/i,
    /auth/i,
    /authenticate/i,
    /session/i,
    /account/i,
    /sso/i
  ];

  return loginPatterns.some(pattern => pattern.test(url));
}

/**
 * Get favicon URL for a domain
 * @param {string} domain
 * @returns {string}
 */
export function getFaviconUrl(domain) {
  if (!domain) return '';
  // Use DuckDuckGo's favicon service (privacy-friendly)
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}
