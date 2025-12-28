/**
 * @fileoverview Shortcuts Modal
 * Keyboard shortcuts help modal
 */

import { renderModal } from './base-modal.js';

/**
 * Shortcut categories
 */
const SHORTCUT_CATEGORIES = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'L'], description: 'Lock vault' },
      { keys: ['Ctrl', 'F'], description: 'Focus search' },
      { keys: ['?'], description: 'Show shortcuts' },
      { keys: ['Esc'], description: 'Close modal' }
    ]
  },
  {
    title: 'Entries',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New entry' },
      { keys: ['Ctrl', 'E'], description: 'Edit entry' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate entry' },
      { keys: ['Delete'], description: 'Delete entry' },
      { keys: ['↑', '↓'], description: 'Navigate entries' }
    ]
  },
  {
    title: 'Quick Actions',
    shortcuts: [
      { keys: ['Ctrl', 'U'], description: 'Copy username' },
      { keys: ['Ctrl', 'P'], description: 'Copy password' },
      { keys: ['Ctrl', 'Shift', 'U'], description: 'Auto-fill form' }
    ]
  }
];

/**
 * Render keyboard shortcut key
 * @param {string} key - Key to render
 * @returns {string} HTML string
 */
function renderKey(key) {
  return `<kbd class="vault-shortcut-key">${key}</kbd>`;
}

/**
 * Render keyboard shortcut row
 * @param {Object} shortcut - Shortcut definition
 * @param {Array} shortcut.keys - Key combination
 * @param {string} shortcut.description - Shortcut description
 * @returns {string} HTML string
 */
function renderShortcutRow(shortcut) {
  const keysHtml = shortcut.keys.map(renderKey).join('<span class="vault-shortcut-plus">+</span>');

  return `
    <div class="vault-shortcut-row">
      <div class="vault-shortcut-keys">${keysHtml}</div>
      <div class="vault-shortcut-desc">${shortcut.description}</div>
    </div>
  `;
}

/**
 * Render shortcut category
 * @param {Object} category - Category definition
 * @param {string} category.title - Category title
 * @param {Array} category.shortcuts - Category shortcuts
 * @returns {string} HTML string
 */
function renderCategory(category) {
  return `
    <div class="vault-shortcut-category">
      <h4 class="vault-shortcut-category-title">${category.title}</h4>
      ${category.shortcuts.map(renderShortcutRow).join('')}
    </div>
  `;
}

/**
 * Render shortcuts modal content
 * @returns {string} HTML string
 */
function renderShortcutsContent() {
  return `
    <div class="vault-modal-body vault-shortcuts-body">
      <div class="vault-shortcuts-grid">
        ${SHORTCUT_CATEGORIES.map(renderCategory).join('')}
      </div>
    </div>
  `;
}

/**
 * Render shortcuts modal
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderShortcutsModal(options = {}) {
  const { t = (k) => k } = options;

  return renderModal({
    id: 'shortcuts-modal',
    title: 'Keyboard shortcuts',
    content: renderShortcutsContent(),
    size: 'md',
    t
  });
}

/**
 * Get all shortcut definitions for external use
 * @returns {Array} Shortcut categories
 */
export function getShortcutCategories() {
  return SHORTCUT_CATEGORIES;
}
