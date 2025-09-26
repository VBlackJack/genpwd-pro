# API Documentation - GenPwd Pro v2.5.1

> Interface de programmation fonctionnelle basée sur les modules ES6

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Imports principaux](#imports-principaux)
3. [Fonctions de génération](#fonctions-de-génération)
4. [API des dictionnaires](#api-des-dictionnaires)
5. [Gestion des paramètres](#gestion-des-paramètres)
6. [Fonctions utilitaires](#fonctions-utilitaires)
7. [Interfaces de données](#interfaces-de-données)
8. [Exemples d'utilisation](#exemples-dutilisation)
9. [Métriques et performance](#métriques-et-performance)
10. [Ressources](#ressources)

## Vue d'ensemble

GenPwd Pro expose une API **100% fonctionnelle**. Chaque module ES6 exporte des fonctions pures ou des helpers spécialisés. Aucune classe personnalisée (`PasswordGenerator`, `DictionaryManager`, etc.) n'existe dans le code source.

### Modules réels

```
src/js/
├── app.js              # Point d'entrée (initialisation GenPwdApp)
├── config/
│   ├── constants.js    # CHAR_SETS, LIMITS, DICTIONARY_CONFIG, ...
│   └── settings.js     # readSettings, setResults, getUIState, ...
├── core/
│   ├── generators.js   # generateSyllables, generatePassphrase, generateLeet
│   ├── dictionaries.js # loadDictionary, getCurrentDictionary, setCurrentDictionary
│   └── casing.js       # applyCasePattern, applyCase, defaultBlocksForMode
├── ui/
│   ├── dom.js          # Initialisation DOM
│   ├── events.js       # Bind des événements UI
│   ├── modal.js        # Gestion de la modale de tests
│   └── render.js       # Rendu des résultats
└── utils/
    ├── clipboard.js    # copyToClipboard
    ├── helpers.js      # pick, insertWithPlacement
    └── logger.js       # safeLog
```

## Imports principaux

```javascript
// Générateurs
import {
  generateSyllables,
  generatePassphrase,
  generateLeet
} from './src/js/core/generators.js';

// Dictionnaires
import {
  loadDictionary,
  getCurrentDictionary,
  setCurrentDictionary
} from './src/js/core/dictionaries.js';

// Paramètres & état
import {
  readSettings,
  setResults,
  getResults,
  getUIState,
  setUIState
} from './src/js/config/settings.js';

// Utilitaires
import { copyToClipboard } from './src/js/utils/clipboard.js';
import { safeLog } from './src/js/utils/logger.js';
import { pick, insertWithPlacement } from './src/js/utils/helpers.js';
import { applyCase, applyCasePattern } from './src/js/core/casing.js';
```

## Fonctions de génération

### `generateSyllables(config): GenerationResult`

**Localisation** : `src/js/core/generators.js`

Génère un mot de passe prononçable basé sur une alternance consonnes/voyelles et options de placement.

```javascript
const result = generateSyllables({
  length: 5,              // Nombre de syllabes (3-10 recommandé)
  policy: 'standard',     // 'standard' | 'standard-layout' | 'alphanumerique'
  digits: 2,              // Nombre de chiffres à ajouter
  specials: 1,            // Nombre de caractères spéciaux
  customSpecials: '',     // Caractères spéciaux personnalisés
  placeDigits: 'fin',     // 'debut' | 'milieu' | 'fin' | 'aleatoire'
  placeSpecials: 'fin',   // Position des caractères spéciaux
  caseMode: 'mixte',      // 'lower' | 'upper' | 'title' | 'mixte' | 'blocks'
  useBlocks: false,       // Activer le système de blocs U/T/L
  blockTokens: []         // Tokens personnalisés si useBlocks = true
});

console.log(result.value);    // Mot de passe généré
console.log(result.entropy);  // Entropie en bits
```

### `generatePassphrase(config): Promise<GenerationResult>`

**Localisation** : `src/js/core/generators.js`

Assemble une phrase de passe à partir des dictionnaires configurés. La fonction est **asynchrone** car elle peut déclencher un chargement de dictionnaire.

```javascript
const passphrase = await generatePassphrase({
  wordCount: 4,           // Nombre de mots (3-8)
  separator: '-',         // Séparateur : '-', '_', '.', ' '
  digits: 1,              // Nombre de chiffres à ajouter
  specials: 1,            // Caractères spéciaux à insérer
  dictionary: 'french',   // 'french' | 'english' | 'latin'
  caseMode: 'title',      // Casse à appliquer
  useBlocks: false,       // Utiliser les blocs U/T/L
  blockTokens: []         // Tokens personnalisés
});

console.log(passphrase.value);   // Exemple : "Forêt-Soleil-Montagne2!"
```

### `generateLeet(config): GenerationResult`

**Localisation** : `src/js/core/generators.js`

Transforme un mot de base en lui appliquant des substitutions *leet speak* et les règles de placement habituelles.

```javascript
const leet = generateLeet({
  baseWord: 'password',   // Mot de base
  digits: 1,              // Nombre de chiffres
  specials: 1,            // Caractères spéciaux
  caseMode: 'mixte',      // Mode de casse
  placeDigits: 'fin',
  placeSpecials: 'debut'
});

console.log(leet.value);  // "@P@55w0rd1!" (exemple)
```

## API des dictionnaires

### `loadDictionary(dictKey): Promise<string[]>`

**Localisation** : `src/js/core/dictionaries.js`

Charge un dictionnaire JSON (défini dans `DICTIONARY_CONFIG`) et met en cache son contenu.

```javascript
const englishWords = await loadDictionary('english');
console.log(englishWords.length); // Nombre de mots chargés
```

### `getCurrentDictionary(dictKey?): Promise<string[]>`

Retourne le dictionnaire actif ou force le chargement d'un dictionnaire particulier. En cas d'erreur, bascule automatiquement sur le fallback français intégré.

```javascript
const words = await getCurrentDictionary();      // Dictionnaire courant
const latin = await getCurrentDictionary('latin'); // Chargement explicite
```

### `setCurrentDictionary(dictKey): void`

Met à jour la clé du dictionnaire actif (persistée en mémoire pour les générations futures).

```javascript
setCurrentDictionary('english');
await generatePassphrase({ dictionary: 'english', wordCount: 5 });
```

## Gestion des paramètres

**Localisation** : `src/js/config/settings.js`

Ces fonctions manipulent l'état interne utilisé par l'interface :

```javascript
const settings = readSettings();   // Lecture depuis le DOM
const results = getResults();      // Résultats générés en mémoire
const uiState = getUIState();      // État complet de l'UI

setResults([{ value: 'abc', entropy: 45, mode: 'syllables' }]);
setUIState('debugVisible', true);
```

Fonctions disponibles :

- `readSettings()` : lit et valide les paramètres saisis dans l'interface
- `setResults(results)` / `getResults()` : stocke ou récupère les derniers mots de passe
- `getUIState(key?)` / `setUIState(key, value)` : manipule l'état UI (masquage, debug, etc.)
- `setSettings(settings)` et `getSettings()` : écriture/lecture directe si vous bypasser l'UI
- `setBlocks(blocks)` / `getBlocks()` : configuration du système de blocs U/T/L

## Fonctions utilitaires

### `copyToClipboard(text): Promise<boolean>`

**Localisation** : `src/js/utils/clipboard.js`

Copie du texte dans le presse-papiers avec gestion des API modernes (`navigator.clipboard`) et des fallbacks DOM.

```javascript
const success = await copyToClipboard('mon-password-secret');
console.log(success ? 'Copie réussie' : 'Échec copie');
```

### `safeLog(message): void`

**Localisation** : `src/js/utils/logger.js`

Logger sécurisé qui masque automatiquement les valeurs sensibles et évite les exceptions dans les environnements sans console.

```javascript
safeLog('Génération démarrée');
safeLog({ action: 'generate', mode: 'passphrase' });
```

### Helpers supplémentaires

```javascript
import { pick, insertWithPlacement } from './src/js/utils/helpers.js';
import { applyCase, applyCasePattern } from './src/js/core/casing.js';

const letter = pick(['a', 'b', 'c']);                // Sélection aléatoire
const padded = insertWithPlacement('abc', ['!'], 'fin'); // "abc!"
const title = applyCase('hello world', 'title');         // "Hello World"
const pattern = applyCasePattern('alpha beta', ['U', 'l']); // "ALPHA beta"
```

## Interfaces de données

### `GenerationResult`

```typescript
interface GenerationResult {
  value: string;        // Mot de passe généré
  entropy: number;      // Entropie (bits)
  mode: 'syllables' | 'passphrase' | 'leet';
  policy?: string;      // Politique appliquée (syllables)
  dictionary?: string;  // Dictionnaire utilisé (passphrase)
}
```

### Constantes utiles

Définies dans `src/js/config/constants.js` :

- `CHAR_SETS` : Jeux de caractères disponibles (standard, standard-layout, alphanumerique)
- `DICTIONARY_CONFIG` : Métadonnées dictionnaires (URL, langue, drapeau)
- `FALLBACK_DICTIONARY` : Dictionnaire français intégré
- `LIMITS` : Contraintes numériques (longueur syllabes, digits max, etc.)

## Exemples d'utilisation

### Génération rapide multi-modes

```javascript
import {
  generateSyllables,
  generatePassphrase,
  generateLeet
} from './src/js/core/generators.js';
import { setCurrentDictionary } from './src/js/core/dictionaries.js';
import { copyToClipboard } from './src/js/utils/clipboard.js';

async function demoGeneration() {
  const syllables = generateSyllables({ length: 6, digits: 2, specials: 1 });
  console.log('Syllables:', syllables.value, `${syllables.entropy.toFixed(1)} bits`);

  setCurrentDictionary('french');
  const passphrase = await generatePassphrase({ wordCount: 4, separator: '-' });
  console.log('Passphrase:', passphrase.value);

  const leet = generateLeet({ baseWord: 'security', specials: 1, digits: 1 });
  console.log('Leet:', leet.value);

  await copyToClipboard(syllables.value);
}
```

### Synchronisation avec l'UI

```javascript
import { readSettings, setResults, getResults } from './src/js/config/settings.js';
import { generateSyllables } from './src/js/core/generators.js';

function syncWithUI() {
  const settings = readSettings();
  const generated = generateSyllables({
    length: settings.specific.length,
    policy: settings.specific.policy,
    digits: settings.digitsNum,
    specials: settings.specialsNum,
    placeDigits: settings.placeDigits,
    placeSpecials: settings.placeSpecials,
    caseMode: settings.caseMode
  });

  setResults([generated]);
  console.log('Résultats UI:', getResults());
}
```

## Métriques et performance

Tests réalisés sur Node.js 20.19 (macOS) :

- `npm run lint` : ~3,5 s — 0 avertissement
- `npm run test` : 13 scénarios fonctionnels en ~4,2 s
- `npm run test:browser` : validations UI headless ~6,5 s
- Génération syllables : ~0,8 ms par mot de passe
- Génération passphrase : ~2,1 ms (chargement dictionnaire inclus)

Les scripts correspondants se trouvent dans `tools/` (build, dev-server, run_tests, etc.).

## Ressources

- [Documentation technique](./TECHNICAL.md)
- [Guide de développement](./DEVELOPMENT.md)
- [Cahier des charges](./CDC-GENPWD-2024-v2.5.md)
- [Guide utilisateur](./USER-GUIDE.md)

---

<div align="center">
  <b>GenPwd Pro v2.5.1 - API Documentation</b><br />
  <i>© 2025 - Apache 2.0 License - Architecture Modulaire ES6</i>
</div>
