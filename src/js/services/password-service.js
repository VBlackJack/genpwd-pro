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

// src/js/services/password-service.js - Service layer for password generation

import { generateSyllables, generatePassphrase, generateLeet } from '../core/generators.js';
import { safeLog } from '../utils/logger.js';
import { t } from '../utils/i18n.js';

/**
 * Password Generation Service
 * Encapsulates business logic and provides a clean API for password generation
 */
export class PasswordService {
  /**
   * Creates a new PasswordService instance
   * @param {Object} config - Service configuration
   * @param {Function} config.onError - Error callback (optional)
   * @param {Function} config.onSuccess - Success callback (optional)
   */
  constructor(config = {}) {
    this.onError = config.onError || ((error) => safeLog(`Error: ${error.message}`));
    this.onSuccess = config.onSuccess || (() => {});
  }

  /**
   * Generates a single password based on configuration
   * @param {string} mode - Generation mode (syllables, passphrase, leet)
   * @param {Object} config - Generation configuration
   * @returns {Promise<Object>} Generated password result
   * @example
   * const result = await service.generateOne('syllables', {
   *   length: 20,
   *   policy: 'standard',
   *   digits: 2,
   *   specials: 2
   * });
   */
  async generateOne(mode, config) {
    try {
      safeLog(`PasswordService: Generating ${mode} password`);

      let result;
      switch (mode) {
        case 'syllables':
          result = generateSyllables(config);
          break;

        case 'passphrase':
          result = await generatePassphrase(config);
          break;

        case 'leet':
          result = generateLeet(config);
          break;

        default:
          throw new Error(t('errors.generation.unknownMode', { mode }));
      }

      if (!result || !result.value || result.value.startsWith('error-')) {
        throw new Error(t('errors.generation.invalidResult'));
      }

      this.onSuccess(result);
      return result;

    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  /**
   * Generates multiple passwords in parallel
   * @param {string} mode - Generation mode
   * @param {Object} config - Generation configuration
   * @param {number} quantity - Number of passwords to generate
   * @returns {Promise<Array>} Array of generated passwords
   * @example
   * const results = await service.generateBatch('passphrase', config, 5);
   */
  async generateBatch(mode, config, quantity) {
    try {
      safeLog(`PasswordService: Generating ${quantity} ${mode} passwords`);

      const promises = Array.from(
        { length: quantity },
        () => this.generateOne(mode, config)
      );

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r && r.value && !r.value.startsWith('error-'));

      if (validResults.length === 0) {
        throw new Error(t('errors.generation.allFailed'));
      }

      safeLog(`PasswordService: Generated ${validResults.length}/${quantity} passwords successfully`);
      return validResults;

    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  /**
   * Validates password configuration before generation
   * @param {string} mode - Generation mode
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   * @example
   * const validation = service.validateConfig('syllables', config);
   * if (!validation.valid) {
   *   console.error('Invalid config:', validation.errors);
   * }
   */
  validateConfig(mode, config) {
    const errors = [];

    // Common validations
    if (config.digits < 0 || config.digits > 6) {
      errors.push('Digits count must be between 0 and 6');
    }

    if (config.specials < 0 || config.specials > 6) {
      errors.push('Specials count must be between 0 and 6');
    }

    // Mode-specific validations
    switch (mode) {
      case 'syllables':
        if (!config.length || config.length < 6 || config.length > 64) {
          errors.push('Syllables length must be between 6 and 64');
        }
        if (!config.policy) {
          errors.push('Policy is required for syllables mode');
        }
        break;

      case 'passphrase':
        if (!config.wordCount || config.wordCount < 2 || config.wordCount > 8) {
          errors.push('Word count must be between 2 and 8');
        }
        if (!config.dictionary) {
          errors.push('Dictionary is required for passphrase mode');
        }
        break;

      case 'leet':
        if (!config.baseWord || config.baseWord.length === 0) {
          errors.push('Base word is required for leet mode');
        }
        break;

      default:
        errors.push(`Unknown mode: ${mode}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculates estimated generation time
   * @param {string} mode - Generation mode
   * @param {number} quantity - Number of passwords
   * @returns {number} Estimated time in milliseconds
   */
  estimateGenerationTime(mode, quantity) {
    // Rough estimates based on mode complexity
    const baseTime = {
      syllables: 1,      // ~1ms per password
      passphrase: 5,     // ~5ms (includes dictionary lookup)
      leet: 0.5          // ~0.5ms (simple transformation)
    };

    return (baseTime[mode] || 1) * quantity;
  }
}

