# Architecture GenPwd Pro v3.0.0

**Date**: 2026-01-09
**Version**: 3.0.0
**License**: Apache 2.0

---

## Vue d'ensemble

GenPwd Pro est un générateur de mots de passe sécurisé multi-plateforme avec une architecture modulaire ES6. Le projet privilégie la sécurité, la performance et la maintenabilité.

### Plateformes supportées

- **Web/PWA** - Application web progressive avec service worker
- **Electron** - Application desktop (Windows, macOS, Linux)
- **Extensions navigateur** - Chrome & Firefox
- **CLI** - Interface en ligne de commande Node.js
- **Android** - Application mobile native (Kotlin)

---

## Structure des répertoires

```
genpwd-pro/
├── src/                          # Code source principal
│   ├── js/
│   │   ├── core/                 # Logique métier
│   │   │   ├── generators.js     # Générateurs de mots de passe
│   │   │   ├── dictionaries.js   # Gestion des dictionnaires
│   │   │   └── casing.js         # Transformations de casse
│   │   ├── ui/                   # Interface utilisateur
│   │   │   ├── dom.js            # Manipulation DOM
│   │   │   ├── events.js         # Gestionnaires d'événements
│   │   │   ├── render.js         # Rendu UI
│   │   │   └── modal.js          # Système de modales
│   │   ├── services/             # Services externes
│   │   │   ├── password-service.js
│   │   │   ├── hibp-service.js   # Have I Been Pwned
│   │   │   ├── sync-service.js   # Synchronisation cloud
│   │   │   └── import-export-service.js
│   │   ├── vault/                # Système de coffre-fort
│   │   │   ├── crypto-engine.js  # Moteur cryptographique
│   │   │   ├── kdf-service.js    # Dérivation de clés
│   │   │   ├── models.js         # Modèles de données
│   │   │   └── in-memory-repository.js
│   │   ├── utils/                # Utilitaires
│   │   │   ├── helpers.js
│   │   │   ├── logger.js
│   │   │   ├── plugin-manager.js
│   │   │   └── pwa-manager.js
│   │   ├── config/               # Configuration
│   │   │   └── constants.js
│   │   └── app.js                # Point d'entrée
│   ├── dictionaries/             # Dictionnaires de mots
│   ├── styles/                   # CSS modulaire
│   ├── tests/                    # Tests intégrés
│   └── index.html                # Page HTML principale
├── extensions/                   # Extensions navigateur
│   ├── chrome/
│   └── firefox/
├── electron-main.cjs             # Main process Electron
├── electron-preload.cjs          # Preload script Electron
├── cli/                          # Interface CLI
├── android/                      # Application Android
├── tools/                        # Outils de build
└── docs/                         # Documentation

```

---

## Architecture des composants

### 1. Core - Logique métier

#### `generators.js` - Générateurs de mots de passe

**Responsabilité** : Génération de mots de passe selon différents modes

**Modes disponibles** :
- `syllables` : Génération par syllabes (consonnes + voyelles)
- `passphrase` : Phrases de passe avec mots du dictionnaire
- `leet` : Transformation leetspeak
- `blocks` : Génération par blocs personnalisables

**API publique** :
```javascript
async function generateSyllables(config)
async function generatePassphrase(config)
function transformToLeet(word, config)
function calculateEntropy(mode, config, result)
```

**Sécurité** :
- Utilise `crypto.getRandomValues()` pour aléatoire cryptographique
- Validation stricte des entrées
- Protection contre caractères dangereux (CLI-safe)

#### `dictionaries.js` - Gestion des dictionnaires

**Responsabilité** : Chargement et gestion des dictionnaires de mots

**Dictionnaires supportés** :
- Français (2429 mots)
- Anglais (7776 mots)
- Latin (1024 mots)

**Fonctionnalités** :
- Lazy loading avec cache
- Fallback automatique
- Validation des mots

---

### 2. UI - Interface utilisateur

#### Architecture MVC-like

```
User Input → Events → Core Logic → Render → DOM Update
```

**Séparation des responsabilités** :
- `dom.js` : Sélection et manipulation DOM
- `events.js` : Logique événementielle et orchestration
- `render.js` : Rendu des résultats et mise à jour UI
- `modal.js` : Système de modales réutilisables

**Patterns utilisés** :
- Event delegation pour performance
- Debouncing sur inputs utilisateur
- State management centralisé

---

### 3. Services

#### `hibp-service.js` - Vérification Have I Been Pwned

**Implémentation** : k-anonymity protocol
- Envoie seulement les 5 premiers caractères du hash SHA-1
- Cache LRU pour optimiser les requêtes répétées
- Rate limiting intégré (1.5s entre requêtes)

```javascript
async checkPassword(password)
// Returns: { isPwned: boolean, count: number }
```

#### `password-service.js` - Gestion centralisée

Orchestre les différents générateurs et applique les politiques de sécurité.

#### `sync-service.js` - Synchronisation cloud

Supporte plusieurs providers :
- Mock (développement)
- Interface extensible pour futurs providers

---

### 4. Vault - Coffre-fort chiffré

#### Architecture de sécurité

```
User Passphrase
    ↓
KDF (Scrypt) → Master Key (256-bit)
    ↓
Tink AEAD (AES-256-GCM) → Encrypted Vault
```

**Composants** :

1. **`crypto-engine.js`** - Chiffrement/déchiffrement
   - Utilise Tink AEAD (AES-256-GCM)
   - Envelope encryption pour clés

2. **`kdf-service.js`** - Dérivation de clés
   - Scrypt avec paramètres robustes
   - N=16384, r=8, p=1, keyLen=32

3. **`models.js`** - Modèles de données
   - VaultEntry : Entrées individuelles
   - VaultGroup : Organisation en dossiers
   - Méthode `wipe()` pour nettoyage sécurisé

4. **`in-memory-repository.js`** - Stockage RAM
   - Données jamais persistées non chiffrées
   - Timeout de session (5 min par défaut)
   - Nettoyage automatique à la fermeture

**Sécurité** :
- Aucune donnée sensible en clair sur disque
- Session timeout automatique
- Nettoyage mémoire à la destruction
- Protection contre fuites mémoire

---

### 5. Plugin System

**Architecture** : Event-based hooks

**Hooks disponibles** :
- `onGenerate` : Génération custom
- `onExport` : Format d'export custom
- `onImport` : Parser custom
- `onUIRender` : UI personnalisée
- `onPasswordValidate` : Validation custom
- `onPasswordStrength` : Calcul force custom

**Sécurité** :
- ✅ Validation stricte des plugins
- ✅ Whitelist de hooks autorisés
- ✅ Isolation des erreurs
- ✅ Import ES6 modules seulement (pas de eval/Function)
- ✅ Limite de taille (100KB max)

**Exemple de plugin** :
```javascript
export default {
  name: 'my-plugin',
  version: '1.0.0',
  author: 'Author Name',
  description: 'Description',
  hooks: {
    onGenerate: (config) => {
      // Custom generation logic
      return { value: '...', entropy: 128 };
    }
  },
  lifecycle: {
    onLoad: () => console.log('Plugin loaded'),
    onUnload: () => console.log('Plugin unloaded')
  }
};
```

---

## Flux de données

### Génération de mot de passe

```
1. User Input (UI events.js)
   ↓
2. Validation (helpers.js)
   ↓
3. Read Settings (localStorage)
   ↓
4. Core Generation (generators.js)
   ↓
5. HIBP Check (optional, hibp-service.js)
   ↓
6. History Save (history-manager.js)
   ↓
7. Render Results (render.js)
   ↓
8. DOM Update (dom.js)
```

### Stockage sécurisé

```
1. User enters passphrase
   ↓
2. KDF derives key (kdf-service.js)
   ↓
3. Unlock vault (crypto-engine.js)
   ↓
4. Load entries in memory (in-memory-repository.js)
   ↓
5. User interacts with entries
   ↓
6. Save vault (encrypt + write to disk)
   ↓
7. Lock vault (wipe memory)
```

---

## Sécurité

### Principes appliqués

1. **Defense in depth** : Multiples couches de sécurité
2. **Least privilege** : Permissions minimales
3. **Secure by default** : Configuration sécurisée par défaut
4. **Input validation** : Toutes les entrées sont validées
5. **Output encoding** : Sanitisation avec DOMPurify

### Mesures implémentées

#### Cryptographie
- ✅ AES-256-GCM via Tink
- ✅ Scrypt pour KDF (N=16384)
- ✅ crypto.getRandomValues() pour RNG
- ✅ SHA-256 pour hashing

#### Web Security
- ✅ Content Security Policy stricte
- ✅ HTTPS requis en production
- ✅ No inline scripts/styles
- ✅ frame-ancestors 'none'
- ✅ DOMPurify pour HTML sanitization

#### Extensions navigateur
- ✅ activeTab uniquement (pas <all_urls>)
- ✅ Validation origine messages
- ✅ CSP stricte
- ✅ Permissions optionnelles

#### Code Execution
- ✅ Pas de eval() ou new Function()
- ✅ Plugins via ES6 modules uniquement
- ✅ Validation stricte des plugins
- ✅ XML parsing sécurisé (anti-XXE)

---

## Performance

### Optimisations implémentées

1. **Lazy loading** : Dictionnaires chargés à la demande
2. **Caching** : LRU cache pour HIBP, dictionnaires
3. **Debouncing** : Sur inputs utilisateur (200ms)
4. **Event delegation** : Moins de listeners
5. **Service Worker** : Mise en cache des assets

### Métriques cibles

- Time to Interactive : < 1s
- First Contentful Paint : < 0.5s
- Bundle size : < 300KB (compressé)
- Memory usage : < 50MB

---

## Tests

### Stratégie de test

```
src/tests/
├── test-suite.js              # Suite principale
├── test-core.js               # Tests des générateurs
├── test-utils.js              # Tests utilitaires
├── test-services.js           # Tests services
├── test-plugin-manager.js     # Tests plugins
└── test-import-export.js      # Tests import/export
```

**Types de tests** :
- ✅ Tests unitaires (core logic)
- ✅ Tests d'intégration (services)
- ✅ Tests de sécurité (validation, sanitisation)
- ✅ Tests de performance (benchmarks)

**Exécution** :
```bash
npm test              # Tous les tests
npm run test:fast     # Tests rapides seulement
npm run test:slow     # Tests lents seulement
npm run test:coverage # Avec couverture
```

---

## Build et déploiement

### Build process

```javascript
// tools/build.js
1. Clean dist/
2. Copy assets
3. Bundle JavaScript modules
4. Minify CSS
5. Generate manifest
6. Optimize images
```

### Scripts disponibles

```bash
npm run dev           # Serveur de développement
npm run build         # Build production
npm run electron      # Lancer Electron
npm run test          # Lancer tests
npm run lint          # Vérifier code style
```

---

## Electron

### Architecture

- **Main Process** (`electron-main.cjs`) : Gestion fenêtres, menus
- **Renderer Process** : Application web standard
- **Preload Script** (`electron-preload.cjs`) : Bridge sécurisé

### Sécurité Electron

```javascript
{
  nodeIntegration: false,      // Pas de Node.js dans renderer
  contextIsolation: true,      // Isolation des contextes
  sandbox: true,               // Sandbox activé
  webSecurity: true,           // Web security activé
  allowRunningInsecureContent: false
}
```

---

## Extensions navigateur

### Manifest V3 (Chrome) vs V2 (Firefox)

**Chrome** : Service Worker background
**Firefox** : Background scripts classiques

### Communication

```
Content Script ←→ Background Script ←→ Popup
```

**Sécurité** :
- Validation stricte des messages
- Pas de code externe
- Permissions minimales

---

## Roadmap

### Court terme (v2.7)
- [ ] Migration vers Vite/Rollup
- [ ] Tree-shaking automatique
- [ ] Code splitting
- [ ] Compression dictionnaires
- [ ] Tests unitaires >80% couverture

### Moyen terme (v3.0)
- [ ] Support WebAuthn
- [ ] Sync multi-providers (Google Drive, Dropbox)
- [ ] Import/Export chiffré
- [ ] Générateur de passkeys

### Long terme (v4.0)
- [ ] Support multi-utilisateurs
- [ ] Audit trail complet
- [ ] Intégration biométrique
- [ ] Plugin marketplace

---

## Contribution

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines de contribution.

### Code style

- ES6+ modules
- JSDoc pour documentation
- Validation ESLint
- Tests pour nouvelles features

---

## License

Apache License 2.0 - Voir [LICENSE](LICENSE) pour détails.

**Copyright © 2025 Julien Bombled**
