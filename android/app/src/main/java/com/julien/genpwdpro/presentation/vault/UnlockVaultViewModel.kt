package com.julien.genpwdpro.presentation.vault

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import com.julien.genpwdpro.data.local.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.security.BiometricVaultManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour l'écran de déverrouillage d'un vault
 *
 * Responsabilités :
 * - Charger les métadonnées du vault depuis vault_registry
 * - Déverrouiller avec mot de passe via FileVaultRepository
 * - Déverrouiller avec biométrie via BiometricVaultManager
 * - Gérer l'état UI (loading, error, success)
 */
@HiltViewModel
class UnlockVaultViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,
    private val biometricVaultManager: BiometricVaultManager,
    private val vaultRegistryDao: VaultRegistryDao
) : ViewModel() {

    private val _uiState = MutableStateFlow<UnlockVaultUiState>(UnlockVaultUiState.Loading)
    val uiState: StateFlow<UnlockVaultUiState> = _uiState.asStateFlow()

    private val _vaultRegistry = MutableStateFlow<VaultRegistryEntry?>(null)
    val vaultRegistry: StateFlow<VaultRegistryEntry?> = _vaultRegistry.asStateFlow()

    /**
     * Charge les métadonnées du vault
     */
    fun loadVault(vaultId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UnlockVaultUiState.Loading
                val registry = vaultRegistryDao.getById(vaultId)

                if (registry == null) {
                    _uiState.value = UnlockVaultUiState.Error("Vault introuvable")
                } else {
                    _vaultRegistry.value = registry
                    _uiState.value = UnlockVaultUiState.Ready
                }
            } catch (e: Exception) {
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors du chargement du vault"
                )
            }
        }
    }

    /**
     * Déverrouille le vault avec un mot de passe
     */
    fun unlockWithPassword(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UnlockVaultUiState.Unlocking

                val result = fileVaultRepository.unlockVault(vaultId, masterPassword)

                result.fold(
                    onSuccess = {
                        _uiState.value = UnlockVaultUiState.Unlocked(vaultId)
                    },
                    onFailure = { error ->
                        _uiState.value = UnlockVaultUiState.Error(
                            error.message ?: "Mot de passe incorrect"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors du déverrouillage"
                )
            }
        }
    }

    /**
     * Déverrouille le vault avec biométrie
     */
    fun unlockWithBiometric(activity: FragmentActivity, vaultId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UnlockVaultUiState.Unlocking

                // 1. Déchiffrer le master password avec biométrie
                val passwordResult = biometricVaultManager.unlockWithBiometric(activity, vaultId)

                passwordResult.fold(
                    onSuccess = { masterPassword ->
                        // 2. Déverrouiller le vault avec le password récupéré
                        val unlockResult = fileVaultRepository.unlockVault(vaultId, masterPassword)

                        unlockResult.fold(
                            onSuccess = {
                                _uiState.value = UnlockVaultUiState.Unlocked(vaultId)
                            },
                            onFailure = { error ->
                                _uiState.value = UnlockVaultUiState.Error(
                                    "Erreur de déverrouillage: ${error.message}"
                                )
                            }
                        )
                    },
                    onFailure = { error ->
                        // L'utilisateur a annulé ou erreur biométrique
                        val message = error.message ?: "Authentification biométrique échouée"

                        // Si c'est une annulation, revenir à l'état Ready
                        if (message.contains("cancel", ignoreCase = true) ||
                            message.contains("annul", ignoreCase = true)) {
                            _uiState.value = UnlockVaultUiState.Ready
                        } else {
                            _uiState.value = UnlockVaultUiState.Error(message)
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors de l'authentification biométrique"
                )
            }
        }
    }

    /**
     * Vérifie si la biométrie est disponible sur l'appareil
     */
    fun isBiometricAvailable(): Boolean {
        return biometricVaultManager.isBiometricAvailable()
    }

    /**
     * Réinitialise l'état UI à Ready (pour effacer les erreurs)
     */
    fun resetToReady() {
        _uiState.value = UnlockVaultUiState.Ready
    }
}

/**
 * États de l'UI de déverrouillage
 */
sealed class UnlockVaultUiState {
    /** Chargement des métadonnées du vault */
    object Loading : UnlockVaultUiState()

    /** Vault chargé, prêt pour déverrouillage */
    object Ready : UnlockVaultUiState()

    /** En cours de déverrouillage */
    object Unlocking : UnlockVaultUiState()

    /** Vault déverrouillé avec succès */
    data class Unlocked(val vaultId: String) : UnlockVaultUiState()

    /** Erreur lors du déverrouillage */
    data class Error(val message: String) : UnlockVaultUiState()
}
