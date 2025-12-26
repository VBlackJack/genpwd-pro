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

// src/js/utils/i18n.js - Internationalization module

import { safeGetItem, safeSetItem } from './storage-helper.js';
import { safeLog } from './logger.js';

/**
 * @typedef {Object} I18nConfig
 * @property {string} defaultLocale - Default locale to use
 * @property {string[]} supportedLocales - List of supported locales
 * @property {string} storageKey - localStorage key for storing user preference
 */

const DEFAULT_CONFIG = {
  defaultLocale: 'fr',
  supportedLocales: ['fr', 'en', 'es'],
  storageKey: 'genpwd_locale'
};

class I18n {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentLocale = this.detectLocale();
    this.translations = new Map();
    this.loadedLocales = new Set();
  }

  /**
   * Detect user's preferred locale
   * @returns {string} Detected locale code
   */
  detectLocale() {
    // 1. Check localStorage
    const stored = safeGetItem(this.config.storageKey);
    if (stored && this.config.supportedLocales.includes(stored)) {
      return stored;
    }

    // 2. Check browser language
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'en-US' -> 'en'

    if (this.config.supportedLocales.includes(langCode)) {
      return langCode;
    }

    // 3. Fall back to default
    return this.config.defaultLocale;
  }

  /**
   * Load translations for a specific locale
   * @param {string} locale - Locale code to load
   * @returns {Promise<boolean>} Success status
   */
  async loadLocale(locale) {
    if (!this.config.supportedLocales.includes(locale)) {
      safeLog(`[i18n] Unsupported locale: ${locale}`);
      return false;
    }

    if (this.loadedLocales.has(locale)) {
      safeLog(`[i18n] Locale already loaded: ${locale}`);
      return true;
    }

    try {
      const response = await fetch(`./locales/${locale}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const translations = await response.json();
      this.translations.set(locale, translations);
      this.loadedLocales.add(locale);

      safeLog(`[i18n] Loaded locale: ${locale}`);
      return true;
    } catch (error) {
      safeLog(`[i18n] Failed to load locale ${locale}: ${error.message}`);
      return false;
    }
  }

  /**
   * Set current locale and persist preference
   * @param {string} locale - Locale code to set
   * @returns {Promise<boolean>} Success status
   */
  async setLocale(locale) {
    if (!this.config.supportedLocales.includes(locale)) {
      safeLog(`[i18n] Invalid locale: ${locale}`);
      return false;
    }

    // Load locale if not already loaded
    if (!this.loadedLocales.has(locale)) {
      const loaded = await this.loadLocale(locale);
      if (!loaded) {
        return false;
      }
    }

    this.currentLocale = locale;
    safeSetItem(this.config.storageKey, locale);

    // Notify listeners of locale change
    this._notifyLocaleChange();

    safeLog(`[i18n] Locale set to: ${locale}`);
    return true;
  }

  /**
   * Get translation for a key path
   * @param {string} key - Dot-notation key path (e.g., 'app.title')
   * @param {Object} params - Optional parameters for interpolation
   * @returns {string} Translated string or key if not found
   */
  t(key, params = {}) {
    const locale = this.currentLocale;
    const translations = this.translations.get(locale);

    if (!translations) {
      safeLog(`[i18n] No translations loaded for: ${locale}`);
      return key;
    }

    // Navigate through nested object using dot notation
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        safeLog(`[i18n] Translation not found: ${key}`);
        return key;
      }
    }

    // If value is not a string, return key
    if (typeof value !== 'string') {
      safeLog(`[i18n] Translation value is not a string: ${key}`);
      return key;
    }

    // Interpolate parameters
    let result = value;
    for (const [param, replacement] of Object.entries(params)) {
      const regex = new RegExp(`\\{${param}\\}`, 'g');
      result = result.replace(regex, String(replacement));
    }

    return result;
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  getLocale() {
    return this.currentLocale;
  }

  /**
   * Get list of supported locales
   * @returns {string[]} Array of supported locale codes
   */
  getSupportedLocales() {
    return [...this.config.supportedLocales];
  }

  /**
   * Check if a locale is loaded
   * @param {string} locale - Locale code to check
   * @returns {boolean} True if loaded
   */
  isLocaleLoaded(locale) {
    return this.loadedLocales.has(locale);
  }

  /**
   * Preload multiple locales
   * @param {string[]} locales - Array of locale codes to load
   * @returns {Promise<boolean>} Success status
   */
  async preloadLocales(locales) {
    const promises = locales.map(locale => this.loadLocale(locale));
    const results = await Promise.all(promises);
    return results.every(result => result === true);
  }

  /**
   * Get locale display name
   * @param {string} locale - Locale code
   * @returns {string} Display name
   */
  getLocaleDisplayName(locale) {
    const names = {
      'fr': 'Français',
      'en': 'English',
      'es': 'Español'
    };
    return names[locale] || locale;
  }

  /**
   * Get locale flag emoji
   * @param {string} locale - Locale code
   * @returns {string} Flag emoji
   */
  getLocaleFlag(locale) {
    const flags = {
      'fr': '🇫🇷',
      'en': '🇬🇧',
      'es': '🇪🇸'
    };
    return flags[locale] || '🌐';
  }

  /**
   * Translate all elements with data-i18n attributes in the page
   * Supports:
   * - data-i18n="key" -> sets textContent
   * - data-i18n-html="key" -> sets innerHTML (use with caution)
   * - data-i18n-placeholder="key" -> sets placeholder attribute
   * - data-i18n-aria-label="key" -> sets aria-label attribute
   * - data-i18n-title="key" -> sets title attribute
   * - data-i18n-value="key" -> sets value attribute (for inputs)
   *
   * @param {Element} [root=document] - Root element to search within
   * @returns {number} Number of elements translated
   */
  translatePage(root = document) {
    let count = 0;

    // Translate textContent via data-i18n
    const textElements = root.querySelectorAll('[data-i18n]');
    for (const el of textElements) {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const translation = this.t(key);
        // Only update if translation was found (not returning the key itself)
        if (translation !== key) {
          el.textContent = translation;
          count++;
        }
      }
    }

    // Translate innerHTML via data-i18n-html (for content with markup)
    const htmlElements = root.querySelectorAll('[data-i18n-html]');
    for (const el of htmlElements) {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        const translation = this.t(key);
        if (translation !== key) {
          el.innerHTML = translation;
          count++;
        }
      }
    }

    // Translate placeholder attributes
    const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
    for (const el of placeholderElements) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        const translation = this.t(key);
        if (translation !== key) {
          el.setAttribute('placeholder', translation);
          count++;
        }
      }
    }

    // Translate aria-label attributes
    const ariaLabelElements = root.querySelectorAll('[data-i18n-aria-label]');
    for (const el of ariaLabelElements) {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key) {
        const translation = this.t(key);
        if (translation !== key) {
          el.setAttribute('aria-label', translation);
          count++;
        }
      }
    }

    // Translate title attributes
    const titleElements = root.querySelectorAll('[data-i18n-title]');
    for (const el of titleElements) {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        const translation = this.t(key);
        if (translation !== key) {
          el.setAttribute('title', translation);
          count++;
        }
      }
    }

    // Translate value attributes (for submit buttons, etc.)
    const valueElements = root.querySelectorAll('[data-i18n-value]');
    for (const el of valueElements) {
      const key = el.getAttribute('data-i18n-value');
      if (key) {
        const translation = this.t(key);
        if (translation !== key) {
          el.setAttribute('value', translation);
          count++;
        }
      }
    }

    // Update HTML lang attribute
    if (root === document) {
      document.documentElement.lang = this.currentLocale;
    }

    safeLog(`[i18n] Translated ${count} elements`);
    return count;
  }

  /**
   * Set locale and translate the page
   * @param {string} locale - Locale code to set
   * @returns {Promise<boolean>} Success status
   */
  async setLocaleAndTranslate(locale) {
    const success = await this.setLocale(locale);
    if (success) {
      this.translatePage();
    }
    return success;
  }

  /**
   * Subscribe to locale changes
   * @param {Function} callback - Callback function(locale)
   * @returns {Function} Unsubscribe function
   */
  onLocaleChange(callback) {
    if (!this._localeChangeListeners) {
      this._localeChangeListeners = new Set();
    }
    this._localeChangeListeners.add(callback);
    return () => this._localeChangeListeners.delete(callback);
  }

  /**
   * Notify listeners of locale change
   * @private
   */
  _notifyLocaleChange() {
    if (this._localeChangeListeners) {
      for (const callback of this._localeChangeListeners) {
        try {
          callback(this.currentLocale);
        } catch (error) {
          safeLog(`[i18n] Locale change callback error: ${error.message}`);
        }
      }
    }
  }
}

// Create singleton instance
const i18n = new I18n();

// Export instance and class
export { i18n, I18n };
export default i18n;

/**
 * Convenience function for translations
 * @param {string} key - Translation key
 * @param {Object} params - Optional parameters
 * @returns {string} Translated string
 */
export const t = (key, params) => i18n.t(key, params);
