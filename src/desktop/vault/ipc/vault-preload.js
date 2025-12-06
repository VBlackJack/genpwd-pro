/**
 * @fileoverview Vault Preload API
 * Exposes vault operations to the renderer via contextBridge
 *
 * Usage in preload.cjs:
 *   const { exposeVaultAPI } = require('./src/desktop/vault/ipc/vault-preload.js');
 *   exposeVaultAPI(contextBridge, ipcRenderer);
 *
 * Usage in renderer:
 *   const entries = await window.vault.entries.getAll();
 */

/**
 * Expose vault API to renderer
 * @param {Electron.ContextBridge} contextBridge
 * @param {Electron.IpcRenderer} ipcRenderer
 */
function exposeVaultAPI(contextBridge, ipcRenderer) {
  contextBridge.exposeInMainWorld('vault', {
    // ==================== STATE ====================

    /**
     * Get current vault state
     * @returns {Promise<{status: string, vaultId: string|null, vaultName: string|null}>}
     */
    getState: () => ipcRenderer.invoke('vault:getState'),

    /**
     * List available vaults
     * @returns {Promise<Array<{id: string, name: string, modifiedAt: string}>>}
     */
    list: () => ipcRenderer.invoke('vault:list'),

    /**
     * Create new vault
     * @param {string} name - Vault name
     * @param {string} password - Master password
     * @returns {Promise<{vaultId: string, success: boolean}>}
     */
    create: (name, password) => ipcRenderer.invoke('vault:create', { name, password }),

    /**
     * Unlock vault
     * @param {string} vaultId - Vault ID
     * @param {string} password - Master password
     * @returns {Promise<{success: boolean}>}
     */
    unlock: (vaultId, password) => ipcRenderer.invoke('vault:unlock', { vaultId, password }),

    /**
     * Lock current vault
     * @returns {Promise<{success: boolean}>}
     */
    lock: () => ipcRenderer.invoke('vault:lock'),

    /**
     * Get vault metadata
     * @returns {Promise<Object|null>}
     */
    getMetadata: () => ipcRenderer.invoke('vault:getMetadata'),

    /**
     * Reset activity timer
     * @returns {Promise<{success: boolean}>}
     */
    resetActivity: () => ipcRenderer.invoke('vault:resetActivity'),

    /**
     * Change vault password
     * @param {string} vaultId
     * @param {string} currentPassword
     * @param {string} newPassword
     * @returns {Promise<{success: boolean}>}
     */
    changePassword: (vaultId, currentPassword, newPassword) =>
      ipcRenderer.invoke('vault:changePassword', { vaultId, currentPassword, newPassword }),

    /**
     * Delete vault
     * @param {string} vaultId
     * @returns {Promise<{success: boolean}>}
     */
    delete: (vaultId) => ipcRenderer.invoke('vault:delete', { vaultId }),

    // ==================== ENTRIES ====================

    entries: {
      /**
       * Get all entries
       * @returns {Promise<Array>}
       */
      getAll: () => ipcRenderer.invoke('vault:entries:getAll'),

      /**
       * Get entry by ID
       * @param {string} id
       * @returns {Promise<Object|null>}
       */
      get: (id) => ipcRenderer.invoke('vault:entries:get', { id }),

      /**
       * Get entries by folder
       * @param {string|null} folderId
       * @returns {Promise<Array>}
       */
      getByFolder: (folderId) => ipcRenderer.invoke('vault:entries:getByFolder', { folderId }),

      /**
       * Search entries
       * @param {string} query
       * @returns {Promise<Array>}
       */
      search: (query) => ipcRenderer.invoke('vault:entries:search', { query }),

      /**
       * Add new entry
       * @param {string} type - Entry type
       * @param {string} title - Entry title
       * @param {Object} data - Entry data
       * @returns {Promise<Object>}
       */
      add: (type, title, data) => ipcRenderer.invoke('vault:entries:add', { type, title, data }),

      /**
       * Update entry
       * @param {string} id - Entry ID
       * @param {Object} updates - Fields to update
       * @returns {Promise<Object|null>}
       */
      update: (id, updates) => ipcRenderer.invoke('vault:entries:update', { id, updates }),

      /**
       * Delete entry
       * @param {string} id
       * @returns {Promise<boolean>}
       */
      delete: (id) => ipcRenderer.invoke('vault:entries:delete', { id })
    },

    // ==================== FOLDERS ====================

    folders: {
      /**
       * Get all folders
       * @returns {Promise<Array>}
       */
      getAll: () => ipcRenderer.invoke('vault:folders:getAll'),

      /**
       * Add folder
       * @param {string} name
       * @param {string|null} parentId
       * @returns {Promise<Object>}
       */
      add: (name, parentId) => ipcRenderer.invoke('vault:folders:add', { name, parentId }),

      /**
       * Update folder
       * @param {string} id
       * @param {Object} updates
       * @returns {Promise<Object|null>}
       */
      update: (id, updates) => ipcRenderer.invoke('vault:folders:update', { id, updates }),

      /**
       * Delete folder
       * @param {string} id
       * @param {boolean} deleteEntries
       * @returns {Promise<boolean>}
       */
      delete: (id, deleteEntries) => ipcRenderer.invoke('vault:folders:delete', { id, deleteEntries })
    },

    // ==================== TAGS ====================

    tags: {
      /**
       * Get all tags
       * @returns {Promise<Array>}
       */
      getAll: () => ipcRenderer.invoke('vault:tags:getAll'),

      /**
       * Add tag
       * @param {string} name
       * @param {string} color
       * @returns {Promise<Object>}
       */
      add: (name, color) => ipcRenderer.invoke('vault:tags:add', { name, color }),

      /**
       * Delete tag
       * @param {string} id
       * @returns {Promise<boolean>}
       */
      delete: (id) => ipcRenderer.invoke('vault:tags:delete', { id })
    },

    // ==================== EVENTS ====================

    /**
     * Listen to vault events
     * @param {string} event - Event name ('locked', 'unlocked', 'changed', 'error')
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    on: (event, callback) => {
      const channel = `vault:${event}`;
      const handler = (_, data) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },

    /**
     * Listen to vault event once
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    once: (event, callback) => {
      const channel = `vault:${event}`;
      ipcRenderer.once(channel, (_, data) => callback(data));
    }
  });
}

// Export for CommonJS (preload scripts are CommonJS)
if (typeof module !== 'undefined') {
  module.exports = { exposeVaultAPI };
}

export { exposeVaultAPI };
