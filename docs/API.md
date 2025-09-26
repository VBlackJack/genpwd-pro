# API Documentation - GenPwd Pro v2.5

> Interface de programmation complète pour l'utilisation et l'extension de GenPwd Pro

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Fonctions techniques principales](#fonctions-techniques-principales)
3. [Classes et API avancée](#classes-et-api-avancée)
4. [API de génération](#api-de-génération)
5. [API des dictionnaires](#api-des-dictionnaires)
6. [Métriques et performance](#métriques-et-performance)
7. [Exemples complets](#exemples-complets)

## Vue d'ensemble

GenPwd Pro expose une API JavaScript moderne basée sur les modules ES6, offrant à la fois une interface fonctionnelle simple et une architecture orientée objet avancée.

### Deux niveaux d'API

```javascript
// ✅ API fonctionnelle (simple, directe)
import { generateSyllables, copyAllPasswords } from './js/core/generators.js';

// ✅ API orientée classes (avancée, extensible) 
import { PasswordGenerator, DictionaryManager } from './js/core/api.js';
```

## Fonctions techniques principales

### `computeCharacterSpace(result: string): number`

**Localisation** : `src/js/core/generators.js` (fonction interne)

Calcule dynamiquement l'espace de caractères réellement mobilisé par un mot de passe généré. La fonction évalue la présence de quatre familles de caractères : minuscules, majuscules, chiffres et caractères spéciaux.

```javascript
// Implémentation actuelle (inline dans les générateurs)
function calculateCharacterSpace(result) {
  const hasLower = /[a-z]/.test(result);
  const hasUpper = /[A-Z]/.test(result);
  const hasDigits = /[0-9]/.test(result);
  const hasSpecials = /[^a-zA-Z0-9]/.test(result);

  return (hasLower ? 26 : 0)
    + (hasUpper ? 26 : 0) 
    + (hasDigits ? 10 : 0)
    + (hasSpecials ? 32 : 0);
}
```

**Usage dans le calcul d'entropie :**
```javascript
const charSpace = calculateCharacterSpace(password);
const entropy = Math.log2(Math.pow(charSpace, password.length));
```

### `copyAllPasswords(): Promise<void>`

**Localisation** : `src/js/ui/events.js`

Agrège l'ensemble des mots de passe présents dans l'état UI et tente une copie unique dans le presse-papiers.

**Processus :**
1. Récupère le tableau courant via `getResults()` et valide sa présence
2. Filtre les entrées falsy, applique `join('\n')` pour produire un bloc multiligne
3. Transmet la chaîne au service `copyToClipboard`
4. Affiche un toast contextualisé et trace l'opération

```javascript
async function copyAllPasswords() {
  const results = getResults();
  if (!results?.length) return;

  const passwords = results
    .map(r => r?.value)
    .filter(Boolean)
    .join('\n');
    
  if (!passwords) return;

  const success = await copyToClipboard(passwords);
  const count = passwords.split('\n').length;

  showToast(
    success
      ? `${count} mot${count > 1 ? 's' : ''} de passe copiés !`
      : 'Impossible de copier les mots de passe',
    success ? 'success' : 'error'
  );

  if (success) {
    safeLog(`Copie groupée: ${count} entrées`);
  }
}
```

## Classes et API avancée

### Architecture orientée objet

```javascript
// Structure principale de l'API avancée
window.GenPwdPro = {
  // Générateurs
  Generator: PasswordGenerator,
  
  // Gestionnaires  
  DictionaryManager: DictionaryManager,
  SettingsManager: SettingsManager,
  
  // Utilitaires
  EntropyCalculator: EntropyCalculator,
  CasingSystem: CasingSystem,
  
  // Version
  version: '2.5.0'
};
```

### PasswordGenerator (Classe)

Encapsule la logique de génération dans une interface orientée objet.

```javascript
class PasswordGenerator {
  /**
   * Génère un mot de passe
   * @param {Object} params - Paramètres de génération
   * @returns {Promise<GeneratorResult>}
   */
  async generate(params) {
    // Délègue aux fonctions existantes avec adaptation
    switch (params.mode) {
      case 'syllables':
        return this.adaptResult(generateSyllables(params));
      case 'passphrase':
        return this.adaptResult(await generatePassphrase(params));
      case 'leet':
        return this.adaptResult(generateLeet(params));
    }
  }

  /**
   * Génère plusieurs mots de passe
   * @param {Object} params - Paramètres
   * @param {number} count - Nombre de mots de passe
   * @returns {Promise<GeneratorResult[]>}
   */
  async generateBatch(params, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generate(params));
    }
    return results;
  }

  /**
   * Adapte le résultat des fonctions vers l'interface classe
   * @private
   */
  adaptResult(funcResult) {
    return {
      password: funcResult.value,
      entropy: funcResult.entropy,
      strength: this.calculateStrength(funcResult.entropy),
      metadata: {
        mode: funcResult.mode,
        timestamp: new Date(),
        generationTime: performance.now()
      },
      analysis: {
        hasUppercase: /[A-Z]/.test(funcResult.value),
        hasLowercase: /[a-z]/.test(funcResult.value),
        hasDigits: /[0-9]/.test(funcResult.value),
        hasSpecial: /[^a-zA-Z0-9]/.test(funcResult.value)
      }
    };
  }

  calculateStrength(entropy) {
    if (entropy < 30) return 'weak';
    if (entropy < 50) return 'fair';
    if (entropy < 80) return 'good';
    if (entropy < 100) return 'excellent';
    return 'maximum';
  }
}
```

### Compatibilité API hybride

```javascript
// Export des deux styles d'API
export {
  // Style fonctionnel (existant)
  generateSyllables,
  generatePassphrase, 
  generateLeet,
  copyAllPasswords,
  
  // Style classe (nouveau)
  PasswordGenerator,
  DictionaryManager,
  SettingsManager
};

// API unifiée
export const GenPwd = {
  // Fonctions directes
  generate: {
    syllables: generateSyllables,
    passphrase: generatePassphrase,
    leet: generateLeet
  },
  
  // Classes
  Generator: PasswordGenerator,
  DictionaryManager,
  
  // Utilitaires
  copyAll: copyAllPasswords
};
```

## API de génération

### Interface GenerationResult

```javascript
interface GenerationResult {
  // Format fonction (existant)
  value: string;          // Mot de passe généré
  entropy: number;        // Entropie calculée
  mode: string;          // Mode de génération

  // Format classe (nouveau)
  password?: string;      // Alias de value
  strength?: string;      // Niveau de sécurité
  metadata?: {
    timestamp: Date;
    generationTime: number;
  };
  analysis?: {
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasDigits: boolean;
    hasSpecial: boolean;
  };
}
```

### Utilisation hybride

```javascript
// Style fonctionnel (simple)
const result1 = generateSyllables({
  length: 5,
  policy: 'standard',
  digits: 2,
  specials: 1
});
console.log(result1.value); // "nywOVyQep2@"

// Style classe (avancé)
const generator = new PasswordGenerator();
const result2 = await generator.generate({
  mode: 'syllables',
  length: 5
});
console.log(result2.password); // "nywOVyQep2@" 
console.log(result2.strength); // "excellent"
```

## API des dictionnaires

### Interface fonctionnelle

```javascript
import { getCurrentDictionary, setCurrentDictionary } from './js/core/dictionaries.js';

// Charger un dictionnaire
const words = await getCurrentDictionary('french');
console.log(`${words.length} mots chargés`); // 2429 mots chargés
```

### Interface classe

```javascript
const dictManager = new DictionaryManager();

// Charger et gérer
await dictManager.loadDictionary('french');
const words = dictManager.getRandomWords('french', 5);
const available = dictManager.listAvailableDictionaries();
```

## Métriques et performance

### Métriques techniques (février 2025)

Tests sur environnement Node.js 20.19 :

- **`npm run lint`** : ~3,5s, 0 avertissement, 0 erreur
- **`npm test`** : 13 scénarios exécutés en ~4,2s, 0 échec
- **Génération syllables** : ~0.8ms par mot de passe
- **Génération passphrase** : ~2.1ms (incluant dictionnaire)
- **Copie presse-papiers** : ~15ms en moyenne
- **Calcul entropie** : ~0.1ms par calcul

### Benchmarks de l'API

```javascript
// Test de performance
console.time('Generation Batch');
const generator = new PasswordGenerator();
const batch = await generator.generateBatch({
  mode: 'syllables',
  length: 6
}, 100);
console.timeEnd('Generation Batch');
// Résultat typique : ~85ms pour 100 mots de passe
```

### Optimisations

- **Cache dictionnaires** : Évite le rechargement
- **Pool de caractères** : Pré-calculé
- **Debouncing UI** : Évite les calculs redondants
- **Lazy loading** : Modules chargés à la demande

## Exemples complets

### Exemple 1 : Migration progressive

```javascript
// app-hybrid.js - Support des deux APIs
import { 
  generateSyllables,  // Ancien style
  PasswordGenerator   // Nouveau style
} from './js/genpwd.js';

class HybridPasswordApp {
  constructor() {
    this.useClassAPI = true; // Flag de migration
    this.generator = this.useClassAPI ? new PasswordGenerator() : null;
  }

  async generatePassword(config) {
    if (this.useClassAPI) {
      // Nouvelle API classe
      return await this.generator.generate({
        mode: 'syllables',
        ...config
      });
    } else {
      // Ancienne API fonction
      return generateSyllables(config);
    }
  }

  // Migration progressive
  enableClassAPI() {
    this.useClassAPI = true;
    this.generator = new PasswordGenerator();
  }

  disableClassAPI() {
    this.useClassAPI = false;
    this.generator = null;
  }
}
```

### Exemple 2 : Wrapper de compatibilité

```javascript
// compatibility-layer.js
class CompatibilityWrapper {
  constructor() {
    this.generator = new PasswordGenerator();
  }

  // Émule l'ancienne API avec la nouvelle
  async generateSyllables(config) {
    const result = await this.generator.generate({
      mode: 'syllables',
      ...config
    });
    
    // Retourne dans l'ancien format
    return {
      value: result.password,
      entropy: result.entropy,
      mode: result.metadata.mode
    };
  }

  // Émule copyAllPasswords avec la classe
  async copyAllPasswords() {
    // Réutilise l'implémentation existante
    return copyAllPasswords();
  }
}

// Usage transparent
const api = new CompatibilityWrapper();
const password = await api.generateSyllables({length: 5}); // Même interface !
```

### Exemple 3 : Tests de régression

```javascript
// regression-tests.js
describe('API Compatibility', () => {
  it('should maintain function API compatibility', async () => {
    const oldResult = generateSyllables({
      length: 5,
      policy: 'standard'
    });
    
    expect(oldResult).toHaveProperty('value');
    expect(oldResult).toHaveProperty('entropy');
    expect(oldResult).toHaveProperty('mode');
  });

  it('should work with new class API', async () => {
    const generator = new PasswordGenerator();
    const newResult = await generator.generate({
      mode: 'syllables',
      length: 5
    });
    
    expect(newResult).toHaveProperty('password');
    expect(newResult).toHaveProperty('entropy');
    expect(newResult).toHaveProperty('metadata');
  });

  it('should produce equivalent results', async () => {
    const config = { length: 5, policy: 'standard' };
    
    const funcResult = generateSyllables(config);
    
    const generator = new PasswordGenerator();
    const classResult = await generator.generate({
      mode: 'syllables',
      ...config
    });
    
    // Même longueur et entropie approximative
    expect(funcResult.value.length).toBeCloseTo(classResult.password.length, 2);
    expect(funcResult.entropy).toBeCloseTo(classResult.entropy, 5);
  });
});
```

## Référence rapide

### Migration API

| Ancien style | Nouveau style | Status |
|-------------|---------------|---------|
| `generateSyllables(config)` | `new PasswordGenerator().generate({mode: 'syllables', ...config})` | ✅ Compatible |
| `copyAllPasswords()` | `copyAllPasswords()` | ✅ Inchangé |
| `getCurrentDictionary(lang)` | `new DictionaryManager().loadDictionary(lang)` | 🔄 Wrapper |

### Codes d'erreur

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_MODE` | Mode de génération invalide | Mode non supporté |
| `INVALID_LENGTH` | Longueur invalide | Hors limites min/max |
| `DICT_NOT_FOUND` | Dictionnaire non trouvé | Langue non disponible |
| `GENERATION_FAILED` | Échec de génération | Erreur interne |

## Support et ressources

- **Documentation technique** : [TECHNICAL.md](./docs/TECHNICAL.md)
- **Guide utilisateur** : [USER-GUIDE.md](./docs/USER-GUIDE.md)
- **Tests** : Interface web → Panel de debug → Lancer tests
- **Migration** : [MIGRATION.md](./docs/MIGRATION.md)

---

<div align="center">
  <b>GenPwd Pro v2.5 - API Documentation</b><br>
  <i>© 2025 - Apache 2.0 License - API Hybride Fonctions + Classes</i>
</div>