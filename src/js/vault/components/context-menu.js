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
      <button class="vault-ctx-item" role="menuitem" data-action="copy-username">
        <span class="vault-ctx-item-icon" aria-hidden="true">👤</span>
        ${t('vault.actions.copyUsername')}
      </button>
    ` : ''}
    ${entry.type === 'login' && entry.data?.password ? `
      <button class="vault-ctx-item" role="menuitem" data-action="copy-password">
        <span class="vault-ctx-item-icon" aria-hidden="true">🔑</span>
        ${t('vault.actions.copyPassword')}
      </button>
    ` : ''}
    ${entry.data?.url ? `
      <button class="vault-ctx-item" role="menuitem" data-action="open-url">
        <span class="vault-ctx-item-icon" aria-hidden="true">🔗</span>
        ${t('vault.actions.openWebsite')}
      </button>
    ` : ''}
    <div class="vault-ctx-divider"></div>
    <button class="vault-ctx-item" role="menuitem" data-action="edit">
      <span class="vault-ctx-item-icon" aria-hidden="true">✏️</span>
      ${t('vault.common.edit')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="duplicate">
      <span class="vault-ctx-item-icon" aria-hidden="true">📋</span>
      ${t('vault.common.duplicate')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="move">
      <span class="vault-ctx-item-icon" aria-hidden="true">📁</span>
      ${t('vault.common.move')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="toggle-favorite">
      <span class="vault-ctx-item-icon" aria-hidden="true">${entry.favorite ? '☆' : '★'}</span>
      ${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="toggle-pin">
      <span class="vault-ctx-item-icon" aria-hidden="true">${entry.pinned ? '📍' : '📌'}</span>
      ${entry.pinned ? t('vault.actions.unpin') : t('vault.actions.pinToTop')}
    </button>
    <div class="vault-ctx-divider"></div>
    <button class="vault-ctx-item vault-ctx-danger" role="menuitem" data-action="delete">
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
export function showContextMenu({ entry, x, y, getEntryTypes, t = (k) => k, onAction }) {
  // Remove existing context menu
  document.querySelector('.vault-context-menu')?.remove();

  // Validate entry exists
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const menu = document.createElement('div');
  menu.className = 'vault-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('vault.aria.contextMenu'));

  try {
    menu.innerHTML = renderContextMenuContent({ entry, getEntryTypes, t });
  } catch {
    // Fallback if rendering fails - use translated error without exposing details
    const errorText = typeof t === 'function' ? t('vault.common.error') : '';
    menu.innerHTML = `<div class="vault-ctx-item vault-ctx-error">${escapeHtml(errorText) || '⚠'}</div>`;
  }

  // Position the menu
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Adjust if menu goes off-screen (all edges)
  let posX = Math.max(10, x);
  let posY = Math.max(10, y);
  if (posX + rect.width > viewportW) posX = Math.max(10, viewportW - rect.width - 10);
  if (posY + rect.height > viewportH) posY = Math.max(10, viewportH - rect.height - 10);

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

  // Centralized cleanup for guaranteed listener removal
  let clickHandler = null;
  let escHandler = null;
  let setupTimeoutId = null;

  const cleanupListeners = () => {
    if (setupTimeoutId) {
      clearTimeout(setupTimeoutId);
      setupTimeoutId = null;
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  };

  const closeAndCleanup = () => {
    cleanupListeners();
    if (document.body.contains(menu)) {
      menu.remove();
    }
  };

  // Store cleanup on menu element for external access
  menu._cleanup = closeAndCleanup;

  // Close on click outside or Escape
  setupTimeoutId = setTimeout(() => {
    setupTimeoutId = null;
    // Guard: menu may have been removed before timeout fires
    if (!document.body.contains(menu)) {
      return;
    }
    clickHandler = (e) => {
      if (!document.body.contains(menu)) {
        cleanupListeners();
        return;
      }
      if (!menu.contains(e.target)) {
        closeAndCleanup();
      }
    };
    escHandler = (e) => {
      if (e.key === 'Escape') {
        if (!document.body.contains(menu)) {
          cleanupListeners();
          return;
        }
        closeAndCleanup();
      }
    };
    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', escHandler);
  }, 0);

  return menu;
}

/**
 * Close any open context menu
 */
export function closeContextMenu() {
  const menu = document.querySelector('.vault-context-menu');
  if (menu) {
    if (typeof menu._cleanup === 'function') {
      menu._cleanup();
    } else {
      menu.remove();
    }
  }
}
