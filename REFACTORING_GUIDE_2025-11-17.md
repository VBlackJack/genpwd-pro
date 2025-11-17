# Guide de Refactorisation - GenPwd Pro
**Date:** 2025-11-17
**Version:** 2.6.0
**Objectif:** Amélioration continue de la qualité, sécurité et maintenabilité

---

## 📊 État Actuel du Projet

### Score Global: **B+ (82/100)**
**Potentiel après refactorisation: A (90+/100)**

### Forces
✅ Architecture modulaire solide
✅ Cryptographie moderne (AES-256-GCM, Tink)
✅ Tests existants avec framework custom
✅ Documentation exhaustive (139+ fichiers)
✅ Multi-plateformes (Web, PWA, Electron, Android, CLI)

### Points d'Amélioration Prioritaires
⚠️ God objects (features-ui.js: 2355 lignes)
⚠️ Couverture de tests insuffisante (24.6% vs objectif 80%)
⚠️ LocalStorage non chiffré pour données sensibles
⚠️ Gestion d'erreurs décentralisée

---

## 🎯 PHASE 1: Refactorisation God Objects (PRIORITÉ ÉLEVÉE)

### 1.1 Découpage de `features-ui.js` (2355 lignes → 6 modules)

**Problème:**
Le fichier `src/js/ui/features-ui.js` contient 6 responsabilités différentes, violant le principe de responsabilité unique (SRP).

**Solution:**
Créer 6 modules spécialisés dans `src/js/ui/features/`:

```
src/js/ui/features/
├── language-selector.js       # Sélection de langue i18n
├── preset-ui.js                # Interface presets
├── history-ui.js               # Interface historique
├── plugins-ui.js               # Interface plugins
├── onboarding-ui.js            # Tour guidé
└── settings-ui.js              # Panneau paramètres
```

**Template pour chaque module:**

```javascript
// src/js/ui/features/preset-ui.js
/*
 * Copyright 2025 Julien Bombled
 * Licensed under the Apache License, Version 2.0
 */

import { safeLog } from '../utils/logger.js';
import presetManager from '../utils/preset-manager.js';
import { showToast } from '../utils/toast.js';

/**
 * PresetUI - Gère l'interface utilisateur des presets
 */
class PresetUI {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize preset UI components
   */
  init() {
    if (this.initialized) return;

    this.renderPresetList();
    this.bindEvents();

    this.initialized = true;
    safeLog('PresetUI initialized');
  }

  /**
   * Render preset list in UI
   */
  renderPresetList() {
    // Logique de rendu
  }

  /**
   * Bind preset-related events
   */
  bindEvents() {
    // Binding événements
  }

  /**
   * Update preset display
   */
  update() {
    // Mise à jour UI
  }
}

export default new PresetUI();
export { PresetUI };
```

**Plan d'action:**
1. Créer le dossier `src/js/ui/features/`
2. Extraire chaque section dans son module respectif
3. Créer un fichier `src/js/ui/features/index.js` qui réexporte tous les modules
4. Mettre à jour `features-ui.js` pour devenir un simple orchestrateur
5. Mettre à jour les imports dans `app.js`
6. Tester que tout fonctionne correctement
7. Supprimer l'ancien code une fois la migration validée

**Bénéfices:**
- ✅ Réduction de la complexité (de 2355 lignes à ~400 lignes par module)
- ✅ Meilleure testabilité (chaque module testable indépendamment)
- ✅ Maintenance facilitée (modifications isolées)
- ✅ Réutilisabilité accrue

---

### 1.2 Refactorisation de `events.js` (844 lignes)

**Problème:**
Mélange logique métier + gestion d'événements.

**Solution:**
Séparer en 3 fichiers:

```
src/js/ui/
├── event-bindings.js          # Pure event binding (addEventListener)
├── event-handlers.js          # Event handlers (fonctions appelées)
└── generation-logic.js        # Logique métier génération
```

**Exemple:**

```javascript
// event-bindings.js - UNIQUEMENT des addEventListener
export function bindGenerationEvents() {
  document.getElementById('btn-generate').addEventListener('click', handleGenerate);
  document.getElementById('btn-copy').addEventListener('click', handleCopy);
  // ...
}

// event-handlers.js - Handlers purs
import { generatePassword } from '../services/password-service.js';

export async function handleGenerate(event) {
  event.preventDefault();
  const config = getConfigFromUI();
  const result = await generatePassword(config);
  renderResult(result);
}

// generation-logic.js - Logique métier pure (testable sans DOM)
export function buildGenerationConfig() {
  // Logique pure sans DOM
}
```

---

### 1.3 Refactorisation de `helpers.js` (584 lignes, 20+ fonctions)

**Problème:**
Fichier fourre-tout avec fonctions non catégorisées.

**Solution:**
Réorganiser par domaine fonctionnel:

```
src/js/utils/
├── string-helpers.js          # pick(), insertWithPlacement(), etc.
├── array-helpers.js           # Array manipulation
├── crypto-helpers.js          # Crypto utilities
├── date-helpers.js            # Date/time formatting
└── url-helpers.js             # URL manipulation
```

**Impact:**
- Import plus précis: `import { pick } from './utils/string-helpers.js'`
- Tree-shaking optimisé (bundle plus petit)
- Tests ciblés par domaine

---

## 🔒 PHASE 2: Sécurité & Validation (PRIORITÉ CRITIQUE)

### 2.1 Chiffrement LocalStorage Sensible

**Problème:**
Données sensibles stockées en clair dans localStorage:
- `sync_device_id` (identifiant unique appareil)
- `sync_salt` (sel cryptographique)
- `pwa-install-dismissed` (timestamp)

**Solution:**
Créer un module `secure-storage.js`:

```javascript
// src/js/utils/secure-storage.js
import { deriveKeyFromContext } from './crypto-helpers.js';

class SecureStorage {
  constructor() {
    this.encryptionKey = null;
  }

  /**
   * Initialize with encryption key derived from browser context
   */
  async init() {
    // Dériver clé depuis contexte navigateur (non persisté)
    const context = navigator.userAgent + navigator.language + window.screen.width;
    this.encryptionKey = await deriveKeyFromContext(context);
  }

  /**
   * Set encrypted item in localStorage
   */
  async setSecure(key, value) {
    const encrypted = await this.encrypt(value);
    localStorage.setItem(`sec_${key}`, encrypted);
  }

  /**
   * Get decrypted item from localStorage
   */
  async getSecure(key) {
    const encrypted = localStorage.getItem(`sec_${key}`);
    if (!encrypted) return null;
    return await this.decrypt(encrypted);
  }

  /**
   * Encrypt data with AES-GCM
   */
  async encrypt(data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encoded
    );

    // Return base64: iv + ciphertext
    return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(ciphertext)));
  }

  /**
   * Decrypt data
   */
  async decrypt(encrypted) {
    const decoded = atob(encrypted);
    const iv = new Uint8Array([...decoded.slice(0, 12)].map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array([...decoded.slice(12)].map(c => c.charCodeAt(0)));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  }
}

export default new SecureStorage();
```

**Migration:**
Remplacer dans `sync-service.js` lignes 379-406:

```javascript
// AVANT
localStorage.setItem('sync_device_id', deviceId);

// APRÈS
import secureStorage from '../utils/secure-storage.js';
await secureStorage.setSecure('sync_device_id', deviceId);
```

---

### 2.2 Content Security Policy Stricte

**Problème:**
Absence de CSP → risque XSS.

**Solution:**
Ajouter dans `src/index.html` (dans `<head>`):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://plausible.io https://analytics.umami.is;
  worker-src 'self';
  manifest-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
">
```

**Notes:**
- `'unsafe-inline'` dans `style-src` uniquement pour `sanitizeHTML()` (à terme, migrer vers classes CSS)
- `connect-src` permet Plausible/Umami analytics
- `frame-ancestors 'none'` empêche clickjacking

---

### 2.3 Validation Stricte Master Password

**✅ DÉJÀ IMPLÉMENTÉ** dans `sync-service.js:61-80`

Nouvelles exigences:
- Minimum 12 caractères (au lieu de 8)
- Au moins 3 types de caractères (lowercase, uppercase, digits, specials)
- Validation automatique avec messages d'erreur clairs

---

## 🧪 PHASE 3: Tests & Coverage (PRIORITÉ ÉLEVÉE)

### 3.1 État Actuel

| Module | Coverage | Target | Écart |
|--------|----------|--------|-------|
| `sync-service.js` | 0% | 80% | -80% |
| `analytics.js` | 0% | 80% | -80% |
| `features-ui.js` | 5% | 80% | -75% |
| `vault/crypto-engine.js` | 45% | 80% | -35% |
| **GLOBAL** | **24.6%** | **80%** | **-55.4%** |

### 3.2 Plan de Tests

**Créer `src/tests/test-sync-service.js`:**

```javascript
// test-sync-service.js
import syncService from '../js/services/sync-service.js';
import { validateMasterPassword } from '../js/utils/validators.js';

export const syncServiceTests = [
  {
    name: 'SyncService - Reject weak password < 12 chars',
    fn: async () => {
      try {
        await syncService.unlock('weak123');
        throw new Error('Should have rejected weak password');
      } catch (error) {
        assert(error.message.includes('at least 12 characters'), 'Correct error message');
      }
    }
  },
  {
    name: 'SyncService - Reject password without complexity',
    fn: async () => {
      try {
        await syncService.unlock('allowercase');
        throw new Error('Should have rejected low complexity password');
      } catch (error) {
        assert(error.message.includes('at least 3 of'), 'Correct complexity error');
      }
    }
  },
  {
    name: 'SyncService - Accept strong password',
    fn: async () => {
      const strongPassword = 'MyStr0ng!Pass123';
      // Note: will fail if no provider configured, but should pass validation
      const result = validateMasterPassword(strongPassword);
      assert(result.valid === true, 'Strong password accepted');
      assert(result.score >= 6, 'High score');
    }
  },
  {
    name: 'SyncService - Encrypt/decrypt round-trip',
    fn: async () => {
      // Setup mock provider
      const mockData = { test: 'data', timestamp: Date.now() };

      await syncService.unlock('TestPassword123!');
      const encrypted = await syncService.encrypt(mockData);
      const decrypted = await syncService.decrypt(encrypted);

      assert(JSON.stringify(decrypted) === JSON.stringify(mockData), 'Data matches after round-trip');

      syncService.lock();
    }
  }
];
```

**Objectif:**
Ajouter 50+ tests nouveaux pour atteindre 80% coverage global.

---

## 📝 PHASE 4: Documentation & Maintenance

### 4.1 Centraliser Error Handling

**Créer `src/js/utils/error-handler.js`:**

```javascript
// error-handler.js - Central error handling
import { logError } from './logger.js';
import { captureException } from '../config/sentry-config.js';
import { showToast } from './toast.js';

export class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CRYPTO_ERROR: 'CRYPTO_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  SYNC_ERROR: 'SYNC_ERROR'
};

export function handleError(error, context = {}) {
  // Log locally
  logError(`[${error.code || 'UNKNOWN'}] ${error.message}`);

  // Report to Sentry (if configured)
  if (typeof captureException === 'function') {
    captureException(error, { ...context, errorCode: error.code });
  }

  // Show user-friendly toast
  const userMessage = getUserFriendlyMessage(error);
  showToast(userMessage, 'error');

  // Return error for further handling
  return error;
}

function getUserFriendlyMessage(error) {
  const messages = {
    [ERROR_CODES.VALIDATION_ERROR]: 'Données invalides. Veuillez vérifier les champs.',
    [ERROR_CODES.CRYPTO_ERROR]: 'Erreur de chiffrement. Vérifiez votre mot de passe.',
    [ERROR_CODES.NETWORK_ERROR]: 'Erreur réseau. Vérifiez votre connexion.',
    [ERROR_CODES.STORAGE_ERROR]: 'Erreur de stockage. Espace disque insuffisant?',
    [ERROR_CODES.SYNC_ERROR]: 'Erreur de synchronisation. Réessayez plus tard.'
  };

  return messages[error.code] || 'Une erreur est survenue. Consultez les logs.';
}
```

**Utilisation:**

```javascript
// Dans sync-service.js
import { handleError, AppError, ERROR_CODES } from '../utils/error-handler.js';

async unlock(masterPassword) {
  try {
    // ... logique existante
  } catch (error) {
    throw handleError(
      new AppError('Failed to unlock sync service', ERROR_CODES.SYNC_ERROR, { masterPassword: '***' }),
      { phase: 'unlock' }
    );
  }
}
```

---

### 4.2 Documentation API Complète

**Créer `docs/API_REFERENCE.md`:**

```markdown
# API Reference - GenPwd Pro v2.6.0

## Core Modules

### Password Generation

#### `generateSyllables(config)`
Génère un mot de passe basé sur des syllabes.

**Parameters:**
- `config.length` (number): Longueur du mot de passe (lettres uniquement, avant ajout chiffres/spéciaux)
- `config.policy` (string): 'standard' | 'standard-layout' | 'alphanumerique' | 'alphanumerique-layout'
- `config.digits` (number): Nombre de chiffres (0-6)
- `config.specials` (number): Nombre de caractères spéciaux (0-6)
- `config.caseMode` (string): 'mixte' | 'minuscule' | 'majuscule' | 'title' | 'blocks'

**Returns:**
```typescript
{
  value: string;        // Le mot de passe généré
  entropy: number;      // Entropie en bits
  mode: 'syllables';
  policy: string;
}
```

**Example:**
```javascript
const result = generateSyllables({
  length: 20,
  policy: 'standard',
  digits: 2,
  specials: 2,
  caseMode: 'mixte'
});
// → { value: 'duNokUpYg!aKuKYMaci5@', entropy: 103.4, ... }
```

[Continuer pour tous les modules...]
```

---

## 🚀 PHASE 5: Optimisations Performance

### 5.1 Memoization pour Générateurs

**Ajouter cache LRU pour dictionnaires:**

```javascript
// Dans dictionaries.js
import LRUCache from '../utils/lru-cache.js';

const dictionaryCache = new LRUCache(5); // Max 5 dictionnaires en cache

export async function getCurrentDictionary(language) {
  const cacheKey = `dict_${language}`;

  if (dictionaryCache.has(cacheKey)) {
    return dictionaryCache.get(cacheKey);
  }

  const dict = await loadDictionary(language);
  dictionaryCache.set(cacheKey, dict);
  return dict;
}
```

---

### 5.2 Lazy Loading pour Plugins

**Modifier `plugin-manager.js`:**

```javascript
// Charger plugins à la demande au lieu d'au démarrage
async loadPlugin(pluginId) {
  if (this.loadedPlugins.has(pluginId)) {
    return this.loadedPlugins.get(pluginId);
  }

  const module = await import(`../plugins/${pluginId}.js`);
  this.loadedPlugins.set(pluginId, module);
  return module;
}
```

---

## 📊 Métriques de Succès

| Métrique | Actuel | Cible | Échéance |
|----------|--------|-------|----------|
| **Test Coverage** | 24.6% | 80% | 3 semaines |
| **Lignes par Fichier (max)** | 2355 | 600 | 2 semaines |
| **God Objects** | 5 | 0 | 2 semaines |
| **Score Global** | B+ (82/100) | A (90+/100) | 4 semaines |
| **Bundle Size** | ? | -20% | 3 semaines |
| **Vulnérabilités Critiques** | 0 ✅ | 0 | Maintenu |

---

## 🗓️ Planning Recommandé

### Semaine 1-2: Refactorisation Architecture
- [ ] Découper `features-ui.js` en 6 modules
- [ ] Refactorer `events.js` en 3 fichiers
- [ ] Réorganiser `helpers.js` par domaine

### Semaine 2-3: Sécurité & Tests
- [ ] Implémenter `secure-storage.js`
- [ ] Ajouter CSP stricte
- [ ] Créer 50+ tests nouveaux
- [ ] Atteindre 60% coverage minimum

### Semaine 3-4: Optimisation & Documentation
- [ ] Centraliser error handling
- [ ] Optimiser lazy loading
- [ ] Compléter API reference
- [ ] Atteindre 80% coverage

### Semaine 4+: Validation & Déploiement
- [ ] Tests manuels complets
- [ ] Audit sécurité final
- [ ] Release v2.7.0 🚀

---

## 📞 Support & Questions

Pour toute question sur ce guide:
1. Consulter les docs existantes dans `/docs`
2. Examiner les exemples de code dans `/src/tests`
3. Référencer les audits précédents dans `/archive/audits_2025`

---

**Généré le:** 2025-11-17
**Auteur:** Équipe d'audit GenPwd Pro
**Licence:** Apache 2.0
