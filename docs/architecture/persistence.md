# Persistence Architecture

This document summarises the storage stack that powers GenPwd Pro after the
retirement of the legacy in-memory cache.

## Components

- **Vault registry (Room / SQLCipher)** – `AppDatabase` tracks the vault
  catalogue, presets, folders, tags and other metadata. Every entry stored in
  the database remains encrypted at rest through SQLCipher.
- **Vault files (`.gpv`)** – `VaultFileManager` persists encrypted vault
  payloads to disk using the storage strategy selected by the user
  (application-private directory or Storage Access Framework document).
- **Session management** – `VaultSessionManager` coordinates unlock / lock
  events for the file-based vaults and enforces inactivity timeouts.
- **Cloud synchronisation** – `SyncInitializer` and
  `CloudProviderSyncRepository` orchestrate remote providers and background
  workers.

## Startup Flow

1. `GenPwdProApplication` installs strict-mode policies, crash handling and
   initialises the Tink AEAD configuration once at startup.
2. `SyncInitializer.initialize()` runs on a background dispatcher to restore
   any configured provider, reschedule sync workers and prime `SyncManager`.
3. `VaultStartupLocker.secureStartup()` (triggered from the UI layer) ensures
   the in-memory session is locked and that registry flags are reset before the
   user interacts with the vault list.

## Legacy Migration

The old JSON-based “in-memory” cache was migrated to SQLCipher in previous
releases. All runtime migration code (`LegacyInMemoryMigrationManager`,
`LegacyInMemoryStore`, etc.) has now been removed from the application. Should
historical inspection ever be required, refer to the corresponding git history
(before commit `ce9b2fcd09e3b3a08269c32fd74ff67d5c389ed5`) for implementation
references.

With the legacy pathway retired, the application now depends solely on the
file-based vault system for persistence.
