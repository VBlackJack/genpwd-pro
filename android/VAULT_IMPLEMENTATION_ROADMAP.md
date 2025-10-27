# 🚀 Vault Management - Implementation Roadmap

Feuille de route pour l'implémentation complète du système de gestion des vaults basé sur fichiers.

**Date début** : 27 octobre 2025
**Version actuelle** : Phase 1 complétée ✅
**Version cible** : v2.6.0
**Branch** : `claude/android-ux-design-011CUXbWzXbED17n7GUmyX47`

---

## ✅ Phase 1: Core Infrastructure (COMPLÉTÉE)

**Status** : ✅ **FAIT** - Commit `0f7187f`
**Durée réelle** : Session 1
**Fichiers créés** : 6

### Implémenté :

1. **Data Models** (`data/models/vault/`)
   - ✅ `StorageStrategy.kt` - 4 stratégies de stockage
   - ✅ `VaultFileHeader.kt` - Header 256 bytes
   - ✅ `VaultData.kt` - Structures de données complètes

2. **Database** (`data/local/`)
   - ✅ `VaultRegistryEntry.kt` - Entity pour registre
   - ✅ `VaultRegistryDao.kt` - DAO complet avec transactions

3. **File Manager** (`data/vault/`)
   - ✅ `VaultFileManager.kt` - Gestion fichiers .gpv
   - ✅ Format .gpv défini (Header + Content chiffré)
   - ✅ Méthodes create, load, save, delete, export

### Ce qui fonctionne :

- Structure de base pour fichiers .gpv
- Registre des vaults dans Room DB
- API complète pour opérations fichiers

---

## 🔄 Phase 2: Integration & Helpers (EN COURS)

**Status** : 📝 À FAIRE
**Estimation** : 1-2 jours
**Priorité** : 🔴 HAUTE

### Tâches :

#### 2.1 VaultCryptoManager Helpers
**Fichier** : `data/crypto/VaultCryptoManager.kt`

Ajouter méthodes helper pour VaultFileManager :

```kotlin
/**
 * Génère un salt déterministe depuis une chaîne
 * (pour utiliser vaultId comme base du salt)
 */
fun generateSaltFromString(seed: String): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    return digest.digest(seed.toByteArray(Charsets.UTF_8))
}

/**
 * Chiffre des bytes avec génération automatique d'IV
 * Retourne: IV (12 bytes) + Ciphertext + Tag
 */
fun encryptBytes(plaintext: ByteArray, key: SecretKey): ByteArray {
    val iv = generateIV()
    val encrypted = encryptAESGCM(plaintext, key, iv)
    // Concat: IV + encrypted
    return iv + encrypted
}

/**
 * Déchiffre des bytes (extrait l'IV automatiquement)
 * Input: IV (12 bytes) + Ciphertext + Tag
 */
fun decryptBytes(ciphertext: ByteArray, key: SecretKey): ByteArray {
    val iv = ciphertext.copyOfRange(0, IV_LENGTH)
    val encrypted = ciphertext.copyOfRange(IV_LENGTH, ciphertext.size)
    return decryptAESGCM(encrypted, key, iv)
}
```

**Test** : Vérifier chiffrement/déchiffrement roundtrip

#### 2.2 Database Migration 5→6
**Fichier** : `data/local/database/AppDatabase.kt`

```kotlin
// 1. Ajouter VaultRegistryEntry aux entities
@Database(
    entities = [
        ...,
        VaultRegistryEntry::class  // AJOUTER
    ],
    version = 6,  // INCRÉMENTER
    ...
)

// 2. Ajouter DAO
abstract fun vaultRegistryDao(): VaultRegistryDao

// 3. Créer migration
val MIGRATION_5_6 = object : Migration(5, 6) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS vault_registry (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                filePath TEXT NOT NULL,
                storageStrategy TEXT NOT NULL,
                fileSize INTEGER NOT NULL,
                lastModified INTEGER NOT NULL,
                lastAccessed INTEGER,
                isDefault INTEGER NOT NULL DEFAULT 0,
                isLoaded INTEGER NOT NULL DEFAULT 0,
                entryCount INTEGER NOT NULL DEFAULT 0,
                folderCount INTEGER NOT NULL DEFAULT 0,
                presetCount INTEGER NOT NULL DEFAULT 0,
                tagCount INTEGER NOT NULL DEFAULT 0,
                totalSize INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                createdAt INTEGER NOT NULL
            )
        """)

        database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_registry_isDefault ON vault_registry(isDefault)")
        database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_registry_isLoaded ON vault_registry(isLoaded)")
    }
}
```

#### 2.3 DatabaseModule Update
**Fichier** : `di/DatabaseModule.kt`

```kotlin
@Provides
@Singleton
fun provideVaultRegistryDao(database: AppDatabase): VaultRegistryDao {
    return database.vaultRegistryDao()
}

// Dans provideDatabase, ajouter:
.addMigrations(
    ...,
    AppDatabase.MIGRATION_5_6
)
```

#### 2.4 VaultFileManager Fixes

Mettre à jour VaultFileManager pour utiliser les nouvelles méthodes :

```kotlin
// Dans createVaultFile:
val salt = cryptoManager.generateSaltFromString(vaultId)
val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

// Dans readVaultFile/writeVaultFile:
val encryptedContent = cryptoManager.encryptBytes(dataJson.toByteArray(), vaultKey)
val decryptedBytes = cryptoManager.decryptBytes(encryptedContent, vaultKey)
```

**Test** : Créer, sauvegarder, charger un vault .gpv

---

## 🔄 Phase 3: Migration Manager

**Status** : 📝 À FAIRE
**Estimation** : 1 jour
**Priorité** : 🟡 MOYENNE

### Tâches :

#### 3.1 VaultMigrationManager
**Fichier** : `data/vault/VaultMigrationManager.kt` (À CRÉER)

```kotlin
@Singleton
class VaultMigrationManager @Inject constructor(
    private val database: AppDatabase,
    private val vaultRepository: VaultRepository,
    private val fileManager: VaultFileManager,
    private val registryDao: VaultRegistryDao
) {
    /**
     * Migre tous les vaults depuis Room vers fichiers .gpv
     */
    suspend fun migrateToFileBasedSystem(
        onProgress: (current: Int, total: Int) -> Unit = { _, _ -> }
    ): MigrationResult

    /**
     * Migre un vault spécifique
     */
    private suspend fun migrateVault(
        vault: VaultEntity,
        masterPassword: String
    ): Boolean

    /**
     * Crée un backup avant migration
     */
    private suspend fun createBackup(): File
}

data class MigrationResult(
    val success: Boolean,
    val migratedCount: Int,
    val failedCount: Int,
    val backupPath: String?,
    val errors: List<String>
)
```

#### 3.2 Migration Flow

1. Détecter si migration nécessaire (vérifier si vault_registry vide)
2. Créer backup de la DB actuelle
3. Pour chaque vault dans `vaults`:
   - Extraire toutes les données (entries, presets, folders, tags)
   - Créer fichier .gpv avec VaultFileManager
   - Créer entrée VaultRegistryEntry
   - Marquer comme migré
4. Optionnel : Supprimer anciennes données (garder pour rollback)

#### 3.3 UI Migration Dialog

Créer dialogue de progression pour migration :
- Progress bar
- "Migration en cours... X/Y vaults"
- Option d'annuler
- Afficher erreurs si échec

---

## 🎨 Phase 4: UI Implementation

**Status** : 📝 À FAIRE
**Estimation** : 2-3 jours
**Priorité** : 🔴 HAUTE

### Tâches :

#### 4.1 VaultManagerViewModel
**Fichier** : `presentation/vault/VaultManagerViewModel.kt` (À CRÉER)

```kotlin
@HiltViewModel
class VaultManagerViewModel @Inject constructor(
    private val registryDao: VaultRegistryDao,
    private val fileManager: VaultFileManager,
    private val vaultRepository: VaultRepository
) : ViewModel() {

    val vaults: StateFlow<List<VaultRegistryEntry>>
    val uiState: StateFlow<VaultManagerUiState>

    fun loadVault(vaultId: String, password: String)
    fun unloadVault(vaultId: String)
    fun deleteVault(vaultId: String)
    fun exportVault(vaultId: String, destinationUri: Uri)
    fun changeVaultLocation(vaultId: String, newStrategy: StorageStrategy)
    fun setAsDefault(vaultId: String)
}
```

#### 4.2 VaultManagerScreen
**Fichier** : `presentation/vault/VaultManagerScreen.kt` (À CRÉER)

UI Components à créer :
- Liste des vaults avec cards
- Infos : nom, location, taille, nombre d'entrées
- Status indicator (loaded/unloaded)
- Actions menu par vault
- FAB pour créer nouveau vault
- Confirmation dialogs (delete, export)

#### 4.3 CreateVaultDialog Enhancement

Modifier le dialogue existant pour ajouter :
- Choix de StorageStrategy (RadioButtons)
- Explication de chaque stratégie
- Warning pour stratégies non sécurisées

#### 4.4 Navigation Integration

Ajouter route dans NavGraph :
```kotlin
object VaultManager : Screen("vault_manager")
```

---

## 🚀 Phase 5: Advanced Features

**Status** : 📝 À FAIRE
**Estimation** : 2-3 jours
**Priorité** : 🟢 BASSE

### Tâches :

#### 5.1 Export/Import UI

- File picker pour destination export
- Import depuis fichier externe
- Validation de fichier .gpv
- Gestion conflits (vault déjà existant)

#### 5.2 Vault Properties Screen

Écran de détails vault :
- Métadonnées complètes
- Statistiques détaillées
- Historique d'accès
- Taille par catégorie (entries/presets/folders)
- Changer nom, description
- Changer icône/couleur

#### 5.3 Storage Strategy Migration

Permettre de changer la stratégie de stockage d'un vault existant :
- Copier fichier vers nouveau location
- Mettre à jour registry
- Supprimer ancien fichier
- Rollback si échec

#### 5.4 Backup/Restore

- Backup automatique avant opérations risquées
- Restore depuis backup
- UI pour gérer backups
- Nettoyage ancien backups

#### 5.5 Vault Duplication

- Dupliquer un vault existant
- Nouveau master password
- Nouveau fichier .gpv
- Utile pour testing ou backup

---

## 🧪 Phase 6: Testing & Polish

**Status** : 📝 À FAIRE
**Estimation** : 2 jours
**Priorité** : 🔴 HAUTE

### Tâches :

#### 6.1 Unit Tests

Fichiers à tester :
- `VaultFileManagerTest.kt`
  - Create/Load/Save roundtrip
  - Encryption/Decryption
  - Format validation
  - Checksum verification

- `VaultRegistryDaoTest.kt`
  - CRUD operations
  - Default vault management
  - Loaded status tracking

- `VaultMigrationManagerTest.kt`
  - Migration success
  - Migration rollback
  - Backup creation

#### 6.2 Integration Tests

- Créer vault → Sauvegarder → Recharger
- Migration complète ancien système
- Export → Import roundtrip
- Changement de stratégie de stockage

#### 6.3 UI Tests

- Navigation VaultManagerScreen
- Création vault avec différentes stratégies
- Actions menu (delete, export, etc.)
- Migration dialog flow

#### 6.4 Performance Tests

- Load time pour gros vaults (1000+ entries)
- Memory usage avec plusieurs vaults chargés
- File I/O performance
- Encryption/Decryption speed

#### 6.5 Security Audit

- Vérifier keys jamais écrites sur disque
- File permissions correctes
- Checksum validation
- IV uniqueness

---

## 📋 Checklist Complète

### Phase 1 ✅
- [x] StorageStrategy enum
- [x] VaultFileHeader, VaultData models
- [x] VaultRegistryEntry entity
- [x] VaultRegistryDao
- [x] VaultFileManager skeleton

### Phase 2 (Integration)
- [ ] VaultCryptoManager helpers
- [ ] Database migration 5→6
- [ ] DatabaseModule update
- [ ] VaultFileManager fixes
- [ ] Test create/load/save vault

### Phase 3 (Migration)
- [ ] VaultMigrationManager
- [ ] Backup creation
- [ ] Migration flow
- [ ] Migration UI dialog
- [ ] Test migration

### Phase 4 (UI)
- [ ] VaultManagerViewModel
- [ ] VaultManagerScreen
- [ ] CreateVaultDialog enhancement
- [ ] Navigation integration
- [ ] Test UI flow

### Phase 5 (Advanced)
- [ ] Export/Import UI
- [ ] Vault Properties Screen
- [ ] Storage Strategy Migration
- [ ] Backup/Restore
- [ ] Vault Duplication

### Phase 6 (Testing)
- [ ] Unit tests (3 fichiers)
- [ ] Integration tests
- [ ] UI tests
- [ ] Performance tests
- [ ] Security audit

---

## 🎯 Quick Start - Phase 2

Pour continuer l'implémentation, commencer par Phase 2:

1. **Ajouter helpers à VaultCryptoManager** :
   ```bash
   # Éditer: data/crypto/VaultCryptoManager.kt
   # Ajouter: generateSaltFromString, encryptBytes, decryptBytes
   ```

2. **Migrer database 5→6** :
   ```bash
   # Éditer: data/local/database/AppDatabase.kt
   # Incrémenter version à 6
   # Ajouter MIGRATION_5_6
   ```

3. **Tester** :
   ```kotlin
   // Créer un simple test
   val fileManager = VaultFileManager(context, cryptoManager)
   val (vaultId, file) = fileManager.createVaultFile(
       "Test Vault",
       "password123",
       StorageStrategy.APP_STORAGE
   )
   println("Vault created: ${file.absolutePath}")
   ```

---

## 📊 Progression

| Phase | Status | Completion | Time Spent | Time Remaining |
|-------|--------|------------|------------|----------------|
| Phase 1 | ✅ Done | 100% | 1 session | 0 |
| Phase 2 | 📝 Todo | 0% | 0 | 1-2 days |
| Phase 3 | 📝 Todo | 0% | 0 | 1 day |
| Phase 4 | 📝 Todo | 0% | 0 | 2-3 days |
| Phase 5 | 📝 Todo | 0% | 0 | 2-3 days |
| Phase 6 | 📝 Todo | 0% | 0 | 2 days |
| **TOTAL** | **8%** | **8/100%** | **1 session** | **8-11 days** |

---

## 💡 Notes Importantes

### Compatibilité Ascendante

L'ancien système Room continue de fonctionner. La migration est optionnelle.
Stratégie : Double système temporaire, puis migration progressive.

### Sécurité

- Les fichiers .gpv sont chiffrés avec AES-256-GCM
- Master password requis pour chaque accès
- Keys jamais persistées sur disque
- Format ouvert mais secure

### Performance

- Lazy loading : charger seulement vaults actifs
- Cache en mémoire pour vaults utilisés fréquemment
- Timeout automatique pour unload

### Backup

Toujours créer backup avant :
- Migration
- Suppression vault
- Changement stratégie stockage

---

🤖 Généré avec [Claude Code](https://claude.com/claude-code)

**Dernière mise à jour** : Phase 1 complétée
**Prochain milestone** : Phase 2 Integration
