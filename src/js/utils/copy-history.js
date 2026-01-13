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
 * Copy History - BMAD UX Improvement
 * Tracks last 5 copied passwords in memory only (security)
 */

import { t } from './i18n.js';
import { copyToClipboard } from './secure-clipboard.js';
import { showToast } from './toast.js';

const MAX_HISTORY_SIZE = 5;

/** In-memory storage only (security) */
let copyHistory = [];

/** Popover element reference */
let popoverElement = null;
let isPopoverVisible = false;

/**
 * Add a password to copy history
 * @param {string} password - The copied password
 * @param {Object} metadata - Optional metadata (mode, timestamp)
 */
export function addToCopyHistory(password, metadata = {}) {
  if (!password) return;

  const entry = {
    password,
    timestamp: Date.now(),
    mode: metadata.mode || 'unknown',
    masked: maskPassword(password)
  };

  // Remove duplicate if exists
  copyHistory = copyHistory.filter(item => item.password !== password);

  // Add to beginning (most recent first)
  copyHistory.unshift(entry);

  // Keep only last MAX_HISTORY_SIZE entries
  if (copyHistory.length > MAX_HISTORY_SIZE) {
    copyHistory = copyHistory.slice(0, MAX_HISTORY_SIZE);
  }

  // Update popover if visible
  if (isPopoverVisible && popoverElement) {
    renderPopoverContent();
  }
}

/**
 * Get copy history
 * @returns {Array} Copy history entries
 */
export function getCopyHistory() {
  return [...copyHistory];
}

/**
 * Clear copy history
 */
export function clearCopyHistory() {
  copyHistory = [];
  if (isPopoverVisible && popoverElement) {
    renderPopoverContent();
  }
}

/**
 * Mask password for display (show first 2 and last 2 chars)
 * @param {string} password
 * @returns {string}
 */
function maskPassword(password) {
  if (password.length <= 6) {
    return '•'.repeat(password.length);
  }
  return password.slice(0, 2) + '•'.repeat(password.length - 4) + password.slice(-2);
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return t('copyHistory.justNow') || 'Just now';
  if (seconds < 3600) return t('copyHistory.minutesAgo', { count: Math.floor(seconds / 60) }) || `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return t('copyHistory.hoursAgo', { count: Math.floor(seconds / 3600) }) || `${Math.floor(seconds / 3600)}h ago`;
  return t('copyHistory.daysAgo', { count: Math.floor(seconds / 86400) }) || `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Create the popover element
 * @returns {HTMLElement}
 */
function createPopoverElement() {
  if (popoverElement) return popoverElement;

  popoverElement = document.createElement('div');
  popoverElement.className = 'copy-history-popover';
  popoverElement.setAttribute('role', 'dialog');
  popoverElement.setAttribute('aria-labelledby', 'copy-history-title');
  popoverElement.setAttribute('aria-modal', 'false');

  document.body.appendChild(popoverElement);

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPopoverVisible) {
      hidePopover();
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (isPopoverVisible && popoverElement && !popoverElement.contains(e.target)) {
      const trigger = document.querySelector('#btn-copy-history');
      if (trigger && !trigger.contains(e.target)) {
        hidePopover();
      }
    }
  });

  return popoverElement;
}

/**
 * Render popover content
 */
function renderPopoverContent() {
  if (!popoverElement) return;

  const history = getCopyHistory();

  if (history.length === 0) {
    popoverElement.innerHTML = `
      <div class="copy-history-header">
        <h3 id="copy-history-title" data-i18n="copyHistory.title">${t('copyHistory.title') || 'Recent Copies'}</h3>
        <button type="button" class="copy-history-close" aria-label="${t('common.close') || 'Close'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="copy-history-empty">
        <span>${t('copyHistory.empty') || 'No recent copies'}</span>
      </div>
    `;
  } else {
    const itemsHtml = history.map((entry, index) => `
      <div class="copy-history-item" data-index="${index}">
        <div class="copy-history-item-content">
          <span class="copy-history-password mono">${entry.masked}</span>
          <span class="copy-history-time">${formatRelativeTime(entry.timestamp)}</span>
        </div>
        <button type="button" class="copy-history-recall" data-index="${index}" aria-label="${t('copyHistory.recall') || 'Copy Again'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
        </button>
      </div>
    `).join('');

    popoverElement.innerHTML = `
      <div class="copy-history-header">
        <h3 id="copy-history-title">${t('copyHistory.title') || 'Recent Copies'}</h3>
        <button type="button" class="copy-history-close" aria-label="${t('common.close') || 'Close'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="copy-history-list">
        ${itemsHtml}
      </div>
      <div class="copy-history-footer">
        <button type="button" class="copy-history-clear">${t('copyHistory.clear') || 'Clear History'}</button>
      </div>
    `;
  }

  // Bind event handlers
  const closeBtn = popoverElement.querySelector('.copy-history-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePopover);
  }

  const clearBtn = popoverElement.querySelector('.copy-history-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearCopyHistory();
      showToast(t('copyHistory.cleared') || 'History cleared', 'info');
    });
  }

  const recallBtns = popoverElement.querySelectorAll('.copy-history-recall');
  recallBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index, 10);
      const entry = history[index];
      if (entry) {
        await copyToClipboard(entry.password, { skipHistory: true });
        showToast(t('copyHistory.recalled') || 'Password copied', 'success');
      }
    });
  });
}

/**
 * Position popover relative to trigger
 * @param {HTMLElement} trigger
 */
function positionPopover(trigger) {
  if (!popoverElement || !trigger) return;

  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popoverElement.getBoundingClientRect();

  // Position below trigger, aligned to right edge
  let top = triggerRect.bottom + 8;
  let left = triggerRect.right - popoverRect.width;

  // Prevent off-screen
  const padding = 16;
  if (left < padding) {
    left = padding;
  }
  if (top + popoverRect.height > window.innerHeight - padding) {
    top = triggerRect.top - popoverRect.height - 8;
  }

  popoverElement.style.top = `${top}px`;
  popoverElement.style.left = `${left}px`;
}

/**
 * Show the copy history popover
 * @param {HTMLElement} trigger - The trigger button
 */
export function showPopover(trigger) {
  createPopoverElement();
  renderPopoverContent();
  popoverElement.classList.add('visible');
  isPopoverVisible = true;

  // Position after content is rendered
  requestAnimationFrame(() => {
    positionPopover(trigger);
  });
}

/**
 * Hide the copy history popover
 */
export function hidePopover() {
  if (popoverElement) {
    popoverElement.classList.remove('visible');
  }
  isPopoverVisible = false;
}

/**
 * Toggle popover visibility
 * @param {HTMLElement} trigger
 */
export function togglePopover(trigger) {
  if (isPopoverVisible) {
    hidePopover();
  } else {
    showPopover(trigger);
  }
}

/**
 * Initialize copy history button in toolbar
 */
export function initCopyHistoryButton() {
  // Create button if not exists
  let btn = document.querySelector('#btn-copy-history');
  if (!btn) {
    // Find the copy all button to insert after
    const copyAllBtn = document.querySelector('#btn-copy-all');
    if (copyAllBtn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-copy-history';
      btn.className = 'btn ghost icon-btn copy-history-btn';
      btn.setAttribute('aria-label', t('copyHistory.title') || 'Recent Copies');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 8v4l3 3"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      `;

      // Insert after copy all button
      copyAllBtn.after(btn);
    }
  }

  if (btn) {
    btn.addEventListener('click', () => {
      togglePopover(btn);
      btn.setAttribute('aria-expanded', isPopoverVisible ? 'true' : 'false');
    });
  }
}

export default {
  addToCopyHistory,
  getCopyHistory,
  clearCopyHistory,
  showPopover,
  hidePopover,
  togglePopover,
  initCopyHistoryButton
};
