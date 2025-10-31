# Architecture GenPwd Pro Android - État Actuel (Post-Migration)

**Dernière mise à jour :** 2025-10-30
**Branche :** `android`
**Version :** 1.1.0

---

## ⚠️ IMPORTANT : Migration Terminée

**La migration du système Room vers les fichiers .gpv est TERMINÉE.**

- ❌ **NE PLUS référencer le système Room-based comme architecture principale**
- ✅ **Le système file-based (.gpv) est l'architecture de production**
- ⚠️ **Room est utilisé uniquement pour les métadonnées (registre, historique)**

---

## 🏗️ Architecture Actuelle

### Vue d'Ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                     UI LAYER (Jetpack Compose)               │
│  - Screens, ViewModels, Components                           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   DOMAIN LAYER                               │
│  - Use Cases, Business Logic, Session Management             │
│  - VaultSessionManager (Single Source of Truth)              │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│  ┌────────────────────────┐  ┌─────────────────────────┐    │
│  │ FileVaultRepository    │  │ Room Database           │    │
│  │ (Données sensibles)    │  │ (Métadonnées)           │    │
│  │                        │  │                         │    │
│  │ - Fichiers .gpv        │  │ - VaultRegistryEntry    │    │
│  │ - VaultFileManager     │  │ - PasswordHistoryEntity │    │
│  │ - VaultCryptoManager   │  │                         │    │
│  └────────────────────────┘  └─────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📂 Système de Stockage des Vaults

### Format .gpv (GenPwd Vault)

**Fichier :** `MonCoffre.gpv`

**Structure (chiffrée) :**
```json
{
  "version": "1.0",
  "id": "uuid-du-vault",
  "name": "Mon Coffre",
  "description": "Description optionnelle",
  "kdf": {
    "algorithm": "argon2id",
    "iterations": 3,
    "memoryKB": 65536,
    "parallelism": 4,
    "salt": "base64..."
  },
  "encryption": {
    "algorithm": "AES-256-GCM",
    "encryptedKey": "base64...",
    "keyIv": "base64..."
  },
  "entries": [
    {
      "id": "uuid-entry",
      "type": "LOGIN|NOTE|CARD|IDENTITY",
      "title": "Titre",
      "folderId": "uuid-folder",
      "tags": ["tag1", "tag2"],
      "encryptedData": "base64...",
      "dataIv": "base64...",
      "createdAt": 1234567890,
      "modifiedAt": 1234567890
    }
  ],
  "folders": [...],
  "tags": [...],
  "presets": [...]
}
```

**Avantages :**
- ✅ Portable (copie de fichier = sauvegarde)
- ✅ Compatible cloud sync (Dropbox, Drive, WebDAV)
- ✅ Indépendant de la plateforme (iOS/Desktop futur)
- ✅ Lisible (JSON chiffré)
- ✅ Versionnable

---

## 🗄️ Room Database - Rôle Actuel

### Entités Actives (Production)

#### 1. VaultRegistryEntry
**Table :** `vault_registry`
**Rôle :** Registre des coffres (métadonnées)

```kotlin
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    val id: String,                    // UUID du vault
    val name: String,                  // Nom affiché
    val filePath: String,              // Chemin vers le .gpv
    val storageStrategy: StorageStrategy, // FILE | SAF | CLOUD
    val fileSize: Long,                // Taille en bytes
    val lastModified: Long,            // Timestamp modification
    val lastAccessed: Long?,           // Dernier déverrouillage
    val isDefault: Boolean,            // Coffre par défaut
    val isLoaded: Boolean,             // Chargé en mémoire
    val statistics: VaultStatistics,   // Stats (nb entrées, etc.)
    val biometricUnlockEnabled: Boolean,
    val encryptedMasterPassword: ByteArray?, // Pour biométrie
    val masterPasswordIv: ByteArray?
)
```

**Usage :**
- Liste des coffres dans l'UI
- Statistiques du dashboard
- Configuration biométrique
- Suivi des fichiers .gpv

#### 2. PasswordHistoryEntity
**Table :** `password_history`
**Rôle :** Historique des mots de passe générés

```kotlin
@Entity(tableName = "password_history")
data class PasswordHistoryEntity(
    val id: String,
    val encryptedPassword: String,
    val iv: String,
    val timestamp: Long,
    val strength: Int,
    val entropy: Double,
    val generationMode: GenerationMode,
    val isFavorite: Boolean,
    val note: String
)
```

**Usage :**
- Écran Historique
- Générateur rapide du Dashboard
- Statistiques de génération

### Entités Legacy (conservées pour migration)

Les artefacts Room historiques demeurent dans le dépôt pour faciliter les migrations ponctuelles et la rétro-ingénierie des
anciens coffres :

- `VaultEntity` - Ancien système de vault Room
- `VaultEntryEntity` - Anciennes entrées Room
- `FolderEntity` - Anciens dossiers Room
- `TagEntity` - Anciens tags Room
- `PresetEntity` - Anciens presets Room

Ils ne sont plus injectés dans Hilt ni accessibles en runtime. Toute réutilisation nécessite un wiring manuel explicite dans une
branche dédiée à la migration.

---

## 🔑 Flux de Gestion des Vaults

### 1. Création d'un Vault

```
User Input (nom + master password)
         ↓
VaultSessionManager.createVault()
         ↓
VaultCryptoManager.deriveKey(password, argon2id)
         ↓
Generate vault encryption key (AES-256)
         ↓
Encrypt vault key with derived key
         ↓
VaultFileManager.saveToFile("MonCoffre.gpv")
         ↓
VaultRegistryDao.insert(VaultRegistryEntry)
```

### 2. Déverrouillage d'un Vault

```
User Input (master password) OU Biometric Auth
         ↓
[Biometric] → KeystoreManager.decrypt(encryptedMasterPassword)
         ↓
VaultFileManager.loadFromFile("MonCoffre.gpv")
         ↓
VaultCryptoManager.deriveKey(password, argon2id)
         ↓
Decrypt vault key
         ↓
VaultSessionManager.unlockVault(vaultKey) → Keep in memory
         ↓
VaultRegistryDao.update(lastAccessed, isLoaded = true)
```

### 3. Lecture/Écriture d'Entrées

```
VaultSessionManager.getEntry(entryId)
         ↓
Retrieve vault from memory (VaultData)
         ↓
Find entry in entries list
         ↓
VaultCryptoManager.decrypt(encryptedData, vaultKey)
         ↓
Return EntryData to UI
```

**Sauvegarde :**
```
VaultSessionManager.saveEntry(entry)
         ↓
Update VaultData in memory
         ↓
VaultCryptoManager.encrypt(entryData, vaultKey)
         ↓
VaultFileManager.saveToFile("MonCoffre.gpv")
         ↓
VaultRegistryDao.update(statistics, lastModified)
```

### 4. Verrouillage

```
VaultSessionManager.lockVault(vaultId)
         ↓
Wipe vault key from memory (SecretKey.destroy())
         ↓
Clear VaultData from ConcurrentHashMap
         ↓
VaultRegistryDao.update(isLoaded = false)
```

---

## 🧩 Composants Clés

### VaultSessionManager
**Localisation :** `domain/session/VaultSessionManager.kt`
**Rôle :** Single Source of Truth pour les vaults file-based

**Responsabilités :**
- Gestion des sessions en mémoire
- Chargement/déchargement des vaults
- CRUD sur les entrées/dossiers/tags/presets
- Coordination avec VaultFileManager
- Auto-lock management

**API Principale :**
```kotlin
suspend fun createVault(name: String, password: String, strategy: StorageStrategy): Result<String>
suspend fun unlockVault(vaultId: String, password: String): Result<Unit>
suspend fun lockVault(vaultId: String)
suspend fun saveEntry(vaultId: String, entry: EntryData): Result<Unit>
suspend fun getEntry(vaultId: String, entryId: String): Result<EntryData>
suspend fun deleteEntry(vaultId: String, entryId: String): Result<Unit>
// + folders, tags, presets, search, etc.
```

### FileVaultRepository
**Localisation :** `data/repository/FileVaultRepository.kt`
**Rôle :** Couche d'abstraction entre UI et VaultSessionManager

**Responsabilités :**
- Fournir une API haut niveau pour les ViewModels
- Transformer les données pour l'UI (Flows, StateFlow)
- Gestion des erreurs et logging
- Intégration avec VaultRegistry

**Injection :**
```kotlin
@HiltViewModel
class MyViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository  // ✅ Utiliser celui-ci
    // PAS: private val vaultRepository: VaultRepository  // ❌ Legacy
)
```

### VaultFileManager
**Localisation :** `data/vault/VaultFileManager.kt`
**Rôle :** Gestion I/O des fichiers .gpv

**Responsabilités :**
- Lecture/écriture des fichiers .gpv
- Support Storage Access Framework (SAF)
- Gestion des permissions
- Validation de l'intégrité des fichiers

### VaultCryptoManager
**Localisation :** `data/crypto/VaultCryptoManager.kt`
**Rôle :** Opérations cryptographiques

**Responsabilités :**
- Dérivation de clés (Argon2id)
- Chiffrement/déchiffrement (AES-256-GCM)
- Génération de clés aléatoires
- Gestion des IVs

---

## 🔐 Sécurité

### Chiffrement en Couches

1. **Master Password → Derived Key (Argon2id)**
   - 3 iterations
   - 64 MB memory
   - 4 threads parallelism
   - Salt unique par vault

2. **Derived Key → Vault Key (AES-256-GCM)**
   - Vault key générée aléatoirement
   - Chiffrée avec la derived key
   - Stockée dans le fichier .gpv

3. **Vault Key → Entry Data (AES-256-GCM)**
   - Chaque champ sensible chiffré individuellement
   - IV unique par champ
   - Authentification GCM

### Zero-Knowledge

- ❌ Master password **jamais stocké** (ni en clair ni haché)
- ❌ Derived key **jamais stockée**
- ✅ Vault key **en mémoire uniquement** (pendant session)
- ✅ Biométrie : Master password chiffré avec Android Keystore (hardware-backed)

### Protection Mémoire

```kotlin
// Effacement sécurisé au verrouillage
unlockedKeys.remove(vaultId)?.destroy()
loadedVaults.remove(vaultId)
```

---

## 📊 Statistiques et Métadonnées

### VaultStatistics (Embedded dans VaultRegistryEntry)

```kotlin
data class VaultStatistics(
    val totalEntries: Int = 0,
    val loginEntries: Int = 0,
    val noteEntries: Int = 0,
    val cardEntries: Int = 0,
    val identityEntries: Int = 0,
    val totalFolders: Int = 0,
    val totalTags: Int = 0,
    val totalPresets: Int = 0,
    val favoriteEntries: Int = 0,
    val entriesWithTOTP: Int = 0
)
```

**Mise à jour :**
- Après chaque modification du vault
- Au chargement initial
- Affichées dans le Dashboard

---

## 🌐 Synchronisation Cloud

### Architecture Sync

```
FileVaultRepository
         ↓
CloudProviderSyncRepository
         ↓
┌────────────────┬──────────────┬──────────────┐
│ GoogleDrive    │ WebDAV       │ OneDrive     │
│ Provider       │ Provider     │ Provider     │
│ (✅ Prod)      │ (✅ Prod)    │ (⏳ Template)│
└────────────────┴──────────────┴──────────────┘
         ↓
VaultFileManager (upload/download .gpv files)
```

**Statut des Providers :**
- ✅ **Google Drive** : Production (OAuth2, API v3)
- ✅ **WebDAV** : Production (Nextcloud, ownCloud, Synology)
- ⏳ **OneDrive** : Template 40% (guide d'implémentation disponible)
- ⏳ **pCloud** : Template 40%
- ⏳ **ProtonDrive** : Template 40%

**Résolution de Conflits :**
- `LOCAL_WINS` - Garder la version locale
- `REMOTE_WINS` - Garder la version distante
- `NEWEST_WINS` - Garder la plus récente (par timestamp)
- `SMART_MERGE` - Fusion intelligente (merge entries)
- `MANUAL` - Demander à l'utilisateur

---

## 🧪 Tests

### Stratégie de Test

**Unit Tests :**
- `VaultSessionManagerTest.kt`
- `VaultCryptoManagerTest.kt`
- `FileVaultRepositoryTest.kt`

**Integration Tests :**
- `VaultFileManagerTest.kt`
- `CloudSyncIntegrationTest.kt`

**Instrumented Tests :**
- `EncryptedAppDatabaseTest.kt`
- `SecureFlagInstrumentationTest.kt`
- `BiometricAuthTest.kt`

**Couverture :** ~85-90% sur les composants critiques

---

## 🚀 Migration des Anciennes Données

### Pour les utilisateurs existants (Room → .gpv)

**Outil :** `LegacyVaultMigrationTool` (en développement)

**Processus :**
1. Détection des vaults Room au premier lancement
2. Affichage d'une notification de migration
3. Export des données Room vers format .gpv
4. Création des VaultRegistryEntry
5. Archivage des anciennes données
6. Suppression après confirmation

**Statut :** ⏳ En cours d'implémentation

---

## 📝 Checklist d'Intégration

### Pour ajouter une nouvelle fonctionnalité vault :

- [ ] Modifier `VaultData` (domain model) si nécessaire
- [ ] Ajouter la méthode dans `VaultSessionManager`
- [ ] Exposer via `FileVaultRepository` pour l'UI
- [ ] Mettre à jour le JSON serialization/deserialization
- [ ] Gérer le chiffrement si données sensibles
- [ ] Mettre à jour `VaultStatistics` si applicable
- [ ] Tester avec fichiers .gpv existants (rétrocompatibilité)
- [ ] Documenter dans les commentaires

### Pour ajouter un nouveau ViewModel :

```kotlin
@HiltViewModel
class MyNewViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,  // ✅ Correct
    private val vaultSessionManager: VaultSessionManager   // ✅ Aussi possible
    // private val vaultRepository: VaultRepository        // ❌ Ne plus utiliser
) : ViewModel() {
    // Implementation
}
```

---

## 🔍 Références Rapides

### Fichiers Clés

| Composant | Fichier |
|-----------|---------|
| Session Manager | `domain/session/VaultSessionManager.kt` |
| Repository | `data/repository/FileVaultRepository.kt` |
| File I/O | `data/vault/VaultFileManager.kt` |
| Crypto | `data/crypto/VaultCryptoManager.kt` |
| Registry DAO | `data/db/dao/VaultRegistryDao.kt` |
| Registry Entity | `data/db/entity/VaultRegistryEntry.kt` |
| Database | `data/db/database/AppDatabase.kt` |
| DI Module | `di/DatabaseModule.kt` |

### Documentation

- `/android/README.md` - Documentation principale Android
- `/android/CLOUD_SYNC_README.md` - Guide synchronisation cloud
- `/android/OAUTH2_SETUP_GUIDE.md` - Configuration OAuth2
- `/android/PRESET_USER_GUIDE.md` - Guide des presets
- `/docs/` - Documentation technique générale

---

## ❓ FAQ pour Futures Sessions

### Q: Quel repository dois-je utiliser dans un nouveau ViewModel ?
**R:** `FileVaultRepository` - C'est le repository de production.

### Q: Room est-il encore utilisé pour les vaults ?
**R:** Non. Room stocke uniquement le registre (`VaultRegistryEntry`) et l'historique (`PasswordHistoryEntity`).

### Q: Où sont stockées les données des vaults ?
**R:** Dans des fichiers `.gpv` (JSON chiffré) sur le filesystem ou via SAF.

### Q: Que fait `VaultRepository` (sans "File") ?
**R:** C'est l'ancien système legacy, actif uniquement en mode DEBUG pour compatibilité.

### Q: Comment ajouter une entrée à un vault ?
**R:** Via `VaultSessionManager.saveEntry()` ou `FileVaultRepository.saveEntry()`.

### Q: Les données sont-elles chiffrées en base de données ?
**R:** Les métadonnées dans Room ne sont pas sensibles (pas besoin de chiffrement). Les données sensibles sont dans les fichiers .gpv (chiffrés).

### Q: Comment fonctionne le déverrouillage biométrique ?
**R:** Le master password est chiffré avec Android Keystore et stocké dans `VaultRegistryEntry.encryptedMasterPassword`.

---

## 🎯 Résumé pour Futures Sessions

```
✅ SYSTÈME ACTUEL : Fichiers .gpv (file-based)
❌ ANCIEN SYSTÈME : Room vaults (deprecated, DEBUG only)

✅ UTILISER : FileVaultRepository, VaultSessionManager
❌ NE PLUS UTILISER : VaultRepository (legacy)

✅ ROOM POUR : Registre des vaults (VaultRegistryEntry) + Historique (PasswordHistoryEntity)
❌ ROOM POUR : Stocker les entrées de vault (obsolète)

✅ FORMAT : JSON chiffré dans fichiers .gpv
❌ FORMAT : Données dans SQLite (obsolète)
```

---

**Date de création :** 2025-10-30
**Auteur :** Documentation automatisée
**Branche :** android
**Dernière révision :** 2025-10-30
