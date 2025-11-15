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

// src/js/utils/history-manager.js - Password generation history

import { safeLog } from './logger.js';
import { safeSetItem, safeGetItem } from './storage-helper.js';
import { sanitizeHTML } from './dom-sanitizer.js';

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id - Unique entry ID
 * @property {string} password - Generated password (encrypted if enabled)
 * @property {Object} metadata - Generation metadata
 * @property {Date} timestamp - Generation timestamp
 * @property {boolean} isFavorite - Favorite flag
 * @property {string[]} tags - User-defined tags
 */

const STORAGE_KEY = 'genpwd_history';
const MAX_HISTORY_SIZE = 1000; // Maximum number of entries
const DEFAULT_SETTINGS = {
  enabled: false, // History disabled by default for privacy
  maxSize: MAX_HISTORY_SIZE,
  autoExpire: false,
  expireDays: 30,
  securityWarningShown: false // Track if security warning was shown
};

class HistoryManager {
  constructor() {
    this.history = [];
    this.settings = this.loadSettings();

    if (this.settings.enabled) {
      this.loadHistory();
      this.cleanupExpired();
    }
  }

  /**
   * Load settings from localStorage
   * @returns {Object} Settings object
   */
  loadSettings() {
    try {
      const stored = safeGetItem('genpwd_history_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      safeLog(`[HistoryManager] Error loading settings: ${error.message}`);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      safeSetItem('genpwd_history_settings', this.settings);
    } catch (error) {
      safeLog(`[HistoryManager] Error saving settings: ${error.message}`);
    }
  }

  /**
   * Update settings
   * @param {Object} updates - Settings to update
   */
  updateSettings(updates) {
    // Show security warning when enabling history for the first time
    if (updates.enabled === true && !this.settings.enabled && !this.settings.securityWarningShown) {
      this.showSecurityWarning();
      updates.securityWarningShown = true;
    }

    this.settings = { ...this.settings, ...updates };
    this.saveSettings();

    // If history was just disabled, clear it
    if (updates.enabled === false) {
      this.clearHistory();
    }

    // If history was just enabled, load it
    if (updates.enabled === true) {
      this.loadHistory();
    }
  }

  /**
   * Get current settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Show security warning about unencrypted localStorage
   * This is displayed when history is enabled for the first time
   */
  showSecurityWarning() {
    // Skip in non-browser environments (e.g., Node.js tests)
    if (typeof window === 'undefined' || !document.body) {
      safeLog('[HistoryManager] Security warning skipped (non-browser environment)');
      return;
    }

    // Create warning modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'security-warning-title');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = sanitizeHTML(`
      <div class="modal">
        <div class="modal-header">
          <h2 id="security-warning-title">⚠️ Avertissement de Sécurité</h2>
        </div>
        <div class="modal-body">
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #856404;">Stockage non chiffré</h3>
            <p><strong>Important :</strong> L'historique des mots de passe est stocké dans le <code>localStorage</code> de votre navigateur <strong>sans chiffrement</strong>.</p>
            <p>Cela signifie que :</p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Les mots de passe sont stockés en texte clair sur votre appareil</li>
              <li>Toute personne ayant accès à votre ordinateur peut les voir</li>
              <li>Des extensions malveillantes pourraient y accéder</li>
              <li>Les mots de passe ne sont pas synchronisés entre appareils</li>
            </ul>
          </div>

          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
            <h4 style="margin-top: 0; color: #0c5460;">Recommandations</h4>
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>N'activez cette fonctionnalité que sur un appareil personnel sécurisé</li>
              <li>Videz régulièrement l'historique</li>
              <li>Ne stockez pas les mots de passe de comptes critiques</li>
              <li>Utilisez un gestionnaire de mots de passe dédié pour un usage à long terme</li>
            </ul>
          </div>

          <p style="font-size: 0.9em; color: #666;">
            Note : Une future version pourrait inclure le chiffrement de l'historique avec une clé maître.
          </p>
        </div>
        <div class="modal-footer">
          <button id="security-warning-understood" class="btn btn-primary">J'ai compris</button>
          <button id="security-warning-cancel" class="btn">Annuler et désactiver</button>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    // Handle understood button
    const understoodBtn = modal.querySelector('#security-warning-understood');
    understoodBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      safeLog('[HistoryManager] Security warning acknowledged');
    });

    // Handle cancel button
    const cancelBtn = modal.querySelector('#security-warning-cancel');
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      this.settings.enabled = false;
      this.saveSettings();
      safeLog('[HistoryManager] History disabled after security warning');

      // Notify user
      if (typeof window.showToast === 'function') {
        window.showToast('Historique désactivé', 'info');
      }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        understoodBtn.click();
      }
    });

    // Focus first button for accessibility
    setTimeout(() => understoodBtn.focus(), 100);
  }

  /**
   * Load history from localStorage
   */
  loadHistory() {
    if (!this.settings.enabled) {
      return;
    }

    try {
      const stored = safeGetItem(STORAGE_KEY);
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);
      if (!Array.isArray(data)) {
        safeLog('[HistoryManager] Invalid history data format');
        return;
      }

      // Convert timestamp strings back to Date objects
      this.history = data.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));

      safeLog(`[HistoryManager] Loaded ${this.history.length} entries`);
    } catch (error) {
      safeLog(`[HistoryManager] Error loading history: ${error.message}`);
    }
  }

  /**
   * Save history to localStorage
   */
  saveHistory() {
    if (!this.settings.enabled) {
      return;
    }

    try {
      safeSetItem(STORAGE_KEY, this.history);
      safeLog(`[HistoryManager] Saved ${this.history.length} entries`);
    } catch (error) {
      safeLog(`[HistoryManager] Error saving history: ${error.message}`);

      // If quota exceeded, trim history
      if (error.name === 'QuotaExceededError') {
        this.trimHistory(Math.floor(this.history.length / 2));
        this.saveHistory();
      }
    }
  }

  /**
   * Generate unique entry ID using cryptographically secure random values
   * @returns {string} Unique ID
   */
  generateId() {
    const timestamp = Date.now();

    // Use crypto.getRandomValues() for cryptographically secure randomness
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);

    // Convert to base36 string
    const randomStr = Array.from(randomBytes)
      .map(b => b.toString(36))
      .join('')
      .substr(0, 12); // Take first 12 chars for consistent length

    return `entry_${timestamp}_${randomStr}`;
  }

  /**
   * Add entry to history
   * @param {string} password - Generated password
   * @param {Object} metadata - Generation metadata
   * @returns {HistoryEntry|false} Added entry or false if disabled
   */
  addEntry(password, metadata = {}) {
    if (!this.settings.enabled) {
      return false;
    }

    const entry = {
      id: this.generateId(),
      password,
      metadata: {
        mode: metadata.mode || 'unknown',
        entropy: metadata.entropy || 0,
        length: password.length,
        policy: metadata.policy || 'unknown',
        ...metadata
      },
      timestamp: new Date(),
      isFavorite: false,
      tags: []
    };

    this.history.unshift(entry); // Add to beginning

    // Trim if exceeds max size
    if (this.history.length > this.settings.maxSize) {
      this.trimHistory(this.settings.maxSize);
    }

    this.saveHistory();
    return entry;
  }

  /**
   * Get all history entries
   * @param {Object} options - Filter options
   * @returns {HistoryEntry[]} History entries
   */
  getHistory(options = {}) {
    let result = [...this.history];

    // Filter by favorites
    if (options.favoritesOnly) {
      result = result.filter(entry => entry.isFavorite);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      result = result.filter(entry =>
        options.tags.some(tag => entry.tags.includes(tag))
      );
    }

    // Filter by date range
    if (options.startDate) {
      result = result.filter(entry => entry.timestamp >= options.startDate);
    }
    if (options.endDate) {
      result = result.filter(entry => entry.timestamp <= options.endDate);
    }

    // Filter by mode
    if (options.mode) {
      result = result.filter(entry => entry.metadata.mode === options.mode);
    }

    // Sort
    if (options.sortBy === 'entropy') {
      result.sort((a, b) => b.metadata.entropy - a.metadata.entropy);
    } else if (options.sortBy === 'length') {
      result.sort((a, b) => b.metadata.length - a.metadata.length);
    } else {
      // Default: sort by timestamp (newest first)
      result.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Limit
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Search history
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {HistoryEntry[]} Matching entries
   */
  search(query, options = {}) {
    if (!query) {
      return this.getHistory(options);
    }

    const lowerQuery = query.toLowerCase();

    return this.history.filter(entry => {
      // Search in password (if not sensitive mode)
      if (!options.hideSensitive && entry.password.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in tags
      if (entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // Search in metadata
      if (entry.metadata.mode && entry.metadata.mode.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get entry by ID
   * @param {string} id - Entry ID
   * @returns {HistoryEntry|null} Entry or null
   */
  getEntry(id) {
    return this.history.find(entry => entry.id === id) || null;
  }

  /**
   * Delete entry
   * @param {string} id - Entry ID
   * @returns {boolean} Success status
   */
  deleteEntry(id) {
    const index = this.history.findIndex(entry => entry.id === id);
    if (index === -1) {
      return false;
    }

    this.history.splice(index, 1);
    this.saveHistory();
    return true;
  }

  /**
   * Toggle favorite status
   * @param {string} id - Entry ID
   * @returns {boolean} New favorite status or null
   */
  toggleFavorite(id) {
    const entry = this.getEntry(id);
    if (!entry) {
      return null;
    }

    entry.isFavorite = !entry.isFavorite;
    this.saveHistory();
    return entry.isFavorite;
  }

  /**
   * Add tag to entry
   * @param {string} id - Entry ID
   * @param {string} tag - Tag to add
   * @returns {boolean} Success status
   */
  addTag(id, tag) {
    const entry = this.getEntry(id);
    if (!entry) {
      return false;
    }

    if (!entry.tags.includes(tag)) {
      entry.tags.push(tag);
      this.saveHistory();
    }

    return true;
  }

  /**
   * Remove tag from entry
   * @param {string} id - Entry ID
   * @param {string} tag - Tag to remove
   * @returns {boolean} Success status
   */
  removeTag(id, tag) {
    const entry = this.getEntry(id);
    if (!entry) {
      return false;
    }

    const index = entry.tags.indexOf(tag);
    if (index !== -1) {
      entry.tags.splice(index, 1);
      this.saveHistory();
    }

    return true;
  }

  /**
   * Get all unique tags
   * @returns {string[]} Array of tags
   */
  getAllTags() {
    const tags = new Set();
    for (const entry of this.history) {
      for (const tag of entry.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    if (this.history.length === 0) {
      return {
        totalEntries: 0,
        favorites: 0,
        averageEntropy: 0,
        averageLength: 0,
        modeDistribution: {},
        oldestEntry: null,
        newestEntry: null
      };
    }

    const stats = {
      totalEntries: this.history.length,
      favorites: this.history.filter(e => e.isFavorite).length,
      averageEntropy: 0,
      averageLength: 0,
      modeDistribution: {},
      oldestEntry: this.history[this.history.length - 1].timestamp,
      newestEntry: this.history[0].timestamp
    };

    let totalEntropy = 0;
    let totalLength = 0;

    for (const entry of this.history) {
      totalEntropy += entry.metadata.entropy || 0;
      totalLength += entry.metadata.length || 0;

      const mode = entry.metadata.mode || 'unknown';
      stats.modeDistribution[mode] = (stats.modeDistribution[mode] || 0) + 1;
    }

    stats.averageEntropy = totalEntropy / this.history.length;
    stats.averageLength = totalLength / this.history.length;

    return stats;
  }

  /**
   * Trim history to specified size
   * @param {number} maxSize - Maximum size
   */
  trimHistory(maxSize) {
    if (this.history.length <= maxSize) {
      return;
    }

    // Keep favorites
    const favorites = this.history.filter(e => e.isFavorite);
    const nonFavorites = this.history.filter(e => !e.isFavorite);

    // Trim non-favorites
    const trimmedNonFavorites = nonFavorites.slice(0, maxSize - favorites.length);

    this.history = [...favorites, ...trimmedNonFavorites];
    this.history.sort((a, b) => b.timestamp - a.timestamp);

    safeLog(`[HistoryManager] Trimmed history to ${this.history.length} entries`);
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired() {
    if (!this.settings.autoExpire) {
      return;
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - this.settings.expireDays);

    const originalLength = this.history.length;
    this.history = this.history.filter(entry =>
      entry.isFavorite || entry.timestamp >= expiryDate
    );

    const removed = originalLength - this.history.length;
    if (removed > 0) {
      this.saveHistory();
      safeLog(`[HistoryManager] Removed ${removed} expired entries`);
    }
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      safeLog('[HistoryManager] Cleared all history');
    } catch (error) {
      safeLog(`[HistoryManager] Error clearing history: ${error.message}`);
    }
  }

  /**
   * Export history to JSON
   * @returns {string} JSON string
   */
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Import history from JSON
   * @param {string} json - JSON string
   * @returns {number} Number of imported entries
   */
  importHistory(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) {
        safeLog('[HistoryManager] Import data must be an array');
        return 0;
      }

      let imported = 0;
      for (const item of data) {
        if (item.password && item.timestamp) {
          this.history.push({
            ...item,
            timestamp: new Date(item.timestamp),
            id: item.id || this.generateId()
          });
          imported++;
        }
      }

      // Sort by timestamp
      this.history.sort((a, b) => b.timestamp - a.timestamp);

      // Trim if needed
      if (this.history.length > this.settings.maxSize) {
        this.trimHistory(this.settings.maxSize);
      }

      this.saveHistory();
      safeLog(`[HistoryManager] Imported ${imported} entries`);
      return imported;
    } catch (error) {
      safeLog(`[HistoryManager] Error importing history: ${error.message}`);
      return 0;
    }
  }
}

// Create singleton instance
const historyManager = new HistoryManager();

export { historyManager, HistoryManager };
export default historyManager;
