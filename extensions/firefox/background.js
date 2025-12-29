/*
 * GenPwd Pro - Firefox Extension Background Script
 * Copyright 2025 Julien Bombled
 */

// Installation handler
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('GenPwd Pro installed');

    // Set default settings
    browser.storage.sync.set({
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
    // browser.tabs.create({ url: 'https://github.com/VBlackJack/genpwd-pro' });
  } else if (details.reason === 'update') {
    console.log('GenPwd Pro updated to version', browser.runtime.getManifest().version);
  }
});

// Context menu for password generation in input fields
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'generate-password',
    title: browser.i18n.getMessage('contextMenuGenerate'),
    contexts: ['editable']
  });
});

// Handle context menu click
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generate-password') {
    // Send message to content script to fill the field
    browser.tabs.sendMessage(tab.id, {
      action: 'fillPassword',
      target: info.editable
    });
  }
});

// Message handler
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // SECURITY: Validate message origin - must come from our own extension
  if (!sender || !sender.id || sender.id !== browser.runtime.id) {
    console.warn('GenPwd Pro: Rejected message from unauthorized sender:', sender);
    return Promise.resolve({ success: false, error: 'Unauthorized' });
  }

  // SECURITY: Validate that sender is from a tab (not external)
  if (!sender.tab && !sender.url) {
    console.warn('GenPwd Pro: Rejected message from non-tab context');
    return Promise.resolve({ success: false, error: browser.i18n.getMessage('errorInvalidContext') });
  }

  // SECURITY: Validate request structure
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') {
    console.warn('GenPwd Pro: Rejected malformed message');
    return Promise.resolve({ success: false, error: 'Malformed request' });
  }

  if (request.action === 'generatePassword') {
    // Generate password using stored settings
    return browser.storage.sync.get(['settings']).then((data) => {
      const settings = data.settings || {};
      return {
        success: true,
        password: generateSimplePassword(settings)
      };
    });
  }

  // Unknown action
  return Promise.resolve({ success: false, error: 'Unknown action' });
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

console.log('GenPwd Pro background script loaded');
