# GenPwd Pro v2.5.1 🔐

[![Version](https://img.shields.io/badge/version-2.5.1-blue.svg)](https://github.com/VBlackJack/genpwd-pro)
[![Android CI](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml/badge.svg)](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml)
[![Tests](https://img.shields.io/badge/tests-13%2F13%20passing-success.svg)](./tools/run_tests.js)
[![Entropie](https://img.shields.io/badge/entropy-up%20to%20140%20bits-purple.svg)](./docs/TECHNICAL.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![ES6+](https://img.shields.io/badge/ES6+-modern-orange.svg)](https://www.ecma-international.org/ecma-262/)

> Générateur de mots de passe sécurisés nouvelle génération avec architecture modulaire ES6, tests intégrés et interface moderne.

## ✨ Points forts

- 🎯 **100% de fiabilité** - Suite de 13 tests automatisés validant chaque fonctionnalité
- 🔒 **Haute sécurité** - Jusqu'à 140 bits d'entropie pour une protection maximale
- 🌍 **Multilingue** - Dictionnaires français (2429 mots), anglais et latin
- 🎨 **Interface moderne** - Dark theme, animations fluides, placement visuel interactif
- ⚡ **Performance** - Architecture modulaire ES6 avec chargement dynamique
- 🛠️ **Extensible** - Ajout facile de nouveaux modes et dictionnaires

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
2. Ouvrez le dossier racine et choisissez **Reopen in Container**. L'image construit le SDK Android (cmdline-tools, platform-tools, build-tools 34.0.0, platform 34) automatiquement.
3. Une fois la configuration terminée, exécutez la suite de vérifications :

```bash
cd android
./gradlew lint detekt ktlintCheck testDebugUnitTest
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

- [**Guide utilisateur**](./docs/USER-GUIDE.md) - Utilisation détaillée de toutes les fonctionnalités
- [**Documentation technique**](./docs/TECHNICAL.md) - Architecture, API et extensibilité
- [**Changelog**](./CHANGELOG.md) - Historique des versions et évolutions

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
3. Attendez la fin du script `setup-android-sdk.sh` (lancé automatiquement) qui installe les composants `platform-tools`, `build-tools;34.0.0` et `platforms;android-34`, et génère `android/local.properties`.
4. Les commandes Gradle suivantes sont alors disponibles directement dans le terminal du conteneur :

```bash
cd android
./gradlew lint detekt ktlintCheck testDebugUnitTest
```

### 🔍 Intégration Android

Le module Android applique des contrôles stricts (Lint, ktlint, Detekt et tests JUnit). Exécutez la commande suivante depuis le dossier `android/` avant toute Pull Request :

```bash
./gradlew lint detekt ktlintCheck testDebugUnitTest
```

## 📄 Licence

Apache 2.0 © 2025 Julien Bombled

---

<div align="center">
  <b>GenPwd Pro v2.5.1</b> - Générateur de mots de passe professionnel<br>
  <a href="https://github.com/VBlackJack/genpwd-pro">GitHub</a> •
  <a href="./docs/USER-GUIDE.md">Documentation</a> •
  <a href="https://github.com/VBlackJack/genpwd-pro/issues">Issues</a>
</div>
