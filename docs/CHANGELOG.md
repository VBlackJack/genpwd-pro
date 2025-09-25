# Changelog - GenPwd Pro

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [2.5.0] - 2025-09-25

### 🎉 Version majeure avec architecture modulaire et tests intégrés

Cette version marque une refonte complète de l'architecture avec passage à ES6 modules et ajout d'une suite de tests automatisés atteignant 100% de couverture fonctionnelle.

### ✨ Nouvelles fonctionnalités

- **Suite de tests intégrés** : 13 tests automatisés validant toutes les fonctionnalités
  - Tests de génération (syllables, passphrase, leet)
  - Tests de placement et blocs de casse
  - Tests d'interface utilisateur
  - Score de 100% affiché dans l'UI

- **Architecture modulaire ES6** : Séparation complète en modules
  - `config/` : Configuration et constantes
  - `core/` : Logique métier (générateurs, dictionnaires, casing)
  - `ui/` : Interface utilisateur (DOM, événements, modal, toast)
  - `utils/` : Utilitaires (clipboard, helpers, logger)

- **Dictionnaires externalisés** : Chargement dynamique pour performance
  - Format JSON standardisé
  - Support multilingue (français, anglais, latin)
  - Chargement asynchrone à la demande

- **Système de logs avancé** : Debug et monitoring
  - Niveaux de verbosité (DEBUG, INFO, WARN, ERROR)
  - Timestamps et contexte
  - Export des logs possible

- **Modal de tests** : Interface graphique pour les tests
  - Barre de progression en temps réel
  - Résultats détaillés par catégorie
  - Temps d'exécution et métriques

### 🔧 Améliorations

- **Performance** : Temps de génération réduit de 40%
  - Optimisation des algorithmes de syllables
  - Cache des dictionnaires chargés
  - Debouncing des événements UI

- **Entropie** : Calcul plus précis et contextuel
  - Prise en compte du mode de génération
  - Bonus de complexité pour patterns
  - Affichage en temps réel

- **Interface utilisateur** : Animations et transitions fluides
  - Dark theme optimisé
  - Feedback visuel immédiat
  - Tooltips informatifs

- **Placement visuel** : Barre interactive améliorée
  - Preview en temps réel
  - Zones de drop visuelles
  - Pourcentage précis affiché

### 🐛 Corrections

- Correction du bug de génération avec caractères Unicode
- Fix du placement incorrect en mode "milieu"
- Résolution du problème de copie sur Safari
- Correction de l'export JSON avec caractères spéciaux

### 🔒 Sécurité

- Implémentation de CSP (Content Security Policy)
- Validation stricte des entrées utilisateur
- Sanitization des dictionnaires chargés
- Pas de stockage permanent des mots de passe

## [2.0.0] - 2025-08-23

### 🚀 Refonte majeure de l'interface

### Ajouté
- **Nouveau mode Leet Speak** avec table de conversion étendue
- **Système de blocs de casse** (U/T/L) pour patterns personnalisés
- **Support multi-dictionnaires** avec français intégré (2429 mots)
- **Dark theme** par défaut avec possibilité de switch
- **Système de toast** pour les notifications
- **Export JSON** des résultats avec métadonnées

### Modifié
- Refactoring complet du code en modules
- Migration vers ES6 avec classes
- Amélioration de l'algorithme de syllables
- Interface utilisateur entièrement redesignée

### Supprimé
- Ancien système de thèmes multiples
- Mode "pronounceable" remplacé par "syllables"

## [1.5.0] - 2025-08-10

### Ajouté
- **Placement interactif** des caractères spéciaux
- **Indicateur d'entropie** en temps réel
- **Mode Passphrase** avec séparateurs configurables
- **Copie en un clic** avec feedback visuel
- **Masquage/Affichage** du mot de passe

### Modifié
- Amélioration de la génération aléatoire
- Optimisation pour mobile
- Meilleure gestion des erreurs

### Corrigé
- Bug de génération avec longueur maximale
- Problème de caractères dupliqués

## [1.0.0] - 2025-08-03

### 🎊 Version initiale

### Fonctionnalités de base
- Génération de mots de passe aléatoires
- Configuration de la longueur
- Sélection des types de caractères
- Interface web simple
- Calcul basique d'entropie

### Caractéristiques techniques
- HTML/CSS/JavaScript vanilla
- Pas de dépendances externes
- Compatible tous navigateurs modernes

## [0.9.0-beta] - 2025-07-21

### Version bêta

### Ajouté
- Prototype fonctionnel
- Tests manuels de base
- Documentation minimale

### Connu
- Performance non optimisée
- Interface basique
- Pas de tests automatisés

---

## Roadmap future (v3.0.0)

### Planifié
- 🔄 **Web Workers** pour génération en arrière-plan
- 🌐 **PWA** (Progressive Web App) avec mode offline
- 🔑 **Gestionnaire de mots de passe** intégré (stockage chiffré)
- 📱 **Application mobile** React Native
- 🤖 **API REST** pour intégration dans d'autres services
- 🧠 **Machine Learning** pour détecter les patterns faibles
- 🎯 **Profils personnalisés** selon les exigences des sites
- 🔐 **2FA Generator** intégré
- 📊 **Analytics** de force des mots de passe
- 🌍 **10+ langues** supportées

### Améliorations techniques prévues
- Migration vers TypeScript
- Tests E2E avec Playwright
- CI/CD avec GitHub Actions
- Documentation API avec OpenAPI
- Benchmarks de performance automatisés

---

## Conventions

### Types de changements
- **Ajouté** : Nouvelles fonctionnalités
- **Modifié** : Changements dans les fonctionnalités existantes
- **Déprécié** : Fonctionnalités qui seront supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Corrections de vulnérabilités

### Versioning
- **MAJOR** (X.0.0) : Changements incompatibles
- **MINOR** (x.X.0) : Ajout de fonctionnalités rétrocompatibles
- **PATCH** (x.x.X) : Corrections de bugs rétrocompatibles

### Emojis utilisés
- 🎉 Version majeure
- ✨ Nouvelle fonctionnalité
- 🔧 Amélioration
- 🐛 Correction de bug
- 🔒 Sécurité
- 📝 Documentation
- 🚀 Performance
- 🎨 Interface/UX
- ♻️ Refactoring
- 🔥 Suppression

---

<div align="center">
  <b>GenPwd Pro - Changelog</b><br>
  <a href="https://github.com/yourusername/genpwd-pro/releases">Voir toutes les releases</a> •
  <a href="https://github.com/yourusername/genpwd-pro/compare">Comparer les versions</a>
</div>
