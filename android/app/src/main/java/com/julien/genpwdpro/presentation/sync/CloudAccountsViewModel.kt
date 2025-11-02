package com.julien.genpwdpro.presentation.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.VaultMeta
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderError
import com.genpwd.storage.VaultStorageRepository
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
    private val storage: VaultStorageRepository,
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

                // Load all accounts from storage
                val accounts = mutableListOf<AccountWithVaults>()

                for (kind in ProviderKind.values()) {
                    // For now, we'll just check if there's an account
                    // In a real implementation, you'd store account IDs and iterate through them
                    // This is a simplified version
                }

                // For demo, we'll observe vaults and group by account
                storage.observeVaults()
                    .map { vaults ->
                        val grouped = vaults.groupBy { it.id.provider to it.id.accountId }
                        grouped.map { (providerAndAccount, vaultList) ->
                            val (provider, accountId) = providerAndAccount
                            val account = storage.getAccount(provider, accountId)
                            AccountWithVaults(
                                kind = provider,
                                account = account,
                                vaults = vaultList,
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
                val provider = providerRegistry.get(kind)
                _events.emit(CloudAccountsEvent.StartOAuthFlow(kind))
            } catch (e: Exception) {
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Failed to start OAuth flow: ${e.message}"
                    )
                )
            }
        }
    }

    fun handleOAuthResult(kind: ProviderKind, authCode: String) {
        viewModelScope.launch {
            try {
                val provider = providerRegistry.get(kind)
                if (provider == null) {
                    _events.emit(
                        CloudAccountsEvent.ShowError("Provider $kind not found")
                    )
                    return@launch
                }

                // In a real implementation with full PKCE flow:
                // 1. Retrieve stored code_verifier from secure storage
                // 2. Exchange auth code for tokens using the auth provider
                // 3. Create CloudAccount with provider credentials
                // 4. Save to storage

                // For now, we'll simulate a successful account addition
                // The actual token exchange would be:
                // val authProvider = provider as? OAuth2Provider
                // val tokens = authProvider?.exchangeCodeForTokens(authCode, codeVerifier)
                // val account = CloudAccount(
                //     id = UUID.randomUUID().toString(),
                //     kind = kind,
                //     displayName = "User Account",
                //     accessToken = tokens.accessToken,
                //     refreshToken = tokens.refreshToken,
                //     expiresAt = System.currentTimeMillis() + tokens.expiresIn * 1000
                // )
                // storage.saveAccount(account)

                _events.emit(CloudAccountsEvent.AccountAdded)
                loadAccounts()
            } catch (e: Exception) {
                _events.emit(
                    CloudAccountsEvent.ShowError(
                        "Failed to complete OAuth: ${e.message}"
                    )
                )
            }
        }
    }

    fun removeAccount(kind: ProviderKind, accountId: String) {
        viewModelScope.launch {
            try {
                // Remove all vaults associated with this account
                storage.observeVaults()
                    .take(1)
                    .collect { vaults ->
                        vaults.filter {
                            it.id.provider == kind && it.id.accountId == accountId
                        }.forEach { vault ->
                            storage.deleteVaultMeta(vault.id)
                        }
                    }

                _events.emit(CloudAccountsEvent.AccountRemoved)
                loadAccounts()
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
    val kind: ProviderKind,
    val account: ProviderAccount?,
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
