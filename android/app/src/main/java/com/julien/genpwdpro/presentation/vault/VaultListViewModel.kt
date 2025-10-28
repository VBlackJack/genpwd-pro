package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.local.entity.*
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.domain.model.VaultStatistics
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour la liste des entrées de vault (nouveau système file-based)
 */
@HiltViewModel
class VaultListViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,
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

    private val _statistics = MutableStateFlow<VaultStatistics?>(null)
    val statistics: StateFlow<VaultStatistics?> = _statistics.asStateFlow()

    private var currentVaultId: String? = null

    /**
     * Charge les entrées d'un vault (nouveau système file-based)
     * Note: Le vaultId n'est utilisé que pour tracking, car FileVaultRepository
     * utilise la session active déverrouillée
     */
    fun loadEntries(vaultId: String) {
        currentVaultId = vaultId
        android.util.Log.d("VaultListViewModel", "Loading entries for vault: $vaultId")
        viewModelScope.launch {
            try {
                // ✅ FIX: Utiliser FileVaultRepository avec searchEntries() pour filtrage réactif
                combine(
                    fileVaultRepository.getEntries(),
                    _searchQuery,
                    _filterType,
                    _showFavoritesOnly
                ) { entries, search, typeFilter, favoritesOnly ->
                    android.util.Log.d("VaultListViewModel", "Received ${entries.size} entries from repository")
                    entries.filter { entry ->
                        val matchesSearch = if (search.isEmpty()) {
                            true
                        } else {
                            entry.title.contains(search, ignoreCase = true)
                        }

                        val matchesType = typeFilter?.let { type ->
                            entry.entryType.toEntryType() == type
                        } ?: true

                        val matchesFavorites = if (favoritesOnly) {
                            entry.isFavorite
                        } else {
                            true
                        }

                        matchesSearch && matchesType && matchesFavorites
                    }
                }.collect { filteredEntries ->
                    android.util.Log.d("VaultListViewModel", "Displaying ${filteredEntries.size} filtered entries")
                    _uiState.value = VaultListUiState.Success(filteredEntries)
                }
            } catch (e: Exception) {
                android.util.Log.e("VaultListViewModel", "Error loading entries: ${e.message}", e)
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur lors du chargement")
            }
        }
    }

    /**
     * Charge les statistiques du vault (nouveau système)
     */
    fun loadStatistics(vaultId: String) {
        viewModelScope.launch {
            try {
                // ✅ FIX: Utiliser FileVaultRepository.getStatistics()
                fileVaultRepository.getStatistics().collect { stats ->
                    _statistics.value = stats
                }
            } catch (e: Exception) {
                // Ignorer les erreurs de stats
            }
        }
    }

    /**
     * Recherche des entrées (réactif - pas besoin de recharger)
     */
    fun searchEntries(query: String) {
        _searchQuery.value = query
        // Le combine() dans loadEntries() gère automatiquement le filtrage
    }

    /**
     * Filtre par type (réactif)
     */
    fun filterByType(type: EntryType?) {
        _filterType.value = type
        // Le combine() dans loadEntries() gère automatiquement le filtrage
    }

    /**
     * Toggle favoris uniquement (réactif)
     */
    fun toggleFavoritesOnly() {
        _showFavoritesOnly.value = !_showFavoritesOnly.value
        // Le combine() dans loadEntries() gère automatiquement le filtrage
    }

    /**
     * Toggle le statut favori d'une entrée (nouveau système)
     */
    fun toggleFavorite(entryId: String) {
        viewModelScope.launch {
            try {
                // Get entry first to determine new favorite status
                val entry = fileVaultRepository.getEntryById(entryId)
                if (entry != null) {
                    fileVaultRepository.toggleFavorite(entryId, !entry.isFavorite)
                }
                // Le Flow dans loadEntries() se met à jour automatiquement
            } catch (e: Exception) {
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur")
            }
        }
    }

    /**
     * Supprime une entrée (nouveau système)
     */
    fun deleteEntry(entryId: String) {
        viewModelScope.launch {
            try {
                // ✅ FIX: Utiliser FileVaultRepository
                val result = fileVaultRepository.deleteEntry(entryId)
                result.onFailure { error ->
                    _uiState.value = VaultListUiState.Error(error.message ?: "Erreur lors de la suppression")
                }
                // Le Flow dans loadEntries() se met à jour automatiquement
            } catch (e: Exception) {
                _uiState.value = VaultListUiState.Error(e.message ?: "Erreur lors de la suppression")
            }
        }
    }

    /**
     * Génère un code TOTP pour une entrée
     */
    fun generateTotpCode(entry: VaultEntryEntity): TotpGenerator.TotpResult? {
        if (!entry.hasTOTP() || entry.totpSecret.isNullOrEmpty()) return null

        return try {
            totpGenerator.generateTotpResult(
                TotpGenerator.TotpConfig(
                    secret = entry.totpSecret!!,
                    period = entry.totpPeriod ?: 30,
                    digits = entry.totpDigits ?: 6,
                    algorithm = entry.totpAlgorithm ?: "SHA1"
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
        // Le combine() dans loadEntries() gère automatiquement le filtrage
    }
}

/**
 * États de l'UI de la liste (mis à jour pour nouveau système)
 */
sealed class VaultListUiState {
    object Loading : VaultListUiState()
    data class Success(val entries: List<VaultEntryEntity>) : VaultListUiState()
    data class Error(val message: String) : VaultListUiState()
}
