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
import { CHAR_SETS, validateCharSets } from './config/constants.js';
import { initializeDictionaries } from './core/dictionaries.js';
import { initializeDOM } from './ui/dom.js';
import { bindEventHandlers } from './ui/events.js';
import { bindModalEvents } from './ui/modal.js';
import { defaultBlocksForMode } from './core/casing.js';
import { setBlocks } from './config/settings.js';
import { safeLog } from './utils/logger.js';
import { showToast } from './utils/toast.js';
import { initErrorMonitoring, reportError } from './utils/error-monitoring.js';
import { initThemeSystem } from './utils/theme-manager.js';
import { isDevelopment } from './utils/environment.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '2.5.2';
  }

  async init() {
    try {
      safeLog(`Démarrage GenPwd Pro v${this.version} - Architecture modulaire`);

      // 0. Initialiser le système de thèmes (en premier pour l'UI)
      initThemeSystem();
      safeLog('Système de thèmes initialisé');

      // 1. Initialiser le monitoring d'erreurs
      initErrorMonitoring();
      safeLog('Monitoring d\'erreurs initialisé');

      // 2. Validation de l'environnement
      if (!this.validateEnvironment()) {
        throw new Error('Environnement non compatible');
      }

      // 3. Validation des données critiques
      if (!validateCharSets()) {
        throw new Error('Données CHAR_SETS corrompues');
      }

      // 4. Initialisation DOM
      await initializeDOM();
      safeLog('DOM initialisé');

      // 5. Initialisation dictionnaires
      initializeDictionaries();
      safeLog('Système dictionnaires initialisé');

      // 6. Configuration initiale des blocs
      const initialBlocks = defaultBlocksForMode('syllables');
      setBlocks(initialBlocks);
      safeLog(`Blocs initialisés: ${initialBlocks.join('-')}`);

      // 7. Binding des événements
      bindEventHandlers();
      bindModalEvents();
      safeLog('Événements bindés');

      // 8. Génération initiale après un délai
      setTimeout(() => this.generateInitial(), 300);

      this.initialized = true;
      safeLog('Application initialisée avec succès');

    } catch (error) {
      console.error('Erreur critique initialisation:', error);
      safeLog(`Erreur critique: ${error.message}`);
      reportError(error, { phase: 'initialization' });
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
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  window.genPwdApp = new GenPwdApp();
  window.genPwdApp.init();
});

// Note: La gestion des erreurs globales est maintenant gérée par error-monitoring.js
// qui est initialisé dans init() via initErrorMonitoring()

export { GenPwdApp };
