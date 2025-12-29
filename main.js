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
// src/js/app.js - Main application entry point
import { validateCharSets } from './config/constants.js';
import { initializeDictionaries } from './core/dictionaries.js';
import { initializeDOM } from './ui/dom.js';
import { bindEventHandlers } from './ui/events.js';
import { bindModalEvents } from './ui/modal.js';
import { defaultBlocksForMode } from './core/casing.js';
import { setBlocks } from './config/settings.js';
import { safeLog } from './utils/logger.js';
import { showToast } from './utils/toast.js';
import { t } from './utils/i18n.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '2.6.0';
  }

  async init() {
    try {
      safeLog(`Starting GenPwd Pro v${this.version} - Modular architecture`);
      
      // 1. Environment validation
      if (!this.validateEnvironment()) {
        throw new Error(t('toast.incompatibleEnvironment') || 'Incompatible environment');
      }

      // 2. Critical data validation
      if (!validateCharSets()) {
        throw new Error(t('toast.corruptedCharsets') || 'Corrupted character sets');
      }

      // 3. Initialize DOM
      await initializeDOM();
      safeLog('DOM initialized');

      // 4. Initialize dictionaries
      initializeDictionaries();
      safeLog('Dictionary system initialized');

      // 5. Initial block configuration
      const initialBlocks = defaultBlocksForMode('syllables');
      setBlocks(initialBlocks);
      safeLog(`Blocks initialized: ${initialBlocks.join('-')}`);

      // 6. Bind event handlers
      bindEventHandlers();
      bindModalEvents();
      safeLog('Events bound');

      // 7. Initial generation after delay
      setTimeout(() => this.generateInitial(), 300);

      this.initialized = true;
      safeLog('Application initialized successfully');
      
    } catch (error) {
      console.error('Critical initialization error:', error);
      safeLog(`Critical error: ${error.message}`);
      showToast(t('toast.criticalStartupError') || 'Critical startup error', 'error');
    }
  }

  validateEnvironment() {
    // Check required APIs
    const required = [
      'fetch', 'Promise', 'Map', 'Set', 'Object.assign',
      'JSON', 'addEventListener', 'querySelector'
    ];

    for (const api of required) {
      if (typeof window[api] === 'undefined') {
        safeLog(`Missing API: ${api}`);
        return false;
      }
    }

    // Check CSS Grid support
    const testEl = document.createElement('div');
    testEl.style.display = 'grid';
    if (testEl.style.display !== 'grid') {
      safeLog(t('toast.cssGridNotSupported') || 'CSS Grid not supported');
      return false;
    }

    return true;
  }

  async generateInitial() {
    try {
      safeLog('Starting automatic generation...');
      
      // Dynamic import to avoid circular dependencies
      const { generatePasswords } = await import('./ui/events.js');
      
      // Simulate click on generate button
      const generateBtn = document.getElementById('btn-generate');
      if (generateBtn) {
        generateBtn.click();
      }
      
    } catch (error) {
      safeLog(`Initial generation error: ${error.message}`);
    }
  }

  isDevelopment() {
    return location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1' ||
           location.protocol === 'file:';
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  window.genPwdApp = new GenPwdApp();
  window.genPwdApp.init();
});

// Global error handling
window.addEventListener('error', (e) => {
  safeLog(`Global JS error: ${e.message} - ${e.filename}:${e.lineno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  safeLog(`Rejected Promise: ${e.reason}`);
  e.preventDefault();
});

export { GenPwdApp };
