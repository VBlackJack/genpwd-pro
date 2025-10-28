# 🗄️ Architecture Améliorée - Gestion des Coffres (Vaults)

Document de proposition pour améliorer la gestion des coffres dans GenPwd Pro Android.

**Date** : 27 octobre 2025
**Version** : 2.6.0 (proposition)
**Status** : 📝 Proposition / Design Document

---

## 🎯 Objectifs

### Besoins Utilisateur

1. ✅ **Choix du stockage** : Pouvoir choisir où stocker le coffre sur le device
2. ✅ **Persistance après désinstallation** : Le coffre ne doit pas être supprimé à la désinstallation
3. ✅ **Suppression manuelle** : Pouvoir supprimer un coffre depuis l'app
4. ✅ **Déchargement** : Pouvoir décharger un coffre (le fermer sans le supprimer)
5. ✅ **Meilleure gestion** : Interface claire pour gérer les coffres

---

## 📐 Architecture Actuelle (v2.5.1)

### Stockage des Coffres

**Localisation** : Base de données Room SQLite
```
/data/data/com.julien.genpwdpro/databases/genpwd_database.db
```

**Problèmes** :
- ❌ Supprimé lors de la désinstallation de l'app
- ❌ Pas de choix de localisation
- ❌ Pas de backup automatique facile
- ❌ Pas d'export/import natif

### Structure Actuelle

```kotlin
// Vault stocké dans Room Database
@Entity(tableName = "vaults")
data class VaultEntity(
    @PrimaryKey val id: String,
    val name: String,
    val encryptedMasterPassword: String?,  // Pour biométrie
    val masterPasswordIv: String?,
    // ... autres champs
)

// Presets dans la même DB
@Entity(
    tableName = "presets",
    foreignKeys = [ForeignKey(entity = VaultEntity::class, ...)]
)

// Entrées dans la même DB
@Entity(
    tableName = "vault_entries",
    foreignKeys = [ForeignKey(entity = VaultEntity::class, ...)]
)
```

---

## 🏗️ Architecture Proposée (v2.6.0)

### 1. Format de Fichier Vault

**Nouveau** : Coffres stockés dans des fichiers `.gpv` (GenPwd Vault)

```
Structure du fichier .gpv:
┌─────────────────────────────────────┐
│ Header (256 bytes)                  │
│  - Magic Number: "GPVAULT1"         │
│  - Version: 1                       │
│  - Vault ID: UUID                   │
│  - Created: Timestamp               │
│  - Modified: Timestamp              │
│  - Checksum: SHA-256                │
├─────────────────────────────────────┤
│ Metadata Section (JSON, encrypted)  │
│  - Vault name                       │
│  - Description                      │
│  - Settings                         │
│  - Statistics                       │
├─────────────────────────────────────┤
│ Data Section (JSON, encrypted)      │
│  - All entries (logins, cards, etc) │
│  - All folders                      │
│  - All tags                         │
│  - All presets                      │
└─────────────────────────────────────┘

Encryption: AES-256-GCM
Key Derivation: Argon2id (from master password)
```

### 2. Stratégies de Stockage

#### Option A: Stockage Interne (Défaut)
```
/data/data/com.julien.genpwdpro/vaults/
├── vault_123e4567.gpv
├── vault_987f6543.gpv
└── vault_abc12345.gpv
```

**Avantages** :
- ✅ Sécurisé (protégé par Android sandbox)
- ✅ Rapide d'accès
- ✅ Pas besoin de permissions

**Inconvénients** :
- ❌ Supprimé à la désinstallation
- ❌ Pas accessible pour backup manuel

#### Option B: Stockage Application (Recommandé)
```
/storage/emulated/0/Android/data/com.julien.genpwdpro/files/vaults/
├── vault_123e4567.gpv
├── vault_987f6543.gpv
└── vault_abc12345.gpv
```

**Avantages** :
- ✅ Survit à la désinstallation si l'utilisateur garde les données
- ✅ Accessible via USB pour backup
- ✅ Pas besoin de permissions spéciales (Android 11+)
- ✅ Protection de base par Android

**Inconvénients** :
- ❌ Supprimé si l'utilisateur efface les données app
- ⚠️ Accessible aux apps avec MANAGE_EXTERNAL_STORAGE

#### Option C: Stockage Public
```
/storage/emulated/0/Documents/GenPwdPro/
├── vault_123e4567.gpv
├── vault_987f6543.gpv
└── vault_abc12345.gpv
```

**Avantages** :
- ✅ Survit à la désinstallation
- ✅ Backup manuel facile
- ✅ Peut être synchronisé avec cloud services tiers

**Inconvénients** :
- ⚠️ Nécessite permissions stockage (Android 10-)
- ⚠️ Accessible à d'autres apps
- ⚠️ Risque de suppression accidentelle

#### Option D: Stockage Custom
```
Chemin personnalisé choisi par l'utilisateur
/storage/emulated/0/MesDocuments/MotsDePasse/
```

**Avantages** :
- ✅ Flexibilité maximale
- ✅ Peut être un dossier synchronisé (Dropbox, Drive)

**Inconvénients** :
- ⚠️ Nécessite Storage Access Framework (SAF)
- ⚠️ UX plus complexe

### 3. Base de Données Room (Metadata Only)

**Nouveau rôle** : Index des vaults, pas stockage complet

```kotlin
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    @PrimaryKey val id: String,
    val name: String,
    val filePath: String,              // Chemin vers le fichier .gpv
    val storageStrategy: StorageStrategy,
    val fileSize: Long,
    val lastModified: Long,
    val lastAccessed: Long?,
    val isDefault: Boolean,
    val isLoaded: Boolean,             // Chargé en mémoire?
    val statistics: VaultStatistics    // Embedded
)

data class VaultStatistics(
    val entryCount: Int,
    val folderCount: Int,
    val presetCount: Int,
    val createdAt: Long
)

enum class StorageStrategy {
    INTERNAL,           // /data/data/.../vaults/
    APP_STORAGE,        // /Android/data/.../files/vaults/
    PUBLIC_DOCUMENTS,   // /Documents/GenPwdPro/
    CUSTOM              // Chemin personnalisé
}
```

---

## 🔧 Implémentation

### 1. VaultFileManager (Nouveau)

```kotlin
@Singleton
class VaultFileManager @Inject constructor(
    private val context: Context,
    private val cryptoManager: VaultCryptoManager
) {
    /**
     * Crée un nouveau fichier vault
     */
    suspend fun createVaultFile(
        name: String,
        masterPassword: String,
        strategy: StorageStrategy,
        customPath: Uri? = null
    ): VaultFile

    /**
     * Charge un vault depuis un fichier
     */
    suspend fun loadVaultFile(
        vaultId: String,
        masterPassword: String
    ): VaultData

    /**
     * Sauvegarde les changements dans le fichier
     */
    suspend fun saveVaultFile(
        vaultId: String,
        data: VaultData
    )

    /**
     * Supprime le fichier vault
     */
    suspend fun deleteVaultFile(vaultId: String)

    /**
     * Décharge un vault de la mémoire
     */
    fun unloadVault(vaultId: String)

    /**
     * Exporte un vault vers un chemin choisi
     */
    suspend fun exportVault(
        vaultId: String,
        destinationUri: Uri
    )

    /**
     * Importe un vault depuis un fichier
     */
    suspend fun importVault(
        sourceUri: Uri,
        strategy: StorageStrategy
    ): String  // Retourne vaultId
}
```

### 2. Écran de Gestion des Coffres

**Nouveau** : `VaultManagerScreen.kt`

```kotlin
@Composable
fun VaultManagerScreen() {
    // Liste des vaults avec:
    - Nom du vault
    - Taille du fichier
    - Localisation (icône + chemin)
    - Nombre d'entrées
    - Date dernière modification
    - Status (chargé/déchargé)

    // Actions par vault:
    - Ouvrir
    - Verrouiller
    - Décharger (unload)
    - Exporter
    - Changer localisation
    - Supprimer (avec confirmation)

    // Actions globales:
    - Créer nouveau vault
    - Importer vault
    - Paramètres de stockage par défaut
}
```

**Mock UI** :
```
┌─────────────────────────────────────┐
│ < Gestion des Coffres        [+]   │
├─────────────────────────────────────┤
│ 📦 Personnel                   🟢   │
│ /Android/data/.../vaults/           │
│ 45 entrées · 2.3 MB · Modifié 2h   │
│ [Ouvrir] [Export] [⚙️]              │
├─────────────────────────────────────┤
│ 📦 Travail                     ⚪   │
│ /Documents/GenPwdPro/               │
│ 12 entrées · 890 KB · Modifié 5j   │
│ [Charger] [Export] [⚙️]             │
├─────────────────────────────────────┤
│ 📦 Famille                     ⚪   │
│ /storage/emulated/0/Dropbox/        │
│ 8 entrées · 520 KB · Modifié 2j    │
│ [Charger] [Export] [⚙️]             │
└─────────────────────────────────────┘
```

### 3. Migration Depuis v2.5.1

**Strategy** : Conversion automatique lors de la première ouverture

```kotlin
@Singleton
class VaultMigrationManager @Inject constructor(
    private val database: AppDatabase,
    private val fileManager: VaultFileManager
) {
    /**
     * Migre tous les vaults de Room vers fichiers .gpv
     */
    suspend fun migrateToFileBasedVaults() {
        val vaults = database.vaultDao().getAllVaults().first()

        for (vault in vaults) {
            // 1. Extraire toutes les données du vault
            val entries = database.entryDao().getEntriesByVault(vault.id).first()
            val presets = database.presetDao().getPresetsByVault(vault.id).first()
            val folders = database.folderDao().getFoldersByVault(vault.id).first()
            val tags = database.tagDao().getTagsByVault(vault.id).first()

            // 2. Créer le fichier .gpv
            val vaultFile = fileManager.createVaultFile(
                name = vault.name,
                masterPassword = "[REQUIRES_UNLOCK]",  // User must unlock
                strategy = StorageStrategy.APP_STORAGE,
                data = VaultData(
                    metadata = ...,
                    entries = entries,
                    presets = presets,
                    folders = folders,
                    tags = tags
                )
            )

            // 3. Créer l'entrée de registre
            val registry = VaultRegistryEntry(
                id = vault.id,
                name = vault.name,
                filePath = vaultFile.absolutePath,
                storageStrategy = StorageStrategy.APP_STORAGE,
                ...
            )
            database.vaultRegistryDao().insert(registry)
        }

        // 4. Nettoyer l'ancienne structure
        // (Garder une backup temporaire)
    }
}
```

---

## 🎨 UI/UX Améliorations

### 1. Dialogue de Création de Vault

**Nouveau** : Choix de localisation

```
┌─────────────────────────────────────┐
│ Créer un Nouveau Coffre             │
├─────────────────────────────────────┤
│ Nom: [________________]             │
│                                     │
│ Mot de passe maître:                │
│ [________________] [👁️]              │
│                                     │
│ Confirmer:                          │
│ [________________] [👁️]              │
│                                     │
│ Localisation du coffre:             │
│ ○ Interne (sécurisé)                │
│   ⚠️ Supprimé à la désinstallation   │
│                                     │
│ ● Application (recommandé)          │
│   ✅ Survit à la désinstallation     │
│   ✅ Backup manuel possible          │
│                                     │
│ ○ Documents publics                 │
│   ✅ Facile à sauvegarder            │
│   ⚠️ Moins sécurisé                  │
│                                     │
│ ○ Personnalisé                      │
│   [Choisir un dossier...]           │
│                                     │
│ [Annuler] [Créer]                   │
└─────────────────────────────────────┘
```

### 2. Menu Contextuel Vault

```
Long press sur un vault:
┌───────────────────────┐
│ 🔓 Ouvrir             │
│ 🔒 Verrouiller        │
│ 📤 Exporter           │
│ 📥 Dupliquer          │
│ 📍 Changer location   │
│ ⚙️ Propriétés         │
│ 🗑️ Supprimer          │
└───────────────────────┘
```

### 3. Dialogue de Suppression

```
┌─────────────────────────────────────┐
│ ⚠️ Supprimer le Coffre?             │
├─────────────────────────────────────┤
│ Vous êtes sur le point de supprimer │
│ le coffre "Personnel" contenant     │
│ 45 entrées.                         │
│                                     │
│ Cette action est IRRÉVERSIBLE.      │
│                                     │
│ Pour confirmer, tapez le nom du     │
│ coffre:                             │
│ [________________]                  │
│                                     │
│ ☐ Créer un backup avant suppression│
│                                     │
│ [Annuler] [Supprimer Définitivement]│
└─────────────────────────────────────┘
```

---

## 🔐 Sécurité

### Points Importants

1. **Chiffrement du fichier complet**
   - Master password → Argon2id → 256-bit key
   - Chiffrement AES-256-GCM
   - IV unique par fichier
   - HMAC pour intégrité

2. **Protection du fichier**
   - Permissions restrictives (600 en interne)
   - Checksum SHA-256
   - Version header pour évolutions futures

3. **Clés en mémoire**
   - Jamais écrites sur disque
   - Cleared au verrouillage
   - Cleared au crash app
   - Timeout configurable

### Trade-offs par Stratégie

| Stratégie | Sécurité | Praticité | Backup | Recommandation |
|-----------|----------|-----------|--------|----------------|
| Internal | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | Utilisateur avancé |
| App Storage | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **Défaut** |
| Public | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Utilisateur conscient |
| Custom | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Power user |

---

## 📊 Impact sur les Performances

### Changements

**Avant (v2.5.1)** :
- Toutes les données en base Room
- Accès direct et rapide
- Tout en mémoire SQLite

**Après (v2.6.0)** :
- Lecture/écriture de fichiers
- Chiffrement/déchiffrement à chaque opération
- Possibilité de charger/décharger

### Optimisations

1. **Cache en mémoire** :
   ```kotlin
   private val loadedVaults = mutableMapOf<String, VaultData>()
   ```

2. **Lazy loading** :
   - Charger seulement le vault actif
   - Décharger après timeout d'inactivité

3. **Opérations async** :
   - Sauvegarde en background
   - Lecture/écriture avec coroutines

---

## 🚀 Plan d'Implémentation

### Phase 1: Core Infrastructure (2-3 jours)
- [ ] Créer VaultFileManager
- [ ] Implémenter format .gpv
- [ ] Tests de chiffrement/déchiffrement
- [ ] VaultRegistryDao

### Phase 2: Migration (1-2 jours)
- [ ] VaultMigrationManager
- [ ] Script de migration
- [ ] Tests de migration
- [ ] Backup automatique avant migration

### Phase 3: UI (2-3 jours)
- [ ] VaultManagerScreen
- [ ] Dialogue de création avec choix storage
- [ ] Menus contextuels
- [ ] Dialogues de confirmation

### Phase 4: Features Avancées (2-3 jours)
- [ ] Export/Import
- [ ] Changement de localisation
- [ ] Duplication de vault
- [ ] Propriétés et statistiques

### Phase 5: Testing & Polish (2 jours)
- [ ] Tests unitaires complets
- [ ] Tests d'intégration
- [ ] Tests de migration
- [ ] Documentation utilisateur

**Total estimé** : 9-13 jours de développement

---

## 📱 Avantages pour l'Utilisateur

✅ **Flexibilité** : Choisir où stocker ses coffres
✅ **Sécurité** : Données persistent même après désinstallation
✅ **Backup** : Copie manuelle facile des fichiers .gpv
✅ **Portabilité** : Transférer vers autre device via fichier
✅ **Contrôle** : Supprimer ou décharger à volonté
✅ **Transparence** : Voir emplacement et taille des coffres

---

## ❓ Questions Ouvertes

1. **Migration forcée ou optionnelle?**
   - Forcer la migration pour simplifier
   - Ou garder les deux systèmes?

2. **Format de fichier ouvert?**
   - Documenter le format .gpv
   - Permettre outils tiers

3. **Synchronisation cloud native?**
   - Intégrer avec Drive/Dropbox
   - Ou laisser l'utilisateur gérer

4. **Compression?**
   - Compresser avant chiffrement
   - Gain d'espace vs performance

---

## 🎯 Résumé

Cette architecture répond à tous les besoins :

1. ✅ **Choix du stockage** : 4 stratégies disponibles
2. ✅ **Persistance** : Avec App Storage ou Public
3. ✅ **Suppression** : Via VaultManagerScreen
4. ✅ **Déchargement** : Fonctionnalité native
5. ✅ **Meilleure gestion** : UI dédiée complète

**Recommandation** : Implémenter progressivement, en commençant par Phase 1-2 pour valider l'architecture.

---

🤖 Généré avec [Claude Code](https://claude.com/claude-code)
