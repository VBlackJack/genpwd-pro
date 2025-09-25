# GenPwd Pro v2.5 🔐

[![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)](https://github.com/yourusername/genpwd-pro)
[![Tests](https://img.shields.io/badge/tests-13%2F13%20passing-success.svg)](./src/tests/)
[![Entropie](https://img.shields.io/badge/entropy-up%20to%20140%20bits-purple.svg)](./docs/TECHNICAL.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
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

### Usage direct (sans build)
```bash
# Ouvrir directement dans le navigateur
open src/index.html
# ou
firefox src/index.html
```

## 📦 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement sur http://localhost:3000 |
| `npm run build` | Compile une version optimisée pour production |
| `npm run test` | Execute la suite de tests automatisés |
| `npm run watch` | Surveillance des fichiers avec rechargement automatique |

## 🎮 Utilisation rapide

### Mode Syllables (recommandé pour mémorisation)
```javascript
// Génère : "nywOVyQep.OcyBoWEFY8"
// Entropie : 140 bits
// Pattern : Alternance consonnes/voyelles prononcables
```

### Mode Passphrase (mots séparés)
```javascript
// Génère : "Forcer-Vague-Nature2"
// Entropie : 105 bits
// Utilise le dictionnaire français
```

### Mode Leet Speak (transformation stylisée)
```javascript
// Génère : "P@$$W0RD_"
// Remplace : a→@, e→3, o→0, s→$
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
├── tests/          # Suite de tests intégrés
└── styles/         # Styles CSS modulaires
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

## 📄 Licence

MIT © 2024 Julien Bombled

---

<div align="center">
  <b>GenPwd Pro v2.5</b> - Générateur de mots de passe professionnel<br>
  <a href="https://github.com/yourusername/genpwd-pro">GitHub</a> •
  <a href="./docs/USER-GUIDE.md">Documentation</a> •
  <a href="https://github.com/yourusername/genpwd-pro/issues">Issues</a>
</div>
