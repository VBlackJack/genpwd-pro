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
// src/js/ui/modal-manager.js - Centralized modal management

import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { safeLog } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';
import { escapeHtml } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';

/**
 * Creates a modal element with consistent structure and behavior
 * @param {Object} options - Modal configuration options
 * @param {string} options.id - Unique modal ID
 * @param {string} options.title - Modal title
 * @param {string} options.content - Modal HTML content
 * @param {string[]} [options.actions] - Array of action buttons [{ label, className, onClick }]
 * @param {boolean} [options.closeOnEscape] - Close on Escape key (default: true)
 * @param {boolean} [options.closeOnBackdrop] - Close on backdrop click (default: true)
 * @param {string} [options.size] - Modal size: 'small', 'medium', 'large', 'full' (default: 'medium')
 * @param {Function} [options.onClose] - Callback when modal is closed
 * @param {Function} [options.onOpen] - Callback when modal is opened
 * @returns {{element: HTMLElement, close: Function}} Modal interface object
 */
export function createModal(options) {
  const {
    id,
    title,
    content,
    actions = [],
    closeOnEscape = true,
    closeOnBackdrop = true,
    size = 'medium',
    onClose = null,
    onOpen = null
  } = options;

  if (!id || !title) {
    safeLog('createModal: id and title are required');
    return null;
  }

  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${id}-title`);

  const sizeClass = size !== 'medium' ? `modal-${size}` : '';

  // FIXED: Uses t('common.close') for aria-label and title
  overlay.innerHTML = sanitizeHTML(`
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <h2 id="${id}-title" class="modal-title">${escapeHtml(title)}</h2>
        <button
          type="button"
          class="modal-close"
          data-modal-close
          aria-label="${t('common.close')}"
          title="${t('common.close')} (Esc)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      ${actions.length > 0 ? `
        <div class="modal-footer">
          ${actions.map(action => `
            <button
              type="button"
              class="${action.className || 'btn-secondary'}"
              data-action="${action.id || ''}">
              ${escapeHtml(action.label)}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `);

  document.body.appendChild(overlay);

  const closeModalFn = () => closeModalInstance(overlay, onClose);

  const closeBtn = overlay.querySelector('[data-modal-close]');
  if (closeBtn) closeBtn.addEventListener('click', closeModalFn);

  if (closeOnBackdrop) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModalFn();
    });
  }

  if (closeOnEscape) {
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModalFn();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    overlay._escapeHandler = escapeHandler;
  }

  actions.forEach((action) => {
    if (action.onClick) {
      const actionId = action.id || '';
      const btn = overlay.querySelector(`[data-action="${actionId}"]`);
      if (btn && typeof action.onClick === 'function') {
        btn.addEventListener('click', (e) => {
          try {
            action.onClick(e, overlay);
          } catch (error) {
            safeLog(`Modal action error: ${error.message}`);
          }
        });
      }
    }
  });

  const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';

  const getFocusableElements = () => {
    return Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      return el.offsetParent !== null;
    });
  };

  const focusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  overlay.addEventListener('keydown', focusTrapHandler);
  overlay._focusTrapHandler = focusTrapHandler;

  const previouslyFocused = document.activeElement;
  overlay._previouslyFocused = previouslyFocused;

  setTimeout(() => {
    overlay.classList.add('show');
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) focusableElements[0].focus();
    if (typeof onOpen === 'function') {
      try { onOpen(overlay); } catch (error) { safeLog(`Modal onOpen error: ${error.message}`); }
    }
  }, ANIMATION_DURATION.MODAL_FADE_IN);

  return { element: overlay, close: closeModalFn };
}

/**
 * Closes a modal instance
 * @param {HTMLElement} modal - Modal element
 * @param {Function} [onClose] - Callback when closed
 */
function closeModalInstance(modal, onClose) {
  if (!modal || !modal.parentNode) return;
  modal.classList.remove('show');

  if (modal._escapeHandler) {
    document.removeEventListener('keydown', modal._escapeHandler);
    delete modal._escapeHandler;
  }
  if (modal._focusTrapHandler) {
    modal.removeEventListener('keydown', modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
  if (modal._previouslyFocused && typeof modal._previouslyFocused.focus === 'function') {
    try { modal._previouslyFocused.focus(); } catch (e) { }
    delete modal._previouslyFocused;
  }
  if (typeof onClose === 'function') {
    try { onClose(modal); } catch (error) { safeLog(`Modal onClose error: ${error.message}`); }
  }
  setTimeout(() => {
    if (modal.parentNode) modal.remove();
  }, ANIMATION_DURATION.MODAL_FADE_OUT);
}

/**
 * Closes modal by ID
 * @param {string} modalId - Modal ID to close
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) closeModalInstance(modal, null);
}

/**
 * Checks if a modal is currently open
 * @param {string} [modalId] - Optional modal ID to check, or check if any modal is open
 * @returns {boolean} True if modal(s) are open
 */
export function isModalOpen(modalId = null) {
  if (modalId) {
    const modal = document.getElementById(modalId);
    return modal && modal.classList.contains('show');
  }
  return document.querySelector('.modal.show') !== null;
}

/**
 * Creates a confirmation dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {Function} options.onConfirm - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @param {string} [options.confirmLabel] - Confirm button label
 * @param {string} [options.cancelLabel] - Cancel button label
 * @param {string} [options.confirmClass] - Confirm button class (default: "btn-danger")
 * @returns {{element: HTMLElement, close: Function}} Modal interface object
 */
export function createConfirmDialog(options) {
  // FIXED: Defaults use i18n translation keys
  const {
    title = t('common.confirmation'),
    message,
    onConfirm,
    onCancel = null,
    confirmLabel = t('common.confirm'),
    cancelLabel = t('common.cancel'),
    confirmClass = 'btn-danger'
  } = options;

  const modalId = `confirm-dialog-${Date.now()}`;

  return createModal({
    id: modalId,
    title,
    content: `<p>${escapeHtml(message)}</p>`,
    size: 'small',
    actions: [
      {
        id: 'cancel',
        label: cancelLabel,
        className: 'btn-secondary',
        onClick: (e, modal) => closeModalInstance(modal, onCancel)
      },
      {
        id: 'confirm',
        label: confirmLabel,
        className: confirmClass,
        onClick: (e, modal) => {
          closeModalInstance(modal, null);
          if (typeof onConfirm === 'function') onConfirm();
        }
      }
    ]
  });
}

/**
 * Promise-based confirmation dialog (drop-in replacement for confirm())
 * @param {string} message - Confirmation message
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.title] - Dialog title
 * @param {string} [options.confirmLabel] - Confirm button label
 * @param {string} [options.cancelLabel] - Cancel button label
 * @param {boolean} [options.danger] - Use danger styling (default: false)
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    createConfirmDialog({
      title: options.title || t('common.confirmation'),
      message,
      confirmLabel: options.confirmLabel || t('common.confirm'),
      cancelLabel: options.cancelLabel || t('common.cancel'),
      confirmClass: options.danger ? 'btn-danger' : 'btn-primary',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

/**
 * Promise-based prompt dialog (accessible replacement for prompt())
 * @param {string} message - Prompt message
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.title] - Dialog title
 * @param {string} [options.defaultValue] - Default input value
 * @param {string} [options.placeholder] - Input placeholder
 * @param {string} [options.confirmLabel] - Confirm button label
 * @param {string} [options.cancelLabel] - Cancel button label
 * @returns {Promise<string|null>} Resolves with input value or null if cancelled
 */
export function showPrompt(message, options = {}) {
  return new Promise((resolve) => {
    const modalId = `prompt-dialog-${Date.now()}`;
    const inputId = `prompt-input-${Date.now()}`;
    const defaultValue = options.defaultValue || '';
    const placeholder = options.placeholder || '';

    const modal = createModal({
      id: modalId,
      title: options.title || t('vault.dialogs.promptTitle'),
      content: `
        <p>${escapeHtml(message)}</p>
        <div class="form-group">
          <input type="text" id="${inputId}" class="form-control"
                 value="${escapeHtml(defaultValue)}"
                 placeholder="${escapeHtml(placeholder)}"
                 autocomplete="off">
        </div>
      `,
      size: 'small',
      actions: [
        {
          id: 'cancel',
          label: options.cancelLabel || t('common.cancel'),
          className: 'btn-secondary',
          onClick: (e, modalEl) => {
            closeModalInstance(modalEl, null);
            resolve(null);
          }
        },
        {
          id: 'confirm',
          label: options.confirmLabel || t('common.confirm'),
          className: 'btn-primary',
          onClick: (e, modalEl) => {
            const input = modalEl.querySelector(`#${inputId}`);
            const value = input?.value?.trim() || null;
            closeModalInstance(modalEl, null);
            resolve(value);
          }
        }
      ],
      onOpen: (modalEl) => {
        const input = modalEl.querySelector(`#${inputId}`);
        if (input) {
          input.focus();
          input.select();
        }
        // Handle Enter key to submit
        input?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value?.trim() || null;
            closeModalInstance(modalEl, null);
            resolve(value);
          }
        });
      },
      onClose: () => resolve(null)
    });

    if (!modal) resolve(null);
  });
}
