package com.genpwd.storage

import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.crypto.TokenCrypto
import com.genpwd.storage.db.GenPwdDatabase
import com.genpwd.storage.db.entities.CloudAccountEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing cloud account storage and retrieval.
 *
 * Provides a clean API for working with cloud accounts, abstracting
 * the underlying Room database implementation and handling token encryption.
 */
@Singleton
class CloudAccountRepository @Inject constructor(
    private val database: GenPwdDatabase,
    private val tokenCrypto: TokenCrypto
) {
    private val cloudAccountDao = database.cloudAccountDao()

    /**
     * Observe all active cloud accounts with decrypted tokens.
     */
    fun observeAllAccounts(): Flow<List<CloudAccountEntity>> {
        return cloudAccountDao.getAllActive().map { accounts ->
            accounts.map { decryptAccount(it) }
        }
    }

    /**
     * Observe accounts for a specific provider with decrypted tokens.
     */
    fun observeAccountsForProvider(kind: ProviderKind): Flow<List<CloudAccountEntity>> {
        return cloudAccountDao.getAllByProviderKind(kind).map { accounts ->
            accounts.map { decryptAccount(it) }
        }
    }

    /**
     * Get account by ID with decrypted tokens.
     */
    suspend fun getAccount(accountId: String): CloudAccountEntity? {
        val account = cloudAccountDao.getById(accountId) ?: return null
        return decryptAccount(account)
    }

    /**
     * Get the active account for a provider with decrypted tokens.
     */
    suspend fun getAccountForProvider(kind: ProviderKind): CloudAccountEntity? {
        val account = cloudAccountDao.getByProviderKind(kind) ?: return null
        return decryptAccount(account)
    }

    /**
     * Decrypt account tokens.
     */
    private fun decryptAccount(account: CloudAccountEntity): CloudAccountEntity {
        return account.copy(
            accessToken = tokenCrypto.decrypt(account.accessToken),
            refreshToken = account.refreshToken?.let { tokenCrypto.decrypt(it) }
        )
    }

    /**
     * Encrypt account tokens.
     */
    private fun encryptAccount(account: CloudAccountEntity): CloudAccountEntity {
        return account.copy(
            accessToken = tokenCrypto.encrypt(account.accessToken),
            refreshToken = account.refreshToken?.let { tokenCrypto.encrypt(it) }
        )
    }

    /**
     * Check if an account exists for a provider.
     */
    suspend fun hasAccountForProvider(kind: ProviderKind): Boolean {
        return cloudAccountDao.hasAccountForProvider(kind)
    }

    /**
     * Save a new cloud account with encrypted tokens.
     *
     * @param kind The provider kind
     * @param displayName Display name for the account
     * @param email User email (optional)
     * @param accessToken OAuth access token (plaintext - will be encrypted)
     * @param refreshToken OAuth refresh token (plaintext - will be encrypted, optional)
     * @param expiresIn Token expiry in seconds
     * @return The created account with decrypted tokens
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

        // Encrypt tokens before storing
        val encryptedAccount = encryptAccount(account)
        cloudAccountDao.insert(encryptedAccount)

        // Return account with decrypted tokens
        return account
    }

    /**
     * Update account tokens with encryption.
     */
    suspend fun updateAccountToken(
        accountId: String,
        accessToken: String,
        expiresIn: Long
    ) {
        val expiresAt = System.currentTimeMillis() + (expiresIn * 1000)
        val encryptedToken = tokenCrypto.encrypt(accessToken)
        cloudAccountDao.updateToken(accountId, encryptedToken, expiresAt)
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
