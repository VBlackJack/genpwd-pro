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

    const result = mergeWithInsertions(core, {
      chars: digitChars,
      placement: placeDigits,
      type: 'digits'
    }, {
      chars: specialChars,
      placement: placeSpecials,
      type: 'specials'
    });

    const charSpace = computeCharacterSpace(result);
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
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens, dictionary,
            wordListOverride } = config;

    safeLog(`Génération passphrase: ${wordCount} mots, dict="${dictionary}"`);

    const sanitizedSeparator = typeof separator === 'string' ? separator : '';
    const overrideWords = Array.isArray(wordListOverride)
      ? wordListOverride.filter(word => typeof word === 'string' && word.length > 0)
      : null;

    const dictionaryWords = overrideWords && overrideWords.length > 0
      ? overrideWords
      : await getCurrentDictionary(dictionary);

    const selectedWords = overrideWords && overrideWords.length >= wordCount
      ? overrideWords.slice(0, wordCount)
      : Array.from({ length: wordCount }, () => pick(dictionaryWords));

    const validBlocks = Array.isArray(blockTokens)
      ? blockTokens.filter(token => ['U', 'l', 'T'].includes(token))
      : [];

    const shouldUseBlocks = useBlocks && validBlocks.length > 0;
    const fallbackCaseMode = caseMode === 'blocks' ? 'title' : caseMode;
    const joined = selectedWords.join(sanitizedSeparator);

    let core;
    let displayedWords;

    if (shouldUseBlocks) {
      if (sanitizedSeparator.length > 0) {
        core = applyCasePattern(joined, validBlocks, { perWord: true });
        displayedWords = core.split(sanitizedSeparator);
      } else {
        displayedWords = selectedWords.map((word, index) => {
          const token = validBlocks[index % validBlocks.length];
          return applyCasePattern(word, [token]);
        });
        core = displayedWords.join('');
      }
    } else {
      core = applyCase(joined, fallbackCaseMode);
      displayedWords = sanitizedSeparator.length > 0
        ? core.split(sanitizedSeparator)
        : selectedWords.slice();
    }

    // Ajout des chiffres et caractères spéciaux
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = customSpecials?.length > 0
      ? Array.from(customSpecials)
      : CHAR_SETS.standard.specials;
    const specialChars = Array.from({ length: specials }, () => pick(specialPool));

    const result = mergeWithInsertions(core, {
      chars: digitChars,
      placement: placeDigits,
      type: 'digits'
    }, {
      chars: specialChars,
      placement: placeSpecials,
      type: 'specials'
    });

    const dictionarySize = (dictionaryWords && dictionaryWords.length) || 1;
    const entropy = calculateEntropy('passphrase', wordCount, dictionarySize, wordCount);

    return {
      value: result,
      entropy,
      mode: 'passphrase',
      dictionary,
      words: displayedWords
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

    const result = mergeWithInsertions(core, {
      chars: digitChars,
      placement: placeDigits,
      type: 'digits'
    }, {
      chars: specialChars,
      placement: placeSpecials,
      type: 'specials'
    });

    const charSpace = computeCharacterSpace(result);
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


function computeCharacterSpace(result) {
  const hasLower = /[a-z]/.test(result);
  const hasUpper = /[A-Z]/.test(result);
  const hasDigits = /[0-9]/.test(result);
  const hasSpecials = /[^a-zA-Z0-9]/.test(result);

  return (hasLower ? 26 : 0)
    + (hasUpper ? 26 : 0)
    + (hasDigits ? 10 : 0)
    + (hasSpecials ? 32 : 0);
}

function mergeWithInsertions(core, digitsConfig, specialsConfig) {
  let result = core;

  const applyStep = (step) => {
    if (!step || !Array.isArray(step.chars) || step.chars.length === 0) {
      return;
    }

    const options = {};
    if (step.type) {
      options.type = step.type;
    }

    if (Array.isArray(step.percentages) && step.percentages.length > 0) {
      options.percentages = step.percentages;
    }

    result = insertWithPlacement(result, step.chars, step.placement, options);
  };

  const digitsPlacement = digitsConfig?.placement;
  const specialsPlacement = specialsConfig?.placement;

  const sameSide = digitsPlacement && digitsPlacement === specialsPlacement;
  const stackOrder = sameSide && (digitsPlacement === 'fin' || digitsPlacement === 'debut')
    ? [specialsConfig, digitsConfig]
    : [digitsConfig, specialsConfig];

  stackOrder.forEach(applyStep);

  return result;
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
