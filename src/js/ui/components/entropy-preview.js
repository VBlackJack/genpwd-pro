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

/**
 * Entropy Preview Component - BMAD Phase 5
 * Real-time entropy estimation based on current settings
 */

import { t } from '../../utils/i18n.js';

/** Entropy thresholds for strength levels */
const STRENGTH_THRESHOLDS = {
  WEAK: 40,
  FAIR: 60,
  GOOD: 80,
  STRONG: 100,
  VERY_STRONG: 128
};

/** CSS classes for strength levels */
const STRENGTH_CLASSES = {
  weak: 'entropy-weak',
  fair: 'entropy-fair',
  good: 'entropy-good',
  strong: 'entropy-strong',
  veryStrong: 'entropy-very-strong'
};

/**
 * Estimate entropy based on current generator settings
 * @param {Object} settings - Current generator settings
 * @returns {number} Estimated entropy in bits
 */
export function estimateEntropy(settings) {
  const { mode, length, wordCount, digits, specials, policy, caseMode } = settings;

  let entropy = 0;

  if (mode === 'syllables') {
    // Base entropy per character varies by policy
    let bitsPerChar = 4.7; // Default: ~26 chars

    if (policy === 'alphanumerique') {
      bitsPerChar = 5.17; // 36 chars (a-z + 0-9)
    } else if (policy === 'complet') {
      bitsPerChar = 5.7; // ~52 chars including extended
    }

    // Case mode affects entropy
    if (caseMode === 'mixte' || caseMode === 'blocks') {
      bitsPerChar += 1; // Doubles alphabet size
    }

    entropy = length * bitsPerChar;

    // Add entropy for appended digits and specials
    entropy += digits * 3.32; // log2(10)
    entropy += specials * 4.0; // ~16 special chars

  } else if (mode === 'passphrase') {
    // ~11 bits per word (assuming ~2048 word dictionary)
    entropy = wordCount * 11;

    // Digits add entropy
    entropy += digits * 3.32;

    // Case mode can add entropy
    if (caseMode === 'mixte' || caseMode === 'title') {
      entropy += wordCount; // ~1 bit per word for case variation
    }

  } else if (mode === 'leet') {
    // Leet speak has reduced entropy due to substitution patterns
    entropy = length * 4.2;
    entropy += digits * 3.32;
    entropy += specials * 4.0;
  }

  return Math.round(entropy);
}

/**
 * Get strength level from entropy value
 * @param {number} entropy - Entropy in bits
 * @returns {string} Strength level key
 */
export function getStrengthLevel(entropy) {
  if (entropy >= STRENGTH_THRESHOLDS.VERY_STRONG) return 'veryStrong';
  if (entropy >= STRENGTH_THRESHOLDS.STRONG) return 'strong';
  if (entropy >= STRENGTH_THRESHOLDS.GOOD) return 'good';
  if (entropy >= STRENGTH_THRESHOLDS.FAIR) return 'fair';
  return 'weak';
}

/**
 * Get CSS class for strength level
 * @param {string} level - Strength level key
 * @returns {string} CSS class name
 */
export function getStrengthClass(level) {
  return STRENGTH_CLASSES[level] || STRENGTH_CLASSES.weak;
}

/**
 * Read current settings from the DOM
 * @returns {Object} Current settings
 */
export function readCurrentSettings() {
  const modeSelect = document.getElementById('mode-select');
  const lengthSlider = document.getElementById('syll-len');
  const wordCountSlider = document.getElementById('pp-count');
  const digitsSlider = document.getElementById('digits-count');
  const specialsSlider = document.getElementById('specials-count');
  const policySelect = document.getElementById('policy-select');
  const caseModeSelect = document.getElementById('case-mode-select');

  return {
    mode: modeSelect?.value || 'syllables',
    length: parseInt(lengthSlider?.value || '16', 10),
    wordCount: parseInt(wordCountSlider?.value || '4', 10),
    digits: parseInt(digitsSlider?.value || '2', 10),
    specials: parseInt(specialsSlider?.value || '2', 10),
    policy: policySelect?.value || 'standard',
    caseMode: caseModeSelect?.value || 'mixte'
  };
}

/**
 * Update the entropy preview display
 * @param {number} entropy - Entropy value to display
 */
export function updateEntropyDisplay(entropy) {
  const container = document.getElementById('entropy-preview');
  const fillEl = document.getElementById('entropy-fill');
  const labelEl = document.getElementById('entropy-label');
  const strengthEl = document.getElementById('entropy-strength');

  if (!container) return;

  const level = getStrengthLevel(entropy);
  const strengthClass = getStrengthClass(level);

  // Update fill bar width (max 150 bits = 100%)
  if (fillEl) {
    const percent = Math.min(100, (entropy / 150) * 100);
    fillEl.style.setProperty('width', `${percent}%`);
  }

  // Update label
  if (labelEl) {
    labelEl.textContent = t('entropyPreview.bits', { count: entropy });
  }

  // Update strength indicator
  if (strengthEl) {
    strengthEl.textContent = t(`entropyPreview.${level}`);
  }

  // Update container class for styling
  container.className = 'entropy-preview ' + strengthClass;
}

/**
 * Calculate and update entropy preview
 */
export function refreshEntropyPreview() {
  const settings = readCurrentSettings();
  const entropy = estimateEntropy(settings);
  updateEntropyDisplay(entropy);
}

/**
 * Debounce helper
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Initialize entropy preview with event bindings
 */
export function initEntropyPreview() {
  const container = document.getElementById('entropy-preview');
  if (!container) return;

  // Debounced update function
  const debouncedUpdate = debounce(refreshEntropyPreview, 100);

  // Selectors for inputs that affect entropy
  const inputSelectors = [
    '#syll-len',
    '#pp-count',
    '#digits-count',
    '#specials-count',
    '#mode-select',
    '#policy-select',
    '#case-mode-select'
  ];

  // Bind to all relevant inputs
  inputSelectors.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener('input', debouncedUpdate);
      element.addEventListener('change', debouncedUpdate);
    }
  });

  // Initial calculation
  refreshEntropyPreview();
}

export default {
  estimateEntropy,
  getStrengthLevel,
  getStrengthClass,
  readCurrentSettings,
  updateEntropyDisplay,
  refreshEntropyPreview,
  initEntropyPreview
};
