package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.domain.session.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour la gestion des vaults
 */
@HiltViewModel
class VaultViewModel @Inject constructor(
    private val vaultRepository: VaultRepository,
    private val sessionManager: SessionManager
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
     *
     * ✅ FIX: Utilise .catch() pour gérer les erreurs du Flow de manière robuste
     * Cela évite les crashs au démarrage si la DB n'est pas encore initialisée
     */
    fun loadVaults() {
        viewModelScope.launch {
            _uiState.value = VaultUiState.Loading
            try {
                vaultRepository.getAllVaults()
                    .catch { e ->
                        // Gérer les erreurs d'initialisation de la DB ou d'accès au Flow
                        _uiState.value = VaultUiState.Error(
                            e.message ?: "Erreur d'accès à la base de données"
                        )
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
                // Capturer toutes les autres exceptions
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
        setAsDefault: Boolean = true,
        biometricUnlockEnabled: Boolean = false
    ) {
        viewModelScope.launch {
            _uiState.value = VaultUiState.Loading
            try {
                val vaultId = vaultRepository.createVault(
                    name = name,
                    masterPassword = masterPassword,
                    description = description,
                    setAsDefault = setAsDefault,
                    biometricUnlockEnabled = biometricUnlockEnabled
                )

                // Le vault est déjà déverrouillé après création
                _isVaultUnlocked.value = true

                // Mettre à jour le SessionManager avec le nouveau vault
                sessionManager.unlockVault(vaultId)

                // Sélectionner le nouveau vault
                val newVault = vaultRepository.getVaultById(vaultId)
                _selectedVault.value = newVault

                // IMPORTANT: Notifier l'UI AVANT de recharger (sinon race condition)
                _uiState.value = VaultUiState.VaultCreated(vaultId)

                // Recharger les vaults en arrière-plan (n'affecte pas la navigation)
                loadVaults()
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

                    // Mettre à jour le SessionManager avec le vault déverrouillé
                    sessionManager.unlockVault(vaultId)

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

            // Mettre à jour le SessionManager
            sessionManager.lockVault()

            _uiState.value = VaultUiState.VaultLocked
        }
    }

    /**
     * Verrouille tous les vaults
     */
    fun lockAllVaults() {
        vaultRepository.lockAllVaults()
        _isVaultUnlocked.value = false

        // Mettre à jour le SessionManager
        sessionManager.lockVault()

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

    /**
     * Sauvegarde le master password pour déverrouillage biométrique
     */
    fun saveBiometricPassword(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            val success = vaultRepository.saveBiometricPassword(vaultId, masterPassword)
            if (!success) {
                _uiState.value = VaultUiState.Error("Échec de la configuration biométrique")
            }
        }
    }

    /**
     * Récupère le master password depuis le Keystore (nécessite authentification biométrique)
     */
    suspend fun getBiometricPassword(vaultId: String): String? {
        return vaultRepository.getBiometricPassword(vaultId)
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
