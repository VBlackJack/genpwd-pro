/**
 * @fileoverview Color Picker Component
 * Popover for selecting folder colors
 */

import { t } from '../../utils/i18n.js';

/**
 * Color data (static values)
 */
const COLOR_DATA = [
  { color: null, key: 'default' },
  { color: '#ef4444', key: 'red' },
  { color: '#f97316', key: 'orange' },
  { color: '#eab308', key: 'yellow' },
  { color: '#22c55e', key: 'green' },
  { color: '#06b6d4', key: 'cyan' },
  { color: '#3b82f6', key: 'blue' },
  { color: '#8b5cf6', key: 'purple' },
  { color: '#ec4899', key: 'pink' }
];

/**
 * Get folder colors with translated labels
 * @returns {Array<{color: string|null, label: string}>}
 */
export function getFolderColors() {
  return COLOR_DATA.map(c => ({
    color: c.color,
    label: t(`vault.colors.${c.key}`)
  }));
}

/**
 * Available folder colors (legacy export)
 * @deprecated Use getFolderColors() for translated labels
 */
export const FOLDER_COLORS = COLOR_DATA;

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
  const { x, y, currentColor, onColorSelected } = options;

  // Remove existing picker
  document.querySelector('.vault-color-picker')?.remove();

  const colors = getFolderColors();
  const picker = document.createElement('div');
  picker.className = 'vault-color-picker';
  picker.innerHTML = `
    <div class="vault-color-picker-header">${t('vault.folders.color')}</div>
    <div class="vault-color-picker-grid">
      ${colors.map(c => `
        <button class="vault-color-option ${c.color === currentColor || (!c.color && !currentColor) ? 'active' : ''}"
                data-color="${c.color || ''}"
                data-option-color="${c.color || ''}"
                title="${c.label}"
                aria-label="${c.label}"
                aria-pressed="${c.color === currentColor || (!c.color && !currentColor) ? 'true' : 'false'}">
          <span aria-hidden="true">${c.color === currentColor || (!c.color && !currentColor) ? '✓' : ''}</span>
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

  // Store previously focused element for focus restoration
  const previouslyFocused = document.activeElement;
  let isSelecting = false;

  // Event handlers with double-click prevention
  picker.querySelectorAll('.vault-color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSelecting) return;
      isSelecting = true;
      const color = btn.dataset.color || null;
      cleanup();
      if (onColorSelected) onColorSelected(color);
    });
  });

  // Focus first option
  const firstBtn = picker.querySelector('.vault-color-option');
  requestAnimationFrame(() => firstBtn?.focus());

  // Keyboard navigation and focus trap
  const handleKeydown = (e) => {
    const buttons = Array.from(picker.querySelectorAll('.vault-color-option'));
    const currentIndex = buttons.indexOf(document.activeElement);

    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    } else if (e.key === 'Tab') {
      // Focus trap
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = buttons[(currentIndex + 1) % buttons.length];
      next?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = buttons[(currentIndex - 1 + buttons.length) % buttons.length];
      prev?.focus();
    }
  };

  picker.addEventListener('keydown', handleKeydown);

  // Cleanup function
  const cleanup = () => {
    picker.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handler);
    picker.remove();
    // Restore focus if element still exists in DOM
    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  };

  // Close on click outside
  const handler = (e) => {
    if (!document.body.contains(picker)) {
      document.removeEventListener('click', handler);
      return;
    }
    if (!picker.contains(e.target)) {
      cleanup();
    }
  };
  setTimeout(() => document.addEventListener('click', handler), 0);

  return picker;
}

/**
 * Close any open color picker
 */
export function closeColorPicker() {
  document.querySelector('.vault-color-picker')?.remove();
}

const STORAGE_KEY = 'genpwd-vault-folder-colors';

/**
 * Get folder color from localStorage
 * @param {string} folderId - Folder ID
 * @returns {string|null} Color hex or null
 */
export function getFolderColor(folderId) {
  try {
    const colors = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return colors[folderId] || null;
  } catch {
    return null;
  }
}

/**
 * Set folder color in localStorage
 * @param {string} folderId - Folder ID
 * @param {string|null} color - Color hex or null to remove
 */
export function setFolderColor(folderId, color) {
  try {
    const colors = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (color) {
      colors[folderId] = color;
    } else {
      delete colors[folderId];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Silently fail - folder colors are not critical
  }
}
