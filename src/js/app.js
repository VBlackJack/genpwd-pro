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
// src/js/app.js - Point d'entrée principal de l'application
import { validateCharSets } from './config/constants.js';
import { initializeDictionaries } from './core/dictionaries.js';
import { initializeDOM } from './ui/dom.js';
import { bindEventHandlers } from './ui/events.js';
import { bindModalEvents } from './ui/modal.js';
import { defaultBlocksForMode } from './core/casing.js';
import { setBlocks } from './config/settings.js';
import { safeLog } from './utils/logger.js';
import { showToast } from './utils/toast.js';
import { testClipboardCapabilities as runClipboardTest } from './utils/clipboard.js';
import {
  installSelectionProtection,
  focusAndCleanSelection,
  debugSelection
} from './utils/selection-fix.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '2.5.0';
  }

  async init() {
    try {
      if (this.initialized) return;

      safeLog(`Démarrage GenPwd Pro v${this.version} - Architecture modulaire`);

      // 🔧 NOUVEAU: Installation protection Selection
      installSelectionProtection();

      // 🔧 NOUVEAU: Nettoyage initial
      focusAndCleanSelection();

      // 1. Validation environnement
      if (!this.validateEnvironment()) {
        throw new Error('Environnement non compatible');
      }

      // 2. Validation des données critiques
      if (!validateCharSets()) {
        throw new Error('Données CHAR_SETS corrompues');
      }

      // 3. Initialisation DOM
      await initializeDOM();
      safeLog('DOM initialisé');

      // 4. Initialisation dictionnaires
      initializeDictionaries();
      safeLog('Système dictionnaires initialisé');

      // 5. Configuration initiale des blocs
      const initialBlocks = defaultBlocksForMode('syllables');
      setBlocks(initialBlocks);
      safeLog(`Blocs initialisés: ${initialBlocks.join('-')}`);

      // 6. Binding des événements
      bindEventHandlers();
      bindModalEvents();
      safeLog('Événements bindés');

      // 7. Génération initiale après un délai
      setTimeout(() => this.generateInitial(), 300);

      this.initialized = true;
      safeLog('Application initialisée avec succès');
      
    } catch (error) {
      console.error('Erreur critique initialisation:', error);
      safeLog(`Erreur critique: ${error.message}`);
      showToast('Erreur critique au démarrage', 'error');
    }
  }

  validateEnvironment() {
    // Vérifier APIs de window
    const windowAPIs = ['fetch', 'Promise', 'Map', 'Set', 'JSON'];
    
    for (const api of windowAPIs) {
      if (typeof window[api] === 'undefined') {
        safeLog(`API window manquante: ${api}`);
        return false;
      }
    }
    
    // Vérifier APIs spécifiques
    if (typeof Object.assign === 'undefined') {
      safeLog('API manquante: Object.assign');
      return false;
    }
    
    if (typeof document.querySelector === 'undefined') {
      safeLog('API manquante: document.querySelector');
      return false;
    }
    
    if (typeof window.addEventListener === 'undefined') {
      safeLog('API manquante: window.addEventListener');
      return false;
    }

    // Vérifier support CSS Grid
    const testEl = document.createElement('div');
    testEl.style.display = 'grid';
    if (testEl.style.display !== 'grid') {
      safeLog('CSS Grid non supporté');
      return false;
    }

    // 🔧 NOUVEAU: Test de l'API Selection
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0);
      }
      safeLog('✅ API Selection validée');
    } catch (e) {
      safeLog(`⚠️  API Selection problématique: ${e.message}`);
    }

    safeLog('Environnement validé avec succès');
    return true;
  }

  async generateInitial() {
    try {
      safeLog('Lancement génération automatique...');
      
      // Simuler clic sur le bouton générer
      const generateBtn = document.getElementById('btn-generate');
      if (generateBtn) {
        generateBtn.click();
      } else {
        safeLog('Bouton générer non trouvé pour génération initiale');
      }
      
    } catch (error) {
      safeLog(`Erreur génération initiale: ${error.message}`);
    }
  }

  isDevelopment() {
    return location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1' ||
           location.protocol === 'file:';
  }

  // 🔧 NOUVEAU: Ajout d'un utilitaire de debug
  debugSelectionIssue() {
    if (this.isDevelopment()) {
      debugSelection();
    }
  }

  testClipboardCapabilities() {
    runClipboardTest();
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  window.genPwdApp = new GenPwdApp();
  window.genPwdApp.init();
});

// Gestion erreurs globales
window.addEventListener('error', (e) => {
  safeLog(`Erreur JS globale: ${e.message} - ${e.filename}:${e.lineno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  safeLog(`Promise rejetée: ${e.reason}`);
  e.preventDefault();
});

export { GenPwdApp };
