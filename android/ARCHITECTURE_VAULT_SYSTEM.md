# Architecture du système de Vault - GenPwd Pro Android

## ⚠️ Note Importante

**Ce document est maintenu pour référence historique.**

Pour la documentation à jour de l'architecture actuelle (post-migration), consultez :
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture complète et actuelle
- **[MIGRATION_STATUS.md](MIGRATION_STATUS.md)** - Statut de la migration Room → File-Based

**TL;DR :** La migration est **TERMINÉE** ✅. Le système file-based (.gpv) est en production. Room est utilisé uniquement pour les métadonnées.

---

## 📋 Vue d'ensemble

**⚠️ Ce document décrit l'ancien système Room-based qui a été SUPPRIMÉ le 2025-11-01.**

1. **Architecture Room Database** (Legacy - ✅ Migration terminée, DEBUG uniquement)
2. **Architecture File-Based** (✅ EN PRODUCTION - Système actuel)

---

## 🏗️ Architecture 1 : Room Database (Legacy)

### Description
Système basé sur Room (SQLite) avec des DAOs pour gérer les vaults et leurs entrées.

### Composants
```
┌─────────────────────────────────────┐
│        UI Layer (Compose)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       VaultRepository               │
│  - unlockedKeys: Map<String, Key>  │
│  - vaultDao, entryDao, etc.        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│        Room Database                │
│  - Vault Table                      │
│  - VaultEntry Table                 │
│  - Folder, Tag, Preset Tables       │
└─────────────────────────────────────┘
```

### Fichiers impliqués
- `VaultRepository.kt` - Repository principal
- `VaultDao.kt` - DAO pour les vaults
- `VaultEntryDao.kt` - DAO pour les entrées
- `FolderDao.kt`, `TagDao.kt`, `PresetDao.kt` - DAOs associés
- `AppDatabase.kt` - Configuration Room

### Avantages
✅ Structure relationnelle claire
✅ Requêtes SQL puissantes
✅ Support des relations (foreign keys, jointures)
✅ Bien adapté pour des données structurées

### Inconvénients
❌ Difficile à synchroniser avec le cloud (format binaire SQLite)
❌ Pas de format d'échange standard
❌ Migration complexe entre versions
❌ Backup/restore moins flexible

---

## 🏗️ Architecture 2 : File-Based (Nouvelle - Recommandée)

### Description
Système basé sur des fichiers `.gpv` (GenPwd Vault) chiffrés en JSON, stockés sur le système de fichiers ou via SAF (Storage Access Framework).

### Composants
```
┌─────────────────────────────────────┐
│        UI Layer (Compose)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       FileVaultRepository           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      VaultSessionManager            │
│  Single source of truth en mémoire  │
│  - currentSession: VaultSession?    │
│  - vaultData: StateFlow<VaultData>  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       VaultFileManager              │
│  Gestion des I/O fichiers           │
│  - loadVaultFile()                  │
│  - saveVaultFile()                  │
│  - Support SAF + chemins classiques │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Encrypted .gpv Files           │
│  Format: JSON chiffré (AES-256)     │
│  Location: App storage / SAF        │
└─────────────────────────────────────┘
```

### Format de fichier .gpv
```json
{
  "version": 1,
  "metadata": {
    "id": "uuid",
    "name": "My Vault",
    "created": 1234567890,
    "modified": 1234567890
  },
  "entries": [
    {
      "id": "uuid",
      "title": "GitHub",
      "username": "user@example.com",
      "password": "encrypted_data",
      "url": "https://github.com",
      "notes": "encrypted_notes",
      "createdAt": 1234567890
    }
  ],
  "folders": [...],
  "tags": [...],
  "presets": [...]
}
```

### Fichiers impliqués
- `FileVaultRepository.kt` - Repository pour le système file-based
- `VaultSessionManager.kt` - Gestion de session et données en mémoire
- `VaultFileManager.kt` - I/O fichiers et chiffrement
- `VaultCryptoManager.kt` - Opérations cryptographiques
- `VaultData.kt` - Modèles de données

### Avantages
✅ **Synchronisation cloud facile** - Format JSON portable
✅ **Backup/restore simple** - Copier le fichier .gpv
✅ **Interopérabilité** - Peut être partagé entre plateformes (iOS, Desktop)
✅ **Versioning Git-friendly** - Format texte (chiffré)
✅ **Migration facile** - Modifier le format JSON directement
✅ **Storage Access Framework** - L'utilisateur contrôle l'emplacement

### Inconvénients
⚠️ Requêtes complexes plus difficiles (tout en mémoire)
⚠️ Chargement complet du vault en mémoire
⚠️ Performances pour très gros vaults (>10000 entrées)

---

## 🔄 État actuel de la migration

### Étape actuelle : ✅ **MIGRATION TERMINÉE** (2025-10-30)

**Room (Legacy)** :
- ❌ **N'est PLUS utilisé pour les vaults en production**
- ⚠️ Conservé dans le dépôt pour migration des anciens utilisateurs (outil en développement)
- ✅ Utilisé uniquement pour métadonnées : `VaultRegistryEntry`, `PasswordHistoryEntity`

**File-Based (Nouveau)** :
- ✅ **EN PRODUCTION** - Système par défaut
- ✅ Utilisé par TOUS les écrans vault
- ✅ `VaultSessionManager` + `FileVaultRepository` - Stable et opérationnel
- ✅ Tous les ViewModels migrés

**Pour plus de détails :** Voir [MIGRATION_STATUS.md](MIGRATION_STATUS.md)

### Registre des vaults
Un système de registre unifié (`VaultRegistryDao` + `VaultRegistryEntity`) permet de tracker tous les vaults, quel que soit leur système de stockage :

```kotlin
data class VaultRegistryEntity(
    val id: String,
    val name: String,
    val filePath: String,          // Chemin vers .gpv ou URI SAF
    val storageType: StorageType,  // FILE, SAF, CLOUD
    val isLoaded: Boolean,
    val lastAccessed: Long
)
```

---

## 🎯 Plan de migration complet

### Phase 1 : Stabilisation ✅ TERMINÉE
- [x] Système file-based opérationnel
- [x] VaultSessionManager stable
- [x] Support SAF
- [x] Tests de charge

### Phase 2 : Migration progressive ✅ TERMINÉE
- [x] Export Room → File-based (.gpv)
- [x] ~~Outil de migration automatique~~ (en finalisation)
- [x] Migration des presets
- [x] Migration des tags

### Phase 3 : Dépréciation ✅ TERMINÉE
- [x] ~~Marquer VaultRepository comme @Deprecated~~
- [x] Rediriger tous les écrans vers FileVaultRepository
- [x] Supprimer les références Room (sauf legacy DEBUG)

### Phase 4 : Nettoyage final ⏳ EN COURS
- [ ] **Finaliser outil de migration utilisateurs** (priorité)
- [ ] Supprimer VaultDao, VaultEntryDao (après période de grâce)
- [ ] Supprimer tables Room vault (après validation utilisateurs)
- [ ] Nettoyer VaultRepository legacy (après confirmation)

---

## 🔒 Sécurité

### Room Database
- ✅ Chiffrement via SQLCipher
- ✅ Clés stockées dans Android Keystore
- ❌ Base SQLite entière en mémoire au runtime

### File-Based
- ✅ Chiffrement AES-256-GCM
- ✅ Argon2id pour la dérivation de clé
- ✅ Clés en mémoire uniquement (session)
- ✅ Chaque fichier .gpv indépendant
- ✅ Support biométrique (via BiometricVaultManager)

---

## 📝 Recommandations

### Pour les développeurs

**✅ À FAIRE :**
1. Utiliser `FileVaultRepository` + `VaultSessionManager` pour toute nouvelle feature
2. Implémenter l'outil de migration Room → File
3. Documenter les opérations sur .gpv files
4. Tester la compatibilité SAF sur tous les devices

**❌ À ÉVITER :**
1. Ne PAS créer de nouvelles features avec Room pour les vaults
2. Ne PAS supprimer VaultRepository avant migration complète
3. Ne PAS modifier le format .gpv sans versioning

### Pour le futur : Kotlin Multiplatform

Le système file-based facilite grandement une future migration vers Kotlin Multiplatform :
- Format .gpv partagé entre Android/iOS/Desktop
- VaultCryptoManager portable (via expect/actual)
- UI Compose Multiplatform

---

## 🔗 Références

- [VaultSessionManager.kt](app/src/main/java/com/julien/genpwdpro/domain/session/VaultSessionManager.kt)
- [FileVaultRepository.kt](app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt)
- [VaultFileManager.kt](app/src/main/java/com/julien/genpwdpro/data/vault/VaultFileManager.kt)
- [VaultRepository.kt (Legacy)](app/src/main/java/com/julien/genpwdpro/data/repository/VaultRepository.kt)

---

**Dernière mise à jour :** 2025-10-30 (Post-migration - TERMINÉE ✅)
**Auteur :** Julien Bombled
**Status :** ⚠️ Document historique - Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour l'architecture actuelle
