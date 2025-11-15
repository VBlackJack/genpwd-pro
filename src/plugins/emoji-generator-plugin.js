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

// src/plugins/emoji-generator-plugin.js - Demo Plugin: Emoji Password Generator

/**
 * Emoji Generator Plugin
 *
 * This plugin demonstrates how to extend GenPwd Pro with custom password generation.
 * It generates passwords using memorable emojis interspersed with alphanumeric characters.
 *
 * Example output: "🔒Secure🌟Pass123🎯"
 *
 * Hooks used:
 * - onGenerate: Custom password generation algorithm
 * - onPasswordStrength: Custom strength calculation for emoji passwords
 */

import { sanitizeHTML } from '../js/utils/dom-sanitizer.js';

const EmojiGeneratorPlugin = {
  name: 'emoji-generator',
  version: '1.0.0',
  author: 'GenPwd Pro Team',
  description: 'Generates memorable passwords with emojis',

  config: {
    emojiCategories: {
      security: ['🔒', '🔐', '🔑', '🛡️', '🔓'],
      nature: ['🌟', '🌈', '🌙', '⭐', '✨'],
      symbols: ['🎯', '💎', '🎨', '🎭', '🎪'],
      tech: ['💻', '📱', '🖥️', '⌨️', '🖱️']
    },
    defaultLength: 16,
    emojiFrequency: 3, // Insert emoji every N characters
    includeNumbers: true,
    includeSymbols: true
  },

  // Lifecycle hooks
  lifecycle: {
    onLoad() {
      console.log('[Emoji Generator Plugin] Loaded successfully');
    },

    onUnload() {
      console.log('[Emoji Generator Plugin] Unloaded');
    }
  },

  // Feature hooks
  hooks: {
    /**
     * Generate emoji-enhanced password
     * @param {Object} config - Generation configuration
     * @returns {string} - Generated password
     */
    onGenerate(config) {
      const length = config?.length || EmojiGeneratorPlugin.config.defaultLength;
      const includeEmojis = config?.includeEmojis !== false;

      if (!includeEmojis) {
        // If emojis disabled, return null to skip this plugin
        return null;
      }

      let password = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const symbols = '!@#$%^&*';

      // Get all emojis
      const allEmojis = Object.values(EmojiGeneratorPlugin.config.emojiCategories).flat();

      let charCount = 0;

      while (password.length < length) {
        // Add emoji every N characters
        if (charCount > 0 && charCount % EmojiGeneratorPlugin.config.emojiFrequency === 0 && includeEmojis) {
          const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
          password += randomEmoji;
        } else {
          // Add regular character
          const rand = Math.random();
          if (rand < 0.7) {
            // 70% letters
            password += chars[Math.floor(Math.random() * chars.length)];
          } else if (rand < 0.9 && EmojiGeneratorPlugin.config.includeNumbers) {
            // 20% numbers
            password += numbers[Math.floor(Math.random() * numbers.length)];
          } else if (EmojiGeneratorPlugin.config.includeSymbols) {
            // 10% symbols
            password += symbols[Math.floor(Math.random() * symbols.length)];
          } else {
            // Fallback to letter
            password += chars[Math.floor(Math.random() * chars.length)];
          }
          charCount++;
        }
      }

      return password;
    },

    /**
     * Calculate password strength for emoji passwords
     * @param {string} password - Password to analyze
     * @returns {Object|null} - Strength metrics or null
     */
    onPasswordStrength(password) {
      // Check if password contains emojis
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
      if (!emojiRegex.test(password)) {
        return null; // Not an emoji password, skip
      }

      // Count emojis
      const emojiCount = (password.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;

      // Basic entropy calculation
      // Each emoji adds ~10 bits (emoji set of ~1024)
      // Each alphanumeric adds ~6 bits (62 chars)
      const alphanumericCount = password.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').length;
      const entropy = (emojiCount * 10) + (alphanumericCount * 6);

      return {
        entropy: entropy,
        emojiCount: emojiCount,
        length: password.length,
        strength: entropy > 80 ? 'strong' : entropy > 50 ? 'medium' : 'weak',
        message: `Emoji-enhanced password: ${emojiCount} emojis, ~${Math.round(entropy)} bits entropy`
      };
    },

    /**
     * Custom UI rendering for emoji generator settings
     * @param {HTMLElement} container - Container element
     */
    onUIRender(container) {
      const settingsHTML = `
        <div class="plugin-settings emoji-generator-settings">
          <h4>🎨 Emoji Generator Settings</h4>
          <div class="setting-row">
            <label>
              <input type="checkbox" id="emoji-gen-enabled" checked>
              Enable Emoji Generation
            </label>
          </div>
          <div class="setting-row">
            <label for="emoji-frequency">Emoji Frequency (every N chars):</label>
            <input type="number" id="emoji-frequency" min="2" max="10" value="3">
          </div>
          <div class="setting-row">
            <label>Categories:</label>
            <div class="emoji-categories">
              <label><input type="checkbox" value="security" checked> 🔒 Security</label>
              <label><input type="checkbox" value="nature" checked> 🌟 Nature</label>
              <label><input type="checkbox" value="symbols" checked> 🎯 Symbols</label>
              <label><input type="checkbox" value="tech" checked> 💻 Tech</label>
            </div>
          </div>
          <div class="setting-row">
            <button id="emoji-test-generate" class="btn-mini">Test Generate</button>
            <span id="emoji-test-result" style="margin-left: 10px;"></span>
          </div>
        </div>
      `;

      container.innerHTML = sanitizeHTML(settingsHTML);

      // Bind test button
      const testBtn = container.querySelector('#emoji-test-generate');
      const testResult = container.querySelector('#emoji-test-result');

      if (testBtn && testResult) {
        testBtn.addEventListener('click', () => {
          const password = EmojiGeneratorPlugin.hooks.onGenerate({ length: 16, includeEmojis: true });
          testResult.textContent = password;
        });
      }
    }
  }
};

// Export for ES6 modules
export default EmojiGeneratorPlugin;

// Also make available for direct registration
if (typeof window !== 'undefined') {
  window.EmojiGeneratorPlugin = EmojiGeneratorPlugin;
}
