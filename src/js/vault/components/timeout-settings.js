/**
 * @fileoverview Timeout Settings Component
 * Popover for configuring auto-lock timeout
 */

// Track active popover state for cleanup
let activeAbortController = null;
let setupTimeoutId = null;

/**
 * Cleanup all listeners and state (idempotent)
 */
function cleanupListeners() {
  // Clear timeout if pending
  if (setupTimeoutId) {
    clearTimeout(setupTimeoutId);
    setupTimeoutId = null;
  }

  // Abort all event listeners via AbortController
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

}

/**
 * Default timeout options
 * Uses labelKey for i18n - translate at render time with t(opt.labelKey)
 */
export const TIMEOUT_OPTIONS = [
  { value: 60, labelKey: 'settings.timeout.1min' },
  { value: 120, labelKey: 'settings.timeout.2min' },
  { value: 300, labelKey: 'settings.timeout.5min' },
  { value: 600, labelKey: 'settings.timeout.10min' },
  { value: 900, labelKey: 'settings.timeout.15min' },
  { value: 1800, labelKey: 'settings.timeout.30min' }
];

/**
 * Show timeout settings popover
 * @param {Object} options
 * @param {HTMLElement} options.targetElement - Element to attach popover to
 * @param {number} options.currentTimeout - Current timeout value in seconds
 * @param {Function} options.onTimeoutSelected - Called with (timeoutSeconds, label) when option is selected
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement|null} The popover element
 */
export function showTimeoutSettings(options = {}) {
  const { targetElement, currentTimeout, onTimeoutSelected, t = (k) => k } = options;

  // Cleanup any existing popover and listeners
  cleanupListeners();
  document.querySelector('.vault-timeout-settings')?.remove();

  if (!targetElement) return null;

  const popover = document.createElement('div');
  popover.className = 'vault-timeout-settings';
  popover.innerHTML = `
    <div class="vault-timeout-header">
      <span id="timeout-group-label">${t('vault.settings.lockTimeout')}</span>
    </div>
    <div class="vault-timeout-options" role="radiogroup" aria-labelledby="timeout-group-label" aria-label="${t('vault.settings.lockTimeout')}">
      ${TIMEOUT_OPTIONS.map(opt => `
        <button class="vault-timeout-option ${opt.value === currentTimeout ? 'active' : ''}"
                data-timeout="${opt.value}"
                role="radio"
                aria-checked="${opt.value === currentTimeout ? 'true' : 'false'}">
          ${t(opt.labelKey)}
        </button>
      `).join('')}
    </div>
  `;

  targetElement.appendChild(popover);
  // Create AbortController for all event listeners
  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  // Helper to close popover with cleanup
  const closePopover = () => {
    cleanupListeners();
    popover.remove();
  };

  // Event handlers with AbortController signal
  const buttons = popover.querySelectorAll('.vault-timeout-option');
  buttons.forEach((btn, index) => {
    // Click handler
    btn.addEventListener('click', () => {
      const newTimeout = parseInt(btn.dataset.timeout, 10);
      const label = btn.textContent.trim();

      // Update UI and ARIA states
      buttons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
        b.setAttribute('tabindex', '-1');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      btn.setAttribute('tabindex', '0');

      if (onTimeoutSelected) {
        onTimeoutSelected(newTimeout, label);
      }

      closePopover();
    }, { signal });

    // Arrow key navigation for radiogroup
    btn.addEventListener('keydown', (e) => {
      let targetIndex = index;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        targetIndex = (index + 1) % buttons.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        targetIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = buttons.length - 1;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
        return;
      } else if (e.key === ' ' || e.key === 'Enter') {
        // Space/Enter selects the focused option (WAI-ARIA radiogroup pattern)
        e.preventDefault();
        btn.click();
        return;
      }
      if (targetIndex !== index) {
        buttons[targetIndex].focus();
      }
    }, { signal });

    // Set initial tabindex (only active button is tabbable)
    btn.setAttribute('tabindex', btn.classList.contains('active') ? '0' : '-1');
  });

  // Close on click outside (with AbortController signal)
  // Use microtask to ensure popover is attached before adding document listener
  setupTimeoutId = setTimeout(() => {
    setupTimeoutId = null;

    // Double-check state before adding listener
    if (signal.aborted) {
      return;
    }

    // Verify popover is still in DOM (could be removed during timeout)
    if (!document.body.contains(popover)) {
      cleanupListeners();
      return;
    }

    // Add click-outside handler with signal for automatic cleanup
    document.addEventListener('click', (e) => {
      // Early exit if already cleaned up
      if (signal.aborted || !document.body.contains(popover)) {
        return;
      }
      if (!popover.contains(e.target) && e.target.id !== 'timer-settings') {
        closePopover();
      }
    }, { signal });
  }, 0);

  return popover;
}

/**
 * Close any open timeout settings
 */
export function closeTimeoutSettings() {
  cleanupListeners();
  document.querySelector('.vault-timeout-settings')?.remove();
}
