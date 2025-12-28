/**
 * @fileoverview Vault Module Index
 *
 * Core vault modules (cryptography, storage, models)
 * Plus newly extracted utility modules for vault-ui.js maintainability.
 *
 * UI MIGRATION STATUS:
 * The original vault-ui.js (10,911 lines) is still the main controller.
 * Individual UI utilities are being progressively extracted to utils/.
 */

// ==================== CORE VAULT MODULES ====================
export * from './models.js';
export * from './interfaces.js';
export * from './crypto-engine.js';
export * from './kdf-service.js';
export * from './session-manager.js';
export * from './in-memory-repository.js';

// ==================== UI UTILITIES ====================
// Newly extracted from vault-ui.js for better maintainability
// Import directly from utils/ for tree-shaking benefits:
// import { escapeHtml, formatDate } from './vault/utils/index.js';
export * from './utils/index.js';
