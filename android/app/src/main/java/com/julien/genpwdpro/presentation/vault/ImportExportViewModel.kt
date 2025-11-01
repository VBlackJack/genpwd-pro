package com.julien.genpwdpro.presentation.vault

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.repository.ImportExportRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.crypto.SecretKey
import javax.inject.Inject

/**
 * ViewModel pour l'import/export de données
 */
@HiltViewModel
class ImportExportViewModel @Inject constructor(
    private val importExportRepository: ImportExportRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ImportExportUiState>(ImportExportUiState.Idle)
    val uiState: StateFlow<ImportExportUiState> = _uiState.asStateFlow()

    private val _exportFormat = MutableStateFlow(ExportFormat.JSON)
    val exportFormat: StateFlow<ExportFormat> = _exportFormat.asStateFlow()

    private val _importFormat = MutableStateFlow(ImportFormat.CSV)
    val importFormat: StateFlow<ImportFormat> = _importFormat.asStateFlow()

    /**
     * Change le format d'export sélectionné
     */
    fun setExportFormat(format: ExportFormat) {
        _exportFormat.value = format
    }

    /**
     * Change le format d'import sélectionné
     */
    fun setImportFormat(format: ImportFormat) {
        _importFormat.value = format
    }

    /**
     * Exporte les données d'un vault
     */
    fun exportVault(
        vaultId: String,
        vaultKey: SecretKey,
        uri: Uri,
        format: ExportFormat
    ) {
        viewModelScope.launch {
            _uiState.value = ImportExportUiState.Exporting

            val result = when (format) {
                ExportFormat.CSV -> importExportRepository.exportToCsv(vaultId, vaultKey, uri)
                ExportFormat.JSON -> Result.failure(Exception("JSON export not yet implemented for file-based vaults"))
            }

            _uiState.value = result.fold(
                onSuccess = { count -> ImportExportUiState.ExportSuccess(count) },
                onFailure = { error -> ImportExportUiState.Error(error.message ?: "Erreur d'export") }
            )
        }
    }

    /**
     * Importe des données dans un vault
     */
    fun importVault(
        vaultId: String,
        vaultKey: SecretKey,
        uri: Uri,
        format: ImportFormat
    ) {
        viewModelScope.launch {
            _uiState.value = ImportExportUiState.Importing

            val result = when (format) {
                ImportFormat.CSV -> importExportRepository.importFromCsv(vaultId, vaultKey, uri)
                ImportFormat.JSON -> Result.failure(Exception("JSON import not yet implemented for file-based vaults"))
            }

            _uiState.value = result.fold(
                onSuccess = { count -> ImportExportUiState.ImportSuccess(count) },
                onFailure = { error -> ImportExportUiState.Error(error.message ?: "Erreur d'import") }
            )
        }
    }

    /**
     * Réinitialise l'état à Idle
     */
    fun resetState() {
        _uiState.value = ImportExportUiState.Idle
    }
}

/**
 * États possibles de l'UI Import/Export
 */
sealed class ImportExportUiState {
    object Idle : ImportExportUiState()
    object Exporting : ImportExportUiState()
    object Importing : ImportExportUiState()
    data class ExportSuccess(val entriesCount: Int) : ImportExportUiState()
    data class ImportSuccess(val entriesCount: Int) : ImportExportUiState()
    data class Error(val message: String) : ImportExportUiState()
}

/**
 * Formats d'export supportés
 */
enum class ExportFormat(val displayName: String, val extension: String, val isEncrypted: Boolean) {
    CSV("CSV (Non chiffré)", "csv", false),
    JSON("JSON (Chiffré)", "json", true)
}

/**
 * Formats d'import supportés
 */
enum class ImportFormat(val displayName: String, val extension: String) {
    CSV("CSV", "csv"),
    JSON("JSON", "json")
}
