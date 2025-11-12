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
// src/js/core/dictionaries.js - Système de dictionnaires multilingues
import { DICTIONARY_CONFIG, FALLBACK_DICTIONARY } from '../config/constants.js';
import { DICTIONARY } from '../config/crypto-constants.js';
import { safeLog } from '../utils/logger.js';
import { validateDictionary } from '../utils/integrity.js';
import { validateString, validateArray } from '../utils/validators.js';

const REMOTE_PROTOCOL_REGEX = /^https?:\/\//i;
const DICTIONARY_LOAD_TIMEOUT = DICTIONARY.LOAD_TIMEOUT;

// Maximum number of words allowed in dictionary (security limit)
const MAX_DICTIONARY_WORDS = 50000;

// Minimum words required for a valid dictionary
const MIN_DICTIONARY_WORDS = 100;

async function loadDictionarySource(config) {
  const { url } = config;

  const isBrowserContext = typeof window !== 'undefined' && typeof window.fetch === 'function';
  const shouldUseHttpFetch = isBrowserContext || REMOTE_PROTOCOL_REGEX.test(url);

  if (shouldUseHttpFetch) {
    // Create AbortController for timeout mechanism
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      safeLog(`Dictionary load timeout after ${DICTIONARY_LOAD_TIMEOUT}ms: ${url}`);
    }, DICTIONARY_LOAD_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal, // Link fetch to AbortController
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        }
      });

      clearTimeout(timeoutId); // Cancel timeout on success

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();

    } catch (error) {
      clearTimeout(timeoutId); // Cancel timeout on error

      // Distinguish between timeout and other errors
      if (error.name === 'AbortError') {
        throw new Error(`Dictionary load timeout after ${DICTIONARY_LOAD_TIMEOUT}ms: ${url}`);
      }

      throw error;
    }
  }

  const [{ readFile }, nodePath, { fileURLToPath }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('node:url')
  ]);

  const normalizedPath = url.startsWith('./') ? url.slice(2) : url;
  const cwd = typeof globalThis.process?.cwd === 'function' ? globalThis.process.cwd() : null;
  const moduleDir = nodePath.dirname(fileURLToPath(import.meta.url));

  const candidatePaths = [
    nodePath.resolve(moduleDir, '../../', normalizedPath)
  ];

  if (cwd) {
    candidatePaths.unshift(
      nodePath.resolve(cwd, 'src', normalizedPath)
    );
    candidatePaths.unshift(
      nodePath.resolve(cwd, normalizedPath)
    );
  }

  let lastError = null;

  for (const candidate of candidatePaths) {
    try {
      const fileContent = await readFile(candidate, 'utf-8');
      safeLog(`Lecture locale du dictionnaire ${config.name} depuis ${candidate}`);
      return JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError || new Error(`Impossible de localiser le dictionnaire ${url}`);
}

// État interne du système de dictionnaires
const dictionaries = {
  current: 'french',
  cache: new Map(),
  status: new Map()
};

export async function loadDictionary(dictKey) {
  // Input validation
  const keyValidation = validateString(dictKey, 'dictKey');
  if (!keyValidation.valid) {
    throw new Error(`Invalid dictionary key: ${keyValidation.error}`);
  }

  if (!DICTIONARY_CONFIG[dictKey]) {
    const availableKeys = Object.keys(DICTIONARY_CONFIG).join(', ');
    throw new Error(`Dictionary "${dictKey}" not configured. Available: ${availableKeys}`);
  }

  // Check cache with validation
  if (dictionaries.cache.has(dictKey)) {
    const cached = dictionaries.cache.get(dictKey);
    const cacheValidation = validateArray(cached, 1, 'cached dictionary');

    if (cacheValidation.valid) {
      safeLog(`Dictionary ${dictKey} found in cache (${cached.length} words)`);
      return cached;
    } else {
      // Cache is corrupted, remove it
      safeLog(`Cache corrupted for ${dictKey}, reloading: ${cacheValidation.error}`);
      dictionaries.cache.delete(dictKey);
    }
  }

  const config = DICTIONARY_CONFIG[dictKey];
  updateDictionaryStatus(dictKey, 'loading');
  
  try {
    safeLog(`Chargement du dictionnaire ${dictKey} depuis ${config.url}`);

    const data = await loadDictionarySource(config);

    // Integrity validation (if hash is configured)
    if (typeof data === 'string' || data instanceof ArrayBuffer) {
      const integrityResult = await validateDictionary(dictKey, data);
      if (!integrityResult.valid) {
        // Determine if we're in production (HTTPS + non-localhost)
        const isProd = typeof location !== 'undefined' &&
                       location.protocol === 'https:' &&
                       !location.hostname.includes('localhost') &&
                       !location.hostname.includes('127.0.0.1');

        if (isProd) {
          // In production, fail hard on integrity violations
          throw new Error(`Dictionary integrity check FAILED: ${integrityResult.message}`);
        } else {
          // In development, log warning but continue
          safeLog(`⚠️ DEV MODE: ${integrityResult.message}`);
        }
      } else if (!integrityResult.skipped) {
        safeLog(`✓ ${integrityResult.message}`);
      }
    }

    // Validation du format
    if (!data || !Array.isArray(data.words)) {
      throw new Error('Invalid dictionary format: missing "words" property');
    }

    // Security check: prevent excessive memory allocation
    if (data.words.length > MAX_DICTIONARY_WORDS) {
      throw new Error(`Dictionary too large: ${data.words.length} words > ${MAX_DICTIONARY_WORDS} maximum`);
    }

    // Filter and validate words
    const words = data.words.filter(word => {
      // Must be string
      if (typeof word !== 'string') return false;

      // Length constraints (3-12 chars for optimal passphrase entropy/usability)
      if (word.length < 3 || word.length > 12) return false;

      // Only letters (including accented characters)
      if (!/^[a-zA-ZàâäéèêëïîôöùûüÿñçæœÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÑÇÆŒ]+$/.test(word)) return false;

      return true;
    });

    // Ensure minimum dictionary size for security
    if (words.length < MIN_DICTIONARY_WORDS) {
      throw new Error(`Dictionary too small: ${words.length} valid words < ${MIN_DICTIONARY_WORDS} minimum required`);
    }

    // Store in cache (with additional validation)
    dictionaries.cache.set(dictKey, Object.freeze([...words])); // Freeze for immutability
    updateDictionaryStatus(dictKey, 'loaded', words.length);

    const filteredCount = data.words.length - words.length;
    if (filteredCount > 0) {
      safeLog(`Dictionary ${dictKey}: filtered out ${filteredCount} invalid words`);
    }

    safeLog(`Dictionary ${dictKey} loaded successfully: ${words.length} validated words`);

    // Update UI info
    updateDictionaryInfo(dictKey, words.length, data.metadata);

    return words;
    
  } catch (error) {
    safeLog(`Erreur chargement dictionnaire ${dictKey}: ${error.message}`);
    updateDictionaryStatus(dictKey, 'error');
    updateDictionaryInfo(dictKey, 0, null, error.message);
    
    // Fallback vers le dictionnaire français intégré
    if (dictKey !== 'french') {
      safeLog('Fallback vers dictionnaire français intégré');
      updateDictionaryStatus(dictKey, 'fallback');
      updateDictionaryInfo(dictKey, FALLBACK_DICTIONARY.length, null, 'Utilisation du fallback français');
      return FALLBACK_DICTIONARY;
    }
    
    throw error;
  }
}

export async function getCurrentDictionary(dictKey = null) {
  const targetDict = dictKey || dictionaries.current;
  
  try {
    return await loadDictionary(targetDict);
  } catch (error) {
    safeLog(`Impossible de charger le dictionnaire ${targetDict}, utilisation du fallback`);
    return FALLBACK_DICTIONARY;
  }
}

export function setCurrentDictionary(dictKey) {
  // Input validation
  const keyValidation = validateString(dictKey, 'dictKey');
  if (!keyValidation.valid) {
    safeLog(`setCurrentDictionary: ${keyValidation.error}`);
    return false;
  }

  if (!DICTIONARY_CONFIG[dictKey]) {
    const available = Object.keys(DICTIONARY_CONFIG).join(', ');
    safeLog(`setCurrentDictionary: unknown key "${dictKey}". Available: ${available}`);
    return false;
  }

  dictionaries.current = dictKey;
  safeLog(`Current dictionary changed to: ${dictKey}`);
  return true;
}

/**
 * Gets the current dictionary key
 * @returns {string} Current dictionary key
 */
export function getCurrentDictionaryKey() {
  return dictionaries.current;
}

/**
 * Gets all available dictionary keys
 * @returns {Array<string>} Array of dictionary keys
 */
export function getAvailableDictionaries() {
  return Object.keys(DICTIONARY_CONFIG);
}

/**
 * Clears the dictionary cache
 * @param {string} [dictKey] - Optional specific dictionary to clear, or all if omitted
 */
export function clearDictionaryCache(dictKey = null) {
  if (dictKey) {
    if (dictionaries.cache.has(dictKey)) {
      dictionaries.cache.delete(dictKey);
      safeLog(`Cache cleared for dictionary: ${dictKey}`);
    }
  } else {
    dictionaries.cache.clear();
    safeLog('All dictionary caches cleared');
  }
}

function updateDictionaryStatus(dictKey, status, count = null) {
  const statusEl = document.getElementById('dict-status');
  if (!statusEl) return;

  dictionaries.status.set(dictKey, { status, count, timestamp: Date.now() });

  statusEl.className = `dict-status ${status}`;
  
  switch (status) {
    case 'loading':
      statusEl.textContent = '⏳';
      break;
    case 'loaded':
      statusEl.textContent = '✓';
      break;
    case 'error':
      statusEl.textContent = '✗';
      break;
    case 'fallback':
      statusEl.textContent = '🇫🇷';
      break;
    default:
      statusEl.textContent = '--';
  }
}

function updateDictionaryInfo(dictKey, count, metadata = null, error = null) {
  const infoEl = document.getElementById('dict-info');
  if (!infoEl) return;

  // Reset all state classes
  infoEl.classList.remove('dict-info-error', 'dict-info-success', 'dict-info-warning');

  if (error) {
    infoEl.textContent = `Erreur: ${error}`;
    infoEl.classList.add('dict-info-error');
  } else if (count > 0) {
    const version = metadata?.version || 'v1.0';
    const source = metadata?.source || 'inconnu';
    infoEl.textContent = `${count} mots • ${version} • Source: ${source}`;
    infoEl.classList.add('dict-info-success');
  } else {
    infoEl.textContent = 'Aucun mot disponible';
    infoEl.classList.add('dict-info-warning');
  }
}

export function initializeDictionaries() {
  // Initialiser le fallback français
  updateDictionaryStatus('french', 'fallback');
  updateDictionaryInfo('french', FALLBACK_DICTIONARY.length, 
    { version: 'v1.0', source: 'intégré' });
  
  safeLog('Système de dictionnaires initialisé');
}
