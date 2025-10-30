package com.julien.genpwdpro.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * ViewModel pour le Dashboard unifié
 *
 * Gère:
 * - Le générateur rapide intégré
 * - La liste des coffres récents
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val generatePasswordUseCase: GeneratePasswordUseCase,
    private val vaultRegistryDao: VaultRegistryDao,
    private val vaultSessionManager: VaultSessionManager,
    private val sensitiveActionPreferences: SensitiveActionPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    val requireBiometricForSensitiveActions: StateFlow<Boolean> =
        sensitiveActionPreferences.requireBiometricForSensitiveActions
    val clipboardTtlMs: StateFlow<Long> = sensitiveActionPreferences.clipboardTtlMs

    init {
        observeVaults()
    }

    /**
     * Charge un mot de passe rapide au démarrage
     */
    fun loadQuickPassword() {
        generateQuickPassword()
    }

    /**
     * Observe les coffres disponibles pour alimenter le dashboard
     */
    private fun observeVaults() {
        viewModelScope.launch {
            combine(
                vaultRegistryDao.getAllVaults(),
                vaultRegistryDao.getDefaultVaultFlow(),
                vaultSessionManager.activeVaultId
            ) { vaults, defaultVault, activeVaultId ->
                DashboardVaultState(
                    vaults = vaults,
                    defaultVaultId = defaultVault?.id,
                    activeVaultId = activeVaultId
                )
            }.collect { vaultState ->
                _uiState.update {
                    it.copy(
                        vaults = vaultState.vaults,
                        defaultVaultId = vaultState.defaultVaultId,
                        activeVaultId = vaultState.activeVaultId
                    )
                }
            }
        }
    }

    /**
     * Génère un nouveau mot de passe rapide
     * Utilise le mode Syllables avec des paramètres par défaut
     */
    fun generateQuickPassword() {
        viewModelScope.launch {
            _uiState.update { it.copy(isGenerating = true, error = null) }
            try {
                // Paramètres par défaut optimisés pour utilisation rapide
                val quickSettings = Settings(
                    mode = GenerationMode.SYLLABLES,
                    syllablesLength = 16,
                    digitsCount = 2,
                    specialsCount = 2,
                    quantity = 1
                )

                val results = generatePasswordUseCase(quickSettings)
                val password = results.firstOrNull()?.password

                _uiState.update {
                    it.copy(
                        quickPassword = password,
                        isGenerating = false
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isGenerating = false,
                        error = e.message ?: "Erreur lors de la génération"
                    )
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

private data class DashboardVaultState(
    val vaults: List<VaultRegistryEntry>,
    val defaultVaultId: String?,
    val activeVaultId: String?
)

/**
 * État du Dashboard
 */
data class DashboardUiState(
    val quickPassword: String? = null,
    val isGenerating: Boolean = false,
    val error: String? = null,
    val vaults: List<VaultRegistryEntry> = emptyList(),
    val defaultVaultId: String? = null,
    val activeVaultId: String? = null
)
