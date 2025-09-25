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
// src/js/core/generators.js - Logique principale de génération
import { CHAR_SETS, DIGITS } from '../config/constants.js';
import { pick, insertWithPlacement } from '../utils/helpers.js';
import { getCurrentDictionary } from './dictionaries.js';
import { applyCasePattern, applyCase } from './casing.js';
import { safeLog } from '../utils/logger.js';

export function generateSyllables(config) {
  try {
    const { length, policy, digits, specials, customSpecials, 
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens } = config;

    safeLog(`Génération syllables: length=${length}, policy="${policy}"`);
    
    const policyData = CHAR_SETS[policy];
    if (!policyData) {
      throw new Error(`Politique "${policy}" non trouvée`);
    }

    const { consonants, vowels } = policyData;
    const requestedLetters = Math.max(1, length - (digits + specials));
    const letters = [];
    let nextIsConsonant = true;

    // Génération alternée consonnes/voyelles
    for (let i = 0; i < requestedLetters; i++) {
      const pool = nextIsConsonant ? consonants : vowels;
      letters.push(pick(pool));
      nextIsConsonant = !nextIsConsonant;
    }

    let core = letters.join('');

    // Application de la casse
    core = useBlocks && blockTokens?.length > 0 
      ? applyCasePattern(core, blockTokens, { syllableMode: true })
      : applyCase(core, caseMode);

    // Ajout des chiffres et caractères spéciaux
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = customSpecials?.length > 0 
      ? Array.from(customSpecials) 
      : policyData.specials;
    const specialChars = Array.from({ length: specials }, () => pick(specialPool));

    let result = insertWithPlacement(core, digitChars, placeDigits, { type: 'digits' });
    result = insertWithPlacement(result, specialChars, placeSpecials, { type: 'specials' });

    // Calcul avec l'espace de caractères réel utilisé
    let charSpace = 0;
    if (/[a-z]/.test(result)) charSpace += 26;
    if (/[A-Z]/.test(result)) charSpace += 26;
    if (/[0-9]/.test(result)) charSpace += 10;
    if (/[^a-zA-Z0-9]/.test(result)) charSpace += 32;

    const entropy = calculateEntropy('syllables', result.length, charSpace);

    return {
      value: result,
      entropy,
      mode: 'syllables',
      policy
    };

  } catch (error) {
    safeLog(`Erreur generateSyllables: ${error.message}`);
    return {
      value: `error-syllables-${Date.now()}`,
      entropy: 10,
      mode: 'syllables'
    };
  }
}

export async function generatePassphrase(config) {
  try {
    const { wordCount, separator, digits, specials, customSpecials,
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens, dictionary } = config;

    safeLog(`Génération passphrase: ${wordCount} mots, dict="${dictionary}"`);
    
    // Charger le dictionnaire
    const words = await getCurrentDictionary(dictionary);
    const selectedWords = Array.from({ length: wordCount }, () => pick(words));
    
    let core = selectedWords.join(separator);

    // Application de la casse
    core = useBlocks && blockTokens?.length > 0
      ? applyCasePattern(core, blockTokens, { perWord: true })
      : applyCase(core, caseMode);

    // Ajout des chiffres et caractères spéciaux
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = customSpecials?.length > 0 
      ? Array.from(customSpecials) 
      : CHAR_SETS.standard.specials;
    const specialChars = Array.from({ length: specials }, () => pick(specialPool));

    let result = insertWithPlacement(core, digitChars, placeDigits, { type: 'digits' });
    result = insertWithPlacement(result, specialChars, placeSpecials, { type: 'specials' });

    // Calcul avec l'espace de caractères réel utilisé
    let charSpace = 0;
    if (/[a-z]/.test(result)) charSpace += 26;
    if (/[A-Z]/.test(result)) charSpace += 26;
    if (/[0-9]/.test(result)) charSpace += 10;
    if (/[^a-zA-Z0-9]/.test(result)) charSpace += 32;

    const entropy = calculateEntropy('syllables', result.length, charSpace);

    return {
      value: result,
      entropy,
      mode: 'passphrase',
      dictionary,
      words: selectedWords
    };

  } catch (error) {
    safeLog(`Erreur generatePassphrase: ${error.message}`);
    return {
      value: `error-passphrase-${Date.now()}`,
      entropy: 15,
      mode: 'passphrase'
    };
  }
}

export function generateLeet(config) {
  try {
    const { baseWord, digits, specials, customSpecials,
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens } = config;

    const leetMap = { 'a': '@', 'e': '3', 'i': '1', 'o': '0', 's': '$' };
    let core = baseWord.split('').map(ch => leetMap[ch.toLowerCase()] || ch).join('');

    // Application de la casse
    core = useBlocks && blockTokens?.length > 0
      ? applyCasePattern(core, blockTokens, { perWord: false })
      : applyCase(core, caseMode);

    // Ajout des chiffres et caractères spéciaux
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = customSpecials?.length > 0 
      ? Array.from(customSpecials) 
      : CHAR_SETS.standard.specials;
    const specialChars = Array.from({ length: specials }, () => pick(specialPool));

    let result = insertWithPlacement(core, digitChars, placeDigits, { type: 'digits' });
    result = insertWithPlacement(result, specialChars, placeSpecials, { type: 'specials' });

    // Calcul avec l'espace de caractères réel utilisé
    let charSpace = 0;
    if (/[a-z]/.test(result)) charSpace += 26;
    if (/[A-Z]/.test(result)) charSpace += 26;
    if (/[0-9]/.test(result)) charSpace += 10;
    if (/[^a-zA-Z0-9]/.test(result)) charSpace += 32;

    const entropy = calculateEntropy('syllables', result.length, charSpace);

    return {
      value: result,
      entropy,
      mode: 'leet',
      baseWord
    };

  } catch (error) {
    safeLog(`Erreur generateLeet: ${error.message}`);
    return {
      value: `error-leet-${Date.now()}`,
      entropy: 8,
      mode: 'leet'
    };
  }
}

function calculateEntropy(mode, length, poolSize, wordCount = 1) {
  let entropy;
  
  switch (mode) {
    case 'syllables':
      // Calcul correct : log2(poolSize^length)
      entropy = Math.log2(Math.pow(poolSize, length));
      break;
      
    case 'passphrase':
      // Pour passphrase : log2(dictSize) * wordCount
      entropy = Math.log2(poolSize) * wordCount;
      break;
      
    case 'leet':
      // Pour leet : log2(26^length) mais réduit car transformation prédictible
      entropy = Math.log2(Math.pow(26, length)) * 0.8;
      break;
      
    default:
      // Calcul standard basé sur l'espace de caractères réel
      entropy = Math.log2(Math.pow(poolSize, length));
      break;
  }
  
  // Arrondi à 1 décimale sans artifice
  return Math.round(entropy * 10) / 10;
}
