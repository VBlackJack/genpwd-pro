/*
 * GenPwd Pro - Chrome Extension Content Script
 * Copyright 2025 Julien Bombled
 */

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillPassword') {
    fillActiveElement();
    sendResponse({ success: true });
  }
});

function fillActiveElement() {
  const activeElement = document.activeElement;

  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    // Request password generation from background
    chrome.runtime.sendMessage({ action: 'generatePassword' }, (response) => {
      if (response && response.success) {
        activeElement.value = response.password;

        // Trigger change event
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Visual feedback
        const originalBorder = activeElement.style.border;
        activeElement.style.border = '2px solid #50C878';

        setTimeout(() => {
          activeElement.style.border = originalBorder;
        }, 1000);
      }
    });
  }
}

// Auto-detect password fields and add a button
function enhancePasswordFields() {
  const passwordFields = document.querySelectorAll('input[type="password"]');

  passwordFields.forEach(field => {
    if (field.dataset.genpwdEnhanced) return;

    field.dataset.genpwdEnhanced = 'true';

    // Add a small icon next to the field (optional feature)
    const icon = document.createElement('span');
    icon.textContent = '🔐';
    icon.style.cssText = `
      cursor: pointer;
      margin-left: 5px;
      font-size: 16px;
      user-select: none;
    `;
    icon.title = 'Générer un mot de passe sécurisé';

    icon.addEventListener('click', () => {
      field.focus();
      fillActiveElement();
    });

    if (field.parentElement) {
      field.parentElement.insertBefore(icon, field.nextSibling);
    }
  });
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhancePasswordFields);
} else {
  enhancePasswordFields();
}

// Watch for dynamically added password fields
const observer = new MutationObserver(() => {
  enhancePasswordFields();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('GenPwd Pro content script loaded');
