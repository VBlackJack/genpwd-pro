/*
 * Copyright 2025 Julien Bombled
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Generates a cryptographically secure random integer
 */
export function randInt(min, max) {
  if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
    throw new Error(`randInt: paramètres invalides (${min}, ${max})`);
  }

  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValid = Math.floor((256 ** bytesNeeded) / range) * range;

  let randomValue;
  do {
    const randomBytes = new Uint8Array(bytesNeeded);
    crypto.getRandomValues(randomBytes);

    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue += randomBytes[i] * (256 ** i);
    }
  } while (randomValue >= maxValid);

  return min + (randomValue % range);
}

/**
 * Cryptographically secure random element picker
 */
export function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('pick: empty or invalid array');
  }
  return arr[randInt(0, arr.length - 1)];
}

/**
 * Cryptographically secure array shuffle
 */
export function shuffle(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('shuffle: parameter must be an array');
  }

  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Insert items with specified placement
 */
export function insertWithPlacement(base, items, placement) {
  if (!Array.isArray(base) || !Array.isArray(items)) {
    throw new Error('insertWithPlacement: parameters must be arrays');
  }

  if (items.length === 0) return base;

  const result = [...base];

  switch (placement) {
    case 'debut':
      return [...items, ...result];

    case 'fin':
      return [...result, ...items];

    case 'milieu': {
      const mid = Math.floor(result.length / 2);
      return [...result.slice(0, mid), ...items, ...result.slice(mid)];
    }

    case 'aleatoire':
    default: {
      for (const item of items) {
        const pos = randInt(0, result.length);
        result.splice(pos, 0, item);
      }
      return result;
    }
  }
}

/**
 * Calculate password entropy
 */
export function calculateEntropy(length, charsetSize) {
  if (length <= 0 || charsetSize <= 0) return 0;
  return length * Math.log2(charsetSize);
}

/**
 * Get strength description from entropy
 */
export function getStrengthLevel(entropy) {
  if (entropy < 40) return { level: 'weak', label: chrome.i18n.getMessage('strengthWeak'), class: 'entropy-weak' };
  if (entropy < 60) return { level: 'medium', label: chrome.i18n.getMessage('strengthMedium'), class: 'entropy-medium' };
  if (entropy < 80) return { level: 'strong', label: chrome.i18n.getMessage('strengthStrong'), class: 'entropy-strong' };
  return { level: 'very-strong', label: chrome.i18n.getMessage('strengthVeryStrong'), class: 'entropy-very-strong' };
}
