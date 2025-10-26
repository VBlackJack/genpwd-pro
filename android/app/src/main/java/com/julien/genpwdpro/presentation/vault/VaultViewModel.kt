package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.data.repository.VaultRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour la gestion des vaults
 */
@HiltViewModel
class VaultViewModel @Inject constructor(
    private val vaultRepository: VaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<VaultUiState>(VaultUiState.Loading)
    val uiState: StateFlow<VaultUiState> = _uiState.asStateFlow()

    private val _selectedVault = MutableStateFlow<VaultEntity?>(null)
    val selectedVault: StateFlow<VaultEntity?> = _selectedVault.asStateFlow()

    private val _isVaultUnlocked = MutableStateFlow(false)
    val isVaultUnlocked: StateFlow<Boolean> = _isVaultUnlocked.asStateFlow()

    init {
        loadVaults()
    }

    /**
     * Charge tous les vaults
     */
    fun loadVaults() {
        viewModelScope.launch {
            _uiState.value = VaultUiState.Loading
            try {
                vaultRepository.getAllVaults()
                    .catch { e ->
                        _uiState.value = VaultUiState.Error(e.message ?: "Erreur inconnue")
                    }
                    .collect { vaults ->
                        if (vaults.isEmpty()) {
                            _uiState.value = VaultUiState.NoVault
                        } else {
                            _uiState.value = VaultUiState.Success(vaults)
                            // Sélectionner le vault par défaut ou le premier
                            if (_selectedVault.value == null) {
                                val defaultVault = vaults.find { it.isDefault } ?: vaults.firstOrNull()
                                _selectedVault.value = defaultVault
                            }
                        }
                    }
            } catch (e: Exception) {
                _uiState.value = VaultUiState.Error(e.message ?: "Erreur inconnue")
            }
        }
    }

    /**
     * Crée un nouveau vault
     */
    fun createVault(
        name: String,
        masterPassword: String,
        description: String = "",
        setAsDefault: Boolean = true
    ) {
        viewModelScope.launch {
            _uiState.value = VaultUiState.Loading
            try {
                val vaultId = vaultRepository.createVault(
                    name = name,
                    masterPassword = masterPassword,
                    description = description,
                    setAsDefault = setAsDefault
                )

                // Le vault est déjà déverrouillé après création
                _isVaultUnlocked.value = true

                // Recharger les vaults
                loadVaults()

                // Sélectionner le nouveau vault
                val newVault = vaultRepository.getVaultById(vaultId)
                _selectedVault.value = newVault

                _uiState.value = VaultUiState.VaultCreated(vaultId)
            } catch (e: Exception) {
                _uiState.value = VaultUiState.Error(e.message ?: "Erreur lors de la création du vault")
            }
        }
    }

    /**
     * Déverrouille un vault
     */
    fun unlockVault(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            _uiState.value = VaultUiState.Loading
            try {
                val success = vaultRepository.unlockVault(vaultId, masterPassword)
                if (success) {
                    _isVaultUnlocked.value = true
                    val vault = vaultRepository.getVaultById(vaultId)
                    _selectedVault.value = vault
                    _uiState.value = VaultUiState.VaultUnlocked(vaultId)
                } else {
                    _isVaultUnlocked.value = false
                    _uiState.value = VaultUiState.Error("Mot de passe incorrect")
                }
            } catch (e: Exception) {
                _isVaultUnlocked.value = false
                _uiState.value = VaultUiState.Error(e.message ?: "Erreur lors du déverrouillage")
            }
        }
    }

    /**
     * Verrouille le vault actuel
     */
    fun lockVault() {
        _selectedVault.value?.let { vault ->
            vaultRepository.lockVault(vault.id)
            _isVaultUnlocked.value = false
            _uiState.value = VaultUiState.VaultLocked
        }
    }

    /**
     * Verrouille tous les vaults
     */
    fun lockAllVaults() {
        vaultRepository.lockAllVaults()
        _isVaultUnlocked.value = false
        _uiState.value = VaultUiState.VaultLocked
    }

    /**
     * Sélectionne un vault
     */
    fun selectVault(vault: VaultEntity) {
        _selectedVault.value = vault
        _isVaultUnlocked.value = vaultRepository.isVaultUnlocked(vault.id)
    }

    /**
     * Supprime un vault
     */
    fun deleteVault(vaultId: String) {
        viewModelScope.launch {
            try {
                vaultRepository.deleteVault(vaultId)
                if (_selectedVault.value?.id == vaultId) {
                    _selectedVault.value = null
                    _isVaultUnlocked.value = false
                }
                loadVaults()
            } catch (e: Exception) {
                _uiState.value = VaultUiState.Error(e.message ?: "Erreur lors de la suppression")
            }
        }
    }

    /**
     * Vérifie si un vault est déverrouillé
     */
    fun checkVaultUnlocked(vaultId: String): Boolean {
        return vaultRepository.isVaultUnlocked(vaultId)
    }

    /**
     * Récupère un vault par ID (suspend)
     */
    suspend fun getVaultById(vaultId: String): VaultEntity? {
        return vaultRepository.getVaultById(vaultId)
    }
}

/**
 * États de l'UI du vault
 */
sealed class VaultUiState {
    object Loading : VaultUiState()
    object NoVault : VaultUiState()
    data class Success(val vaults: List<VaultEntity>) : VaultUiState()
    data class VaultCreated(val vaultId: String) : VaultUiState()
    data class VaultUnlocked(val vaultId: String) : VaultUiState()
    object VaultLocked : VaultUiState()
    data class Error(val message: String) : VaultUiState()
}
