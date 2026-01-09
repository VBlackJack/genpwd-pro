/**
 * @fileoverview Password Generator Component
 * Popover for generating secure passwords
 */

/**
 * Default password generation options
 */
export const DEFAULT_OPTIONS = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true
};

/**
 * Generate a secure password
 * @param {Object} options - Generation options
 * @param {number} options.length - Password length
 * @param {boolean} options.uppercase - Include uppercase letters
 * @param {boolean} options.lowercase - Include lowercase letters
 * @param {boolean} options.numbers - Include numbers
 * @param {boolean} options.symbols - Include symbols
 * @returns {string} Generated password
 */
export function generatePassword(options = {}) {
  const {
    length = DEFAULT_OPTIONS.length,
    uppercase = DEFAULT_OPTIONS.uppercase,
    lowercase = DEFAULT_OPTIONS.lowercase,
    numbers = DEFAULT_OPTIONS.numbers,
    symbols = DEFAULT_OPTIONS.symbols
  } = options;

  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (charset.length === 0) {
    charset = 'abcdefghijklmnopqrstuvwxyz'; // Fallback
  }

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}

/**
 * Show password generator popover
 * @param {Object} options
 * @param {string} options.targetInputId - ID of the input to fill
 * @param {Function} options.onPasswordGenerated - Called with password when "Use" is clicked
 * @param {Function} options.onCopy - Called when copy button is clicked
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The popover element
 */
export function showPasswordGenerator(options = {}) {
  const { targetInputId, onPasswordGenerated, onCopy, t = (k) => k } = options;

  // Remove existing popover
  document.querySelector('.vault-password-generator')?.remove();

  const input = document.getElementById(targetInputId);
  if (!input) return null;

  const popover = document.createElement('div');
  popover.className = 'vault-password-generator';
  popover.innerHTML = `
    <div class="vault-gen-header">
      <span>${t('vault.generator.title')}</span>
      <button class="vault-gen-close" aria-label="${t('vault.common.close')}">&times;</button>
    </div>
    <div class="vault-gen-preview">
      <input type="text" class="vault-gen-output" id="gen-output" readonly tabindex="0" aria-label="${t('vault.generator.outputLabel')}" aria-live="polite">
      <button class="vault-gen-copy" title="${t('vault.common.copy')}" aria-label="${t('vault.generator.copyLabel')}"><span aria-hidden="true">📋</span></button>
      <button class="vault-gen-refresh" title="${t('vault.generator.regenerate')}" aria-label="${t('vault.generator.regenerateLabel')}"><span aria-hidden="true">🔄</span></button>
    </div>
    <div class="vault-gen-options">
      <div class="vault-gen-length">
        <label for="gen-length">${t('vault.generator.length')}: <span id="gen-length-value">${DEFAULT_OPTIONS.length}</span></label>
        <input type="range" id="gen-length" min="8" max="64" value="${DEFAULT_OPTIONS.length}">
      </div>
      <fieldset class="vault-gen-checkboxes">
        <legend class="visually-hidden">${t('vault.generator.characterOptions')}</legend>
        <label><input type="checkbox" id="gen-uppercase" checked> ${t('vault.generator.uppercase')}</label>
        <label><input type="checkbox" id="gen-lowercase" checked> ${t('vault.generator.lowercase')}</label>
        <label><input type="checkbox" id="gen-numbers" checked> ${t('vault.generator.numbers')}</label>
        <label><input type="checkbox" id="gen-symbols" checked> ${t('vault.generator.symbols')}</label>
      </fieldset>
    </div>
    <button class="vault-btn vault-btn-primary vault-btn-sm vault-btn-full" id="gen-use">
      ${t('vault.generator.usePassword')}
    </button>
  `;

  input.parentElement.appendChild(popover);

  // Generate password based on current options
  const generate = () => {
    const lengthInput = popover.querySelector('#gen-length');
    const parsedLength = lengthInput ? parseInt(lengthInput.value, 10) : NaN;
    const length = Number.isFinite(parsedLength) && parsedLength >= 8 && parsedLength <= 64
      ? parsedLength
      : DEFAULT_OPTIONS.length;

    const pwd = generatePassword({
      length,
      uppercase: popover.querySelector('#gen-uppercase')?.checked ?? DEFAULT_OPTIONS.uppercase,
      lowercase: popover.querySelector('#gen-lowercase')?.checked ?? DEFAULT_OPTIONS.lowercase,
      numbers: popover.querySelector('#gen-numbers')?.checked ?? DEFAULT_OPTIONS.numbers,
      symbols: popover.querySelector('#gen-symbols')?.checked ?? DEFAULT_OPTIONS.symbols
    });
    const outputEl = popover.querySelector('#gen-output');
    if (outputEl) outputEl.value = pwd;
    return pwd;
  };

  // Initial generation
  generate();

  // Event listeners
  popover.querySelector('#gen-length').addEventListener('input', (e) => {
    popover.querySelector('#gen-length-value').textContent = e.target.value;
    generate();
  });

  ['gen-uppercase', 'gen-lowercase', 'gen-numbers', 'gen-symbols'].forEach(id => {
    popover.querySelector(`#${id}`)?.addEventListener('change', generate);
  });

  popover.querySelector('.vault-gen-refresh')?.addEventListener('click', generate);

  popover.querySelector('.vault-gen-copy')?.addEventListener('click', async () => {
    const pwd = popover.querySelector('.vault-gen-output')?.value;
    if (pwd) {
      try {
        await navigator.clipboard.writeText(pwd);
        if (onCopy) onCopy(pwd);
      } catch {
        // Clipboard access denied - silently fail, let onCopy handler show toast if needed
      }
    }
  });

  popover.querySelector('#gen-use')?.addEventListener('click', () => {
    const pwd = popover.querySelector('.vault-gen-output')?.value;
    if (pwd && onPasswordGenerated) {
      onPasswordGenerated(pwd, input);
    }
    popover.remove();
  });

  // AbortController for centralized cleanup of all event listeners
  const abortController = new AbortController();
  const { signal } = abortController;

  const closeAndCleanup = (restoreFocus = true) => {
    abortController.abort();
    popover.remove();
    if (restoreFocus) input?.focus();
  };

  // Store cleanup function on popover for external access
  popover._cleanup = closeAndCleanup;

  popover.querySelector('.vault-gen-close')?.addEventListener('click', () => closeAndCleanup(), { signal });

  // Handle Escape key to close popover
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndCleanup();
    }
  }, { signal });

  // Close on outside click (delayed to avoid immediate close)
  setTimeout(() => {
    if (signal.aborted) return;
    document.addEventListener('click', (e) => {
      if (!document.body.contains(popover)) {
        return;
      }
      if (!popover.contains(e.target) && e.target !== input) {
        closeAndCleanup(false);
      }
    }, { signal });
  }, 100);

  return popover;
}

/**
 * Close any open password generator with proper cleanup
 */
export function closePasswordGenerator() {
  const popover = document.querySelector('.vault-password-generator');
  if (popover?._cleanup) {
    popover._cleanup(false);
  } else {
    popover?.remove();
  }
}
