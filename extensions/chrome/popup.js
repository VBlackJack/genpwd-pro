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
 * @fileoverview Popup script for GenPwd Pro Chrome extension
 * Handles vault management and autofill functionality
 */

import {
  loadVault, unlockVault, lockVault, isUnlocked, hasVaultFile,
  getEntries, getEntriesForDomain, searchEntries, recordActivity
} from './vault/vault-loader.js';
import { generateTOTP, formatTOTPCode, totpManager } from './vault/totp.js';
import { extractDomain, getFaviconUrl } from './utils/url-matcher.js';
import { initializeI18n } from './utils/i18n-helper.js';

// ============================================================================
// STATE
// ============================================================================

let currentTab = null;
let currentDomain = null;
let selectedEntry = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const $ = (id) => document.getElementById(id);

const elements = {};

function initElements() {
  // Vault status
  elements.vaultLocked = $('vault-locked');
  elements.vaultUnlock = $('vault-unlock');
  elements.vaultUnlocked = $('vault-unlocked');
  elements.btnLoadVault = $('btn-load-vault');
  elements.vaultFileInput = $('vault-file-input');
  elements.masterPassword = $('master-password');
  elements.btnUnlock = $('btn-unlock');
  elements.unlockError = $('unlock-error');
  elements.btnLock = $('btn-lock');

  // Tabs
  elements.tabNav = $('tab-nav');
  elements.tabBtns = document.querySelectorAll('.tab-btn');
  elements.tabAutofill = $('tab-autofill');
  elements.tabGenerator = $('tab-generator');
  elements.tabSettings = $('tab-settings');

  // Autofill
  elements.searchEntries = $('search-entries');
  elements.currentSite = $('current-site');
  elements.siteDomain = $('site-domain');
  elements.entriesList = $('entries-list');

  // Generator
  elements.mode = $('mode');
  elements.syllablesOptions = $('syllables-options');
  elements.passphraseOptions = $('passphrase-options');
  elements.leetOptions = $('leet-options');
  elements.length = $('length');
  elements.wordCount = $('wordCount');
  elements.leetWord = $('leetWord');
  elements.digits = $('digits');
  elements.specials = $('specials');
  elements.generateBtn = $('generate-btn');
  elements.generatedPassword = $('generated-password');
  elements.passwordOutput = $('password-output');
  elements.btnCopyGenerated = $('btn-copy-generated');
  elements.btnFillGenerated = $('btn-fill-generated');

  // Settings
  elements.settingAutofillEnabled = $('setting-autofill-enabled');
  elements.settingShowIcon = $('setting-show-icon');
  elements.settingLockTimeout = $('setting-lock-timeout');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  initElements();
  initializeI18n();

  // Get current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    if (tab?.url) {
      currentDomain = extractDomain(tab.url);
    }
  } catch (e) {
    console.error('Failed to get current tab:', e);
  }

  // Load settings
  await loadSettings();

  // Update UI based on vault state
  updateVaultUI();

  // Setup event listeners
  setupEventListeners();
}

// ============================================================================
// VAULT UI
// ============================================================================

function updateVaultUI() {
  if (isUnlocked()) {
    elements.vaultLocked?.classList.add('hidden');
    elements.vaultUnlock?.classList.add('hidden');
    elements.vaultUnlocked?.classList.remove('hidden');
    elements.tabNav?.classList.remove('hidden');
    showTab('autofill');
    loadEntriesForCurrentSite();
  } else if (hasVaultFile()) {
    elements.vaultLocked?.classList.add('hidden');
    elements.vaultUnlock?.classList.remove('hidden');
    elements.vaultUnlocked?.classList.add('hidden');
    elements.tabNav?.classList.add('hidden');
    hideAllTabs();
  } else {
    elements.vaultLocked?.classList.remove('hidden');
    elements.vaultUnlock?.classList.add('hidden');
    elements.vaultUnlocked?.classList.add('hidden');
    elements.tabNav?.classList.add('hidden');
    hideAllTabs();
  }
}

function hideAllTabs() {
  elements.tabAutofill?.classList.add('hidden');
  elements.tabGenerator?.classList.add('hidden');
  elements.tabSettings?.classList.add('hidden');
}

function showTab(tabId) {
  hideAllTabs();

  elements.tabBtns?.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  const tabElement = $(`tab-${tabId}`);
  tabElement?.classList.remove('hidden');
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Vault file loading
  elements.btnLoadVault?.addEventListener('click', () => {
    elements.vaultFileInput?.click();
  });

  elements.vaultFileInput?.addEventListener('change', handleVaultFileSelect);

  // Unlock
  elements.btnUnlock?.addEventListener('click', handleUnlock);
  elements.masterPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });

  // Lock
  elements.btnLock?.addEventListener('click', () => {
    lockVault();
    updateVaultUI();
  });

  // Tab navigation
  elements.tabBtns?.forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Search
  elements.searchEntries?.addEventListener('input', handleSearch);

  // Generator mode change
  elements.mode?.addEventListener('change', handleModeChange);

  // Generate button
  elements.generateBtn?.addEventListener('click', handleGenerate);

  // Copy generated password
  elements.btnCopyGenerated?.addEventListener('click', () => {
    copyToClipboard(elements.passwordOutput?.value);
  });

  // Fill generated password
  elements.btnFillGenerated?.addEventListener('click', () => {
    fillPassword(elements.passwordOutput?.value);
  });

  // Settings
  elements.settingAutofillEnabled?.addEventListener('change', saveSettings);
  elements.settingShowIcon?.addEventListener('change', saveSettings);
  elements.settingLockTimeout?.addEventListener('change', saveSettings);
}

// ============================================================================
// VAULT FILE HANDLING
// ============================================================================

async function handleVaultFileSelect(e) {
  const file = e.target?.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();

    // Store file content for later unlock
    await chrome.storage.local.set({ vaultFileContent: content });

    // Show unlock form
    elements.vaultLocked?.classList.add('hidden');
    elements.vaultUnlock?.classList.remove('hidden');
    elements.masterPassword?.focus();
  } catch (error) {
    showError('Failed to read vault file');
  }
}

async function handleUnlock() {
  const password = elements.masterPassword?.value;
  if (!password) return;

  elements.unlockError?.classList.add('hidden');
  if (elements.btnUnlock) {
    elements.btnUnlock.disabled = true;
    elements.btnUnlock.textContent = 'Unlocking...';
  }

  try {
    // Get stored file content
    const { vaultFileContent } = await chrome.storage.local.get(['vaultFileContent']);

    if (!vaultFileContent) {
      showError('No vault file loaded');
      return;
    }

    const result = await loadVault(vaultFileContent, password);

    if (result.success) {
      if (elements.masterPassword) elements.masterPassword.value = '';
      updateVaultUI();
    } else {
      showError(result.error || 'Wrong password');
    }
  } catch (error) {
    showError(error.message || 'Unlock failed');
  } finally {
    if (elements.btnUnlock) {
      elements.btnUnlock.disabled = false;
      elements.btnUnlock.textContent = 'Unlock';
    }
  }
}

function showError(message) {
  if (elements.unlockError) {
    elements.unlockError.textContent = message;
    elements.unlockError.classList.remove('hidden');
  }
}

// ============================================================================
// ENTRIES LIST
// ============================================================================

function loadEntriesForCurrentSite() {
  if (currentDomain) {
    elements.currentSite?.classList.remove('hidden');
    if (elements.siteDomain) elements.siteDomain.textContent = currentDomain;
    renderEntries(getEntriesForDomain(currentDomain));
  } else {
    elements.currentSite?.classList.add('hidden');
    renderEntries(getEntries().slice(0, 10));
  }
}

function handleSearch() {
  const query = elements.searchEntries?.value?.trim() || '';
  if (query) {
    renderEntries(searchEntries(query));
  } else {
    loadEntriesForCurrentSite();
  }
}

function renderEntries(entries) {
  if (!elements.entriesList) return;

  if (!entries || entries.length === 0) {
    elements.entriesList.innerHTML = '<p class="empty-message">No entries found</p>';
    return;
  }

  elements.entriesList.innerHTML = entries.map(entry => `
    <div class="entry-item" data-entry-id="${entry.id}">
      <img class="entry-favicon" src="${getFaviconUrl(extractDomain(entry.uri))}" onerror="this.style.display='none'">
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.title)}</div>
        <div class="entry-username">${escapeHtml(entry.username || '')}</div>
      </div>
      ${entry.otpConfig ? '<span class="entry-otp-badge">OTP</span>' : ''}
      <div class="entry-actions">
        <button class="btn-icon btn-fill" title="Fill">✏️</button>
        <button class="btn-icon btn-copy-pwd" title="Copy password">📋</button>
      </div>
    </div>
  `).join('');

  // Add click handlers
  elements.entriesList.querySelectorAll('.entry-item').forEach(item => {
    const entryId = item.dataset.entryId;
    const entry = entries.find(e => e.id === entryId);

    item.querySelector('.btn-fill')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fillEntry(entry);
    });

    item.querySelector('.btn-copy-pwd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(entry.password);
    });

    item.addEventListener('click', () => {
      showEntryDetails(entry);
    });
  });
}

function showEntryDetails(entry) {
  selectedEntry = entry;
  if (!elements.entriesList) return;

  // Create details overlay
  const detailsHtml = `
    <div class="entry-details">
      <div class="entry-detail-header">
        <img class="entry-favicon" src="${getFaviconUrl(extractDomain(entry.uri))}" onerror="this.style.display='none'">
        <div>
          <div class="entry-title">${escapeHtml(entry.title)}</div>
          <div class="entry-username">${escapeHtml(entry.username || '')}</div>
        </div>
        <button class="btn-icon btn-close" title="Close">✕</button>
      </div>
      <div class="entry-actions-bar">
        <button class="btn-primary btn-fill-all">Fill credentials</button>
      </div>
      ${entry.otpConfig ? '<div id="otp-container" class="otp-display"></div>' : ''}
    </div>
  `;

  elements.entriesList.innerHTML = detailsHtml;

  // Setup handlers
  elements.entriesList.querySelector('.btn-close')?.addEventListener('click', () => {
    loadEntriesForCurrentSite();
  });

  elements.entriesList.querySelector('.btn-fill-all')?.addEventListener('click', () => {
    fillEntry(entry);
  });

  // Start OTP display if available
  if (entry.otpConfig) {
    startOTPDisplay(entry);
  }
}

function startOTPDisplay(entry) {
  const container = $('otp-container');
  if (!container) return;

  totpManager.watch(entry.id, entry.otpConfig, (result) => {
    container.innerHTML = `
      <div class="otp-code">${formatTOTPCode(result.code)}</div>
      <div class="otp-countdown ${result.remainingSeconds <= 5 ? 'warning' : ''}">${result.remainingSeconds}</div>
      <button class="btn-icon btn-copy-otp" title="Copy OTP">📋</button>
    `;

    container.querySelector('.btn-copy-otp')?.addEventListener('click', () => {
      copyToClipboard(result.code);
    });
  });
}

// ============================================================================
// AUTOFILL
// ============================================================================

async function fillEntry(entry) {
  if (!currentTab?.id) return;

  recordActivity();

  try {
    const credentials = {
      username: entry.username,
      password: entry.password
    };

    // Generate OTP if available
    if (entry.otpConfig) {
      const otp = await generateTOTP(entry.otpConfig.secret, {
        period: entry.otpConfig.period,
        digits: entry.otpConfig.digits,
        algorithm: entry.otpConfig.algorithm
      });
      credentials.otp = otp.code;
    }

    await chrome.tabs.sendMessage(currentTab.id, {
      type: 'FILL_CREDENTIALS',
      credentials
    });

    window.close();
  } catch (error) {
    console.error('Fill failed:', error);
  }
}

async function fillPassword(password) {
  if (!currentTab?.id || !password) return;

  try {
    await chrome.tabs.sendMessage(currentTab.id, {
      type: 'FILL_CREDENTIALS',
      credentials: { password }
    });
    window.close();
  } catch (error) {
    console.error('Fill password failed:', error);
  }
}

// ============================================================================
// PASSWORD GENERATOR
// ============================================================================

function handleModeChange() {
  const mode = elements.mode?.value;

  elements.syllablesOptions?.classList.toggle('hidden', mode !== 'syllables');
  elements.passphraseOptions?.classList.toggle('hidden', mode !== 'passphrase');
  elements.leetOptions?.classList.toggle('hidden', mode !== 'leet');
}

function handleGenerate() {
  const mode = elements.mode?.value || 'syllables';
  let password = '';

  if (mode === 'syllables') {
    password = generateSimplePassword(parseInt(elements.length?.value) || 20);
  } else if (mode === 'passphrase') {
    password = generateSimplePassphrase(parseInt(elements.wordCount?.value) || 5);
  } else if (mode === 'leet') {
    password = leetSpeak(elements.leetWord?.value || 'password');
  }

  // Add digits and specials
  const digits = parseInt(elements.digits?.value) || 0;
  const specials = parseInt(elements.specials?.value) || 0;

  if (digits > 0) password += generateDigits(digits);
  if (specials > 0) password += generateSpecials(specials);

  if (elements.passwordOutput) elements.passwordOutput.value = password;
  elements.generatedPassword?.classList.remove('hidden');
}

function generateSimplePassword(length) {
  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiouy';
  let result = '';

  for (let i = 0; i < length; i++) {
    const chars = i % 2 === 0 ? consonants : vowels;
    const idx = crypto.getRandomValues(new Uint8Array(1))[0] % chars.length;
    let char = chars[idx];
    if (crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0) {
      char = char.toUpperCase();
    }
    result += char;
  }

  return result;
}

function generateSimplePassphrase(wordCount) {
  const words = ['Apple', 'Beach', 'Cloud', 'Dream', 'Eagle', 'Forest', 'Garden', 'Harbor',
    'Island', 'Jungle', 'Kingdom', 'Lemon', 'Mountain', 'Nature', 'Ocean', 'Planet',
    'River', 'Storm', 'Thunder', 'Valley', 'Winter', 'Yellow', 'Zenith', 'Bronze'];

  const selected = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = crypto.getRandomValues(new Uint8Array(1))[0] % words.length;
    selected.push(words[idx]);
  }

  return selected.join('-');
}

function leetSpeak(word) {
  const map = { a: '@', e: '3', i: '1', o: '0', s: '5', t: '7', l: '!', g: '9', b: '8' };
  return word.split('').map(c => map[c.toLowerCase()] || c).join('');
}

function generateDigits(count) {
  const digits = '0123456789';
  let result = '';
  const random = crypto.getRandomValues(new Uint8Array(count));
  for (let i = 0; i < count; i++) {
    result += digits[random[i] % digits.length];
  }
  return result;
}

function generateSpecials(count) {
  const specials = '!@#$%+-=_';
  let result = '';
  const random = crypto.getRandomValues(new Uint8Array(count));
  for (let i = 0; i < count; i++) {
    result += specials[random[i] % specials.length];
  }
  return result;
}

// ============================================================================
// SETTINGS
// ============================================================================

async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'autofillEnabled', 'showIcon', 'lockTimeout'
    ]);

    if (elements.settingAutofillEnabled) {
      elements.settingAutofillEnabled.checked = settings.autofillEnabled !== false;
    }
    if (elements.settingShowIcon) {
      elements.settingShowIcon.checked = settings.showIcon !== false;
    }
    if (elements.settingLockTimeout) {
      elements.settingLockTimeout.value = settings.lockTimeout || '300';
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      autofillEnabled: elements.settingAutofillEnabled?.checked,
      showIcon: elements.settingShowIcon?.checked,
      lockTimeout: parseInt(elements.settingLockTimeout?.value || '300')
    });
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

async function copyToClipboard(text) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    // Visual feedback
    const btn = document.activeElement;
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = original; }, 1000);
    }
  } catch (error) {
    console.error('Copy failed:', error);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// START
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
