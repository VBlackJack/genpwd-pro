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

// src/tests/test-plugin-manager.js - Unit tests for Plugin Manager

import { PluginManager } from '../js/utils/plugin-manager.js';

/**
 * Test Suite for Plugin Manager
 */
export function runPluginManagerTests() {
  console.log('🧪 Running Plugin Manager Tests...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Helper function to run a test
  function test(name, fn) {
    results.total++;
    try {
      fn();
      results.passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      results.errors.push({ name, error: error.message });
      console.error(`❌ ${name}: ${error.message}`);
    }
  }

  // Helper to assert
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  // Create fresh instance for testing
  const manager = new PluginManager();

  // Clear any existing plugins
  manager.clearAllPlugins();

  // Test 1: Plugin Manager initialization
  test('PluginManager initializes correctly', () => {
    assert(manager !== null, 'Manager should be initialized');
    assert(manager.plugins instanceof Map, 'Manager should have plugins Map');
    assert(Array.isArray(manager.pluginOrder), 'Manager should have pluginOrder array');
  });

  // Test 2: Valid plugin registration
  test('Register valid plugin', () => {
    const validPlugin = {
      name: 'test-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'A test plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      },
      hooks: {
        onGenerate(config) {
          return 'TestPassword123';
        }
      }
    };

    const success = manager.registerPlugin(validPlugin);
    assert(success === true, 'Valid plugin should register successfully');
    assert(manager.plugins.size === 1, 'Manager should have 1 plugin');
    assert(manager.getPlugin('test-plugin') !== null, 'Plugin should be retrievable');
  });

  // Test 3: Invalid plugin registration (missing name)
  test('Reject plugin without name', () => {
    const invalidPlugin = {
      version: '1.0.0',
      author: 'Test Author',
      description: 'Invalid plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      }
    };

    const success = manager.registerPlugin(invalidPlugin);
    assert(success === false, 'Plugin without name should fail');
  });

  // Test 4: Invalid plugin registration (invalid version)
  test('Reject plugin with invalid version', () => {
    const invalidPlugin = {
      name: 'invalid-version-plugin',
      version: 'not-a-version',
      author: 'Test Author',
      description: 'Invalid version plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      }
    };

    const success = manager.registerPlugin(invalidPlugin);
    assert(success === false, 'Plugin with invalid version should fail');
  });

  // Test 5: Invalid plugin registration (missing lifecycle)
  test('Reject plugin without lifecycle', () => {
    const invalidPlugin = {
      name: 'no-lifecycle-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'No lifecycle plugin'
    };

    const success = manager.registerPlugin(invalidPlugin);
    assert(success === false, 'Plugin without lifecycle should fail');
  });

  // Test 6: Duplicate plugin registration
  test('Reject duplicate plugin', () => {
    const duplicatePlugin = {
      name: 'test-plugin', // Already registered
      version: '2.0.0',
      author: 'Test Author',
      description: 'Duplicate plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      }
    };

    const success = manager.registerPlugin(duplicatePlugin);
    assert(success === false, 'Duplicate plugin should fail');
  });

  // Test 7: Plugin unregistration
  test('Unregister plugin', () => {
    const success = manager.unregisterPlugin('test-plugin');
    assert(success === true, 'Plugin should unregister successfully');
    assert(manager.plugins.size === 0, 'Manager should have 0 plugins');
    assert(manager.getPlugin('test-plugin') === null, 'Plugin should not be retrievable');
  });

  // Test 8: Hook registration
  test('Hooks are registered correctly', () => {
    const hookPlugin = {
      name: 'hook-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Hook test plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      },
      hooks: {
        onGenerate(config) {
          return 'HookPassword';
        },
        onExport(passwords, options) {
          return JSON.stringify(passwords);
        }
      }
    };

    manager.registerPlugin(hookPlugin);
    assert(manager.hooks.onGenerate.length === 1, 'onGenerate hook should be registered');
    assert(manager.hooks.onExport.length === 1, 'onExport hook should be registered');

    manager.unregisterPlugin('hook-plugin');
  });

  // Test 9: Hook execution
  test('Hooks execute correctly', () => {
    const execPlugin = {
      name: 'exec-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Execution test plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      },
      hooks: {
        onGenerate(config) {
          return `Password-${config.length}`;
        }
      }
    };

    manager.registerPlugin(execPlugin);

    const results = manager.callHook('onGenerate', { length: 16 });
    assert(results.length === 1, 'Should have 1 result');
    assert(results[0].success === true, 'Hook should execute successfully');
    assert(results[0].result === 'Password-16', 'Hook should return correct result');

    manager.unregisterPlugin('exec-plugin');
  });

  // Test 10: Hook error isolation
  test('Plugin errors are isolated', () => {
    const errorPlugin = {
      name: 'error-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Error test plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      },
      hooks: {
        onGenerate(config) {
          throw new Error('Intentional error');
        }
      }
    };

    manager.registerPlugin(errorPlugin);

    const results = manager.callHook('onGenerate', { length: 16 });
    assert(results.length === 1, 'Should have 1 result');
    assert(results[0].success === false, 'Hook should fail');
    assert(results[0].error === 'Intentional error', 'Error message should be captured');

    manager.unregisterPlugin('error-plugin');
  });

  // Test 11: Enable/Disable plugin
  test('Enable and disable plugin', () => {
    const togglePlugin = {
      name: 'toggle-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Toggle test plugin',
      lifecycle: {
        onLoad() {},
        onUnload() {}
      },
      hooks: {
        onGenerate(config) {
          return 'TogglePassword';
        }
      }
    };

    manager.registerPlugin(togglePlugin);
    assert(manager.hooks.onGenerate.length === 1, 'Hook should be registered');

    manager.disablePlugin('toggle-plugin');
    assert(manager.hooks.onGenerate.length === 0, 'Hook should be unregistered');

    manager.enablePlugin('toggle-plugin');
    assert(manager.hooks.onGenerate.length === 1, 'Hook should be re-registered');

    manager.unregisterPlugin('toggle-plugin');
  });

  // Test 12: Get all plugins
  test('Get all plugins', () => {
    const plugin1 = {
      name: 'plugin1',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Plugin 1',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    const plugin2 = {
      name: 'plugin2',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Plugin 2',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    manager.registerPlugin(plugin1);
    manager.registerPlugin(plugin2);

    const all = manager.getAllPlugins();
    assert(all.length === 2, 'Should return all plugins');

    manager.unregisterPlugin('plugin1');
    manager.unregisterPlugin('plugin2');
  });

  // Test 13: Get enabled plugins
  test('Get enabled plugins only', () => {
    const plugin1 = {
      name: 'enabled-1',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Enabled plugin 1',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    const plugin2 = {
      name: 'enabled-2',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Enabled plugin 2',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    manager.registerPlugin(plugin1);
    manager.registerPlugin(plugin2);
    manager.disablePlugin('enabled-2');

    const enabled = manager.getEnabledPlugins();
    assert(enabled.length === 1, 'Should return only enabled plugins');
    assert(enabled[0].name === 'enabled-1', 'Should be the enabled plugin');

    manager.unregisterPlugin('enabled-1');
    manager.unregisterPlugin('enabled-2');
  });

  // Test 14: Plugin statistics
  test('Get plugin statistics', () => {
    const statsPlugin = {
      name: 'stats-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Stats test plugin',
      lifecycle: { onLoad() {}, onUnload() {} },
      hooks: {
        onGenerate() { return 'pwd'; },
        onExport() { return 'data'; }
      }
    };

    manager.registerPlugin(statsPlugin);

    const stats = manager.getStats();
    assert(stats.totalPlugins === 1, 'Total plugins should be 1');
    assert(stats.enabledPlugins === 1, 'Enabled plugins should be 1');
    assert(stats.totalHooks === 2, 'Total hooks should be 2');

    manager.unregisterPlugin('stats-plugin');
  });

  // Test 15: Security - Invalid hook names
  test('Reject unknown hooks', () => {
    const badHookPlugin = {
      name: 'bad-hook-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Bad hook plugin',
      lifecycle: { onLoad() {}, onUnload() {} },
      hooks: {
        onInvalidHook() {
          return 'bad';
        }
      }
    };

    const success = manager.registerPlugin(badHookPlugin);
    assert(success === false, 'Plugin with invalid hook should fail');
  });

  // Test 16: Security - Name validation
  test('Reject invalid plugin names', () => {
    const invalidNames = [
      'plugin with spaces',
      'plugin@special',
      'plugin/slash',
      'plugin\\backslash'
    ];

    invalidNames.forEach(name => {
      const plugin = {
        name: name,
        version: '1.0.0',
        author: 'Test Author',
        description: 'Invalid name plugin',
        lifecycle: { onLoad() {}, onUnload() {} }
      };

      const success = manager.registerPlugin(plugin);
      assert(success === false, `Plugin with name "${name}" should fail`);
    });
  });

  // Test 17: Security - Name length validation
  test('Reject plugin names that are too long', () => {
    const longName = 'a'.repeat(51); // 51 characters
    const plugin = {
      name: longName,
      version: '1.0.0',
      author: 'Test Author',
      description: 'Long name plugin',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    const success = manager.registerPlugin(plugin);
    assert(success === false, 'Plugin with long name should fail');
  });

  // Test 18: Security - Description length validation
  test('Reject plugin descriptions that are too long', () => {
    const longDesc = 'a'.repeat(201); // 201 characters
    const plugin = {
      name: 'long-desc-plugin',
      version: '1.0.0',
      author: 'Test Author',
      description: longDesc,
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    const success = manager.registerPlugin(plugin);
    assert(success === false, 'Plugin with long description should fail');
  });

  // Test 19: Code loading with security check
  test('Detect dangerous code patterns', () => {
    // SECURITY: Test string contains dangerous pattern to verify rejection
    // The 'ev' + 'al' concatenation prevents static analysis false positives
    const dangerousPattern = 'ev' + 'al';
    const dangerousCode = `
      ({
        name: 'dangerous-plugin',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Dangerous plugin',
        lifecycle: {
          onLoad() { ${dangerousPattern}('alert("bad")'); },
          onUnload() {}
        }
      })
    `;

    const success = manager.loadPluginFromCode(dangerousCode, 'test');
    assert(success === false, 'Dangerous code should be rejected');
  });

  // Test 20: Clear all plugins
  test('Clear all plugins', () => {
    const plugin1 = {
      name: 'clear-test-1',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Clear test 1',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    const plugin2 = {
      name: 'clear-test-2',
      version: '1.0.0',
      author: 'Test Author',
      description: 'Clear test 2',
      lifecycle: { onLoad() {}, onUnload() {} }
    };

    manager.registerPlugin(plugin1);
    manager.registerPlugin(plugin2);

    manager.clearAllPlugins();

    assert(manager.plugins.size === 0, 'All plugins should be cleared');
    assert(manager.pluginOrder.length === 0, 'Plugin order should be empty');
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(err => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
  }

  console.log('='.repeat(50) + '\n');

  return {
    success: results.failed === 0,
    results
  };
}

// Auto-run tests if in Node.js environment
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-plugin-manager.js')) {
  runPluginManagerTests();
}

export default runPluginManagerTests;
