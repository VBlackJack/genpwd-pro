/**
 * @fileoverview Timeout Settings Component
 * Popover for configuring auto-lock timeout
 */

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

  // Remove existing popover
  document.querySelector('.vault-timeout-settings')?.remove();

  if (!targetElement) return null;

  const popover = document.createElement('div');
  popover.className = 'vault-timeout-settings';
  popover.innerHTML = `
    <div class="vault-timeout-header">
      <span>${t('vault.settings.lockTimeout')}</span>
    </div>
    <div class="vault-timeout-options">
      ${TIMEOUT_OPTIONS.map(opt => `
        <button class="vault-timeout-option ${opt.value === currentTimeout ? 'active' : ''}"
                data-timeout="${opt.value}">
          ${t(opt.labelKey)}
        </button>
      `).join('')}
    </div>
  `;

  targetElement.appendChild(popover);

  // Event handlers
  popover.querySelectorAll('.vault-timeout-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const newTimeout = parseInt(btn.dataset.timeout, 10);
      const label = btn.textContent.trim();

      // Update UI
      popover.querySelectorAll('.vault-timeout-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (onTimeoutSelected) {
        onTimeoutSelected(newTimeout, label);
      }

      popover.remove();
    });
  });

  // Close on click outside
  setTimeout(() => {
    const handler = (e) => {
      if (!popover.contains(e.target) && e.target.id !== 'timer-settings') {
        popover.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);

  return popover;
}

/**
 * Close any open timeout settings
 */
export function closeTimeoutSettings() {
  document.querySelector('.vault-timeout-settings')?.remove();
}
