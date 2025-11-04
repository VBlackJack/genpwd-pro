# 🚀 Guide des Nouvelles Fonctionnalités - GenPwd Pro v2.5.1+

Ce guide présente toutes les nouvelles fonctionnalités ajoutées suite à la revue de code complète.

---

## 📤 Export de Mots de Passe

### Description
Exportez vos mots de passe générés dans différents formats pour une utilisation ultérieure.

### Formats Supportés

#### 1. Format TXT (Simple)
Liste simple de mots de passe, un par ligne.

**Exemple :**
```
DuNoKuPyG!aK5
Pizza-Ideal-Mais-Petale
p@55w0rd42
```

**Utilisation :** Copier-coller rapide, notes, stockage simple

#### 2. Format JSON (Complet)
Données structurées avec toutes les métadonnées.

**Exemple :**
```json
{
  "exported": "2025-11-04T19:30:00.000Z",
  "generator": "GenPwd Pro v2.5.1",
  "count": 3,
  "passwords": [
    {
      "value": "DuNoKuPyG!aK5",
      "mode": "syllables",
      "entropy": 103.4,
      "policy": "standard"
    },
    {
      "value": "Pizza-Ideal-Mais-Petale",
      "mode": "passphrase",
      "entropy": 87.2,
      "dictionary": "french",
      "words": ["Pizza", "Ideal", "Mais", "Petale"]
    }
  ]
}
```

**Utilisation :** Import dans d'autres outils, analyse, backup complet

#### 3. Format CSV (Tableur)
Compatible Excel, Google Sheets, LibreOffice.

**Exemple :**
```csv
"Password","Mode","Entropy (bits)","Length","Details"
"DuNoKuPyG!aK5","syllables","103.4","13","standard"
"Pizza-Ideal","passphrase","65.8","11","Pizza Ideal"
```

**Utilisation :** Analyse dans un tableur, tri, filtrage

### Comment Utiliser

1. Générez des mots de passe
2. Cliquez sur le bouton **"Exporter"** (📤)
3. Choisissez votre format :
   - 📄 **Texte** - Liste simple
   - 📊 **JSON** - Données complètes
   - 📈 **CSV** - Pour Excel
4. Le fichier est téléchargé automatiquement

**Nom du fichier :** `genpwd-export-2025-11-04T19-30-00.{ext}`

### API Programmatique

```javascript
// Accéder à la fonction d'export
import { exportPasswords } from './ui/events.js';

// Déclencher l'export
await exportPasswords();
```

---

## 🎨 Système de Thèmes

### Description
Changez l'apparence de l'interface selon vos préférences.

### Thèmes Disponibles

#### 1. 🌙 Sombre (Dark) - Par défaut
Thème sombre élégant avec accents colorés.
- Fond : #1a1d29
- Confortable pour les yeux en environnement peu éclairé

#### 2. ☀️ Clair (Light)
Thème clair professionnel.
- Fond : #ffffff
- Idéal pour travailler en journée

#### 3. ⚫⚪ Contraste Élevé (High Contrast)
Contraste maximum pour l'accessibilité.
- Noir #000000 / Blanc #ffffff
- Conforme WCAG AAA
- Idéal pour malvoyants

#### 4. 🌊 Océan (Ocean)
Thème bleu inspiré de l'océan.
- Tons bleus apaisants
- Ambiance maritime

#### 5. 🌲 Forêt (Forest)
Thème vert inspiré de la nature.
- Tons verts relaxants
- Ambiance naturelle

### Comment Changer de Thème

#### Méthode 1 : Via l'interface
1. Cherchez le sélecteur "Thème" dans les paramètres
2. Sélectionnez votre thème préféré
3. Le changement est instantané

#### Méthode 2 : Via le code
```javascript
import { applyTheme, getAvailableThemes } from './utils/theme-manager.js';

// Changer de thème
applyTheme('ocean');

// Lister les thèmes disponibles
const themes = getAvailableThemes();
// [
//   { id: 'dark', name: 'Sombre', icon: '🌙' },
//   { id: 'light', name: 'Clair', icon: '☀️' },
//   ...
// ]

// Basculer vers le thème suivant
import { cycleTheme } from './utils/theme-manager.js';
cycleTheme();
```

### Persistance
Votre choix de thème est **automatiquement sauvegardé** dans le navigateur (localStorage).

### Détection Automatique
Si aucun thème n'est choisi, l'application détecte automatiquement votre préférence système :
- `prefers-color-scheme: dark` → Thème Sombre
- `prefers-color-scheme: light` → Thème Clair
- `prefers-contrast: high` → Contraste Élevé

### Créer un Thème Personnalisé

Éditez `src/js/utils/theme-manager.js` :

```javascript
const THEMES = {
  // ... thèmes existants

  'custom': {
    name: 'Mon Thème',
    icon: '🎨',
    variables: {
      '--bg-primary': '#yourcolor',
      '--bg-secondary': '#yourcolor',
      '--text-primary': '#yourcolor',
      // ... autres variables
    }
  }
};
```

---

## 🔍 Système de Monitoring d'Erreurs

### Description
Système centralisé de capture et reporting d'erreurs pour améliorer la stabilité.

### Fonctionnalités

#### Capture Automatique
- ❌ Erreurs JavaScript non gérées
- 🔄 Promesses rejetées (unhandled rejections)
- 📊 Stack traces complets
- 🧹 Sanitization des données sensibles

#### Stockage Local
- 📝 Jusqu'à 50 erreurs en mémoire
- 🕐 Horodatage précis
- 🌍 User Agent et URL

#### Support Services Externes
- 🔌 Compatible Sentry, LogRocket, etc.
- 🔐 API key sécurisée
- 🚫 Désactivé en développement

### API Publique

#### Reporter une Erreur Manuellement
```javascript
import { reportError } from './utils/error-monitoring.js';

try {
  // Code risqué
  riskyOperation();
} catch (error) {
  reportError(error, {
    context: 'user-action',
    userId: 'anonymous',
    feature: 'password-generation'
  });
}
```

#### Wrapper Automatique
```javascript
import { withErrorHandling } from './utils/error-monitoring.js';

const safeFunction = await withErrorHandling(async () => {
  // Code qui peut échouer
  return await complexOperation();
}, { context: 'complex-task' });
```

#### Configuration
```javascript
import { configureMonitoring } from './utils/error-monitoring.js';

configureMonitoring({
  enabled: true,
  endpoint: 'https://sentry.io/api/...',
  apiKey: 'your-sentry-dsn',
  maxErrors: 100
});
```

#### Récupérer les Erreurs
```javascript
import { errorStats, getErrorLog } from './utils/error-monitoring.js';

console.log(errorStats.count);     // Nombre d'erreurs
console.log(errorStats.recent);    // 5 dernières
console.log(errorStats.all);       // Toutes

const allErrors = getErrorLog();
// [
//   {
//     message: 'TypeError: Cannot read...',
//     stack: '...',
//     timestamp: '2025-11-04T...',
//     url: 'https://...'
//   },
//   ...
// ]
```

### Intégration Sentry (Exemple)

```javascript
// Dans app.js ou config
import { configureMonitoring } from './utils/error-monitoring.js';

configureMonitoring({
  enabled: !isDevelopment(),
  endpoint: 'https://o123456.ingest.sentry.io/api/7890/store/',
  apiKey: 'your-sentry-dsn-here'
});
```

---

## ⏱️ Outils de Performance

### Description
Suite d'outils pour mesurer et optimiser les performances de génération.

### Mesurer une Fonction

```javascript
import { measurePerformance } from './utils/performance.js';

const { result, duration } = await measurePerformance('password-gen', () => {
  return generateSyllables({ length: 20, policy: 'standard' });
});

console.log(`Généré en ${duration.toFixed(2)}ms`);
// Output: Généré en 1.23ms
```

### Benchmark Complet

```javascript
import { benchmark } from './utils/performance.js';

const stats = await benchmark('syllables-generation', () => {
  return generateSyllables({ length: 20, policy: 'standard' });
}, 1000); // 1000 itérations

console.log(`Moyenne: ${stats.mean.toFixed(2)}ms`);
console.log(`Médiane: ${stats.median.toFixed(2)}ms`);
console.log(`P95: ${stats.p95.toFixed(2)}ms`);

// Output:
// Moyenne: 1.45ms
// Médiane: 1.38ms
// P95: 2.10ms
```

### Comparer Plusieurs Fonctions

```javascript
import { comparePerformance } from './utils/performance.js';

const results = await comparePerformance({
  'syllables': () => generateSyllables({ length: 20 }),
  'passphrase': () => generatePassphrase({ wordCount: 5 }),
  'leet': () => generateLeet({ baseWord: 'password' })
}, 100);

// Output:
// 🥇 leet: 0.85ms (±0.12ms)
// 🥈 syllables: 1.45ms (±0.18ms)
// 🥉 passphrase: 2.31ms (±0.25ms)
```

### Wrapper Automatique

```javascript
import { withTimer } from './utils/performance.js';

const timedGenerate = withTimer('generate', generateSyllables);
const result = await timedGenerate({ length: 20 });
// Logs automatiquement : ⏱️  generate: 1.23ms
```

### Mesure Mémoire

```javascript
import { measureMemory } from './utils/performance.js';

const memory = measureMemory();
console.log(`Utilisé: ${memory.usedMB}MB / ${memory.limitMB}MB`);
// Output: 💾 Mémoire: 45.23MB / 2048.00MB
```

### Exporter les Résultats

```javascript
import { exportBenchmarkResults } from './utils/performance.js';

const json = exportBenchmarkResults();
console.log(json);

// Output:
// {
//   "exported": "2025-11-04T...",
//   "userAgent": "Mozilla/5.0...",
//   "benchmarks": {
//     "password-gen": {
//       "count": 100,
//       "min": 0.85,
//       "max": 2.45,
//       "mean": 1.32,
//       "results": [...]
//     }
//   }
// }
```

---

## 📚 Documentation JSDoc

### Description
Documentation inline complète pour toutes les fonctions principales.

### Bénéfices
- ✅ Auto-complétion dans VS Code, WebStorm, etc.
- ✅ Types clairs pour chaque paramètre
- ✅ Exemples d'utilisation
- ✅ Description détaillée

### Exemples de Documentation

#### Fonction de Génération
```javascript
/**
 * Génère un mot de passe basé sur des syllabes
 * @param {Object} config - Configuration de génération
 * @param {number} config.length - Longueur (6-64)
 * @param {string} config.policy - 'standard' | 'alphanumerique'
 * @returns {Object} { value, entropy, mode, policy }
 * @example
 * const result = generateSyllables({
 *   length: 20,
 *   policy: 'standard',
 *   digits: 2,
 *   specials: 2
 * });
 * // → { value: 'DuNoK...', entropy: 103.4, ... }
 */
export function generateSyllables(config) { ... }
```

#### Fonction Utilitaire
```javascript
/**
 * Sélectionne un élément aléatoire dans un tableau
 * @param {Array} arr - Tableau source
 * @returns {*} Élément aléatoire
 * @throws {Error} Si tableau vide
 * @example
 * pick(['a', 'b', 'c']) // → 'b'
 */
export function pick(arr) { ... }
```

### Modules Documentés
- ✅ `core/generators.js` - Fonctions de génération
- ✅ `utils/helpers.js` - Fonctions utilitaires
- ✅ `utils/error-monitoring.js` - Monitoring
- ✅ `utils/performance.js` - Benchmarks
- ✅ `utils/theme-manager.js` - Thèmes

---

## 🛠️ Configuration ESLint v9

### Nouveau Format Flat Config

Le projet utilise maintenant `eslint.config.js` (format moderne).

**Fichier :** `eslint.config.js`

### Exécution

```bash
npm run lint
```

### Configuration par Environnement

```javascript
// Pour src/js/ (ES modules navigateur)
{
  files: ['src/js/**/*.js'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: { window, document, ... }
  }
}

// Pour tools/ (Node.js)
{
  files: ['tools/**/*.js'],
  languageOptions: {
    globals: { process, __dirname, ... }
  }
}
```

---

## 📖 Ressources Additionnelles

### Documentation
- [TECHNICAL.md](TECHNICAL.md) - Architecture technique
- [API.md](API.md) - Référence API
- [USER-GUIDE.md](USER-GUIDE.md) - Guide utilisateur

### Code Source
- `src/js/utils/error-monitoring.js` - Monitoring
- `src/js/utils/theme-manager.js` - Thèmes
- `src/js/utils/performance.js` - Performance
- `src/js/ui/events.js` - Export (ligne 410-541)

### Support
- GitHub Issues : https://github.com/VBlackJack/genpwd-pro/issues
- Documentation : https://github.com/VBlackJack/genpwd-pro/docs

---

**Date de création :** 2025-11-04
**Version :** GenPwd Pro v2.5.2+
**Auteur :** Julien Bombled
