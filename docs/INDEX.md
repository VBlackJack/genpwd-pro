# 📚 Index de la Documentation - GenPwd Pro v2.6.0

> Navigation complète de toute la documentation du projet

**Dernière mise à jour :** 2025-11-15
**Version :** 2.6.0
**Score Qualité :** 9.7/10

---

## 🚀 DÉMARRAGE RAPIDE

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](../README.md) | Vue d'ensemble du projet, installation | 👥 Tous |
| [USER-GUIDE.md](USER-GUIDE.md) | Guide complet d'utilisation | 👤 Utilisateurs |
| [FEATURES_GUIDE.md](FEATURES_GUIDE.md) ⭐ **NOUVEAU** | Nouvelles fonctionnalités v2.5.2 | 👤 Utilisateurs / 👨‍💻 Développeurs |

---

## 👤 GUIDES UTILISATEUR

### Utilisation Générale
- **[USER-GUIDE.md](USER-GUIDE.md)** - Guide utilisateur complet
  - Modes de génération (syllables, passphrase, leet)
  - Configuration avancée
  - Placement des caractères spéciaux
  - Système de blocs de casse

### Nouvelles Fonctionnalités v2.5.2
- **[FEATURES_GUIDE.md](FEATURES_GUIDE.md)** ⭐ **NOUVEAU** (400+ lignes)
  - 📤 **Export de mots de passe** (TXT, JSON, CSV)
  - 🎨 **Système de thèmes** (5 thèmes disponibles)
  - 🔍 **Monitoring d'erreurs** (Capture automatique, Sentry)
  - ⏱️ **Outils de performance** (Benchmarking complet)
  - 📚 **Documentation JSDoc** (Auto-complétion IDE)
  - 🔧 **Configuration ESLint v9**

---

## 👨‍💻 DOCUMENTATION DÉVELOPPEUR

### Architecture & Conception
- **[TECHNICAL.md](TECHNICAL.md)** - Documentation technique complète
  - Architecture modulaire ES6
  - Flux de données
  - Modules principaux (config, core, ui, utils)
  - Système de tests

- **[API.md](API.md)** - Référence API
  - Fonctions de génération
  - Utilitaires
  - Gestion d'état
  - Événements

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Guide développeur
  - Configuration environnement
  - Workflow de développement
  - Conventions de code
  - Contribution

### Cahier des Charges
- **[CDC-GENPWD-2024.md](architecture/CDC-GENPWD-2024.md)** - Spécifications complètes
  - Exigences fonctionnelles
  - Exigences techniques
  - Calculs d'entropie
  - Modes de génération

---

## 📱 DOCUMENTATION ANDROID

### Vue d'ensemble
- **[ANDROID-ARCHITECTURE.md](ANDROID-ARCHITECTURE.md)** - Architecture Android
  - Modules Gradle (11 modules)
  - Clean Architecture
  - Dependency Injection (Hilt)
  - Navigation Compose

- **[ANDROID-PORT-SUMMARY.md](ANDROID-PORT-SUMMARY.md)** - Résumé du portage
  - Historique du projet
  - Phases de développement
  - Fonctionnalités implémentées

### Guides Spécifiques
Situés dans `/android/` :
- `README.md` - Vue d'ensemble Android
- `BUILD_README.md` - Instructions de build
- `ARCHITECTURE_VAULT_SYSTEM.md` - Système de coffres-forts
- `CLOUD_SYNC_README.md` - Synchronisation cloud
- `CLOUD_SYNC_OAUTH_SETUP.md` - Configuration OAuth
- `OAUTH2_SETUP_GUIDE.md` - Guide OAuth2 détaillé
- `PRESET_USER_GUIDE.md` - Guide des presets
- `README_SCRIPTS.md` - Documentation des scripts

### Documentation Technique Android
Située dans `/android/docs/` :
- `ANDROID_APP_CODE_AUDIT.md` - Audit du code Android
- `dependency-upgrade-plan.md` - Plan de mise à jour
- `sdk35-dry-run.md` - Tests SDK 35

---

## 🔒 SÉCURITÉ & AUDITS

### Rapports de Sécurité
- **[AUDIT_REPORT.md](../AUDIT_REPORT.md)** - Audit de code complet
  - Score : 9.5/10
  - Vulnérabilités identifiées et corrigées
  - Recommandations implémentées

- **Archives des audits de sécurité** - Consultez [archive/audits_2025/](../archive/audits_2025/)
  - SECURITY_AUDIT_REPORT_2025-11-04.md
  - SECURITY_FIXES_IMPLEMENTED.md
  - SECURITY_AUDIT_NOTES.md

- **[SECURITY.md](../SECURITY.md)** - Politique de sécurité
  - Signalement de vulnérabilités
  - Process de divulgation
  - Versions supportées

### Audits & Analyses
- **[audit_results/README.md](audit_results/README.md)** - Résultats d'audits
- **[legacy_room_usage_report.md](legacy_room_usage_report.md)** - Audit Room
- **[data-safety.md](data-safety.md)** - Sécurité des données

---

## 🐛 ANALYSES DE BUGS

- **[bug_analysis_vault_lock_issue23.md](bug_analysis_vault_lock_issue23.md)** - Analyse bug #23
  - Symptômes
  - Diagnostic
  - Résolution

- **[code_review_codex_vault_lock_fix.md](code_review_codex_vault_lock_fix.md)** - Review Codex
  - Revue du correctif
  - Tests de validation

---

## ☁️ CLOUD & SYNCHRONISATION

- **[cloud-sync-spec.md](cloud-sync-spec.md)** - Spécification sync cloud
  - Architecture multi-provider
  - OAuth 2.0 PKCE
  - Chiffrement bout-en-bout
  - Résolution de conflits

---

## 🏗️ ARCHITECTURE DÉTAILLÉE

### Persistence
- **[architecture/persistence.md](architecture/persistence.md)** - Architecture de persistence
  - Room Database
  - DataStore
  - File-based vault system
  - Migration strategies

---

## 📝 VERSIONS & HISTORIQUE

- **[CHANGELOG.md](../CHANGELOG.md)** - Historique des versions
  - v2.5.2 (2025-11-04) ⭐ **DERNIÈRE VERSION**
  - v2.5.1 (2025-09-26)
  - v2.5.0 (2025-09-25)
  - Versions antérieures

- **[RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md)** - Checklist de release
  - Tests pré-release
  - Documentation
  - Compilation
  - Publication

---

## 🤝 CONTRIBUTION

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Guide de contribution
  - Code de conduite
  - Workflow Git
  - Standards de code
  - Process de review

---

## 📊 QUALITÉ & AUDITS

- **Documentation Quality** - Voir [archive/audits_2025/](../archive/audits_2025/)
  - Documentation audit complet (2025-11-04)
  - État de la documentation
  - Fichiers pertinents vs obsolètes
  - Plan de nettoyage appliqué

---

## 📁 ARCHIVES

### Archives Web (Racine)
Situé dans `/archive/` :
- `implementation/` - Anciennes implémentations
- `sessions/` - Résumés de sessions

### Archives Android
Situé dans `/android/archive/` :
- `build-errors/` - Erreurs de build résolues
- `implementation/` - Docs d'implémentation obsolètes
- `research/` - Recherches et analyses
- `old-docs/` - Documentation obsolète

**Note :** Ces fichiers sont conservés pour historique mais ne sont plus maintenus.

---

## 🗺️ NAVIGATION PAR THÉMATIQUE

### 🆕 Je débute
1. [README.md](../README.md)
2. [USER-GUIDE.md](USER-GUIDE.md)
3. [FEATURES_GUIDE.md](FEATURES_GUIDE.md)

### 👨‍💻 Je développe sur le Web
1. [TECHNICAL.md](TECHNICAL.md)
2. [API.md](API.md)
3. [DEVELOPMENT.md](DEVELOPMENT.md)
4. [FEATURES_GUIDE.md](FEATURES_GUIDE.md) (nouvelles APIs)

### 📱 Je développe sur Android
1. `android/README.md`
2. [ANDROID-ARCHITECTURE.md](ANDROID-ARCHITECTURE.md)
3. `android/BUILD_README.md`
4. `android/docs/ANDROID_APP_CODE_AUDIT.md`

### 🔒 Je m'intéresse à la sécurité
1. [AUDIT_REPORT.md](../AUDIT_REPORT.md)
2. [SECURITY.md](../SECURITY.md)
3. [data-safety.md](data-safety.md)
4. [cloud-sync-spec.md](cloud-sync-spec.md)

### ☁️ Je veux synchroniser mes mots de passe
1. [cloud-sync-spec.md](cloud-sync-spec.md)
2. `android/CLOUD_SYNC_README.md`
3. `android/OAUTH2_SETUP_GUIDE.md`

---

## 📈 STATISTIQUES

- **Total fichiers documentation :** 75 fichiers
- **Documentation active :** 28 fichiers (37%)
- **Archives :** 47 fichiers (63%)
- **Lignes totales :** ~25,000 lignes
- **Langues :** Français
- **Score qualité :** 9.7/10

---

## 🔗 LIENS EXTERNES

- **GitHub Repository :** https://github.com/VBlackJack/genpwd-pro
- **Issues :** https://github.com/VBlackJack/genpwd-pro/issues
- **Licence :** Apache 2.0

---

## 📅 MAINTENANCE

Ce document est mis à jour à chaque version majeure ou lors d'ajouts significatifs de documentation.

**Prochaine révision prévue :** Janvier 2026 ou v2.6.0

---

**Généré le :** 2025-11-04
**Par :** Claude (Sonnet 4.5)
**Version du projet :** 2.5.2
