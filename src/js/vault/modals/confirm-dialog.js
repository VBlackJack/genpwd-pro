/**
 * @fileoverview Confirm Dialog
 * Reusable confirmation dialog component
 */

import { escapeHtml } from '../utils/formatter.js';
import { ICON_ALERT } from '../views/icons.js';
import { t } from '../../utils/i18n.js';

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
    title = t('vault.dialogs.confirmTitle'),
    message = t('vault.dialogs.areYouSure'),
    confirmText = t('common.confirm'),
    cancelText = t('common.cancel'),
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
        <button type="button" class="vault-btn vault-btn-secondary" id="confirm-dialog-cancel" aria-label="${escapeHtml(cancelText)}">${escapeHtml(cancelText)}</button>
        <button type="button" class="vault-btn ${confirmClass}" id="confirm-dialog-confirm" aria-label="${escapeHtml(confirmText)}">${escapeHtml(confirmText)}</button>
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
    title = t('vault.dialogs.confirmTitle'),
    confirmLabel = t('common.confirm'),
    cancelLabel = t('common.cancel'),
    danger = false,
    type = danger ? 'danger' : 'warning'
  } = options;

  return new Promise((resolve) => {
    const modalId = 'confirm-dialog-modal';
    const previouslyFocused = document.activeElement;

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
      setTimeout(() => {
        modal.remove();
        // Restore focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
      }, 300);
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

/**
 * Render prompt dialog HTML
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} options.placeholder - Input placeholder
 * @param {string} options.defaultValue - Default input value
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @returns {string} HTML string
 */
export function renderPromptDialog(options = {}) {
  const {
    title = t('vault.dialogs.promptTitle'),
    message = '',
    placeholder = '',
    defaultValue = '',
    confirmText = t('common.confirm'),
    cancelText = t('common.cancel')
  } = options;

  return `
    <div class="vault-modal-backdrop"></div>
    <div class="vault-modal-content vault-modal-sm" role="dialog" aria-labelledby="prompt-dialog-title" aria-describedby="prompt-dialog-message" aria-modal="true">
      <div class="vault-modal-header">
        <h3 id="prompt-dialog-title" class="vault-modal-title">${escapeHtml(title)}</h3>
        <button type="button" class="vault-modal-close" id="prompt-dialog-close" aria-label="${t('vault.common.close')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <form class="vault-modal-body" id="prompt-dialog-form">
        ${message ? `<p id="prompt-dialog-message" class="prompt-dialog-message">${escapeHtml(message)}</p>` : ''}
        <div class="vault-form-group">
          <input type="text" class="vault-input" id="prompt-dialog-input"
                 placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}"
                 autocomplete="off" required>
        </div>
        <div class="vault-modal-actions">
          <button type="button" class="vault-btn vault-btn-secondary" id="prompt-dialog-cancel" aria-label="${escapeHtml(cancelText)}">${escapeHtml(cancelText)}</button>
          <button type="submit" class="vault-btn vault-btn-primary" id="prompt-dialog-confirm" aria-label="${escapeHtml(confirmText)}">${escapeHtml(confirmText)}</button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Create and show a prompt dialog for text input
 * @param {string} message - Dialog message
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.placeholder - Input placeholder
 * @param {string} options.defaultValue - Default input value
 * @param {string} options.confirmLabel - Confirm button text
 * @param {string} options.cancelLabel - Cancel button text
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export async function showPromptDialog(message, options = {}) {
  const {
    title = t('vault.dialogs.promptTitle'),
    placeholder = '',
    defaultValue = '',
    confirmLabel = t('common.confirm'),
    cancelLabel = t('common.cancel')
  } = options;

  return new Promise((resolve) => {
    const modalId = 'prompt-dialog-modal';
    const previouslyFocused = document.activeElement;

    // Remove existing if present
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    // Create modal element
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'vault-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = renderPromptDialog({
      title,
      message,
      placeholder,
      defaultValue,
      confirmText: confirmLabel,
      cancelText: cancelLabel
    });

    document.body.appendChild(modal);

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      // Focus input field
      const input = modal.querySelector('#prompt-dialog-input');
      input?.focus();
      input?.select();
    });

    // Event handlers
    const cleanup = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        modal.remove();
        // Restore focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
      }, 300);
    };

    const handleConfirm = () => {
      const input = modal.querySelector('#prompt-dialog-input');
      const value = input?.value?.trim() || null;
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    // Attach event listeners
    modal.querySelector('#prompt-dialog-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleConfirm();
    });
    modal.querySelector('#prompt-dialog-cancel')?.addEventListener('click', handleCancel);
    modal.querySelector('#prompt-dialog-close')?.addEventListener('click', handleCancel);
    modal.querySelector('.vault-modal-backdrop')?.addEventListener('click', handleCancel);
    modal.addEventListener('keydown', handleKeydown);
  });
}
