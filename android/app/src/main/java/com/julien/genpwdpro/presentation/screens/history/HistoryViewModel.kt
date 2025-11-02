package com.julien.genpwdpro.presentation.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel pour l'écran d'historique
 */
@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val historyRepository: PasswordHistoryRepository,
    private val sensitiveActionPreferences: SensitiveActionPreferences
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    val requireBiometricForSensitiveActions: StateFlow<Boolean> =
        sensitiveActionPreferences.requireBiometricForSensitiveActions
    val clipboardTtlMs: StateFlow<Long> = sensitiveActionPreferences.clipboardTtlMs

    /**
     * Liste des mots de passe de l'historique
     * Avec recherche en temps réel
     */
    val historyItems: StateFlow<List<PasswordResult>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                historyRepository.getHistory()
            } else {
                historyRepository.searchHistory(query)
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    /**
     * Met à jour la requête de recherche
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    /**
     * Supprime un mot de passe de l'historique
     */
    fun deletePassword(id: String) {
        viewModelScope.launch {
            historyRepository.deletePassword(id)
        }
    }

    /**
     * Efface tout l'historique
     */
    fun clearHistory() {
        viewModelScope.launch {
            _isLoading.value = true
            historyRepository.clearHistory()
            _isLoading.value = false
        }
    }
}
