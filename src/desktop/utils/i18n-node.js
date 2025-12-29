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
 * @fileoverview Node.js i18n module for Electron main process
 * Provides translation functionality using the same locale files as the renderer
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

// Helper to handle ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18nNode {
  constructor() {
    this.locale = 'en'; // Default fallback
    this.translations = {};
    this.loaded = false;
  }

  /**
   * Initialize i18n by loading the correct JSON file
   * Tries to match the app system locale with available files
   */
  init() {
    try {
      // Get system locale from Electron (e.g., 'fr-FR' -> 'fr')
      const systemLocale = app.getLocale().split('-')[0];

      // Define path to locales - adjust based on your build structure
      // In dev: src/locales
      // In prod: resources/locales or inside asar
      const devPath = path.join(__dirname, '../../locales');
      const prodPath = path.join(process.resourcesPath, 'locales');

      const localesPath = fs.existsSync(devPath) ? devPath : prodPath;

      // Try to load system locale, fallback to 'en'
      const targetLocale = fs.existsSync(path.join(localesPath, `${systemLocale}.json`))
        ? systemLocale
        : 'en';

      this.locale = targetLocale;
      const filePath = path.join(localesPath, `${this.locale}.json`);

      const content = fs.readFileSync(filePath, 'utf8');
      this.translations = JSON.parse(content);
      this.loaded = true;

      console.log(`[i18n-node] Loaded locale: ${this.locale}`);
    } catch (error) {
      console.error('[i18n-node] Failed to initialize:', error.message);
      // Fallback empty to prevent crashes
      this.translations = {};
    }
  }

  /**
   * Set locale manually
   * @param {string} locale - Locale code (e.g., 'fr', 'en', 'es')
   */
  setLocale(locale) {
    this.locale = locale;
    this.loaded = false;
    this.init();
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  getLocale() {
    return this.locale;
  }

  /**
   * Get translation for a key
   * @param {string} key - Dot-notation key (e.g. 'errors.sync.failed')
   * @param {Object} params - Interpolation parameters
   * @returns {string} Translated string or key if not found
   */
  t(key, params = {}) {
    if (!this.loaded) this.init();

    const keys = key.split('.');
    let value = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found, return original key
        return key;
      }
    }

    if (typeof value !== 'string') return key;

    // Interpolate parameters
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
    });
  }
}

// Singleton instance
export const i18n = new I18nNode();

/**
 * Translation helper function
 * @param {string} key - Dot-notation key
 * @param {Object} params - Interpolation parameters
 * @returns {string} Translated string
 */
export const t = (key, params) => i18n.t(key, params);
