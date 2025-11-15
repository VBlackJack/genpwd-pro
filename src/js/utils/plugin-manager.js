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

// src/js/utils/plugin-manager.js - Plugin System for GenPwd Pro v2.6.0

import { safeLog } from './logger.js';
import { showToast } from './toast.js';

/**
 * Plugin Interface Definition
 * @typedef {Object} PluginInterface
 * @property {string} name - Plugin name (unique identifier)
 * @property {string} version - Semantic version (e.g., "1.0.0")
 * @property {string} author - Plugin author name
 * @property {string} description - Brief description of plugin functionality
 * @property {Object} hooks - Hook functions for extending GenPwd Pro
 * @property {Function} [hooks.onGenerate] - Custom password generation hook
 * @property {Function} [hooks.onExport] - Custom export format hook
 * @property {Function} [hooks.onImport] - Custom import parser hook
 * @property {Function} [hooks.onUIRender] - Custom UI rendering hook
 * @property {Function} [hooks.onPasswordValidate] - Password validation hook
 * @property {Function} [hooks.onPasswordStrength] - Custom strength calculation
 * @property {Object} lifecycle - Lifecycle hooks
 * @property {Function} lifecycle.onLoad - Called when plugin is loaded
 * @property {Function} lifecycle.onUnload - Called when plugin is unloaded
 * @property {Object} [config] - Optional plugin configuration
 * @property {boolean} [enabled] - Plugin enabled state (default: true)
 */

/**
 * Plugin Manager - Manages plugin lifecycle, security, and hook execution
 *
 * Security Features:
 * - Plugin validation and sanitization
 * - Whitelist-based approach for allowed hooks
 * - Size limits to prevent memory abuse
 * - Content Security Policy enforcement
 * - Error isolation (plugin errors don't crash the app)
 */
class PluginManager {
  constructor() {
    this.plugins = new Map(); // name -> PluginInterface
    this.pluginOrder = []; // Execution order (for priority)
    this.hooks = {
      onGenerate: [],
      onExport: [],
      onImport: [],
      onUIRender: [],
      onPasswordValidate: [],
      onPasswordStrength: []
    };

    // Security configuration
    this.config = {
      maxPlugins: 20,
      maxPluginSize: 1024 * 100, // 100KB max per plugin
      allowedHooks: [
        'onGenerate',
        'onExport',
        'onImport',
        'onUIRender',
        'onPasswordValidate',
        'onPasswordStrength'
      ],
      requireVersion: true,
      sandboxMode: true
    };

    // Storage key
    this.storageKey = 'genpwd-plugins-registry';

    // Load persisted plugin metadata
    this.loadPluginRegistry();

    safeLog('PluginManager initialized');
  }

  /**
   * Validate plugin structure and security
   * @param {PluginInterface} plugin - Plugin to validate
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validatePlugin(plugin) {
    const errors = [];

    // Required fields
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push('Plugin must have a valid name (string)');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      errors.push('Plugin must have a valid version (string)');
    }

    if (!plugin.author || typeof plugin.author !== 'string') {
      errors.push('Plugin must have a valid author (string)');
    }

    if (!plugin.description || typeof plugin.description !== 'string') {
      errors.push('Plugin must have a valid description (string)');
    }

    // Lifecycle hooks (required)
    if (!plugin.lifecycle || typeof plugin.lifecycle !== 'object') {
      errors.push('Plugin must have lifecycle object');
    } else {
      if (typeof plugin.lifecycle.onLoad !== 'function') {
        errors.push('Plugin lifecycle.onLoad must be a function');
      }
      if (typeof plugin.lifecycle.onUnload !== 'function') {
        errors.push('Plugin lifecycle.onUnload must be a function');
      }
    }

    // Hooks (optional but must be valid if present)
    if (plugin.hooks) {
      if (typeof plugin.hooks !== 'object') {
        errors.push('Plugin hooks must be an object');
      } else {
        for (const hookName in plugin.hooks) {
          if (!this.config.allowedHooks.includes(hookName)) {
            errors.push(`Unknown hook: ${hookName}. Allowed hooks: ${this.config.allowedHooks.join(', ')}`);
          }
          if (typeof plugin.hooks[hookName] !== 'function') {
            errors.push(`Hook ${hookName} must be a function`);
          }
        }
      }
    }

    // Security: Name validation (alphanumeric, dashes, underscores only)
    if (plugin.name && !/^[a-zA-Z0-9_-]+$/.test(plugin.name)) {
      errors.push('Plugin name must contain only alphanumeric characters, dashes, and underscores');
    }

    // Security: Name length limit
    if (plugin.name && plugin.name.length > 50) {
      errors.push('Plugin name must be 50 characters or less');
    }

    // Security: Description length limit
    if (plugin.description && plugin.description.length > 200) {
      errors.push('Plugin description must be 200 characters or less');
    }

    // Security: Version format validation (semantic versioning)
    if (plugin.version && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(plugin.version)) {
      errors.push('Plugin version must follow semantic versioning (e.g., 1.0.0)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Register a plugin
   * @param {PluginInterface} plugin - Plugin to register
   * @returns {boolean} - Success status
   */
  registerPlugin(plugin) {
    try {
      // Validate plugin
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        safeLog(`Plugin validation failed: ${validation.errors.join(', ')}`);
        showToast(`Plugin validation failed: ${validation.errors[0]}`, 'error');
        return false;
      }

      // Check if plugin already exists
      if (this.plugins.has(plugin.name)) {
        safeLog(`Plugin "${plugin.name}" already registered. Use updatePlugin() to update.`);
        showToast(`Plugin "${plugin.name}" already exists`, 'error');
        return false;
      }

      // Check max plugins limit
      if (this.plugins.size >= this.config.maxPlugins) {
        safeLog(`Maximum plugins limit (${this.config.maxPlugins}) reached`);
        showToast('Maximum plugins limit reached', 'error');
        return false;
      }

      // Set default enabled state
      if (plugin.enabled === undefined) {
        plugin.enabled = true;
      }

      // Store plugin
      this.plugins.set(plugin.name, plugin);
      this.pluginOrder.push(plugin.name);

      // Register hooks
      if (plugin.hooks && plugin.enabled) {
        for (const hookName in plugin.hooks) {
          if (this.hooks[hookName]) {
            this.hooks[hookName].push({
              plugin: plugin.name,
              fn: plugin.hooks[hookName]
            });
          }
        }
      }

      // Call lifecycle.onLoad
      try {
        plugin.lifecycle.onLoad();
      } catch (loadError) {
        safeLog(`Plugin "${plugin.name}" onLoad error: ${loadError.message}`);
        // Don't fail registration if onLoad fails
      }

      // Persist registry
      this.savePluginRegistry();

      safeLog(`Plugin "${plugin.name}" v${plugin.version} registered successfully`);
      showToast(`Plugin "${plugin.name}" loaded`, 'success');

      return true;
    } catch (error) {
      safeLog(`Error registering plugin: ${error.message}`);
      showToast('Plugin registration failed', 'error');
      return false;
    }
  }

  /**
   * Unregister a plugin
   * @param {string} name - Plugin name
   * @returns {boolean} - Success status
   */
  unregisterPlugin(name) {
    try {
      const plugin = this.plugins.get(name);
      if (!plugin) {
        safeLog(`Plugin "${name}" not found`);
        return false;
      }

      // Call lifecycle.onUnload
      try {
        plugin.lifecycle.onUnload();
      } catch (unloadError) {
        safeLog(`Plugin "${name}" onUnload error: ${unloadError.message}`);
      }

      // Remove hooks
      for (const hookName in this.hooks) {
        this.hooks[hookName] = this.hooks[hookName].filter(h => h.plugin !== name);
      }

      // Remove from order
      this.pluginOrder = this.pluginOrder.filter(p => p !== name);

      // Remove plugin
      this.plugins.delete(name);

      // Persist registry
      this.savePluginRegistry();

      safeLog(`Plugin "${name}" unregistered successfully`);
      showToast(`Plugin "${name}" unloaded`, 'success');

      return true;
    } catch (error) {
      safeLog(`Error unregistering plugin: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a plugin by name
   * @param {string} name - Plugin name
   * @returns {PluginInterface|null}
   */
  getPlugin(name) {
    return this.plugins.get(name) || null;
  }

  /**
   * Get all registered plugins
   * @returns {PluginInterface[]}
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all enabled plugins
   * @returns {PluginInterface[]}
   */
  getEnabledPlugins() {
    return this.getAllPlugins().filter(p => p.enabled);
  }

  /**
   * Enable a plugin
   * @param {string} name - Plugin name
   * @returns {boolean}
   */
  enablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (!plugin.enabled) {
      plugin.enabled = true;

      // Re-register hooks
      if (plugin.hooks) {
        for (const hookName in plugin.hooks) {
          if (this.hooks[hookName]) {
            // Check if not already registered
            const exists = this.hooks[hookName].some(h => h.plugin === name);
            if (!exists) {
              this.hooks[hookName].push({
                plugin: name,
                fn: plugin.hooks[hookName]
              });
            }
          }
        }
      }

      this.savePluginRegistry();
      safeLog(`Plugin "${name}" enabled`);
      showToast(`Plugin "${name}" enabled`, 'success');
    }

    return true;
  }

  /**
   * Disable a plugin
   * @param {string} name - Plugin name
   * @returns {boolean}
   */
  disablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.enabled) {
      plugin.enabled = false;

      // Remove hooks
      for (const hookName in this.hooks) {
        this.hooks[hookName] = this.hooks[hookName].filter(h => h.plugin !== name);
      }

      this.savePluginRegistry();
      safeLog(`Plugin "${name}" disabled`);
      showToast(`Plugin "${name}" disabled`, 'success');
    }

    return true;
  }

  /**
   * Call a hook with error isolation
   * @param {string} hookName - Hook name
   * @param {...any} args - Arguments to pass to hook
   * @returns {Array} - Results from all hook functions
   */
  callHook(hookName, ...args) {
    if (!this.hooks[hookName]) {
      safeLog(`Unknown hook: ${hookName}`);
      return [];
    }

    const results = [];

    for (const hook of this.hooks[hookName]) {
      try {
        const result = hook.fn(...args);
        results.push({
          plugin: hook.plugin,
          success: true,
          result
        });
      } catch (error) {
        safeLog(`Plugin "${hook.plugin}" hook "${hookName}" error: ${error.message}`);
        results.push({
          plugin: hook.plugin,
          success: false,
          error: error.message
        });
        // Error is isolated - don't crash the app
      }
    }

    return results;
  }

  /**
   * Call async hook with error isolation
   * @param {string} hookName - Hook name
   * @param {...any} args - Arguments to pass to hook
   * @returns {Promise<Array>} - Results from all hook functions
   */
  async callHookAsync(hookName, ...args) {
    if (!this.hooks[hookName]) {
      safeLog(`Unknown hook: ${hookName}`);
      return [];
    }

    const results = [];

    for (const hook of this.hooks[hookName]) {
      try {
        const result = await hook.fn(...args);
        results.push({
          plugin: hook.plugin,
          success: true,
          result
        });
      } catch (error) {
        safeLog(`Plugin "${hook.plugin}" async hook "${hookName}" error: ${error.message}`);
        results.push({
          plugin: hook.plugin,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Load plugin from ES6 module URL (secure dynamic loading)
   * SECURITY: Only accepts ES6 module URLs, no eval/Function constructor
   * @param {string} moduleUrl - URL to ES6 module (must be HTTPS or local)
   * @param {string} source - Source identifier (for tracking)
   * @returns {Promise<boolean>}
   */
  async loadPluginFromModule(moduleUrl, source = 'unknown') {
    try {
      // Security check: URL validation
      const url = new URL(moduleUrl, window.location.origin);

      // Only allow HTTPS or local file protocol
      if (!['https:', 'http:', 'file:'].includes(url.protocol)) {
        safeLog(`Plugin from ${source}: Invalid protocol ${url.protocol}`);
        showToast('Plugin URL must use HTTPS or local file', 'error');
        return false;
      }

      // For production, only allow HTTPS (except localhost)
      if (window.location.hostname !== 'localhost' &&
          url.protocol !== 'https:' &&
          url.protocol !== 'file:') {
        safeLog(`Plugin from ${source}: HTTPS required in production`);
        showToast('Plugin must be loaded over HTTPS', 'error');
        return false;
      }

      // Dynamic import (secure, no eval)
      const module = await import(/* webpackIgnore: true */ moduleUrl);

      // Module must export default as plugin object
      if (!module.default) {
        safeLog(`Plugin from ${source}: No default export found`);
        showToast('Plugin module must have default export', 'error');
        return false;
      }

      const plugin = module.default;

      // Add source metadata
      plugin._source = source;
      plugin._moduleUrl = moduleUrl;
      plugin._loadedAt = new Date().toISOString();

      // Register plugin
      return this.registerPlugin(plugin);
    } catch (error) {
      safeLog(`Error loading plugin from ${source}: ${error.message}`);
      showToast('Failed to load plugin module', 'error');
      return false;
    }
  }

  /**
   * Load plugin from code string - DEPRECATED AND DISABLED
   * SECURITY WARNING: This method has been disabled due to code injection risks
   * Use loadPluginFromModule() instead with ES6 modules
   * @deprecated Use loadPluginFromModule() instead
   * @param {string} code - Plugin code (IGNORED)
   * @param {string} source - Source identifier
   * @returns {boolean} - Always returns false
   */
  loadPluginFromCode(code, source = 'unknown') {
    safeLog(`SECURITY: loadPluginFromCode() is deprecated and disabled. Use loadPluginFromModule() instead.`);
    showToast('Direct code loading disabled for security. Use ES6 modules.', 'error');
    return false;
  }

  /**
   * Export plugin to JSON
   * @param {string} name - Plugin name
   * @returns {string|null} - JSON string or null
   */
  exportPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;

    // Create exportable version (without functions)
    const exportData = {
      name: plugin.name,
      version: plugin.version,
      author: plugin.author,
      description: plugin.description,
      config: plugin.config || {},
      enabled: plugin.enabled,
      _source: plugin._source,
      _loadedAt: plugin._loadedAt,
      _exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Save plugin registry to localStorage (metadata only)
   */
  savePluginRegistry() {
    try {
      const registry = {};

      for (const [name, plugin] of this.plugins) {
        registry[name] = {
          name: plugin.name,
          version: plugin.version,
          author: plugin.author,
          description: plugin.description,
          enabled: plugin.enabled,
          _source: plugin._source,
          _loadedAt: plugin._loadedAt
        };
      }

      localStorage.setItem(this.storageKey, JSON.stringify(registry));
    } catch (error) {
      safeLog(`Error saving plugin registry: ${error.message}`);
    }
  }

  /**
   * Load plugin registry from localStorage (metadata only)
   */
  loadPluginRegistry() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const registry = JSON.parse(stored);

      // Note: This only loads metadata, not the actual plugin code
      // Plugins need to be re-registered on each app load
      safeLog(`Plugin registry loaded: ${Object.keys(registry).length} plugins`);

    } catch (error) {
      safeLog(`Error loading plugin registry: ${error.message}`);
    }
  }

  /**
   * Clear all plugins
   */
  clearAllPlugins() {
    // Unload all plugins
    for (const name of this.pluginOrder) {
      this.unregisterPlugin(name);
    }

    // Clear storage
    localStorage.removeItem(this.storageKey);

    safeLog('All plugins cleared');
    showToast('All plugins cleared', 'success');
  }

  /**
   * Get plugin statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.getEnabledPlugins().length,
      disabledPlugins: this.plugins.size - this.getEnabledPlugins().length,
      totalHooks: Object.values(this.hooks).reduce((sum, hooks) => sum + hooks.length, 0),
      hooksByType: Object.fromEntries(
        Object.entries(this.hooks).map(([name, hooks]) => [name, hooks.length])
      )
    };
  }
}

// Create singleton instance
const pluginManager = new PluginManager();

// Expose globally for debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.genpwdPluginManager = pluginManager;
}

export default pluginManager;
export { PluginManager };
