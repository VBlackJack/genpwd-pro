/**
 * @fileoverview Folder Context Menu Component
 * Reusable context menu for folder operations
 */

/**
 * Folder context menu actions
 */
export const FOLDER_ACTIONS = {
  RENAME: 'rename',
  ADD_SUBFOLDER: 'add-subfolder',
  COLOR: 'color',
  DELETE: 'delete'
};

/**
 * Render folder context menu content
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} Menu HTML
 */
function renderFolderContextMenuContent({ t = (k) => k } = {}) {
  return `
    <button class="vault-ctx-item" role="menuitem" data-action="${FOLDER_ACTIONS.RENAME}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      ${t('vault.actions.rename')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="${FOLDER_ACTIONS.ADD_SUBFOLDER}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
      ${t('vault.actions.newSubfolder')}
    </button>
    <button class="vault-ctx-item" role="menuitem" data-action="${FOLDER_ACTIONS.COLOR}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="13.5" cy="6.5" r=".5"></circle>
        <circle cx="17.5" cy="10.5" r=".5"></circle>
        <circle cx="8.5" cy="7.5" r=".5"></circle>
        <circle cx="6.5" cy="12.5" r=".5"></circle>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path>
      </svg>
      ${t('vault.actions.color')}
    </button>
    <div class="vault-ctx-divider"></div>
    <button class="vault-ctx-item vault-ctx-danger" role="menuitem" data-action="${FOLDER_ACTIONS.DELETE}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      ${t('vault.common.delete')}
    </button>
  `;
}

/**
 * Show folder context menu at position
 * @param {Object} options
 * @param {string} options.folderId - Folder ID
 * @param {number} options.x - X position
 * @param {number} options.y - Y position
 * @param {Function} options.t - Translation function
 * @param {Function} options.onAction - Callback when action is selected (action, folderId, x, y)
 * @returns {HTMLElement} The menu element
 */
export function showFolderContextMenu({ folderId, x, y, t, onAction }) {
  // Remove existing context menu
  document.querySelector('.vault-folder-context-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'vault-folder-context-menu vault-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('vault.aria.folderContextMenu'));
  menu.innerHTML = renderFolderContextMenuContent({ t });

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);

  // Adjust position if off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${y - rect.height}px`;
  }

  // Handle actions
  const menuItems = menu.querySelectorAll('.vault-ctx-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      cleanup();
      if (onAction) onAction(action, folderId, x, y);
    });
  });

  // Keyboard navigation for accessibility
  let focusedIndex = -1;
  const focusableItems = Array.from(menuItems);

  const focusItem = (index) => {
    if (index >= 0 && index < focusableItems.length) {
      focusedIndex = index;
      focusableItems[index].focus();
    }
  };

  const handleKeydown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(focusedIndex < focusableItems.length - 1 ? focusedIndex + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(focusedIndex > 0 ? focusedIndex - 1 : focusableItems.length - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(focusableItems.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          const action = focusableItems[focusedIndex].dataset.action;
          cleanup();
          if (onAction) onAction(action, folderId, x, y);
        }
        break;
      case 'Escape':
        e.preventDefault();
        cleanup();
        break;
      case 'Tab':
        // Trap focus within menu
        e.preventDefault();
        if (e.shiftKey) {
          focusItem(focusedIndex > 0 ? focusedIndex - 1 : focusableItems.length - 1);
        } else {
          focusItem(focusedIndex < focusableItems.length - 1 ? focusedIndex + 1 : 0);
        }
        break;
    }
  };

  menu.addEventListener('keydown', handleKeydown);

  // Focus first item for keyboard users
  requestAnimationFrame(() => focusItem(0));

  // Track timeout for cleanup
  let closeTimeoutId = null;
  let closeHandler = null;

  // Centralized cleanup function
  const cleanup = () => {
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    if (closeHandler) {
      document.removeEventListener('click', closeHandler);
      closeHandler = null;
    }
    menu.removeEventListener('keydown', handleKeydown);
    if (document.body.contains(menu)) {
      menu.remove();
    }
  };

  // Close on outside click - with safety check for removed elements
  const closeMenu = (e) => {
    // Guard: if menu was already removed, just cleanup listener
    if (!document.body.contains(menu)) {
      if (closeHandler) {
        document.removeEventListener('click', closeHandler);
        closeHandler = null;
      }
      return;
    }
    // Guard: e.target may be null in edge cases
    if (!e.target || !menu.contains(e.target)) {
      cleanup();
    }
  };

  // Store reference for cleanup
  closeHandler = closeMenu;
  closeTimeoutId = setTimeout(() => {
    closeTimeoutId = null;
    // Only add listener if menu still exists
    if (document.body.contains(menu)) {
      document.addEventListener('click', closeHandler);
    }
  }, 100);

  // Store cleanup function on menu element for external cleanup
  menu._cleanup = cleanup;

  return menu;
}

/**
 * Close any open folder context menu
 */
export function closeFolderContextMenu() {
  const menu = document.querySelector('.vault-folder-context-menu');
  if (menu) {
    // Call cleanup if available to clear timeout and listeners
    if (typeof menu._cleanup === 'function') {
      menu._cleanup();
    }
    menu.remove();
  }
}
