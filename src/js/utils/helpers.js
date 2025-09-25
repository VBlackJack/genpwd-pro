// src/js/utils/helpers.js - Fonctions utilitaires extraites
export function randInt(min, max) {
  if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
    throw new Error(`randInt: paramètres invalides (${min}, ${max})`);
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

export function insertWithPlacement(base, charsToInsert, placement, options = {}) {
  if (typeof base !== 'string') base = '';

  const chars = ensureArray(charsToInsert).filter(c => typeof c === 'string');

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
      case 'fin':
        chars.forEach(ch => arr.push(ch));
        break;
      case 'milieu':
        let mid = Math.floor(arr.length / 2);
        chars.forEach(ch => {
          insertAt(mid, ch);
          mid++;
        });
        break;
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