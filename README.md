# GenPwd Pro v2.6.0 🔐

[![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)](https://github.com/VBlackJack/genpwd-pro)
[![Android CI](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml/badge.svg)](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml)
[![Tests](https://img.shields.io/badge/tests-17%2F17%20passing-success.svg)](./tools/run_tests.js)
[![Entropie](https://img.shields.io/badge/entropy-up%20to%20140%20bits-purple.svg)](./docs/TECHNICAL.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![ES6+](https://img.shields.io/badge/ES6+-modern-orange.svg)](https://www.ecma-international.org/ecma-262/)
[![CSP](https://img.shields.io/badge/CSP-100%25%20compliant-brightgreen.svg)](./docs/TECHNICAL.md)

> Générateur de mots de passe sécurisés nouvelle génération avec architecture modulaire ES6, internationalisation, presets, historique, tests intégrés et interface moderne personnalisable.

## ✨ Points forts

- 🎯 **100% de fiabilité** - Suite de 17+ tests automatisés validant chaque fonctionnalité
- 🔒 **Haute sécurité** - Jusqu'à 140 bits d'entropie, CSP 100% conforme
- 🌍 **Multilingue complet** - Interface en FR/EN/ES + dictionnaires français (2429 mots), anglais et latin
- 💾 **Gestion de presets** - Sauvegardez et partagez vos configurations favorites
- 📜 **Historique intelligent** - Tracking avec favoris, tags et recherche avancée
- 🎨 **Interface moderne** - 5 thèmes personnalisables, animations fluides, placement visuel interactif
- ⚡ **Performance** - Architecture modulaire ES6 avec outils de benchmarking intégrés
- 📤 **Export multi-format** - TXT, JSON, CSV pour tous vos besoins
- 🛠️ **Extensible** - API complète, monitoring d'erreurs, analytics optionnel, documentation JSDoc exhaustive

## 🆕 Nouvelles Fonctionnalités v2.6.0 (2025-11-06)

### 🌐 Internationalisation (i18n)
Changez la langue de l'interface en temps réel :
- 🇫🇷 **Français** - Langue par défaut
- 🇬🇧 **English** - Interface complète en anglais
- 🇪🇸 **Español** - Interface complète en espagnol

Le sélecteur de langue est accessible directement dans le header avec icônes de drapeaux. La préférence est sauvegardée dans localStorage.

### 💾 Système de Presets
Gérez vos configurations favorites :
- **Sauvegarder** - Enregistrez votre configuration actuelle comme preset
- **Charger** - Restaurez instantanément un preset sauvegardé
- **Gérer** - Modal complet avec liste, recherche, favoris ⭐
- **Export/Import** - Partagez vos presets en JSON
- **Noms personnalisés** - Identifiez facilement vos configurations

```javascript
// API disponible pour développeurs
presetManager.createPreset('Sécurité Max', config, 'Config haute sécurité')
presetManager.getAllPresets()
presetManager.exportPreset(id)
```

### 📜 Historique des Mots de Passe
Suivez vos mots de passe générés avec intelligence :
- **Statistiques** - Total d'entrées, favoris, entropie moyenne
- **Recherche** - Filtrez instantanément dans votre historique
- **Favoris** - Marquez vos mots de passe importants ⭐
- **Tags** - Organisez avec des étiquettes personnalisées
- **Métadonnées** - Mode, entropie, date/heure de création
- **Export** - Sauvegardez votre historique en JSON
- **Contrôle** - Activez/désactivez selon vos besoins

L'historique respecte votre vie privée avec chiffrement local optionnel.

### 📊 Analytics & Monitoring (Optionnel)
Pour les déploiements professionnels :
- **Google Analytics** - Suivi d'usage configurable
- **Plausible** - Alternative privacy-friendly
- **Sentry** - Tracking d'erreurs en production
- **Configuration simple** - Variables d'environnement

```javascript
// Configurez via .env ou directement
SENTRY_DSN=your_sentry_dsn
ANALYTICS_PROVIDER=google|plausible|none
```

### 🔒 Conformité CSP 100%
Toutes les violations de Content Security Policy ont été éliminées :
- ✅ Plus d'inline styles
- ✅ Classes CSS uniquement
- ✅ Sécurité maximale
- ✅ Compatible avec les politiques strictes

### 📤 Export de Mots de Passe
Exportez vos mots de passe générés dans 3 formats :
- **TXT** - Liste simple pour copier-coller
- **JSON** - Données complètes avec métadonnées (entropy, mode, etc.)
- **CSV** - Compatible Excel/Google Sheets

```javascript
// Interface modale élégante avec choix du format
// Fichiers auto-nommés: genpwd-export-2025-11-06T19-30-00.json
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

L'application sera accessible sur http://localhost:3000

## 📦 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement sur http://localhost:3000 |
| `npm run build` | Compile une version optimisée pour production |
| `npm run test` | Exécute la suite de tests automatisés (Node) |
| `npm run test:watch` | Relance les tests en continu via nodemon |
| `npm run test:browser` | Vérifie l'interface via Puppeteer |
| `npm run lint` | Analyse statique ESLint sur src/ et tools/ |

## 🧱 Architecture Modulaire

```
genpwd-pro/
├── src/
│   ├── js/
│   │   ├── core/          # Générateurs, dictionnaires, casing
│   │   ├── ui/            # DOM, événements, modal, features-ui
│   │   ├── utils/         # Helpers, i18n, presets, history, analytics
│   │   ├── config/        # Constantes, settings, sentry
│   │   ├── services/      # Services métier
│   │   └── app.js         # Point d'entrée principal
│   ├── styles/            # CSS modulaire
│   ├── dictionaries/      # Dictionnaires JSON (FR, EN, Latin)
│   └── tests/             # Suite de tests complète
├── tools/                 # Outils de build et dev
└── docs/                  # Documentation complète
```

## 🎯 Utilisation

### Interface Web
1. **Choisissez votre langue** - Cliquez sur le sélecteur dans le header
2. **Sélectionnez le mode** - Syllabes, Passphrase ou Leet
3. **Configurez les paramètres** - Longueur, chiffres, spéciaux, politique
4. **Ajustez la casse** - Pattern personnalisé (U/T/l)
5. **Placement visuel** (optionnel) - Drag & drop pour positionner chiffres/spéciaux
6. **Générez** - Cliquez sur "Générer" ou appuyez sur Entrée
7. **Sauvegardez un preset** - Pour réutiliser cette configuration
8. **Exportez** - TXT, JSON ou CSV selon vos besoins

### API JavaScript

```javascript
// Génération simple
import { generateSyllablePassword } from './src/js/core/generators.js';
const pwd = generateSyllablePassword(20, 2, 2);

// Avec presets
import presetManager from './src/js/utils/preset-manager.js';
const preset = presetManager.createPreset('MonPreset', config);
presetManager.loadPreset(preset.id);

// Avec historique
import historyManager from './src/js/utils/history-manager.js';
historyManager.addEntry(password, metadata);
const history = historyManager.getHistory({ limit: 50 });

// Internationalisation
import { i18n } from './src/js/utils/i18n.js';
await i18n.setLocale('fr');
const text = i18n.t('key');
```

## 📚 Documentation

- **[Guide Utilisateur](./docs/USER-GUIDE.md)** - Guide complet d'utilisation
- **[Guide des Fonctionnalités](./docs/FEATURES_GUIDE.md)** - Détails sur chaque fonctionnalité
- **[Documentation Technique](./docs/TECHNICAL.md)** - Architecture et implémentation
- **[API Documentation](./docs/API.md)** - Référence API complète
- **[Guide de Développement](./docs/DEVELOPMENT.md)** - Pour contribuer au projet
- **[Index Documentation](./docs/INDEX.md)** - Vue d'ensemble de toute la documentation

## 🔒 Sécurité

GenPwd Pro implémente les meilleures pratiques de sécurité :
- ✅ **CSP stricte** - Content Security Policy 100% conforme
- ✅ **Pas de tracking** - Zero telemetry par défaut
- ✅ **localStorage sécurisé** - Chiffrement optionnel
- ✅ **Entropie élevée** - Jusqu'à 140 bits
- ✅ **Code audité** - Revues de sécurité régulières
- ✅ **HTTPS uniquement** - En production

Voir [SECURITY.md](./SECURITY.md) pour plus de détails.

## 📱 Version Android

Une version Android complète est disponible dans le dossier `/android` avec :
- Interface Material Design 3
- Gestion de coffres-forts chiffrés
- Import/Export KeePass
- Cloud sync (Google Drive, Dropbox)
- Biométrie

Voir [android/README.md](./android/README.md) pour plus d'informations.

## 🤝 Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](./CONTRIBUTING.md) pour les guidelines.

1. Fork le projet
2. Créez une branche pour votre feature (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add AmazingFeature'`)
4. Pushez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 License

Ce projet est sous licence Apache 2.0 - voir le fichier [LICENSE](./LICENSE) pour plus de détails.

## 🙏 Remerciements

- Dictionnaire français enrichi avec 2429+ mots
- Architecture inspirée des meilleures pratiques ES6
- Interface utilisateur moderne et accessible
- Communauté open source

## 📞 Support

- 🐛 **Issues** - [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues)
- 📖 **Documentation** - [docs/](./docs/)
- 💬 **Discussions** - [GitHub Discussions](https://github.com/VBlackJack/genpwd-pro/discussions)

---

**Fait avec ❤️ par [Julien Bombled](https://github.com/VBlackJack)**

**GenPwd Pro v2.6.0** - Le générateur de mots de passe nouvelle génération 🚀
