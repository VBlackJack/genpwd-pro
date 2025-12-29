/**
 * @fileoverview Confirm Dialog
 * Reusable confirmation dialog component
 */

import { escapeHtml } from '../utils/formatter.js';
import { ICON_ALERT } from '../views/icons.js';

/**
 * Render confirm dialog HTML
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @param {string} options.confirmClass - Confirm button class
 * @param {string} options.type - Dialog type (danger, warning, info)
 * @returns {string} HTML string
 */
export function renderConfirmDialog(options = {}) {
  const {
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'vault-btn-danger',
    type = 'warning'
  } = options;

  const iconColor = type === 'danger' ? 'var(--color-danger)' :
                    type === 'warning' ? 'var(--color-warning)' :
                    'var(--color-info)';

  return `
    <div class="vault-modal-backdrop"></div>
    <div class="vault-modal-content vault-modal-sm" role="alertdialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <div class="vault-modal-header">
        <h3 id="confirm-dialog-title" class="vault-modal-title">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${iconColor}" stroke-width="2" class="modal-icon-warning">
            ${ICON_ALERT}
          </svg>
          ${escapeHtml(title)}
        </h3>
      </div>
      <div class="vault-modal-body">
        <p id="confirm-dialog-message" class="confirm-dialog-message">${escapeHtml(message)}</p>
      </div>
      <div class="vault-modal-actions">
        <button type="button" class="vault-btn vault-btn-secondary" id="confirm-dialog-cancel" aria-label="Cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="vault-btn ${confirmClass}" id="confirm-dialog-confirm" aria-label="Confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
}

/**
 * Create and show a confirm dialog
 * @param {string} message - Dialog message
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.confirmLabel - Confirm button text
 * @param {string} options.cancelLabel - Cancel button text
 * @param {boolean} options.danger - Use danger styling
 * @param {string} options.type - Dialog type (danger, warning, info)
 * @returns {Promise<boolean>} User's choice
 */
export async function showConfirmDialog(message, options = {}) {
  const {
    title = 'Confirm',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    type = danger ? 'danger' : 'warning'
  } = options;

  return new Promise((resolve) => {
    const modalId = 'confirm-dialog-modal';

    // Remove existing if present
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    // Create modal element
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'vault-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = renderConfirmDialog({
      title,
      message,
      confirmText: confirmLabel,
      cancelText: cancelLabel,
      confirmClass: danger ? 'vault-btn-danger' : 'vault-btn-primary',
      type
    });

    document.body.appendChild(modal);

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      // Focus confirm button
      const confirmBtn = modal.querySelector('#confirm-dialog-confirm');
      confirmBtn?.focus();
    });

    // Event handlers
    const cleanup = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => modal.remove(), 300);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    // Attach event listeners
    modal.querySelector('#confirm-dialog-confirm')?.addEventListener('click', handleConfirm);
    modal.querySelector('#confirm-dialog-cancel')?.addEventListener('click', handleCancel);
    modal.querySelector('.vault-modal-backdrop')?.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown, { once: true });
  });
}

/**
 * Show a danger confirm dialog (for destructive actions)
 * @param {string} message - Dialog message
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} User's choice
 */
export async function showDangerConfirm(message, options = {}) {
  return showConfirmDialog(message, {
    ...options,
    danger: true,
    type: 'danger'
  });
}

/**
 * Show a warning confirm dialog
 * @param {string} message - Dialog message
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} User's choice
 */
export async function showWarningConfirm(message, options = {}) {
  return showConfirmDialog(message, {
    ...options,
    type: 'warning'
  });
}
