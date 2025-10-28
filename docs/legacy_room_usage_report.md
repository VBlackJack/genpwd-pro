# Legacy Room Usage Report

Ce document synthétise l'état actuel de la transition vers le nouveau système de coffres basé
sur des fichiers. Il est généré manuellement à l'aide de `tools/legacy_room_audit.py`, un
script qui repère les références au dépôt Room historique.

## Comment exécuter l'audit

```bash
python tools/legacy_room_audit.py --root .
```

Options utiles :

- `--json` : exporte le rapport au format JSON pour être facilement parsé ou archivé.
- `--pattern <nom>` : limite l'analyse à un motif spécifique (ex. `legacy_vault_repository`).

## Résumé du scan

Exécution du 28 octobre 2025 (UTC) depuis la racine du dépôt :

| Motif                         | Description                                             | Occurrences |
|------------------------------|---------------------------------------------------------|-------------|
| `legacy_vault_repository`    | Usages de `VaultRepository` (implémentation Room)       | 53          |
| `app_database_singletons`    | Références directes à `AppDatabase` (Room)              | 19          |
| `room_annotations`           | Annotations `@Dao`, `@Entity`, `@Query`, `@Database`    | 137         |
| `room_database_builder`      | Usage direct de `Room.databaseBuilder` / imports Room   | 0           |

_Source : sortie textuelle du script (`/tmp/legacy_report.txt`)._

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

1. **Basculer les ViewModels restants** (`GeneratorViewModel`, `PresetViewModel`,
   `PasswordHealthViewModel`) vers `FileVaultRepository` et les nouveaux flux de sessions.
2. **Remplacer les convertisseurs de `SecureNote`** pour qu'ils utilisent des modèles
domaines indépendants de Room.
3. **Refactorer `ImportExportRepository` et `VaultSyncManager`** afin qu'ils orchestrent les
opérations via `VaultSessionManager` au lieu de s'appuyer sur Room.
4. **Réduire la surface de `DatabaseModule`** en supprimant la fourniture directe de
`VaultRepository` dès que les consommateurs ci-dessus auront été migrés.

Le script d'audit peut être relancé après chaque migration partielle pour suivre la disparition
progressive des dépendances Room.
