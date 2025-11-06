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

// New v2.6.0 imports
import { i18n } from './utils/i18n.js';
import { initSentry, captureException } from './config/sentry-config.js';
import analytics from './utils/analytics.js';
import presetManager from './utils/preset-manager.js';
import historyManager from './utils/history-manager.js';
import { initializeAllFeatures } from './ui/features-ui.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '2.6.0';
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

      // 1.1 NEW: Initialiser Sentry (optionnel, configuré via SENTRY_DSN)
      try {
        await initSentry();
        safeLog('Sentry initialisé');
      } catch (error) {
        safeLog('Sentry non configuré ou désactivé');
      }

      // 1.2 NEW: Initialiser Analytics (optionnel, configuré via provider)
      if (analytics.config.provider !== 'none') {
        analytics.init();
        safeLog(`Analytics initialisé: ${analytics.config.provider}`);
      }

      // 1.3 NEW: Initialiser i18n et charger locale
      try {
        const detectedLocale = i18n.detectLocale();
        await i18n.loadLocale(detectedLocale);
        await i18n.setLocale(detectedLocale);
        safeLog(`i18n initialisé: ${detectedLocale}`);
      } catch (i18nError) {
        safeLog(`i18n non disponible: ${i18nError.message} - continuant sans i18n`);
      }

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

      // 4.1 NEW: Initialiser les nouveaux composants UI
      this.initializeNewFeatures();
      safeLog('Nouvelles fonctionnalités UI initialisées');

      // 4.2 NEW: Initialiser UI des features (language, presets, history)
      initializeAllFeatures();
      safeLog('Feature UIs initialisées (language, presets, history)');

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

      // 7.1 NEW: Binding des nouveaux événements
      this.bindNewFeatureEvents();
      safeLog('Nouveaux événements bindés');

      // 8. Génération initiale après un délai
      setTimeout(() => this.generateInitial(), 300);

      // 9. NEW: Track page view
      if (analytics.config.provider !== 'none') {
        analytics.trackPageView();
      }

      this.initialized = true;
      safeLog('Application initialisée avec succès');
      showToast('GenPwd Pro v2.6.0 chargé avec succès', 'success');

    } catch (error) {
      console.error('Erreur critique initialisation:', error);
      safeLog(`Erreur critique: ${error.message}`);
      reportError(error, { phase: 'initialization' });

      // NEW: Report to Sentry
      if (typeof captureException === 'function') {
        captureException(error, { phase: 'initialization' });
      }

      showToast('Erreur critique au démarrage', 'error');
    }
  }

  /**
   * Initialize new v2.6.0 features UI components
   */
  initializeNewFeatures() {
    // Check if managers are initialized
    if (presetManager) {
      safeLog(`Preset manager: ${presetManager.getAllPresets().length} presets loaded`);
    }

    if (historyManager) {
      const settings = historyManager.getSettings();
      safeLog(`History manager: ${settings.enabled ? 'enabled' : 'disabled'}`);
    }

    // Note: UI elements will be added via separate UI modules
    // This is just initialization logging
  }

  /**
   * Bind new feature event handlers
   */
  bindNewFeatureEvents() {
    // Language selector will be added via features-ui.js
    // Preset management UI will be added via features-ui.js
    // History UI will be added via features-ui.js

    // For now, expose managers globally for debugging
    if (isDevelopment()) {
      window.genpwdPresets = presetManager;
      window.genpwdHistory = historyManager;
      window.genpwdi18n = i18n;
      window.genpwdAnalytics = analytics;
      safeLog('Managers exposed globally for debugging');
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
    testEl.style.setProperty('display', 'grid');
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
