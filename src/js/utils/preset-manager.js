/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// src/js/utils/preset-manager.js - Configuration preset management

import { safeLog } from './logger.js';
import { safeSetItem, safeGetItem } from './storage-helper.js';

/**
 * @typedef {Object} Preset
 * @property {string} id - Unique preset ID
 * @property {string} name - User-friendly preset name
 * @property {string} description - Optional description
 * @property {Object} config - Password generation configuration
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {boolean} isDefault - Whether this is the default preset
 */

const STORAGE_KEY = 'genpwd_presets';
const DEFAULT_PRESET_ID = 'default';

class PresetManager {
  // Private properties for vault event unsubscribe functions
  #unsubscribeUnlocked = null;
  #unsubscribeLocked = null;

  constructor() {
    this.presets = new Map();
    this.vaultListenersInitialized = false;
    this.updateUICallback = null;
    // Only load default preset at startup (custom presets come from vault)
    this.ensureDefaultPreset();
    // Initialize vault listeners for unlock/lock events
    this.initVaultListeners();
  }

  /**
   * Set callback to update UI when presets change
   * @param {Function} callback
   */
  setUpdateUICallback(callback) {
    this.updateUICallback = callback;
  }

  /**
   * Notify UI of preset changes
   */
  notifyUIUpdate() {
    if (typeof this.updateUICallback === 'function') {
      this.updateUICallback();
    }
    // Also dispatch custom event for other listeners
    window.dispatchEvent(new CustomEvent('presets-changed'));
  }

  /**
   * Initialize vault event listeners for unlock/lock
   * Uses window.vault.on() API which works with Electron's context isolation
   */
  initVaultListeners() {
    if (this.vaultListenersInitialized) return;
    if (typeof window === 'undefined') return;

    // Wait for vault API to be available (Electron only)
    // Use setTimeout to allow the app to fully initialize
    const checkVaultAndSubscribe = () => {
      if (!window.vault) {
        safeLog('[PresetManager] Vault API not available - browser mode');
        return;
      }

      // Listen for vault unlock via IPC bridge (works with context isolation)
      this.#unsubscribeUnlocked = window.vault.on('unlocked', async () => {
        safeLog('[PresetManager] Vault unlocked - loading custom presets');
        await this.loadCustomPresetsFromVault();
        this.notifyUIUpdate();
      });

      // Listen for vault lock
      this.#unsubscribeLocked = window.vault.on('locked', () => {
        safeLog('[PresetManager] Vault locked - clearing custom presets');
        this.clearCustomPresets();
        this.notifyUIUpdate();
      });

      this.vaultListenersInitialized = true;
      safeLog('[PresetManager] Vault event listeners initialized (using vault.on API)');
    };

    // Check immediately and also after a short delay for timing issues
    checkVaultAndSubscribe();
  }

  /**
   * Load custom presets from vault (called on vault unlock)
   * @returns {Promise<number>} Number of presets loaded
   */
  async loadCustomPresetsFromVault() {
    if (!await this.isVaultReady()) {
      safeLog('[PresetManager] Vault not ready, skipping load');
      return 0;
    }

    try {
      const vaultPresets = await this.getVaultPresets();
      let loaded = 0;

      for (const entry of vaultPresets) {
        const data = entry.data;
        if (!data?.config) continue;

        // Create preset from vault entry
        const preset = {
          id: entry.id, // Use vault entry ID as preset ID for sync
          name: entry.title,
          description: data.description || '',
          config: { ...data.config },
          createdAt: new Date(entry.createdAt || Date.now()),
          updatedAt: new Date(entry.modifiedAt || Date.now()),
          isDefault: false,
          vaultEntryId: entry.id // Reference to vault entry
        };

        this.presets.set(preset.id, preset);
        loaded++;
      }

      safeLog(`[PresetManager] Loaded ${loaded} custom presets from vault`);
      return loaded;
    } catch (error) {
      safeLog(`[PresetManager] Error loading from vault: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clear all custom presets (keep only default)
   * Called on vault lock
   */
  clearCustomPresets() {
    const defaultPreset = this.presets.get(DEFAULT_PRESET_ID);
    this.presets.clear();
    if (defaultPreset) {
      this.presets.set(DEFAULT_PRESET_ID, defaultPreset);
    }
    safeLog('[PresetManager] Custom presets cleared (vault locked)');
  }

  /**
   * Load presets from localStorage (legacy - only for migration)
   * @deprecated Use loadCustomPresetsFromVault instead
   */
  loadPresets() {
    // No longer load from localStorage - presets are vault-only
    safeLog('[PresetManager] localStorage loading disabled - use vault');
  }

  /**
   * Save all presets to localStorage (legacy - disabled)
   * @deprecated Presets are now saved to vault
   */
  savePresets() {
    // No longer save to localStorage - presets are vault-only
    // This is kept for API compatibility but does nothing
    safeLog('[PresetManager] localStorage saving disabled - using vault');
  }

  /**
   * Save a preset to the vault
   * @param {Object} preset - Preset to save
   * @returns {Promise<boolean>} Success status
   */
  async savePresetToVault(preset) {
    if (!await this.isVaultReady()) {
      safeLog('[PresetManager] Cannot save to vault - not ready');
      return false;
    }

    try {
      const entryData = {
        presetId: preset.id,
        description: preset.description,
        config: preset.config,
        savedAt: new Date().toISOString()
      };

      // If preset has a vault entry ID, update it; otherwise create new
      if (preset.vaultEntryId) {
        await window.vault.entries.update(preset.vaultEntryId, {
          title: preset.name,
          data: entryData
        });
        safeLog(`[PresetManager] Updated preset in vault: ${preset.name}`);
      } else {
        const result = await window.vault.entries.add(
          'preset',
          preset.name,
          entryData,
          { favorite: false }
        );
        if (result?.id) {
          preset.vaultEntryId = result.id;
          preset.id = result.id; // Use vault ID
          this.presets.delete(preset.id); // Remove old entry
          this.presets.set(result.id, preset); // Add with new ID
          safeLog(`[PresetManager] Created preset in vault: ${preset.name}`);
        }
      }
      return true;
    } catch (error) {
      safeLog(`[PresetManager] Error saving to vault: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure default preset exists
   */
  ensureDefaultPreset() {
    if (!this.presets.has(DEFAULT_PRESET_ID)) {
      const defaultPreset = {
        id: DEFAULT_PRESET_ID,
        name: 'Par défaut',
        description: 'Configuration par défaut recommandée',
        config: {
          mode: 'syllables',
          length: 20,
          policy: 'standard',
          digits: 2,
          specials: 2,
          customSpecials: '_+-=.@#%',
          placeDigits: 'aleatoire',
          placeSpecials: 'aleatoire',
          caseMode: 'mixte',
          quantity: 5
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true
      };
      this.presets.set(DEFAULT_PRESET_ID, defaultPreset);
      this.savePresets();
    }
  }

  /**
   * Generate unique preset ID using cryptographically secure random values
   * SECURITY FIX: Uses crypto.getRandomValues() instead of Math.random()
   * @returns {string} Unique ID
   */
  generateId() {
    const timestamp = Date.now();
    // Generate 6 random bytes for better uniqueness
    const randomBytes = new Uint8Array(6);
    crypto.getRandomValues(randomBytes);
    // Convert to base36 string
    const randomStr = Array.from(randomBytes, b => b.toString(36)).join('').slice(0, 9);
    return `preset_${timestamp}_${randomStr}`;
  }

  /**
   * Create a new preset (saves to vault)
   * @param {string} name - Preset name
   * @param {Object} config - Password generation configuration
   * @param {string} description - Optional description
   * @returns {Promise<Preset|null>} Created preset or null if vault unavailable
   */
  async createPreset(name, config, description = '') {
    // Check vault is ready
    if (!await this.isVaultReady()) {
      safeLog('[PresetManager] Cannot create preset - vault not ready');
      return null;
    }

    const id = this.generateId();
    const preset = {
      id,
      name,
      description,
      config: { ...config },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false
    };

    // Save to vault first
    const saved = await this.savePresetToVault(preset);
    if (!saved) {
      safeLog(`[PresetManager] Failed to save preset to vault: ${name}`);
      return null;
    }

    // Add to local map (ID may have been updated by savePresetToVault)
    this.presets.set(preset.id, preset);
    safeLog(`[PresetManager] Created preset: ${name}`);
    this.notifyUIUpdate();

    return preset;
  }

  /**
   * Get a preset by ID
   * @param {string} id - Preset ID
   * @returns {Preset|null} Preset or null if not found
   */
  getPreset(id) {
    return this.presets.get(id) || null;
  }

  /**
   * Get all presets
   * @returns {Preset[]} Array of all presets
   */
  getAllPresets() {
    return Array.from(this.presets.values());
  }

  /**
   * Update an existing preset (saves to vault for non-default)
   * @param {string} id - Preset ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async updatePreset(id, updates) {
    const preset = this.presets.get(id);
    if (!preset) {
      safeLog(`[PresetManager] Preset not found: ${id}`);
      return false;
    }

    // Don't allow changing default preset ID
    if (preset.isDefault && updates.isDefault === false) {
      safeLog('[PresetManager] Cannot remove default flag from default preset');
      return false;
    }

    // Update fields
    if (updates.name !== undefined) preset.name = updates.name;
    if (updates.description !== undefined) preset.description = updates.description;
    if (updates.config !== undefined) preset.config = { ...updates.config };

    preset.updatedAt = new Date();

    // Save to vault for non-default presets
    if (!preset.isDefault) {
      if (!await this.isVaultReady()) {
        safeLog('[PresetManager] Cannot update preset - vault not ready');
        return false;
      }
      const saved = await this.savePresetToVault(preset);
      if (!saved) {
        safeLog(`[PresetManager] Failed to update preset in vault: ${preset.name}`);
        return false;
      }
    }

    safeLog(`[PresetManager] Updated preset: ${preset.name}`);
    this.notifyUIUpdate();
    return true;
  }

  /**
   * Duplicate a preset (saves to vault)
   * @param {string} id - Preset ID to duplicate
   * @returns {Promise<Preset|null>} The duplicated preset or null on error
   */
  async duplicatePreset(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      safeLog(`[PresetManager] Preset not found: ${id}`);
      return null;
    }

    // Check vault is ready
    if (!await this.isVaultReady()) {
      safeLog('[PresetManager] Cannot duplicate preset - vault not ready');
      return null;
    }

    // Create a copy with a new ID and name
    const newId = this.generateId();
    const duplicatedPreset = {
      id: newId,
      name: `Copie de ${preset.name}`,
      description: preset.description,
      config: { ...preset.config },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false
    };

    // Save to vault
    const saved = await this.savePresetToVault(duplicatedPreset);
    if (!saved) {
      safeLog(`[PresetManager] Failed to save duplicated preset to vault`);
      return null;
    }

    this.presets.set(duplicatedPreset.id, duplicatedPreset);
    safeLog(`[PresetManager] Duplicated preset: ${duplicatedPreset.name}`);
    this.notifyUIUpdate();

    return duplicatedPreset;
  }

  /**
   * Delete a preset (removes from vault)
   * @param {string} id - Preset ID
   * @returns {Promise<boolean>} Success status
   */
  async deletePreset(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      safeLog(`[PresetManager] Preset not found: ${id}`);
      return false;
    }

    // Don't allow deleting default preset
    if (preset.isDefault) {
      safeLog('[PresetManager] Cannot delete default preset');
      return false;
    }

    // Delete from vault if has vault entry
    if (preset.vaultEntryId && await this.isVaultReady()) {
      try {
        await window.vault.entries.delete(preset.vaultEntryId);
        safeLog(`[PresetManager] Deleted preset from vault: ${preset.name}`);
      } catch (error) {
        safeLog(`[PresetManager] Error deleting from vault: ${error.message}`);
        // Continue with local deletion anyway
      }
    }

    this.presets.delete(id);
    safeLog(`[PresetManager] Deleted preset: ${preset.name}`);
    this.notifyUIUpdate();

    return true;
  }

  /**
   * Export preset to JSON
   * @param {string} id - Preset ID
   * @returns {string|null} JSON string or null
   */
  exportPreset(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      return null;
    }

    try {
      return JSON.stringify(preset, null, 2);
    } catch (error) {
      safeLog(`[PresetManager] Error exporting preset: ${error.message}`);
      return null;
    }
  }

  /**
   * Import preset from JSON (saves to vault)
   * @param {string} json - JSON string
   * @returns {Promise<Preset|null>} Imported preset or null
   */
  async importPreset(json) {
    try {
      // Check vault is ready
      if (!await this.isVaultReady()) {
        safeLog('[PresetManager] Cannot import preset - vault not ready');
        return null;
      }

      const data = JSON.parse(json);

      // Validate required fields
      if (!data.name || !data.config) {
        safeLog('[PresetManager] Invalid preset data');
        return null;
      }

      // Generate new ID and timestamps
      const preset = {
        id: this.generateId(),
        name: data.name,
        description: data.description || '',
        config: { ...data.config },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false
      };

      // Save to vault first
      const saved = await this.savePresetToVault(preset);
      if (!saved) {
        safeLog(`[PresetManager] Failed to save imported preset to vault`);
        return null;
      }

      this.presets.set(preset.id, preset);
      safeLog(`[PresetManager] Imported preset: ${preset.name}`);
      this.notifyUIUpdate();

      return preset;
    } catch (error) {
      safeLog(`[PresetManager] Error importing preset: ${error.message}`);
      return null;
    }
  }

  /**
   * Export all presets to JSON
   * @returns {string} JSON string
   */
  exportAll() {
    const data = Array.from(this.presets.values());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import multiple presets from JSON (saves to vault)
   * @param {string} json - JSON string
   * @returns {Promise<number>} Number of imported presets
   */
  async importAll(json) {
    try {
      // Check vault is ready
      if (!await this.isVaultReady()) {
        safeLog('[PresetManager] Cannot import presets - vault not ready');
        return 0;
      }

      const data = JSON.parse(json);
      if (!Array.isArray(data)) {
        safeLog('[PresetManager] Import data must be an array');
        return 0;
      }

      let imported = 0;
      for (const item of data) {
        const preset = await this.importPreset(JSON.stringify(item));
        if (preset) {
          imported++;
        }
      }

      safeLog(`[PresetManager] Imported ${imported} presets`);
      return imported;
    } catch (error) {
      safeLog(`[PresetManager] Error importing presets: ${error.message}`);
      return 0;
    }
  }

  /**
   * Search presets by name
   * @param {string} query - Search query
   * @returns {Preset[]} Matching presets
   */
  searchPresets(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.presets.values()).filter(preset =>
      preset.name.toLowerCase().includes(lowerQuery) ||
      preset.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get default preset
   * @returns {Preset} Default preset
   */
  getDefaultPreset() {
    return this.presets.get(DEFAULT_PRESET_ID);
  }

  /**
   * Set a preset as default
   * @param {string} id - Preset ID
   * @returns {boolean} Success status
   */
  setAsDefault(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      return false;
    }

    // Remove default flag from all presets
    for (const p of this.presets.values()) {
      p.isDefault = false;
    }

    // Set new default
    preset.isDefault = true;
    this.savePresets();
    safeLog(`[PresetManager] Set default preset: ${preset.name}`);

    return true;
  }

  /**
   * Clear all presets (except default)
   */
  clearAll() {
    const defaultPreset = this.presets.get(DEFAULT_PRESET_ID);
    this.presets.clear();
    if (defaultPreset) {
      this.presets.set(DEFAULT_PRESET_ID, defaultPreset);
    }
    this.savePresets();
    safeLog('[PresetManager] Cleared all non-default presets');
  }

  // ==================== VAULT INTEGRATION ====================

  /**
   * Check if vault is available and unlocked
   * @returns {Promise<boolean>}
   */
  async isVaultReady() {
    if (!window.vault) return false;
    try {
      const state = await window.vault.getState();
      return state?.status === 'unlocked';
    } catch {
      return false;
    }
  }

  /**
   * Export a single preset to the vault
   * @param {string} id - Preset ID to export
   * @returns {Promise<{success: boolean, entryId?: string, error?: string}>}
   */
  async exportToVault(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      return { success: false, error: 'Preset non trouvé' };
    }

    if (!await this.isVaultReady()) {
      return { success: false, error: 'Coffre non disponible ou verrouillé' };
    }

    try {
      const entryData = {
        presetId: preset.id,
        description: preset.description,
        config: preset.config,
        exportedAt: new Date().toISOString()
      };

      const result = await window.vault.entries.add(
        'preset',
        preset.name,
        entryData,
        { favorite: false }
      );

      if (result?.id) {
        safeLog(`[PresetManager] Exported preset to vault: ${preset.name}`);
        return { success: true, entryId: result.id };
      }
      return { success: false, error: 'Erreur lors de l\'export' };
    } catch (error) {
      safeLog(`[PresetManager] Vault export error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export all presets to the vault
   * @returns {Promise<{success: number, failed: number}>}
   */
  async exportAllToVault() {
    if (!await this.isVaultReady()) {
      return { success: 0, failed: this.presets.size };
    }

    let success = 0;
    let failed = 0;

    for (const preset of this.presets.values()) {
      const result = await this.exportToVault(preset.id);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    safeLog(`[PresetManager] Exported ${success}/${success + failed} presets to vault`);
    return { success, failed };
  }

  /**
   * Get all presets stored in the vault
   * @returns {Promise<Array>}
   */
  async getVaultPresets() {
    if (!await this.isVaultReady()) {
      return [];
    }

    try {
      const entries = await window.vault.entries.getAll();
      return entries.filter(e => e.type === 'preset');
    } catch (error) {
      safeLog(`[PresetManager] Error fetching vault presets: ${error.message}`);
      return [];
    }
  }

  /**
   * Import presets from the vault
   * @param {boolean} overwrite - Whether to overwrite existing presets with same name
   * @returns {Promise<{imported: number, skipped: number}>}
   */
  async importFromVault(overwrite = false) {
    const vaultPresets = await this.getVaultPresets();
    if (vaultPresets.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;

    for (const entry of vaultPresets) {
      const data = entry.data;
      if (!data?.config) {
        skipped++;
        continue;
      }

      // Check for existing preset with same name
      const existingByName = Array.from(this.presets.values()).find(
        p => p.name.toLowerCase() === entry.title.toLowerCase()
      );

      if (existingByName && !overwrite) {
        skipped++;
        continue;
      }

      // If overwrite, delete existing
      if (existingByName && overwrite) {
        this.presets.delete(existingByName.id);
      }

      // Create new preset from vault data
      const preset = {
        id: this.generateId(),
        name: entry.title,
        description: data.description || '',
        config: { ...data.config },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false
      };

      this.presets.set(preset.id, preset);
      imported++;
    }

    if (imported > 0) {
      this.savePresets();
    }

    safeLog(`[PresetManager] Imported ${imported} presets from vault (${skipped} skipped)`);
    return { imported, skipped };
  }

  /**
   * Sync presets with vault (bidirectional)
   * @param {'toVault' | 'fromVault' | 'merge'} direction
   * @returns {Promise<{exported: number, imported: number}>}
   */
  async syncWithVault(direction = 'merge') {
    if (!await this.isVaultReady()) {
      return { exported: 0, imported: 0 };
    }

    let exported = 0;
    let imported = 0;

    if (direction === 'toVault' || direction === 'merge') {
      const result = await this.exportAllToVault();
      exported = result.success;
    }

    if (direction === 'fromVault' || direction === 'merge') {
      const result = await this.importFromVault(direction === 'merge');
      imported = result.imported;
    }

    safeLog(`[PresetManager] Sync complete: ${exported} exported, ${imported} imported`);
    return { exported, imported };
  }

  /**
   * Get count of presets in vault
   * @returns {Promise<number>}
   */
  async getVaultPresetCount() {
    const presets = await this.getVaultPresets();
    return presets.length;
  }
}

// Create singleton instance
const presetManager = new PresetManager();

export { presetManager, PresetManager };
export default presetManager;
