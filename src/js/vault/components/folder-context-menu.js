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
    <button class="vault-ctx-item" data-action="${FOLDER_ACTIONS.RENAME}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      ${t('vault.actions.rename')}
    </button>
    <button class="vault-ctx-item" data-action="${FOLDER_ACTIONS.ADD_SUBFOLDER}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
      ${t('vault.actions.newSubfolder')}
    </button>
    <button class="vault-ctx-item" data-action="${FOLDER_ACTIONS.COLOR}">
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
    <button class="vault-ctx-item vault-ctx-danger" data-action="${FOLDER_ACTIONS.DELETE}">
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
  menu.querySelectorAll('.vault-ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      menu.remove();
      if (onAction) onAction(action, folderId, x, y);
    });
  });

  // Close on outside click - with safety check for removed elements
  const closeMenu = (e) => {
    // Guard: if menu was already removed, just cleanup listener
    if (!document.body.contains(menu)) {
      document.removeEventListener('click', closeMenu);
      return;
    }
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);

  return menu;
}

/**
 * Close any open folder context menu
 */
export function closeFolderContextMenu() {
  document.querySelector('.vault-folder-context-menu')?.remove();
}
