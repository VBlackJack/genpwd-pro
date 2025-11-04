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
 * Génère un entier aléatoire entre min et max (inclus)
 * @param {number} min - Valeur minimale (incluse)
 * @param {number} max - Valeur maximale (incluse)
 * @returns {number} Entier aléatoire entre min et max
 * @throws {Error} Si min > max ou si les paramètres ne sont pas des nombres
 * @example
 * randInt(1, 10) // → 7 (par exemple)
 * randInt(0, 100) // → 42 (par exemple)
 */
export function randInt(min, max) {
  if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
    throw new Error(`randInt: paramètres invalides (${min}, ${max})`);
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sélectionne un élément aléatoire dans un tableau
 * @param {Array} arr - Tableau source
 * @returns {*} Élément aléatoire du tableau
 * @throws {Error} Si le paramètre n'est pas un tableau ou si le tableau est vide
 * @example
 * pick(['a', 'b', 'c']) // → 'b' (par exemple)
 * pick([1, 2, 3, 4, 5]) // → 3 (par exemple)
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
  return arr[Math.floor(Math.random() * arr.length)];
}

export function ensureArray(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === 'string') {
    return input.split('');
  }
  return [];
}

const clampPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
};

let digitPlacement = [];
let specialPlacement = [];

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

export function setDigitPositions(positions) {
  digitPlacement = normalizePercentages(positions, Array.isArray(positions) ? positions.length : 0);
  return digitPlacement.slice();
}

export function setSpecialPositions(positions) {
  specialPlacement = normalizePercentages(positions, Array.isArray(positions) ? positions.length : 0);
  return specialPlacement.slice();
}

export function getDigitPositions() {
  return digitPlacement.slice();
}

export function getSpecialPositions() {
  return specialPlacement.slice();
}

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
    console.warn(`Erreur insertWithPlacement: ${e.message}`);
    return base + chars.join('');
  }

  return arr.join('');
}

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

export function log2(n) {
  if (typeof n !== 'number' || n <= 0) return 0;
  return Math.log(n) / Math.log(2);
}
