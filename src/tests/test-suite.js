// tools/test-suite.js - Suite de tests complète pour GenPwd Pro v2.5
// Usage: Inclure dans index.html ou exécuter via console

class GenPwdTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      details: [],
      startTime: null,
      endTime: null
    };
    this.isRunning = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    console.log(logMessage);
    
    // Stockage pour affichage dans l'UI
    if (!this.consoleOutput) this.consoleOutput = [];
    this.consoleOutput.push(logMessage);
  }

  setElement(id, value) {
    const el = document.getElementById(id);
    if (!el) return false;

    if (el.type === 'range' || el.type === 'number') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.type === 'checkbox') {
      el.checked = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  clickButton(id) {
    const btn = document.getElementById(id);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }

  getResults() {
    const resultsContainer = document.getElementById('results-list');
    if (!resultsContainer) return [];
    
    const cards = resultsContainer.querySelectorAll('.card');
    return Array.from(cards).map(card => {
      const passwordEl = card.querySelector('.value.mono');
      const password = passwordEl ? passwordEl.textContent.trim() : '';
      
      const cardText = card.textContent;
      const entropyMatch = cardText.match(/(\d+\.?\d*)\s*bits/);
      const entropy = entropyMatch ? entropyMatch[1] + ' bits' : '';
      
      const charMatch = cardText.match(/(\d+)\s*chars?/);
      const charCount = charMatch ? charMatch[1] + ' chars' : '';
      
      return { 
        password, 
        entropy, 
        mode: 'detected',
        charCount,
        length: password.length
      };
    }).filter(result => result.password.length > 0);
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testConfiguration(config) {
    try {
      this.log(`Testing: ${config.name}`);
      
      // Clear previous results
      this.clickButton('btn-clear');
      await this.wait(300);
      
      // Configuration avec mapping correct
      const elementMapping = {
        'syll-policy': 'policy-select',
        'qty-range': 'qty'
      };
      
      let configErrors = 0;
      for (const [key, value] of Object.entries(config.settings)) {
        const actualKey = elementMapping[key] || key;
        if (!this.setElement(actualKey, value)) {
          this.log(`⚠️  Élément ${actualKey} non trouvé`);
          configErrors++;
        }
      }

      await this.wait(800);

      // Génération
      if (!this.clickButton('btn-generate')) {
        throw new Error('Bouton génération non trouvé');
      }

      await this.wait(1500);

      // Vérification
      const passwords = this.getResults();
      if (passwords.length === 0) {
        throw new Error('Aucun mot de passe généré');
      }

      // Validation spécifique
      if (config.validation) {
        config.validation(passwords);
      }

      this.results.passed++;
      this.results.details.push({
        test: config.name,
        status: 'PASS',
        passwords: passwords.slice(0, 2),
        settings: config.settings,
        count: passwords.length,
        configErrors
      });

      this.log(`✅ ${config.name} - ${passwords.length} mots générés`, 'success');
      if (passwords[0]) {
        this.log(`   Exemple: "${passwords[0].password}" (${passwords[0].entropy})`);
      }

    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: config.name,
        error: error.message,
        settings: config.settings
      });
      this.log(`❌ ${config.name} - Erreur: ${error.message}`, 'error');
    }
  }

  getTestConfigurations() {
    return [
      {
        name: 'Syllables - Base',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '20',
          'policy-select': 'standard',
          'digits-count': '1',
          'specials-count': '1',
          'place-digits': 'fin',
          'place-specials': 'milieu',
          'case-mode-select': 'mixte'
        },
        validation: (passwords) => {
          if (passwords[0].password.length < 15) throw new Error('Mot de passe trop court');
          if (!/\d/.test(passwords[0].password)) throw new Error('Chiffre manquant');
        }
      },
      
      {
        name: 'Syllables - Blocks',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '15',
          'case-mode-select': 'blocks',
          'digits-count': '2',
          'specials-count': '1'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          const digitCount = (pwd.match(/\d/g) || []).length;
          if (digitCount < 2) throw new Error(`${digitCount} chiffre(s) au lieu de 2`);
        }
      },

      {
        name: 'Passphrase - Français',
        settings: {
          'mode-select': 'passphrase',
          'pp-count': '3',
          'pp-sep': '-',
          'dict-select': 'french',
          'digits-count': '1',
          'specials-count': '1',
          'case-mode-select': 'title'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!pwd.includes('-')) throw new Error('Séparateur manquant');
          const parts = pwd.split('-');
          if (parts.length < 3) throw new Error(`${parts.length} mots au lieu de 3`);
        }
      },

      {
        name: 'Passphrase - Blocks',
        settings: {
          'mode-select': 'passphrase',
          'pp-count': '4',
          'case-mode-select': 'blocks',
          'digits-count': '0',
          'specials-count': '0'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!/[a-z]/.test(pwd) || !/[A-Z]/.test(pwd)) {
            throw new Error('Blocs de casse non appliqués');
          }
        }
      },

      {
        name: 'Leet - Password',
        settings: {
          'mode-select': 'leet',
          'leet-input': 'password',
          'digits-count': '2',
          'specials-count': '1',
          'place-digits': 'debut',
          'place-specials': 'fin',
          'case-mode-select': 'upper'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!(/[@301$]/.test(pwd))) {
            throw new Error('Transformation leet non détectée');
          }
        }
      },

      {
        name: 'Leet - Hello Blocks',
        settings: {
          'mode-select': 'leet',
          'leet-input': 'hello',
          'case-mode-select': 'blocks'
        }
      },

      {
        name: 'Placement - Début',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '12',
          'digits-count': '1',
          'specials-count': '1',
          'place-digits': 'debut',
          'place-specials': 'debut'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!/^[\d\W]/.test(pwd)) {
            throw new Error('Placement début non respecté');
          }
        }
      },

      {
        name: 'Placement - Fin',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '12',
          'digits-count': '1',
          'specials-count': '1',
          'place-digits': 'fin',
          'place-specials': 'fin'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!/[\d\W]$/.test(pwd)) {
            throw new Error('Placement fin non respecté');
          }
        }
      },

      {
        name: 'Placement - Visuel',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '12',
          'digits-count': '2',
          'specials-count': '2',
          'place-digits': 'positions',
          'place-specials': 'positions'
        }
      },

      {
        name: 'Politique Layout-Safe',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '18',
          'policy-select': 'layout-safe',
          'digits-count': '1',
          'specials-count': '1'
        }
      },

      {
        name: 'Spéciaux Personnalisés',
        settings: {
          'mode-select': 'syllables',
          'syll-len': '15',
          'digits-count': '0',
          'specials-count': '3',
          'custom-specials': '@#$%'
        },
        validation: (passwords) => {
          const pwd = passwords[0].password;
          if (!/@|#|\$|%/.test(pwd)) {
            throw new Error('Caractères personnalisés non utilisés');
          }
        }
      },

      {
        name: 'Quantité Élevée',
        settings: {
          'mode-select': 'syllables',
          'qty': '8',
          'syll-len': '12'
        },
        validation: (passwords) => {
          if (passwords.length < 7) {
            throw new Error(`${passwords.length} mots au lieu de 8+`);
          }
        }
      }
    ];
  }

  async testSpecialFeatures() {
    this.log('🔧 Test des fonctionnalités spéciales');

    try {
      let featuresWorking = 0;

      // Test masquage
      if (this.setElement('mask-toggle', true)) {
        await this.wait(300);
        this.log('✅ Masquage fonctionnel');
        this.setElement('mask-toggle', false);
        featuresWorking++;
      }

      // Test blocs de casse
      this.setElement('mode-select', 'syllables');
      this.setElement('case-mode-select', 'blocks');
      await this.wait(500);
      
      const blockButtons = ['btn-all-title', 'btn-all-upper', 'btn-all-lower'];
      let workingButtons = 0;
      
      for (const btnId of blockButtons) {
        if (this.clickButton(btnId)) {
          workingButtons++;
          await this.wait(200);
        }
      }
      
      this.log(`✅ ${workingButtons}/${blockButtons.length} boutons blocs`);
      if (workingButtons > 0) featuresWorking++;

      // Test placement visuel
      if (this.clickButton('btn-placement-toggle')) {
        this.log('✅ Mode placement visuel');
        await this.wait(500);
        
        if (this.clickButton('btn-placement-auto')) {
          this.log('✅ Auto-distribution');
          await this.wait(300);
        }
        
        if (this.clickButton('btn-placement-reset')) {
          this.log('✅ Reset placement');
        }
        featuresWorking++;
      }

      // Test copie et export (si résultats présents)
      if (this.getResults().length > 0) {
        if (this.clickButton('btn-copy-all')) {
          this.log('✅ Copie tout');
          featuresWorking++;
        }
        if (this.clickButton('btn-export')) {
          this.log('✅ Export');
          featuresWorking++;
        }
      }

      this.results.passed++;
      this.log(`✅ ${featuresWorking} fonctionnalités spéciales testées`);
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: 'Fonctionnalités spéciales',
        error: error.message
      });
      this.log(`❌ Erreur fonctionnalités: ${error.message}`, 'error');
    }
  }

  async runAllTests() {
    if (this.isRunning) {
      this.log('❌ Tests déjà en cours');
      return this.results;
    }

    this.isRunning = true;
    this.results = { passed: 0, failed: 0, errors: [], details: [], startTime: new Date(), endTime: null };
    this.consoleOutput = [];

    this.log('🚀 DÉBUT DES TESTS - GenPwd Pro v2.5');
    this.log('='.repeat(50));
    
    const configurations = this.getTestConfigurations();
    
    for (let i = 0; i < configurations.length; i++) {
      await this.testConfiguration(configurations[i]);
      await this.wait(300);
    }

    await this.testSpecialFeatures();

    this.results.endTime = new Date();
    this.displayFinalReport();
    this.isRunning = false;

    // Export global
    window.lastTestResults = this.results;
    
    return this.results;
  }

  displayFinalReport() {
    const duration = this.results.endTime - this.results.startTime;
    
    this.log('='.repeat(50));
    this.log('📊 RAPPORT FINAL');
    this.log('='.repeat(50));
    this.log(`✅ Tests réussis: ${this.results.passed}`);
    this.log(`❌ Tests échoués: ${this.results.failed}`);
    const total = this.results.passed + this.results.failed;
    const score = Math.round((this.results.passed / total) * 100);
    this.log(`📈 Score: ${score}% en ${Math.round(duration/1000)}s`);

    if (this.results.errors.length > 0) {
      this.log('');
      this.log('🚨 ERREURS:');
      this.results.errors.forEach((err, i) => {
        this.log(`${i + 1}. ${err.test}: ${err.error}`);
      });
    }

    this.log('');
    this.log('📋 SUCCÈS:');
    this.results.details.forEach((detail, i) => {
      this.log(`${i + 1}. ${detail.test} - ${detail.count} mots`);
      if (detail.passwords[0]) {
        this.log(`   "${detail.passwords[0].password}" (${detail.passwords[0].entropy})`);
      }
    });

    this.log('');
    this.log(`🏁 TERMINÉ - Score: ${score}%`);
  }

  async runSingleTest(testName) {
    const configs = this.getTestConfigurations();
    const config = configs.find(c => c.name === testName);
    
    if (!config) {
      this.log(`❌ Test "${testName}" introuvable`);
      const available = configs.map(c => c.name).join(', ');
      this.log(`Tests disponibles: ${available}`);
      return;
    }

    this.results = { passed: 0, failed: 0, errors: [], details: [], startTime: new Date(), endTime: null };
    this.consoleOutput = [];
    
    await this.testConfiguration(config);
    
    this.results.endTime = new Date();
    this.displayFinalReport();
  }

  getConsoleOutput() {
    return this.consoleOutput ? this.consoleOutput.join('\n') : '';
  }
}

// API globale
if (typeof window !== 'undefined') {
  window.GenPwdTestSuite = GenPwdTestSuite;
  window.testSuite = new GenPwdTestSuite();
  window.runTests = () => window.testSuite.runAllTests();
  window.runTest = (name) => window.testSuite.runSingleTest(name);
}

// Export module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenPwdTestSuite;
}