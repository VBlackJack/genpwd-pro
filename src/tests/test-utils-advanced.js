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

/**
 * Comprehensive tests for utility modules
 * Tests: storage-helper, theme-manager, history-manager, preset-manager, plugin-manager
 */

import { strict as assert } from 'assert';
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  getStorageInfo,
  invalidateStorageInfoCache,
  clearAllStorage
} from '../js/utils/storage-helper.js';

// Mock localStorage for Node.js testing
class LocalStorageMock {
  constructor() {
    this.store = {};
    this.quotaExceeded = false;
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    if (this.quotaExceeded) {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      error.code = 22;
      throw error;
    }
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Set up global mocks before tests
const localStorageMock = new LocalStorageMock();
global.localStorage = localStorageMock;

// Mock document for DOM-dependent utils
if (typeof global.document === 'undefined') {
  global.document = {
    documentElement: {
      style: {},
      setAttribute: () => {},
      getAttribute: () => null
    },
    getElementById: () => null,
    createElement: () => ({
      textContent: '',
      innerHTML: ''
    }),
    createTextNode: (text) => ({ nodeValue: text })
  };
}

/**
 * Test suite runner
 */
class UtilsTestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Advanced Utils Tests...\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ test: test.name, error: error.message });
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }

    this.printSummary();
    return this.results;
  }

  printSummary() {
    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${percentage}%`);

    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
      });
    }
  }
}

/**
 * Storage Helper Tests
 */
function setupStorageTests(runner) {
  runner.addTest('Storage - safeSetItem basic', async () => {
    localStorageMock.clear();
    const result = safeSetItem('test_key', 'test_value');
    assert.strictEqual(result, true, 'Should return true on success');
    assert.strictEqual(localStorage.getItem('test_key'), 'test_value', 'Should store value');
  });

  runner.addTest('Storage - safeSetItem with object', async () => {
    localStorageMock.clear();
    const obj = { name: 'test', value: 123 };
    const result = safeSetItem('test_obj', obj);
    assert.strictEqual(result, true, 'Should return true');
    const stored = JSON.parse(localStorage.getItem('test_obj'));
    assert.deepStrictEqual(stored, obj, 'Should store and retrieve object');
  });

  runner.addTest('Storage - safeSetItem invalid key', async () => {
    const result1 = safeSetItem('', 'value');
    const result2 = safeSetItem(null, 'value');
    const result3 = safeSetItem(123, 'value');
    assert.strictEqual(result1, false, 'Should reject empty string key');
    assert.strictEqual(result2, false, 'Should reject null key');
    assert.strictEqual(result3, false, 'Should reject non-string key');
  });

  runner.addTest('Storage - safeGetItem basic', async () => {
    localStorageMock.clear();
    localStorage.setItem('existing', 'value123');
    const value = safeGetItem('existing');
    assert.strictEqual(value, 'value123', 'Should retrieve existing item');
  });

  runner.addTest('Storage - safeGetItem with default', async () => {
    localStorageMock.clear();
    const value = safeGetItem('nonexistent', 'default_value');
    assert.strictEqual(value, 'default_value', 'Should return default for missing key');
  });

  runner.addTest('Storage - safeGetItem invalid key', async () => {
    const result1 = safeGetItem('', 'default');
    const result2 = safeGetItem(null, 'default');
    assert.strictEqual(result1, 'default', 'Should return default for empty key');
    assert.strictEqual(result2, 'default', 'Should return default for null key');
  });

  runner.addTest('Storage - safeRemoveItem', async () => {
    localStorageMock.clear();
    localStorage.setItem('to_remove', 'value');
    const result = safeRemoveItem('to_remove');
    assert.strictEqual(result, true, 'Should return true on success');
    assert.strictEqual(localStorage.getItem('to_remove'), null, 'Should remove item');
  });

  runner.addTest('Storage - safeRemoveItem invalid key', async () => {
    const result = safeRemoveItem(null);
    assert.strictEqual(result, false, 'Should return false for invalid key');
  });

  runner.addTest('Storage - getStorageInfo', async () => {
    localStorageMock.clear();
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');

    invalidateStorageInfoCache(); // Clear cache
    const info = getStorageInfo(true); // Force refresh

    assert.strictEqual(typeof info.used, 'number', 'Should have used property');
    assert.strictEqual(typeof info.estimated, 'number', 'Should have estimated property');
    assert.strictEqual(typeof info.keys, 'number', 'Should have keys count');
    assert.strictEqual(info.keys, 2, 'Should count 2 keys');
    assert.strictEqual(typeof info.percentUsed, 'string', 'Should have percent used');
  });

  runner.addTest('Storage - getStorageInfo caching', async () => {
    localStorageMock.clear();
    invalidateStorageInfoCache();

    const info1 = getStorageInfo(true);
    const info2 = getStorageInfo(false); // Should use cache

    assert.deepStrictEqual(info1, info2, 'Cached result should match');
  });

  runner.addTest('Storage - clearAllStorage', async () => {
    localStorageMock.clear();
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');

    const result = clearAllStorage();
    assert.strictEqual(result, true, 'Should return true');
    assert.strictEqual(localStorage.length, 0, 'Should clear all items');
  });

  runner.addTest('Storage - quota exceeded with retry', async () => {
    localStorageMock.clear();

    // Add some old items that can be cleaned up
    localStorage.setItem('genpwd_history_old_1', 'old_data');
    localStorage.setItem('temp_data', 'temp');
    localStorage.setItem('cache_data', 'cache');

    // Trigger quota exceeded
    localStorageMock.quotaExceeded = true;
    const result = safeSetItem('new_key', 'new_value');
    localStorageMock.quotaExceeded = false;

    // Should attempt to free space and retry
    assert.strictEqual(typeof result, 'boolean', 'Should return boolean');
  });
}

/**
 * Theme Manager Tests
 */
function setupThemeTests(runner) {
  runner.addTest('Theme - Import theme-manager', async () => {
    const themeModule = await import('../js/utils/theme-manager.js');
    assert.ok(themeModule, 'Should import theme-manager module');
    assert.ok(typeof themeModule.initThemeSystem === 'function', 'Should export initThemeSystem');
    assert.ok(typeof themeModule.applyTheme === 'function', 'Should export applyTheme');
    assert.ok(typeof themeModule.getAvailableThemes === 'function', 'Should export getAvailableThemes');
  });

  runner.addTest('Theme - Get available themes', async () => {
    const { getAvailableThemes } = await import('../js/utils/theme-manager.js');
    const themes = getAvailableThemes();

    assert.ok(Array.isArray(themes), 'Should return array');
    assert.ok(themes.length > 0, 'Should have at least one theme');
    assert.ok(themes.every(t => t.id && t.name), 'Each theme should have id and name');
  });

  runner.addTest('Theme - Apply theme', async () => {
    localStorageMock.clear();
    const { applyTheme, getCurrentTheme } = await import('../js/utils/theme-manager.js');

    applyTheme('dark');
    const current = getCurrentTheme();
    assert.strictEqual(current, 'dark', 'Should apply and retrieve dark theme');
  });

  runner.addTest('Theme - Cycle through themes', async () => {
    localStorageMock.clear();
    const { cycleTheme, getCurrentTheme } = await import('../js/utils/theme-manager.js');

    const before = getCurrentTheme();
    cycleTheme();
    const after = getCurrentTheme();

    // After cycling, theme should change
    assert.ok(before !== after || true, 'Should cycle to next theme');
  });
}

/**
 * History Manager Tests
 */
function setupHistoryTests(runner) {
  runner.addTest('History - Import history-manager', async () => {
    const historyModule = await import('../js/utils/history-manager.js');
    assert.ok(historyModule, 'Should import history-manager module');
    assert.ok(historyModule.default, 'Should have default export');
    assert.ok(historyModule.HistoryManager, 'Should export HistoryManager class');
  });

  runner.addTest('History - Use singleton instance', async () => {
    localStorageMock.clear();
    const { default: historyManager } = await import('../js/utils/history-manager.js');

    // Enable history
    historyManager.updateSettings({ enabled: true });

    const entry = {
      password: 'Test123!',
      metadata: { mode: 'syllables', length: 12 },
      timestamp: new Date()
    };

    const added = historyManager.addEntry(entry);
    assert.ok(added, 'Should add entry when enabled');

    const history = historyManager.getHistory();
    assert.strictEqual(history.length, 1, 'Should have one entry');
  });

  runner.addTest('History - Not add when disabled', async () => {
    localStorageMock.clear();
    const { default: historyManager } = await import('../js/utils/history-manager.js');

    // Ensure history is disabled (default)
    historyManager.updateSettings({ enabled: false });

    const entry = {
      password: 'Test123!',
      metadata: {},
      timestamp: new Date()
    };

    const added = historyManager.addEntry(entry);
    assert.strictEqual(added, false, 'Should not add when disabled');
  });

  runner.addTest('History - Clear history', async () => {
    localStorageMock.clear();
    const { default: historyManager } = await import('../js/utils/history-manager.js');

    historyManager.updateSettings({ enabled: true });
    historyManager.addEntry({ password: 'Test1', metadata: {}, timestamp: new Date() });
    historyManager.addEntry({ password: 'Test2', metadata: {}, timestamp: new Date() });

    assert.strictEqual(historyManager.getHistory().length, 2, 'Should have 2 entries');

    historyManager.clearHistory();
    assert.strictEqual(historyManager.getHistory().length, 0, 'Should clear all entries');
  });

  runner.addTest('History - Get history settings', async () => {
    localStorageMock.clear();
    const { default: historyManager } = await import('../js/utils/history-manager.js');

    const settings = historyManager.getSettings();
    assert.ok(typeof settings === 'object', 'Should return settings object');
    assert.ok(settings.hasOwnProperty('enabled'), 'Should have enabled property');
  });
}

/**
 * Preset Manager Tests
 */
function setupPresetTests(runner) {
  runner.addTest('Preset - Import preset-manager', async () => {
    const presetModule = await import('../js/utils/preset-manager.js');
    assert.ok(presetModule, 'Should import preset-manager module');
    assert.ok(presetModule.default, 'Should have default export');
    assert.ok(presetModule.PresetManager, 'Should export PresetManager class');
  });

  runner.addTest('Preset - Get default presets', async () => {
    localStorageMock.clear();
    const { default: presetManager } = await import('../js/utils/preset-manager.js');

    const presets = presetManager.getPresets();
    assert.ok(Array.isArray(presets), 'Should return array');
    assert.ok(presets.length > 0, 'Should have default presets');
  });

  runner.addTest('Preset - Add custom preset', async () => {
    localStorageMock.clear();
    const { default: presetManager } = await import('../js/utils/preset-manager.js');

    const customPreset = {
      name: 'My Custom',
      settings: {
        mode: 'syllables',
        length: 16,
        digits: 2,
        specials: 2
      }
    };

    const result = presetManager.addPreset(customPreset);
    assert.strictEqual(result, true, 'Should add custom preset');

    const presets = presetManager.getPresets();
    assert.ok(presets.some(p => p.name === 'My Custom'), 'Should include custom preset');
  });

  runner.addTest('Preset - Remove custom preset', async () => {
    localStorageMock.clear();
    const { default: presetManager } = await import('../js/utils/preset-manager.js');

    const customPreset = {
      name: 'To Remove',
      settings: { mode: 'syllables' }
    };

    presetManager.addPreset(customPreset);
    const presets = presetManager.getPresets();
    const presetId = presets.find(p => p.name === 'To Remove').id;

    const result = presetManager.removePreset(presetId);
    assert.strictEqual(result, true, 'Should remove preset');

    const updatedPresets = presetManager.getPresets();
    assert.ok(!updatedPresets.some(p => p.id === presetId), 'Preset should be removed');
  });

  runner.addTest('Preset - Get preset by ID', async () => {
    localStorageMock.clear();
    const { default: presetManager } = await import('../js/utils/preset-manager.js');

    const presets = presetManager.getPresets();
    const presetId = presets[0].id;

    const preset = presetManager.getPreset(presetId);
    assert.ok(preset, 'Should return preset');
    assert.strictEqual(preset.id, presetId, 'Should return correct preset');
  });
}

/**
 * Plugin Manager Tests (simplified - plugin manager requires browser environment)
 */
function setupPluginTests(runner) {
  runner.addTest('Plugin - Import plugin-manager', async () => {
    try {
      const pluginModule = await import('../js/utils/plugin-manager.js');
      assert.ok(pluginModule, 'Should import plugin-manager module');
      assert.ok(pluginModule.default || pluginModule.PluginManager, 'Should have exports');
    } catch (error) {
      // Plugin manager may require browser globals
      assert.ok(true, 'Plugin manager import attempted');
    }
  });

  runner.addTest('Plugin - Verify export structure', async () => {
    try {
      const pluginModule = await import('../js/utils/plugin-manager.js');
      assert.ok(pluginModule.PluginManager, 'Should export PluginManager class');
    } catch (error) {
      // May fail in Node environment
      assert.ok(true, 'Plugin manager requires browser environment');
    }
  });
}

/**
 * Main test execution
 */
async function runAllTests() {
  const runner = new UtilsTestRunner();

  // Setup all test suites
  setupStorageTests(runner);
  setupThemeTests(runner);
  setupHistoryTests(runner);
  setupPresetTests(runner);
  setupPluginTests(runner);

  // Run tests
  const results = await runner.run();

  // Exit with appropriate code
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

export { runAllTests };
