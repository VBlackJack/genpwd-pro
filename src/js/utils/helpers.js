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
// src/js/utils/helpers.js - Fonctions utilitaires extraites

/**
 * Generates a cryptographically secure random integer between min and max (inclusive)
 * Uses Web Crypto API (crypto.getRandomValues) instead of Math.random() for unpredictability
 * Implements rejection sampling to avoid modulo bias
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Cryptographically secure random integer in [min, max]
 * @throws {Error} If parameters are invalid (not numbers or min > max)
 *
 * @example
 * randInt(1, 10) // → 7 (cryptographically random)
 * randInt(0, 255) // → 142 (cryptographically random)
 */
export function randInt(min, max) {
  if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
    throw new Error(`randInt: paramètres invalides (${min}, ${max})`);
  }

  const range = max - min + 1;

  // Special case: range is power of 2, use simple masking (more efficient)
  if ((range & (range - 1)) === 0) {
    const mask = range - 1;
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const value = new DataView(bytes.buffer).getUint32(0, true);
    return min + (value & mask);
  }

  // General case: rejection sampling to avoid modulo bias
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValid = Math.floor((256 ** bytesNeeded) / range) * range;

  let randomValue;
  do {
    const randomBytes = new Uint8Array(bytesNeeded);
    crypto.getRandomValues(randomBytes);

    // Convert bytes to integer (little-endian)
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue += randomBytes[i] * (256 ** i);
    }
  } while (randomValue >= maxValid); // Reject values that would cause bias

  return min + (randomValue % range);
}

/**
 * Selects a cryptographically secure random element from an array
 * Uses crypto.getRandomValues() via randInt() for unpredictability
 *
 * @param {Array} arr - Source array
 * @returns {*} Cryptographically secure random element from the array
 * @throws {Error} If parameter is not an array or if array is empty
 *
 * @example
 * pick(['a', 'b', 'c']) // → 'b' (cryptographically random)
 * pick([1, 2, 3, 4, 5]) // → 3 (cryptographically random)
 */
export function pick(arr) {
  if (!Array.isArray(arr)) {
    console.warn(`pick() appelé avec un non-array: ${typeof arr}`);
    throw new Error(`pick: paramètre doit être un array, reçu: ${typeof arr}`);
  }
  if (arr.length === 0) {
    console.warn('pick() appelé avec un array vide');
    throw new Error('pick: tableau vide ou invalide');
  }

  // Use cryptographically secure randInt() instead of Math.random()
  return arr[randInt(0, arr.length - 1)];
}

/**
 * Ensures the input is converted to an array
 * @param {*} input - Input value (array, string, or other)
 * @returns {Array} Array representation of input
 * @example
 * ensureArray(['a', 'b']) // → ['a', 'b']
 * ensureArray('hello') // → ['h', 'e', 'l', 'l', 'o']
 * ensureArray(null) // → []
 */
export function ensureArray(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === 'string') {
    return input.split('');
  }
  return [];
}

/**
 * Clamps a percentage value between 0 and 100, rounded to 1 decimal place
 * @param {number} value - Value to clamp
 * @returns {number} Clamped percentage (0.0 - 100.0)
 * @example
 * clampPercent(150) // → 100.0
 * clampPercent(-50) // → 0.0
 * clampPercent(42.567) // → 42.6
 */
const clampPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
};

/**
 * Encapsulated state for placement positions
 * Prevents global scope pollution and provides controlled access
 */
const placementState = {
  digits: [],
  specials: []
};

function normalizePercentages(percentages, count) {
  if (count <= 0) {
    return [];
  }

  const sanitized = Array.isArray(percentages)
    ? percentages
        .map(value => (typeof value === 'number' ? value : parseFloat(value)))
        .filter(value => Number.isFinite(value))
        .map(clampPercent)
        .sort((a, b) => a - b)
    : [];

  if (sanitized.length >= count) {
    return sanitized.slice(0, count);
  }

  const fallback = distributeEvenly(count);
  const merged = fallback.slice();

  for (let i = 0; i < sanitized.length; i++) {
    merged[i] = sanitized[i];
  }

  return merged;
}

/**
 * Sets the digit placement positions
 * @param {Array<number>} positions - Array of percentage positions (0-100)
 * @returns {Array<number>} Normalized and sorted positions
 */
export function setDigitPositions(positions) {
  placementState.digits = normalizePercentages(positions, Array.isArray(positions) ? positions.length : 0);
  return [...placementState.digits]; // Return defensive copy
}

/**
 * Sets the special character placement positions
 * @param {Array<number>} positions - Array of percentage positions (0-100)
 * @returns {Array<number>} Normalized and sorted positions
 */
export function setSpecialPositions(positions) {
  placementState.specials = normalizePercentages(positions, Array.isArray(positions) ? positions.length : 0);
  return [...placementState.specials]; // Return defensive copy
}

/**
 * Gets the current digit placement positions
 * @returns {Array<number>} Copy of digit positions
 */
export function getDigitPositions() {
  return [...placementState.digits]; // Return defensive copy
}

/**
 * Gets the current special character placement positions
 * @returns {Array<number>} Copy of special positions
 */
export function getSpecialPositions() {
  return [...placementState.specials]; // Return defensive copy
}

/**
 * Distributes a count of points evenly across a range
 * @param {number} count - Number of points to distribute
 * @param {number} start - Start of range (default: 0)
 * @param {number} end - End of range (default: 100)
 * @returns {Array<number>} Array of evenly distributed percentage points
 * @example
 * distributeEvenly(3) // → [0, 50, 100]
 * distributeEvenly(5, 20, 80) // → [20, 35, 50, 65, 80]
 */
export function distributeEvenly(count, start = 0, end = 100) {
  const safeCount = Math.max(0, parseInt(count, 10) || 0);
  if (safeCount === 0) {
    return [];
  }

  const safeStart = clampPercent(start);
  const safeEnd = clampPercent(end);
  const min = Math.min(safeStart, safeEnd);
  const max = Math.max(safeStart, safeEnd);

  if (safeCount === 1) {
    return [clampPercent((min + max) / 2)];
  }

  const step = (max - min) / (safeCount - 1);
  const points = [];

  for (let i = 0; i < safeCount; i++) {
    points.push(clampPercent(min + step * i));
  }

  return points;
}

/**
 * Inserts characters into a base string at specified percentage positions
 * @param {string} base - Base string
 * @param {Array<string>} charsToInsert - Characters to insert
 * @param {Array<number>} percentages - Percentage positions (0-100) for each character
 * @returns {string} Resulting string with inserted characters
 * @example
 * insertWithPercentages('hello', ['!', '?'], [0, 100]) // → '!hello?'
 * insertWithPercentages('hello', ['1', '2'], [50, 50]) // → 'hel12lo'
 */
export function insertWithPercentages(base, charsToInsert, percentages) {
  const baseStr = typeof base === 'string' ? base : '';
  const chars = ensureArray(charsToInsert).filter(ch => typeof ch === 'string');

  if (chars.length === 0) {
    return baseStr;
  }

  if (baseStr.length === 0) {
    return chars.join('');
  }

  const positions = normalizePercentages(percentages, chars.length);
  const arr = baseStr.split('');

  positions.forEach((percent, index) => {
    const ch = chars[index];
    if (typeof ch !== 'string') {
      return;
    }

    const insertionIndex = Math.max(0, Math.min(arr.length, Math.round((percent / 100) * arr.length)));
    arr.splice(insertionIndex, 0, ch);
  });

  return arr.join('');
}

/**
 * Insère des caractères dans une chaîne selon un mode de placement
 * @param {string} base - Chaîne de base
 * @param {Array|string} charsToInsert - Caractères à insérer
 * @param {string} placement - Mode de placement ('debut', 'fin', 'milieu', 'aleatoire', 'positions')
 * @param {Object} [options={}] - Options supplémentaires
 * @param {Array<number>} [options.percentages] - Pourcentages de placement (si placement='positions')
 * @param {string} [options.type] - Type de caractères ('digits', 'specials')
 * @returns {string} Chaîne résultante avec les caractères insérés
 * @example
 * insertWithPlacement('abc', ['1', '2'], 'fin') // → 'abc12'
 * insertWithPlacement('abc', ['1', '2'], 'debut') // → '12abc'
 * insertWithPlacement('abc', ['1', '2'], 'aleatoire') // → 'a1b2c' (exemple)
 */
export function insertWithPlacement(base, charsToInsert, placement, options = {}) {
  if (typeof base !== 'string') base = '';

  const chars = ensureArray(charsToInsert)
    .map(c => (typeof c === 'string' ? c : String(c ?? '')))
    .filter(c => c.length > 0);

  if (chars.length === 0) return base;
  if (base.length === 0) return chars.join('');

  if (placement === 'positions') {
    const { percentages, type } = options || {};
    let percentList = Array.isArray(percentages) ? percentages : null;

    if (!percentList) {
      if (type === 'digits') {
        percentList = getDigitPositions();
      } else if (type === 'specials') {
        percentList = getSpecialPositions();
      }
    }

    if (percentList && percentList.length > 0) {
      return insertWithPercentages(base, chars, percentList);
    }

    placement = 'aleatoire';
  }

  if (placement === 'debut') {
    return chars.join('') + base;
  }

  if (placement === 'fin') {
    return base + chars.join('');
  }

  const arr = base.split('');
  const insertAt = (pos, ch) => {
    const safePos = Math.max(0, Math.min(arr.length, pos));
    arr.splice(safePos, 0, ch);
  };

  try {
    switch (placement) {
      case 'debut':
        for (let i = chars.length - 1; i >= 0; i--) {
          insertAt(0, chars[i]);
        }
        break;
      case 'milieu': {
        let mid = Math.floor(arr.length / 2);
        chars.forEach(ch => {
          insertAt(mid, ch);
          mid++;
        });
        break;
      }
      default: // aleatoire
        chars.forEach(ch => {
          insertAt(randInt(0, arr.length), ch);
        });
    }
  } catch (e) {
    // Log error properly instead of silently masking it
    console.error(`Error in insertWithPlacement: ${e.message}`, {
      placement,
      charsLength: chars.length,
      baseLength: base.length,
      error: e
    });
    // Return safe fallback
    return base + chars.join('');
  }

  return arr.join('');
}

/**
 * Counts the composition of characters in a string
 * @param {string} str - Input string
 * @returns {Object} Object with counts: { U: uppercase, L: lowercase, D: digits, S: special }
 * @example
 * compositionCounts('Hello123!') // → { U: 1, L: 4, D: 3, S: 1 }
 */
export function compositionCounts(str) {
  if (typeof str !== 'string') return { U: 0, L: 0, D: 0, S: 0 };
  
  let U = 0, L = 0, D = 0, S = 0;
  for (const ch of str) {
    if (/[A-Z]/.test(ch)) U++;
    else if (/[a-z]/.test(ch)) L++;
    else if (/[0-9]/.test(ch)) D++;
    else S++;
  }
  return { U, L, D, S };
}

/**
 * Escapes HTML special characters in a string
 * @param {string} str - Input string
 * @returns {string} HTML-escaped string
 * @example
 * escapeHtml('<script>alert("XSS")</script>') // → '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

/**
 * Calculates the base-2 logarithm of a number
 * @param {number} n - Input number (must be > 0)
 * @returns {number} Log base 2 of n, or 0 if n <= 0
 * @example
 * log2(8) // → 3
 * log2(256) // → 8
 */
export function log2(n) {
  if (typeof n !== 'number' || n <= 0) return 0;
  return Math.log(n) / Math.log(2);
}
