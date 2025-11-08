package com.julien.genpwdpro.presentation.preset

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.data.models.vault.DecryptedPreset
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel for managing generation presets
 * Migrated to use FileVaultRepository (file-based system)
 */
@HiltViewModel
class PresetViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PresetUiState())
    val uiState: StateFlow<PresetUiState> = _uiState.asStateFlow()

    private var currentVaultId: String? = null

    /**
     * Loads presets for a vault
     * Note: vaultId is kept for backward compatibility but session manager uses active vault
     */
    fun loadPresets(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                fileVaultRepository.getPresetsDecrypted().collect { presets ->
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
                        error = e.message ?: "Error loading presets"
                    )
                }
            }
        }
    }

    /**
     * Creates a new preset
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

                // Check if we can create a new preset (max 15 per mode)
                val canCreate = fileVaultRepository.canCreatePreset(mode)
                if (!canCreate) {
                    _uiState.update {
                        it.copy(
                            isCreating = false,
                            error = "Limite de 15 presets atteinte pour le mode ${mode.name}"
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

                val createdId = fileVaultRepository.createPreset(preset)
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
                            error = "Unable to create preset"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCreating = false,
                        error = e.message ?: "Error creating preset"
                    )
                }
            }
        }
    }

    /**
     * Updates an existing preset
     */
    fun updatePreset(preset: DecryptedPreset) {
        viewModelScope.launch {
            try {
                fileVaultRepository.updatePresetDecrypted(preset)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Error updating preset")
                }
            }
        }
    }

    /**
     * Deletes a preset
     */
    fun deletePreset(presetId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.deletePreset(presetId)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Error deleting preset")
                }
            }
        }
    }

    /**
     * Duplicates a preset
     */
    fun duplicatePreset(preset: DecryptedPreset) {
        viewModelScope.launch {
            try {
                // Check if we can create a new preset (max 15 per mode)
                val canCreate = fileVaultRepository.canCreatePreset(preset.generationMode)
                if (!canCreate) {
                    _uiState.update {
                        it.copy(
                            error = "Limite de 15 presets atteinte pour le mode ${preset.generationMode.name}"
                        )
                    }
                    return@launch
                }

                // Create a duplicate with a new ID and name
                val duplicatedPreset = preset.copy(
                    id = UUID.randomUUID().toString(),
                    name = "Copie de ${preset.name}",
                    isDefault = false,
                    isSystemPreset = false,
                    createdAt = System.currentTimeMillis(),
                    modifiedAt = System.currentTimeMillis(),
                    lastUsedAt = null,
                    usageCount = 0
                )

                val createdId = fileVaultRepository.createPreset(duplicatedPreset)
                if (createdId != null) {
                    _uiState.update { it.copy(error = null) }
                } else {
                    _uiState.update {
                        it.copy(error = "Impossible de dupliquer le preset")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur lors de la duplication du preset")
                }
            }
        }
    }

    /**
     * Sets a preset as default
     */
    fun setAsDefault(presetId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.setAsDefaultPreset(presetId)
                _uiState.update { it.copy(error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        error = e.message ?: "Error setting default preset"
                    )
                }
            }
        }
    }

    /**
     * Records preset usage (increments count, updates last used timestamp)
     */
    fun recordUsage(presetId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.recordPresetUsage(presetId)
            } catch (e: Exception) {
                // Silent fail
            }
        }
    }

    /**
     * Checks if we can create a new preset for a given mode (max 3)
     */
    suspend fun canCreatePreset(mode: GenerationMode): Boolean {
        return fileVaultRepository.canCreatePreset(mode)
    }

    /**
     * Gets the default preset
     */
    suspend fun getDefaultPreset(): DecryptedPreset? {
        return fileVaultRepository.getDefaultPresetDecrypted()
    }

    /**
     * Gets a preset by ID
     */
    suspend fun getPresetById(presetId: String): DecryptedPreset? {
        return fileVaultRepository.getPresetByIdDecrypted(presetId)
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
