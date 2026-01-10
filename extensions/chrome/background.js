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
 * @fileoverview Background service worker for GenPwd Pro Chrome extension
 * Handles messaging, context menus, and native messaging to Windows app
 */

import nativeClient from './native/native-client.js';

// ============================================================================
// INSTALLATION
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('GenPwd Pro extension installed');

    // Set default settings
    chrome.storage.local.set({
      autofillEnabled: true,
      showIcon: true,
      lockTimeout: 300
    });

    // Create context menu
    createContextMenus();
  } else if (details.reason === 'update') {
    console.log('GenPwd Pro updated to', chrome.runtime.getManifest().version);
    createContextMenus();
  }
});

// ============================================================================
// CONTEXT MENUS
// ============================================================================

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'genpwd-fill',
      title: chrome.i18n.getMessage('contextMenuFill') || 'Fill with GenPwd Pro',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'genpwd-generate',
      title: chrome.i18n.getMessage('contextMenuGenerate') || 'Generate password',
      contexts: ['editable']
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    if (info.menuItemId === 'genpwd-fill') {
      // Open popup to select entry
      chrome.action.openPopup();
    } else if (info.menuItemId === 'genpwd-generate') {
      // Generate and fill a simple password
      const password = generateSimplePassword(20);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_CREDENTIALS',
        credentials: { password }
      });
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
  }
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender
  if (!sender?.id || sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized' });
    return false;
  }

  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_VAULT_STATUS':
      return handleGetVaultStatus();

    case 'GET_ENTRIES':
      return handleGetEntries();

    case 'GET_ENTRIES_FOR_URL':
      return handleGetEntriesForUrl(message.url);

    case 'GET_ENTRIES_FOR_DOMAIN':
      return handleGetEntriesForDomain(message.domain);

    case 'SEARCH_ENTRIES':
      return handleSearchEntries(message.query);

    case 'GET_ENTRY':
      return handleGetEntry(message.id);

    case 'GET_TOTP':
      return handleGetTOTP(message.id);

    case 'FILL_ENTRY':
      return handleFillEntry(message.entryId, sender.tab);

    case 'OPEN_POPUP':
      chrome.action.openPopup();
      return { success: true };

    case 'NATIVE_CONNECT':
      return handleNativeConnect();

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function handleNativeConnect() {
  try {
    const connected = await nativeClient.connect();
    if (connected) {
      const status = await nativeClient.getStatus();
      return { success: true, ...status };
    }
    const state = nativeClient.getConnectionState();
    return { success: false, error: state.error || 'Failed to connect' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetVaultStatus() {
  try {
    if (!nativeClient.isConnected()) {
      const connected = await nativeClient.connect();
      if (!connected) {
        const state = nativeClient.getConnectionState();
        return { connected: false, unlocked: false, error: state.error };
      }
    }
    const status = await nativeClient.getStatus();
    const unlocked = await nativeClient.isUnlocked();
    return {
      connected: true,
      unlocked: unlocked.unlocked,
      status: status.status,
      vaultName: status.vaultName
    };
  } catch (error) {
    return { connected: false, unlocked: false, error: error.message };
  }
}

async function handleGetEntries() {
  try {
    const result = await nativeClient.getEntries();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetEntriesForUrl(url) {
  try {
    // Extract domain from URL
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return await handleGetEntriesForDomain(domain);
  } catch (error) {
    return { success: false, entries: [], error: error.message };
  }
}

async function handleGetEntriesForDomain(domain) {
  try {
    const result = await nativeClient.getEntriesForDomain(domain);
    return result;
  } catch (error) {
    return { success: false, entries: [], error: error.message };
  }
}

async function handleSearchEntries(query) {
  try {
    const result = await nativeClient.searchEntries(query);
    return result;
  } catch (error) {
    return { success: false, entries: [], error: error.message };
  }
}

async function handleGetEntry(id) {
  try {
    const result = await nativeClient.getEntry(id);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetTOTP(id) {
  try {
    const result = await nativeClient.getTOTP(id);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFillEntry(entryId, tab) {
  if (!tab?.id) {
    return { success: false, error: 'No active tab' };
  }

  try {
    // Get full entry with password
    const result = await nativeClient.getEntry(entryId);
    if (!result.success || !result.entry) {
      return { success: false, error: result.error || 'Entry not found' };
    }

    const entry = result.entry;
    const credentials = {
      username: entry.username,
      password: entry.password
    };

    // Get TOTP if available
    if (entry.hasTotp) {
      const totpResult = await nativeClient.getTOTP(entryId);
      if (totpResult.success) {
        credentials.otp = totpResult.code;
      }
    }

    // Send to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_CREDENTIALS',
      credentials
    });

    // Notify app for audit
    await nativeClient.notifyFill(entryId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PASSWORD GENERATION
// ============================================================================

function generateSimplePassword(length = 20) {
  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiouy';
  const digits = '0123456789';
  const specials = '!@#$%+-=_';

  let result = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(length + 4));
  let byteIndex = 0;

  // Generate syllable-based password
  for (let i = 0; i < length - 4; i++) {
    const chars = i % 2 === 0 ? consonants : vowels;
    const idx = randomBytes[byteIndex++] % chars.length;
    let char = chars[idx];
    if (randomBytes[byteIndex++ % randomBytes.length] % 2 === 0) {
      char = char.toUpperCase();
    }
    result += char;
  }

  // Add 2 digits
  result += digits[randomBytes[byteIndex++] % digits.length];
  result += digits[randomBytes[byteIndex++] % digits.length];

  // Add 2 specials
  result += specials[randomBytes[byteIndex++] % specials.length];
  result += specials[randomBytes[byteIndex++] % specials.length];

  return result;
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'open-popup') {
    chrome.action.openPopup();
  } else if (command === 'fill-credentials') {
    // Get active tab and try to fill
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.action.openPopup();
      }
    });
  }
});

// ============================================================================
// STARTUP
// ============================================================================

console.log('GenPwd Pro background service worker loaded');
