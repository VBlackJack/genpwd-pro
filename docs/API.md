# API Documentation - GenPwd Pro v2.5

> Interface de programmation basée sur les modules ES6 - Architecture fonctionnelle

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Fonctions de génération](#fonctions-de-génération)
3. [API des dictionnaires](#api-des-dictionnaires)
4. [Gestion des paramètres](#gestion-des-paramètres)
5. [Fonctions utilitaires](#fonctions-utilitaires)
6. [Métriques et performance](#métriques-et-performance)
7. [Exemples d'utilisation](#exemples-dutilisation)

## Vue d'ensemble

GenPwd Pro utilise une **architecture modulaire ES6** avec des fonctions exportées. Il n'y a **pas de classes** - toute l'API est basée sur des fonctions.

### Structure réelle des modules

```javascript
// ✅ Imports réels du projet
import { generateSyllables, generatePassphrase, generateLeet } from './src/js/core/generators.js';
import { getCurrentDictionary, setCurrentDictionary } from './src/js/core/dictionaries.js';
import { readSettings, setResults, getResults, getUIState, setUIState } from './src/js/config/settings.js';
```

### Architecture des fichiers

```
src/js/
├── app.js              # Point d'entrée (classe GenPwdApp)
├── config/
│   ├── constants.js    # CHAR_SETS, DICTIONARY_CONFIG, FALLBACK_DICTIONARY
│   └── settings.js     # readSettings, setResults, getUIState
├── core/
│   ├── generators.js   # generateSyllables, generatePassphrase, generateLeet
│   ├── dictionaries.js # getCurrentDictionary, setCurrentDictionary
│   └── casing.js       # applyCasePattern, applyCase
├── ui/
│   ├── events.js       # copyAllPasswords, bindEventHandlers
│   ├── dom.js          # getElement, updateVisibilityByMode
│   ├── render.js       # renderResults, updateMaskDisplay
│   └── ...
└── utils/
    ├── clipboard.js    # copyToClipboard
    ├── helpers.js      # pick, insertWithPlacement
    └── logger.js       # safeLog
```

## Fonctions de génération

### `generateSyllables(config): GenerationResult`

**Localisation** : `src/js/core/generators.js`

Génère un mot de passe basé sur l'alternance consonnes/voyelles pour une prononciation naturelle.

```javascript
import { generateSyllables } from './src/js/core/generators.js';

const result = generateSyllables({
  length: 5,              // Nombre de syllabes
  policy: 'standard',     // 'standard' | 'standard-layout' | 'alphanumerique'
  digits: 2,              // Nombre de chiffres à ajouter
  specials: 1,            // Nombre de caractères spéciaux
  customSpecials: '',     // Caractères spéciaux personnalisés
  placeDigits: 'fin',     // 'debut' | 'milieu' | 'fin' | 'aleatoire'
  placeSpecials: 'fin',   // Position des caractères spéciaux
  caseMode: 'mixte',      // 'lower' | 'upper' | 'title' | 'mixte'
  useBlocks: false,       // Utiliser le système de blocs
  blockTokens: []         // ['U', 'l', 'T'] pour blocs personnalisés
});

// Résultat :
// {
//   value: "nywOVyQep2@",    // Mot de passe généré
//   entropy: 95.2,          // Entropie calculée
//   mode: 'syllables',      // Mode de génération
//   policy: 'standard'      // Politique utilisée
// }
```

### `generatePassphrase(config): Promise<GenerationResult>`

**Localisation** : `src/js/core/generators.js`

Génère une phrase de passe en combinant des mots du dictionnaire. **Fonction asynchrone**.

```javascript
import { generatePassphrase } from './src/js/core/generators.js';

const result = await generatePassphrase({
  wordCount: 4,           // Nombre de mots (3-8)
  separator: '-',         // Séparateur : '-', '_', '.', ' '
  digits: 1,              // Chiffres à ajouter
  specials: 1,            // Caractères spéciaux
  dictionary: 'french',   // 'french' | 'english' | 'latin'
  caseMode: 'title',      // Casse à appliquer
  useBlocks: false,       // Système de blocs
  blockTokens: [],        // Tokens de blocs
  wordListOverride: null  // Mots personnalisés (optionnel)
});

// Résultat :
// {
//   value: "Forêt-Soleil-Montagne2!",
//   entropy: 78.4,
//   mode: 'passphrase',
//   dictionary: 'french'
// }
```

### `generateLeet(config): GenerationResult`

**Localisation** : `src/js/core/generators.js`

Transforme un mot de base en utilisant le leet speak.

```javascript
import { generateLeet } from './src/js/core/generators.js';

const result = generateLeet({
  baseWord: 'password',   // Mot de base à transformer
  digits: 1,              // Chiffres à ajouter
  specials: 1,            // Caractères spéciaux
  caseMode: 'mixte'       // Casse à appliquer
  // ... autres options de placement
});

// Résultat :
// {
//   value: "p@$$w0rd1!",
//   entropy: 45.2,
//   mode: 'leet'
// }
```

## API des dictionnaires

### `getCurrentDictionary(dictKey?): Promise<string[]>`

**Localisation** : `src/js/core/dictionaries.js`

Charge et retourne les mots du dictionnaire spécifié. Si le dictionnaire n'existe pas, utilise le fallback français intégré.

```javascript
import { getCurrentDictionary } from './src/js/core/dictionaries.js';

// Charger le dictionnaire actuel
const words = await getCurrentDictionary();
console.log(`${words.length} mots chargés`);

// Charger un dictionnaire spécifique
const frenchWords = await getCurrentDictionary('french');
console.log(frenchWords); // ["abri", "acier", "actif", ...]
```

### `setCurrentDictionary(dictKey): void`

**Localisation** : `src/js/core/dictionaries.js`

Définit le dictionnaire actif pour les générations futures.

```javascript
import { setCurrentDictionary } from './src/js/core/dictionaries.js';

setCurrentDictionary('english');  // Change vers anglais
setCurrentDictionary('latin');    // Change vers latin
setCurrentDictionary('french');   // Retour au français
```

### `loadDictionary(dictKey): Promise<string[]>`

**Localisation** : `src/js/core/dictionaries.js`

Charge un dictionnaire depuis un fichier JSON avec mise en cache.

```javascript
import { loadDictionary } from './src/js/core/dictionaries.js';

try {
  const words = await loadDictionary('english');
  console.log(`Dictionnaire anglais : ${words.length} mots`);
} catch (error) {
  console.error('Erreur de chargement:', error.message);
}
```

### Dictionnaires disponibles

Configurés dans `src/js/config/constants.js` :

```javascript
export const DICTIONARY_CONFIG = {
  french: {
    url: './dictionaries/french.json',
    name: 'Français', 
    flag: '🇫🇷',
    expectedCount: 800
  },
  english: {
    url: './dictionaries/english.json',
    name: 'English',
    flag: '🇬🇧', 
    expectedCount: 1000
  },
  latin: {
    url: './dictionaries/latin.json',
    name: 'Latin',
    flag: '🏛️',
    expectedCount: 500
  }
};
```

## Gestion des paramètres

### `readSettings(): SettingsObject`

**Localisation** : `src/js/config/settings.js`

Lit la configuration actuelle depuis l'interface utilisateur.

```javascript
import { readSettings } from './src/js/config/settings.js';

const settings = readSettings();
// Retourne : {
//   mode: 'syllables',
//   length: 5,
//   digits: 2,
//   specials: 1,
//   policy: 'standard',
//   caseMode: 'mixte',
//   // ... autres paramètres de l'UI
// }
```

### Gestion des résultats

```javascript
import { setResults, getResults } from './src/js/config/settings.js';

// Sauvegarder des résultats
setResults([
  { value: 'password1', entropy: 95.2, mode: 'syllables' },
  { value: 'password2', entropy: 78.4, mode: 'passphrase' }
]);

// Récupérer les résultats
const results = getResults();
console.log(`${results.length} mots de passe générés`);
```

### Gestion de l'état UI

```javascript
import { getUIState, setUIState } from './src/js/config/settings.js';

// Lire l'état de l'interface
const debugVisible = getUIState('debugVisible');
const maskPasswords = getUIState('maskPasswords');

// Modifier l'état
setUIState('debugVisible', true);
setUIState('maskPasswords', false);

// Lire tout l'état
const fullUIState = getUIState(); // Sans paramètre
```

## Fonctions utilitaires

### `copyAllPasswords(): Promise<void>`

**Localisation** : `src/js/ui/events.js` (fonction interne accessible)

Copie tous les mots de passe générés dans le presse-papiers.

```javascript
// Fonction disponible via les événements UI, 
// mais peut être appelée indirectement via l'interface
// ou en important le module events si nécessaire

// Usage normal : via le bouton "Copier tout" de l'interface
// Usage programmatique nécessite import du module events
```

### `copyToClipboard(text): Promise<boolean>`

**Localisation** : `src/js/utils/clipboard.js`

Copie du texte dans le presse-papiers avec compatibilité navigateurs.

```javascript
import { copyToClipboard } from './src/js/utils/clipboard.js';

const success = await copyToClipboard('mon-password-secret');
if (success) {
  console.log('Copie réussie');
} else {
  console.log('Échec de la copie');
}
```

### `safeLog(message): void`

**Localisation** : `src/js/utils/logger.js`

Logging sécurisé qui évite d'afficher les mots de passe.

```javascript
import { safeLog } from './src/js/utils/logger.js';

safeLog('Génération démarrée');
safeLog('Paramètres validés');
// Les mots de passe sont automatiquement masqués
```

### Fonctions helpers

```javascript
import { pick, insertWithPlacement } from './src/js/utils/helpers.js';

// Sélection aléatoire dans un tableau
const randomChar = pick(['a', 'b', 'c']);

// Insertion avec placement
const result = insertWithPlacement('password', ['@', '1'], 'fin');
// Result: "password@1"
```

### Gestion de la casse

```javascript
import { applyCasePattern, applyCase } from './src/js/core/casing.js';

// Appliquer un pattern de blocs
const result = applyCasePattern('hello world', ['U', 'l'], {perWord: true});
// Result: "HELLO world"

// Appliquer une casse simple
const titleCase = applyCase('hello world', 'title');
// Result: "Hello World"
```

## Métriques et performance

### Calcul de l'espace de caractères

La fonction `computeCharacterSpace` mentionnée dans l'ancienne API n'existe pas comme export, mais est implémentée inline dans les générateurs :

```javascript
// Implémentation réelle dans generators.js (non exportée)
function calculateCharacterSpace(result) {
  let charSpace = 0;
  if (/[a-z]/.test(result)) charSpace += 26;    // Minuscules
  if (/[A-Z]/.test(result)) charSpace += 26;    // Majuscules  
  if (/[0-9]/.test(result)) charSpace += 10;    // Chiffres
  if (/[^a-zA-Z0-9]/.test(result)) charSpace += 32; // Spéciaux
  return charSpace;
}
```

### Calcul d'entropie

```javascript
// Implémentation réelle dans generators.js (non exportée)
function calculateEntropy(mode, length, charSpace) {
  if (mode === 'passphrase') {
    // Entropie basée sur le dictionnaire
    return Math.log2(Math.pow(2429, wordCount));
  } else {
    // Entropie basée sur l'espace de caractères
    return Math.log2(Math.pow(charSpace, length));
  }
}
```

### Métriques de performance (février 2025)

Tests sur Node.js 20.19 :

- **`npm run lint`** : ~3,5s, 0 avertissement, 0 erreur
- **`npm test`** : 13 scénarios en ~4,2s, 0 échec
- **Génération syllables** : ~0.8ms par mot de passe
- **Génération passphrase** : ~2.1ms (chargement dictionnaire inclus)
- **Copie presse-papiers** : ~15ms en moyenne

## Exemples d'utilisation

### Exemple 1 : Générateur simple

```javascript
// simple-generator.js
import { generateSyllables, generatePassphrase } from './src/js/core/generators.js';
import { setCurrentDictionary } from './src/js/core/dictionaries.js';
import { copyToClipboard } from './src/js/utils/clipboard.js';

class SimplePasswordGenerator {
  async generateAndCopy(type = 'syllables') {
    let result;
    
    if (type === 'syllables') {
      result = generateSyllables({
        length: 6,
        policy: 'standard',
        digits: 2,
        specials: 1,
        caseMode: 'mixte'
      });
    } else if (type === 'passphrase') {
      setCurrentDictionary('french');
      result = await generatePassphrase({
        wordCount: 4,
        separator: '-',
        digits: 1,
        specials: 1,
        caseMode: 'title'
      });
    }
    
    const success = await copyToClipboard(result.value);
    console.log(`Généré: ${result.value}`);
    console.log(`Entropie: ${result.entropy} bits`);
    console.log(`Copié: ${success ? 'Oui' : 'Non'}`);
    
    return result;
  }
}

// Usage
const gen = new SimplePasswordGenerator();
await gen.generateAndCopy('syllables');  // Syllables
await gen.generateAndCopy('passphrase'); // Phrase de passe
```

### Exemple 2 : Configuration avancée

```javascript
// advanced-config.js
import { generateSyllables, generatePassphrase } from './src/js/core/generators.js';
import { readSettings, setUIState } from './src/js/config/settings.js';

function generateWithCurrentSettings() {
  const settings = readSettings();
  
  // Adapter les paramètres UI vers l'API
  const config = {
    length: settings.length || 5,
    policy: settings.policy || 'standard',
    digits: settings.digits || 2,
    specials: settings.specials || 1,
    caseMode: settings.caseMode || 'mixte',
    placeDigits: settings.placeDigits || 'fin',
    placeSpecials: settings.placeSpecials || 'fin'
  };
  
  if (settings.mode === 'syllables') {
    return generateSyllables(config);
  } else if (settings.mode === 'passphrase') {
    return generatePassphrase({
      ...config,
      wordCount: settings.wordCount || 4,
      separator: settings.separator || '-',
      dictionary: settings.dictionary || 'french'
    });
  }
}

// Usage avec l'état UI
setUIState('debugVisible', true);
const result = generateWithCurrentSettings();
console.log('Généré depuis UI:', result.value);
```

### Exemple 3 : Tests et validation

```javascript
// validation-tests.js
import { generateSyllables, generatePassphrase } from './src/js/core/generators.js';
import { getCurrentDictionary } from './src/js/core/dictionaries.js';

async function runValidationTests() {
  console.log('🧪 Tests de validation GenPwd Pro');
  
  // Test 1: Génération syllables
  console.log('\n1. Test génération syllables');
  const syllablesResult = generateSyllables({
    length: 5,
    policy: 'standard',
    digits: 2,
    specials: 1
  });
  
  console.log(`   ✅ Généré: "${syllablesResult.value}"`);
  console.log(`   ✅ Entropie: ${syllablesResult.entropy} bits`);
  console.log(`   ✅ Longueur: ${syllablesResult.value.length} caractères`);
  
  // Test 2: Génération passphrase
  console.log('\n2. Test génération passphrase');
  const passphraseResult = await generatePassphrase({
    wordCount: 3,
    separator: '-',
    digits: 1,
    specials: 1,
    dictionary: 'french'
  });
  
  console.log(`   ✅ Généré: "${passphraseResult.value}"`);
  console.log(`   ✅ Entropie: ${passphraseResult.entropy} bits`);
  console.log(`   ✅ Mode: ${passphraseResult.mode}`);
  
  // Test 3: Chargement dictionnaire
  console.log('\n3. Test chargement dictionnaire');
  const words = await getCurrentDictionary('french');
  console.log(`   ✅ Mots chargés: ${words.length}`);
  console.log(`   ✅ Échantillon: ${words.slice(0, 5).join(', ')}`);
  
  console.log('\n✨ Tous les tests réussis !');
}

// Lancer les tests
runValidationTests().catch(console.error);
```

### Exemple 4 : Intégration formulaire

```javascript
// form-integration.js
import { generatePassphrase } from './src/js/core/generators.js';
import { setCurrentDictionary } from './src/js/core/dictionaries.js';

class FormPasswordEnhancer {
  constructor(formSelector) {
    this.form = document.querySelector(formSelector);
    this.passwordField = this.form.querySelector('input[type="password"]');
    this.init();
  }

  init() {
    // Créer bouton génération
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🔐 Générer mot de passe';
    button.onclick = () => this.generatePassword();
    
    this.passwordField.parentNode.appendChild(button);
    
    // Créer indicateur de force
    this.strengthIndicator = document.createElement('div');
    this.strengthIndicator.className = 'strength-indicator';
    this.passwordField.parentNode.appendChild(this.strengthIndicator);
  }

  async generatePassword() {
    try {
      setCurrentDictionary('french');
      
      const result = await generatePassphrase({
        wordCount: 4,
        separator: '-',
        digits: 1,
        specials: 1,
        caseMode: 'title'
      });
      
      this.passwordField.value = result.value;
      this.updateStrengthIndicator(result.entropy);
      
      // Déclencher l'événement change
      this.passwordField.dispatchEvent(new Event('change'));
      
    } catch (error) {
      console.error('Erreur génération:', error);
      alert('Impossible de générer le mot de passe');
    }
  }

  updateStrengthIndicator(entropy) {
    let strength, color;
    
    if (entropy < 50) {
      strength = 'Faible';
      color = '#ff4444';
    } else if (entropy < 80) {
      strength = 'Moyen';  
      color = '#ffaa00';
    } else {
      strength = 'Fort';
      color = '#00aa44';
    }
    
    this.strengthIndicator.innerHTML = `
      <div style="background: ${color}; padding: 4px 8px; border-radius: 4px; color: white;">
        ${strength} (${entropy.toFixed(1)} bits)
      </div>
    `;
  }
}

// Usage
new FormPasswordEnhancer('#signup-form');
new FormPasswordEnhancer('#password-change-form');
```

## Référence rapide

### Imports essentiels

```javascript
// Génération
import { generateSyllables, generatePassphrase, generateLeet } from './src/js/core/generators.js';

// Dictionnaires
import { getCurrentDictionary, setCurrentDictionary } from './src/js/core/dictionaries.js';

// Configuration
import { readSettings, setResults, getResults, getUIState, setUIState } from './src/js/config/settings.js';

// Utilitaires
import { copyToClipboard } from './src/js/utils/clipboard.js';
import { safeLog } from './src/js/utils/logger.js';
import { pick, insertWithPlacement } from './src/js/utils/helpers.js';
```

### Interface de résultat

```javascript
interface GenerationResult {
  value: string;      // Mot de passe généré
  entropy: number;    // Entropie en bits  
  mode: string;       // 'syllables' | 'passphrase' | 'leet'
  policy?: string;    // Politique pour syllables
  dictionary?: string; // Dictionnaire pour passphrase
}
```

### Constantes importantes

```javascript
// Modes de génération
'syllables'   // Alternance consonnes/voyelles
'passphrase'  // Mots du dictionnaire
'leet'        // Transformation leet speak

// Politiques de caractères  
'standard'           // Tous caractères
'standard-layout'    // Optimisé clavier
'alphanumerique'     // Lettres + chiffres seulement

// Dictionnaires disponibles
'french'   // Français (800 mots)
'english'  // Anglais (1000 mots)  
'latin'    // Latin (500 mots)
```

## Support et ressources

- **Point d'entrée** : `src/js/app.js` (classe GenPwdApp)
- **Documentation technique** : [TECHNICAL.md](./docs/TECHNICAL.md)
- **Tests intégrés** : Interface web → Panel de debug → Lancer tests
- **Serveur développement** : `npm run dev` ou `node tools/dev-server.js`

---

<div align="center">
  <b>GenPwd Pro v2.5 - API Documentation</b><br>
  <i>© 2025 - Apache 2.0 License - Architecture Modulaire ES6</i>
</div>
