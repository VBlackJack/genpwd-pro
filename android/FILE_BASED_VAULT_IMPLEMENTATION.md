# 📋 Cahier des Charges - Système de Coffres File-Based Complet

**Projet** : GenPwd Pro Android
**Date de début** : 2025-10-27
**Objectif** : Remplacer complètement le système Room par un système file-based (.gpv)

---

## 🎯 Vision Globale

### Architecture Cible

```
┌─────────────────────────────────────────────────────────────────┐
│                     COUCHE PRÉSENTATION                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │VaultManager  │  │UnlockVault   │  │VaultList     │          │
│  │Screen        │  │Screen        │  │Screen        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE DOMAINE                              │
│  ┌────────────────────────────────────────────────────┐         │
│  │              VaultSessionManager                    │         │
│  │  - Vault déverrouillé en mémoire (VaultData)      │         │
│  │  - Clé de déchiffrement en mémoire (SecretKey)    │         │
│  │  - Auto-lock timer                                 │         │
│  │  - Biometric integration                           │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE DONNÉES                              │
│  ┌──────────────────┐        ┌─────────────────────┐           │
│  │ VaultRegistry    │        │ VaultFileManager    │           │
│  │ (Room - metadata)│◄──────►│ (Fichiers .gpv)     │           │
│  │                  │        │                     │           │
│  │ - id             │        │ - Read/Write .gpv   │           │
│  │ - name           │        │ - Encryption        │           │
│  │ - filePath       │        │ - SAF support       │           │
│  │ - storageStrategy│        │ - Checksum          │           │
│  │ - statistics     │        └─────────────────────┘           │
│  │ - isDefault      │                                           │
│  │ - biometricEnabled│                                          │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Composants à Développer

### Phase 1 : Session Management (PRIORITÉ HAUTE)
**Fichier** : `domain/session/VaultSessionManager.kt`

**Responsabilités** :
- Charger un .gpv en mémoire après unlock
- Stocker SecretKey en mémoire (jamais sur disque)
- Fournir accès aux données déchiffrées
- Auto-lock après timeout
- Gestion biométrique

**État interne** :
```kotlin
data class VaultSession(
    val vaultId: String,
    val vaultKey: SecretKey,
    val vaultData: MutableStateFlow<VaultData>,
    val unlockTime: Long,
    val autoLockTimer: Job?
)

private var currentSession: VaultSession? = null
```

**API** :
```kotlin
suspend fun unlockVault(vaultId: String, masterPassword: String): Result<Unit>
suspend fun unlockVaultWithBiometric(vaultId: String): Result<Unit>
fun lockVault()
fun getCurrentSession(): VaultSession?
fun isVaultUnlocked(): Boolean
suspend fun addEntry(entry: VaultEntryEntity): Result<Unit>
suspend fun updateEntry(entry: VaultEntryEntity): Result<Unit>
suspend fun deleteEntry(entryId: String): Result<Unit>
fun getEntries(): StateFlow<List<VaultEntryEntity>>
suspend fun saveCurrentVault(): Result<Unit>
```

---

### Phase 2 : Biometric Integration (PRIORITÉ HAUTE)
**Fichier** : `security/BiometricVaultManager.kt`

**Fonctionnalités** :
1. Chiffrer le master password avec Android Keystore
2. Stocker le password chiffré dans vault_registry
3. Déchiffrer avec biométrie pour unlock automatique

**Modifications VaultRegistryEntry** :
```kotlin
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    // ... existing fields ...

    // Biometric fields
    val biometricUnlockEnabled: Boolean = false,
    val encryptedMasterPassword: ByteArray? = null,
    val masterPasswordIv: ByteArray? = null
)
```

**Flow biométrique** :
```
User enables biometric
  → Prompt for master password
  → Verify password is correct (unlock test)
  → Encrypt password with Keystore
  → Store encrypted + IV in vault_registry

User unlocks with biometric
  → Show biometric prompt
  → Decrypt password with Keystore
  → Unlock vault with decrypted password
```

---

### Phase 3 : Repository Pattern (PRIORITÉ HAUTE)
**Fichier** : `data/repository/FileVaultRepository.kt`

**Remplace** : `VaultRepository.kt` (ancien système Room)

**API** :
```kotlin
interface IVaultRepository {
    // Entry operations
    suspend fun addEntry(vaultId: String, entry: VaultEntryEntity): Result<Unit>
    suspend fun updateEntry(vaultId: String, entry: VaultEntryEntity): Result<Unit>
    suspend fun deleteEntry(vaultId: String, entryId: String): Result<Unit>
    fun getEntries(vaultId: String): Flow<List<DecryptedEntry>>
    suspend fun getEntryById(vaultId: String, entryId: String): DecryptedEntry?

    // Folder operations
    suspend fun addFolder(vaultId: String, folder: FolderEntity): Result<Unit>
    suspend fun updateFolder(vaultId: String, folder: FolderEntity): Result<Unit>
    suspend fun deleteFolder(vaultId: String, folderId: String): Result<Unit>
    fun getFolders(vaultId: String): Flow<List<FolderEntity>>

    // Tag operations
    suspend fun addTag(vaultId: String, tag: TagEntity): Result<Unit>
    suspend fun updateTag(vaultId: String, tag: TagEntity): Result<Unit>
    suspend fun deleteTag(vaultId: String, tagId: String): Result<Unit>
    fun getTags(vaultId: String): Flow<List<TagEntity>>

    // Preset operations
    suspend fun addPreset(vaultId: String, preset: PresetEntity): Result<Unit>
    suspend fun updatePreset(vaultId: String, preset: PresetEntity): Result<Unit>
    suspend fun deletePreset(vaultId: String, presetId: String): Result<Unit>
    fun getPresets(vaultId: String): Flow<List<DecryptedPreset>>

    // Statistics
    suspend fun getStatistics(vaultId: String): VaultStatistics

    // Search
    fun searchEntries(vaultId: String, query: String): Flow<List<DecryptedEntry>>
}
```

**Implémentation** :
```kotlin
class FileVaultRepository(
    private val vaultSessionManager: VaultSessionManager,
    private val vaultRegistryDao: VaultRegistryDao
) : IVaultRepository {

    override suspend fun addEntry(vaultId: String, entry: VaultEntryEntity): Result<Unit> {
        return try {
            vaultSessionManager.addEntry(entry)
            vaultSessionManager.saveCurrentVault()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getEntries(vaultId: String): Flow<List<DecryptedEntry>> {
        return vaultSessionManager.getEntries().map { entries ->
            entries.map { it.toDecryptedEntry() }
        }
    }

    // ... autres méthodes ...
}
```

---

### Phase 4 : UnlockVaultScreen Refactor (PRIORITÉ HAUTE)
**Fichier** : `presentation/vault/UnlockVaultScreen.kt`

**Modifications** :
1. Remplacer `VaultEntity` par `VaultRegistryEntry`
2. Utiliser `VaultSessionManager` au lieu de `VaultRepository`
3. Intégrer biométrie si activée

**Nouveau flow** :
```kotlin
@Composable
fun UnlockVaultScreen(
    vaultId: String,
    onVaultUnlocked: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: UnlockVaultViewModel = hiltViewModel()
) {
    // Charger VaultRegistryEntry (pas VaultEntity)
    val vaultRegistry by viewModel.getVaultRegistry(vaultId).collectAsState(null)

    // Si biométrie activée, proposer unlock biométrique
    if (vaultRegistry?.biometricUnlockEnabled == true) {
        BiometricUnlockButton(
            onUnlock = { viewModel.unlockWithBiometric(vaultId) }
        )
    }

    // Sinon, unlock avec password
    PasswordUnlockForm(
        onUnlock = { password ->
            viewModel.unlockWithPassword(vaultId, password)
        }
    )
}
```

**UnlockVaultViewModel** :
```kotlin
@HiltViewModel
class UnlockVaultViewModel @Inject constructor(
    private val vaultSessionManager: VaultSessionManager,
    private val vaultRegistryDao: VaultRegistryDao,
    private val biometricVaultManager: BiometricVaultManager
) : ViewModel() {

    suspend fun unlockWithPassword(vaultId: String, password: String) {
        vaultSessionManager.unlockVault(vaultId, password)
            .onSuccess { /* Navigate */ }
            .onFailure { /* Show error */ }
    }

    suspend fun unlockWithBiometric(vaultId: String) {
        vaultSessionManager.unlockVaultWithBiometric(vaultId)
            .onSuccess { /* Navigate */ }
            .onFailure { /* Show error */ }
    }
}
```

---

### Phase 5 : VaultListScreen Integration (PRIORITÉ MOYENNE)
**Fichier** : `presentation/vault/VaultListScreen.kt`

**Modifications** :
1. Utiliser `FileVaultRepository` au lieu de `VaultRepository`
2. Les données viennent de `VaultSessionManager.getEntries()`
3. Toute modification appelle `saveCurrentVault()` automatiquement

**VaultListViewModel** :
```kotlin
@HiltViewModel
class VaultListViewModel @Inject constructor(
    private val repository: FileVaultRepository, // New!
    private val totpGenerator: TotpGenerator
) : ViewModel() {

    fun loadEntries(vaultId: String) {
        viewModelScope.launch {
            repository.getEntries(vaultId).collect { entries ->
                _uiState.value = VaultListUiState.Success(entries)
            }
        }
    }

    fun toggleFavorite(entryId: String, isFavorite: Boolean) {
        viewModelScope.launch {
            val entry = repository.getEntryById(currentVaultId, entryId)
            entry?.let {
                repository.updateEntry(
                    currentVaultId,
                    it.copy(isFavorite = isFavorite)
                )
            }
        }
    }
}
```

---

### Phase 6 : Entry CRUD Integration (PRIORITÉ MOYENNE)
**Fichiers** :
- `presentation/vault/EntryEditScreen.kt`
- `presentation/vault/EntryViewModel.kt`

**Modifications** :
1. Remplacer tous les appels `VaultRepository` par `FileVaultRepository`
2. Pas besoin de `unlockVault()` - vault déjà déverrouillé
3. Auto-save à chaque modification

**EntryViewModel** :
```kotlin
fun saveEntry(entry: VaultEntryEntity) {
    viewModelScope.launch {
        val result = if (isNewEntry) {
            repository.addEntry(vaultId, entry)
        } else {
            repository.updateEntry(vaultId, entry)
        }

        result
            .onSuccess { _uiState.value = EntryUiState.Saved }
            .onFailure { _uiState.value = EntryUiState.Error(it.message) }
    }
}
```

---

### Phase 7 : Password Save Integration (PRIORITÉ HAUTE)
**Fichier** : `presentation/navigation/NavGraph.kt`

**Modification du callback** :
```kotlin
onSaveToVault = { password ->
    val vaultId = sessionManager.getCurrentVaultId()
    if (vaultId != null) {
        // Vault déjà déverrouillé
        navController.navigate(
            Screen.SelectEntryType.createRoute(vaultId, password)
        )
    } else {
        // Aucun vault déverrouillé, proposer d'en ouvrir un
        // ou créer directement une entry dans le vault par défaut
        val defaultVault = vaultRegistryDao.getDefaultVault()
        if (defaultVault != null) {
            navController.navigate(
                Screen.UnlockVault.createRoute(defaultVault.id)
            )
        }
    }
}
```

---

### Phase 8 : UI Dialog Fix (PRIORITÉ BASSE)
**Fichier** : `presentation/vaultmanager/VaultManagerScreen.kt`

**Problème** : Dialog CreateVault trop haut, champs cachés

**Solution** :
```kotlin
AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Create New Vault") },
    text = {
        LazyColumn(  // ← Ajouter scroll
            modifier = Modifier.heightIn(max = 600.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { /* Vault Name */ }
            item { /* Description */ }
            item { /* Storage Strategy Radio Buttons */ }
            item {
                if (selectedStrategy == CUSTOM) {
                    /* Select Folder Button */
                }
            }
            item { /* Password Field */ }
            item { /* Confirm Password */ }
            item { /* Biometric Checkbox */ }
            item { /* Set as Default Checkbox */ }
        }
    }
)
```

---

### Phase 9 : Statistics Calculation (PRIORITÉ BASSE)
**Fichier** : `domain/usecases/CalculateVaultStatistics.kt`

**Responsabilité** : Calculer les stats depuis VaultData en mémoire

```kotlin
class CalculateVaultStatistics @Inject constructor() {

    operator fun invoke(vaultData: VaultData): VaultStatistics {
        return VaultStatistics(
            entryCount = vaultData.entries.size,
            folderCount = vaultData.folders.size,
            presetCount = vaultData.presets.size,
            tagCount = vaultData.tags.size,
            totalSize = calculateTotalSize(vaultData)
        )
    }

    private fun calculateTotalSize(data: VaultData): Long {
        // Calculer taille approximative des données
    }
}
```

**Mise à jour** : À chaque modification, recalculer et mettre à jour vault_registry

---

### Phase 10 : Auto-Lock Timer (PRIORITÉ MOYENNE)
**Fichier** : `domain/session/VaultSessionManager.kt`

**Fonctionnalité** : Verrouiller automatiquement après X minutes d'inactivité

```kotlin
class VaultSessionManager {
    private var autoLockJob: Job? = null

    fun startAutoLockTimer(timeoutMinutes: Int) {
        autoLockJob?.cancel()
        autoLockJob = scope.launch {
            delay(timeoutMinutes.minutes.inWholeMilliseconds)
            lockVault()
        }
    }

    fun resetAutoLockTimer() {
        val timeout = getCurrentSession()?.autoLockTimeout ?: 5
        startAutoLockTimer(timeout)
    }

    // Appeler resetAutoLockTimer() à chaque interaction
}
```

---

## 🗂️ Structure des Fichiers

```
android/app/src/main/java/com/julien/genpwdpro/
│
├── domain/
│   ├── session/
│   │   ├── VaultSessionManager.kt          [Phase 1] ⭐ NOUVEAU
│   │   └── SessionManager.kt               [À REMPLACER]
│   │
│   └── usecases/
│       └── CalculateVaultStatistics.kt     [Phase 9] ⭐ NOUVEAU
│
├── data/
│   ├── repository/
│   │   ├── FileVaultRepository.kt          [Phase 3] ⭐ NOUVEAU
│   │   └── VaultRepository.kt              [À SUPPRIMER]
│   │
│   └── vault/
│       ├── VaultFileManager.kt             [EXISTANT - OK]
│       └── VaultMigrationManager.kt        [À SUPPRIMER]
│
├── security/
│   └── BiometricVaultManager.kt            [Phase 2] ⭐ NOUVEAU
│
└── presentation/
    ├── vault/
    │   ├── UnlockVaultScreen.kt            [Phase 4] 🔧 MODIFIER
    │   ├── UnlockVaultViewModel.kt         [Phase 4] ⭐ NOUVEAU
    │   ├── VaultListScreen.kt              [Phase 5] 🔧 MODIFIER
    │   ├── VaultListViewModel.kt           [Phase 5] 🔧 MODIFIER
    │   ├── EntryEditScreen.kt              [Phase 6] 🔧 MODIFIER
    │   └── EntryViewModel.kt               [Phase 6] 🔧 MODIFIER
    │
    └── vaultmanager/
        └── VaultManagerScreen.kt           [Phase 8] 🔧 MODIFIER
```

---

## 📝 Plan d'Exécution

### Session 1 (Actuelle) - Fondations
- [x] Rédiger cahier des charges
- [ ] Phase 1 : VaultSessionManager (core logic)
- [ ] Phase 2 : BiometricVaultManager
- [ ] Tests unitaires des nouvelles classes

### Session 2 - Repository & Unlock
- [ ] Phase 3 : FileVaultRepository
- [ ] Phase 4 : UnlockVaultScreen refactor
- [ ] Phase 7 : Password save integration
- [ ] Tests d'intégration unlock flow

### Session 3 - Entry Management
- [ ] Phase 5 : VaultListScreen integration
- [ ] Phase 6 : Entry CRUD integration
- [ ] Tests CRUD complet

### Session 4 - Polish & Features
- [ ] Phase 8 : UI Dialog fix
- [ ] Phase 9 : Statistics calculation
- [ ] Phase 10 : Auto-lock timer
- [ ] Tests end-to-end complets

### Session 5 - Cleanup & Migration
- [ ] Supprimer ancien code (VaultRepository, SessionManager, etc.)
- [ ] Migration utilisateurs existants (si nécessaire)
- [ ] Documentation finale
- [ ] Release

---

## ✅ Critères d'Acceptation

### Must Have (MVP)
- [x] Créer un coffre avec toutes les stratégies (INTERNAL, APP_STORAGE, PUBLIC_DOCUMENTS, CUSTOM)
- [ ] Déverrouiller un coffre avec master password
- [ ] Déverrouiller un coffre avec biométrie
- [ ] Sauvegarder un mot de passe généré dans un coffre
- [ ] Lister les entrées d'un coffre
- [ ] Créer/Éditer/Supprimer une entrée
- [ ] Chercher dans les entrées
- [ ] Auto-lock après timeout
- [ ] Statistiques correctes

### Should Have
- [ ] Support des folders
- [ ] Support des tags
- [ ] Support des presets
- [ ] TOTP fonctionnel
- [ ] Passkeys fonctionnels
- [ ] Export/Import .gpv

### Nice to Have
- [ ] Synchronisation cloud
- [ ] Historique des modifications
- [ ] Backup automatique
- [ ] Multi-vault simultanés

---

## 🚨 Risques Identifiés

### Risque 1 : Performance
**Problème** : Charger tout le .gpv en mémoire peut être lent pour de gros coffres
**Mitigation** :
- Pagination des entries en UI
- Lazy loading des données
- Cache intelligent

### Risque 2 : Corruption de données
**Problème** : Si l'app crash pendant l'écriture du .gpv
**Mitigation** :
- Atomic file write (write to temp, rename)
- Backup du fichier précédent avant écriture
- Checksum validation

### Risque 3 : Concurrence
**Problème** : Modifications simultanées du vault
**Mitigation** :
- Single writer (VaultSessionManager)
- Lock mechanism
- Queue des opérations d'écriture

### Risque 4 : Mémoire
**Problème** : Vault déchiffré en mémoire = risque de leak
**Mitigation** :
- Effacer les clés de la mémoire au lock
- Auto-lock agressif
- Utiliser SecretKey au lieu de String quand possible

---

## 📊 Métriques de Succès

- ✅ 100% des fonctionnalités de l'ancien système restaurées
- ✅ 0 regression sur les features existantes
- ✅ Temps d'unlock < 1 seconde
- ✅ Temps de save < 500ms
- ✅ 0 data loss sur 1000 opérations
- ✅ Support de coffres jusqu'à 10 000 entrées

---

## 📅 État d'Avancement

**Date** : 2025-10-27
**Phase actuelle** : Session 1 - Fondations
**Prochaine étape** : Implémenter VaultSessionManager

### Changelog
- 2025-10-27 : Création du cahier des charges complet
