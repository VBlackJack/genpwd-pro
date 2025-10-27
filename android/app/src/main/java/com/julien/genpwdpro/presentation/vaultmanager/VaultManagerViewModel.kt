package com.julien.genpwdpro.presentation.vaultmanager

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import com.julien.genpwdpro.data.local.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.data.vault.VaultMigrationManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * ViewModel pour la gestion des vaults
 */
@HiltViewModel
class VaultManagerViewModel @Inject constructor(
    private val vaultRegistryDao: VaultRegistryDao,
    private val vaultFileManager: VaultFileManager,
    private val migrationManager: VaultMigrationManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(VaultManagerUiState())
    val uiState: StateFlow<VaultManagerUiState> = _uiState.asStateFlow()

    // Liste des vaults depuis le registry
    val vaults: StateFlow<List<VaultRegistryEntry>> = vaultRegistryDao.getAllVaults()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    // Vault par défaut
    val defaultVault: StateFlow<VaultRegistryEntry?> = vaultRegistryDao.getDefaultVaultFlow()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null
        )

    // Vaults chargés en mémoire
    val loadedVaults: StateFlow<List<VaultRegistryEntry>> = vaultRegistryDao.getLoadedVaults()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    init {
        checkMigrationNeeded()
    }

    /**
     * Vérifie si une migration est nécessaire
     */
    private fun checkMigrationNeeded() {
        viewModelScope.launch {
            val needed = migrationManager.isMigrationNeeded()
            if (needed) {
                _uiState.update { it.copy(showMigrationDialog = true) }
            }
        }
    }

    /**
     * Crée un nouveau vault
     */
    fun createVault(
        name: String,
        masterPassword: String,
        strategy: StorageStrategy,
        description: String? = null,
        setAsDefault: Boolean = false
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Créer le fichier vault
                val (vaultId, file) = vaultFileManager.createVaultFile(
                    name = name,
                    masterPassword = masterPassword,
                    strategy = strategy,
                    description = description,
                    customPath = null
                )

                // Créer l'entrée dans le registry
                val registryEntry = VaultRegistryEntry(
                    id = vaultId,
                    name = name,
                    filePath = file.absolutePath,
                    storageStrategy = strategy,
                    fileSize = file.length(),
                    lastModified = file.lastModified(),
                    lastAccessed = null,
                    isDefault = setAsDefault,
                    isLoaded = false,
                    statistics = com.julien.genpwdpro.data.models.vault.VaultStatistics(),
                    description = description,
                    createdAt = System.currentTimeMillis()
                )

                vaultRegistryDao.insert(registryEntry)

                if (setAsDefault) {
                    vaultRegistryDao.setAsDefault(vaultId)
                }

                _uiState.update { it.copy(isLoading = false, showCreateDialog = false) }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Failed to create vault: ${e.message}"
                    )
                }
            }
        }
    }

    /**
     * Définit un vault comme par défaut
     */
    fun setAsDefault(vaultId: String) {
        viewModelScope.launch {
            try {
                vaultRegistryDao.setAsDefault(vaultId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to set default: ${e.message}") }
            }
        }
    }

    /**
     * Charge un vault en mémoire
     */
    fun loadVault(vaultId: String) {
        viewModelScope.launch {
            try {
                vaultRegistryDao.updateLoadedStatus(vaultId, true)
                vaultRegistryDao.updateLastAccessed(vaultId, System.currentTimeMillis())
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to load vault: ${e.message}") }
            }
        }
    }

    /**
     * Décharge un vault de la mémoire
     */
    fun unloadVault(vaultId: String) {
        viewModelScope.launch {
            try {
                vaultRegistryDao.updateLoadedStatus(vaultId, false)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to unload vault: ${e.message}") }
            }
        }
    }

    /**
     * Supprime un vault
     */
    fun deleteVault(vaultId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Récupérer l'entrée pour obtenir le chemin du fichier
                val entry = vaultRegistryDao.getById(vaultId)
                if (entry != null) {
                    // Supprimer le fichier
                    val file = File(entry.filePath)
                    if (file.exists()) {
                        file.delete()
                    }
                }

                // Supprimer du registry
                vaultRegistryDao.deleteById(vaultId)

                _uiState.update { it.copy(isLoading = false, confirmDeleteVaultId = null) }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Failed to delete vault: ${e.message}"
                    )
                }
            }
        }
    }

    /**
     * Exporte un vault vers une destination
     */
    fun exportVault(vaultId: String, destinationUri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val entry = vaultRegistryDao.getById(vaultId)
                    ?: throw IllegalStateException("Vault not found")

                val success = vaultFileManager.exportVault(
                    vaultId = vaultId,
                    sourceFilePath = entry.filePath,
                    destinationUri = destinationUri
                )

                if (success) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            successMessage = "Vault exported successfully"
                        )
                    }
                } else {
                    throw Exception("Export failed")
                }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Failed to export vault: ${e.message}"
                    )
                }
            }
        }
    }

    /**
     * Importe un vault depuis une source
     */
    fun importVault(sourceUri: Uri, masterPassword: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val result = vaultFileManager.importVault(
                    sourceUri = sourceUri,
                    destinationStrategy = StorageStrategy.APP_STORAGE
                )

                val (vaultId, file) = result

                // Charger le vault pour obtenir les métadonnées
                val vaultData = vaultFileManager.loadVaultFile(
                    vaultId = vaultId,
                    masterPassword = masterPassword,
                    filePath = file.absolutePath
                )

                // Créer l'entrée dans le registry
                val registryEntry = VaultRegistryEntry(
                    id = vaultId,
                    name = vaultData.metadata.name,
                    filePath = file.absolutePath,
                    storageStrategy = StorageStrategy.APP_STORAGE,
                    fileSize = file.length(),
                    lastModified = file.lastModified(),
                    lastAccessed = null,
                    isDefault = false,
                    isLoaded = false,
                    statistics = vaultData.metadata.statistics,
                    description = vaultData.metadata.description,
                    createdAt = vaultData.metadata.createdAt
                )

                vaultRegistryDao.insert(registryEntry)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        showImportDialog = false,
                        successMessage = "Vault imported successfully"
                    )
                }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Failed to import vault: ${e.message}"
                    )
                }
            }
        }
    }

    /**
     * Lance la migration Room → .gpv
     */
    fun startMigration(masterPasswords: Map<String, String>) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMigrating = true, migrationProgress = null) }

            val result = migrationManager.migrateAllVaults(
                masterPasswords = masterPasswords,
                progressCallback = { progress ->
                    _uiState.update { it.copy(migrationProgress = progress) }
                }
            )

            when (result) {
                is VaultMigrationManager.MigrationResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isMigrating = false,
                            showMigrationDialog = false,
                            successMessage = "${result.migratedCount} vaults migrated successfully"
                        )
                    }
                }
                is VaultMigrationManager.MigrationResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isMigrating = false,
                            error = result.message
                        )
                    }
                }
                VaultMigrationManager.MigrationResult.NotNeeded -> {
                    _uiState.update {
                        it.copy(
                            isMigrating = false,
                            showMigrationDialog = false
                        )
                    }
                }
            }
        }
    }

    // UI Actions
    fun showCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = true) }
    }

    fun hideCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = false) }
    }

    fun showImportDialog() {
        _uiState.update { it.copy(showImportDialog = true) }
    }

    fun hideImportDialog() {
        _uiState.update { it.copy(showImportDialog = false) }
    }

    fun showDeleteConfirmation(vaultId: String) {
        _uiState.update { it.copy(confirmDeleteVaultId = vaultId) }
    }

    fun hideDeleteConfirmation() {
        _uiState.update { it.copy(confirmDeleteVaultId = null) }
    }

    fun hideMigrationDialog() {
        _uiState.update { it.copy(showMigrationDialog = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }
}

/**
 * État de l'UI pour la gestion des vaults
 */
data class VaultManagerUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
    val showCreateDialog: Boolean = false,
    val showImportDialog: Boolean = false,
    val showMigrationDialog: Boolean = false,
    val confirmDeleteVaultId: String? = null,
    val isMigrating: Boolean = false,
    val migrationProgress: VaultMigrationManager.MigrationProgress? = null
)
