package com.julien.genpwd.pro.security

import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.data.sync.AutoSyncSecretStore
import com.julien.genpwdpro.security.EncryptedKeystoreData
import com.julien.genpwdpro.security.KeystoreAlias
import com.julien.genpwdpro.security.KeystoreManager
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.*
import org.junit.Before
import org.junit.Ignore
import org.junit.Test

/**
 * Security tests for AutoSyncSecretStore
 *
 * These tests verify that master passwords are properly encrypted
 * and stored securely for auto-sync functionality.
 *
 * TODO: Uses android.util.Base64 which is not available in unit tests.
 * Move to instrumented tests or use Robolectric.
 */
@Ignore("Requires Android Base64 - move to instrumented tests")
class AutoSyncSecretStoreTest {

    private lateinit var securePrefs: SecurePrefs
    private lateinit var keystoreManager: KeystoreManager
    private lateinit var secretStore: AutoSyncSecretStore

    @Before
    fun setup() {
        securePrefs = mockk(relaxed = true)
        keystoreManager = mockk(relaxed = true)
        secretStore = AutoSyncSecretStore(securePrefs, keystoreManager)
    }

    @Test
    fun `persistSecret encrypts password with keystore`() {
        // Arrange
        val vaultId = "test-vault-123"
        val masterPassword = "super-secret-password"
        val encryptedData = EncryptedKeystoreData(
            ciphertext = ByteArray(32) { 0xAB.toByte() },
            iv = ByteArray(12) { 0xCD.toByte() },
            keyAlias = KeystoreAlias.SYNC.alias
        )

        every { keystoreManager.encryptString(masterPassword, KeystoreAlias.SYNC.alias) } returns encryptedData
        every { securePrefs.putString(any(), any()) } returns true

        // Act
        val result = secretStore.persistSecret(vaultId, masterPassword)

        // Assert
        assertTrue("persistSecret should return true on success", result)
        verify(exactly = 1) { keystoreManager.encryptString(masterPassword, KeystoreAlias.SYNC.alias) }
        verify(exactly = 1) { securePrefs.putString(any(), any()) }
    }

    @Test
    fun `getSecret decrypts password from secure storage`() {
        // Arrange
        val vaultId = "test-vault-123"
        val expectedPassword = "super-secret-password"
        val storedJson = """
            {
                "ciphertext":"qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq==",
                "iv":"zc3Nzc3Nzc3Nzc3N",
                "keyAlias":"genpwd_sync_key"
            }
        """.trimIndent()

        every { securePrefs.getString(any()) } returns storedJson
        every { securePrefs.isUnlocked() } returns true
        every { keystoreManager.decryptString(any()) } returns expectedPassword

        // Act
        val result = secretStore.getSecret(vaultId)

        // Assert
        assertEquals("Decrypted password should match", expectedPassword, result)
        verify(exactly = 1) { keystoreManager.decryptString(any()) }
    }

    @Test
    fun `getSecret returns null when device is locked`() {
        // Arrange
        val vaultId = "test-vault-123"
        every { securePrefs.isUnlocked() } returns false

        // Act
        val result = secretStore.canAccessSecrets()

        // Assert
        assertFalse("canAccessSecrets should return false when device locked", result)
    }

    @Test
    fun `getSecret returns null on corrupted payload`() {
        // Arrange
        val vaultId = "test-vault-123"
        val corruptedJson = "{ invalid json }"

        every { securePrefs.getString(any()) } returns corruptedJson
        every { securePrefs.remove(any()) } returns true

        // Act
        val result = secretStore.getSecret(vaultId)

        // Assert
        assertNull("getSecret should return null on corrupted payload", result)
        verify(exactly = 1) { securePrefs.remove(any()) } // Should cleanup corrupted data
    }

    @Test
    fun `clearSecret removes stored secret`() {
        // Arrange
        val vaultId = "test-vault-123"
        every { securePrefs.remove(any()) } returns true

        // Act
        secretStore.clearSecret(vaultId)

        // Assert
        verify(exactly = 1) { securePrefs.remove("sync_secret_$vaultId") }
    }

    @Test
    fun `persistSecret fails gracefully when encryption fails`() {
        // Arrange
        val vaultId = "test-vault-123"
        val masterPassword = "password"
        every { keystoreManager.encryptString(any(), any()) } throws RuntimeException("Encryption failed")

        // Act
        val result = secretStore.persistSecret(vaultId, masterPassword)

        // Assert
        assertFalse("persistSecret should return false on encryption failure", result)
    }
}
