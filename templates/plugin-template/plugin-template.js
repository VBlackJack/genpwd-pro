/*
 * Copyright 2025 [Your Name]
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

// Plugin Template for GenPwd Pro v2.6.0
// Replace [PLUGIN_NAME], [AUTHOR], [DESCRIPTION] with your values

/**
 * [PLUGIN_NAME] Plugin
 *
 * [DETAILED_DESCRIPTION]
 *
 * Hooks used:
 * - onGenerate: [If used, describe functionality]
 * - onExport: [If used, describe functionality]
 * - onImport: [If used, describe functionality]
 * - onUIRender: [If used, describe functionality]
 * - onPasswordValidate: [If used, describe functionality]
 * - onPasswordStrength: [If used, describe functionality]
 */

const MyPlugin = {
  // REQUIRED: Plugin metadata
  name: 'my-plugin', // Unique identifier (alphanumeric, dashes, underscores only)
  version: '1.0.0', // Semantic versioning
  author: 'Your Name', // Your name or organization
  description: 'A brief description of your plugin', // Max 200 characters

  // OPTIONAL: Plugin configuration
  config: {
    // Your plugin settings here
    enabled: true,
    // Example settings:
    // customSetting1: 'value',
    // customSetting2: 42
  },

  // REQUIRED: Lifecycle hooks
  lifecycle: {
    /**
     * Called when plugin is loaded
     * Use this for initialization tasks
     */
    onLoad() {
      console.log('[My Plugin] Loaded successfully');
      // Initialize your plugin here
      // Example: Load saved settings from localStorage
    },

    /**
     * Called when plugin is unloaded
     * Use this for cleanup tasks
     */
    onUnload() {
      console.log('[My Plugin] Unloaded');
      // Clean up resources here
      // Example: Remove event listeners, clear caches
    }
  },

  // OPTIONAL: Feature hooks (implement only the hooks you need)
  hooks: {
    /**
     * HOOK: onGenerate
     * Called during password generation
     * Allows custom password generation logic
     *
     * @param {Object} config - Generation configuration
     * @param {number} config.length - Desired password length
     * @param {string} config.mode - Generation mode (syllables, passphrase, leet)
     * @param {Object} config.options - Additional options
     * @returns {string|null} - Generated password or null to skip
     */
    onGenerate(config) {
      // Example: Custom password generator
      // Return null if you don't want to generate a password
      // return null;

      // Example implementation:
      // const password = yourCustomGenerationLogic(config);
      // return password;

      return null; // Remove this line and implement your logic
    },

    /**
     * HOOK: onExport
     * Called when exporting passwords
     * Allows custom export formats
     *
     * @param {Array} passwords - Array of password objects
     * @param {Object} options - Export options
     * @param {string} options.format - Requested format
     * @returns {string|null} - Exported data or null to skip
     */
    onExport(passwords, options = {}) {
      // Example: Custom export format
      // const format = options.format || 'json';

      // Only handle your custom format
      // if (format !== 'myformat') {
      //   return null;
      // }

      // Example implementation:
      // const exportedData = convertToMyFormat(passwords);
      // return exportedData;

      return null; // Remove this line and implement your logic
    },

    /**
     * HOOK: onImport
     * Called when importing passwords
     * Allows custom import parsers
     *
     * @param {string} data - Import data (file content)
     * @param {Object} options - Import options
     * @param {string} options.format - Requested format
     * @returns {Array|null} - Array of password objects or null to skip
     */
    onImport(data, options = {}) {
      // Example: Custom import parser
      // const format = options.format || 'json';

      // Only handle your custom format
      // if (format !== 'myformat') {
      //   return null;
      // }

      // Example implementation:
      // const passwords = parseMyFormat(data);
      // return passwords;

      return null; // Remove this line and implement your logic
    },

    /**
     * HOOK: onPasswordValidate
     * Called to validate generated passwords
     * Allows custom validation rules
     *
     * @param {string} password - Password to validate
     * @returns {Object|null} - Validation result or null to skip
     * @returns {boolean} result.valid - Is password valid?
     * @returns {string} result.message - Validation message
     * @returns {Array} result.errors - Array of error messages
     */
    onPasswordValidate(password) {
      // Example: Custom validation logic
      // const valid = yourValidationLogic(password);
      // return {
      //   valid: valid,
      //   message: valid ? 'Password is valid' : 'Password failed custom validation',
      //   errors: valid ? [] : ['Error 1', 'Error 2']
      // };

      return null; // Remove this line and implement your logic
    },

    /**
     * HOOK: onPasswordStrength
     * Called to calculate password strength
     * Allows custom strength metrics
     *
     * @param {string} password - Password to analyze
     * @returns {Object|null} - Strength metrics or null to skip
     * @returns {number} result.entropy - Entropy in bits
     * @returns {string} result.strength - Strength level (weak, medium, strong)
     * @returns {string} result.message - Human-readable message
     */
    onPasswordStrength(password) {
      // Example: Custom strength calculation
      // const entropy = calculateEntropy(password);
      // return {
      //   entropy: entropy,
      //   strength: entropy > 80 ? 'strong' : entropy > 50 ? 'medium' : 'weak',
      //   message: `Custom strength: ${entropy.toFixed(1)} bits`
      // };

      return null; // Remove this line and implement your logic
    },

    /**
     * HOOK: onUIRender
     * Called to render custom UI for plugin settings
     * Allows adding custom configuration interface
     *
     * @param {HTMLElement} container - Container element
     */
    onUIRender(container) {
      // Example: Render custom settings UI
      const settingsHTML = `
        <div class="plugin-settings my-plugin-settings">
          <h4>My Plugin Settings</h4>
          <div class="setting-row">
            <label>
              <input type="checkbox" id="my-plugin-enabled" ${MyPlugin.config.enabled ? 'checked' : ''}>
              Enable My Feature
            </label>
          </div>
          <div class="setting-row">
            <button id="my-plugin-test" class="btn-mini">Test Plugin</button>
          </div>
        </div>
      `;

      container.innerHTML = settingsHTML;

      // Bind events
      const testBtn = container.querySelector('#my-plugin-test');
      if (testBtn) {
        testBtn.addEventListener('click', () => {
          alert('Plugin test button clicked!');
          // Your test logic here
        });
      }

      const enabledCheck = container.querySelector('#my-plugin-enabled');
      if (enabledCheck) {
        enabledCheck.addEventListener('change', (e) => {
          MyPlugin.config.enabled = e.target.checked;
          // Save to localStorage or your storage mechanism
        });
      }
    }
  },

  // OPTIONAL: Utility methods (private to your plugin)
  // These won't be called by GenPwd Pro directly
  utils: {
    // Your helper functions here
    exampleHelper() {
      return 'This is a helper function';
    }
  }
};

// Export for ES6 modules
export default MyPlugin;

// Also make available for direct registration (if loaded via script tag)
if (typeof window !== 'undefined') {
  window.MyPlugin = MyPlugin;
}
