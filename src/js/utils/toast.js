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

const activeToasts = new Set();

/**
 * Displays a temporary toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
 * @throws {Error} If message is not a string
 */
export function showToast(message, type = 'info') {
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

  const wrap = document.getElementById('toasts');
  if (!wrap) {
    safeLog('showToast: toasts container not found in DOM');
    return;
  }

  try {
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.setAttribute('role', 'alert');
    div.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    // Toast content with close button
    const content = document.createElement('span');
    content.className = 'toast-message';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    div.appendChild(content);
    div.appendChild(closeBtn);

    activeToasts.add(div);
    wrap.appendChild(div);

    let timeoutId;
    let fadeTimeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearTimeout(fadeTimeoutId);
      activeToasts.delete(div);
      if (div.parentNode) div.remove();
    };

    // Close button handler
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      div.classList.add('toast-hiding');
      setTimeout(cleanup, ANIMATION_DURATION.TOAST_FADE_OUT);
    });

    // Auto-dismiss
    timeoutId = setTimeout(() => {
      if (div.parentNode) {
        div.classList.add('toast-hiding');
      }
    }, type === 'error' ? ANIMATION_DURATION.TOAST_DISPLAY_ERROR : ANIMATION_DURATION.TOAST_DISPLAY);

    fadeTimeoutId = setTimeout(cleanup, (type === 'error' ? ANIMATION_DURATION.TOAST_DISPLAY_ERROR : ANIMATION_DURATION.TOAST_DISPLAY) + ANIMATION_DURATION.TOAST_FADE_OUT);
  } catch (e) {
    safeLog(`showToast error: ${e.message}`);
  }
}

/**
 * Removes all active toasts from the DOM
 */
export function clearAllToasts() {
  try {
    activeToasts.forEach(toast => {
      if (toast.parentNode) {
        toast.remove();
      }
    });
    activeToasts.clear();
  } catch (e) {
    safeLog(`clearAllToasts error: ${e.message}`);
  }
}
