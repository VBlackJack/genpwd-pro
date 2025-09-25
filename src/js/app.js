// src/js/app.js - Point d'entrée principal de l'application (VERSION CORRIGÉE)
import { validateCharSets } from './config/constants.js';
import { initializeDictionaries } from './core/dictionaries.js';
import { initializeDOM } from './ui/dom.js';
import { bindEventHandlers } from './ui/events.js';
import { bindModalEvents } from './ui/modal.js';
import { defaultBlocksForMode } from './core/casing.js';
import { setBlocks } from './config/settings.js';
import { safeLog } from './utils/logger.js';
import { showToast } from './utils/toast.js';

class GenPwdApp {
  constructor() {
    this.initialized = false;
    this.version = '2.5.0';
  }

  async init() {
    try {
      safeLog(`Démarrage GenPwd Pro v${this.version} - Architecture modulaire`);
      
      // 1. Validation de l'environnement
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