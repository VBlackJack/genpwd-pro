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
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
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

  const modal = document.createElement('div');
  modal.className = 'vault-modal-overlay';
  modal.id = 'autotype-modal';
  modal.innerHTML = `
    <div class="vault-modal vault-modal-sm">
      <div class="vault-modal-header">
        <h3>${t('vault.autotype.manualTitle')}</h3>
        ${renderCloseBtn(t)}
      </div>
      <div class="vault-modal-body">
        <p class="vault-modal-hint">${t('vault.autotype.requiresApp')}</p>
        <p class="vault-modal-hint">${t('vault.autotype.copyHint')}</p>
        <div class="vault-autotype-steps">
          <div class="vault-autotype-step">
            <span class="vault-autotype-label">1. ${t('vault.labels.username')}</span>
            <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-user">
              ${t('vault.common.copy')} "${escapeHtml(username.substring(0, 10))}${username.length > 10 ? '...' : ''}"
            </button>
          </div>
          <div class="vault-autotype-step">
            <span class="vault-autotype-label">2. ${t('vault.labels.password')}</span>
            <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-pass">
              ${t('vault.common.copy')} ••••••••
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  const closeModal = () => modal.remove();

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
