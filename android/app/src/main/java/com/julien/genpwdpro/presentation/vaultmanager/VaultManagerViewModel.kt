package com.julien.genpwdpro.presentation.vaultmanager

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.File
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel pour la gestion des vaults
 */
@HiltViewModel
class VaultManagerViewModel @Inject constructor(
    private val vaultRegistryDao: VaultRegistryDao,
    private val vaultFileManager: VaultFileManager,
    private val biometricVaultManager: com.julien.genpwdpro.security.BiometricVaultManager,
    private val vaultSessionManager: VaultSessionManager
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

    // Migration removed - Room to .gpv migration is no longer needed

    /**
     * Crée un nouveau vault
     */
    fun createVault(
        activity: androidx.fragment.app.FragmentActivity?,
        name: String,
        masterPassword: String,
        strategy: StorageStrategy,
        description: String? = null,
        setAsDefault: Boolean = false,
        enableBiometric: Boolean = false
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val vaultId: String
                val filePath: String
                val fileSize: Long
                val lastModified: Long

                if (strategy == StorageStrategy.CUSTOM) {
                    // Utiliser SAF pour custom paths
                    val customFolderUri = _uiState.value.customFolderUri
                        ?: throw IllegalStateException("Custom folder not selected")

                    val (id, fileUri) = vaultFileManager.createVaultFileToUri(
                        name = name,
                        masterPassword = masterPassword,
                        customFolderUri = customFolderUri,
                        description = description
                    )

                    vaultId = id
                    filePath = vaultFileManager.uriToPath(fileUri)
                    fileSize = vaultFileManager.getVaultFileSizeFromUri(fileUri)
                    lastModified = System.currentTimeMillis()
                } else {
                    // Utiliser les méthodes standard pour les autres stratégies
                    val (id, location) = vaultFileManager.createVaultFile(
                        name = name,
                        masterPassword = masterPassword,
                        strategy = strategy,
                        description = description,
                        customPath = null
                    )

                    vaultId = id
                    val file = location.file
                    val uri = location.uri
                    when {
                        file != null -> {
                            filePath = file.absolutePath
                            fileSize = file.length()
                            lastModified = file.lastModified()
                        }
                        uri != null -> {
                            filePath = vaultFileManager.uriToPath(uri)
                            fileSize = vaultFileManager.getVaultFileSizeFromUri(uri)
                            lastModified = System.currentTimeMillis()
                        }
                        else -> throw IllegalStateException("Vault file location unavailable")
                    }
                }

                // Créer l'entrée dans le registry
                // Note: Si biométrie activée, on créé d'abord avec le flag à false,
                // puis on laisse enableBiometric() le mettre à true après chiffrement
                val registryEntry = VaultRegistryEntry(
                    id = vaultId,
                    name = name,
                    filePath = filePath,
                    storageStrategy = strategy,
                    fileSize = fileSize,
                    lastModified = lastModified,
                    lastAccessed = null,
                    isDefault = setAsDefault,
                    isLoaded = false,
                    statistics = com.julien.genpwdpro.data.models.vault.VaultStatistics(),
                    description = description,
                    createdAt = System.currentTimeMillis(),
                    biometricUnlockEnabled = false // Sera mis à true par enableBiometric()
                )

                vaultRegistryDao.insert(registryEntry)

                if (setAsDefault) {
                    vaultRegistryDao.setAsDefault(vaultId)
                }

                // Sauvegarder la biométrie si demandé
                if (enableBiometric && activity != null) {
                    SafeLog.d("VaultManagerVM", "Enabling biometric for vault=${SafeLog.redact(vaultId)}")
                    val biometricResult = biometricVaultManager.enableBiometric(
                        activity,
                        vaultId,
                        masterPassword
                    )
                    biometricResult.fold(
                        onSuccess = {
                            SafeLog.i(
                                "VaultManagerVM",
                                "✅ Biometric enabled successfully for vault ${SafeLog.redact(vaultId)}"
                            )
                        },
                        onFailure = { error ->
                            SafeLog.e(
                                "VaultManagerVM",
                                "❌ Failed to save biometric for vault ${SafeLog.redact(vaultId)}: ${error.message}",
                                error
                            )
                        }
                    )
                } else if (enableBiometric && activity == null) {
                    SafeLog.w(
                        "VaultManagerVM",
                        "Cannot enable biometric: activity is null"
                    )
                }

                // Auto-déverrouiller le vault nouvellement créé
                val autoUnlockResult = try {
                    vaultSessionManager.unlockVault(vaultId, masterPassword)
                } catch (unlockError: Exception) {
                    Result.failure(unlockError)
                }

                val successMessage = if (autoUnlockResult.isSuccess) {
                    "Coffre créé et déverrouillé automatiquement"
                } else {
                    val reason = autoUnlockResult.exceptionOrNull()?.message ?: "échec du déverrouillage"
                    "Coffre créé. Déverrouillez-le manuellement ($reason)"
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        showCreateDialog = false,
                        customFolderUri = null, // Reset après création
                        successMessage = successMessage
                    )
                }
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
     * Définit le dossier personnalisé pour la stratégie CUSTOM
     */
    fun setCustomFolderUri(uri: Uri?) {
        _uiState.update { it.copy(customFolderUri = uri) }
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
                    val targetUri = vaultFileManager.pathToUri(entry.filePath)
                    val deleted = when {
                        targetUri != null -> vaultFileManager.deleteVaultFile(targetUri)
                        else -> vaultFileManager.deleteVaultFile(File(entry.filePath))
                    }
                    SafeLog.d("VaultManagerViewModel", "Vault file deletion result=$deleted")
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

                val (vaultId, location) = result
                val file = location.file
                val uri = location.uri

                val loadResult = when {
                    file != null -> vaultFileManager.loadVaultFile(
                        vaultId = vaultId,
                        masterPassword = masterPassword,
                        filePath = file.absolutePath
                    )

                    uri != null -> vaultFileManager.loadVaultFileFromUri(
                        vaultId = vaultId,
                        masterPassword = masterPassword,
                        fileUri = uri
                    )

                    else -> throw IllegalStateException("Imported vault location unavailable")
                }

                val vaultData = loadResult.data

                val resolvedFilePath = file?.absolutePath ?: uri?.let { vaultFileManager.uriToPath(it) }
                    ?: throw IllegalStateException("Unable to resolve imported vault path")
                val resolvedSize = file?.length() ?: uri?.let { vaultFileManager.getVaultFileSizeFromUri(it) }
                    ?: 0L
                val resolvedLastModified = file?.lastModified() ?: System.currentTimeMillis()

                // Créer l'entrée dans le registry
                val registryEntry = VaultRegistryEntry(
                    id = vaultId,
                    name = vaultData.metadata.name,
                    filePath = resolvedFilePath,
                    storageStrategy = StorageStrategy.APP_STORAGE,
                    fileSize = resolvedSize,
                    lastModified = resolvedLastModified,
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

    // Migration removed - Room to .gpv migration is no longer needed

    // UI Actions
    fun showCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = true) }
    }

    fun hideCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = false, customFolderUri = null) }
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

    // Migration dialog removed - no longer needed

    fun showExportDialog(vaultId: String) {
        _uiState.update { it.copy(exportVaultId = vaultId) }
    }

    fun hideExportDialog() {
        _uiState.update { it.copy(exportVaultId = null) }
    }

    /**
     * Importe un coffre depuis un fichier .gpv (sans mot de passe)
     */
    fun importVaultFromFile(fileUri: Uri, vaultName: String = "Coffre importé") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                // Importer le fichier vers le stockage interne
                val (vaultId, location) = vaultFileManager.importVault(
                    sourceUri = fileUri,
                    destinationStrategy = StorageStrategy.INTERNAL
                )

                val file = location.file
                val uri = location.uri
                val filePath = file?.absolutePath ?: uri?.let { vaultFileManager.uriToPath(it) }
                    ?: throw IllegalStateException("Imported vault location unavailable")
                val fileSize = file?.length() ?: uri?.let { vaultFileManager.getVaultFileSizeFromUri(it) }
                    ?: 0L
                val lastModified = file?.lastModified() ?: System.currentTimeMillis()

                // Créer une entrée dans le registry avec les paramètres corrects
                val registryEntry = VaultRegistryEntry(
                    id = vaultId,
                    name = vaultName,
                    filePath = filePath,
                    storageStrategy = StorageStrategy.INTERNAL,
                    fileSize = fileSize,
                    lastModified = lastModified,
                    lastAccessed = null,
                    isDefault = false,
                    isLoaded = false,
                    statistics = com.julien.genpwdpro.data.models.vault.VaultStatistics(),
                    description = null,
                    createdAt = System.currentTimeMillis(),
                    biometricUnlockEnabled = false
                )

                vaultRegistryDao.insert(registryEntry)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        successMessage = "Coffre importé avec succès",
                        showImportDialog = false
                    )
                }
            } catch (e: Exception) {
                SafeLog.e("VaultManagerViewModel", "Import error", e)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Erreur lors de l'import: ${e.message}"
                    )
                }
            }
        }
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
    val confirmDeleteVaultId: String? = null,
    val exportVaultId: String? = null,  // ID du coffre à exporter
    val customFolderUri: Uri? = null // URI du dossier sélectionné pour CUSTOM storage
)
