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

// src/js/ui/modal-manager.js - Centralized modal management to eliminate duplication

import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { safeLog } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';

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
 * @returns {HTMLElement} Modal element
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

  // Validate required fields
  if (!id || !title) {
    safeLog('createModal: id and title are required');
    return null;
  }

  // Remove existing modal with same ID
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  // Create modal structure
  const modal = document.createElement('div');
  modal.id = id;
  modal.className = `modal modal-${size}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', `${id}-title`);

  // Modal HTML structure
  modal.innerHTML = sanitizeHTML(`
    <div class="modal-overlay" data-modal-overlay></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 id="${id}-title" class="modal-title">${escapeHtml(title)}</h2>
        <button
          type="button"
          class="modal-close"
          data-modal-close
          aria-label="Fermer"
          title="Fermer (Échap)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      ${actions.length > 0 ? `)
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
  `;

  // Add to DOM
  document.body.appendChild(modal);

  // Bind events
  const closeModal = () => closeModalInstance(modal, onClose);

  // Close button
  const closeBtn = modal.querySelector('[data-modal-close]');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Backdrop click
  if (closeOnBackdrop) {
    const overlay = modal.querySelector('[data-modal-overlay]');
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }
  }

  // Escape key
  if (closeOnEscape) {
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    // Store handler for cleanup
    modal._escapeHandler = escapeHandler;
  }

  // Action buttons
  actions.forEach((action) => {
    if (action.id && action.onClick) {
      const btn = modal.querySelector(`[data-action="${action.id}"]`);
      if (btn && typeof action.onClick === 'function') {
        btn.addEventListener('click', (e) => {
          try {
            action.onClick(e, modal);
          } catch (error) {
            safeLog(`Modal action error: ${error.message}`);
          }
        });
      }
    }
  });

  // Focus management
  const firstFocusable = modal.querySelector('input, button, textarea, select');

  // Show modal with animation
  setTimeout(() => {
    modal.classList.add('show');

    // Focus first input
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Call onOpen callback
    if (typeof onOpen === 'function') {
      try {
        onOpen(modal);
      } catch (error) {
        safeLog(`Modal onOpen error: ${error.message}`);
      }
    }
  }, ANIMATION_DURATION.MODAL_FADE_IN);

  return modal;
}

/**
 * Closes a modal instance
 * @param {HTMLElement} modal - Modal element
 * @param {Function} [onClose] - Callback when closed
 */
function closeModalInstance(modal, onClose) {
  if (!modal || !modal.parentNode) return;

  // Remove show class
  modal.classList.remove('show');

  // Clean up escape handler
  if (modal._escapeHandler) {
    document.removeEventListener('keydown', modal._escapeHandler);
    delete modal._escapeHandler;
  }

  // Call onClose callback
  if (typeof onClose === 'function') {
    try {
      onClose(modal);
    } catch (error) {
      safeLog(`Modal onClose error: ${error.message}`);
    }
  }

  // Remove from DOM after animation
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, ANIMATION_DURATION.MODAL_FADE_OUT);
}

/**
 * Closes modal by ID
 * @param {string} modalId - Modal ID to close
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    closeModalInstance(modal, null);
  }
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
 * Escapes HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

/**
 * Creates a confirmation dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {Function} options.onConfirm - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @param {string} [options.confirmLabel] - Confirm button label (default: "Confirmer")
 * @param {string} [options.cancelLabel] - Cancel button label (default: "Annuler")
 * @param {string} [options.confirmClass] - Confirm button class (default: "btn-danger")
 * @returns {HTMLElement} Modal element
 */
export function createConfirmDialog(options) {
  const {
    title = 'Confirmation',
    message,
    onConfirm,
    onCancel = null,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
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
        onClick: (e, modal) => {
          closeModalInstance(modal, onCancel);
        }
      },
      {
        id: 'confirm',
        label: confirmLabel,
        className: confirmClass,
        onClick: (e, modal) => {
          closeModalInstance(modal, null);
          if (typeof onConfirm === 'function') {
            onConfirm();
          }
        }
      }
    ]
  });
}

export default {
  createModal,
  closeModal,
  isModalOpen,
  createConfirmDialog
};
