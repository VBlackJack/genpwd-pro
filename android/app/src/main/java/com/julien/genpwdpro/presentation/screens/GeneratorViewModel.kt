package com.julien.genpwdpro.presentation.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.*
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour l'écran de génération de mots de passe
 */
@HiltViewModel
class GeneratorViewModel @Inject constructor(
    private val generatePasswordUseCase: GeneratePasswordUseCase,
    private val historyRepository: PasswordHistoryRepository,
    private val settingsDataStore: SettingsDataStore,
    private val vaultRepository: com.julien.genpwdpro.data.repository.VaultRepository,
    private val vaultSessionManager: com.julien.genpwdpro.domain.session.VaultSessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(GeneratorUiState())
    val uiState: StateFlow<GeneratorUiState> = _uiState.asStateFlow()

    private val _currentPreset = MutableStateFlow<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset?>(null)
    val currentPreset: StateFlow<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset?> = _currentPreset.asStateFlow()

    private val _presets = MutableStateFlow<List<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset>>(emptyList())
    val presets: StateFlow<List<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset>> = _presets.asStateFlow()

    private var currentVaultId: String? = null

    companion object {
        private val gson = com.google.gson.Gson()
        private const val MAX_PRESET_NAME_LENGTH = 50
    }

    init {
        // Charger les settings sauvegardés
        // Fixed: Use collectLatest to prevent memory leaks
        viewModelScope.launch {
            settingsDataStore.settingsFlow.collectLatest { savedSettings ->
                _uiState.update { it.copy(settings = savedSettings) }
            }
        }
    }

    /**
     * Charge les presets d'un vault depuis VaultSessionManager
     * Fixed: Uses collectLatest to prevent memory leaks
     */
    fun loadPresets(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                // Vérifier que le vault est déverrouillé
                if (!vaultSessionManager.isVaultUnlocked()) {
                    android.util.Log.w("GeneratorViewModel", "Cannot load presets: Vault not unlocked")
                    return@launch
                }

                // Charger les presets depuis VaultSessionManager
                // Use collectLatest instead of collect to cancel previous collection
                vaultSessionManager.getPresets().collectLatest { presetEntities ->
                    val corruptedPresets = mutableListOf<String>()

                    // Convertir PresetEntity -> DecryptedPreset
                    val convertedPresets = presetEntities.mapNotNull { entity ->
                        // Désérialiser les settings depuis JSON
                        val settings = try {
                            gson.fromJson(
                                entity.encryptedSettings,
                                com.julien.genpwdpro.data.models.Settings::class.java
                            )
                        } catch (e: Exception) {
                            android.util.Log.e("GeneratorViewModel", "Failed to parse settings for preset ${entity.id}", e)
                            corruptedPresets.add(entity.encryptedName)
                            null
                        }

                        settings?.let {
                            com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset(
                                id = entity.id,
                                vaultId = entity.vaultId,
                                name = entity.encryptedName, // Already decrypted by file-based system
                                icon = entity.icon,
                                generationMode = com.julien.genpwdpro.data.models.GenerationMode.valueOf(entity.generationMode),
                                settings = it,
                                isDefault = entity.isDefault,
                                isSystemPreset = entity.isSystemPreset,
                                createdAt = entity.createdAt,
                                modifiedAt = entity.modifiedAt,
                                lastUsedAt = entity.lastUsedAt,
                                usageCount = entity.usageCount
                            )
                        }
                    }

                    _presets.value = convertedPresets

                    // Notifier l'utilisateur des presets corrompus
                    if (corruptedPresets.isNotEmpty()) {
                        _uiState.update {
                            it.copy(error = "Presets corrompus ignorés: ${corruptedPresets.joinToString(", ")}")
                        }
                    }

                    // Charger le preset par défaut si aucun preset n'est sélectionné
                    val defaultPreset = convertedPresets.firstOrNull { it.isDefault }
                    if (defaultPreset != null && _currentPreset.value == null) {
                        selectPreset(defaultPreset)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("GeneratorViewModel", "Error loading presets: ${e.message}", e)
                _uiState.update {
                    it.copy(error = "Erreur lors du chargement des presets: ${e.message}")
                }
            }
        }
    }

    /**
     * Sélectionne un preset et applique ses settings
     */
    fun selectPreset(preset: com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset) {
        _currentPreset.value = preset
        _uiState.update { it.copy(settings = preset.settings) }

        // Enregistrer l'utilisation via VaultSessionManager
        viewModelScope.launch {
            try {
                if (vaultSessionManager.isVaultUnlocked()) {
                    vaultSessionManager.getPresets().value.find { it.id == preset.id }?.let { presetEntity ->
                        val updatedPreset = presetEntity.copy(
                            lastUsedAt = System.currentTimeMillis(),
                            usageCount = presetEntity.usageCount + 1
                        )
                        vaultSessionManager.updatePreset(updatedPreset)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("GeneratorViewModel", "Failed to record preset usage: ${e.message}")
            }
        }
    }

    /**
     * Sauvegarde les settings actuels comme nouveau preset
     * Fixed: Added validation and uses singleton Gson instance
     */
    fun saveAsPreset(name: String, icon: String, setAsDefault: Boolean = false): Boolean {
        // Validate preset name
        val trimmedName = name.trim()
        when {
            trimmedName.isBlank() -> {
                _uiState.update { it.copy(error = "Le nom du preset ne peut pas être vide") }
                return false
            }
            trimmedName.length > MAX_PRESET_NAME_LENGTH -> {
                _uiState.update {
                    it.copy(error = "Le nom est trop long (max $MAX_PRESET_NAME_LENGTH caractères)")
                }
                return false
            }
        }

        val vaultId = currentVaultId ?: return false

        viewModelScope.launch {
            try {
                // Vérifier que le vault est déverrouillé
                if (!vaultSessionManager.isVaultUnlocked()) {
                    _uiState.update {
                        it.copy(error = "Le coffre doit être déverrouillé pour sauvegarder un preset")
                    }
                    return@launch
                }

                val currentSettings = _uiState.value.settings

                // Convertir les settings en JSON
                val settingsJson = gson.toJson(currentSettings)

                // Créer le PresetEntity
                val preset = com.julien.genpwdpro.data.local.entity.PresetEntity(
                    id = java.util.UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    encryptedName = trimmedName, // Stocké en clair car le fichier .gpv est chiffré
                    nameIv = "", // Pas utilisé avec le système file-based
                    icon = icon,
                    generationMode = currentSettings.mode.name,
                    encryptedSettings = settingsJson, // Stocké en clair car le fichier .gpv est chiffré
                    settingsIv = "", // Pas utilisé avec le système file-based
                    isDefault = setAsDefault,
                    isSystemPreset = false,
                    createdAt = System.currentTimeMillis(),
                    modifiedAt = System.currentTimeMillis(),
                    lastUsedAt = null,
                    usageCount = 0
                )

                // Ajouter via le session manager
                val result = vaultSessionManager.addPreset(preset)
                result.fold(
                    onSuccess = {
                        _uiState.update { it.copy(error = null) }
                        // Recharger les presets
                        loadPresets(vaultId)
                    },
                    onFailure = { exception ->
                        _uiState.update {
                            it.copy(error = exception.message ?: "Erreur lors de la création du preset")
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Erreur lors de la création du preset")
                }
            }
        }
        return true
    }

    /**
     * Génère des mots de passe
     */
    fun generatePasswords() {
        viewModelScope.launch {
            _uiState.update { it.copy(isGenerating = true, error = null) }
            try {
                val results = generatePasswordUseCase(_uiState.value.settings)
                _uiState.update {
                    it.copy(
                        results = results,
                        isGenerating = false
                    )
                }

                // Sauvegarder dans l'historique
                historyRepository.savePasswords(results)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isGenerating = false,
                        error = e.message ?: "Erreur inconnue"
                    )
                }
            }
        }
    }

    /**
     * Met à jour les paramètres
     */
    fun updateSettings(update: (Settings) -> Settings) {
        val newSettings = update(_uiState.value.settings).validate()
        _uiState.update {
            it.copy(settings = newSettings)
        }

        // Sauvegarder les settings
        viewModelScope.launch {
            settingsDataStore.saveSettings(newSettings)
        }
    }

    /**
     * Bascule le masquage d'un résultat
     */
    fun toggleMask(resultId: String) {
        _uiState.update { state ->
            state.copy(
                results = state.results.map { result ->
                    if (result.id == resultId) {
                        result.copy(isMasked = !result.isMasked)
                    } else {
                        result
                    }
                }
            )
        }
    }

    /**
     * Efface tous les résultats
     */
    fun clearResults() {
        _uiState.update { it.copy(results = emptyList()) }
    }

    /**
     * Bascule l'expansion d'une section
     */
    fun toggleSection(section: Section) {
        _uiState.update { state ->
            val expanded = state.expandedSections.toMutableSet()
            if (expanded.contains(section)) {
                expanded.remove(section)
            } else {
                expanded.add(section)
            }
            state.copy(expandedSections = expanded)
        }
    }
}

/**
 * État de l'UI
 */
data class GeneratorUiState(
    val settings: Settings = Settings(),
    val results: List<PasswordResult> = emptyList(),
    val isGenerating: Boolean = false,
    val error: String? = null,
    val expandedSections: Set<Section> = setOf(Section.MAIN_OPTIONS, Section.CHARACTERS)
)

/**
 * Sections repliables
 */
enum class Section {
    MAIN_OPTIONS,
    CHARACTERS,
    CASING
}
