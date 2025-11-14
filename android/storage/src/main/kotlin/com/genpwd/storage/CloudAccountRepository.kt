package com.genpwd.storage

import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.crypto.SecureString
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

    // ============================================================================
    // SECURE METHODS - Using SecureString for enhanced memory security
    // ============================================================================

    /**
     * Get account by ID with tokens as SecureString.
     * RECOMMENDED: Use this instead of getAccount() for better security.
     *
     * The returned SecureCloudAccount must be closed after use to zero out
     * sensitive data from memory.
     *
     * @param accountId The account ID
     * @return SecureCloudAccount or null (caller must close if not null)
     */
    suspend fun getSecureAccount(accountId: String): SecureCloudAccount? {
        val account = cloudAccountDao.getById(accountId) ?: return null
        return decryptAccountSecure(account)
    }

    /**
     * Get the active account for a provider with tokens as SecureString.
     * RECOMMENDED: Use this instead of getAccountForProvider() for better security.
     *
     * @param kind The provider kind
     * @return SecureCloudAccount or null (caller must close if not null)
     */
    suspend fun getSecureAccountForProvider(kind: ProviderKind): SecureCloudAccount? {
        val account = cloudAccountDao.getByProviderKind(kind) ?: return null
        return decryptAccountSecure(account)
    }

    /**
     * Observe all active cloud accounts with tokens as SecureString.
     * RECOMMENDED: Use this instead of observeAllAccounts() for better security.
     *
     * WARNING: Each emitted list contains SecureCloudAccount instances that should
     * be closed after use. Consider using flow operators to manage lifecycle.
     *
     * @return Flow of SecureCloudAccount lists (caller must close each account)
     */
    fun observeAllSecureAccounts(): Flow<List<SecureCloudAccount>> {
        return cloudAccountDao.getAllActive().map { accounts ->
            accounts.map { decryptAccountSecure(it) }
        }
    }

    /**
     * Observe accounts for a specific provider with tokens as SecureString.
     * RECOMMENDED: Use this instead of observeAccountsForProvider() for better security.
     *
     * @param kind The provider kind
     * @return Flow of SecureCloudAccount lists (caller must close each account)
     */
    fun observeSecureAccountsForProvider(kind: ProviderKind): Flow<List<SecureCloudAccount>> {
        return cloudAccountDao.getAllByProviderKind(kind).map { accounts ->
            accounts.map { decryptAccountSecure(it) }
        }
    }

    /**
     * Save a new cloud account with tokens as SecureString.
     * The tokens are automatically zeroed from memory after encryption.
     *
     * @param kind The provider kind
     * @param displayName Display name for the account
     * @param email User email (optional)
     * @param accessToken OAuth access token (will be closed after use)
     * @param refreshToken OAuth refresh token (will be closed after use, optional)
     * @param expiresIn Token expiry in seconds
     * @return The created account with secure tokens (caller must close)
     */
    suspend fun saveSecureAccount(
        kind: ProviderKind,
        displayName: String,
        email: String? = null,
        accessToken: SecureString,
        refreshToken: SecureString? = null,
        expiresIn: Long
    ): SecureCloudAccount {
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()

        // Encrypt tokens from SecureString
        val encryptedAccessToken = tokenCrypto.encryptFromSecure(accessToken)
        val encryptedRefreshToken = refreshToken?.let { tokenCrypto.encryptFromSecure(it) }

        val account = CloudAccountEntity(
            id = id,
            providerKind = kind,
            displayName = displayName,
            email = email,
            accessToken = encryptedAccessToken,
            refreshToken = encryptedRefreshToken,
            expiresAt = now + (expiresIn * 1000),
            createdAt = now,
            lastSync = null,
            isActive = true
        )

        cloudAccountDao.insert(account)

        // Return SecureCloudAccount (caller must close)
        return SecureCloudAccount(
            id = id,
            providerKind = kind,
            displayName = displayName,
            email = email,
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAt = account.expiresAt,
            createdAt = account.createdAt,
            lastSync = account.lastSync,
            isActive = account.isActive
        )
    }

    /**
     * Update account tokens using SecureString.
     * The token is automatically zeroed from memory after encryption.
     *
     * @param accountId The account ID
     * @param accessToken New access token (will be closed after use)
     * @param expiresIn Token expiry in seconds
     */
    suspend fun updateSecureAccountToken(
        accountId: String,
        accessToken: SecureString,
        expiresIn: Long
    ) {
        val expiresAt = System.currentTimeMillis() + (expiresIn * 1000)
        val encryptedToken = tokenCrypto.encryptFromSecure(accessToken)
        cloudAccountDao.updateToken(accountId, encryptedToken, expiresAt)
    }

    /**
     * Decrypt account tokens into SecureString.
     * Internal helper method.
     */
    private fun decryptAccountSecure(account: CloudAccountEntity): SecureCloudAccount {
        val accessToken = tokenCrypto.decryptToSecure(account.accessToken)
        val refreshToken = account.refreshToken?.let { tokenCrypto.decryptToSecure(it) }

        return SecureCloudAccount(
            id = account.id,
            providerKind = account.providerKind,
            displayName = account.displayName,
            email = account.email,
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAt = account.expiresAt,
            createdAt = account.createdAt,
            lastSync = account.lastSync,
            isActive = account.isActive
        )
    }
}
