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
import { safeLog } from '../utils/logger.js';

const REMOTE_PROTOCOL_REGEX = /^https?:\/\//i;

async function loadDictionarySource(config) {
  const { url } = config;

  const isBrowserContext = typeof window !== 'undefined' && typeof window.fetch === 'function';
  const shouldUseHttpFetch = isBrowserContext || REMOTE_PROTOCOL_REGEX.test(url);

  if (shouldUseHttpFetch) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
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
  if (!DICTIONARY_CONFIG[dictKey]) {
    throw new Error(`Dictionnaire "${dictKey}" non configuré`);
  }

  // Vérifier le cache
  if (dictionaries.cache.has(dictKey)) {
    const cached = dictionaries.cache.get(dictKey);
    if (Array.isArray(cached) && cached.length > 0) {
      safeLog(`Dictionnaire ${dictKey} trouvé en cache (${cached.length} mots)`);
      return cached;
    }
  }

  const config = DICTIONARY_CONFIG[dictKey];
  updateDictionaryStatus(dictKey, 'loading');
  
  try {
    safeLog(`Chargement du dictionnaire ${dictKey} depuis ${config.url}`);

    const data = await loadDictionarySource(config);
    
    // Validation du format
    if (!data || !Array.isArray(data.words)) {
      throw new Error('Format de dictionnaire invalide (propriété "words" manquante)');
    }

    const words = data.words.filter(word => 
      typeof word === 'string' && 
      word.length >= 3 && 
      word.length <= 12 &&
      /^[a-zA-ZàâäéèêëïîôöùûüÿñçæœÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÑÇÆŒ]+$/.test(word)
    );

    if (words.length === 0) {
      throw new Error('Aucun mot valide trouvé dans le dictionnaire');
    }

    // Mise en cache
    dictionaries.cache.set(dictKey, words);
    updateDictionaryStatus(dictKey, 'loaded', words.length);
    
    safeLog(`Dictionnaire ${dictKey} chargé: ${words.length} mots validés`);
    
    // Mettre à jour les infos UI
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
  if (DICTIONARY_CONFIG[dictKey]) {
    dictionaries.current = dictKey;
    safeLog(`Dictionnaire courant changé vers: ${dictKey}`);
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

  if (error) {
    infoEl.textContent = `Erreur: ${error}`;
    infoEl.style.color = 'var(--accent-red)';
  } else if (count > 0) {
    const version = metadata?.version || 'v1.0';
    const source = metadata?.source || 'inconnu';
    infoEl.textContent = `${count} mots • ${version} • Source: ${source}`;
    infoEl.style.color = 'var(--text-muted)';
  } else {
    infoEl.textContent = 'Aucun mot disponible';
    infoEl.style.color = 'var(--accent-yellow)';
  }
}

export function initializeDictionaries() {
  // Initialiser le fallback français
  updateDictionaryStatus('french', 'fallback');
  updateDictionaryInfo('french', FALLBACK_DICTIONARY.length, 
    { version: 'v1.0', source: 'intégré' });
  
  safeLog('Système de dictionnaires initialisé');
}
