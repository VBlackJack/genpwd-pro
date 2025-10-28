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
