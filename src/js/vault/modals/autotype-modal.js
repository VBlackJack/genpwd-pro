/**
 * @fileoverview Autotype Modal Template
 * Modal for manual auto-fill fallback
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Render close button
 * @param {Function} t - Translation function
 * @returns {string} HTML string
 */
function renderCloseBtn(t = (k) => k) {
  return `
    <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
}

/**
 * Show autotype modal for manual copy fallback
 * @param {Object} options
 * @param {Object} options.entry - Entry data
 * @param {Function} options.onCopyUsername - Called when username copy is clicked
 * @param {Function} options.onCopyPassword - Called when password copy is clicked
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} Modal element
 */
export function showAutotypeModal(options = {}) {
  const { entry, onCopyUsername, onCopyPassword, t = (k) => k } = options;
  const username = entry.data?.username || '';
  const password = entry.data?.password || '';

  // Store previously focused element for restoration
  const previouslyFocused = document.activeElement;

  const modal = document.createElement('div');
  modal.className = 'vault-modal-overlay';
  modal.id = 'autotype-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'autotype-modal-title');
  modal.innerHTML = `
    <div class="vault-modal vault-modal-sm">
      <div class="vault-modal-header">
        <h3 id="autotype-modal-title">${t('vault.autotype.manualTitle')}</h3>
        ${renderCloseBtn(t)}
      </div>
      <div class="vault-modal-body">
        <p class="vault-modal-hint">${t('vault.autotype.requiresApp')}</p>
        <p class="vault-modal-hint">${t('vault.autotype.copyHint')}</p>
        <ol class="vault-autotype-steps" aria-label="${t('vault.aria.autotypeSteps')}">
          <li class="vault-autotype-step">
            <span class="vault-autotype-label">${t('vault.labels.username')}</span>
            <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-user">
              ${t('vault.autotype.copyUsername')}
            </button>
          </li>
          <li class="vault-autotype-step">
            <span class="vault-autotype-label">${t('vault.labels.password')}</span>
            <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-pass">
              ${t('vault.autotype.copyPassword')}
            </button>
          </li>
        </ol>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  const closeModal = () => {
    modal.remove();
    // Restore focus to previously focused element with fallback
    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
      previouslyFocused.focus();
    } else {
      // Fallback: focus main landmark or entry list for accessibility
      const fallbackTargets = [
        document.querySelector('[role="main"]'),
        document.querySelector('.vault-entry-list'),
        document.querySelector('.vault-content'),
        document.body
      ];
      const fallback = fallbackTargets.find(el => el && typeof el.focus === 'function');
      if (fallback) {
        fallback.setAttribute('tabindex', '-1');
        fallback.focus();
      }
    }
  };

  modal.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelector('#copy-autotype-user')?.addEventListener('click', () => {
    if (onCopyUsername) onCopyUsername(username);
  });

  modal.querySelector('#copy-autotype-pass')?.addEventListener('click', () => {
    if (onCopyPassword) onCopyPassword(password);
  });

  // Auto-focus modal
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.querySelector('button')?.focus();
  });

  return modal;
}
