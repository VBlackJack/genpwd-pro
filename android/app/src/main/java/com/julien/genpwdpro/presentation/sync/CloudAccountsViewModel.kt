package com.julien.genpwdpro.presentation.sync

import androidx.lifecycle.ViewModel
import android.util.Log
import androidx.lifecycle.viewModelScope
import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.VaultMeta
import com.genpwd.storage.CloudAccountRepository
import com.genpwd.storage.VaultStorageRepository
import com.genpwd.storage.db.entities.CloudAccountEntity
import com.genpwd.sync.ProviderRegistry
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing cloud provider accounts and their synchronization state.
 */
@HiltViewModel
class CloudAccountsViewModel @Inject constructor(
    private val cloudAccountRepository: CloudAccountRepository,
    private val vaultStorage: VaultStorageRepository,
    private val providerRegistry: ProviderRegistry,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CloudAccountsUiState>(CloudAccountsUiState.Loading)
    val uiState: StateFlow<CloudAccountsUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<CloudAccountsEvent>()
    val events: SharedFlow<CloudAccountsEvent> = _events.asSharedFlow()

    init {
        loadAccounts()
    }

    fun loadAccounts() {
        viewModelScope.launch {
            try {
                _uiState.value = CloudAccountsUiState.Loading

                // Observe cloud accounts from repository
                cloudAccountRepository.observeAllAccounts()
                    .combine(vaultStorage.observeVaults()) { accounts, vaults ->
                        // Combine accounts with their associated vaults
                        accounts.map { account ->
                            val accountVaults = vaults.filter {
                                it.id.provider == account.providerKind &&
                                it.id.accountId == account.id
                            }
                            AccountWithVaults(
                                account = account,
                                vaults = accountVaults,
                                syncStatus = SyncStatus.IDLE
                            )
                        }
                    }
                    .collect { accountsList ->
                        _uiState.value = CloudAccountsUiState.Success(accountsList)
                    }
            } catch (e: Exception) {
                _uiState.value = CloudAccountsUiState.Error(
                    e.message ?: "Failed to load accounts"
                )
            }
        }
    }

    fun addAccount(kind: ProviderKind) {
        viewModelScope.launch {
            try {
                Log.d("CloudAccountsVM", "addAccount called for provider: $kind")

                // Get the cloud provider from registry
                val provider = providerRegistry.get(kind)
                Log.d("CloudAccountsVM", "Provider found: ${provider::class.simpleName}")

                // Start OAuth flow - this will trigger the provider's authenticate method
                // which should open the browser for OAuth providers
                try {
                    val account = provider.authenticate()
                    Log.d("CloudAccountsVM", "Authentication successful, account: ${account.id}")

                    // Save the account to repository
                    cloudAccountRepository.saveAccount(
                        kind = kind,
                        displayName = account.displayName,
                        email = account.displayName, // Use displayName as email fallback
                        accessToken = account.accessToken,
                        refreshToken = account.refreshToken,
                        expiresIn = account.expiresAtEpochSeconds ?: 3600L // Default to 1 hour if not provided
                    )

                    _events.emit(CloudAccountsEvent.AccountAdded)
                } catch (e: Exception) {
                    Log.e("CloudAccountsVM", "Authentication failed", e)
                    _events.emit(
                        CloudAccountsEvent.ShowError(
                            "Authentication failed: ${e.message}\n\n" +
                            "Note: OAuth providers require configuration (CLIENT_ID, etc.) " +
                            "which is not yet set up in this build."
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("CloudAccountsVM", "Failed to get provider", e)
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Failed to start authentication: ${e.message}"
                    )
                )
            }
        }
    }

    fun removeAccount(accountId: String) {
        viewModelScope.launch {
            try {
                // Remove account from database
                cloudAccountRepository.removeAccount(accountId)

                // Also remove all vaults associated with this account
                vaultStorage.observeVaults()
                    .take(1)
                    .collect { vaults ->
                        vaults.filter {
                            it.id.accountId == accountId
                        }.forEach { vault ->
                            vaultStorage.deleteVaultMeta(vault.id)
                        }
                    }

                _events.emit(CloudAccountsEvent.AccountRemoved)
            } catch (e: Exception) {
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Failed to remove account: ${e.message}"
                    )
                )
            }
        }
    }

    fun syncAccount(kind: ProviderKind, accountId: String) {
        viewModelScope.launch {
            try {
                // Trigger sync for all vaults in this account
                // This would use VaultSyncManager
                _events.emit(
                    CloudAccountsEvent.ShowMessage("Sync started for ${kind.name}")
                )
            } catch (e: Exception) {
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Sync failed: ${e.message}"
                    )
                )
            }
        }
    }
}

/**
 * UI state for cloud accounts screen.
 */
sealed class CloudAccountsUiState {
    object Loading : CloudAccountsUiState()
    data class Success(val accounts: List<AccountWithVaults>) : CloudAccountsUiState()
    data class Error(val message: String) : CloudAccountsUiState()
}

/**
 * Events emitted by the ViewModel to trigger UI actions.
 */
sealed class CloudAccountsEvent {
    data class StartOAuthFlow(val kind: ProviderKind) : CloudAccountsEvent()
    object AccountAdded : CloudAccountsEvent()
    object AccountRemoved : CloudAccountsEvent()
    data class ShowMessage(val message: String) : CloudAccountsEvent()
    data class ShowError(val error: String) : CloudAccountsEvent()
}

/**
 * Represents a cloud account with its associated vaults.
 */
data class AccountWithVaults(
    val account: CloudAccountEntity,
    val vaults: List<VaultMeta>,
    val syncStatus: SyncStatus,
)

/**
 * Sync status for an account.
 */
enum class SyncStatus {
    IDLE,
    SYNCING,
    SUCCESS,
    ERROR,
    CONFLICT
}
