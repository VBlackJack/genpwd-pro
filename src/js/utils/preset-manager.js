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
  constructor() {
    this.presets = new Map();
    this.loadPresets();
    this.ensureDefaultPreset();
  }

  /**
   * Load presets from localStorage
   */
  loadPresets() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        safeLog('[PresetManager] No stored presets found');
        return;
      }

      const data = JSON.parse(stored);
      if (!Array.isArray(data)) {
        safeLog('[PresetManager] Invalid preset data format');
        return;
      }

      for (const preset of data) {
        // Convert date strings back to Date objects
        preset.createdAt = new Date(preset.createdAt);
        preset.updatedAt = new Date(preset.updatedAt);
        this.presets.set(preset.id, preset);
      }

      safeLog(`[PresetManager] Loaded ${this.presets.size} presets`);
    } catch (error) {
      safeLog(`[PresetManager] Error loading presets: ${error.message}`);
    }
  }

  /**
   * Save all presets to localStorage
   */
  savePresets() {
    try {
      const data = Array.from(this.presets.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      safeLog(`[PresetManager] Saved ${data.length} presets`);
    } catch (error) {
      safeLog(`[PresetManager] Error saving presets: ${error.message}`);
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
   * Create a new preset
   * @param {string} name - Preset name
   * @param {Object} config - Password generation configuration
   * @param {string} description - Optional description
   * @returns {Preset} Created preset
   */
  createPreset(name, config, description = '') {
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

    this.presets.set(id, preset);
    this.savePresets();
    safeLog(`[PresetManager] Created preset: ${name}`);

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
   * Update an existing preset
   * @param {string} id - Preset ID
   * @param {Object} updates - Fields to update
   * @returns {boolean} Success status
   */
  updatePreset(id, updates) {
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
    this.savePresets();
    safeLog(`[PresetManager] Updated preset: ${preset.name}`);

    return true;
  }

  /**
   * Duplicate a preset
   * @param {string} id - Preset ID to duplicate
   * @returns {Preset|null} The duplicated preset or null on error
   */
  duplicatePreset(id) {
    const preset = this.presets.get(id);
    if (!preset) {
      safeLog(`[PresetManager] Preset not found: ${id}`);
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

    this.presets.set(newId, duplicatedPreset);
    this.savePresets();
    safeLog(`[PresetManager] Duplicated preset: ${duplicatedPreset.name}`);

    return duplicatedPreset;
  }

  /**
   * Delete a preset
   * @param {string} id - Preset ID
   * @returns {boolean} Success status
   */
  deletePreset(id) {
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

    this.presets.delete(id);
    this.savePresets();
    safeLog(`[PresetManager] Deleted preset: ${preset.name}`);

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
   * Import preset from JSON
   * @param {string} json - JSON string
   * @returns {Preset|null} Imported preset or null
   */
  importPreset(json) {
    try {
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

      this.presets.set(preset.id, preset);
      this.savePresets();
      safeLog(`[PresetManager] Imported preset: ${preset.name}`);

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
   * Import multiple presets from JSON
   * @param {string} json - JSON string
   * @returns {number} Number of imported presets
   */
  importAll(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) {
        safeLog('[PresetManager] Import data must be an array');
        return 0;
      }

      let imported = 0;
      for (const item of data) {
        const preset = this.importPreset(JSON.stringify(item));
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
}

// Create singleton instance
const presetManager = new PresetManager();

export { presetManager, PresetManager };
export default presetManager;
