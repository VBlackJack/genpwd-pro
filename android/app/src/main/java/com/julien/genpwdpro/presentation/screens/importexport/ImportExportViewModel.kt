package com.julien.genpwdpro.presentation.screens.importexport

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.repository.ImportExportRepository
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.crypto.SecretKey
import javax.inject.Inject

/**
 * ViewModel pour la gestion des imports/exports
 *
 * Fonctionnalités:
 * - Export CSV (non chiffré)
 * - Import CSV
 * - Export JSON chiffré
 * - Import/Restore JSON chiffré
 */
@HiltViewModel
class ImportExportViewModel @Inject constructor(
    private val importExportRepository: ImportExportRepository,
    private val sessionManager: VaultSessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ImportExportUiState())
    val uiState: StateFlow<ImportExportUiState> = _uiState.asStateFlow()

    /**
     * Export vers CSV (non chiffré)
     *
     * ⚠️ Attention: Le CSV contient des données en clair!
     */
    fun exportToCsv(vaultId: String, uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isExporting = true, exportError = null) }

            val vaultKey = sessionManager.getVaultKey(vaultId)
            if (vaultKey == null) {
                _uiState.update {
                    it.copy(
                        isExporting = false,
                        exportError = "Vault non déverrouillé"
                    )
                }
                return@launch
            }

            val result = importExportRepository.exportToCsv(vaultId, vaultKey, uri)

            result.fold(
                onSuccess = { count ->
                    _uiState.update {
                        it.copy(
                            isExporting = false,
                            lastExportSuccess = true,
                            lastExportCount = count,
                            exportSuccessMessage = "$count entrées exportées avec succès"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isExporting = false,
                            exportError = error.message ?: "Erreur lors de l'export CSV"
                        )
                    }
                }
            )
        }
    }

    /**
     * Import depuis CSV
     */
    fun importFromCsv(vaultId: String, uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isImporting = true, importError = null) }

            val vaultKey = sessionManager.getVaultKey(vaultId)
            if (vaultKey == null) {
                _uiState.update {
                    it.copy(
                        isImporting = false,
                        importError = "Vault non déverrouillé"
                    )
                }
                return@launch
            }

            val result = importExportRepository.importFromCsv(vaultId, vaultKey, uri)

            result.fold(
                onSuccess = { count ->
                    _uiState.update {
                        it.copy(
                            isImporting = false,
                            lastImportSuccess = true,
                            lastImportCount = count,
                            importSuccessMessage = "$count entrées importées avec succès"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isImporting = false,
                            importError = error.message ?: "Erreur lors de l'import CSV"
                        )
                    }
                }
            )
        }
    }

    /**
     * Export vers JSON chiffré (backup sécurisé)
     */
    fun exportToEncryptedJson(vaultId: String, masterPassword: String, uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isExporting = true, exportError = null) }

            val result = importExportRepository.exportToEncryptedJson(vaultId, masterPassword, uri)

            result.fold(
                onSuccess = { count ->
                    _uiState.update {
                        it.copy(
                            isExporting = false,
                            lastExportSuccess = true,
                            lastExportCount = count,
                            exportSuccessMessage = "Backup chiffré créé avec succès ($count entrées)"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isExporting = false,
                            exportError = error.message ?: "Erreur lors de l'export JSON"
                        )
                    }
                }
            )
        }
    }

    /**
     * Import/Restore depuis JSON chiffré
     */
    fun importFromEncryptedJson(masterPassword: String, uri: Uri, newVaultName: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isImporting = true, importError = null) }

            val result = importExportRepository.importFromEncryptedJson(masterPassword, uri, newVaultName)

            result.fold(
                onSuccess = { vaultId ->
                    _uiState.update {
                        it.copy(
                            isImporting = false,
                            lastImportSuccess = true,
                            importSuccessMessage = "Vault restauré avec succès (ID: ${vaultId.take(8)}...)"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isImporting = false,
                            importError = error.message ?: "Erreur lors de l'import JSON"
                        )
                    }
                }
            )
        }
    }

    /**
     * Réinitialiser les messages de succès/erreur
     */
    fun clearMessages() {
        _uiState.update {
            it.copy(
                exportError = null,
                importError = null,
                exportSuccessMessage = null,
                importSuccessMessage = null
            )
        }
    }

    /**
     * Obtenir la liste des vaults déverrouillés
     */
    fun getUnlockedVaults(): List<String> {
        return sessionManager.getUnlockedVaultIds()
    }
}

/**
 * État de l'UI Import/Export
 */
data class ImportExportUiState(
    val isExporting: Boolean = false,
    val isImporting: Boolean = false,
    val exportError: String? = null,
    val importError: String? = null,
    val lastExportSuccess: Boolean = false,
    val lastImportSuccess: Boolean = false,
    val lastExportCount: Int = 0,
    val lastImportCount: Int = 0,
    val exportSuccessMessage: String? = null,
    val importSuccessMessage: String? = null
)
