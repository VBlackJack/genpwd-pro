# Legacy Room Usage Report

Ce document synthétise l'état actuel de la transition vers le nouveau système de coffres basé
sur des fichiers. Il est généré manuellement à l'aide de `tools/legacy_room_audit.py`, un
script qui repère les références au dépôt Room historique.

## Comment exécuter l'audit

```bash
python tools/legacy_room_audit.py --root .
```

À chaque exécution, le script sauvegarde automatiquement un couple `.txt` / `.json` dans
`docs/audit_results/` avec un timestamp UTC (`YYYY-MM-DD_HH-MM-SS`).

Options utiles :

- `--json` : exporte le rapport au format JSON sur la sortie standard (en plus du fichier archivé).
- `--pattern <nom>` : limite l'analyse à un motif spécifique (ex. `legacy_vault_repository`).

## Résumé du scan

Exécution du 28 octobre 2025 (UTC) depuis la racine du dépôt :

| Motif                      | Description                                                | Occurrences |
|---------------------------|------------------------------------------------------------|-------------|
| `app_database_singletons` | Références directes à `AppDatabase` (Room)                 | 19          |
| `coroutine_dao_calls`     | Fonctions `suspend` retournant des collections Room        | 0           |
| `flow_vault_entities`     | Flux (`Flow`) exposant des entités Room                    | 7           |
| `legacy_vault_repository` | Usages de `VaultRepository` (implémentation Room)          | 54          |
| `room_annotations`        | Annotations `@Dao`, `@Entity`, `@Query`, `@Database`       | 137         |
| `room_database_builder`   | Usage direct de `Room.databaseBuilder` / imports Room      | 0           |
| `room_imports`            | Imports explicites de Room/DAO/entités `Vault*`            | 6           |

_Source : `docs/audit_results/2025-10-28_16-03-48_legacy_room_audit.txt` généré automatiquement._

## Zones encore dépendantes de Room

Les fichiers suivants concentrent l'essentiel des usages du dépôt Room :

- `android/app/src/main/java/com/julien/genpwdpro/data/repository/VaultRepository.kt`
  - 13 occurrences de `VaultRepository` dans sa propre implémentation Room.
- `android/app/src/main/java/com/julien/genpwdpro/domain/model/SecureNote.kt`
  - 8 conversions model ⇄ `VaultRepository.DecryptedEntry`.
- `android/app/src/main/java/com/julien/genpwdpro/presentation/screens/GeneratorViewModel.kt`
  - 7 accès directs au dépôt Room pour les presets.
- `android/app/src/main/java/com/julien/genpwdpro/data/sync/VaultSyncManager.kt`
  - 4 appels au dépôt Room pour les exports/imports.
- `android/app/src/main/java/com/julien/genpwdpro/di/DatabaseModule.kt`
  - 18 références à `AppDatabase` et 3 instanciations directes de `VaultRepository`.
- `android/app/src/main/java/com/julien/genpwdpro/data/repository/ImportExportRepository.kt`
  - 3 utilisations du dépôt Room pour sérialiser les entrées.
- `android/app/src/main/java/com/julien/genpwdpro/presentation/analysis/PasswordHealthViewModel.kt`
  - 3 utilisations pour calculer les statistiques.
- `android/app/src/main/java/com/julien/genpwdpro/presentation/preset/PresetViewModel.kt`
  - 3 accès Room pour gérer les presets.
- `android/app/src/test/java/com/julien/genpwdpro/data/sync/VaultSyncManagerTest.kt`
  - 3 références héritées dans les tests unitaires.

## Prochaines étapes suggérées

### 1. Migration des ViewModels vers le dépôt file-based

Objectif : faire transiter les écrans encore couplés à Room (`GeneratorViewModel`,
`PresetViewModel`, `PasswordHealthViewModel`) vers `FileVaultRepository` et
`VaultSessionManager`.

Étapes détaillées :

1. **Identifier les méthodes utilisées** dans chaque ViewModel (`getPresets`,
   `recordPresetUsage`, `getEntries`, etc.) et noter les équivalents côté
   `FileVaultRepository`.
2. **Compléter `FileVaultRepository` si nécessaire** (nouveaux flux pour les presets,
   helpers de filtrage, fonctions `canCreatePreset`, etc.) afin de couvrir le même périmètre
   fonctionnel que l'ancien `VaultRepository`.
3. **Mettre à jour l'injection Hilt** des ViewModels pour dépendre de
   `FileVaultRepository` uniquement.
4. **Adapter la logique interne** des ViewModels (par exemple la sélection du preset
   par défaut ou le chargement des statistiques de santé) pour travailler avec les modèles
   renvoyés par `FileVaultRepository`.
5. **Supprimer les imports Room inutiles** dans les ViewModels (DAO, entités chiffrées).
6. **Vérifier la compilation** et les aperçus Compose concernés.

### 2. Convertisseurs domaine sans dépendance Room

Objectif : découpler `SecureNote`, `SecureIdentity`, `SecureCard` et `SecureWifi` du modèle
`VaultRepository.DecryptedEntry`.

Étapes détaillées :

1. **Créer de nouveaux modèles domaine** (par exemple `VaultEntryModel` et `VaultPresetModel`)
   exposés par `FileVaultRepository`.
2. **Réécrire les fonctions `toDecryptedEntry()` / `fromDecryptedEntry()`** pour qu’elles
   s’appuient sur ces nouveaux modèles et non plus sur `VaultRepository`.
3. **Mettre à jour les tests** ou exemples d’utilisation pour refléter les nouvelles
   signatures.
4. **Supprimer les dépendances résiduelles** vers `VaultRepository` dans le module `domain`.

### 3. Refactor orchestration Sync / Import / Export

Objectif : faire passer `ImportExportRepository`, `VaultSyncManager` (et leurs tests) par
`VaultSessionManager` plutôt que par Room.

Étapes détaillées :

1. **Remplacer l’accès direct aux DAO** (`VaultDao`, `VaultEntryDao`, etc.) par des appels à
   `VaultSessionManager` pour récupérer les données déchiffrées.
2. **Isoler la logique d’import/export** dans des helpers qui consomment les modèles
   file-based (entries, presets, tags) afin d’éviter tout couplage avec les entités Room.
3. **Mettre à jour `VaultSyncManagerTest`** pour initialiser une session file-based de test
   au lieu de préparer une base Room.
4. **Retirer la dépendance directe** à `VaultRepository` dans ces classes une fois la migration
   terminée.

### 4. Allègement de `DatabaseModule`

Objectif : ne conserver dans la configuration Dagger/Hilt que les composants réellement utiles à
Room (migration de données, import d’archives, etc.).

Étapes détaillées :

1. **Supprimer la fourniture de `VaultRepository`** et des DAO non utilisés dans les modules
   Hilt.
2. **Documenter les bindings résiduels** (par exemple pour des migrations ponctuelles) pour
   éviter les regressions.
3. **Exécuter `legacy_room_audit.py`** afin de s’assurer qu’aucune dépendance non désirée ne
   persiste.

Le script d'audit peut être relancé après chaque migration partielle pour suivre la disparition
progressive des dépendances Room.

## FAQ – Questions challenges pour Codex

1. **Pourquoi le nom de branche ne correspond pas au contenu ?**

   La branche de travail locale s'appelle `work` car elle agrège les investigations en cours, mais la branche de référence documentée reste `claude/entry-crud-refactor-011CUYLbVDNVdxF238ZuefAf`, qui contient l'implémentation complète file-based et les correctifs biométriques. L'écart vient donc d'une branche d'intégration temporaire par rapport à la branche produit recommandée.【F:BRANCHES_STATUS.md†L3-L198】【3446af†L1-L12】【e22c9b†L1-L2】

2. **Quelle est la stratégie de rollback si la synchronisation legacy cause des problèmes ?**

   `FileVaultRepository` attrape déjà toutes les exceptions lors du verrouillage/déverrouillage synchronisé et continue de s'appuyer sur `VaultSessionManager` (file-based) comme source de vérité. En cas d'échec, seule la partie Room reste verrouillée tandis que le flux file-based continue de fonctionner, ce qui constitue un rollback implicite vers le comportement moderne sans interrompre l'utilisateur.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L397-L485】

3. **Le script d'audit a-t-il été exécuté sur le projet actuel ? Quels sont les résultats ?**

   Oui, l'exécution du `28 octobre 2025` relève `53` usages de `VaultRepository`, `19` références à `AppDatabase`, `137` annotations Room et aucune instanciation directe de `Room.databaseBuilder`. Le détail par fichier est archivé dans `/tmp/audit.txt` pour traçabilité.【F:docs/legacy_room_usage_report.md†L18-L61】【3446af†L1-L86】

4. **Comment tester que les données ne sont pas corrompues pendant la synchronisation ?**

   Les opérations d'écriture passent exclusivement par `VaultSessionManager`, ce qui garantit que les flux réactifs (`Flow`) reflètent les données persistées. Les tests d'intégration doivent vérifier que les collections exposées (`getEntries`, `getPresets`, `getTags`) conservent leurs invariants après un cycle unlock/save/lock, tout en surveillant que `syncLegacyRepositoryUnlock` ne remonte aucune erreur pendant ces scénarios.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L52-L485】

5. **Que se passe-t-il si `legacyVaultRepository` est null ou non initialisé ?**

   L'injection constructeur est annotée `@Inject` et le paramètre est non nullable ; Hilt refusera de démarrer si la dépendance n'est pas fournie. Cela force un état consistant au runtime et empêche tout `null` implicite dans le code Kotlin.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L37-L43】

6. **Faut-il un flag de feature toggle pour cette synchronisation ?**

   Tant que des consommateurs Room existent, la synchronisation d'état (unlock/lock) reste nécessaire ; cependant, un feature flag Hilt (`@Named`/`@BindsInstance`) peut être ajouté pour désactiver l'appel à `syncLegacyRepositoryUnlock` une fois les ViewModels migrés. Cette approche permettra de retirer progressivement la dépendance sans recompiler les anciennes builds.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L400-L485】

7. **Comment gérer les conflits de version entre Room et file-based ?**

   Room n'est plus autorisé à modifier les données pendant que `VaultSessionManager` est maître : la synchronisation se limite au déverrouillage/verrouillage pour maintenir la compatibilité de lecture. Toute divergence structurelle doit être réglée via les migrations existantes d'`AppDatabase` avant l'étape finale de retrait, comme rappelé dans le module DI.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L400-L485】【F:android/app/src/main/java/com/julien/genpwdpro/di/DatabaseModule.kt†L8-L155】

8. **Est-ce que cette synchronisation bidirectionnelle ne crée pas un couplage fort qu'on voulait éviter ?**

   La synchronisation actuelle est strictement unidirectionnelle (file-based ➜ Room) pour signaler l'état de session. Aucun appel Room n'est effectué pour écrire dans la couche file-based, ce qui limite le couplage aux seules opérations d'état et laisse la logique métier concentrée dans `VaultSessionManager`.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L397-L485】

9. **Ne devrait-on pas avoir une migration one-shot plutôt qu'une synchronisation permanente ?**

   Oui : la feuille de route existante préconise de migrer progressivement chaque consommateur Room, puis de retirer la synchronisation. La synchronisation n'est qu'une mesure transitoire pour éviter les régressions tant que les ViewModels et services listés plus haut n'ont pas été refactorés.【F:docs/legacy_room_usage_report.md†L32-L119】

10. **Comment garantir que le script d'audit détecte TOUTES les dépendances Room ?**

    Le script parcourt récursivement les fichiers Kotlin/Java/XML, ignore les répertoires générés et évalue quatre motifs distincts (`VaultRepository`, annotations Room, `AppDatabase`, API `Room`). Les patterns peuvent être étendus au besoin, mais couvrent déjà les points d'entrée standards d'Android Room.【F:tools/legacy_room_audit.py†L17-L116】

11. **Quel est l'impact performance de cette double synchronisation ?**

    La synchronisation ajoute uniquement un appel `unlockVault`/`lockVault` côté Room lorsqu'une session est ouverte ou fermée. Aucune copie de données n'est effectuée pendant les CRUD (`Flow` reste file-based), ce qui limite l'impact à un aller-retour léger sur le thread IO lors des changements d'état.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L397-L485】

12. **Y a-t-il un risque de perte de données pour l'utilisateur ?**

    Non : toutes les écritures passent par `VaultSessionManager` et sont sauvegardées via `saveCurrentVault`. En cas d'échec de la synchronisation legacy, un warning est loggé mais aucune suppression Room n'est déclenchée, ce qui protège les données file-based et legacy simultanément.【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L429-L485】

13. **Comment communiquer cette migration aux utilisateurs existants ?**

    La documentation doit souligner que la migration est transparente, que les coffres existants restent accessibles et que la biométrie est consolidée via `BiometricVaultManager`. Les notes de version peuvent s'appuyer sur ce rapport pour expliquer l'état transitoire et inviter les testeurs à signaler toute divergence sur les écrans encore branchés sur Room.【F:docs/legacy_room_usage_report.md†L32-L119】【F:android/app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt†L434-L474】

