# Persistence Architecture & Legacy Migration

This document describes the current persistence stack as well as the one-off migration
path that moves the historical in-memory cache into the SQLCipher-backed Room database.

## Overview

* **Primary storage** – `AppDatabase` (SQLCipher Room) stores vault metadata, encrypted
  entries, folders, tags, presets and registry information.
* **Legacy cache** – Older builds serialised unlocked vaults as JSON files inside the
  private storage directory `files/legacy_inmemory/` (temporary copies could also live in
  `cache/legacy_inmemory/`). These snapshots were encrypted at rest only by the filesystem
  sandbox and must be migrated into SQLCipher during upgrade.
* **Migration coordinator** – `LegacyInMemoryMigrationManager` runs exactly once during
  application start. It imports the snapshots, wipes the cache files and reports progress
  to `LegacyMigrationStateStore`.

The upgrade workflow is triggered from `GenPwdProApplication` before any component relies on
Room data. The migration is skipped automatically when the SQLCipher database already exists
or when the state store marks the migration as completed.

## Migration Flow

1. `LegacyInMemoryMigrationManager.migrateIfNeeded()` checks if the migration was already
   executed. If not, it evaluates whether the SQLCipher database exists and whether any
   legacy cache files are present.
2. `LegacyInMemoryStore.loadSnapshots()` parses every JSON file located in
   `files/legacy_inmemory/` or `cache/legacy_inmemory/` into `LegacyVaultSnapshot` objects.
   Each snapshot bundles the Room entities (`VaultEntity`, `VaultEntryEntity`, `FolderEntity`,
   `TagEntity`, `PresetEntity`, `EntryTagCrossRef`) required to rebuild the vault.
3. Using `AppDatabase.withTransaction`, the migrator inserts the entities via the DAOs
   (`VaultDao`, `VaultEntryDao`, `FolderDao`, `TagDao`, `PresetDao`). Successfully imported
   snapshots are recorded so they can be wiped afterwards.
4. After a successful import, `LegacyInMemoryStore.secureWipe()` overwrites every processed
   cache file with zeroes and removes empty directories. The state store is updated so the
   migration never runs again.

## Failure Handling & Recovery

* **Partial failures** – When some snapshots cannot be imported (missing metadata or write
  error), the migrator keeps their cache files untouched, logs the failure and records the
  affected vault IDs inside `LegacyMigrationStateStore`. The user is prompted to re-authenticate
  on the next launch (`MainActivity` reads the state store and displays a toast).
* **Fatal failures** – If the Room transaction fails entirely, all vault IDs are registered in
  the state store. The migration is retried on the next launch after the user unlocks their
  vaults manually.
* **Audit logging** – Every outcome is logged via `SafeLog` in `GenPwdProApplication` to assist
  with support diagnostics. Successful runs detail how many vaults and entries were imported.

## Manual Recovery

1. **User prompt** – When the application displays the “mise à jour de sécurité” prompt, users
   should unlock each vault manually. This action recreates the Room metadata and allows the
   migration to resume on the next launch.
2. **Developer intervention** – If cache files remain after repeated attempts, pull the contents
   of `files/legacy_inmemory/` for offline inspection. Each JSON file can be opened with the
   repository’s `LegacyInMemoryVaultContainer` schema to verify integrity.
3. **Cleanup** – After confirming that data is safely stored inside SQLCipher, remove any leftover
   cache files and call `LegacyMigrationStateStore.clearMigrationCompleted()` via an internal
   build to force the migrator to rerun if additional validation is required.

## Related Components

* `LegacyInMemoryStore` – Disk access, JSON parsing and secure wipe helpers.
* `LegacyMigrationStateStore` – Small preference-backed state machine guarding idempotency and
  user prompts.
* `LegacyInMemoryMigrationManager` – Transactional import logic.
* `GenPwdProApplication` – Triggers the migration before strict-mode and sync initialization.
* `MainActivity` – Surfaces partial migration results to the user via a toast notification.
