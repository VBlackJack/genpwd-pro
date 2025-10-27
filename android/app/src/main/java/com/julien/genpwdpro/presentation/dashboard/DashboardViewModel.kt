package com.julien.genpwdpro.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour le Dashboard unifié
 *
 * Gère:
 * - Le générateur rapide intégré
 * - L'état global de l'application
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val generatePasswordUseCase: GeneratePasswordUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    /**
     * Charge un mot de passe rapide au démarrage
     */
    fun loadQuickPassword() {
        generateQuickPassword()
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

/**
 * État du Dashboard
 */
data class DashboardUiState(
    val quickPassword: String? = null,
    val isGenerating: Boolean = false,
    val error: String? = null
)
