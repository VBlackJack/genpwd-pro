/**
 * @fileoverview Context Menu Component
 * Reusable context menu for entries
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Get entry type info
 * @param {string} type - Entry type
 * @param {Function} getEntryTypes - Function to get entry types config
 * @returns {Object} Type info with icon and color
 */
function getTypeInfo(type, getEntryTypes) {
  const defaultType = { icon: '🔑', color: '#60a5fa' };
  if (!getEntryTypes) return defaultType;
  const types = getEntryTypes();
  if (!types || !type) return defaultType;
  return types[type] || types.login || defaultType;
}

/**
 * Render context menu HTML
 * @param {Object} options
 * @param {Object} options.entry - Entry data
 * @param {Function} options.getEntryTypes - Function to get entry types
 * @param {Function} options.t - Translation function
 * @returns {string} Menu HTML
 */
export function renderContextMenuContent({ entry, getEntryTypes, t = (k) => k }) {
  const type = getTypeInfo(entry.type, getEntryTypes);

  return `
    <div class="vault-ctx-header">
      <span class="vault-ctx-icon" data-type-color="${type.color}" aria-hidden="true">${type.icon}</span>
      <span class="vault-ctx-title">${escapeHtml(entry.title)}</span>
    </div>
    <div class="vault-ctx-divider"></div>
    ${entry.type === 'login' && entry.data?.username ? `
      <button class="vault-ctx-item" data-action="copy-username">
        <span class="vault-ctx-item-icon" aria-hidden="true">👤</span>
        ${t('vault.actions.copyUsername')}
      </button>
    ` : ''}
    ${entry.type === 'login' && entry.data?.password ? `
      <button class="vault-ctx-item" data-action="copy-password">
        <span class="vault-ctx-item-icon" aria-hidden="true">🔑</span>
        ${t('vault.actions.copyPassword')}
      </button>
    ` : ''}
    ${entry.data?.url ? `
      <button class="vault-ctx-item" data-action="open-url">
        <span class="vault-ctx-item-icon" aria-hidden="true">🔗</span>
        ${t('vault.actions.openWebsite')}
      </button>
    ` : ''}
    <div class="vault-ctx-divider"></div>
    <button class="vault-ctx-item" data-action="edit">
      <span class="vault-ctx-item-icon" aria-hidden="true">✏️</span>
      ${t('vault.common.edit')}
    </button>
    <button class="vault-ctx-item" data-action="duplicate">
      <span class="vault-ctx-item-icon" aria-hidden="true">📋</span>
      ${t('vault.common.duplicate')}
    </button>
    <button class="vault-ctx-item" data-action="move">
      <span class="vault-ctx-item-icon" aria-hidden="true">📁</span>
      ${t('vault.common.move')}
    </button>
    <button class="vault-ctx-item" data-action="toggle-favorite">
      <span class="vault-ctx-item-icon" aria-hidden="true">${entry.favorite ? '☆' : '★'}</span>
      ${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}
    </button>
    <button class="vault-ctx-item" data-action="toggle-pin">
      <span class="vault-ctx-item-icon" aria-hidden="true">${entry.pinned ? '📍' : '📌'}</span>
      ${entry.pinned ? t('vault.actions.unpin') : t('vault.actions.pinToTop')}
    </button>
    <div class="vault-ctx-divider"></div>
    <button class="vault-ctx-item vault-ctx-danger" data-action="delete">
      <span class="vault-ctx-item-icon" aria-hidden="true">🗑️</span>
      ${t('vault.common.delete')}
    </button>
  `;
}

/**
 * Show context menu at position
 * @param {Object} options
 * @param {Object} options.entry - Entry data
 * @param {number} options.x - X position
 * @param {number} options.y - Y position
 * @param {Function} options.getEntryTypes - Function to get entry types
 * @param {Function} options.t - Translation function
 * @param {Function} options.onAction - Callback when action is selected (action, entry)
 * @returns {HTMLElement} The menu element
 */
export function showContextMenu({ entry, x, y, getEntryTypes, t, onAction }) {
  // Remove existing context menu
  document.querySelector('.vault-context-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'vault-context-menu';
  menu.innerHTML = renderContextMenuContent({ entry, getEntryTypes, t });

  // Position the menu
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Adjust if menu goes off-screen
  let posX = x;
  let posY = y;
  if (x + rect.width > viewportW) posX = viewportW - rect.width - 10;
  if (y + rect.height > viewportH) posY = viewportH - rect.height - 10;

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;

  // Event handlers
  const closeMenu = () => menu.remove();

  menu.querySelectorAll('.vault-ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      closeMenu();
      if (onAction) onAction(action, entry);
    });
  });

  // Close on click outside or Escape
  setTimeout(() => {
    const cleanup = () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', escHandler);
    };
    const handler = (e) => {
      if (!document.body.contains(menu)) {
        cleanup();
        return;
      }
      if (!menu.contains(e.target)) {
        closeMenu();
        cleanup();
      }
    };
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        if (!document.body.contains(menu)) {
          cleanup();
          return;
        }
        closeMenu();
        cleanup();
      }
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', escHandler);
  }, 0);

  return menu;
}

/**
 * Close any open context menu
 */
export function closeContextMenu() {
  document.querySelector('.vault-context-menu')?.remove();
}
