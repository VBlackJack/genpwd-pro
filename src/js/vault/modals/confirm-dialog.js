/**
 * @fileoverview Confirm Dialog
 * Reusable confirmation dialog component
 */

import { escapeHtml, formatDate } from '../utils/formatter.js';
import { ICON_ALERT, getIcon } from '../views/icons.js';
import { t } from '../../utils/i18n.js';
import { ENTRY_TYPES } from '../../config/entry-types.js';

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
    confirmText = t('vault.common.confirm'),
    cancelText = t('vault.common.cancel'),
    confirmClass = 'vault-btn-danger',
    type = 'warning'
  } = options;

  const iconColor = type === 'danger' ? 'var(--color-danger)' :
                    type === 'warning' ? 'var(--color-warning)' :
                    'var(--color-info)';

  return `
    <div class="vault-modal-backdrop"></div>
    <div class="vault-modal-content vault-modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
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
    confirmLabel = t('vault.common.confirm'),
    cancelLabel = t('vault.common.cancel'),
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
    modal.innerHTML = renderConfirmDialog({
      title,
      message,
      confirmText: confirmLabel,
      cancelText: cancelLabel,
      confirmClass: danger ? 'vault-btn-danger' : 'vault-btn-primary',
      type
    });

    document.body.appendChild(modal);

    // Show modal - requestAnimationFrame ensures DOM is ready
    requestAnimationFrame(() => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      // For alertdialog with danger type, focus cancel button (safer default)
      // For other types, focus confirm button
      const focusTarget = danger
        ? modal.querySelector('#confirm-dialog-cancel')
        : modal.querySelector('#confirm-dialog-confirm');
      focusTarget?.focus();
    });

    // Store references for cleanup
    const confirmBtn = modal.querySelector('#confirm-dialog-confirm');
    const cancelBtn = modal.querySelector('#confirm-dialog-cancel');
    const backdrop = modal.querySelector('.vault-modal-backdrop');

    // Event handlers
    const handleConfirm = () => {
      cleanupAndClose();
      resolve(true);
    };

    const handleCancel = () => {
      cleanupAndClose();
      resolve(false);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Tab') {
        // Focus trap: keep focus within dialog
        const focusableElements = modal.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };

    const handleBackdropClick = () => {
      handleCancel();
    };

    // Centralized cleanup to remove all listeners
    const cleanupAndClose = () => {
      // Remove all event listeners
      confirmBtn?.removeEventListener('click', handleConfirm);
      cancelBtn?.removeEventListener('click', handleCancel);
      backdrop?.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleKeydown);

      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        modal.remove();
        // Restore focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
          previouslyFocused.focus();
        }
      }, 300);
    };

    // Attach event listeners
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    backdrop?.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);
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
    confirmText = t('vault.common.confirm'),
    cancelText = t('vault.common.cancel')
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
    confirmLabel = t('vault.common.confirm'),
    cancelLabel = t('vault.common.cancel')
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
    modal.innerHTML = renderPromptDialog({
      title,
      message,
      placeholder,
      defaultValue,
      confirmText: confirmLabel,
      cancelText: cancelLabel
    });

    document.body.appendChild(modal);

    // Show modal - requestAnimationFrame ensures DOM is ready
    requestAnimationFrame(() => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      // Focus input field
      const input = modal.querySelector('#prompt-dialog-input');
      input?.focus();
      input?.select();
    });

    // Event handlers
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      handleConfirm();
    };

    // Cache element references
    const form = modal.querySelector('#prompt-dialog-form');
    const cancelBtn = modal.querySelector('#prompt-dialog-cancel');
    const closeBtn = modal.querySelector('#prompt-dialog-close');
    const backdrop = modal.querySelector('.vault-modal-backdrop');

    const cleanup = () => {
      // Remove all event listeners
      form?.removeEventListener('submit', handleSubmit);
      cancelBtn?.removeEventListener('click', handleCancel);
      closeBtn?.removeEventListener('click', handleCancel);
      backdrop?.removeEventListener('click', handleCancel);
      modal.removeEventListener('keydown', handleKeydown);

      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        modal.remove();
        // Restore focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
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

    // Attach event listeners
    form?.addEventListener('submit', handleSubmit);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);
    backdrop?.addEventListener('click', handleCancel);
    modal.addEventListener('keydown', handleKeydown);
  });
}

/**
 * Show enhanced delete preview dialog
 * (BMAD Phase 3B - Enhanced delete confirmation with entry preview)
 * @param {Object} entry - Entry to delete
 * @param {Object} options - Dialog options
 * @param {string} options.folderName - Name of the folder the entry is in
 * @returns {Promise<boolean>} User's choice
 */
export async function showDeletePreview(entry, options = {}) {
  const { folderName = '' } = options;

  // Get entry type configuration
  const entryType = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
  const typeIcon = getIcon(entryType.icon || 'key', { size: 24 });

  // Format the last modified date
  const lastModified = entry.modifiedAt || entry.updatedAt || entry.createdAt;
  const formattedDate = lastModified ? formatDate(lastModified) : t('common.unknown');

  // Get identifier (username, email, or other relevant field)
  const identifier = entry.data?.username || entry.data?.email || '';

  return new Promise((resolve) => {
    const modalId = 'delete-preview-modal';
    const previouslyFocused = document.activeElement;

    // Remove existing if present
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    // Create modal element
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'vault-modal';
    modal.innerHTML = `
      <div class="vault-modal-backdrop"></div>
      <div class="vault-modal-content vault-modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-preview-title" aria-describedby="delete-preview-desc">
        <div class="vault-modal-header">
          <h3 id="delete-preview-title" class="vault-modal-title">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-danger)" stroke-width="2" class="modal-icon-warning">
              ${ICON_ALERT}
            </svg>
            ${escapeHtml(t('vault.delete.confirmTitle'))}
          </h3>
        </div>
        <div class="vault-modal-body">
          <div class="delete-preview">
            <div class="delete-preview-icon">${typeIcon}</div>
            <div class="delete-preview-info">
              <strong class="delete-preview-title">${escapeHtml(entry.title)}</strong>
              ${identifier ? `<span class="delete-preview-identifier">${escapeHtml(identifier)}</span>` : ''}
              ${folderName ? `<span class="delete-preview-folder"><span class="folder-badge">${escapeHtml(folderName)}</span></span>` : ''}
              <span class="delete-preview-date">${t('vault.delete.lastModified', { date: formattedDate })}</span>
            </div>
          </div>
          <p id="delete-preview-desc" class="delete-warning">${t('vault.delete.permanentWarning')}</p>
        </div>
        <div class="vault-modal-actions">
          <button type="button" class="vault-btn vault-btn-secondary" id="delete-preview-cancel">${escapeHtml(t('vault.common.cancel'))}</button>
          <button type="button" class="vault-btn vault-btn-danger" id="delete-preview-confirm">${escapeHtml(t('vault.delete.confirm'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      // Focus cancel button for safety (WCAG)
      modal.querySelector('#delete-preview-cancel')?.focus();
    });

    // Event handlers
    const confirmBtn = modal.querySelector('#delete-preview-confirm');
    const cancelBtn = modal.querySelector('#delete-preview-cancel');
    const backdrop = modal.querySelector('.vault-modal-backdrop');

    const handleConfirm = () => {
      cleanupAndClose();
      resolve(true);
    };

    const handleCancel = () => {
      cleanupAndClose();
      resolve(false);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Tab') {
        // Focus trap
        const focusable = modal.querySelectorAll('button:not([disabled])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const cleanupAndClose = () => {
      confirmBtn?.removeEventListener('click', handleConfirm);
      cancelBtn?.removeEventListener('click', handleCancel);
      backdrop?.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeydown);

      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        modal.remove();
        if (previouslyFocused?.focus && document.body.contains(previouslyFocused)) {
          previouslyFocused.focus();
        }
      }, 300);
    };

    // Attach event listeners
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    backdrop?.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown);
  });
}
