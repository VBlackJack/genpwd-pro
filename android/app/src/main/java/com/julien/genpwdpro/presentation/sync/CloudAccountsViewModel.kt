package com.julien.genpwdpro.presentation.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.VaultMeta
import com.genpwd.provider.drive.OAuth2GoogleDriveAuthProvider
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
    private val googleDriveAuthProvider: OAuth2GoogleDriveAuthProvider,
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
                // Currently only Google Drive is implemented
                when (kind) {
                    ProviderKind.GOOGLE_DRIVE -> {
                        // Start OAuth flow - this will open the browser
                        // The flow will throw an exception which we'll catch
                        // but this triggers the OAuth browser flow
                        try {
                            googleDriveAuthProvider.authenticate()
                        } catch (e: Exception) {
                            // Expected exception - OAuth flow initiated
                            _events.emit(CloudAccountsEvent.StartOAuthFlow(kind))
                        }
                    }
                    else -> {
                        _events.emit(
                            CloudAccountsEvent.ShowError(
                                "OAuth not yet implemented for $kind"
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Failed to start OAuth flow: ${e.message}"
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
