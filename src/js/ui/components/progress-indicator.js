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
 * Progress Indicator Component - BMAD UX Improvement
 * Shows progress for long-running operations like export/import
 */

import { t } from '../../utils/i18n.js';

let progressOverlay = null;
let abortController = null;

/**
 * Create the progress overlay element
 * @returns {HTMLElement}
 */
function createOverlay() {
  if (progressOverlay) return progressOverlay;

  progressOverlay = document.createElement('div');
  progressOverlay.className = 'progress-overlay';
  progressOverlay.setAttribute('role', 'dialog');
  progressOverlay.setAttribute('aria-labelledby', 'progress-title');
  progressOverlay.setAttribute('aria-modal', 'true');

  progressOverlay.innerHTML = `
    <div class="progress-modal">
      <div class="progress-header">
        <h3 id="progress-title" class="progress-title"></h3>
      </div>
      <div class="progress-body">
        <div class="progress-bar-container">
          <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar-fill"></div>
          </div>
          <span class="progress-percentage">0%</span>
        </div>
        <div class="progress-message"></div>
        <div class="progress-stats">
          <span class="progress-current">0</span> / <span class="progress-total">0</span>
        </div>
      </div>
      <div class="progress-footer">
        <button type="button" class="btn ghost progress-cancel">${t('common.cancel') || 'Cancel'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(progressOverlay);

  // Bind cancel button
  const cancelBtn = progressOverlay.querySelector('.progress-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (abortController) {
        abortController.abort();
      }
      hide();
    });
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && progressOverlay?.classList.contains('visible')) {
      if (abortController) {
        abortController.abort();
      }
      hide();
    }
  });

  return progressOverlay;
}

/**
 * Show progress indicator
 * @param {Object} options - Configuration options
 * @param {string} options.title - Title text
 * @param {string} options.message - Initial message
 * @param {number} options.total - Total items to process
 * @param {boolean} options.cancellable - Whether operation can be cancelled
 * @returns {Object} Progress controller
 */
export function show(options = {}) {
  const {
    title = t('progress.processing') || 'Processing...',
    message = '',
    total = 100,
    cancellable = true
  } = options;

  const overlay = createOverlay();

  // Reset state
  abortController = new AbortController();

  // Update content
  const titleEl = overlay.querySelector('.progress-title');
  const messageEl = overlay.querySelector('.progress-message');
  const barFill = overlay.querySelector('.progress-bar-fill');
  const bar = overlay.querySelector('.progress-bar');
  const percentEl = overlay.querySelector('.progress-percentage');
  const currentEl = overlay.querySelector('.progress-current');
  const totalEl = overlay.querySelector('.progress-total');
  const cancelBtn = overlay.querySelector('.progress-cancel');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (barFill) barFill.style.width = '0%';
  if (bar) bar.setAttribute('aria-valuenow', '0');
  if (percentEl) percentEl.textContent = '0%';
  if (currentEl) currentEl.textContent = '0';
  if (totalEl) totalEl.textContent = total.toString();
  if (cancelBtn) cancelBtn.style.display = cancellable ? 'block' : 'none';

  // Show overlay
  overlay.classList.add('visible');

  // Return controller object
  return {
    /**
     * Update progress
     * @param {number} current - Current progress
     * @param {string} [msg] - Optional message update
     */
    update(current, msg) {
      const percent = Math.min(100, Math.round((current / total) * 100));

      if (barFill) barFill.style.width = `${percent}%`;
      if (bar) bar.setAttribute('aria-valuenow', percent.toString());
      if (percentEl) percentEl.textContent = `${percent}%`;
      if (currentEl) currentEl.textContent = current.toString();
      if (msg && messageEl) messageEl.textContent = msg;
    },

    /**
     * Complete and hide
     * @param {string} [msg] - Optional completion message
     */
    complete(msg) {
      if (barFill) barFill.style.width = '100%';
      if (bar) bar.setAttribute('aria-valuenow', '100');
      if (percentEl) percentEl.textContent = '100%';
      if (currentEl) currentEl.textContent = total.toString();
      if (msg && messageEl) messageEl.textContent = msg;

      // Auto-hide after short delay
      setTimeout(() => {
        hide();
      }, 500);
    },

    /**
     * Check if operation was cancelled
     * @returns {boolean}
     */
    get cancelled() {
      return abortController?.signal?.aborted || false;
    },

    /**
     * Get abort signal for async operations
     * @returns {AbortSignal}
     */
    get signal() {
      return abortController?.signal;
    },

    /**
     * Hide progress indicator
     */
    hide
  };
}

/**
 * Hide progress indicator
 */
export function hide() {
  if (progressOverlay) {
    progressOverlay.classList.remove('visible');
  }
  abortController = null;
}

/**
 * Simple indeterminate progress (no percentage)
 * @param {string} title - Title text
 * @param {string} message - Message text
 * @returns {Object} Controller with hide() method
 */
export function showIndeterminate(title, message) {
  const overlay = createOverlay();

  const titleEl = overlay.querySelector('.progress-title');
  const messageEl = overlay.querySelector('.progress-message');
  const barFill = overlay.querySelector('.progress-bar-fill');
  const percentEl = overlay.querySelector('.progress-percentage');
  const statsEl = overlay.querySelector('.progress-stats');
  const cancelBtn = overlay.querySelector('.progress-cancel');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (barFill) {
    barFill.style.width = '100%';
    barFill.classList.add('indeterminate');
  }
  if (percentEl) percentEl.style.display = 'none';
  if (statsEl) statsEl.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';

  overlay.classList.add('visible');

  return {
    update(msg) {
      if (messageEl) messageEl.textContent = msg;
    },
    hide() {
      if (barFill) barFill.classList.remove('indeterminate');
      if (percentEl) percentEl.style.display = '';
      if (statsEl) statsEl.style.display = '';
      hide();
    }
  };
}

export default {
  show,
  hide,
  showIndeterminate
};
