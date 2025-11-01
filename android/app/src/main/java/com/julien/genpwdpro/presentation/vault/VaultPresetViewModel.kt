package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.vault.PresetEntity
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour gérer les presets depuis le VaultSessionManager (file-based)
 */
@HiltViewModel
class VaultPresetViewModel @Inject constructor(
    private val vaultSessionManager: VaultSessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(VaultPresetUiState())
    val uiState: StateFlow<VaultPresetUiState> = _uiState.asStateFlow()

    /**
     * Charge les presets du vault actuellement déverrouillé
     */
    fun loadPresets() {
        viewModelScope.launch {
            try {
                if (!vaultSessionManager.isVaultUnlocked()) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Aucun vault déverrouillé"
                        )
                    }
                    return@launch
                }

                vaultSessionManager.getPresets().collect { presets ->
                    _uiState.update {
                        it.copy(
                            presets = presets,
                            isLoading = false,
                            error = null
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Erreur lors du chargement des presets"
                    )
                }
            }
        }
    }

    /**
     * Supprime un preset
     */
    fun deletePreset(presetId: String) {
        viewModelScope.launch {
            try {
                val result = vaultSessionManager.deletePreset(presetId)
                result.fold(
                    onSuccess = {
                        _uiState.update { it.copy(error = null) }
                    },
                    onFailure = { exception ->
                        _uiState.update {
                            it.copy(error = exception.message ?: "Erreur lors de la suppression")
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur inattendue")
                }
            }
        }
    }

    /**
     * Efface l'erreur
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

/**
 * État de l'UI pour les presets du vault
 */
data class VaultPresetUiState(
    val presets: List<PresetEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
) {
    /**
     * Presets groupés par mode
     */
    val presetsByMode: Map<String, List<PresetEntity>>
        get() = presets.groupBy { it.generationMode }

    /**
     * Preset par défaut
     */
    val defaultPreset: PresetEntity?
        get() = presets.firstOrNull { it.isDefault }
}
