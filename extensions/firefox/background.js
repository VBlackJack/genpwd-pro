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
    title: 'Générer un mot de passe',
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
