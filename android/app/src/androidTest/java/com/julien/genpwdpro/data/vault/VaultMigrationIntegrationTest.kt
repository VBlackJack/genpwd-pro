package com.julien.genpwdpro.data.vault

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.VaultFileHeader
import com.julien.genpwdpro.data.models.vault.VaultMetadata
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration tests for legacy vault migration.
 *
 * These tests verify that vaults created with the old deterministic salt method
 * (SHA-256 hash of vaultId) can be successfully opened and migrated to the new
 * random salt method without data loss.
 *
 * Migration flow tested:
 * 1. Legacy vault has no kdfSalt in header (or kdfSalt is null/blank)
 * 2. VaultFileManager.loadVaultFile detects this via header.hasKdfSalt() = false
 * 3. It derives key using deprecated generateSaltFromString(vaultId)
 * 4. After successful decryption, it triggers automatic migration
 * 5. Migration generates new random salt, re-encrypts data, and persists
 * 6. Subsequent loads use the new random salt from header
 */
@RunWith(AndroidJUnit4::class)
class VaultMigrationIntegrationTest {

    private lateinit var context: Context
    private lateinit var cryptoManager: VaultCryptoManager
    private lateinit var vaultFileManager: VaultFileManager
    private lateinit var testVaultDir: File
    private val gson = GsonBuilder().setPrettyPrinting().create()

    companion object {
        private const val TEST_MASTER_PASSWORD = "TestMasterPassword123!"
        private const val TEST_VAULT_NAME = "Legacy Test Vault"
        private const val TEST_ENTRY_TITLE = "Test Entry"
        private const val TEST_ENTRY_USERNAME = "test@example.com"
        private const val TEST_ENTRY_PASSWORD = "SecretPassword456!"
    }

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        cryptoManager = VaultCryptoManager()
        vaultFileManager = VaultFileManager(context, cryptoManager)

        // Create a test directory for vault files
        testVaultDir = File(context.filesDir, "test_vaults_migration")
        if (testVaultDir.exists()) {
            testVaultDir.deleteRecursively()
        }
        testVaultDir.mkdirs()
    }

    @After
    fun tearDown() {
        // Clean up test vault files
        if (testVaultDir.exists()) {
            testVaultDir.deleteRecursively()
        }
    }

    /**
     * Creates a legacy vault file using deterministic salt (old method).
     *
     * This simulates a vault created before the random salt migration was implemented.
     * The header will NOT contain kdfSalt, triggering migration on load.
     */
    private fun createLegacyVaultFile(
        vaultId: String,
        entries: List<VaultEntryEntity> = emptyList()
    ): File {
        val timestamp = System.currentTimeMillis()

        // Create vault metadata
        val metadata = VaultMetadata(
            vaultId = vaultId,
            name = TEST_VAULT_NAME,
            description = "Legacy vault for migration testing",
            isDefault = false,
            createdAt = timestamp,
            modifiedAt = timestamp,
            statistics = VaultStatistics(
                entryCount = entries.size,
                folderCount = 0,
                presetCount = 0,
                tagCount = 0,
                totalSize = 0
            )
        )

        // Create vault data
        val vaultData = VaultData(
            metadata = metadata,
            entries = entries,
            folders = emptyList(),
            tags = emptyList(),
            presets = emptyList(),
            entryTags = emptyList()
        )

        // Use deterministic salt (legacy method)
        @Suppress("DEPRECATION")
        val legacySalt = cryptoManager.generateSaltFromString(vaultId)
        val vaultKey = cryptoManager.deriveKey(TEST_MASTER_PASSWORD, legacySalt)

        // Serialize vault data
        val dataJson = gson.toJson(vaultData)
        val checksum = calculateChecksum(dataJson)

        // Create header WITHOUT kdfSalt (legacy format)
        val legacyHeader = VaultFileHeader(
            magicNumber = VaultFileHeader.MAGIC_NUMBER,
            version = 1,  // Legacy version
            vaultId = vaultId,
            createdAt = timestamp,
            modifiedAt = timestamp,
            checksum = checksum,
            keyFileHash = null,
            kdfSalt = null,  // No salt in header = legacy vault
            kdfAlgorithm = VaultFileHeader.DEFAULT_KDF
        )

        // Encrypt the vault data
        val encryptedContent = cryptoManager.encryptBytes(
            dataJson.toByteArray(Charsets.UTF_8),
            vaultKey
        )

        // Build the vault file
        val headerJson = gson.toJson(legacyHeader)
        val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
        val jsonBytes = headerJson.toByteArray(Charsets.UTF_8)
        System.arraycopy(jsonBytes, 0, headerBytes, 0, jsonBytes.size)

        // Write to file
        val vaultFile = File(testVaultDir, "vault_$vaultId.gpv")
        FileOutputStream(vaultFile).use { fos ->
            fos.write(headerBytes)
            fos.write(encryptedContent)
            fos.flush()
            fos.fd.sync()
        }

        return vaultFile
    }

    private fun calculateChecksum(data: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }

    @Test
    fun legacyVaultWithoutSalt_migratesSuccessfully() = runBlocking {
        // Arrange: Create a legacy vault with deterministic salt
        val vaultId = UUID.randomUUID().toString()
        val testEntry = VaultEntryEntity(
            id = UUID.randomUUID().toString(),
            vaultId = vaultId,
            title = TEST_ENTRY_TITLE,
            username = TEST_ENTRY_USERNAME,
            password = TEST_ENTRY_PASSWORD
        )
        val legacyFile = createLegacyVaultFile(vaultId, listOf(testEntry))

        // Verify legacy header has no salt
        val preLoadHeader = vaultFileManager.getVaultFileInfo(legacyFile.absolutePath)
        assertNotNull(preLoadHeader, "Header should be readable before migration")
        assertFalse(preLoadHeader.hasKdfSalt(), "Legacy header should NOT have kdfSalt")
        assertEquals(1, preLoadHeader.version, "Legacy vault should be version 1")

        // Act: Load the vault (triggers migration)
        val loadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        // Assert: Verify migration occurred
        assertNotNull(loadResult, "Load result should not be null")
        assertTrue(loadResult.header.hasKdfSalt(), "Migrated header MUST have kdfSalt")
        assertNotNull(loadResult.header.kdfSalt, "kdfSalt should not be null after migration")
        assertTrue(loadResult.header.kdfSalt!!.isNotBlank(), "kdfSalt should not be blank")

        // Verify data integrity
        assertEquals(1, loadResult.data.entries.size, "Should have 1 entry")
        val loadedEntry = loadResult.data.entries.first()
        assertEquals(TEST_ENTRY_TITLE, loadedEntry.title, "Entry title should match")
        assertEquals(TEST_ENTRY_USERNAME, loadedEntry.username, "Entry username should match")
        assertEquals(TEST_ENTRY_PASSWORD, loadedEntry.password, "Entry password should match")
    }

    @Test
    fun migratedVault_persistsRandomSalt() = runBlocking {
        // Arrange: Create and load legacy vault (triggers migration)
        val vaultId = UUID.randomUUID().toString()
        val testEntry = VaultEntryEntity(
            id = UUID.randomUUID().toString(),
            vaultId = vaultId,
            title = "Persistence Test Entry",
            username = "persist@test.com",
            password = "PersistPassword789!"
        )
        val legacyFile = createLegacyVaultFile(vaultId, listOf(testEntry))

        // First load - triggers migration
        val firstLoadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        val migratedSalt = firstLoadResult.header.kdfSalt
        assertNotNull(migratedSalt, "First load should produce kdfSalt")

        // Act: Reload the vault a second time
        val secondLoadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        // Assert: Salt should be identical (persistent)
        assertEquals(
            migratedSalt,
            secondLoadResult.header.kdfSalt,
            "Salt should persist across reloads"
        )
        assertTrue(
            secondLoadResult.header.hasKdfSalt(),
            "Second load should still have kdfSalt"
        )

        // Data should still be intact
        assertEquals(1, secondLoadResult.data.entries.size, "Should still have 1 entry")
        val reloadedEntry = secondLoadResult.data.entries.first()
        assertEquals("Persistence Test Entry", reloadedEntry.title)
        assertEquals("persist@test.com", reloadedEntry.username)
        assertEquals("PersistPassword789!", reloadedEntry.password)
    }

    @Test
    fun migratedSalt_isDifferentFromDeterministicSalt() = runBlocking {
        // Arrange
        val vaultId = UUID.randomUUID().toString()
        val legacyFile = createLegacyVaultFile(vaultId)

        // Calculate what the deterministic salt would be
        @Suppress("DEPRECATION")
        val deterministicSalt = cryptoManager.generateSaltFromString(vaultId)
        val deterministicSaltHex = cryptoManager.bytesToHex(deterministicSalt)

        // Act: Load and migrate
        val loadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        // Assert: New salt must be different from deterministic salt
        assertNotEquals(
            deterministicSaltHex,
            loadResult.header.kdfSalt,
            "Migrated salt MUST be different from deterministic salt (security requirement)"
        )

        // Verify salt length (32 bytes = 64 hex chars)
        assertEquals(
            64,
            loadResult.header.kdfSalt!!.length,
            "Salt should be 32 bytes (64 hex chars)"
        )
    }

    @Test
    fun legacyVaultWithMultipleEntries_migratesAllDataIntact() = runBlocking {
        // Arrange: Create legacy vault with multiple entries
        val vaultId = UUID.randomUUID().toString()
        val entries = listOf(
            VaultEntryEntity(
                id = UUID.randomUUID().toString(),
                vaultId = vaultId,
                title = "Entry 1",
                username = "user1@test.com",
                password = "Pass1!",
                entryType = "LOGIN"
            ),
            VaultEntryEntity(
                id = UUID.randomUUID().toString(),
                vaultId = vaultId,
                title = "Entry 2",
                username = "user2@test.com",
                password = "Pass2@",
                entryType = "LOGIN",
                isFavorite = true
            ),
            VaultEntryEntity(
                id = UUID.randomUUID().toString(),
                vaultId = vaultId,
                title = "Secure Note",
                notes = "This is a secure note with sensitive information.",
                entryType = "NOTE"
            )
        )
        val legacyFile = createLegacyVaultFile(vaultId, entries)

        // Act: Load and migrate
        val loadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        // Assert: All entries preserved
        assertEquals(3, loadResult.data.entries.size, "All 3 entries should be preserved")

        // Verify each entry
        val entry1 = loadResult.data.entries.find { it.title == "Entry 1" }
        assertNotNull(entry1, "Entry 1 should exist")
        assertEquals("user1@test.com", entry1.username)
        assertEquals("Pass1!", entry1.password)

        val entry2 = loadResult.data.entries.find { it.title == "Entry 2" }
        assertNotNull(entry2, "Entry 2 should exist")
        assertEquals("user2@test.com", entry2.username)
        assertTrue(entry2.isFavorite, "Favorite flag should be preserved")

        val noteEntry = loadResult.data.entries.find { it.entryType == "NOTE" }
        assertNotNull(noteEntry, "Note entry should exist")
        assertTrue(
            noteEntry.notes?.contains("sensitive information") == true,
            "Note content should be preserved"
        )

        // Verify migration happened
        assertTrue(loadResult.header.hasKdfSalt(), "Should have migrated to random salt")
    }

    @Test
    fun modernVaultWithSalt_doesNotReMigrate() = runBlocking {
        // Arrange: Create a modern vault using the normal API (with random salt)
        val (vaultId, location) = vaultFileManager.createVaultFile(
            name = "Modern Vault",
            masterPassword = TEST_MASTER_PASSWORD,
            strategy = StorageStrategy.INTERNAL,
            description = "A modern vault with random salt"
        )

        val vaultFile = location.file!!

        // Get the initial salt
        val initialHeader = vaultFileManager.getVaultFileInfo(vaultFile.absolutePath)
        assertNotNull(initialHeader, "Modern vault should have a header")
        assertTrue(initialHeader.hasKdfSalt(), "Modern vault should have kdfSalt")
        val initialSalt = initialHeader.kdfSalt

        // Act: Load the vault
        val loadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = vaultFile.absolutePath
        )

        // Assert: Salt should be unchanged (no migration)
        assertEquals(
            initialSalt,
            loadResult.header.kdfSalt,
            "Modern vault salt should NOT change on load"
        )
    }

    @Test
    fun legacyVaultMigration_preservesTimestamps() = runBlocking {
        // Arrange: Create legacy vault with specific timestamps
        val vaultId = UUID.randomUUID().toString()
        val legacyFile = createLegacyVaultFile(vaultId)

        val preLoadHeader = vaultFileManager.getVaultFileInfo(legacyFile.absolutePath)
        assertNotNull(preLoadHeader)
        val originalCreatedAt = preLoadHeader.createdAt
        val originalModifiedAt = preLoadHeader.modifiedAt

        // Act: Load and migrate
        val loadResult = vaultFileManager.loadVaultFile(
            vaultId = vaultId,
            masterPassword = TEST_MASTER_PASSWORD,
            filePath = legacyFile.absolutePath
        )

        // Assert: Timestamps should be preserved
        // Note: Migration should NOT update modifiedAt to avoid changing user perception
        assertEquals(
            originalCreatedAt,
            loadResult.header.createdAt,
            "CreatedAt should be preserved after migration"
        )
        // modifiedAt might be the same or updated - check implementation
        // The current implementation uses updateModifiedTimestamp = false for migration
        assertEquals(
            originalModifiedAt,
            loadResult.header.modifiedAt,
            "ModifiedAt should be preserved (migration is transparent)"
        )
    }

    @Test
    fun deterministicSaltGeneration_isConsistent() {
        // This test verifies the deprecated method works correctly for migration
        val testSeed = "test-vault-id-12345"

        @Suppress("DEPRECATION")
        val salt1 = cryptoManager.generateSaltFromString(testSeed)
        @Suppress("DEPRECATION")
        val salt2 = cryptoManager.generateSaltFromString(testSeed)

        // Deterministic: same seed = same salt
        assertTrue(salt1.contentEquals(salt2), "Deterministic salt should be consistent")
        assertEquals(32, salt1.size, "Salt should be 32 bytes")

        // Different seed = different salt
        @Suppress("DEPRECATION")
        val differentSalt = cryptoManager.generateSaltFromString("different-seed")
        assertFalse(
            salt1.contentEquals(differentSalt),
            "Different seeds should produce different salts"
        )
    }

    @Test
    fun randomSaltGeneration_producesUniqueSalts() {
        val salt1 = cryptoManager.generateSalt()
        val salt2 = cryptoManager.generateSalt()

        assertFalse(salt1.contentEquals(salt2), "Random salts should be unique")
        assertEquals(32, salt1.size, "Salt should be 32 bytes")
        assertEquals(32, salt2.size, "Salt should be 32 bytes")
    }
}
