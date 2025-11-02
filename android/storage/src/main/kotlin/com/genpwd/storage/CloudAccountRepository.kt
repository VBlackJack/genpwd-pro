package com.genpwd.storage

import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.db.GenPwdDatabase
import com.genpwd.storage.db.entities.CloudAccountEntity
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing cloud account storage and retrieval.
 *
 * Provides a clean API for working with cloud accounts, abstracting
 * the underlying Room database implementation.
 */
@Singleton
class CloudAccountRepository @Inject constructor(
    private val database: GenPwdDatabase
) {
    private val cloudAccountDao = database.cloudAccountDao()

    /**
     * Observe all active cloud accounts.
     */
    fun observeAllAccounts(): Flow<List<CloudAccountEntity>> {
        return cloudAccountDao.getAllActive()
    }

    /**
     * Observe accounts for a specific provider.
     */
    fun observeAccountsForProvider(kind: ProviderKind): Flow<List<CloudAccountEntity>> {
        return cloudAccountDao.getAllByProviderKind(kind)
    }

    /**
     * Get account by ID.
     */
    suspend fun getAccount(accountId: String): CloudAccountEntity? {
        return cloudAccountDao.getById(accountId)
    }

    /**
     * Get the active account for a provider.
     */
    suspend fun getAccountForProvider(kind: ProviderKind): CloudAccountEntity? {
        return cloudAccountDao.getByProviderKind(kind)
    }

    /**
     * Check if an account exists for a provider.
     */
    suspend fun hasAccountForProvider(kind: ProviderKind): Boolean {
        return cloudAccountDao.hasAccountForProvider(kind)
    }

    /**
     * Save a new cloud account.
     *
     * @param kind The provider kind
     * @param displayName Display name for the account
     * @param email User email (optional)
     * @param accessToken OAuth access token (should be encrypted)
     * @param refreshToken OAuth refresh token (should be encrypted, optional)
     * @param expiresIn Token expiry in seconds
     * @return The created account
     */
    suspend fun saveAccount(
        kind: ProviderKind,
        displayName: String,
        email: String? = null,
        accessToken: String,
        refreshToken: String? = null,
        expiresIn: Long
    ): CloudAccountEntity {
        val now = System.currentTimeMillis()
        val account = CloudAccountEntity(
            id = UUID.randomUUID().toString(),
            providerKind = kind,
            displayName = displayName,
            email = email,
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAt = now + (expiresIn * 1000),
            createdAt = now,
            lastSync = null,
            isActive = true
        )

        cloudAccountDao.insert(account)
        return account
    }

    /**
     * Update account tokens.
     */
    suspend fun updateAccountToken(
        accountId: String,
        accessToken: String,
        expiresIn: Long
    ) {
        val expiresAt = System.currentTimeMillis() + (expiresIn * 1000)
        cloudAccountDao.updateToken(accountId, accessToken, expiresAt)
    }

    /**
     * Update last sync timestamp.
     */
    suspend fun updateLastSync(accountId: String) {
        cloudAccountDao.updateLastSync(accountId, System.currentTimeMillis())
    }

    /**
     * Remove an account.
     */
    suspend fun removeAccount(accountId: String) {
        cloudAccountDao.deleteById(accountId)
    }

    /**
     * Deactivate an account (soft delete).
     */
    suspend fun deactivateAccount(accountId: String) {
        cloudAccountDao.deactivate(accountId)
    }

    /**
     * Activate a previously deactivated account.
     */
    suspend fun activateAccount(accountId: String) {
        cloudAccountDao.activate(accountId)
    }

    /**
     * Clear all accounts (for testing/reset).
     */
    suspend fun clearAll() {
        cloudAccountDao.deleteAll()
    }
}
