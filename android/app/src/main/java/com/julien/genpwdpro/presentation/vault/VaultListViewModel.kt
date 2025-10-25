package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.repository.VaultRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour la liste des entrées de vault
 */
@HiltViewModel
class VaultListViewModel @Inject constructor(
    private val vaultRepository: VaultRepository,
    private val totpGenerator: TotpGenerator
) : ViewModel() {

    private val _uiState = MutableStateFlow<VaultListUiState>(VaultListUiState.Loading)
    val uiState: StateFlow<VaultListUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _filterType = MutableStateFlow<EntryType?>(null)
    val filterType: StateFlow<EntryType?> = _filterType.asStateFlow()

    private val _showFavoritesOnly = MutableStateFlow(false)
    val showFavoritesOnly: StateFlow<Boolean> = _showFavoritesOnly.asStateFlow()

    private val _statistics = MutableStateFlow<VaultRepository.VaultStatistics?>(null)
    val statistics: StateFlow<VaultRepository.VaultStatistics?> = _statistics.asStateFlow()

    private var currentVaultId: String? = null

    /**
     * Charge les entrées d'un vault
     */
    fun loadEntries(vaultId: String) {
        currentVaultId = vaultId
        viewModelScope.launch {
            try {
                vaultRepository.getEntries(vaultId).collect { entries ->
                    val filtered = entries.filter { entry ->
                        val matchesSearch = if (_searchQuery.value.isEmpty()) {
                            true
                        } else {
                            entry.title.contains(_searchQuery.value, ignoreCase = true)
                        }

                        val matchesType = _filterType.value?.let { type ->
                            entry.entryType == type
                        } ?: true

                        val matchesFavorites = if (_showFavoritesOnly.value) {
                            entry.isFavorite
                        } else {
                            true
                        }

                        matchesSearch && matchesType && matchesFavorites
                    }

                    _uiState.value = VaultListUiState.Success(filtered)
                }
            } catch (e: Exception) {
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur lors du chargement")
            }
        }
    }

    /**
     * Charge les statistiques du vault
     */
    fun loadStatistics(vaultId: String) {
        viewModelScope.launch {
            try {
                val stats = vaultRepository.getVaultStatistics(vaultId)
                _statistics.value = stats
            } catch (e: Exception) {
                // Ignorer les erreurs de stats
            }
        }
    }

    /**
     * Recherche des entrées
     */
    fun searchEntries(query: String) {
        _searchQuery.value = query
        currentVaultId?.let { loadEntries(it) }
    }

    /**
     * Filtre par type
     */
    fun filterByType(type: EntryType?) {
        _filterType.value = type
        currentVaultId?.let { loadEntries(it) }
    }

    /**
     * Toggle favoris uniquement
     */
    fun toggleFavoritesOnly() {
        _showFavoritesOnly.value = !_showFavoritesOnly.value
        currentVaultId?.let { loadEntries(it) }
    }

    /**
     * Toggle le statut favori d'une entrée
     */
    fun toggleFavorite(entryId: String, isFavorite: Boolean) {
        viewModelScope.launch {
            try {
                vaultRepository.toggleFavorite(entryId, isFavorite)
            } catch (e: Exception) {
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur")
            }
        }
    }

    /**
     * Supprime une entrée
     */
    fun deleteEntry(entryId: String) {
        viewModelScope.launch {
            try {
                vaultRepository.deleteEntry(entryId)
                currentVaultId?.let { loadEntries(it) }
            } catch (e: Exception) {
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur lors de la suppression")
            }
        }
    }

    /**
     * Génère un code TOTP pour une entrée
     */
    fun generateTotpCode(entry: VaultRepository.DecryptedEntry): TotpGenerator.TotpResult? {
        if (!entry.hasTOTP || entry.totpSecret.isEmpty()) return null

        return try {
            totpGenerator.generateTotpResult(
                TotpGenerator.TotpConfig(
                    secret = entry.totpSecret,
                    period = entry.totpPeriod,
                    digits = entry.totpDigits,
                    algorithm = entry.totpAlgorithm
                )
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Réinitialise les filtres
     */
    fun clearFilters() {
        _searchQuery.value = ""
        _filterType.value = null
        _showFavoritesOnly.value = false
        currentVaultId?.let { loadEntries(it) }
    }
}

/**
 * États de l'UI de la liste
 */
sealed class VaultListUiState {
    object Loading : VaultListUiState()
    data class Success(val entries: List<VaultRepository.DecryptedEntry>) : VaultListUiState()
    data class Error(val message: String) : VaultListUiState()
}
