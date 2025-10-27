package com.julien.genpwdpro.presentation.preset

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel pour la gestion des presets de génération
 */
@HiltViewModel
class PresetViewModel @Inject constructor(
    private val vaultRepository: VaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PresetUiState())
    val uiState: StateFlow<PresetUiState> = _uiState.asStateFlow()

    private var currentVaultId: String? = null

    /**
     * Charge les presets d'un vault
     */
    fun loadPresets(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                vaultRepository.getPresets(vaultId).collect { presets ->
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
     * Crée un nouveau preset
     */
    fun createPreset(
        name: String,
        icon: String,
        mode: GenerationMode,
        settings: Settings,
        setAsDefault: Boolean = false
    ) {
        val vaultId = currentVaultId ?: return

        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isCreating = true) }

                // Vérifier si on peut créer un nouveau preset
                val canCreate = vaultRepository.canCreatePreset(vaultId, mode)
                if (!canCreate) {
                    _uiState.update {
                        it.copy(
                            isCreating = false,
                            error = "Limite de 3 presets atteinte pour le mode ${mode.name}"
                        )
                    }
                    return@launch
                }

                val preset = DecryptedPreset(
                    id = UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    name = name,
                    icon = icon,
                    generationMode = mode,
                    settings = settings,
                    isDefault = setAsDefault,
                    isSystemPreset = false,
                    createdAt = System.currentTimeMillis(),
                    modifiedAt = System.currentTimeMillis(),
                    lastUsedAt = null,
                    usageCount = 0
                )

                val createdId = vaultRepository.createPreset(vaultId, preset)
                if (createdId != null) {
                    _uiState.update {
                        it.copy(
                            isCreating = false,
                            createdPresetId = createdId,
                            error = null
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isCreating = false,
                            error = "Impossible de créer le preset"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCreating = false,
                        error = e.message ?: "Erreur lors de la création du preset"
                    )
                }
            }
        }
    }

    /**
     * Met à jour un preset existant
     */
    fun updatePreset(preset: DecryptedPreset) {
        val vaultId = currentVaultId ?: return

        viewModelScope.launch {
            try {
                vaultRepository.updatePreset(vaultId, preset)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur lors de la mise à jour du preset")
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
                vaultRepository.deletePreset(presetId)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur lors de la suppression du preset")
                }
            }
        }
    }

    /**
     * Définit un preset comme par défaut
     */
    fun setAsDefault(presetId: String) {
        val vaultId = currentVaultId ?: return

        viewModelScope.launch {
            try {
                vaultRepository.setAsDefaultPreset(vaultId, presetId)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur lors de la définition du preset par défaut")
                }
            }
        }
    }

    /**
     * Enregistre l'utilisation d'un preset
     */
    fun recordUsage(presetId: String) {
        viewModelScope.launch {
            try {
                vaultRepository.recordPresetUsage(presetId)
            } catch (e: Exception) {
                // Silent fail
            }
        }
    }

    /**
     * Vérifie si on peut créer un nouveau preset pour un mode donné
     */
    suspend fun canCreatePreset(mode: GenerationMode): Boolean {
        val vaultId = currentVaultId ?: return false
        return vaultRepository.canCreatePreset(vaultId, mode)
    }

    /**
     * Récupère le preset par défaut
     */
    suspend fun getDefaultPreset(): DecryptedPreset? {
        val vaultId = currentVaultId ?: return null
        return vaultRepository.getDefaultPreset(vaultId)
    }

    /**
     * Récupère un preset par ID
     */
    suspend fun getPresetById(presetId: String): DecryptedPreset? {
        val vaultId = currentVaultId ?: return null
        return vaultRepository.getPresetById(vaultId, presetId)
    }

    /**
     * Efface l'erreur
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    /**
     * Efface l'ID du preset créé
     */
    fun clearCreatedPresetId() {
        _uiState.update { it.copy(createdPresetId = null) }
    }
}

/**
 * État de l'UI pour les presets
 */
data class PresetUiState(
    val presets: List<DecryptedPreset> = emptyList(),
    val isLoading: Boolean = true,
    val isCreating: Boolean = false,
    val error: String? = null,
    val createdPresetId: String? = null
) {
    /**
     * Presets groupés par mode
     */
    val presetsByMode: Map<GenerationMode, List<DecryptedPreset>>
        get() = presets.groupBy { it.generationMode }

    /**
     * Preset par défaut
     */
    val defaultPreset: DecryptedPreset?
        get() = presets.firstOrNull { it.isDefault }

    /**
     * Presets Syllables
     */
    val syllablesPresets: List<DecryptedPreset>
        get() = presets.filter { it.generationMode == GenerationMode.SYLLABLES && !it.isSystemPreset }

    /**
     * Presets Passphrase
     */
    val passphrasePresets: List<DecryptedPreset>
        get() = presets.filter { it.generationMode == GenerationMode.PASSPHRASE && !it.isSystemPreset }

    /**
     * Vérifie si on peut créer un preset Syllables
     */
    val canCreateSyllablesPreset: Boolean
        get() = syllablesPresets.size < 3

    /**
     * Vérifie si on peut créer un preset Passphrase
     */
    val canCreatePassphrasePreset: Boolean
        get() = passphrasePresets.size < 3
}
