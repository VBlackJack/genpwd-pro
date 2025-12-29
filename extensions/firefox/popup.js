/*
 * GenPwd Pro - Firefox Extension Popup Script
 * Copyright 2025 Julien Bombled
 */

import { generateSyllables, generatePassphrase, generateLeet } from './core/generators.js';
import { getStrengthLevel, calculateEntropy } from './utils/helpers.js';
import { initializeI18n, t } from './utils/i18n-helper.js';

// XSS Protection: Escape HTML entities
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// DOM Elements
let modeSelect, lengthInput, policySelect, wordCountInput, separatorInput, dictionarySelect;
let leetWordInput, digitsInput, specialsInput, caseModeSelect, quantityInput;
let generateBtn, generateBtnText, resultsSection, resultsContainer;
let syllablesOptions, passphraseOptions, leetOptions;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Initialize i18n for HTML elements
  initializeI18n();

  // Get all DOM elements
  modeSelect = document.getElementById('mode');
  lengthInput = document.getElementById('length');
  policySelect = document.getElementById('policy');
  wordCountInput = document.getElementById('wordCount');
  separatorInput = document.getElementById('separator');
  dictionarySelect = document.getElementById('dictionary');
  leetWordInput = document.getElementById('leetWord');
  digitsInput = document.getElementById('digits');
  specialsInput = document.getElementById('specials');
  caseModeSelect = document.getElementById('caseMode');
  quantityInput = document.getElementById('quantity');
  generateBtn = document.getElementById('generate-btn');
  generateBtnText = generateBtn.querySelector('[data-i18n="generateButton"]');
  resultsSection = document.getElementById('results-section');
  resultsContainer = document.getElementById('results-container');

  syllablesOptions = document.getElementById('syllables-options');
  passphraseOptions = document.getElementById('passphrase-options');
  leetOptions = document.getElementById('leet-options');

  // Event listeners
  modeSelect.addEventListener('change', handleModeChange);
  generateBtn.addEventListener('click', handleGenerate);

  // Load saved settings
  loadSettings();
}

function handleModeChange() {
  const mode = modeSelect.value;

  // Hide all options
  syllablesOptions.classList.add('hidden');
  passphraseOptions.classList.add('hidden');
  leetOptions.classList.add('hidden');

  // Show relevant options
  switch (mode) {
    case 'syllables':
      syllablesOptions.classList.remove('hidden');
      break;
    case 'passphrase':
      passphraseOptions.classList.remove('hidden');
      break;
    case 'leet':
      leetOptions.classList.remove('hidden');
      break;
  }

  // Save settings
  saveSettings();
}

async function handleGenerate() {
  try {
    generateBtn.disabled = true;
    if (generateBtnText) {
      generateBtnText.textContent = t('generatingButton');
    }

    const mode = modeSelect.value;
    const quantity = parseInt(quantityInput.value) || 5;
    const results = [];

    for (let i = 0; i < quantity; i++) {
      let result;

      switch (mode) {
        case 'syllables':
          result = await generateSyllablesPassword();
          break;
        case 'passphrase':
          result = await generatePassphrasePassword();
          break;
        case 'leet':
          result = await generateLeetPassword();
          break;
        default:
          throw new Error(t('errorUnknownMode', mode));
      }

      results.push(result);
    }

    displayResults(results);
    saveSettings();

  } catch (error) {
    console.error('Generation error:', error);
    alert(`${t('errorUnknownMode', error.message)}`);
  } finally {
    generateBtn.disabled = false;
    if (generateBtnText) {
      generateBtnText.textContent = t('generateButton');
    }
  }
}

async function generateSyllablesPassword() {
  const config = {
    length: parseInt(lengthInput.value) || 20,
    policy: policySelect.value || 'standard',
    digits: parseInt(digitsInput.value) || 2,
    specials: parseInt(specialsInput.value) || 2,
    customSpecials: '!#%+,-./:=@_',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: caseModeSelect.value || 'mixte',
    useBlocks: false,
    blockTokens: ['T', 'l']
  };

  return generateSyllables(config);
}

async function generatePassphrasePassword() {
  const config = {
    wordCount: parseInt(wordCountInput.value) || 5,
    separator: separatorInput.value || '-',
    dictionary: dictionarySelect.value || 'french',
    digits: parseInt(digitsInput.value) || 2,
    specials: parseInt(specialsInput.value) || 2,
    customSpecials: '!#%+,-./:=@_',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: caseModeSelect.value || 'mixte'
  };

  return generatePassphrase(config);
}

async function generateLeetPassword() {
  const config = {
    word: leetWordInput.value || 'password',
    digits: parseInt(digitsInput.value) || 2,
    specials: parseInt(specialsInput.value) || 2,
    customSpecials: '!#%+,-./:=@_',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire'
  };

  return generateLeet(config);
}

function displayResults(results) {
  resultsContainer.replaceChildren();
  resultsSection.classList.remove('hidden');

  // PERFORMANCE: Use DocumentFragment to batch DOM updates
  // Reduces reflows from O(n) to O(1) for multiple password generation
  const fragment = document.createDocumentFragment();

  results.forEach((result, index) => {
    const item = createPasswordItem(result, index);
    fragment.appendChild(item);
  });

  // Single DOM update instead of n updates
  resultsContainer.appendChild(fragment);
}

function createPasswordItem(result, index) {
  const div = document.createElement('div');
  div.className = 'password-item';

  const strength = getStrengthLevel(result.entropy);

  div.innerHTML = `
    <div class="password-value" data-password="${escapeHTML(result.value)}">${escapeHTML(result.value)}</div>
    <div class="password-meta">
      <span class="entropy-badge ${escapeHTML(strength.class)}">
        ${result.entropy.toFixed(1)} bits - ${escapeHTML(strength.label)}
      </span>
      <button class="copy-btn" data-index="${index}">📋 ${t('copyButton')}</button>
    </div>
  `;

  const copyBtn = div.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => copyPassword(result.value, copyBtn));

  return div;
}

async function copyPassword(password, button) {
  try {
    await navigator.clipboard.writeText(password);

    const originalText = button.textContent;
    button.textContent = `✓ ${t('copiedButton')}`;
    button.classList.add('copied');

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);

  } catch (error) {
    console.error('Copy error:', error);
    alert(t('errorCopy'));
  }
}

function saveSettings() {
  const settings = {
    mode: modeSelect.value,
    length: lengthInput.value,
    policy: policySelect.value,
    wordCount: wordCountInput.value,
    separator: separatorInput.value,
    dictionary: dictionarySelect.value,
    leetWord: leetWordInput.value,
    digits: digitsInput.value,
    specials: specialsInput.value,
    caseMode: caseModeSelect.value,
    quantity: quantityInput.value
  };

  browser.storage.sync.set({ settings }).then(() => {
    console.log('Settings saved');
  });
}

function loadSettings() {
  browser.storage.sync.get(['settings']).then((data) => {
    if (data.settings) {
      const s = data.settings;

      if (s.mode) modeSelect.value = s.mode;
      if (s.length) lengthInput.value = s.length;
      if (s.policy) policySelect.value = s.policy;
      if (s.wordCount) wordCountInput.value = s.wordCount;
      if (s.separator) separatorInput.value = s.separator;
      if (s.dictionary) dictionarySelect.value = s.dictionary;
      if (s.leetWord) leetWordInput.value = s.leetWord;
      if (s.digits) digitsInput.value = s.digits;
      if (s.specials) specialsInput.value = s.specials;
      if (s.caseMode) caseModeSelect.value = s.caseMode;
      if (s.quantity) quantityInput.value = s.quantity;

      // Trigger mode change to show correct options
      handleModeChange();
    }
  });
}
