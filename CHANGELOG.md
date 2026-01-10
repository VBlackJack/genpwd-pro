# Changelog - GenPwd Pro

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [3.0.2] - 2026-01-10

### 🔒 Security Audit & Infrastructure (BMAD Implementation)

Implementation of all 9 recommendations from the BMAD security audit.

#### Security Infrastructure
- **Electron CVE Monitoring** : Weekly automated workflow to check for Electron vulnerabilities
- **Dependabot** : Automated dependency updates with security grouping
- **SRI Generator** : Tool to generate Subresource Integrity hashes for scripts
- **CSP Nonce Manager** : Infrastructure for nonce-based CSP in Electron
- **Import Fuzzing Tests** : Security fuzzing for CSV/JSON parsers (XSS, injection, prototype pollution)

#### Documentation
- **SECURITY_AUDIT_BMAD.md** : Complete BMAD audit report (9.0/10 score)
- **THREAT_MODEL.md** : STRIDE-based threat model with 10 threat scenarios
- **DEPENDENCY_AUDIT_KDBXWEB.md** : Security audit of kdbxweb dependency

#### Architecture
- **Electron Modularization** : Split electron-main.cjs into separate modules:
  - `clipboard-manager.cjs` : Secure clipboard with auto-clear
  - `security-utils.cjs` : Path validation, rate limiting, secure storage
  - `translations.cjs` : Extracted i18n strings for main process

#### UI Fix
- **Vault Location Selector** : Added missing CSS styles for custom vault storage location

---

## [3.0.1] - 2026-01-09

### ♿ Accessibilité & Polish (BMAD Audit)

Améliorations issues d'une analyse BMAD complète (12 rounds) pour atteindre la conformité WCAG 2.1 Level AA.

#### Accessibilité (a11y)
- **aria-modal** : Ajouté sur tous les dialogues d'alerte
- **aria-controls** : Ajouté sur les toggles (historique mots de passe, templates)
- **aria-checked** : Pattern radio correct pour les options de timeout
- **aria-atomic** : Ajouté sur les messages de validation pour lecture complète
- **aria-label** : Ajouté sur tous les boutons d'icônes (pièces jointes, historique)
- **Focus trap** : Implémenté dans le color picker avec restauration du focus
- **Focus visible** : Amélioration des indicateurs de focus CSS

#### Internationalisation (i18n)
- **Zero hardcoding** : Suppression de toutes les strings hardcodées en fallback
- **Locale dynamique** : Formatage des dates avec `i18n.getLocale()` au lieu de `'en-US'`
- **Nouvelles clés** : `togglePasswordHistory`, `copyHistoryPassword`, `restoreHistoryPassword`
- **Attachments** : `dropLabel`, `browseForAttachments`, `deleteAttachment`, `downloadAttachment`

#### Sécurité
- **XSS prevention** : Messages de validation injectés via `textContent` au lieu de `innerHTML`
- **URL sanitization** : Validation des protocoles dans le parser Markdown
- **Null safety** : Checks ajoutés dans context-menu, confirm-dialog, password-utils

#### Qualité du code
- **Memory leaks** : Cleanup des event listeners dans hello-settings, confirm-dialog, color-picker
- **Debounce** : Ajouté sur la recherche de templates (150ms)
- **Double-click prevention** : Protection contre les clics multiples dans color-picker
- **Event cleanup** : Suppression explicite des listeners avant `remove()` des modales

#### Documentation
- **README.md** : Section raccourcis clavier ajoutée (FR + EN)
- **README.md** : Section accessibilité WCAG 2.1 ajoutée
- **CHANGELOG.md** : Documentation des améliorations BMAD

---

## [3.0.0] - 2025-12-22

### 🎉 Version Majeure : Gestionnaire de Mots de Passe Desktop

Cette version transforme GenPwd Pro d'un simple générateur en un **gestionnaire de mots de passe complet**, rivalisant avec KeePass, Bitwarden et 1Password.

### 🔐 Nouveau Core : Coffre-fort Chiffré

#### Architecture de Sécurité
- **Chiffrement AES-256-GCM** avec dérivation de clé PBKDF2 (100,000 itérations)
- **Format de fichier `.gpdb`** (GenPwd Database) pour persistence locale
- **Sauvegarde atomique** avec backup automatique avant écrasement
- **Session sécurisée** avec verrouillage automatique et timeout configurable

#### Modules de Sécurité (`src/js/vault/`)
- `crypto-service.js` : Chiffrement/déchiffrement AES-GCM
- `key-derivation.js` : Dérivation PBKDF2 avec salt aléatoire
- `session.js` : Gestion de session avec auto-lock
- `models.js` : VaultEntry, VaultGroup avec champs KeePass-compatibles

### 📁 Organisation Avancée

#### Dossiers et Hiérarchie
- **Dossiers imbriqués** avec arborescence visuelle (Tree View)
- **Menu contextuel** : Renommer, couleur, sous-dossiers, supprimer
- **Compteurs récursifs** d'entrées par dossier
- **Navigation par breadcrumb**

#### Tags et Métadonnées
- **Système de tags** avec couleurs personnalisées
- **Champs personnalisés** dynamiques (clé/valeur)
- **Historique des mots de passe** par entrée
- **Métadonnées** : date de création, modification, dernière utilisation, compteur d'usage

#### Types d'Entrées
- **Login** : Username/Password/URL avec favicon
- **Note sécurisée** : Texte chiffré avec rendu Markdown
- **Carte bancaire** : Numéro, expiration, CVV, titulaire
- **Identité** : Nom, prénom, email, téléphone, adresse

### 🛡️ Sécurité Active

#### Protection en Temps Réel
- **Auto-Lock** : Verrouillage après inactivité (1-60 min configurable)
- **Secure Clipboard** : Copie avec nettoyage automatique (30s par défaut)
- **Visual Protection** : Floutage des données sensibles quand fenêtre perd le focus
- **Password History** : Conservation des anciens mots de passe par entrée

#### Audit de Sécurité (`src/js/vault/audit-service.js`)
- **Calcul d'entropie** avec pénalités (patterns, mots communs)
- **Détection des réutilisations** via hash SHA-256
- **Détection des mots de passe faibles** (< 60 bits d'entropie)
- **Détection des anciens mots de passe** (> 1 an sans changement)
- **Score global 0-100** avec recommandations prioritaires

#### TOTP / 2FA (`src/js/vault/totp-service.js`)
- **Générateur TOTP** conforme RFC 6238
- **Support SHA1/SHA256/SHA512**
- **Auto-refresh** avec compte à rebours visuel
- **Parsing/génération d'URI** `otpauth://`
- **QR Code** pour configuration

### 🖥️ Expérience Desktop (Electron)

#### System Tray & Background
- **Icône dans la zone de notification** (près de l'horloge)
- **Menu contextuel** : Afficher, Générer mot de passe, Verrouiller, Quitter
- **Génération rapide** depuis le tray (copie directe + auto-clear 30s)
- **Minimize to Tray** : Fermer la fenêtre ne quitte pas l'application
- **Single Instance** : Relancer l'exe réactive la fenêtre existante

#### Global Hotkey (Boss Key)
- **Raccourci système** : `Ctrl+Shift+P` (Windows/Linux) ou `Cmd+Shift+P` (macOS)
- **Toggle visibilité** depuis n'importe quelle application
- **Accès instantané** au gestionnaire de mots de passe

#### Mode Compact / Overlay
- **Fenêtre flottante** 380x640 pixels
- **Always on Top** pour remplissage facile
- **UI simplifiée** : Recherche + liste uniquement
- **Position automatique** en bas à droite de l'écran

#### Auto-Type (KeePass Killer Feature)
- **Séquence configurable** : `{USERNAME}{TAB}{PASSWORD}{ENTER}`
- **Support des placeholders** : `{DELAY N}`, `{URL}`, `{NOTES}`
- **Minimisation automatique** avant saisie
- **PowerShell SendKeys** sur Windows (pas de dépendances natives)

### 📥 Migration & Import

#### Import KeePass 2.x XML
- **Hiérarchie de groupes** préservée comme dossiers
- **Champs personnalisés** importés
- **Notes et métadonnées** conservées
- **Détection automatique** du format

#### Import Bitwarden JSON
- **Collections** converties en dossiers
- **Tous types d'entrées** supportés
- **URIs multiples** préservées

#### Import CSV Générique
- **Détection intelligente** des colonnes (username, password, url, notes)
- **Preview avant import**
- **Mapping personnalisable**

### 🎨 Interface Utilisateur

#### Security Dashboard
- **Jauge SVG circulaire** avec score coloré
- **Cartes cliquables** filtrant les entrées par problème
- **Recommandations** avec priorités (critique/warning/info)
- **Statistiques** : entrées totales, faibles, réutilisées, anciennes

#### Tree View Sidebar
- **Arborescence de dossiers** avec expand/collapse
- **Drag & Drop** pour réorganisation
- **Filtres rapides** : Tous, Favoris, Récents, par Type

#### Entry List
- **Double-clic** copie le mot de passe
- **Actions rapides** au survol : copier username/password, ouvrir URL
- **Multi-sélection** avec actions groupées
- **Recherche avancée** : opérateurs `tag:`, `type:`, `folder:`, `has:`, `-exclude`

#### Modals & Forms
- **Add Entry Modal** avec types dynamiques
- **Edit Entry Modal** avec historique
- **Import Modal** avec drag-and-drop et preview
- **Keyboard shortcuts** : `Ctrl+N`, `Ctrl+E`, `Delete`, etc.

### 📦 Nouveaux Fichiers

#### Backend Electron
- `electron-main.cjs` : +globalShortcut, compact mode, tray amélioré
- `electron-preload.cjs` : APIs compact mode, clipboard sécurisé, auto-type
- `src/desktop/vault/` : Module complet de gestion du coffre

#### Services Vault (`src/js/vault/`)
- `audit-service.js` (~300 lignes) : Analyse de sécurité
- `totp-service.js` (~280 lignes) : Générateur 2FA RFC 6238
- `import-service.js` (~700 lignes) : Import KeePass/Bitwarden/CSV
- `in-memory-repository.js` : Repository avec recherche avancée
- `interfaces.js` : Interfaces abstraites
- `models.js` : VaultEntry, VaultGroup

#### UI
- `src/js/vault-ui.js` (~9800 lignes) : Interface complète du coffre
- `src/styles/vault.css` (~7400 lignes) : Styles du coffre

### 🔧 Configuration de Build

#### Electron Builder
- **Targets Windows** : NSIS (x64, ia32), Portable (x64), ZIP (x64)
- **Artifact naming** : `${productName}-${version}-${os}-${arch}.${ext}`
- **Compression maximum** avec ASAR
- **Icônes** configurées pour installer/uninstaller

### 📊 Statistiques

- **+15,000 lignes** de code ajoutées
- **12 nouveaux modules** JavaScript
- **2 fichiers CSS** (vault.css ~7400 lignes)
- **8 catégories** de fonctionnalités desktop
- **100%** des features KeePass essentielles

### 🚀 Prochaines Étapes (v3.1.0)

- [ ] Windows Hello / Touch ID pour déverrouillage biométrique
- [ ] Synchronisation cloud optionnelle (OneDrive, Google Drive)
- [ ] Extension navigateur pour auto-fill
- [ ] Export chiffré vers fichier externe
- [ ] Tests unitaires pour TOTP et Audit services

---

## [2.6.0] - 2025-11-06

### 🎉 Fonctionnalités Majeures

#### 🌐 Internationalisation (i18n)
- **Système d'internationalisation complet** avec support de 3 langues
  - 🇫🇷 Français (langue par défaut)
  - 🇬🇧 English (interface complète traduite)
  - 🇪🇸 Español (interface complète traduite)
- Sélecteur de langue dans le header avec drapeaux
- Changement de langue en temps réel sans rechargement
- Détection automatique de la langue du navigateur
- Persistance dans localStorage
- API complète pour extensions : `i18n.setLocale()`, `i18n.t()`
- Module `src/js/utils/i18n.js` avec gestion des traductions

#### 💾 Système de Presets
- **Gestion complète des configurations**
  - Sauvegarder la configuration actuelle comme preset
  - Charger un preset pour restaurer instantanément une configuration
  - Nommer et décrire chaque preset
  - Marquer des presets favoris ⭐
- **Modal de gestion avancée**
  - Liste de tous les presets avec métadonnées
  - Recherche et filtrage
  - Export/Import de presets individuels (JSON)
  - Export groupé de tous les presets
  - Suppression avec confirmation
- **Persistance localStorage** avec support offline complet
- **API développeur** : `presetManager.createPreset()`, `getAllPresets()`, `exportPreset()`
- Module `src/js/utils/preset-manager.js`

#### 📜 Historique des Mots de Passe
- **Tracking intelligent des mots de passe générés**
  - Sauvegarde automatique avec métadonnées (mode, entropie, timestamp)
  - Limite configurable (défaut: 100 entrées)
  - Chiffrement optionnel pour protection supplémentaire
- **Interface complète de gestion**
  - Statistiques en temps réel (total, favoris, entropie moyenne)
  - Recherche instantanée dans l'historique
  - Système de favoris ⭐
  - Gestion de tags personnalisés
  - Copie rapide vers le presse-papiers
- **Export et contrôle**
  - Export de l'historique complet (JSON)
  - Option pour effacer tout l'historique
  - Activation/désactivation du tracking
- **API complète** : `historyManager.addEntry()`, `getHistory()`, `exportHistory()`
- Module `src/js/utils/history-manager.js`

#### 📊 Analytics & Monitoring (Optionnel)
- **Intégration analytics pour déploiements professionnels**
  - Support Google Analytics
  - Support Plausible (privacy-friendly)
  - Configuration par variables d'environnement
  - Désactivé par défaut (opt-in)
- **Sentry pour tracking d'erreurs**
  - Intégration Sentry.io optionnelle
  - Capture automatique des erreurs en production
  - Sanitization des données sensibles
  - Configuration via `SENTRY_DSN`
- Modules `src/js/utils/analytics.js` et `src/js/config/sentry-config.js`

### 🔒 Sécurité

#### Conformité CSP 100%
- **Élimination complète des violations CSP**
  - Tous les `.style.display` remplacés par `classList.add/remove('hidden')`
  - Modal visibility utilise `.show` class au lieu d'inline styles
  - Dropdown language selector utilise `.hidden` class
  - Body scroll prevention utilise `.no-scroll` class
- **Nouvelles classes CSS utilitaires**
  - `.hidden { display: none !important; }`
  - `.no-scroll { overflow: hidden !important; }`
- Fixes dans :
  - `src/js/ui/features-ui.js` - Tous les modaux et dropdowns
  - `src/js/ui/dom.js` - Gestion de visibilité
  - `src/js/ui/modal.js` - Modaux système
  - `src/js/ui/events.js` - Export modal
- **Content Security Policy stricte** maintenant 100% respectée

### 🛠️ Corrections & Améliorations

#### Workflow CI/CD
- **Fix Semgrep SARIF generation**
  - Remplacement de `returntocorp/semgrep-action@v1` par CLI direct
  - Installation Semgrep via pip pour meilleur contrôle
  - Génération explicite du fichier SARIF avec `--sarif --output=semgrep.sarif`
  - Flag `--no-error` pour éviter échecs de job sur findings
  - `continue-on-error` pour garantir l'upload SARIF
- Fichier `.github/workflows/security-scan.yml` mis à jour

#### Serveur de Développement
- **Correction du chemin des dictionnaires**
  - Fix dans `tools/dev-server.cjs` pour charger correctement les dictionnaires
  - Chemin corrigé : `process.cwd() + this.sourceDir + 'dictionaries'`
  - Plus d'erreurs 404 sur `/dictionnaires/french.json`

#### Harmonisation de Version
- **Version 2.6.0 uniforme** dans tous les fichiers
  - `package.json` : `"version": "2.6.0"`
  - `src/js/config/constants.js` : `APP_VERSION = '2.6.0'`
  - `src/js/app.js` : `this.version = '2.6.0'`
  - `main.js` : `this.version = '2.6.0'`
  - `src/index.html` : Tous les badges et références
  - `src/tests/test-suite.js` : Header de tests
  - `src/js/test-integration.js` : Modal de tests

### 🎨 Interface Utilisateur

#### Nouvelles Composantes
- **Sélecteur de langue** dans le header
  - Dropdown élégant avec drapeaux
  - Animation smooth
  - Fermeture automatique au clic extérieur
- **Section Presets** dans le panneau de configuration
  - Bouton "Sauvegarder Configuration"
  - Bouton "Gérer les Presets"
  - Dropdown de chargement rapide
- **Bouton Historique** dans la barre d'actions
  - Accès rapide à l'historique complet
  - Modal full-featured

#### Nouveaux Styles CSS
- `src/styles/features.css` - Styles pour toutes les nouvelles features
- `src/styles/dynamic-modals.css` - Styles des modaux dynamiques
- `src/styles/utilities.css` - Classes utilitaires (hidden, no-scroll, etc.)
- Tous les styles 100% CSP compliant (pas d'inline styles)

### 📦 Nouveaux Fichiers

#### JavaScript
- `src/js/ui/features-ui.js` (668 lignes) - Composants UI pour i18n, presets, history
- `src/js/utils/i18n.js` (183 lignes) - Système d'internationalisation
- `src/js/utils/preset-manager.js` (271 lignes) - Gestion des presets
- `src/js/utils/history-manager.js` (370 lignes) - Tracking de l'historique
- `src/js/utils/analytics.js` (271 lignes) - Intégration analytics
- `src/js/config/sentry-config.js` (118 lignes) - Configuration Sentry

#### CSS
- `src/styles/features.css` - Styles des nouvelles features
- `src/styles/dynamic-modals.css` - Modaux dynamiques
- `src/styles/utilities.css` - Classes utilitaires

#### Tests
- `src/tests/test-new-features.js` - Suite de tests pour les nouvelles features

### 📚 Documentation

- **README.md** complètement mis à jour pour v2.6.0
  - Documentation des nouvelles features
  - Exemples d'API
  - Guide d'utilisation actualisé
  - Badge CSP 100% compliant ajouté
- **Archivage de la documentation obsolète**
  - 12 fichiers d'audit déplacés vers `archive/audits_2025/`
  - Suppression de fichiers temporaires non pertinents
- **Structure de documentation clarifiée**

### 🔧 Intégration

#### app.js
- **Initialisation complète des nouvelles features**
  - Import de tous les nouveaux modules
  - Initialisation i18n avec détection de locale
  - Initialisation Analytics (si configuré)
  - Initialisation Sentry (si configuré)
  - Appel de `initializeAllFeatures()` pour UI
  - Exposition des managers en mode développement
- **Toast de succès au démarrage** : "GenPwd Pro v2.6.0 chargé avec succès"
- **Gestion d'erreurs améliorée** avec reporting Sentry

#### index.html
- **Ajout des nouveaux fichiers CSS**
  - `<link rel="stylesheet" href="styles/features.css">`
  - `<link rel="stylesheet" href="styles/dynamic-modals.css">`
  - `<link rel="stylesheet" href="styles/utilities.css">`

### 🚀 Performance

- **Architecture modulaire maintenue**
  - Chargement à la demande des modaux
  - localStorage pour cache des préférences
  - Pas d'impact sur le temps de chargement initial
- **Code splitting naturel** avec modules ES6
- **Total ajouté** : ~3548 lignes de code production-ready

### 📊 Statistiques

- **12 nouveaux fichiers** (JavaScript, CSS, tests)
- **2 fichiers modifiés** (app.js, index.html)
- **3548 lignes ajoutées**
- **0 violation CSP**
- **100% backward compatible**
- **12 fichiers d'audit archivés**
- **1 fichier inutile supprimé**

---

## [2.5.2] - 2025-11-04

### 🎨 Nouvelles Fonctionnalités Majeures

#### Export de Mots de Passe
- **Fonction d'export complète** avec 3 formats supportés
  - Format TXT : Liste simple de mots de passe
  - Format JSON : Données complètes avec métadonnées (entropy, mode, etc.)
  - Format CSV : Compatible Excel/tableurs avec headers
- Interface modale élégante pour sélection du format
- Noms de fichiers avec timestamp automatique
- Gestion d'erreurs complète avec toasts de feedback
- Support des caractères spéciaux (CSV escaping)

#### Système de Thèmes
- **5 thèmes pré-configurés** :
  - 🌙 Sombre (Dark) - Thème par défaut
  - ☀️ Clair (Light) - Thème professionnel
  - ⚫⚪ Contraste Élevé - Accessibilité WCAG AAA
  - 🌊 Océan - Tons bleus apaisants
  - 🌲 Forêt - Tons verts naturels
- Persistance automatique dans localStorage
- Détection des préférences système (`prefers-color-scheme`)
- API complète pour gestion programmatique
- Support des changements dynamiques de thème

#### Système de Monitoring d'Erreurs
- Capture automatique des erreurs non gérées
- Capture des promesses rejetées (unhandled rejections)
- Sanitization des données sensibles avant logging
- Stockage local des erreurs (max 50)
- Support pour services externes (Sentry, LogRocket, etc.)
- API complète : `reportError()`, `withErrorHandling()`, `errorStats`
- Distinction automatique développement/production

#### Outils de Performance
- Suite complète de benchmarking
- Fonction `measurePerformance()` pour mesure unitaire
- Fonction `benchmark()` pour tests avec statistiques (min, max, mean, median, P95, P99)
- Fonction `comparePerformance()` pour comparaisons multiples
- Mesure de mémoire (`measureMemory()`)
- Export des résultats au format JSON
- Wrapper automatique `withTimer()`

### 📚 Améliorations de Documentation

#### JSDoc Complet
- Documentation inline pour toutes les fonctions principales
- `generateSyllables()` : 11 paramètres documentés avec exemple
- `generatePassphrase()` : Documentation async complète
- `generateLeet()` : Transformations leet documentées
- Fonctions utilitaires : `randInt()`, `pick()`, `insertWithPlacement()`
- Auto-complétion IDE améliorée
- Types explicites pour tous les paramètres

#### Nouveau Guide des Fonctionnalités
- Guide complet de 400+ lignes : `docs/FEATURES_GUIDE.md`
- Exemples d'utilisation pour toutes les nouvelles features
- Instructions détaillées pour export, thèmes, monitoring
- Exemples de code prêts à l'emploi
- Intégrations tierces (Sentry)

### 🔧 Améliorations Techniques

#### Migration ESLint v9
- Nouveau fichier `eslint.config.js` (flat config format)
- Configuration moderne pour ES2021+
- Règles séparées pour src/js/ (browser) et tools/ (Node.js)
- Support complet des globals (window, document, process, etc.)
- Ignores configurés (dist/, node_modules/, coverage/)

#### Nettoyage du Code
- Suppression de tous les `console.log()` de production
- Remplacement par `safeLog()` pour distinction dev/production
- Séquence d'initialisation améliorée et numérotée
- Gestion d'erreurs renforcée avec contexte

### 🐛 Corrections

- Correction des warnings Node.js liés au type de module
- Harmonisation de la gestion d'erreurs globale
- Amélioration de la robustesse des gestionnaires d'événements

### 📦 Fichiers Ajoutés

- `src/js/utils/error-monitoring.js` - Système de monitoring (200+ lignes)
- `src/js/utils/theme-manager.js` - Gestionnaire de thèmes (300+ lignes)
- `src/js/utils/performance.js` - Outils de benchmark (250+ lignes)
- `eslint.config.js` - Configuration ESLint v9
- `docs/FEATURES_GUIDE.md` - Guide des nouvelles fonctionnalités

### 📝 Fichiers Modifiés

- `src/js/app.js` - Intégration des nouveaux systèmes
- `src/js/core/generators.js` - JSDoc complet, logs améliorés
- `src/js/ui/events.js` - Implémentation export passwords
- `src/js/utils/helpers.js` - JSDoc pour fonctions utilitaires

### 📊 Statistiques

- **+596 lignes** de code ajoutées
- **-25 lignes** supprimées (nettoyage)
- **6 fichiers** modifiés
- **5 fichiers** créés
- **100%** des tests passent (17/17)
- Score qualité : **9.0/10 → 9.5/10**

### 🔗 Liens Utiles

- Guide des fonctionnalités : [docs/FEATURES_GUIDE.md](docs/FEATURES_GUIDE.md)
- Rapport de revue : Score 9.5/10, production-ready
- Commit : `feat(quality): implémentation complète des recommandations`

---

## [2.5.1] - 2025-09-26

### 🔒 Sécurité et stabilité

- Remplacement des caractères spéciaux par un sous-ensemble CLI-safe commun à toutes les politiques.
- Nouvelle table de substitutions Leet (`S→5`) partagée côté générateur et tests pour éviter les caractères interdits.
- Refonte du calcul d'entropie basée sur les politiques avec prise en compte des séparateurs, chiffres et symboles configurés.
- Mise à jour d'`ensureMinimumEntropy` pour accepter les générateurs asynchrones et ajouter des compléments automatiques.
- Renforcement de la batterie de tests Node avec validations CLI-safe et entropie minimale ≥100 bits.
- Documentation CDC ajustée avec des exemples d'entropie réalistes et des conversions Leet conformes.

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

## Roadmap future (v3.1.0+)

### v3.0.0 - ✅ Livré (Décembre 2025)
- ✅ **Gestionnaire de mots de passe** complet (coffre-fort chiffré AES-GCM)
- ✅ **2FA Generator** intégré (TOTP RFC 6238)
- ✅ **Audit de sécurité** avec scoring et recommandations
- ✅ **Import KeePass/Bitwarden/CSV**
- ✅ **Expérience Desktop** complète (Tray, Hotkey, Compact Mode)

### v3.1.0 - Planifié
- 🔒 **Windows Hello / Touch ID** pour déverrouillage biométrique
- ☁️ **Sync Cloud optionnel** (OneDrive, Google Drive, Dropbox)
- 🌐 **Extension navigateur** pour auto-fill dans Chrome/Firefox
- 📤 **Export chiffré** vers fichier externe partageable

### v3.2.0 - Planifié
- 📱 **Application mobile** React Native (iOS/Android)
- 🔄 **Web Workers** pour opérations cryptographiques en arrière-plan
- 🌐 **PWA** (Progressive Web App) avec mode offline
- 🤖 **API REST** pour intégration entreprise

### Améliorations techniques prévues
- Migration partielle vers TypeScript
- Tests E2E avec Playwright
- CI/CD renforcé avec GitHub Actions
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
  <a href="https://github.com/VBlackJack/genpwd-pro/releases">Voir toutes les releases</a> •
  <a href="https://github.com/VBlackJack/genpwd-pro/compare">Comparer les versions</a>
</div>
