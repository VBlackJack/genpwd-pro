# Archive Documentation - GenPwd Pro

Cette archive contient les documents obsolètes, historiques ou périmés qui ne sont plus maintenus activement.

## Organisation

Les archives sont organisées par date dans des dossiers `YYYY-MM/`:

```
_archive/
├── 2025-11/          ← Fichiers archivés en novembre 2025
│   ├── sprint-prompts.md
│   ├── AUDIT_COMPLET_2025.md
│   ├── COMPREHENSIVE_CODE_AUDIT_2025-11-15.md
│   ├── SPRINT_S3_SUMMARY.md
│   ├── SPRINT_S4_SUMMARY.md
│   ├── SPRINT_S4_PUBLICATION_CHECKLIST.md
│   ├── bug_analysis_vault_lock_issue23.md
│   ├── code_review_codex_vault_lock_fix.md
│   ├── legacy_room_usage_report.md
│   └── IMPROVEMENTS.md
└── README.md         ← Ce fichier
```

## Politique d'archivage

**Critères d'archivage:**
- Document n'étant plus mis à jour depuis > 6 mois
- Contenu historique (sprints terminés, bugs résolus, audits passés)
- Documentation remplacée par une version plus récente
- Implémentations abandonnées ou refactorisées

**Procédure:**
1. Identifier le document obsolète
2. Créer le dossier `YYYY-MM/` si nécessaire (mois d'archivage)
3. Déplacer avec `git mv` pour garder l'historique
4. Mettre à jour cet index
5. Ajouter une note de redirection dans le fichier original si pertinent

## Index des archives

### 2025-11

| Fichier | Date archivage | Raison | Remplacement |
|---------|----------------|--------|--------------|
| `AUDIT_COMPLET_2025.md` | 2025-11-15 | Doublon AUDIT_REPORT | [AUDIT_REPORT.md](../../AUDIT_REPORT.md) |
| `COMPREHENSIVE_CODE_AUDIT_2025-11-15.md` | 2025-11-15 | Audit daté (snapshot du 15/11) | [AUDIT_REPORT.md](../../AUDIT_REPORT.md) |
| `sprint-prompts.md` | 2025-11-15 | Prompts de développement historiques | - |
| `SPRINT_S3_SUMMARY.md` | 2025-11-15 | Sprint 3 terminé | [CHANGELOG.md](../../CHANGELOG.md) |
| `SPRINT_S4_SUMMARY.md` | 2025-11-15 | Sprint 4 terminé | [CHANGELOG.md](../../CHANGELOG.md) |
| `SPRINT_S4_PUBLICATION_CHECKLIST.md` | 2025-11-15 | Checklist sprint historique | [RELEASE_CHECKLIST.md](../../RELEASE_CHECKLIST.md) |
| `bug_analysis_vault_lock_issue23.md` | 2025-11-15 | Bug #23 résolu | [Issue #23](https://github.com/VBlackJack/genpwd-pro/issues/23) |
| `code_review_codex_vault_lock_fix.md` | 2025-11-15 | Review du fix mergé | - |
| `legacy_room_usage_report.md` | 2025-11-15 | Migration Room → File terminée | - |
| `IMPROVEMENTS.md` | 2025-11-15 | Liste TODO obsolète (items complétés) | [BACKLOG.md](../../BACKLOG.md) |

**Fichiers archivés dans `/archive/audits_2025/`:**

| Fichier | Date archivage | Raison |
|---------|----------------|--------|
| `SECURITY_AUDIT_FIXES.md` | 2025-11-15 | Fixes de sécurité déjà appliqués |
| `SECURITY_ENHANCEMENTS.md` | 2025-11-15 | Améliorations de sécurité implémentées |

## Consultation

Ces fichiers restent consultables en lecture seule. Pour toute question, consulter la documentation active dans `/docs/`.

**Dernière mise à jour:** 2025-11-15
