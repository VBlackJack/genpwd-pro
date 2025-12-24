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
// src/js/config/settings.js - State management and validation
import { DEFAULT_SETTINGS, CHAR_SETS, DICTIONARY_CONFIG, LIMITS, SPECIALS_SAFE, isValidMode, DEFAULT_MODE, PLACEMENT_MODES, CASE_MODES, CASE_BLOCK_TYPES, DEFAULT_CASE_BLOCKS } from './constants.js';
import { safeLog } from '../utils/logger.js';
import { LRUCache } from '../utils/lru-cache.js';

// Global application state
const AppState = {
  settings: { ...DEFAULT_SETTINGS },
  results: [],
  blocks: ['T', 'l'],
  ui: {
    debugVisible: false,
    blockDirty: false,
    useBlocks: false,
    blockAutoSync: true
  },
  cache: {
    domElements: new LRUCache(50), // LRU cache with max 50 elements
    lastPreview: ''
  }
};

/**
 * Validates and sanitizes custom special characters
 * SECURITY: Whitelist approach - only allow safe special characters
 * @param {string} input - Custom specials string
 * @returns {string} Validated and sanitized string
 */
function validateCustomSpecials(input) {
  if (typeof input !== 'string') {
    return SPECIALS_SAFE;
  }

  // Whitelist of allowed special characters (CLI-safe + commonly used)
  // Excludes: $ (shell variable), ^ (escape), & (background), * (glob), ' (quote), ` (command sub)
  const ALLOWED_SPECIALS = '!@#%_+-=.,:;?/\\|[]{}()<>~';

  // Filter to only allowed characters and remove duplicates
  const filtered = [...new Set(
    input
      .split('')
      .filter(char => ALLOWED_SPECIALS.includes(char))
  )].join('');

  // Limit length
  const validated = filtered.slice(0, 20);

  // If empty after validation, return safe defaults
  if (validated.length === 0) {
    safeLog('validateCustomSpecials: No valid characters, using defaults');
    return SPECIALS_SAFE;
  }

  return validated;
}

export function validateSettings(settings) {
  const safe = {
    mode: isValidMode(settings.mode) ? settings.mode : DEFAULT_MODE,
    qty: Math.max(LIMITS.MIN_QUANTITY, Math.min(LIMITS.MAX_QUANTITY, parseInt(settings.qty, 10) || 5)),
    mask: Boolean(settings.mask),
    digitsNum: Math.max(LIMITS.MIN_DIGITS, Math.min(LIMITS.MAX_DIGITS, parseInt(settings.digitsNum, 10) || 0)),
    specialsNum: Math.max(LIMITS.MIN_SPECIALS, Math.min(LIMITS.MAX_SPECIALS, parseInt(settings.specialsNum, 10) || 0)),
    customSpecials: validateCustomSpecials(settings.customSpecials),
    placeDigits: PLACEMENT_MODES.includes(settings.placeDigits) ?
      settings.placeDigits : 'aleatoire',
    placeSpecials: PLACEMENT_MODES.includes(settings.placeSpecials) ?
      settings.placeSpecials : 'aleatoire',
    caseMode: CASE_MODES.includes(settings.caseMode) ?
      settings.caseMode : 'mixte',
    specific: {}
  };

  // Mode-specific validation
  if (safe.mode === 'syllables') {
    safe.specific.length = Math.max(LIMITS.SYLLABLES_MIN_LENGTH, 
      Math.min(LIMITS.SYLLABLES_MAX_LENGTH, parseInt(settings.specific?.length, 10) || 20));
    safe.specific.policy = Object.keys(CHAR_SETS).includes(settings.specific?.policy) ? 
      settings.specific.policy : 'standard';
  } else if (safe.mode === 'passphrase') {
    safe.specific.count = Math.max(LIMITS.PASSPHRASE_MIN_WORDS, 
      Math.min(LIMITS.PASSPHRASE_MAX_WORDS, parseInt(settings.specific?.count, 10) || 5));
    safe.specific.sep = ['-', '_', '.', ' '].includes(settings.specific?.sep) ? 
      settings.specific.sep : '-';
    safe.specific.dictionary = Object.keys(DICTIONARY_CONFIG).includes(settings.specific?.dictionary) ?
      settings.specific.dictionary : 'french';
  } else if (safe.mode === 'leet') {
    safe.specific.word = typeof settings.specific?.word === 'string' ? 
      settings.specific.word.slice(0, 50).replace(/[^\w]/g, '') || 'password' : 'password';
  }

  return safe;
}

export function readSettings() {
  try {
    const rawSettings = {
      mode: getElementValue('#mode-select', 'syllables'),
      qty: getElementValue('#qty', '5'),
      mask: getElementChecked('#mask-toggle', true),
      digitsNum: getElementValue('#digits-count', '2'),
      specialsNum: getElementValue('#specials-count', '2'),
      customSpecials: getElementValue('#custom-specials', ''),
      placeDigits: getElementValue('#place-digits', 'aleatoire'),
      placeSpecials: getElementValue('#place-specials', 'aleatoire'),
      caseMode: getElementValue('#case-mode-select', 'mixte'),
      specific: {}
    };

    // Mode-specific settings
    if (rawSettings.mode === 'syllables') {
      rawSettings.specific.length = getElementValue('#syll-len', '20');
      rawSettings.specific.policy = getElementValue('#policy-select', 'standard');
    } else if (rawSettings.mode === 'passphrase') {
      rawSettings.specific.count = getElementValue('#pp-count', '5');
      rawSettings.specific.sep = getElementValue('#pp-sep', '-');
      rawSettings.specific.dictionary = getElementValue('#dict-select', 'french');
    } else if (rawSettings.mode === 'leet') {
      rawSettings.specific.word = getElementValue('#leet-input', 'password');
    }

    const validSettings = validateSettings(rawSettings);
    if (validSettings.mode === 'syllables') {
      const policySelect = document.querySelector('#policy-select');
      if (policySelect && policySelect.options) {
        const options = Array.from(policySelect.options);
        const fallback = options.find(option => option.value === 'standard')?.value
          || options[0]?.value
          || 'standard';
        const desired = options.some(option => option.value === validSettings.specific.policy)
          ? validSettings.specific.policy
          : fallback;
        if (desired && policySelect.value !== desired) {
          policySelect.value = desired;
        }
      }
    }

    AppState.settings = { ...validSettings, caseBlocks: AppState.blocks.slice() };

    return AppState.settings;
  } catch (e) {
    safeLog(`readSettings error: ${e.message}`);
    return AppState.settings;
  }
}

/**
 * Get element value with DOM caching
 * PERFORMANCE: Cache DOM queries to avoid repeated querySelectorAll
 * @param {string} selector - CSS selector
 * @param {*} defaultValue - Default value if element not found
 * @returns {*} Element value or default
 */
function getElementValue(selector, defaultValue) {
  let el = AppState.cache.domElements.get(selector);
  if (!el) {
    el = document.querySelector(selector);
    if (el) {
      AppState.cache.domElements.set(selector, el);
    }
  }
  return el ? el.value : defaultValue;
}

/**
 * Get element checked state with DOM caching
 * @param {string} selector - CSS selector
 * @param {*} defaultValue - Default value if element not found
 * @returns {boolean} Element checked state or default
 */
function getElementChecked(selector, defaultValue) {
  let el = AppState.cache.domElements.get(selector);
  if (!el) {
    el = document.querySelector(selector);
    if (el) {
      AppState.cache.domElements.set(selector, el);
    }
  }
  return el ? el.checked : defaultValue;
}

// Getters/Setters for state
export function getSettings() {
  return AppState.settings;
}

export function setSettings(settings) {
  AppState.settings = validateSettings(settings);
}

export function getResults() {
  return AppState.results;
}

export function setResults(results) {
  AppState.results = Array.isArray(results) ? results : [];
}

export function getBlocks() {
  return AppState.blocks;
}

export function setBlocks(blocks) {
  if (Array.isArray(blocks) && blocks.length > 0) {
    AppState.blocks = blocks.filter(b => CASE_BLOCK_TYPES.includes(b));
    if (AppState.blocks.length === 0) {
      AppState.blocks = [...DEFAULT_CASE_BLOCKS];
    }
  }
}

export function getUIState(key) {
  if (typeof key === 'string') {
    return AppState.ui[key];
  }

  return AppState.ui;
}

export function setUIState(key, value) {
  if (typeof key === 'string') {
    AppState.ui[key] = value;
  }
}

// Cache DOM
export function getCachedElement(selector) {
  if (AppState.cache.domElements.has(selector)) {
    const cached = AppState.cache.domElements.get(selector);
    if (cached && document.contains(cached)) {
      return cached;
    }
    AppState.cache.domElements.delete(selector);
  }
  
  const element = document.querySelector(selector);
  if (element) {
    AppState.cache.domElements.set(selector, element);
  }
  
  return element;
}

export function clearCache() {
  AppState.cache.domElements.clear();
  AppState.cache.lastPreview = '';
}
