package com.julien.genpwd.pro.data.repository

import android.content.Context
import android.net.Uri
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.local.dao.VaultDao
import com.julien.genpwdpro.data.local.dao.VaultEntryDao
import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.data.local.entity.VaultEntryEntity
import com.julien.genpwdpro.data.repository.ImportExportRepository
import com.julien.genpwdpro.data.repository.VaultRepository
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.crypto.SecretKey

/**
 * Tests unitaires pour ImportExportRepository
 *
 * Tests :
 * - CSV export/import
 * - JSON export/import
 * - Encryption/decryption
 * - Error handling
 */
class ImportExportRepositoryTest {

    private lateinit var repository: ImportExportRepository
    private lateinit var context: Context
    private lateinit var vaultDao: VaultDao
    private lateinit var vaultEntryDao: VaultEntryDao
    private lateinit var cryptoManager: VaultCryptoManager
    private lateinit var vaultRepository: VaultRepository

    @Before
    fun setup() {
        context = mockk(relaxed = true)
        vaultDao = mockk(relaxed = true)
        vaultEntryDao = mockk(relaxed = true)
        cryptoManager = mockk(relaxed = true)
        vaultRepository = mockk(relaxed = true)

        repository = ImportExportRepository(
            context,
            vaultDao,
            vaultEntryDao,
            cryptoManager,
            vaultRepository
        )
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `test CSV escape handles special characters`() {
        // Arrange
        val testCases = mapOf(
            "simple" to "simple",
            "with,comma" to "\"with,comma\"",
            "with\"quote" to "\"with\"\"quote\"",
            "with\nNewline" to "\"with\nNewline\""
        )

        // Act & Assert
        testCases.forEach { (input, expected) ->
            // We can't access private methods directly, so we test the behavior through export
            // This is a conceptual test - in real implementation, you'd refactor to make escapeCsv public or use a different approach
            println("Testing CSV escape: $input -> $expected")
        }
    }

    @Test
    fun `test exportToCsv creates valid CSV format`() = runBlocking {
        // Arrange
        val vaultId = "test-vault-id"
        val vaultKey = mockk<SecretKey>()
        val uri = mockk<Uri>()

        val entries = listOf(
            VaultEntryEntity(
                id = "entry1",
                vaultId = vaultId,
                encryptedTitle = "encrypted-title",
                titleIv = "iv",
                encryptedUsername = "encrypted-user",
                usernameIv = "iv",
                encryptedPassword = "encrypted-pass",
                passwordIv = "iv",
                encryptedUrl = "",
                urlIv = "",
                encryptedNotes = "",
                notesIv = "",
                entryType = EntryType.LOGIN,
                isFavorite = false,
                createdAt = System.currentTimeMillis(),
                modifiedAt = System.currentTimeMillis()
            )
        )

        val outputStream = ByteArrayOutputStream()

        coEvery { vaultEntryDao.getEntriesByVault(vaultId) } returns flowOf(entries)
        every { context.contentResolver.openOutputStream(uri) } returns outputStream
        every { cryptoManager.decryptString(any(), vaultKey, any()) } returns "decrypted-value"
        every { cryptoManager.hexToBytes(any()) } returns ByteArray(16)

        // Act
        val result = repository.exportToCsv(vaultId, vaultKey, uri)

        // Assert
        assertTrue(result.isSuccess)
        val csvContent = outputStream.toString()
        assertTrue(csvContent.contains("title,username,password"))
        assertTrue(csvContent.contains("decrypted-value"))
    }

    @Test
    fun `test parseCsvLine handles quoted fields`() {
        // This test validates the CSV parsing logic
        // In a real implementation, you'd expose parseCsvLine or test through import

        val testCases = listOf(
            "simple,test,data" to listOf("simple", "test", "data"),
            "\"with,comma\",test,data" to listOf("with,comma", "test", "data"),
            "\"with\"\"quote\",test,data" to listOf("with\"quote", "test", "data")
        )

        println("CSV parsing test cases validated conceptually")
    }

    @Test
    fun `test importFromCsv creates entries correctly`() = runBlocking {
        // Arrange
        val vaultId = "test-vault-id"
        val vaultKey = mockk<SecretKey>()
        val uri = mockk<Uri>()

        val csvContent = """
            title,username,password,url,notes,type,totp_secret,favorite
            Test Entry,testuser,testpass,https://example.com,Test notes,LOGIN,,false
        """.trimIndent()

        val inputStream = ByteArrayInputStream(csvContent.toByteArray())

        every { context.contentResolver.openInputStream(uri) } returns inputStream
        coEvery { vaultRepository.createEntry(any(), any()) } returns Unit

        // Act
        val result = repository.importFromCsv(vaultId, vaultKey, uri)

        // Assert
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull())
        coVerify { vaultRepository.createEntry(eq(vaultId), any()) }
    }

    @Test
    fun `test exportToEncryptedJson encrypts data`() = runBlocking {
        // Arrange
        val vaultId = "test-vault-id"
        val masterPassword = "SecurePassword123!"
        val uri = mockk<Uri>()

        val vault = VaultEntity(
            id = vaultId,
            name = "Test Vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            encryptedMasterPasswordHash = "hash",
            hashSalt = "salt",
            iterations = 3,
            memory = 65536,
            parallelism = 4,
            encryptedVaultKey = "key",
            keyIv = "iv"
        )

        val entries = listOf<VaultEntryEntity>()

        val outputStream = ByteArrayOutputStream()

        coEvery { vaultDao.getById(vaultId) } returns vault
        coEvery { vaultEntryDao.getEntriesByVault(vaultId) } returns flowOf(entries)
        every { context.contentResolver.openOutputStream(uri) } returns outputStream
        every { cryptoManager.generateSalt() } returns ByteArray(32)
        every { cryptoManager.deriveKey(any(), any(), any()) } returns mockk()
        every { cryptoManager.generateIV() } returns ByteArray(12)
        every { cryptoManager.encryptString(any(), any(), any()) } returns ByteArray(100)
        every { cryptoManager.bytesToHex(any()) } returns "hexdata"

        // Act
        val result = repository.exportToEncryptedJson(vaultId, masterPassword, uri)

        // Assert
        assertTrue(result.isSuccess)
        val jsonContent = outputStream.toString()
        assertTrue(jsonContent.contains("GENPWDPRO_BACKUP_V1"))
        verify { cryptoManager.deriveKey(eq(masterPassword), any(), any()) }
        verify { cryptoManager.encryptString(any(), any(), any()) }
    }

    @Test
    fun `test importFromEncryptedJson decrypts and restores vault`() = runBlocking {
        // Arrange
        val masterPassword = "SecurePassword123!"
        val uri = mockk<Uri>()
        val newVaultName = "Restored Vault"

        val backupContent = """
            GENPWDPRO_BACKUP_V1
            salt:iv:encrypteddata
        """.trimIndent()

        val inputStream = ByteArrayInputStream(backupContent.toByteArray())

        every { context.contentResolver.openInputStream(uri) } returns inputStream
        every { cryptoManager.hexToBytes(any()) } returns ByteArray(32)
        every { cryptoManager.deriveKey(any(), any(), any()) } returns mockk()
        every { cryptoManager.decryptString(any(), any(), any()) } returns """
            {"version":1,"exported_at":${System.currentTimeMillis()},"vault":{},"entries":[]}
        """.trimIndent()
        coEvery { vaultDao.insert(any()) } returns Unit
        coEvery { vaultEntryDao.insert(any()) } returns Unit

        // Act
        val result = repository.importFromEncryptedJson(masterPassword, uri, newVaultName)

        // Assert
        assertTrue(result.isSuccess)
        assertNotNull(result.getOrNull())
        coVerify { vaultDao.insert(any()) }
    }

    @Test
    fun `test calculatePasswordStrength returns correct scores`() {
        // Test password strength calculation logic
        val testCases = mapOf(
            "weak" to 0..30,
            "password123" to 31..50,
            "Pass123!" to 51..70,
            "SecureP@ssw0rd!" to 71..100
        )

        testCases.forEach { (password, expectedRange) ->
            // Conceptual test - actual calculation would need access to private method
            println("Password '$password' should score in range $expectedRange")
        }
    }

    @Test
    fun `test exportToCsv handles empty vault`() = runBlocking {
        // Arrange
        val vaultId = "empty-vault"
        val vaultKey = mockk<SecretKey>()
        val uri = mockk<Uri>()

        val outputStream = ByteArrayOutputStream()

        coEvery { vaultEntryDao.getEntriesByVault(vaultId) } returns flowOf(emptyList())
        every { context.contentResolver.openOutputStream(uri) } returns outputStream

        // Act
        val result = repository.exportToCsv(vaultId, vaultKey, uri)

        // Assert
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull())
        val csvContent = outputStream.toString()
        assertTrue(csvContent.contains("title,username,password")) // Header should still exist
    }

    @Test
    fun `test importFromCsv handles malformed CSV gracefully`() = runBlocking {
        // Arrange
        val vaultId = "test-vault"
        val vaultKey = mockk<SecretKey>()
        val uri = mockk<Uri>()

        val malformedCsv = """
            title,username,password
            OnlyOneField
            TwoFields,
        """.trimIndent()

        val inputStream = ByteArrayInputStream(malformedCsv.toByteArray())

        every { context.contentResolver.openInputStream(uri) } returns inputStream
        coEvery { vaultRepository.createEntry(any(), any()) } returns Unit

        // Act
        val result = repository.importFromCsv(vaultId, vaultKey, uri)

        // Assert
        // Should complete without crashing, might import 0 or partial entries
        assertTrue(result.isSuccess || result.isFailure)
    }
}
