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
// src/js/core/casing.js - Gestion de la casse et système de blocs
import { pick } from '../utils/helpers.js';

/**
 * Applies case transformation to a string
 * @param {string} str - Input string
 * @param {string} mode - Case mode: 'upper', 'lower', 'title', 'mixte'
 * @returns {string} Transformed string with applied case mode
 * @example
 * applyCase('hello', 'upper') // → 'HELLO'
 * applyCase('HELLO', 'lower') // → 'hello'
 * applyCase('hello world', 'title') // → 'Hello World'
 * applyCase('hello', 'mixte') // → 'HeLlO' (cryptographically random case)
 */
export function applyCase(str, mode) {
  if (typeof str !== 'string') return '';

  switch (mode) {
    case 'upper':
      return str.toUpperCase();

    case 'lower':
      return str.toLowerCase();

    case 'title':
      return str.split(/(\P{L})/u).map(seg =>
        /\p{L}+/u.test(seg) ?
        seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() :
        seg
      ).join('');

    default: // mixte - CRYPTOGRAPHICALLY SECURE
      return str.split('').map(ch => {
        if (!/\p{L}/u.test(ch)) return ch;

        // Use crypto.getRandomValues() instead of Math.random() for security
        const randomByte = new Uint8Array(1);
        crypto.getRandomValues(randomByte);
        const isUpper = (randomByte[0] & 1) === 1; // Use LSB for random boolean

        return isUpper ? ch.toUpperCase() : ch.toLowerCase();
      }).join('');
  }
}

/**
 * Applies a case pattern to a string using block tokens
 * @param {string} str - Input string
 * @param {Array<string>} tokens - Array of case tokens ('U', 'l', 'T')
 * @param {Object} opts - Options
 * @param {boolean} opts.perWord - Apply pattern per word instead of per character
 * @param {boolean} opts.syllableMode - Apply pattern every 3 letters (syllable mode)
 * @returns {string} String with applied case pattern
 * @example
 * applyCasePattern('hello', ['U', 'l'], {}) // → 'HeLlO'
 * applyCasePattern('hello world', ['T', 'l'], { perWord: true }) // → 'Hello world'
 */
export function applyCasePattern(str, tokens, opts = {}) {
  if (typeof str !== 'string' || !Array.isArray(tokens) || tokens.length === 0) {
    return str || '';
  }

  const perWord = Boolean(opts.perWord);
  const syllableMode = Boolean(opts.syllableMode);

  const isLetterChar = (char) => typeof char === 'string' && /\p{L}/u.test(char);

  let idx = 0, out = '', prev = '', letterCount = 0;
  let wordIndex = 0;

  for (const ch of str) {
    const isLetter = isLetterChar(ch);
    const isWordStart = isLetter && !isLetterChar(prev);

    if (perWord && isWordStart) {
      idx = wordIndex % tokens.length;
      wordIndex++;
    } else if (syllableMode && isLetter && letterCount > 0 && letterCount % 3 === 0) {
      idx = (idx + 1) % tokens.length;
    }

    if (isLetter) {
      const t = tokens[idx % tokens.length];
      if (t === 'U') out += ch.toUpperCase();
      else if (t === 'l') out += ch.toLowerCase();
      else if (t === 'T') out += isWordStart ? ch.toUpperCase() : ch.toLowerCase();
      else out += ch;
      letterCount++;

      if (!perWord && !syllableMode) {
        idx = (idx + 1) % tokens.length;
      }
    } else {
      out += ch;
    }
    prev = ch;
  }
  return out;
}

/**
 * Calculates the appropriate number of case blocks based on mode and parameter
 * @param {string} mode - Generation mode (syllables, passphrase, leet)
 * @param {number} param - Mode-specific parameter (length for syllables, word count for passphrase)
 * @returns {number} Number of blocks to generate (1-50)
 * @example
 * calculateBlocksCount('syllables', 20) // → 6
 * calculateBlocksCount('passphrase', 5) // → 5
 */
export function calculateBlocksCount(mode, param = 20) {
  if (mode === 'syllables') {
    return Math.max(1, Math.min(10, Math.floor(param / 3)));
  } else if (mode === 'passphrase') {
    return Math.max(2, Math.min(8, parseInt(param) || 5));
  } else if (mode === 'leet') {
    const length = typeof param === 'number' ? param : parseInt(param, 10);
    return Math.max(1, Math.min(50, Number.isFinite(length) ? length : 0));
  }
  return 2;
}

/**
 * Generates default case blocks for a given mode
 * @param {string} mode - Generation mode (syllables, passphrase, leet)
 * @param {number} param - Mode-specific parameter
 * @returns {Array<string>} Array of case block tokens
 * @example
 * defaultBlocksForMode('syllables', 20) // → ['U', 'l', 'l', 'l', 'l', 'l']
 * defaultBlocksForMode('passphrase', 5) // → ['T', 'l', 'l', 'l', 'l']
 */
export function defaultBlocksForMode(mode, param = 20) {
  const count = calculateBlocksCount(mode, param);
  if (mode === 'syllables') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'U' : 'l');
    }
    return tokens;
  } else if (mode === 'passphrase') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'T' : 'l');
    }
    return tokens;
  } else if (mode === 'leet') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'T' : 'l');
    }
    return tokens;
  }
  return ['T', 'l'];
}

/**
 * Generates randomized case blocks for a given mode
 * Uses cryptographically secure pick() function
 * @param {string} mode - Generation mode (syllables, passphrase, leet)
 * @param {number} param - Mode-specific parameter
 * @returns {Array<string>} Array of random case block tokens
 * @example
 * randomizeBlocks('syllables', 20) // → ['U', 'T', 'l', 'U', 'l', 'T'] (random)
 * randomizeBlocks('passphrase', 5) // → ['l', 'U', 'T', 'l', 'U'] (random)
 */
export function randomizeBlocks(mode, param = 20) {
  const count = calculateBlocksCount(mode, param);
  const options = ['U', 'l', 'T'];
  const tokens = [];
  
  for (let i = 0; i < count; i++) {
    tokens.push(pick(options));
  }
  
  return tokens;
}
