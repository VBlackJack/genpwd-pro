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
// src/js/core/generators.js - Main generation logic
import { CHAR_SETS, DIGITS, LEET_SUBSTITUTIONS, CASE_BLOCK_TYPES } from '../config/constants.js';
import { pick, insertWithPlacement } from '../utils/helpers.js';
import { getCurrentDictionary } from './dictionaries.js';
import { applyCasePattern, applyCase } from './casing.js';
import { safeLog } from '../utils/logger.js';

const CLI_SAFE_SPECIAL_SET = new Set(CHAR_SETS.standard.specials);
const DANGEROUS_CHARS = new Set(['$', '^', '&', '*', "'"]);

function sanitizeSpecialCandidates(candidates) {
  const unique = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) {
      continue;
    }

    const char = candidate[0];
    if (!CLI_SAFE_SPECIAL_SET.has(char)) {
      continue;
    }

    if (!unique.includes(char)) {
      unique.push(char);
    }
  }
  return unique;
}

function enforceCliSafety(value, context) {
  if (typeof value !== 'string') {
    return;
  }

  for (const dangerous of DANGEROUS_CHARS) {
    if (value.includes(dangerous)) {
      throw new Error(`SECURITY: Character ${dangerous} detected in ${context}`);
    }
  }
}

/**
 * Generates a syllable-based password (alternating consonants/vowels)
 * @param {Object} config - Generation configuration
 * @param {number} config.length - Password length (letters only, before adding digits/specials)
 * @param {string} config.policy - Character policy ('standard', 'standard-layout', 'alphanumerique', 'alphanumerique-layout')
 * @param {number} config.digits - Number of digits to add (0-6)
 * @param {number} config.specials - Number of special characters to add (0-6)
 * @param {string|Array} config.customSpecials - Custom special characters (optional)
 * @param {string} config.placeDigits - Digit position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.placeSpecials - Special chars position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.caseMode - Case mode ('mixte', 'minuscule', 'majuscule', 'title', 'blocks')
 * @param {boolean} config.useBlocks - Use case block system
 * @param {Array<string>} config.blockTokens - Block tokens ['U', 'l', 'T'] (if useBlocks=true)
 * @returns {Object} Result containing { value: string, entropy: number, mode: string, policy: string }
 * @throws {Error} If policy doesn't exist or parameters are invalid
 * @example
 * const result = generateSyllables({
 *   length: 20,
 *   policy: 'standard',
 *   digits: 2,
 *   specials: 2,
 *   placeDigits: 'aleatoire',
 *   placeSpecials: 'fin',
 *   caseMode: 'mixte'
 * });
 * // → { value: 'duNokUpYg!aKuKYMaci5@', entropy: 103.4, mode: 'syllables', policy: 'standard' }
 */
export function generateSyllables(config) {
  try {
    const { length, policy, digits, specials, customSpecials,
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens } = config;

    const policyData = CHAR_SETS[policy];
    if (!policyData) {
      throw new Error(`Policy "${policy}" not found`);
    }

    const { consonants, vowels } = policyData;
    const requestedLetters = Math.max(1, length - (digits + specials));
    const letters = [];
    let nextIsConsonant = true;

    // Alternating consonants/vowels generation
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

    // Add digits and special characters
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = resolveSpecialPool(customSpecials, policy);
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

    enforceCliSafety(result, 'generateSyllables');

    const entropyConfig = { ...config, mode: 'syllables' };
    const entropy = calculateEntropy('syllables', entropyConfig, result);

    return {
      value: result,
      entropy,
      mode: 'syllables',
      policy
    };

  } catch (error) {
    safeLog(`generateSyllables error: ${error.message}`);
    return {
      value: `error-syllables-${Date.now()}`,
      entropy: 10,
      mode: 'syllables'
    };
  }
}

/**
 * Generates a dictionary-based passphrase
 * @param {Object} config - Generation configuration
 * @param {number} config.wordCount - Number of words in the passphrase (2-8)
 * @param {string} config.separator - Separator between words (e.g., '-', ' ', '')
 * @param {number} config.digits - Number of digits to add (0-6)
 * @param {number} config.specials - Number of special characters to add (0-6)
 * @param {string|Array} config.customSpecials - Custom special characters (optional)
 * @param {string} config.placeDigits - Digit position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.placeSpecials - Special chars position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.caseMode - Case mode ('mixte', 'minuscule', 'majuscule', 'title', 'blocks')
 * @param {boolean} config.useBlocks - Use case block system
 * @param {Array<string>} config.blockTokens - Block tokens ['U', 'l', 'T'] (if useBlocks=true)
 * @param {string} config.dictionary - Dictionary language ('french', 'english', 'latin')
 * @param {Array<string>} [config.wordListOverride] - Custom word list (optional)
 * @returns {Promise<Object>} Result containing { value: string, entropy: number, mode: string, dictionary: string, words: Array<string> }
 * @throws {Error} If dictionary cannot be loaded
 * @example
 * const result = await generatePassphrase({
 *   wordCount: 5,
 *   separator: '-',
 *   digits: 2,
 *   specials: 1,
 *   dictionary: 'french',
 *   caseMode: 'title'
 * });
 * // → { value: 'Pizza-Ideal-Mais-Petale-Fendre6@', entropy: 115.2, mode: 'passphrase', words: ['Pizza', 'Ideal', ...] }
 */
export async function generatePassphrase(config) {
  try {
    const { wordCount, separator, digits, specials, customSpecials,
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens, dictionary,
            wordListOverride } = config;

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
      ? blockTokens.filter(token => CASE_BLOCK_TYPES.includes(token))
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

    // Add digits and special characters
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = resolveSpecialPool(customSpecials, config.policy || 'standard');
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

    enforceCliSafety(result, 'generatePassphrase');

    const dictionarySize = (dictionaryWords && dictionaryWords.length) || 1;
    const entropyConfig = {
      ...config,
      mode: 'passphrase',
      wordCount,
      dictSize: dictionarySize,
      sepChoices: config.sepChoices ?? 1,
      policy: config.policy || 'standard'
    };
    const entropy = calculateEntropy('passphrase', entropyConfig, result);

    return {
      value: result,
      entropy,
      mode: 'passphrase',
      dictionary,
      words: displayedWords
    };

  } catch (error) {
    safeLog(`generatePassphrase error: ${error.message}`);
    return {
      value: `error-passphrase-${Date.now()}`,
      entropy: 15,
      mode: 'passphrase'
    };
  }
}

/**
 * Generates a leet speak password (letter substitution with symbols/digits)
 * @param {Object} config - Generation configuration
 * @param {string} config.baseWord - Base word to transform into leet speak
 * @param {number} config.digits - Number of digits to add (0-6)
 * @param {number} config.specials - Number of special characters to add (0-6)
 * @param {string|Array} config.customSpecials - Custom special characters (optional)
 * @param {string} config.placeDigits - Digit position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.placeSpecials - Special chars position ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {string} config.caseMode - Case mode ('mixte', 'minuscule', 'majuscule', 'title', 'blocks')
 * @param {boolean} config.useBlocks - Use case block system
 * @param {Array<string>} config.blockTokens - Block tokens ['U', 'l', 'T'] (if useBlocks=true)
 * @returns {Object} Result containing { value: string, entropy: number, mode: string, baseWord: string }
 * @example
 * const result = generateLeet({
 *   baseWord: 'password',
 *   digits: 2,
 *   specials: 1,
 *   placeDigits: 'fin',
 *   placeSpecials: 'debut'
 * });
 * // → { value: '@p@55w0rd42', entropy: 45.6, mode: 'leet', baseWord: 'password' }
 * // Transformations: a→@, s→5, o→0
 */
export function generateLeet(config) {
  try {
    const { baseWord, digits, specials, customSpecials,
            placeDigits, placeSpecials, caseMode, useBlocks, blockTokens } = config;

    let core = applyLeetTransformation(baseWord);

    // Application de la casse
    core = useBlocks && blockTokens?.length > 0
      ? applyCasePattern(core, blockTokens, { perWord: false })
      : applyCase(core, caseMode);

    // Add digits and special characters
    const digitChars = Array.from({ length: digits }, () => pick(DIGITS));
    const specialPool = resolveSpecialPool(customSpecials, config.policy || 'standard');
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

    enforceCliSafety(result, 'generateLeet');

    const entropyConfig = { ...config, mode: 'leet', policy: config.policy || 'standard' };
    const entropy = calculateEntropy('leet', entropyConfig, result);

    return {
      value: result,
      entropy,
      mode: 'leet',
      baseWord
    };

  } catch (error) {
    safeLog(`generateLeet error: ${error.message}`);
    return {
      value: `error-leet-${Date.now()}`,
      entropy: 8,
      mode: 'leet'
    };
  }
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

function calculateEntropy(mode, config, result) {
  const LOG2 = Math.log2;

  if (mode === 'passphrase') {
    const { wordCount, dictSize } = config;
    let entropy = (wordCount || 0) * LOG2(dictSize || 2429);

    if (config.sepChoices > 1) {
      entropy += Math.max(0, (wordCount || 0) - 1) * LOG2(config.sepChoices);
    }

    if (config.digits > 0) entropy += config.digits * LOG2(10);
    if (config.specials > 0) {
      const specialsSetSize = getSpecialsSetSize(config.policy);
      entropy += config.specials * LOG2(specialsSetSize);
    }

    return Math.round(entropy * 10) / 10;
  }

  const alphabetSize = calculatePolicyAlphabetSize(config);
  const entropy = result.length * LOG2(alphabetSize || 1);
  return Math.round(entropy * 10) / 10;
}

function calculatePolicyAlphabetSize(config) {
  let size = 0;
  const policy = CHAR_SETS[config.policy || 'standard'];

  if (policy?.consonants) size += policy.consonants.length;
  if (policy?.vowels) size += policy.vowels.length;
  if (config.digits > 0) size += 10;

  if (config.specials > 0) {
    const resolved = resolveSpecialPool(config.customSpecials, config.policy || 'standard');
    size += resolved.length;
  }

  return size;
}

function getSpecialsSetSize(policy) {
  const policyData = CHAR_SETS[policy || 'standard'];
  const specials = policyData?.specials || [];
  return specials.length > 0 ? specials.length : 12;
}

export async function ensureMinimumEntropy(generatorFn, config, minBits = 100) {
  let result = generatorFn(config);

  if (result && typeof result.then === 'function') {
    result = await result;
  }

  let extraEntropy = 0;
  let baseEntropy = calculateEntropy(config.mode, config, result.value);
  let currentEntropy = config.mode === 'passphrase'
    ? baseEntropy + extraEntropy
    : baseEntropy;

  let attempts = 0;
  while (currentEntropy < minBits && attempts < 5) {
    const needed = Math.ceil((minBits - currentEntropy) / Math.log2(74));
    const topUp = generateRandomString(needed, '!#%+,-./:=@_0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

    result.value += topUp;
    if (config.mode === 'passphrase') {
      extraEntropy += needed * Math.log2(74);
    }

    baseEntropy = calculateEntropy(config.mode, config, result.value);
    currentEntropy = config.mode === 'passphrase'
      ? baseEntropy + extraEntropy
      : baseEntropy;
    attempts++;
  }

  result.entropy = config.mode === 'passphrase'
    ? Math.round(currentEntropy * 10) / 10
    : currentEntropy;

  enforceCliSafety(result.value, `ensureMinimumEntropy(${config.mode})`);
  return result;
}

function generateRandomString(length, alphabet) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => alphabet[byte % alphabet.length]).join('');
}

function applyLeetTransformation(word) {
  return word.split('').map(char => LEET_SUBSTITUTIONS[char] || char).join('');
}

function resolveSpecialPool(customSpecials, policyKey = 'standard') {
  if (Array.isArray(customSpecials) && customSpecials.length > 0) {
    const sanitizedArray = sanitizeSpecialCandidates(customSpecials);
    if (sanitizedArray.length > 0) {
      return sanitizedArray;
    }
  }

  if (typeof customSpecials === 'string' && customSpecials.length > 0) {
    const rawChars = Array.from(new Set(customSpecials.split('')));
    const sanitizedString = sanitizeSpecialCandidates(rawChars);
    if (sanitizedString.length > 0) {
      return sanitizedString;
    }
  }

  const policyData = CHAR_SETS[policyKey];
  if (policyData && Array.isArray(policyData.specials)) {
    const sanitizedPolicy = sanitizeSpecialCandidates(policyData.specials);
    return sanitizedPolicy;
  }

  const fallback = sanitizeSpecialCandidates(CHAR_SETS.standard.specials);
  return fallback;
}
