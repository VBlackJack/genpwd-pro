/**
 * @fileoverview Vault Module Entry Point
 * GenPwd Desktop - Encrypted Vault System
 *
 * Architecture:
 *   Main Process:
 *     - CryptoEngine (Argon2id + XSalsa20-Poly1305)
 *     - VaultFileManager (file I/O for .gpd files)
 *     - VaultSessionManager (in-memory session with auto-lock)
 *     - IPC Handlers (vault operations exposed to renderer)
 *
 *   Renderer Process:
 *     - window.vault API (via contextBridge)
 *     - Event listeners for vault state changes
 *
 * Usage (Main Process):
 *   import { registerVaultIPC, setMainWindow } from './vault/index.js';
 *   registerVaultIPC(ipcMain);
 *   setMainWindow(mainWindow);
 *
 * Usage (Preload):
 *   const { exposeVaultAPI } = require('./vault/ipc/vault-preload.js');
 *   exposeVaultAPI(contextBridge, ipcRenderer);
 *
 * Usage (Renderer):
 *   await window.vault.create('My Vault', 'password123');
 *   await window.vault.unlock(vaultId, 'password123');
 *   const entries = await window.vault.entries.getAll();
 */

// Main Process Exports
export { CryptoEngine, cryptoEngine } from './crypto/crypto-engine.js';
export { VaultFileManager, vaultFileManager } from './storage/vault-file-manager.js';
export { VaultSessionManager, vaultSession } from './session/vault-session.js';
export { registerVaultIPC, setMainWindow, getSession } from './ipc/vault-ipc-handlers.js';

// Models
export {
  createMetadata,
  createFolder,
  createTag,
  createEntry,
  createEmptyVault,
  VAULT_FORMAT_VERSION
} from './models/vault-types.js';

// Re-export preload for convenience (though it needs CommonJS in preload)
export { exposeVaultAPI } from './ipc/vault-preload.js';
