package com.genpwd.sync.token

import com.genpwd.corevault.ProviderKind
import com.genpwd.providers.api.TokenRefreshProvider
import com.genpwd.providers.api.TokenResponse
import com.genpwd.storage.CloudAccountRepository
import com.genpwd.storage.db.entities.CloudAccountEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service for automatically refreshing expired OAuth tokens.
 *
 * Checks token expiry and refreshes tokens before they expire to ensure
 * uninterrupted sync operations.
 */
@Singleton
class TokenRefreshService @Inject constructor(
    private val cloudAccountRepository: CloudAccountRepository,
    private val googleDriveAuthProvider: TokenRefreshProvider
) {

    companion object {
        // Refresh tokens when they have less than 5 minutes remaining
        private const val REFRESH_THRESHOLD_MS = 5 * 60 * 1000L
    }

    /**
     * Check if a token needs refresh.
     */
    fun needsRefresh(account: CloudAccountEntity): Boolean {
        val now = System.currentTimeMillis()
        val timeUntilExpiry = account.expiresAt - now
        return timeUntilExpiry <= REFRESH_THRESHOLD_MS
    }

    /**
     * Refresh token for an account if needed.
     *
     * @param account The cloud account
     * @return Updated account with new tokens, or original account if refresh not needed
     */
    suspend fun refreshIfNeeded(account: CloudAccountEntity): CloudAccountEntity {
        if (!needsRefresh(account)) {
            return account
        }

        return refreshToken(account)
    }

    /**
     * Force refresh token for an account.
     *
     * @param account The cloud account
     * @return Updated account with new tokens
     */
    suspend fun refreshToken(account: CloudAccountEntity): CloudAccountEntity {
        return withContext(Dispatchers.IO) {
            val refreshToken = account.refreshToken
                ?: throw IllegalStateException("No refresh token available for account ${account.id}")

            when (account.providerKind) {
                ProviderKind.GOOGLE_DRIVE -> {
                    val tokenResponse = googleDriveAuthProvider.refreshAccessToken(refreshToken)

                    // Update account with new tokens
                    cloudAccountRepository.updateAccountToken(
                        accountId = account.id,
                        accessToken = tokenResponse.accessToken,
                        expiresIn = tokenResponse.expiresIn
                    )

                    // Return updated account
                    account.copy(
                        accessToken = tokenResponse.accessToken,
                        expiresAt = System.currentTimeMillis() + (tokenResponse.expiresIn * 1000)
                    )
                }
                else -> {
                    throw UnsupportedOperationException("Token refresh not implemented for ${account.providerKind}")
                }
            }
        }
    }

    /**
     * Refresh all expired tokens.
     *
     * @return Number of tokens refreshed
     */
    suspend fun refreshAllExpired(): Int {
        var refreshed = 0

        // Get all accounts that need refresh
        cloudAccountRepository.observeAllAccounts()
            .collect { accounts ->
                accounts.forEach { account ->
                    if (needsRefresh(account)) {
                        try {
                            refreshToken(account)
                            refreshed++
                        } catch (e: Exception) {
                            // Log error but continue with other accounts
                            // TODO: Add proper error logging
                        }
                    }
                }
            }

        return refreshed
    }
}
