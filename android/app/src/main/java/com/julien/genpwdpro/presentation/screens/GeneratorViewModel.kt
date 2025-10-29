package com.julien.genpwdpro.presentation.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.*
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    private val sensitiveActionPreferences: SensitiveActionPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(GeneratorUiState())
    val uiState: StateFlow<GeneratorUiState> = _uiState.asStateFlow()

    private val _currentPreset = MutableStateFlow<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset?>(null)
    val currentPreset: StateFlow<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset?> = _currentPreset.asStateFlow()

    private val _presets = MutableStateFlow<List<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset>>(emptyList())
    val presets: StateFlow<List<com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset>> = _presets.asStateFlow()

    private var currentVaultId: String? = null

    val requireBiometricForSensitiveActions: StateFlow<Boolean> =
        sensitiveActionPreferences.requireBiometricForSensitiveActions
    val clipboardTtlMs: StateFlow<Long> = sensitiveActionPreferences.clipboardTtlMs

    init {
        // Charger les settings sauvegardés
        viewModelScope.launch {
            settingsDataStore.settingsFlow.collect { savedSettings ->
                _uiState.update { it.copy(settings = savedSettings) }
            }
        }
    }

    /**
     * Charge les presets d'un vault
     */
    fun loadPresets(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                // Charger tous les presets du vault
                vaultRepository.getPresets(vaultId).collect { presetsList ->
                    _presets.value = presetsList

                    // Charger le preset par défaut si aucun preset n'est sélectionné
                    val defaultPreset = presetsList.firstOrNull { it.isDefault }
                    if (defaultPreset != null && _currentPreset.value == null) {
                        selectPreset(defaultPreset)
                    }
                }
            } catch (e: Exception) {
                // Gérer l'erreur silencieusement si le vault n'est pas déverrouillé
                android.util.Log.w("GeneratorViewModel", "Cannot load presets: ${e.message}")
            }
        }
    }

    /**
     * Sélectionne un preset et applique ses settings
     */
    fun selectPreset(preset: com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset) {
        _currentPreset.value = preset
        _uiState.update { it.copy(settings = preset.settings) }

        // Enregistrer l'utilisation
        viewModelScope.launch {
            try {
                vaultRepository.recordPresetUsage(preset.id)
            } catch (e: Exception) {
                // Ignorer l'erreur
            }
        }
    }

    /**
     * Sauvegarde les settings actuels comme nouveau preset
     */
    fun saveAsPreset(name: String, icon: String, setAsDefault: Boolean = false): Boolean {
        val vaultId = currentVaultId ?: return false

        viewModelScope.launch {
            try {
                val currentSettings = _uiState.value.settings

                // Vérifier qu'on peut créer un preset pour ce mode
                val canCreate = vaultRepository.canCreatePreset(vaultId, currentSettings.mode)
                if (!canCreate) {
                    _uiState.update {
                        it.copy(error = "Limite de 3 presets atteinte pour le mode ${currentSettings.mode.name}")
                    }
                    return@launch
                }

                val preset = com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset(
                    id = java.util.UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    name = name,
                    icon = icon,
                    generationMode = currentSettings.mode,
                    settings = currentSettings,
                    isDefault = setAsDefault,
                    isSystemPreset = false,
                    createdAt = System.currentTimeMillis(),
                    modifiedAt = System.currentTimeMillis(),
                    lastUsedAt = null,
                    usageCount = 0
                )

                val createdId = vaultRepository.createPreset(vaultId, preset)
                if (createdId != null) {
                    _currentPreset.value = preset
                    _uiState.update { it.copy(error = null) }
                }
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
