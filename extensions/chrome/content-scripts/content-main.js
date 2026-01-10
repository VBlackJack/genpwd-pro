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
 * @fileoverview Content script main entry point
 * Initializes form detection and autofill functionality
 */

(function() {
  'use strict';

  // ============================================================================
  // FORM DETECTOR
  // ============================================================================

  const USERNAME_SELECTORS = [
    'input[type="email"]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][name*="account" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[name="identifier"]'
  ];

  const PASSWORD_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[autocomplete="new-password"]'
  ];

  const OTP_SELECTORS = [
    'input[name*="otp" i]',
    'input[name*="totp" i]',
    'input[name*="2fa" i]',
    'input[name*="code" i]',
    'input[name*="token" i]',
    'input[name*="verification" i]',
    'input[id*="otp" i]',
    'input[id*="totp" i]',
    'input[id*="2fa" i]',
    'input[autocomplete="one-time-code"]',
    'input[maxlength="6"][type="text"]',
    'input[maxlength="6"][type="tel"]',
    'input[maxlength="6"][type="number"]'
  ];

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findFields(selectors, container = document) {
    const fields = [];
    const seen = new Set();
    for (const selector of selectors) {
      try {
        const elements = container.querySelectorAll(selector);
        for (const element of elements) {
          if (!seen.has(element) && isVisible(element) && !element.disabled && !element.readOnly) {
            seen.add(element);
            fields.push(element);
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }
    return fields;
  }

  function detectLoginFields() {
    const result = { username: null, password: null, otp: null, form: null };

    const passwordFields = findFields(PASSWORD_SELECTORS);
    if (passwordFields.length > 0) {
      result.password = passwordFields[0];
      result.form = result.password.closest('form');
    }

    const usernameFields = findFields(USERNAME_SELECTORS);
    if (usernameFields.length > 0) {
      if (result.form) {
        const inForm = usernameFields.find(f => result.form.contains(f));
        result.username = inForm || usernameFields[0];
      } else {
        result.username = usernameFields[0];
        result.form = result.username.closest('form');
      }
    }

    const otpFields = findFields(OTP_SELECTORS);
    if (otpFields.length > 0) {
      const pureOtp = otpFields.filter(f => {
        const name = (f.name || f.id || '').toLowerCase();
        return !name.includes('user') && !name.includes('email') && !name.includes('password');
      });
      result.otp = pureOtp[0] || otpFields[0];
    }

    return result;
  }

  function findSubmitButton(formOrField) {
    const form = formOrField instanceof HTMLFormElement
      ? formOrField
      : formOrField?.closest('form');

    if (!form) return null;

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn && isVisible(submitBtn)) return submitBtn;

    const buttons = form.querySelectorAll('button, input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('login') || text.includes('sign in') || text.includes('submit') ||
          text.includes('connexion') || text.includes('connecter')) {
        if (isVisible(btn)) return btn;
      }
    }

    for (const btn of buttons) {
      if (isVisible(btn)) return btn;
    }

    return null;
  }

  function watchForFields(callback) {
    let lastFields = JSON.stringify(detectLoginFields());

    const observer = new MutationObserver(() => {
      const currentFields = JSON.stringify(detectLoginFields());
      if (currentFields !== lastFields) {
        lastFields = currentFields;
        callback(detectLoginFields());
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type', 'style', 'class', 'disabled', 'readonly']
    });

    return () => observer.disconnect();
  }

  // ============================================================================
  // AUTOFILL ENGINE
  // ============================================================================

  function fillField(field, value) {
    if (!field || !value) return;

    field.focus();
    field.value = '';
    field.value = value;

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }

    field.blur();
  }

  function fillCredentials(credentials, options = {}) {
    const result = { filled: [], errors: [] };
    const fields = detectLoginFields();

    if (credentials.username && fields.username) {
      try {
        fillField(fields.username, credentials.username);
        result.filled.push('username');
      } catch (e) {
        result.errors.push(`Username: ${e.message}`);
      }
    }

    if (credentials.password && fields.password) {
      try {
        fillField(fields.password, credentials.password);
        result.filled.push('password');
      } catch (e) {
        result.errors.push(`Password: ${e.message}`);
      }
    }

    if (credentials.otp && fields.otp) {
      try {
        fillField(fields.otp, credentials.otp);
        result.filled.push('otp');
      } catch (e) {
        result.errors.push(`OTP: ${e.message}`);
      }
    }

    if (options.autoSubmit && result.filled.length > 0 && result.errors.length === 0) {
      const form = fields.form || fields.password?.closest('form') || fields.username?.closest('form');
      if (form) {
        setTimeout(() => {
          const submitBtn = findSubmitButton(form);
          if (submitBtn) {
            submitBtn.click();
          } else {
            form.submit();
          }
        }, 100);
      }
    }

    return result;
  }

  function fillOTP(otp) {
    const fields = detectLoginFields();
    if (fields.otp) {
      fillField(fields.otp, otp);
      return true;
    }
    return false;
  }

  // ============================================================================
  // INLINE ICON
  // ============================================================================

  const ICON_ID = 'genpwd-autofill-icon';
  const DROPDOWN_ID = 'genpwd-autofill-dropdown';

  let currentIcon = null;
  let currentDropdown = null;
  let currentField = null;

  function getIconSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 1C8.676 1 6 3.676 6 7v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-1V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
    </svg>`;
  }

  function positionIcon(icon, field) {
    const rect = field.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    icon.style.top = `${rect.top + scrollY + (rect.height - 20) / 2}px`;
    icon.style.left = `${rect.right + scrollX - 26}px`;
  }

  function positionDropdown(dropdown, icon) {
    const iconRect = icon.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    dropdown.style.top = `${iconRect.bottom + scrollY + 4}px`;
    dropdown.style.left = `${iconRect.left + scrollX - 250}px`;

    const dropdownRect = dropdown.getBoundingClientRect();
    if (dropdownRect.right > window.innerWidth) {
      dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10 + scrollX}px`;
    }
    if (dropdownRect.left < 0) {
      dropdown.style.left = `${10 + scrollX}px`;
    }
  }

  function showIcon(field) {
    if (currentField === field && currentIcon) return;

    hideIcon();
    currentField = field;

    currentIcon = document.createElement('div');
    currentIcon.id = ICON_ID;
    currentIcon.innerHTML = getIconSVG();
    currentIcon.title = 'GenPwd Pro Autofill';

    currentIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    });

    document.body.appendChild(currentIcon);
    positionIcon(currentIcon, field);

    window.addEventListener('scroll', repositionIcon, { passive: true });
    window.addEventListener('resize', repositionIcon, { passive: true });
  }

  function hideIcon() {
    if (currentIcon) {
      currentIcon.remove();
      currentIcon = null;
    }
    hideDropdown();
    currentField = null;
    window.removeEventListener('scroll', repositionIcon);
    window.removeEventListener('resize', repositionIcon);
  }

  function repositionIcon() {
    if (currentIcon && currentField) {
      positionIcon(currentIcon, currentField);
    }
    if (currentDropdown && currentIcon) {
      positionDropdown(currentDropdown, currentIcon);
    }
  }

  function toggleDropdown() {
    if (currentDropdown) {
      hideDropdown();
    } else {
      showDropdown();
    }
  }

  function showDropdown() {
    if (!currentIcon) return;

    currentDropdown = document.createElement('div');
    currentDropdown.id = DROPDOWN_ID;

    chrome.runtime.sendMessage({ type: 'GET_ENTRIES_FOR_URL', url: window.location.href }, (response) => {
      if (!currentDropdown) return;

      if (response?.locked) {
        renderLockedState();
      } else if (response?.entries?.length > 0) {
        renderEntries(response.entries);
      } else {
        renderNoEntries();
      }
    });

    document.body.appendChild(currentDropdown);
    positionDropdown(currentDropdown, currentIcon);

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
  }

  function hideDropdown() {
    if (currentDropdown) {
      currentDropdown.remove();
      currentDropdown = null;
    }
    document.removeEventListener('click', handleOutsideClick);
  }

  function handleOutsideClick(e) {
    if (currentDropdown && !currentDropdown.contains(e.target) &&
        currentIcon && !currentIcon.contains(e.target)) {
      hideDropdown();
    }
  }

  function renderEntries(entries) {
    if (!currentDropdown) return;

    currentDropdown.innerHTML = `
      <div class="genpwd-dropdown-header">
        <div class="genpwd-dropdown-title">GenPwd Pro</div>
      </div>
      <div class="genpwd-entries-list"></div>
    `;

    const list = currentDropdown.querySelector('.genpwd-entries-list');

    entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'genpwd-entry-item';
      item.innerHTML = `
        <img class="genpwd-entry-favicon" src="${escapeHtml(entry.favicon || '')}" onerror="this.style.display='none'">
        <div class="genpwd-entry-info">
          <div class="genpwd-entry-title">${escapeHtml(entry.title)}</div>
          <div class="genpwd-entry-username">${escapeHtml(entry.username || '')}</div>
        </div>
        ${entry.hasOtp ? '<span class="genpwd-otp-badge">OTP</span>' : ''}
      `;

      item.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'FILL_ENTRY',
          entryId: entry.id
        });
        hideDropdown();
      });

      list.appendChild(item);
    });
  }

  function renderLockedState() {
    if (!currentDropdown) return;

    currentDropdown.innerHTML = `
      <div class="genpwd-locked-state">
        <div class="genpwd-locked-icon">🔒</div>
        <div class="genpwd-locked-text">Vault is locked</div>
        <button class="genpwd-unlock-btn">Unlock</button>
      </div>
    `;

    currentDropdown.querySelector('.genpwd-unlock-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
      hideDropdown();
    });
  }

  function renderNoEntries() {
    if (!currentDropdown) return;

    currentDropdown.innerHTML = `
      <div class="genpwd-dropdown-header">
        <div class="genpwd-dropdown-title">GenPwd Pro</div>
      </div>
      <div class="genpwd-empty-state">
        <div class="genpwd-empty-icon">🔍</div>
        <div class="genpwd-empty-text">No matching entries</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================================
  // MAIN INITIALIZATION
  // ============================================================================

  let isEnabled = true;
  let lastFocusedField = null;

  function init() {
    chrome.storage.local.get(['autofillEnabled'], (result) => {
      isEnabled = result.autofillEnabled !== false;
      if (isEnabled) {
        setupFieldListeners();
        watchForFields(onFieldsChanged);
      }
    });

    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.autofillEnabled) {
        isEnabled = changes.autofillEnabled.newValue !== false;
        if (!isEnabled) {
          hideIcon();
        }
      }
    });
  }

  function setupFieldListeners() {
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
  }

  function handleFocusIn(e) {
    if (!isEnabled) return;

    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;

    const fields = detectLoginFields();

    if (target === fields.username || target === fields.password || target === fields.otp) {
      lastFocusedField = target;
      showIcon(target);
    }
  }

  function handleFocusOut(e) {
    setTimeout(() => {
      const activeElement = document.activeElement;
      const fields = detectLoginFields();

      if (activeElement !== fields.username &&
          activeElement !== fields.password &&
          activeElement !== fields.otp) {
        const dropdown = document.getElementById(DROPDOWN_ID);
        if (!dropdown || !dropdown.contains(activeElement)) {
          setTimeout(() => {
            if (document.activeElement !== fields.username &&
                document.activeElement !== fields.password &&
                document.activeElement !== fields.otp) {
              hideIcon();
            }
          }, 200);
        }
      }
    }, 100);
  }

  function onFieldsChanged(fields) {
    if (document.activeElement === fields.username ||
        document.activeElement === fields.password ||
        document.activeElement === fields.otp) {
      showIcon(document.activeElement);
    }
  }

  function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'FILL_CREDENTIALS':
        const result = fillCredentials(message.credentials, message.options);
        sendResponse(result);
        break;

      case 'FILL_OTP':
        const otpResult = fillOTP(message.otp);
        sendResponse({ success: otpResult });
        break;

      case 'GET_PAGE_INFO':
        const fields = detectLoginFields();
        sendResponse({
          url: window.location.href,
          title: document.title,
          hasUsernameField: !!fields.username,
          hasPasswordField: !!fields.password,
          hasOtpField: !!fields.otp
        });
        break;

      case 'PING':
        sendResponse({ pong: true });
        break;
    }

    return true;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
