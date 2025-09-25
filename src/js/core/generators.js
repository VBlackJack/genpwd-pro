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

      const normalized = ensureAsciiBlockContrast(core, sanitizedSeparator, displayedWords);
      core = normalized.core;
      displayedWords = normalized.words;
    } else {
      core = applyCase(joined, fallbackCaseMode);
      displayedWords = sanitizedSeparator.length > 0
        ? core.split(sanitizedSeparator)
        : [core];
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

function ensureAsciiBlockContrast(core, separator, displayedWords) {
  const asciiUpper = /[A-Z]/;
  const asciiLower = /[a-z]/;

  const deriveWords = () => {
    if (separator.length > 0) {
      if (Array.isArray(displayedWords) && displayedWords.length > 0) {
        return displayedWords.slice();
      }
      return core.split(separator);
    }

    if (Array.isArray(displayedWords) && displayedWords.length > 0) {
      return displayedWords.slice();
    }

    return [core];
  };

  const words = deriveWords();
  const joinWords = () => (separator.length > 0 ? words.join(separator) : words.join(''));

  let joined = joinWords();

  if (asciiUpper.test(joined) && asciiLower.test(joined)) {
    return { core: joined, words };
  }

  const letterRegex = /\p{L}/u;
  const diacriticRegex = /\p{Diacritic}/gu;

  const transformWord = (word, direction) => {
    const chars = Array.from(word);
    const asciiRegex = direction === 'upper' ? asciiUpper : asciiLower;

    for (let i = 0; i < chars.length; i++) {
      if (!letterRegex.test(chars[i])) continue;

      const base = chars[i].normalize('NFD').replace(diacriticRegex, '');
      const candidate = direction === 'upper' ? base.toUpperCase() : base.toLowerCase();

      if (asciiRegex.test(candidate)) {
        chars[i] = candidate;
        return chars.join('');
      }
    }

    return word;
  };

  if (!asciiUpper.test(joined)) {
    let updated = false;

    for (let i = 0; i < words.length; i++) {
      const transformed = transformWord(words[i], 'upper');
      if (transformed !== words[i]) {
        words[i] = transformed;
        updated = true;
        break;
      }
    }

    joined = joinWords();

    if (!updated && words.length > 0 && !asciiUpper.test(joined)) {
      for (let index = 0; index < words.length; index++) {
        const chars = Array.from(words[index]);
        let applied = false;

        for (let i = 0; i < chars.length; i++) {
          if (!letterRegex.test(chars[i])) continue;
          const ascii = chars[i].normalize('NFD').replace(diacriticRegex, '').toUpperCase();
          if (ascii.length === 0) continue;
          chars[i] = ascii;
          applied = true;
          break;
        }

        if (applied) {
          words[index] = chars.join('');
          updated = true;
          break;
        }
      }

      joined = joinWords();
    }

    if (!asciiUpper.test(joined) && words.length > 0) {
      for (let index = 0; index < words.length; index++) {
        if (words[index].length === 0) continue;
        const chars = Array.from(words[index]);

        for (let i = 0; i < chars.length; i++) {
          if (!letterRegex.test(chars[i])) continue;
          chars[i] = 'A';
          words[index] = chars.join('');
          updated = true;
          break;
        }

        if (updated) break;
      }

      joined = joinWords();
    }
  }

  if (!asciiLower.test(joined)) {
    let updated = false;

    for (let i = words.length - 1; i >= 0; i--) {
      const transformed = transformWord(words[i], 'lower');
      if (transformed !== words[i]) {
        words[i] = transformed;
        updated = true;
        break;
      }
    }

    joined = joinWords();

    if (!updated && words.length > 0 && !asciiLower.test(joined)) {
      for (let index = words.length - 1; index >= 0; index--) {
        const chars = Array.from(words[index]);
        let applied = false;

        for (let i = chars.length - 1; i >= 0; i--) {
          if (!letterRegex.test(chars[i])) continue;
          const ascii = chars[i].normalize('NFD').replace(diacriticRegex, '').toLowerCase();
          if (ascii.length === 0) continue;
          chars[i] = ascii;
          applied = true;
          break;
        }

        if (applied) {
          words[index] = chars.join('');
          updated = true;
          break;
        }
      }

      joined = joinWords();
    }

    if (!asciiLower.test(joined) && words.length > 0) {
      for (let index = words.length - 1; index >= 0; index--) {
        if (words[index].length === 0) continue;
        const chars = Array.from(words[index]);

        for (let i = chars.length - 1; i >= 0; i--) {
          if (!letterRegex.test(chars[i])) continue;
          chars[i] = 'a';
          words[index] = chars.join('');
          updated = true;
          break;
        }

        if (updated) break;
      }

      joined = joinWords();
    }
  }

  return { core: joined, words };
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
  const steps = [];

  if (Array.isArray(digitsConfig?.chars) && digitsConfig.chars.length > 0) {
    steps.push(digitsConfig);
  }

  if (Array.isArray(specialsConfig?.chars) && specialsConfig.chars.length > 0) {
    steps.push(specialsConfig);
  }

  if (steps.length > 1 && steps.every(step => step.placement === 'debut')) {
    steps.sort((first, second) => {
      if (first.type === second.type) {
        return 0;
      }
      return first.type === 'digits' ? 1 : -1;
    });
  }

  return steps.reduce((value, step) => insertWithPlacement(
    value,
    step.chars,
    step.placement,
    { type: step.type }
  ), core);
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
