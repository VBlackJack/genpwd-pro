# API Documentation - GenPwd Pro v2.5

> Interface de programmation complète pour l'utilisation et l'extension de GenPwd Pro

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation et initialisation](#installation-et-initialisation)
3. [Classes principales](#classes-principales)
4. [API de génération](#api-de-génération)
5. [API des dictionnaires](#api-des-dictionnaires)
6. [API de configuration](#api-de-configuration)
7. [API utilitaires](#api-utilitaires)
8. [Événements](#événements)
9. [Hooks et extensions](#hooks-et-extensions)
10. [Exemples complets](#exemples-complets)

## Vue d'ensemble

GenPwd Pro expose une API JavaScript moderne basée sur les modules ES6, permettant l'intégration et l'extension des fonctionnalités de génération de mots de passe.

### Architecture de l'API

```javascript
// Structure principale de l'API
window.GenPwdPro = {
  // Générateurs
  Generator: PasswordGenerator,
  
  // Gestionnaires
  DictionaryManager: DictionaryManager,
  SettingsManager: SettingsManager,
  
  // Utilitaires
  EntropyCalculator: EntropyCalculator,
  CasingSystem: CasingSystem,
  PlacementEngine: PlacementEngine,
  
  // Événements
  EventBus: EventEmitter,
  
  // Version
  version: '2.5.0'
};
```

## Installation et initialisation

### Via module ES6

```javascript
// Import des modules
import { PasswordGenerator } from './js/core/generators.js';
import { DictionaryManager } from './js/core/dictionaries.js';
import { SettingsManager } from './js/config/settings.js';

// Initialisation
const generator = new PasswordGenerator();
const dictManager = new DictionaryManager();
const settings = new SettingsManager();
```

### Via script global

```html
<!-- Chargement dans le HTML -->
<script type="module">
  import './js/app.js';
  
  // L'API est disponible globalement
  const generator = new window.GenPwdPro.Generator();
</script>
```

### Initialisation personnalisée

```javascript
// Configuration personnalisée
const config = {
  defaultMode: 'passphrase',
  defaultLength: 6,
  defaultDictionary: 'english',
  autoLoadDictionaries: true
};

// Initialisation avec config
const app = await GenPwdPro.init(config);
```

## Classes principales

### PasswordGenerator

Classe principale pour la génération de mots de passe.

```javascript
class PasswordGenerator {
  /**
   * Constructeur
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) { }

  /**
   * Génère un mot de passe
   * @param {Object} params - Paramètres de génération
   * @returns {Promise<GeneratorResult>}
   */
  async generate(params) { }

  /**
   * Génère plusieurs mots de passe
   * @param {Object} params - Paramètres
   * @param {number} count - Nombre de mots de passe
   * @returns {Promise<GeneratorResult[]>}
   */
  async generateBatch(params, count) { }

  /**
   * Valide les paramètres de génération
   * @param {Object} params - Paramètres à valider
   * @returns {ValidationResult}
   */
  validateParams(params) { }
}
```

#### Paramètres de génération

```javascript
interface GenerationParams {
  mode: 'syllables' | 'passphrase' | 'leet';
  length: number;              // 3-10 pour syllables, 3-8 pour passphrase
  charsets?: {
    uppercase?: boolean;
    lowercase?: boolean;
    digits?: boolean;
    special?: boolean;
    customSpecial?: string;
  };
  placement?: {
    strategy: 'start' | 'middle' | 'end' | 'random' | 'custom';
    position?: number;        // 0-100 pour custom
  };
  blocks?: string;           // Pattern U/T/L, ex: "U-T-L"
  dictionary?: string;       // 'french' | 'english' | 'latin'
  separator?: string;        // Pour passphrase : '-', '_', '.', ' '
  leetLevel?: number;        // 0-100, pourcentage de transformation
}
```

#### Résultat de génération

```javascript
interface GeneratorResult {
  password: string;
  entropy: number;
  strength: 'weak' | 'fair' | 'good' | 'excellent' | 'maximum';
  metadata: {
    mode: string;
    length: number;
    charSpace: number;
    timestamp: Date;
    generationTime: number;  // en ms
  };
  analysis: {
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasDigits: boolean;
    hasSpecial: boolean;
    isPronounceable: boolean;
  };
}
```

### DictionaryManager

Gestionnaire des dictionnaires multilingues.

```javascript
class DictionaryManager {
  /**
   * Charge un dictionnaire
   * @param {string} language - Code langue
   * @returns {Promise<Dictionary>}
   */
  async loadDictionary(language) { }

  /**
   * Ajoute un dictionnaire personnalisé
   * @param {string} name - Nom du dictionnaire
   * @param {Object} dictionary - Données du dictionnaire
   * @returns {boolean}
   */
  addCustomDictionary(name, dictionary) { }

  /**
   * Obtient des mots aléatoires
   * @param {string} language - Langue
   * @param {number} count - Nombre de mots
   * @returns {string[]}
   */
  getRandomWords(language, count) { }

  /**
   * Liste les dictionnaires disponibles
   * @returns {DictionaryInfo[]}
   */
  listAvailableDictionaries() { }

  /**
   * Vérifie si un dictionnaire est chargé
   * @param {string} language - Code langue
   * @returns {boolean}
   */
  isDictionaryLoaded(language) { }

  /**
   * Décharge un dictionnaire de la mémoire
   * @param {string} language - Code langue
   */
  unloadDictionary(language) { }
}
```

#### Structure Dictionary

```javascript
interface Dictionary {
  language: string;
  words: string[];
  metadata: {
    count: number;
    entropyPerWord: number;
    source: string;
    version: string;
    lastUpdate: Date;
  };
  stats?: {
    averageLength: number;
    minLength: number;
    maxLength: number;
  };
}
```

### SettingsManager

Gestionnaire de configuration et préférences.

```javascript
class SettingsManager {
  /**
   * Obtient une valeur de configuration
   * @param {string} key - Clé de configuration
   * @returns {any}
   */
  get(key) { }

  /**
   * Définit une valeur de configuration
   * @param {string} key - Clé
   * @param {any} value - Valeur
   * @param {boolean} persist - Sauvegarder en localStorage
   */
  set(key, value, persist = true) { }

  /**
   * Réinitialise aux valeurs par défaut
   */
  reset() { }

  /**
   * Exporte la configuration
   * @returns {Object}
   */
  export() { }

  /**
   * Importe une configuration
   * @param {Object} config - Configuration à importer
   */
  import(config) { }

  /**
   * Enregistre un validateur personnalisé
   * @param {string} key - Clé de configuration
   * @param {Function} validator - Fonction de validation
   */
  registerValidator(key, validator) { }
}
```

## API de génération

### Génération simple

```javascript
// Génération basique
const generator = new PasswordGenerator();

// Syllables
const result = await generator.generate({
  mode: 'syllables',
  length: 5
});
console.log(result.password); // "nywOVyQep.OcyBoWEFY8"
console.log(result.entropy);  // 140.0

// Passphrase
const passphrase = await generator.generate({
  mode: 'passphrase',
  length: 4,
  dictionary: 'french',
  separator: '-'
});
console.log(passphrase.password); // "Soleil-Montagne-Rivière-Forêt"

// Leet speak
const leet = await generator.generate({
  mode: 'leet',
  input: 'PASSWORD',
  leetLevel: 80
});
console.log(leet.password); // "P@$$W0RD"
```

### Génération avancée

```javascript
// Configuration complète
const advancedParams = {
  mode: 'syllables',
  length: 6,
  charsets: {
    uppercase: true,
    lowercase: true,
    digits: true,
    special: true,
    customSpecial: '@#$%+=_'
  },
  placement: {
    strategy: 'custom',
    position: 25  // 25% depuis le début
  },
  blocks: 'U-T-L-L-T-U'
};

const result = await generator.generate(advancedParams);
```

### Génération par lot

```javascript
// Générer 10 mots de passe
const passwords = await generator.generateBatch({
  mode: 'passphrase',
  length: 4
}, 10);

passwords.forEach((result, i) => {
  console.log(`${i + 1}: ${result.password} (${result.entropy} bits)`);
});
```

## API des dictionnaires

### Chargement et gestion

```javascript
const dictManager = new DictionaryManager();

// Charger un dictionnaire
await dictManager.loadDictionary('french');

// Vérifier le chargement
if (dictManager.isDictionaryLoaded('french')) {
  // Obtenir des mots aléatoires
  const words = dictManager.getRandomWords('french', 5);
  console.log(words); // ["soleil", "montagne", "rivière", ...]
}

// Lister tous les dictionnaires
const available = dictManager.listAvailableDictionaries();
console.log(available);
// [
//   { code: 'fr', name: 'Français', wordCount: 2429, loaded: true },
//   { code: 'en', name: 'English', wordCount: 3000, loaded: false },
//   { code: 'la', name: 'Latin', wordCount: 1500, loaded: false }
// ]
```

### Dictionnaire personnalisé

```javascript
// Créer un dictionnaire personnalisé
const customDict = {
  language: 'technical',
  words: ['kubernetes', 'docker', 'terraform', 'ansible', 'jenkins'],
  metadata: {
    count: 5,
    entropyPerWord: 2.32,
    source: 'DevOps terms',
    version: '1.0.0',
    lastUpdate: new Date()
  }
};

// Ajouter le dictionnaire
dictManager.addCustomDictionary('technical', customDict);

// Utiliser le dictionnaire personnalisé
const techPassword = await generator.generate({
  mode: 'passphrase',
  dictionary: 'technical',
  length: 3
});
```

## API de configuration

### Gestion des préférences

```javascript
const settings = new SettingsManager();

// Obtenir une valeur
const defaultMode = settings.get('defaultMode'); // 'syllables'

// Définir une valeur
settings.set('defaultMode', 'passphrase');
settings.set('defaultLength', 6);
settings.set('theme', 'dark');

// Définir sans persister
settings.set('tempValue', 'test', false);

// Configuration complète
const fullConfig = settings.export();
console.log(fullConfig);
// {
//   defaultMode: 'passphrase',
//   defaultLength: 6,
//   theme: 'dark',
//   ...
// }

// Importer une configuration
const savedConfig = JSON.parse(localStorage.getItem('userConfig'));
settings.import(savedConfig);

// Réinitialiser
settings.reset();
```

### Validation personnalisée

```javascript
// Enregistrer un validateur
settings.registerValidator('customLength', (value) => {
  return value >= 3 && value <= 20;
});

// Validation automatique lors du set
try {
  settings.set('customLength', 25); // Throws ValidationError
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## API utilitaires

### Calcul d'entropie

```javascript
const calculator = new EntropyCalculator();

// Calcul simple
const entropy = calculator.calculate('MyP@ssw0rd!');
console.log(entropy); // 65.5

// Calcul avec contexte
const contextualEntropy = calculator.calculate('horse-battery-staple', {
  mode: 'passphrase',
  dictionary: { wordCount: 2429 },
  wordCount: 3
});
console.log(contextualEntropy); // 105.1

// Obtenir le niveau de sécurité
const strength = calculator.getStrengthLevel(entropy);
console.log(strength); // 'good'

// Temps de crack estimé
const crackTime = calculator.estimateCrackTime(entropy);
console.log(crackTime); // '2.5 years'
```

### Système de casse

```javascript
const casing = new CasingSystem();

// Appliquer un pattern
const words = ['hello', 'world', 'test'];
const result = casing.applyPattern(words, 'U-T-L');
console.log(result); // ['HELLO', 'World', 'test']

// Parser un pattern
const instructions = casing.parsePattern('U-T-L');
console.log(instructions); 
// [
//   { type: 'UPPER', index: 0 },
//   { type: 'TITLE', index: 1 },
//   { type: 'LOWER', index: 2 }
// ]

// Créer un pattern personnalisé
const custom = casing.createPattern(['upper', 'lower', 'title']);
console.log(custom); // 'U-L-T'
```

### Placement de caractères

```javascript
const placement = new PlacementEngine();

// Placer des caractères spéciaux
const base = 'passwordtest';
const special = ['@', '#', '!'];

// Placement au début
const atStart = placement.placeCharacters(base, special, 'start');
console.log(atStart); // '@#!passwordtest'

// Placement personnalisé
const custom = placement.placeCharacters(base, special, {
  strategy: 'custom',
  position: 50
});
console.log(custom); // 'passwo@#!rdtest'

// Calculer la position
const pos = placement.calculatePosition(25, 12);
console.log(pos); // 3 (25% de 12)
```

## Événements

### Système d'événements

```javascript
// Obtenir le bus d'événements
const eventBus = GenPwdPro.EventBus;

// Écouter un événement
eventBus.on('password.generated', (data) => {
  console.log('Nouveau mot de passe:', data.password);
  console.log('Entropie:', data.entropy);
});

// Écouter une fois
eventBus.once('dictionary.loaded', (data) => {
  console.log('Dictionnaire chargé:', data.language);
});

// Déclencher un événement personnalisé
eventBus.emit('custom.event', { 
  message: 'Hello World' 
});

// Retirer un écouteur
const handler = (data) => console.log(data);
eventBus.on('test.event', handler);
eventBus.off('test.event', handler);
```

### Événements disponibles

| Événement | Description | Payload |
|-----------|-------------|---------|
| `password.generated` | Mot de passe généré | `{ password, entropy, mode }` |
| `password.copied` | Mot de passe copié | `{ success, password }` |
| `dictionary.loaded` | Dictionnaire chargé | `{ language, wordCount }` |
| `dictionary.error` | Erreur chargement | `{ language, error }` |
| `settings.changed` | Configuration modifiée | `{ key, oldValue, newValue }` |
| `settings.reset` | Configuration réinitialisée | `{ }` |
| `test.started` | Tests démarrés | `{ totalTests }` |
| `test.completed` | Test terminé | `{ name, passed, duration }` |
| `test.finished` | Tous tests finis | `{ passed, failed, total }` |

## Hooks et extensions

### Système de hooks

```javascript
// Enregistrer un hook avant génération
GenPwdPro.hooks.register('beforeGenerate', (params) => {
  console.log('Génération avec params:', params);
  
  // Modifier les paramètres
  if (params.mode === 'syllables' && params.length < 5) {
    params.length = 5; // Minimum 5 syllabes
  }
  
  return params; // Retourner les params modifiés
});

// Hook après génération
GenPwdPro.hooks.register('afterGenerate', (result) => {
  // Enrichir le résultat
  result.customScore = calculateCustomScore(result);
  
  // Logger
  console.log(`Generated: ${result.password} (Score: ${result.customScore})`);
  
  return result;
});

// Hook de validation
GenPwdPro.hooks.register('validatePassword', (password) => {
  // Validation personnalisée
  if (password.includes('123')) {
    throw new Error('Sequential numbers not allowed');
  }
  return true;
});
```

### Création d'un plugin

```javascript
class CustomPlugin {
  constructor() {
    this.name = 'CustomPlugin';
    this.version = '1.0.0';
  }

  // Initialisation
  init(api) {
    this.api = api;
    
    // Enregistrer des hooks
    this.registerHooks();
    
    // Ajouter des commandes
    this.registerCommands();
    
    // Étendre l'UI
    this.extendUI();
  }

  registerHooks() {
    this.api.hooks.register('beforeGenerate', this.beforeGenerate.bind(this));
    this.api.hooks.register('afterGenerate', this.afterGenerate.bind(this));
  }

  beforeGenerate(params) {
    // Logique personnalisée avant génération
    console.log(`[${this.name}] Processing params...`);
    return params;
  }

  afterGenerate(result) {
    // Logique personnalisée après génération
    result.pluginProcessed = true;
    return result;
  }

  registerCommands() {
    // Ajouter une commande personnalisée
    this.api.commands.register('custom.generate', async (args) => {
      return await this.customGenerate(args);
    });
  }

  async customGenerate(args) {
    // Génération personnalisée
    const result = await this.api.generator.generate({
      mode: 'syllables',
      length: 7,
      ...args
    });
    
    // Traitement supplémentaire
    result.password = this.transform(result.password);
    
    return result;
  }

  transform(password) {
    // Transformation personnalisée
    return password.replace(/o/g, '0').replace(/i/g, '1');
  }

  extendUI() {
    // Ajouter des éléments à l'interface
    const container = document.querySelector('.plugins-container');
    if (container) {
      const button = document.createElement('button');
      button.textContent = 'Custom Generate';
      button.onclick = () => this.api.commands.execute('custom.generate');
      container.appendChild(button);
    }
  }

  // Désactivation
  destroy() {
    // Nettoyer les hooks
    this.api.hooks.unregister('beforeGenerate', this.beforeGenerate);
    this.api.hooks.unregister('afterGenerate', this.afterGenerate);
    
    // Nettoyer les commandes
    this.api.commands.unregister('custom.generate');
  }
}

// Enregistrer le plugin
GenPwdPro.plugins.register(new CustomPlugin());
```

## Exemples complets

### Exemple 1 : Application simple

```javascript
// Application basique de génération
async function createPasswordApp() {
  // Initialiser l'API
  const api = await GenPwdPro.init({
    autoLoadDictionaries: ['french', 'english']
  });
  
  // Créer le générateur
  const generator = new api.Generator();
  
  // Fonction de génération
  async function generatePassword(mode = 'syllables', length = 5) {
    try {
      const result = await generator.generate({ mode, length });
      
      // Afficher le résultat
      document.getElementById('password').value = result.password;
      document.getElementById('entropy').textContent = `${result.entropy} bits`;
      document.getElementById('strength').className = `strength-${result.strength}`;
      
      // Émettre un événement
      api.EventBus.emit('password.displayed', result);
      
      return result;
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Erreur lors de la génération');
    }
  }
  
  // Attacher aux boutons
  document.getElementById('generate-btn').onclick = () => {
    const mode = document.getElementById('mode').value;
    const length = parseInt(document.getElementById('length').value);
    generatePassword(mode, length);
  };
  
  // Copier le mot de passe
  document.getElementById('copy-btn').onclick = async () => {
    const password = document.getElementById('password').value;
    if (password) {
      await navigator.clipboard.writeText(password);
      api.EventBus.emit('password.copied', { password });
      alert('Mot de passe copié !');
    }
  };
}

// Lancer l'application
document.addEventListener('DOMContentLoaded', createPasswordApp);
```

### Exemple 2 : Intégration dans une application existante

```javascript
// Intégration dans un formulaire d'inscription
class PasswordFieldEnhancer {
  constructor(fieldSelector) {
    this.field = document.querySelector(fieldSelector);
    this.generator = new GenPwdPro.Generator();
    this.init();
  }

  init() {
    // Créer le bouton de génération
    const generateBtn = document.createElement('button');
    generateBtn.textContent = '🔐 Générer';
    generateBtn.type = 'button';
    generateBtn.className = 'pwd-generate-btn';
    
    // Créer l'indicateur de force
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'pwd-strength';
    
    // Insérer les éléments
    this.field.parentNode.insertBefore(generateBtn, this.field.nextSibling);
    this.field.parentNode.insertBefore(strengthIndicator, generateBtn.nextSibling);
    
    // Attacher les événements
    generateBtn.onclick = () => this.generatePassword();
    this.field.oninput = () => this.checkStrength();
  }

  async generatePassword() {
    try {
      const result = await this.generator.generate({
        mode: 'passphrase',
        length: 4,
        separator: '-',
        blocks: 'T-T-T-T'
      });
      
      this.field.value = result.password;
      this.updateStrengthIndicator(result.entropy);
      
      // Déclencher l'événement input
      this.field.dispatchEvent(new Event('input'));
      
    } catch (error) {
      console.error('Failed to generate password:', error);
    }
  }

  async checkStrength() {
    const password = this.field.value;
    if (!password) return;
    
    const calculator = new GenPwdPro.EntropyCalculator();
    const entropy = calculator.calculate(password);
    this.updateStrengthIndicator(entropy);
  }

  updateStrengthIndicator(entropy) {
    const indicator = this.field.parentNode.querySelector('.pwd-strength');
    
    let strength, color, text;
    if (entropy < 30) {
      strength = 'weak';
      color = 'red';
      text = 'Faible';
    } else if (entropy < 50) {
      strength = 'fair';
      color = 'orange';
      text = 'Moyen';
    } else if (entropy < 80) {
      strength = 'good';
      color = 'yellow';
      text = 'Bon';
    } else if (entropy < 100) {
      strength = 'excellent';
      color = 'lightgreen';
      text = 'Excellent';
    } else {
      strength = 'maximum';
      color = 'green';
      text = 'Maximum';
    }
    
    indicator.innerHTML = `
      <div class="strength-bar strength-${strength}" style="background: ${color};">
        ${text} (${entropy.toFixed(1)} bits)
      </div>
    `;
  }
}

// Utilisation
new PasswordFieldEnhancer('#signup-password');
new PasswordFieldEnhancer('#new-password');
```

### Exemple 3 : Mode batch avec export

```javascript
// Génération en masse pour une équipe
async function generateTeamPasswords() {
  const generator = new GenPwdPro.Generator();
  const team = [
    { name: 'Alice', role: 'admin' },
    { name: 'Bob', role: 'user' },
    { name: 'Charlie', role: 'user' },
    { name: 'Diana', role: 'admin' }
  ];
  
  const passwords = [];
  
  for (const member of team) {
    // Paramètres selon le rôle
    const params = {
      mode: 'passphrase',
      length: member.role === 'admin' ? 5 : 4,
      dictionary: 'french',
      separator: '-'
    };
    
    const result = await generator.generate(params);
    
    passwords.push({
      user: member.name,
      role: member.role,
      password: result.password,
      entropy: result.entropy,
      generated: new Date().toISOString()
    });
  }
  
  // Exporter en JSON
  const blob = new Blob(
    [JSON.stringify(passwords, null, 2)], 
    { type: 'application/json' }
  );
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `team-passwords-${Date.now()}.json`;
  a.click();
  
  // Log sécurisé (sans les mots de passe)
  console.log('Passwords generated for:', passwords.map(p => p.user));
  
  return passwords;
}
```

### Exemple 4 : Plugin de validation d'entreprise

```javascript
// Plugin pour appliquer une politique de mots de passe d'entreprise
class EnterprisePasswordPolicy {
  constructor(policyConfig) {
    this.policy = {
      minLength: policyConfig.minLength || 12,
      requireUppercase: policyConfig.requireUppercase ?? true,
      requireLowercase: policyConfig.requireLowercase ?? true,
      requireDigits: policyConfig.requireDigits ?? true,
      requireSpecial: policyConfig.requireSpecial ?? true,
      forbiddenWords: policyConfig.forbiddenWords || [],
      maxAge: policyConfig.maxAge || 90, // jours
      ...policyConfig
    };
  }

  init(api) {
    this.api = api;
    
    // Intercepter la génération
    api.hooks.register('afterGenerate', this.validatePolicy.bind(this));
    
    // Ajouter une commande de validation
    api.commands.register('policy.validate', this.validatePassword.bind(this));
    
    // Ajouter une commande de génération conforme
    api.commands.register('policy.generate', this.generateCompliant.bind(this));
  }

  validatePolicy(result) {
    const validation = this.validatePassword(result.password);
    
    if (!validation.valid) {
      // Regénérer si non conforme
      console.warn('Password non-compliant, regenerating...');
      return this.regenerateCompliant(result);
    }
    
    result.policyCompliant = true;
    result.policyValidation = validation;
    return result;
  }

  validatePassword(password) {
    const errors = [];
    
    // Vérifier la longueur
    if (password.length < this.policy.minLength) {
      errors.push(`Minimum ${this.policy.minLength} caractères requis`);
    }
    
    // Vérifier les types de caractères
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Au moins une majuscule requise');
    }
    
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Au moins une minuscule requise');
    }
    
    if (this.policy.requireDigits && !/[0-9]/.test(password)) {
      errors.push('Au moins un chiffre requis');
    }
    
    if (this.policy.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Au moins un caractère spécial requis');
    }
    
    // Vérifier les mots interdits
    for (const forbidden of this.policy.forbiddenWords) {
      if (password.toLowerCase().includes(forbidden.toLowerCase())) {
        errors.push(`Mot interdit détecté : ${forbidden}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      policy: this.policy
    };
  }

  async regenerateCompliant(originalResult) {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const newResult = await this.api.generator.generate(originalResult.metadata);
      const validation = this.validatePassword(newResult.password);
      
      if (validation.valid) {
        newResult.policyCompliant = true;
        newResult.policyValidation = validation;
        newResult.regenerated = true;
        newResult.attempts = attempts + 1;
        return newResult;
      }
      
      attempts++;
    }
    
    throw new Error('Unable to generate compliant password after ' + maxAttempts + ' attempts');
  }

  async generateCompliant(params = {}) {
    // Paramètres optimisés pour la conformité
    const compliantParams = {
      mode: 'syllables',
      length: Math.ceil(this.policy.minLength / 3),
      charsets: {
        uppercase: this.policy.requireUppercase,
        lowercase: this.policy.requireLowercase,
        digits: this.policy.requireDigits,
        special: this.policy.requireSpecial
      },
      ...params
    };
    
    return await this.api.generator.generate(compliantParams);
  }
}

// Utilisation
const policy = new EnterprisePasswordPolicy({
  minLength: 14,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecial: true,
  forbiddenWords: ['password', 'company', '2024'],
  maxAge: 60
});

GenPwdPro.plugins.register(policy);
```

## Référence rapide

### Méthodes principales

```javascript
// Génération
generator.generate(params)           // Génère un mot de passe
generator.generateBatch(params, n)   // Génère n mots de passe
generator.validateParams(params)     // Valide les paramètres

// Dictionnaires
dictManager.loadDictionary(lang)     // Charge un dictionnaire
dictManager.getRandomWords(lang, n)  // Obtient n mots aléatoires
dictManager.listAvailableDictionaries() // Liste les dictionnaires

// Configuration
settings.get(key)                    // Obtient une valeur
settings.set(key, value)             // Définit une valeur
settings.reset()                     // Réinitialise

// Utilitaires
calculator.calculate(password)       // Calcule l'entropie
casing.applyPattern(words, pattern) // Applique un pattern de casse
placement.placeCharacters(base, special, strategy) // Place des caractères

// Événements
eventBus.on(event, handler)         // Écoute un événement
eventBus.emit(event, data)          // Émet un événement
eventBus.off(event, handler)        // Retire un écouteur

// Hooks
hooks.register(name, handler)       // Enregistre un hook
hooks.unregister(name, handler)     // Retire un hook

// Plugins
plugins.register(plugin)            // Enregistre un plugin
plugins.unregister(pluginName)      // Retire un plugin
```

### Codes d'erreur

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_MODE` | Mode de génération invalide | Mode non supporté |
| `INVALID_LENGTH` | Longueur invalide | Hors limites min/max |
| `DICT_NOT_FOUND` | Dictionnaire non trouvé | Langue non disponible |
| `DICT_LOAD_ERROR` | Erreur chargement dictionnaire | Problème réseau/fichier |
| `GENERATION_FAILED` | Échec de génération | Erreur interne |
| `VALIDATION_ERROR` | Validation échouée | Paramètres invalides |
| `CLIPBOARD_ERROR` | Erreur clipboard | Copie impossible |

## Support et ressources

- **Documentation complète** : [TECHNICAL.md](./TECHNICAL.md)
- **Guide utilisateur** : [USER-GUIDE.md](./USER-GUIDE.md)
- **Tests** : [/src/tests](./src/tests/)
- **Issues** : [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues)
- **Discussions** : [GitHub Discussions](https://github.com/VBlackJack/genpwd-pro/discussions)

---

<div align="center">
  <b>GenPwd Pro v2.5 - API Documentation</b><br>
  <i>© 2024 - MIT License</i>
</div>
