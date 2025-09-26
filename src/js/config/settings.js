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
// src/js/config/settings.js - Gestion de l'état et validation
import { DEFAULT_SETTINGS, CHAR_SETS, DICTIONARY_CONFIG, LIMITS } from './constants.js';
import { safeLog } from '../utils/logger.js';

// État global de l'application
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
    domElements: new Map(),
    lastPreview: ''
  }
};

export function validateSettings(settings) {
  const safe = {
    mode: ['syllables', 'passphrase', 'leet'].includes(settings.mode) ? settings.mode : 'syllables',
    qty: Math.max(LIMITS.MIN_QUANTITY, Math.min(LIMITS.MAX_QUANTITY, parseInt(settings.qty) || 5)),
    mask: Boolean(settings.mask),
    digitsNum: Math.max(LIMITS.MIN_DIGITS, Math.min(LIMITS.MAX_DIGITS, parseInt(settings.digitsNum) || 0)),
    specialsNum: Math.max(LIMITS.MIN_SPECIALS, Math.min(LIMITS.MAX_SPECIALS, parseInt(settings.specialsNum) || 0)),
    customSpecials: typeof settings.customSpecials === 'string' ? 
      settings.customSpecials.slice(0, 20) : '',
    placeDigits: ['debut', 'fin', 'milieu', 'aleatoire', 'positions'].includes(settings.placeDigits) ?
      settings.placeDigits : 'aleatoire',
    placeSpecials: ['debut', 'fin', 'milieu', 'aleatoire', 'positions'].includes(settings.placeSpecials) ?
      settings.placeSpecials : 'aleatoire',
    caseMode: ['mixte', 'upper', 'lower', 'title', 'blocks'].includes(settings.caseMode) ? 
      settings.caseMode : 'mixte',
    specific: {}
  };

  // Validation spécifique par mode
  if (safe.mode === 'syllables') {
    safe.specific.length = Math.max(LIMITS.SYLLABLES_MIN_LENGTH, 
      Math.min(LIMITS.SYLLABLES_MAX_LENGTH, parseInt(settings.specific?.length) || 20));
    safe.specific.policy = Object.keys(CHAR_SETS).includes(settings.specific?.policy) ? 
      settings.specific.policy : 'standard';
  } else if (safe.mode === 'passphrase') {
    safe.specific.count = Math.max(LIMITS.PASSPHRASE_MIN_WORDS, 
      Math.min(LIMITS.PASSPHRASE_MAX_WORDS, parseInt(settings.specific?.count) || 5));
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

    // Paramètres spécifiques selon le mode
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
    safeLog(`Erreur readSettings: ${e.message}`);
    return AppState.settings;
  }
}

function getElementValue(selector, defaultValue) {
  const el = document.querySelector(selector);
  return el ? el.value : defaultValue;
}

function getElementChecked(selector, defaultValue) {
  const el = document.querySelector(selector);
  return el ? el.checked : defaultValue;
}

// Getters/Setters pour l'état
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
    AppState.blocks = blocks.filter(b => ['U', 'l', 'T'].includes(b));
    if (AppState.blocks.length === 0) {
      AppState.blocks = ['T', 'l'];
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
