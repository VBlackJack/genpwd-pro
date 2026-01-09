/**
 * @fileoverview Windows Hello Settings Popover
 * UI component for managing Windows Hello biometric unlock
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Show Windows Hello settings popover
 * @param {Object} options
 * @param {HTMLElement} options.anchorElement - Button to anchor popover to
 * @param {boolean} options.isEnabled - Current Hello state
 * @param {string} options.vaultId - Current vault ID
 * @param {Function} options.onEnable - Callback when enable clicked (vaultId)
 * @param {Function} options.onDisable - Callback when disable clicked (vaultId)
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The popover element
 */
export function showHelloSettingsPopover(options = {}) {
  const { anchorElement, isEnabled, vaultId, onEnable, onDisable, t = (k) => k } = options;

  // Remove existing popover
  closeHelloSettingsPopover();

  if (!anchorElement) return null;

  const popover = document.createElement('div');
  popover.className = 'vault-hello-popover';

  const enabledDesc = t('vault.windowsHello.enabledDescription');
  const disabledDesc = t('vault.windowsHello.disabledDescription');

  popover.innerHTML = `
    <div class="vault-hello-header">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <circle cx="8.5" cy="10" r="1.5"/>
        <circle cx="15.5" cy="10" r="1.5"/>
        <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
      </svg>
      <span>Windows Hello</span>
    </div>
    <div class="vault-hello-body">
      <p class="vault-hello-description">${isEnabled ? enabledDesc : disabledDesc}</p>
      ${isEnabled ? `
        <button class="vault-btn vault-btn-sm vault-btn-danger" id="hello-disable">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          ${t('vault.windowsHello.disable')}
        </button>
      ` : `
        <button class="vault-btn vault-btn-sm vault-btn-primary" id="hello-enable">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          ${t('vault.windowsHello.enable')}
        </button>
      `}
    </div>
  `;

  // Attach to body for proper z-index stacking
  document.body.appendChild(popover);

  // Position popover
  const btnRect = anchorElement.getBoundingClientRect();
  Object.assign(popover.style, {
    position: 'fixed',
    top: `${btnRect.bottom + 8}px`,
    right: `${window.innerWidth - btnRect.right}px`,
    zIndex: '99999',
    pointerEvents: 'auto'
  });

  // Force pointer-events on action button
  const actionBtn = popover.querySelector('button');
  if (actionBtn) {
    actionBtn.style.pointerEvents = 'auto';
    actionBtn.style.cursor = 'pointer';
  }

  // Event delegation on popover - capture phase
  popover.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.id === 'hello-enable' && onEnable) {
      e.stopPropagation();
      popover.remove();
      onEnable(vaultId);
    } else if (target.id === 'hello-disable' && onDisable) {
      e.stopPropagation();
      popover.remove();
      onDisable(vaultId);
    }
  }, true);

  // Close on click outside
  const closeHandler = (e) => {
    if (!popover.contains(e.target) && !e.target.closest('#hello-settings')) {
      popover.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  // Delay to avoid immediate close
  setTimeout(() => document.addEventListener('click', closeHandler), 200);

  return popover;
}

/**
 * Close Windows Hello settings popover
 */
export function closeHelloSettingsPopover() {
  document.querySelector('.vault-hello-popover')?.remove();
}

/**
 * Update Hello button visual state
 * @param {HTMLElement} button - The hello settings button
 * @param {boolean} isEnabled - Whether Hello is enabled
 * @param {Function} t - Translation function
 */
export function updateHelloButtonState(button, isEnabled, t = (k) => k) {
  if (!button) return;
  button.classList.toggle('hello-enabled', isEnabled);
  button.title = isEnabled
    ? t('vault.windowsHello.enabled')
    : t('vault.windowsHello.disabled');
}

/**
 * Show password prompt modal
 * @param {Object} options
 * @param {string} options.message - Prompt message
 * @param {Function} options.t - Translation function
 * @returns {Promise<string|null>} Password or null if cancelled
 */
export function showPasswordPrompt(options = {}) {
  const { message, t = (k) => k } = options;

  return new Promise((resolve) => {
    const modalId = 'password-prompt-modal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'vault-modal-overlay active';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'password-prompt-modal-title');

    const title = t('vault.windowsHello.verificationRequired');
    const closeLabel = t('vault.common.close');
    const placeholder = t('vault.placeholders.password');
    const cancelText = t('vault.common.cancel');
    const confirmText = t('vault.common.confirm');

    modal.innerHTML = `
      <div class="vault-modal vault-modal-sm">
        <div class="vault-modal-header">
          <h3 id="password-prompt-modal-title">${title}</h3>
          <button type="button" class="vault-modal-close" data-close aria-label="${closeLabel}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form class="vault-modal-body" id="pwd-prompt-form">
          <p class="vault-modal-message">${escapeHtml(message)}</p>
          <div class="vault-form-group">
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="pwd-prompt-input"
                     placeholder="${placeholder}" autocomplete="current-password" required autofocus>
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="pwd-prompt-input">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close>${cancelText}</button>
            <button type="submit" class="vault-btn vault-btn-primary">${confirmText}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus password input
    setTimeout(() => modal.querySelector('#pwd-prompt-input')?.focus(), 100);

    // Toggle password visibility
    modal.querySelector('.toggle-pwd-visibility')?.addEventListener('click', () => {
      const input = modal.querySelector('#pwd-prompt-input');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Close handlers
    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
      resolve(null);
    };

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Submit handler
    modal.querySelector('#pwd-prompt-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = modal.querySelector('#pwd-prompt-input')?.value;
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
      resolve(password || null);
    });
  });
}
