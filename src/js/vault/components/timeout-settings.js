/**
 * @fileoverview Timeout Settings Component
 * Popover for configuring auto-lock timeout
 */

/**
 * Default timeout options
 */
export const TIMEOUT_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' }
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
      <span>${t('vault.settings.lockTimeout') || 'Lock timeout'}</span>
    </div>
    <div class="vault-timeout-options">
      ${TIMEOUT_OPTIONS.map(opt => `
        <button class="vault-timeout-option ${opt.value === currentTimeout ? 'active' : ''}"
                data-timeout="${opt.value}">
          ${opt.label}
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
