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
// src/js/utils/toast.js - Temporary notification system
import { safeLog } from './logger.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { i18n } from './i18n.js';

/** @type {Map<HTMLElement, {message: string, cleanup: Function}>} */
const activeToasts = new Map();

/** Maximum concurrent toasts */
const MAX_TOASTS = 3;

/** Recent messages for deduplication (message -> timestamp) */
const recentMessages = new Map();

/** Deduplication window in ms (reduced to allow rapid valid notifications) */
const DEDUPE_WINDOW = 500;

/**
 * Check if message was recently shown (deduplication)
 * @param {string} message
 * @returns {boolean}
 */
function isDuplicate(message) {
  const now = Date.now();
  // Clean old entries
  for (const [msg, timestamp] of recentMessages) {
    if (now - timestamp > DEDUPE_WINDOW) {
      recentMessages.delete(msg);
    }
  }
  return recentMessages.has(message);
}

/**
 * Displays a temporary toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
 * @param {Object} [options] - Additional options
 * @param {Object} [options.action] - Action button config
 * @param {string} [options.action.label] - Button label
 * @param {Function} [options.action.onClick] - Button click handler
 * @param {boolean} [options.persistent] - Don't auto-dismiss
 * @param {boolean} [options.dedupe=true] - Deduplicate similar messages
 * @returns {Function|undefined} Dismiss function for programmatic control
 */
export function showToast(message, type = 'info', options = {}) {
  // Input validation
  if (typeof message !== 'string' || message.trim().length === 0) {
    safeLog('showToast: message must be a non-empty string');
    return;
  }

  const validTypes = ['info', 'success', 'warning', 'error'];
  if (!validTypes.includes(type)) {
    safeLog(`showToast: invalid type "${type}", using "info"`);
    type = 'info';
  }

  // Deduplication check (skip for persistent or action toasts)
  const shouldDedupe = options.dedupe !== false && !options.persistent && !options.action;
  if (shouldDedupe && isDuplicate(message)) {
    safeLog('showToast: duplicate message suppressed');
    return;
  }

  const wrap = document.getElementById('toasts');
  if (!wrap) {
    safeLog('showToast: toasts container not found in DOM');
    return;
  }

  try {
    // Enforce max toasts limit - remove oldest if at limit
    if (activeToasts.size >= MAX_TOASTS) {
      const oldest = activeToasts.keys().next().value;
      if (oldest) {
        const oldestData = activeToasts.get(oldest);
        oldestData?.cleanup();
      }
    }

    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.setAttribute('role', 'alert');
    div.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    div.setAttribute('aria-atomic', 'true');

    // Set CSS variable for progress bar animation duration (sync with JS timeout)
    const displayTime = type === 'error' ? ANIMATION_DURATION.TOAST_DISPLAY_ERROR : ANIMATION_DURATION.TOAST_DISPLAY;
    div.style.setProperty('--toast-duration', `${displayTime}ms`);

    // Toast content
    const content = document.createElement('span');
    content.className = 'toast-message';
    content.textContent = message;
    div.appendChild(content);

    // Action button (optional)
    if (options.action?.label && typeof options.action.onClick === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-action';
      actionBtn.textContent = options.action.label;
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.action.onClick();
        dismiss();
      });
      div.appendChild(actionBtn);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', i18n.t('toast.dismiss'));
    closeBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    div.appendChild(closeBtn);

    wrap.appendChild(div);

    let timeoutId;
    let fadeTimeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearTimeout(fadeTimeoutId);
      activeToasts.delete(div);
      if (div.parentNode) div.remove();
    };

    const dismiss = () => {
      if (!div.parentNode) return;
      div.classList.add('toast-hiding');
      setTimeout(cleanup, ANIMATION_DURATION.TOAST_FADE_OUT);
    };

    activeToasts.set(div, { message, cleanup });

    // Track for deduplication
    if (shouldDedupe) {
      recentMessages.set(message, Date.now());
    }

    // Close button handler
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    // Auto-dismiss (unless persistent)
    if (!options.persistent) {
      const displayTime = type === 'error' ? ANIMATION_DURATION.TOAST_DISPLAY_ERROR : ANIMATION_DURATION.TOAST_DISPLAY;
      timeoutId = setTimeout(() => {
        if (div.parentNode) {
          div.classList.add('toast-hiding');
        }
      }, displayTime);
      fadeTimeoutId = setTimeout(cleanup, displayTime + ANIMATION_DURATION.TOAST_FADE_OUT);
    }

    // Return dismiss function for programmatic control
    return dismiss;
  } catch (e) {
    safeLog(`showToast error: ${e.message}`);
  }
}

/**
 * Removes all active toasts from the DOM
 */
export function clearAllToasts() {
  try {
    activeToasts.forEach(({ cleanup }) => cleanup());
    activeToasts.clear();
  } catch (e) {
    safeLog(`clearAllToasts error: ${e.message}`);
  }
}

/**
 * Show a toast with an undo action
 * @param {string} message - Message to display
 * @param {Function} onUndo - Function to call on undo
 */
export function showUndoToast(message, onUndo) {
  return showToast(message, 'info', {
    action: {
      label: i18n.t('toast.undo'),
      onClick: onUndo
    },
    dedupe: false
  });
}
