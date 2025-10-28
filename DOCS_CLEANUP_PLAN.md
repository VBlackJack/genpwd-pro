# Plan de Nettoyage des Fichiers Markdown

Généré le: 2025-10-28

## 📋 Catégorisation des Fichiers

### ✅ À GARDER (Documentation Utile)

#### Racine
- `README.md` - Doc principale du projet ✅
- `CHANGELOG.md` - Historique des versions ✅

#### docs/
- `ANDROID-ARCHITECTURE.md` - Architecture Android ✅
- `ANDROID-PORT-SUMMARY.md` - Résumé du port Android ✅
- `API.md` - Documentation API ✅
- `CDC-GENPWD-2024-v2.5.md` - Cahier des charges ✅
- `DEVELOPMENT.md` - Guide développeur ✅
- `USER-GUIDE.md` - Guide utilisateur ✅
- `TECHNICAL.md` - Documentation technique ✅
- `audit_results/README.md` - Résultats d'audit ✅
- `legacy_room_usage_report.md` - Rapport d'audit Room ✅
- `bug_analysis_vault_lock_issue23.md` - Analyse bug #23 ✅
- `code_review_codex_vault_lock_fix.md` - Review Codex ✅

#### android/
- `README.md` - Doc Android ✅
- `CLOUD_SYNC_README.md` - Doc sync cloud ✅
- `OAUTH2_SETUP_GUIDE.md` - Guide OAuth2 ✅
- `PRESET_USER_GUIDE.md` - Guide presets ✅
- `README_SCRIPTS.md` - Doc scripts ✅
- `ARCHITECTURE_VAULT_SYSTEM.md` - Architecture vault ✅

### 📦 À ARCHIVER (Obsolètes/Redondants)

#### Racine - Sessions Anciennes (70KB total)
- `BRANCHES_STATUS.md` (7.3K) - Statut branches obsolète
- `CLAUDE_WEB_BUILD_PROMPT.md` (6.5K) - Prompt de session
- `FINAL_STATUS_AND_ROADMAP.md` (26K) - Roadmap ancienne
- `IMPLEMENTATION_COMPLETE.md` (21K) - Statut implémentation ancienne
- `IMPLEMENTATION_PROGRESS.md` (7.9K) - Progrès ancien
- `MULTIPLATFORM_ROADMAP.md` (28K) - Roadmap multiplateforme (non pertinent pour Android-only)
- `SESSION_SUMMARY.md` (24K) - Résumé de session ancienne
- `VAULT_REGISTRY_IMPLEMENTATION.md` (17K) - Implémentation déjà intégrée

#### android/ - Build Errors Résolus
- `BUILD_ERROR_ENTRY_CRUD.md` - Erreur résolue
- `BUILD_ERROR_ROUND2.md` - Erreur résolue
- `BUILD_ERROR_ROUND3_ACTUAL.md` - Erreur résolue
- `BUILD_ERROR_ROUND4_IMPORT.md` - Erreur résolue
- `BUILD_ERROR_SAF.md` - Erreur résolue

#### android/ - Documentation Redondante/Obsolète
- `ANALYSE_COMMITS.md` - Analyse temporaire
- `BUGS_IDENTIFIED.md` - Bugs déjà fixés
- `CLAUDE_WEB_DIAGNOSTIC_PROMPT.md` - Prompt de debug
- `FILE_BASED_VAULT_IMPLEMENTATION.md` - Déjà intégré
- `IMPLEMENTATION_PROGRESS.md` - Redondant avec statut
- `IMPLEMENTATION_STATUS.md` - Redondant
- `KEEPASS_RESEARCH_FINDINGS.md` - Recherche terminée
- `PHASE1_COMPLETE.md` - Phase terminée
- `PHASES_2_3_4_IMPLEMENTATION.md` - Phases terminées
- `PLAN_AMELIORATION.md` - Plan ancien
- `PROJECT_COMPLETE.md` - Statut ancien
- `PROJET_ANDROID_COMPLET.md` - Doc complète obsolète
- `PROVIDER_IMPLEMENTATION_GUIDE.md` - Guide obsolète
- `RUNTIME_ISSUES_DIAGNOSTIC.md` - Issues résolues
- `UX_DESIGN_IMPLEMENTATION.md` - Design déjà implémenté
- `VAULT_IMPLEMENTATION_ROADMAP.md` - Roadmap obsolète
- `VAULT_IMPLEMENTATION_STATUS.md` - Statut obsolète
- `VAULT_MANAGEMENT_ARCHITECTURE.md` - Redondant avec ARCHITECTURE_VAULT_SYSTEM.md

## 📁 Structure d'Archivage Proposée

```
archive/
├── sessions/           # Résumés de sessions anciennes
│   ├── BRANCHES_STATUS.md
│   ├── CLAUDE_WEB_BUILD_PROMPT.md
│   ├── SESSION_SUMMARY.md
│   └── ...
├── build-errors/       # Erreurs de build résolues
│   ├── BUILD_ERROR_*.md
│   └── ...
├── implementation/     # Docs d'implémentation obsolètes
│   ├── IMPLEMENTATION_*.md
│   ├── PHASE*.md
│   ├── VAULT_*.md
│   └── ...
└── research/          # Recherches et analyses temporaires
    ├── KEEPASS_RESEARCH_FINDINGS.md
    ├── ANALYSE_COMMITS.md
    └── ...
```

## 🎯 Actions Recommandées

1. **Créer dossier `archive/` à la racine**
2. **Créer sous-dossiers** : sessions/, build-errors/, implementation/, research/
3. **Déplacer fichiers obsolètes** selon catégories
4. **Mettre à jour .gitignore** pour exclure `archive/` du repo (optionnel)
5. **Garder uniquement** les docs utiles et à jour

## 💾 Estimation

- **Fichiers à archiver** : ~30 fichiers
- **Espace libéré** : ~200-300 KB (docs plus lisibles)
- **Temps estimé** : 5-10 minutes

## ⚠️ Note

Les fichiers dans `docs/` sont tous pertinents (rapports d'audit, analyses de bugs, reviews).
Ils documentent des décisions importantes et doivent être conservés.
