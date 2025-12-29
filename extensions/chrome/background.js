/*
 * GenPwd Pro - Chrome Extension Background Service Worker
 * Copyright 2025 Julien Bombled
 */

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('GenPwd Pro installed');

    // Set default settings
    chrome.storage.sync.set({
      settings: {
        mode: 'syllables',
        length: 20,
        policy: 'standard',
        wordCount: 5,
        separator: '-',
        dictionary: 'french',
        leetWord: 'password',
        digits: 2,
        specials: 2,
        caseMode: 'mixte',
        quantity: 5
      }
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://github.com/VBlackJack/genpwd-pro' });
  } else if (details.reason === 'update') {
    console.log('GenPwd Pro updated to version', chrome.runtime.getManifest().version);
  }
});

// Context menu for password generation in input fields
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generate-password',
    title: chrome.i18n.getMessage('contextMenuGenerate'),
    contexts: ['editable']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generate-password') {
    // Send message to content script to fill the field
    chrome.tabs.sendMessage(tab.id, {
      action: 'fillPassword',
      target: info.editable
    });
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // SECURITY: Validate message origin - must come from our own extension
  if (!sender || !sender.id || sender.id !== chrome.runtime.id) {
    console.warn('GenPwd Pro: Rejected message from unauthorized sender:', sender);
    sendResponse({ success: false, error: 'Unauthorized' });
    return false;
  }

  // SECURITY: Validate that sender is from a tab (not external)
  if (!sender.tab && !sender.url) {
    console.warn('GenPwd Pro: Rejected message from non-tab context');
    sendResponse({ success: false, error: 'Invalid context' });
    return false;
  }

  // SECURITY: Validate request structure
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') {
    console.warn('GenPwd Pro: Rejected malformed message');
    sendResponse({ success: false, error: 'Malformed request' });
    return false;
  }

  if (request.action === 'generatePassword') {
    // Generate password using stored settings
    chrome.storage.sync.get(['settings'], (data) => {
      const settings = data.settings || {};

      // Here you would call the generator
      // For now, return a simple password
      sendResponse({
        success: true,
        password: generateSimplePassword(settings)
      });
    });

    return true; // Keep the message channel open for async response
  }

  // Unknown action
  sendResponse({ success: false, error: 'Unknown action' });
  return false;
});

function generateSimplePassword(settings) {
  const length = settings.length || 20;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }

  return password;
}

console.log('GenPwd Pro background service worker loaded');
