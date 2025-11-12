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
// src/js/utils/toast.js - Système de notifications temporaires
import { safeLog } from './logger.js';

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
    div.textContent = message;

    activeToasts.add(div);
    wrap.appendChild(div);

    const cleanup = () => {
      activeToasts.delete(div);
      if (div.parentNode) div.remove();
    };

    setTimeout(() => {
      if (div.parentNode) {
        div.classList.add('toast-hiding');
      }
    }, 3200);

    setTimeout(cleanup, 3600);
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
