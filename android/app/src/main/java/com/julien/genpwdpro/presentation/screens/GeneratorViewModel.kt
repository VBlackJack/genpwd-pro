package com.julien.genpwdpro.presentation.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.*
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
    private val generatePasswordUseCase: GeneratePasswordUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(GeneratorUiState())
    val uiState: StateFlow<GeneratorUiState> = _uiState.asStateFlow()

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
        _uiState.update {
            it.copy(settings = update(it.settings).validate())
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
