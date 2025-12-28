/**
 * @fileoverview Color Picker Component
 * Popover for selecting folder colors
 */

/**
 * Available folder colors
 */
export const FOLDER_COLORS = [
  { color: null, label: 'Default' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#eab308', label: 'Yellow' },
  { color: '#22c55e', label: 'Green' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#ec4899', label: 'Pink' }
];

/**
 * Show color picker popover
 * @param {Object} options
 * @param {number} options.x - X position
 * @param {number} options.y - Y position
 * @param {string|null} options.currentColor - Current selected color
 * @param {Function} options.onColorSelected - Called with color when selected
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The picker element
 */
export function showColorPicker(options = {}) {
  const { x, y, currentColor, onColorSelected, t = (k) => k } = options;

  // Remove existing picker
  document.querySelector('.vault-color-picker')?.remove();

  const picker = document.createElement('div');
  picker.className = 'vault-color-picker';
  picker.innerHTML = `
    <div class="vault-color-picker-header">${t('vault.folders.color') || 'Folder color'}</div>
    <div class="vault-color-picker-grid">
      ${FOLDER_COLORS.map(c => `
        <button class="vault-color-option ${c.color === currentColor || (!c.color && !currentColor) ? 'active' : ''}"
                data-color="${c.color || ''}"
                data-option-color="${c.color || ''}"
                title="${c.label}">
          ${c.color === currentColor || (!c.color && !currentColor) ? '✓' : ''}
        </button>
      `).join('')}
    </div>
  `;

  // Apply CSP-compliant styles via CSSOM
  picker.querySelectorAll('[data-option-color]').forEach(btn => {
    const color = btn.dataset.optionColor;
    btn.style.setProperty('--option-color', color || 'var(--vault-text-muted)');
  });

  document.body.appendChild(picker);

  // Position with boundary checks
  const rect = picker.getBoundingClientRect();
  let posX = x;
  let posY = y;
  if (x + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
  if (y + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 10;
  picker.style.left = `${posX}px`;
  picker.style.top = `${posY}px`;

  // Event handlers
  picker.querySelectorAll('.vault-color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color || null;
      picker.remove();
      if (onColorSelected) onColorSelected(color);
    });
  });

  // Close on click outside
  setTimeout(() => {
    const handler = (e) => {
      if (!document.body.contains(picker)) {
        document.removeEventListener('click', handler);
        return;
      }
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);

  return picker;
}

/**
 * Close any open color picker
 */
export function closeColorPicker() {
  document.querySelector('.vault-color-picker')?.remove();
}
