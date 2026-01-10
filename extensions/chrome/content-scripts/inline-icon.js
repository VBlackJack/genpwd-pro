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
 * @fileoverview Inline autofill icon that appears near input fields
 */

const ICON_ID = 'genpwd-autofill-icon';
const DROPDOWN_ID = 'genpwd-autofill-dropdown';

let currentIcon = null;
let currentDropdown = null;
let currentField = null;

/**
 * Create the autofill icon SVG
 * @returns {string}
 */
function getIconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path fill="currentColor" d="M12 1C8.676 1 6 3.676 6 7v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-1V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
  </svg>`;
}

/**
 * Create and inject styles
 */
function injectStyles() {
  if (document.getElementById('genpwd-autofill-styles')) return;

  const style = document.createElement('style');
  style.id = 'genpwd-autofill-styles';
  style.textContent = `
    #${ICON_ID} {
      position: absolute;
      width: 24px;
      height: 24px;
      padding: 2px;
      cursor: pointer;
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s;
      color: #6366f1;
    }
    #${ICON_ID}:hover {
      background: #6366f1;
      color: #fff;
      border-color: #6366f1;
    }
    #${DROPDOWN_ID} {
      position: absolute;
      min-width: 280px;
      max-width: 350px;
      max-height: 300px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    }
    .genpwd-dropdown-header {
      padding: 12px;
      border-bottom: 1px solid #eee;
      font-weight: 600;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .genpwd-dropdown-header svg {
      width: 20px;
      height: 20px;
      color: #6366f1;
    }
    .genpwd-entry-item {
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #f3f4f6;
    }
    .genpwd-entry-item:last-child {
      border-bottom: none;
    }
    .genpwd-entry-item:hover {
      background: #f3f4f6;
    }
    .genpwd-entry-favicon {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      object-fit: contain;
    }
    .genpwd-entry-info {
      flex: 1;
      min-width: 0;
    }
    .genpwd-entry-title {
      font-weight: 500;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .genpwd-entry-username {
      font-size: 12px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .genpwd-entry-otp {
      font-size: 11px;
      color: #6366f1;
      background: #eef2ff;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .genpwd-no-entries {
      padding: 20px;
      text-align: center;
      color: #6b7280;
    }
    .genpwd-locked {
      padding: 20px;
      text-align: center;
    }
    .genpwd-locked-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .genpwd-unlock-btn {
      margin-top: 10px;
      padding: 8px 16px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .genpwd-unlock-btn:hover {
      background: #4f46e5;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Position the icon relative to a field
 * @param {HTMLElement} icon
 * @param {HTMLInputElement} field
 */
function positionIcon(icon, field) {
  const rect = field.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  icon.style.top = `${rect.top + scrollY + (rect.height - 24) / 2}px`;
  icon.style.left = `${rect.right + scrollX - 30}px`;
}

/**
 * Position the dropdown below the icon
 * @param {HTMLElement} dropdown
 * @param {HTMLElement} icon
 */
function positionDropdown(dropdown, icon) {
  const iconRect = icon.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  dropdown.style.top = `${iconRect.bottom + scrollY + 4}px`;
  dropdown.style.left = `${iconRect.left + scrollX - 250}px`;

  // Adjust if off-screen
  const dropdownRect = dropdown.getBoundingClientRect();
  if (dropdownRect.right > window.innerWidth) {
    dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10 + scrollX}px`;
  }
  if (dropdownRect.left < 0) {
    dropdown.style.left = `${10 + scrollX}px`;
  }
}

/**
 * Show the autofill icon near a field
 * @param {HTMLInputElement} field
 */
export function showIcon(field) {
  if (currentField === field && currentIcon) return;

  hideIcon();
  injectStyles();

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

  // Reposition on scroll/resize
  window.addEventListener('scroll', repositionIcon, { passive: true });
  window.addEventListener('resize', repositionIcon, { passive: true });
}

/**
 * Hide the autofill icon
 */
export function hideIcon() {
  if (currentIcon) {
    currentIcon.remove();
    currentIcon = null;
  }
  hideDropdown();
  currentField = null;
  window.removeEventListener('scroll', repositionIcon);
  window.removeEventListener('resize', repositionIcon);
}

/**
 * Reposition icon after scroll/resize
 */
function repositionIcon() {
  if (currentIcon && currentField) {
    positionIcon(currentIcon, currentField);
  }
  if (currentDropdown && currentIcon) {
    positionDropdown(currentDropdown, currentIcon);
  }
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown() {
  if (currentDropdown) {
    hideDropdown();
  } else {
    showDropdown();
  }
}

/**
 * Show the entry dropdown
 */
function showDropdown() {
  if (!currentIcon) return;

  currentDropdown = document.createElement('div');
  currentDropdown.id = DROPDOWN_ID;

  // Request entries from background
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

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

/**
 * Hide the dropdown
 */
function hideDropdown() {
  if (currentDropdown) {
    currentDropdown.remove();
    currentDropdown = null;
  }
  document.removeEventListener('click', handleOutsideClick);
}

/**
 * Handle click outside dropdown
 * @param {Event} e
 */
function handleOutsideClick(e) {
  if (currentDropdown && !currentDropdown.contains(e.target) &&
      currentIcon && !currentIcon.contains(e.target)) {
    hideDropdown();
  }
}

/**
 * Render entries in dropdown
 * @param {Array} entries
 */
function renderEntries(entries) {
  if (!currentDropdown) return;

  currentDropdown.innerHTML = `
    <div class="genpwd-dropdown-header">
      ${getIconSVG()}
      <span>GenPwd Pro</span>
    </div>
  `;

  entries.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'genpwd-entry-item';
    item.innerHTML = `
      <img class="genpwd-entry-favicon" src="${entry.favicon || ''}" onerror="this.style.display='none'">
      <div class="genpwd-entry-info">
        <div class="genpwd-entry-title">${escapeHtml(entry.title)}</div>
        <div class="genpwd-entry-username">${escapeHtml(entry.username || '')}</div>
      </div>
      ${entry.hasOtp ? '<span class="genpwd-entry-otp">OTP</span>' : ''}
    `;

    item.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'FILL_ENTRY',
        entryId: entry.id
      });
      hideDropdown();
    });

    currentDropdown.appendChild(item);
  });
}

/**
 * Render locked state
 */
function renderLockedState() {
  if (!currentDropdown) return;

  currentDropdown.innerHTML = `
    <div class="genpwd-locked">
      <div class="genpwd-locked-icon">🔒</div>
      <div>Vault is locked</div>
      <button class="genpwd-unlock-btn">Unlock</button>
    </div>
  `;

  currentDropdown.querySelector('.genpwd-unlock-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    hideDropdown();
  });
}

/**
 * Render no entries state
 */
function renderNoEntries() {
  if (!currentDropdown) return;

  currentDropdown.innerHTML = `
    <div class="genpwd-dropdown-header">
      ${getIconSVG()}
      <span>GenPwd Pro</span>
    </div>
    <div class="genpwd-no-entries">No matching entries found</div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
