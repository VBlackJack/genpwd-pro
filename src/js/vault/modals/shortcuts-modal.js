/**
 * @fileoverview Shortcuts Modal
 * Keyboard shortcuts help modal
 */

import { renderModal } from './base-modal.js';
import { t } from '../../utils/i18n.js';

/**
 * Get shortcut categories with translations
 * @returns {Array} Shortcut categories
 */
function getShortcutCategories() {
  return [
    {
      title: t('vault.shortcuts.general'),
      shortcuts: [
        { keys: ['Ctrl', 'L'], description: t('settingsModal.shortcuts.lockVault') },
        { keys: ['Ctrl/Alt', 'F'], description: t('vault.shortcuts.focusSearch') },
        { keys: ['?'], description: t('vault.shortcuts.showShortcuts') },
        { keys: ['Esc'], description: t('settingsModal.shortcuts.closeModal') }
      ]
    },
    {
      title: t('vault.shortcuts.entries'),
      shortcuts: [
        { keys: ['Ctrl/Alt', 'N'], description: t('vault.shortcuts.newEntry') },
        { keys: ['Ctrl', 'E'], description: t('vault.shortcuts.editEntry') },
        { keys: ['Ctrl', 'D'], description: t('vault.shortcuts.duplicateEntry') },
        { keys: ['Delete'], alt: ['Alt', 'D'], description: t('vault.shortcuts.deleteEntry') },
        { keys: ['↑', '↓'], description: t('settingsModal.shortcuts.navigate') }
      ]
    },
    {
      title: t('vault.shortcuts.quickActions'),
      shortcuts: [
        { keys: ['Ctrl', 'U'], description: t('vault.shortcuts.copyUsername') },
        { keys: ['Ctrl', 'P'], description: t('vault.shortcuts.copyPassword') },
        { keys: ['Ctrl', 'Shift', 'U'], description: t('vault.shortcuts.autoFill') }
      ]
    }
  ];
}

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
 * @param {Array} [shortcut.alt] - Alternative key combination
 * @param {string} shortcut.description - Shortcut description
 * @returns {string} HTML string
 */
function renderShortcutRow(shortcut) {
  const keysHtml = shortcut.keys.map(renderKey).join('<span class="vault-shortcut-plus">+</span>');
  const altHtml = shortcut.alt
    ? `<span class="vault-shortcut-or">/</span>${shortcut.alt.map(renderKey).join('<span class="vault-shortcut-plus">+</span>')}`
    : '';

  return `
    <div class="vault-shortcut-row">
      <div class="vault-shortcut-keys">${keysHtml}${altHtml}</div>
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
  const categories = getShortcutCategories();
  return `
    <div class="vault-modal-body vault-shortcuts-body">
      <div class="vault-shortcuts-grid">
        ${categories.map(renderCategory).join('')}
      </div>
    </div>
  `;
}

/**
 * Render shortcuts modal
 * @returns {string} HTML string
 */
export function renderShortcutsModal() {
  return renderModal({
    id: 'shortcuts-modal',
    title: t('vault.shortcuts.title'),
    content: renderShortcutsContent(),
    size: 'md',
    t
  });
}

/**
 * Get all shortcut definitions for external use
 * @returns {Array} Shortcut categories
 */
export { getShortcutCategories };
