# GenPwd Pro v2.6.0 🔐

[![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)](https://github.com/VBlackJack/genpwd-pro)
[![Android CI](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml/badge.svg)](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml)
[![Web CI](https://github.com/VBlackJack/genpwd-pro/actions/workflows/web-ci.yml/badge.svg)](https://github.com/VBlackJack/genpwd-pro/actions/workflows/web-ci.yml)
[![Tests](https://img.shields.io/badge/tests-45%2B%20passing-success.svg)](./tools/run_tests.js)
[![Entropie](https://img.shields.io/badge/entropy-up%20to%20140%20bits-purple.svg)](./docs/TECHNICAL.md)
[![PWA](https://img.shields.io/badge/PWA-ready-orange.svg)](./src/manifest.json)
[![i18n](https://img.shields.io/badge/i18n-FR%20%7C%20EN%20%7C%20ES-green.svg)](./src/locales/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![ES6+](https://img.shields.io/badge/ES6+-modern-orange.svg)](https://www.ecma-international.org/ecma-262/)
[![Quality](https://img.shields.io/badge/quality-9.7%2F10-brightgreen.svg)](./DOCUMENTATION_AUDIT_2025-11-04.md)

> **Générateur de mots de passe sécurisés enterprise-grade** avec PWA, internationalisation (FR/EN/ES), presets, historique, analytics privacy-friendly et architecture ES6 modulaire.

## ✨ Points forts

- 🎯 **100% de fiabilité** - Suite de 17 tests automatisés validant chaque fonctionnalité
- 🔒 **Haute sécurité** - Jusqu'à 140 bits d'entropie pour une protection maximale
- 🌍 **Multilingue** - Dictionnaires français (2429 mots), anglais et latin
- 🎨 **Interface moderne** - 5 thèmes personnalisables, animations fluides, placement visuel interactif
- ⚡ **Performance** - Architecture modulaire ES6 avec outils de benchmarking intégrés
- 📤 **Export multi-format** - TXT, JSON, CSV pour tous vos besoins
- 🛠️ **Extensible** - API complète, monitoring d'erreurs, documentation JSDoc exhaustive

## 🎉 NOUVEAU - Version 2.6.0 (2025-01-15) - Release Majeure

### Progressive Web App (PWA) 🌐
✨ **GenPwd Pro est maintenant une PWA !**
- 📱 **Installable** sur desktop et mobile (Chrome, Edge, Safari)
- 🔌 **Fonctionne hors ligne** - Génération de mots de passe sans Internet
- ⚡ **Chargement instantané** après première visite (cache intelligent)
- 🔄 **Mises à jour automatiques** avec notifications
- 🏠 **Raccourcis d'application** pour accès rapide

### Internationalisation (i18n) 🌍
- 🇫🇷 **Français** - Traduction complète
- 🇬🇧 **English** - Complete translation
- 🇪🇸 **Español** - Traducción completa
- 🎯 Détection automatique de la langue du navigateur
- 💾 Préférence sauvegardée et persistante
- 🔄 Changement sans rechargement de page

```javascript
// API i18n disponible globalement
window.genpwdi18n.setLocale('en');
window.genpwdi18n.t('app.title'); // "GenPwd Pro"
```

### Gestion de Presets 💾
**Sauvegardez vos configurations préférées !**
- 📋 Créer des presets personnalisés
- 🔍 Rechercher par nom ou description
- 📤 Export/import JSON
- ⭐ Définir preset par défaut
- 🗂️ Gérer plusieurs configurations

```javascript
// API presets
window.genpwdPresets.createPreset('Banking', {
  mode: 'syllables',
  length: 24,
  digits: 3
});
```

### Historique avec Recherche 📜
**Retrouvez vos anciens mots de passe** (opt-in, privacy-first)
- 🔍 Recherche avancée (texte, tags, date)
- ⭐ Favoris et organisation par tags
- 📊 Statistiques détaillées
- 📤 Export/import complet
- ⏰ Auto-expiration configurable
- 🔒 Désactivé par défaut pour la vie privée

```javascript
// API historique
historyManager.updateSettings({ enabled: true });
historyManager.search('important');
historyManager.getStatistics();
```

### Analytics Privacy-Friendly 📊
**Suivez l'usage sans compromettre la vie privée**
- ✅ Sans cookies
- ✅ Conforme RGPD
- ✅ Plausible ou Umami
- ✅ Consentement utilisateur
- ✅ Aucune donnée personnelle

### Monitoring Avancé 🐛
- 🔴 **Sentry** integration pour error tracking
- 📝 Sanitization automatique des données sensibles
- 🍞 Breadcrumbs pour debugging
- 📈 Performance monitoring

### CI/CD Complet 🚀
- ✅ Tests automatiques (Web + Android)
- ✅ Builds multi-plateformes
- ✅ Audits de sécurité automatisés
- ✅ Lighthouse performance audits
- ✅ Workflows GitHub Actions

### Accessibilité ♿
- ✅ **WCAG AA compliant**
- ✅ Labels ARIA complets
- ✅ Navigation clavier
- ✅ Screen reader friendly

**👉 [Documentation complète v2.6.0](./docs/IMPROVEMENTS.md)**

---

## 🆕 Fonctionnalités v2.5.2 (2025-11-04)

### 📤 Export de Mots de Passe
Exportez vos mots de passe générés dans 3 formats :
- **TXT** - Liste simple pour copier-coller
- **JSON** - Données complètes avec métadonnées (entropy, mode, etc.)
- **CSV** - Compatible Excel/Google Sheets

```javascript
// Interface modale élégante avec choix du format
// Fichiers auto-nommés: genpwd-export-2025-11-04T19-30-00.json
```

### 🎨 Système de Thèmes
Choisissez parmi 5 thèmes professionnels :
- 🌙 **Sombre** (défaut) - Confortable pour les yeux
- ☀️ **Clair** - Professionnel pour usage diurne
- ⚫⚪ **Contraste Élevé** - Accessibilité WCAG AAA
- 🌊 **Océan** - Tons bleus apaisants
- 🌲 **Forêt** - Tons verts naturels

Persistance automatique, détection préférences système, API complète.

### 🔍 Monitoring d'Erreurs
- Capture automatique des erreurs JavaScript
- Sanitization des données sensibles
- Support Sentry/LogRocket pour production
- API: `reportError()`, `withErrorHandling()`, `errorStats`

### ⏱️ Outils de Performance
Suite complète de benchmarking pour mesurer les performances :
```javascript
// Mesurer une fonction
const { duration } = await measurePerformance('gen', fn);

// Benchmark complet avec statistiques
const stats = await benchmark('password-gen', fn, 1000);
// → { min, max, mean, median, p95, p99, stdDev }
```

### 📚 Documentation Améliorée
- **JSDoc complet** sur toutes les fonctions principales
- **Guide des fonctionnalités** détaillé ([FEATURES_GUIDE.md](./docs/FEATURES_GUIDE.md))
- **ESLint v9** avec configuration moderne
- **+850 lignes** de documentation ajoutées

**👉 [Guide complet des nouvelles fonctionnalités](./docs/FEATURES_GUIDE.md)**

---

## 🚀 Installation rapide

### Via NPM (recommandé)
```bash
# Cloner le projet
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

## 📦 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement sur http://localhost:3000 |
| `npm run build` | Compile une version optimisée pour production |
| `npm run test` | Exécute la suite de tests automatisés (Node) |
| `npm run test:watch` | Relance les tests en continu via nodemon |
| `npm run test:browser` | Vérifie l'interface via Puppeteer |
| `npm run lint` | Analyse statique ESLint sur src/ et tools/ |

## 🧱 Android build tooling

L'application Android est livrée avec un environnement de développement complet prêt à l'emploi.

### Option 1 — Devcontainer (recommandé)

1. Installez [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers).
2. Ouvrez le dossier racine et choisissez **Reopen in Container**. L'image installe automatiquement le SDK Android (cmdline-tools, platform-tools, build-tools 34.0.0, platforms 35 et 34).
3. Une fois la configuration terminée, ouvrez un terminal **dans le devcontainer** et exécutez les vérifications suivantes :

```bash
cd android
./gradlew :tools:doctor && ./gradlew lint detekt ktlintCheck testDebugUnitTest
```

### Option 2 — Installation locale

Exécutez le script `./.devcontainer/setup-android-sdk.sh` depuis la racine. Il télécharge les composants du SDK avec `sdkmanager` et génère `android/local.properties` avec `sdk.dir=...`.

Un exemple d'exécution GitHub Actions est disponible dans [`docs/ci/android-ci-sample.txt`](docs/ci/android-ci-sample.txt).

## 🎮 Utilisation rapide

### Mode Syllables (recommandé pour mémorisation)
```javascript
// Génère : "nywOVyQep.OcyBoWEFY8KiLuMeRa"
// Entropie : 95.2 bits
// Pattern : Alternance consonnes/voyelles prononcables
```

### Mode Passphrase (mots séparés)
```javascript
// Génère : "Forcer-Vague-Nature-Soleil-Temps-2024"
// Entropie : 78.4 bits
// Utilise le dictionnaire français
```

### Mode Leet Speak (transformation stylisée)
```javascript
// Génère : "P@55W0RD_"
// Remplace : a→@, e→3, o→0, s→5
```

## 🏗️ Architecture

```
src/
├── js/
│   ├── config/     # Configuration et constantes
│   ├── core/       # Logique métier (générateurs, dictionnaires)
│   ├── ui/         # Interface utilisateur (DOM, événements, modal)
│   ├── utils/      # Utilitaires (clipboard, logger)
│   └── app.js      # Point d'entrée
├── styles/         # Styles CSS modulaires
└── tools/          # Scripts build, dev-server, tests
```

### Modules principaux

- **`generators.js`** - Moteurs de génération (syllables, passphrase, leet)
- **`dictionaries.js`** - Gestion multilingue avec chargement dynamique
- **`casing.js`** - Système de blocs U/T/L pour patterns personnalisés
- **`placement.js`** - Positionnement interactif des caractères spéciaux

## 🔬 Tests intégrés

Le projet inclut une suite complète de 13 tests validant :
- Génération par syllables, passphrase et leet speak
- Système de blocs de casse (UPPER/Title/lower)
- Placement précis des caractères spéciaux
- Interface utilisateur (masquage, copie, export)
- Calcul d'entropie et sécurité

```bash
# Lancer les tests
npm run test

# Résultat attendu
📊 RAPPORT FINAL - Score: 100%
✅ Tests réussis: 13 | ❌ Tests échoués: 0
```

## 🛡️ Sécurité

- **CLI-Safe** : Caractères optimisés pour ligne de commande Linux
- **Cross-Layout** : Compatible QWERTY/AZERTY sans ambiguïté
- **Entropie élevée** : Calcul en temps réel de la force cryptographique
- **Pas de stockage** : Génération 100% côté client, aucune donnée transmise

## 📚 Documentation

### Guides Utilisateur
- [**Guide des Fonctionnalités v2.5.2**](./docs/FEATURES_GUIDE.md) ⭐ NOUVEAU - Export, thèmes, monitoring, performance
- [**Guide utilisateur**](./docs/USER-GUIDE.md) - Utilisation détaillée de toutes les fonctionnalités
- [**Changelog**](./CHANGELOG.md) - Historique des versions et évolutions

### Documentation Technique
- [**Documentation technique**](./docs/TECHNICAL.md) - Architecture, API et extensibilité
- [**API Reference**](./docs/API.md) - Référence complète de l'API
- [**Android Architecture**](./docs/ANDROID-ARCHITECTURE.md) - Architecture de l'application Android

### Sécurité & Qualité
- [**Audit de Sécurité 2025-11-04**](./SECURITY_AUDIT_REPORT_2025-11-04.md) - Score 9.5/10
- [**Correctifs Implémentés**](./SECURITY_FIXES_IMPLEMENTED.md) - Vulnérabilités corrigées
- [**Audit Documentation**](./DOCUMENTATION_AUDIT_2025-11-04.md) - État de la documentation

📖 **[Index complet de la documentation](./docs/INDEX.md)**

## 🤝 Contribution

Les contributions sont bienvenues ! Consultez notre guide de contribution pour :
- Ajouter de nouveaux modes de génération
- Créer des dictionnaires personnalisés
- Améliorer l'interface utilisateur
- Optimiser les performances

### 🐳 Environnement de développement (Dev Container)

Un environnement VS Code Dev Container est fourni pour simplifier l'installation du JDK 17 et du SDK Android.

1. Installez l'extension **Dev Containers** dans VS Code.
2. Ouvrez ce dépôt puis exécutez `Dev Containers: Reopen in Container`.
3. Attendez la fin du script `setup-android-sdk.sh` (lancé automatiquement) qui installe `platform-tools`, `build-tools;34.0.0` ainsi que `platforms;android-35` et `platforms;android-34`, puis génère `android/local.properties`.
4. Depuis le terminal du conteneur, exécutez :

```bash
cd android
./gradlew :tools:doctor && ./gradlew lint detekt ktlintCheck testDebugUnitTest
```

### 🔍 Intégration Android

Le module Android applique des contrôles stricts (Lint, ktlint, Detekt et tests JUnit). Exécutez la commande suivante depuis le dossier `android/` avant toute Pull Request :

```bash
./gradlew :tools:doctor && ./gradlew lint detekt ktlintCheck testDebugUnitTest
```

## 📄 Licence

Apache 2.0 © 2025 Julien Bombled

---

<div align="center">
  <b>GenPwd Pro v2.5.2</b> - Générateur de mots de passe professionnel<br>
  <a href="https://github.com/VBlackJack/genpwd-pro">GitHub</a> •
  <a href="./docs/USER-GUIDE.md">Documentation</a> •
  <a href="https://github.com/VBlackJack/genpwd-pro/issues">Issues</a>
</div>
