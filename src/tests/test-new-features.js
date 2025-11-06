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

// tests/test-new-features.js - Tests for new features (i18n, presets, history)

/**
 * Test suite for new features
 */
export class NewFeaturesTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('[NewFeaturesTests] Starting test suite...');

    await this.testI18n();
    await this.testPresetManager();
    await this.testHistoryManager();

    console.log(`[NewFeaturesTests] Complete: ${this.results.passed} passed, ${this.results.failed} failed`);
    return this.results;
  }

  /**
   * Test i18n module
   */
  async testI18n() {
    console.log('[NewFeaturesTests] Testing i18n module...');

    try {
      // Dynamically import i18n module
      const { i18n } = await import('../js/utils/i18n.js');

      // Test 1: Locale detection
      const currentLocale = i18n.getLocale();
      this.assert(
        ['fr', 'en', 'es'].includes(currentLocale),
        'i18n: Current locale should be supported',
        currentLocale
      );

      // Test 2: Load locale
      const loaded = await i18n.loadLocale('fr');
      this.assert(loaded === true, 'i18n: Should load French locale', loaded);

      // Test 3: Translation retrieval
      await i18n.setLocale('fr');
      const title = i18n.t('app.title');
      this.assert(title === 'GenPwd Pro', 'i18n: Should translate app.title', title);

      // Test 4: Missing translation
      const missing = i18n.t('nonexistent.key');
      this.assert(missing === 'nonexistent.key', 'i18n: Should return key if translation missing', missing);

      // Test 5: Parameter interpolation
      // (Future feature - for now just test that it doesn't crash)
      const withParams = i18n.t('app.title', { name: 'Test' });
      this.assert(typeof withParams === 'string', 'i18n: Should handle parameters', withParams);

      // Test 6: Get supported locales
      const locales = i18n.getSupportedLocales();
      this.assert(Array.isArray(locales) && locales.length >= 3, 'i18n: Should return supported locales', locales);

      // Test 7: Locale display name
      const displayName = i18n.getLocaleDisplayName('fr');
      this.assert(displayName === 'Français', 'i18n: Should return locale display name', displayName);

      // Test 8: Locale flag
      const flag = i18n.getLocaleFlag('fr');
      this.assert(flag === '🇫🇷', 'i18n: Should return locale flag', flag);

    } catch (error) {
      this.recordFailure('i18n tests', error);
    }
  }

  /**
   * Test PresetManager
   */
  async testPresetManager() {
    console.log('[NewFeaturesTests] Testing PresetManager...');

    try {
      const { presetManager } = await import('../js/utils/preset-manager.js');

      // Test 1: Default preset exists
      const defaultPreset = presetManager.getDefaultPreset();
      this.assert(defaultPreset !== null, 'PresetManager: Default preset should exist', defaultPreset);

      // Test 2: Create preset
      const newPreset = presetManager.createPreset('Test Preset', {
        mode: 'syllables',
        length: 16
      }, 'Test description');
      this.assert(newPreset.name === 'Test Preset', 'PresetManager: Should create preset', newPreset);

      // Test 3: Get preset
      const retrieved = presetManager.getPreset(newPreset.id);
      this.assert(retrieved.id === newPreset.id, 'PresetManager: Should retrieve preset', retrieved);

      // Test 4: Update preset
      const updated = presetManager.updatePreset(newPreset.id, {
        name: 'Updated Preset'
      });
      this.assert(updated === true, 'PresetManager: Should update preset', updated);

      // Test 5: Get all presets
      const allPresets = presetManager.getAllPresets();
      this.assert(Array.isArray(allPresets) && allPresets.length >= 2, 'PresetManager: Should return all presets', allPresets);

      // Test 6: Search presets
      const searchResults = presetManager.searchPresets('Updated');
      this.assert(searchResults.length > 0, 'PresetManager: Should search presets', searchResults);

      // Test 7: Export preset
      const exported = presetManager.exportPreset(newPreset.id);
      this.assert(typeof exported === 'string', 'PresetManager: Should export preset', exported);

      // Test 8: Delete preset
      const deleted = presetManager.deletePreset(newPreset.id);
      this.assert(deleted === true, 'PresetManager: Should delete preset', deleted);

      // Test 9: Cannot delete default preset
      const cannotDelete = presetManager.deletePreset('default');
      this.assert(cannotDelete === false, 'PresetManager: Should not delete default preset', cannotDelete);

    } catch (error) {
      this.recordFailure('PresetManager tests', error);
    }
  }

  /**
   * Test HistoryManager
   */
  async testHistoryManager() {
    console.log('[NewFeaturesTests] Testing HistoryManager...');

    try {
      const { historyManager } = await import('../js/utils/history-manager.js');

      // Enable history for testing
      historyManager.updateSettings({ enabled: true });

      // Test 1: Settings
      const settings = historyManager.getSettings();
      this.assert(settings.enabled === true, 'HistoryManager: Should enable history', settings);

      // Test 2: Add entry
      const entry = historyManager.addEntry('TestPassword123!', {
        mode: 'syllables',
        entropy: 95.5,
        policy: 'standard'
      });
      this.assert(entry !== null && entry.password === 'TestPassword123!', 'HistoryManager: Should add entry', entry);

      // Test 3: Get history
      const history = historyManager.getHistory();
      this.assert(Array.isArray(history) && history.length > 0, 'HistoryManager: Should get history', history);

      // Test 4: Get entry by ID
      const retrieved = historyManager.getEntry(entry.id);
      this.assert(retrieved.id === entry.id, 'HistoryManager: Should retrieve entry', retrieved);

      // Test 5: Toggle favorite
      const isFavorite = historyManager.toggleFavorite(entry.id);
      this.assert(isFavorite === true, 'HistoryManager: Should toggle favorite', isFavorite);

      // Test 6: Add tag
      const tagAdded = historyManager.addTag(entry.id, 'test-tag');
      this.assert(tagAdded === true, 'HistoryManager: Should add tag', tagAdded);

      // Test 7: Get all tags
      const tags = historyManager.getAllTags();
      this.assert(Array.isArray(tags) && tags.includes('test-tag'), 'HistoryManager: Should get all tags', tags);

      // Test 8: Search
      const searchResults = historyManager.search('test');
      this.assert(searchResults.length > 0, 'HistoryManager: Should search history', searchResults);

      // Test 9: Get statistics
      const stats = historyManager.getStatistics();
      this.assert(stats.totalEntries > 0, 'HistoryManager: Should get statistics', stats);

      // Test 10: Delete entry
      const deleted = historyManager.deleteEntry(entry.id);
      this.assert(deleted === true, 'HistoryManager: Should delete entry', deleted);

      // Test 11: Export history
      const exported = historyManager.exportHistory();
      this.assert(typeof exported === 'string', 'HistoryManager: Should export history', exported);

      // Cleanup: clear history and disable
      historyManager.clearHistory();
      historyManager.updateSettings({ enabled: false });

    } catch (error) {
      this.recordFailure('HistoryManager tests', error);
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message, value) {
    if (condition) {
      this.results.passed++;
      this.results.tests.push({
        name: message,
        passed: true,
        value: value
      });
      console.log(`✅ ${message}`);
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: message,
        passed: false,
        value: value
      });
      console.error(`❌ ${message}`, value);
    }
  }

  /**
   * Record failure
   */
  recordFailure(testName, error) {
    this.results.failed++;
    this.results.tests.push({
      name: testName,
      passed: false,
      error: error.message
    });
    console.error(`❌ ${testName}: ${error.message}`);
  }
}

// Export test runner
export async function runNewFeaturesTests() {
  const suite = new NewFeaturesTestSuite();
  return await suite.runAll();
}
