package com.julien.genpwdpro.presentation.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.models.*
import com.julien.genpwdpro.data.models.vault.DecryptedPreset
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.repository.FileVaultRepository
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
 * ViewModel for password generation screen
 * Migrated to use FileVaultRepository (file-based system)
 */
@HiltViewModel
class GeneratorViewModel @Inject constructor(
    private val generatePasswordUseCase: GeneratePasswordUseCase,
    private val historyRepository: PasswordHistoryRepository,
    private val settingsDataStore: SettingsDataStore,
    private val fileVaultRepository: FileVaultRepository,
    private val vaultSessionManager: com.julien.genpwdpro.domain.session.VaultSessionManager,
    private val vaultRegistryDao: com.julien.genpwdpro.data.db.dao.VaultRegistryDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(GeneratorUiState())
    val uiState: StateFlow<GeneratorUiState> = _uiState.asStateFlow()

    private val _currentPreset = MutableStateFlow<DecryptedPreset?>(null)
    val currentPreset: StateFlow<DecryptedPreset?> = _currentPreset.asStateFlow()

    private val _presets = MutableStateFlow<List<DecryptedPreset>>(emptyList())
    val presets: StateFlow<List<DecryptedPreset>> = _presets.asStateFlow()

    // Vault unlock dialog state
    private val _availableVaults = MutableStateFlow<List<com.julien.genpwdpro.data.db.entity.VaultRegistryEntry>>(emptyList())
    val availableVaults: StateFlow<List<com.julien.genpwdpro.data.db.entity.VaultRegistryEntry>> = _availableVaults.asStateFlow()

    private val _showUnlockDialog = MutableStateFlow(false)
    val showUnlockDialog: StateFlow<Boolean> = _showUnlockDialog.asStateFlow()

    private val _isUnlocking = MutableStateFlow(false)
    val isUnlocking: StateFlow<Boolean> = _isUnlocking.asStateFlow()

    private val _unlockError = MutableStateFlow<String?>(null)
    val unlockError: StateFlow<String?> = _unlockError.asStateFlow()

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

        // Charger la liste des vaults disponibles
        viewModelScope.launch {
            vaultRegistryDao.getAllVaults().collectLatest { vaults ->
                _availableVaults.value = vaults
            }
        }
    }

    /**
     * Loads presets for a vault (file-based system)
     * Fixed: Uses collectLatest to prevent memory leaks
     */
    fun loadPresets(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                // Check if vault is unlocked
                if (!vaultSessionManager.isVaultUnlocked()) {
                    SafeLog.w("GeneratorViewModel", "Cannot load presets: Vault not unlocked")
                    return@launch
                }

                // Load presets from FileVaultRepository (already converted to DecryptedPreset)
                // Use collectLatest instead of collect to cancel previous collection
                fileVaultRepository.getPresetsDecrypted().collectLatest { presets ->
                    _presets.value = presets

                    // Load default preset if none selected
                    val defaultPreset = presets.firstOrNull { it.isDefault }
                    if (defaultPreset != null && _currentPreset.value == null) {
                        selectPreset(defaultPreset)
                    }
                }
            } catch (e: Exception) {
                SafeLog.e("GeneratorViewModel", "Error loading presets: ${e.message}", e)
                _uiState.update {
                    it.copy(error = "Error loading presets: ${e.message}")
                }
            }
        }
    }

    /**
     * Selects a preset and applies its settings
     */
    fun selectPreset(preset: DecryptedPreset) {
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
                SafeLog.e("GeneratorViewModel", "Failed to record preset usage: ${e.message}")
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
                    // Afficher le dialog de déverrouillage au lieu d'une erreur
                    showUnlockDialog()
                    return@launch
                }

                val currentSettings = _uiState.value.settings

                // Convertir les settings en JSON
                val settingsJson = gson.toJson(currentSettings)

                // Créer le PresetEntity
                val preset = com.julien.genpwdpro.data.models.vault.PresetEntity(
                    id = java.util.UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    name = trimmedName,
                    icon = icon,
                    generationMode = currentSettings.mode.name,
                    settings = settingsJson,
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

    /**
     * Affiche le dialog de déverrouillage rapide
     */
    fun showUnlockDialog() {
        _showUnlockDialog.value = true
        _unlockError.value = null
    }

    /**
     * Masque le dialog de déverrouillage rapide
     */
    fun hideUnlockDialog() {
        _showUnlockDialog.value = false
        _unlockError.value = null
        _isUnlocking.value = false
    }

    /**
     * Déverrouille un coffre
     */
    fun unlockVault(vaultId: String, password: String) {
        viewModelScope.launch {
            _isUnlocking.value = true
            _unlockError.value = null

            try {
                val result = vaultSessionManager.unlockVault(vaultId, password)
                result.fold(
                    onSuccess = {
                        // Mise à jour du vault ID actuel
                        currentVaultId = vaultId

                        // Masquer le dialog
                        hideUnlockDialog()

                        // Recharger les presets
                        loadPresets(vaultId)

                        // Effacer l'erreur dans l'UI state
                        _uiState.update { it.copy(error = null) }

                        SafeLog.i("GeneratorViewModel", "Vault unlocked successfully: $vaultId")
                    },
                    onFailure = { exception ->
                        _unlockError.value = exception.message ?: "Échec du déverrouillage"
                        SafeLog.e("GeneratorViewModel", "Failed to unlock vault: ${exception.message}", exception)
                    }
                )
            } catch (e: Exception) {
                _unlockError.value = e.message ?: "Erreur lors du déverrouillage"
                SafeLog.e("GeneratorViewModel", "Error unlocking vault: ${e.message}", e)
            } finally {
                _isUnlocking.value = false
            }
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
