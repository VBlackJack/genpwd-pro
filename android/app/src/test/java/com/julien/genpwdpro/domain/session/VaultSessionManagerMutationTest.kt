package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.models.vault.EntryType
import com.julien.genpwdpro.data.models.vault.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultFileHeader
import com.julien.genpwdpro.data.models.vault.VaultMetadata
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.exceptions.VaultException
import com.julien.genpwdpro.security.BiometricKeyManager
import com.julien.genpwdpro.security.KeystoreManager
import io.mockk.*
import io.mockk.impl.annotations.MockK
import javax.crypto.SecretKey
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest

class VaultSessionManagerMutationTest {

    @MockK(relaxed = true)
    private lateinit var vaultFileManager: VaultFileManager

    @MockK(relaxed = true)
    private lateinit var vaultRegistryDao: VaultRegistryDao

    @MockK(relaxed = true)
    private lateinit var cryptoManager: com.julien.genpwdpro.data.crypto.VaultCryptoManager

    @MockK(relaxed = true)
    private lateinit var keystoreManager: KeystoreManager

    @MockK(relaxed = true)
    private lateinit var biometricKeyManager: BiometricKeyManager

    @MockK(relaxed = true)
    private lateinit var unlockRateLimiter: UnlockRateLimiter

    private lateinit var sessionManager: VaultSessionManager

    private var activeSessionScope: CoroutineScope? = null

    @BeforeTest
    fun setUp() {
        MockKAnnotations.init(this, relaxUnitFun = true)
        sessionManager = VaultSessionManager(
            vaultFileManager = vaultFileManager,
            vaultRegistryDao = vaultRegistryDao,
            cryptoManager = cryptoManager,
            keystoreManager = keystoreManager,
            biometricKeyManager = biometricKeyManager,
            unlockRateLimiter = unlockRateLimiter
        )
    }

    @AfterTest
    fun tearDown() {
        activeSessionScope?.cancel()
        activeSessionScope = null
        clearAllMocks()
    }

    @Test
    fun `updateEntry fails when entry does not exist`() = runTest {
        configureSession(emptyVaultData(), this)

        val missingEntry = sampleEntry(id = "entry-missing")

        val result = sessionManager.updateEntry(missingEntry)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is VaultException.EntryNotFound)
    }

    @Test
    fun `deleteTag fails when tag does not exist`() = runTest {
        configureSession(emptyVaultData(), this)

        val result = sessionManager.deleteTag("tag-404")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is VaultException.TagNotFound)
    }

    @Test
    fun `updateEntry skips persistence when data is unchanged`() = runTest {
        val entry = sampleEntry(id = "entry-1")
        val vaultData = emptyVaultData().copy(entries = listOf(entry))
        configureSession(vaultData, this)

        val result = sessionManager.updateEntry(entry)

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) {
            vaultFileManager.saveVaultFile(any(), any(), any(), any(), any(), any())
        }
    }

    private fun configureSession(initialData: VaultData, testScope: TestScope) {
        val salt = ByteArray(32) { 0x01 }
        val header = VaultFileHeader(
            vaultId = initialData.metadata.vaultId,
            createdAt = initialData.metadata.createdAt,
            modifiedAt = initialData.metadata.modifiedAt,
            checksum = "",
            kdfSalt = salt.joinToString(separator = "") { String.format("%02x", it) }
        )
        val session = VaultSessionManager.VaultSession(
            vaultId = initialData.metadata.vaultId,
            vaultKey = dummySecretKey(),
            header = header,
            kdfSalt = salt,
            filePath = "/data/${initialData.metadata.vaultId}.gpv",
            storageStrategy = StorageStrategy.APP_STORAGE,
            fileUri = null,
            _vaultData = MutableStateFlow(initialData)
        )

        val scope = TestScope(StandardTestDispatcher(testScope.testScheduler))
        setPrivateField("currentSession", session)
        setPrivateField("sessionScope", scope)
        activeSessionScope = scope

        val activeField = VaultSessionManager::class.java.getDeclaredField("_activeVaultId")
        activeField.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        val flow = activeField.get(sessionManager) as MutableStateFlow<String?>
        flow.value = session.vaultId
    }

    private fun setPrivateField(fieldName: String, value: Any?) {
        val field = VaultSessionManager::class.java.getDeclaredField(fieldName)
        field.isAccessible = true
        field.set(sessionManager, value)
    }

    private fun emptyVaultData(): VaultData {
        return VaultData(
            metadata = VaultMetadata(
                vaultId = "vault-test",
                name = "Test",
                description = null,
                isDefault = false,
                createdAt = 0L,
                modifiedAt = 0L,
                statistics = VaultStatistics()
            ),
            entries = emptyList(),
            folders = emptyList(),
            tags = emptyList(),
            presets = emptyList(),
            entryTags = emptyList()
        )
    }

    private fun sampleEntry(id: String): VaultEntryEntity {
        return VaultEntryEntity(
            id = id,
            vaultId = "vault-test",
            entryType = EntryType.LOGIN.name,
            title = "Test Entry",
            username = "user@example.com",
            password = "testpassword123",
            url = "https://example.com",
            notes = "",
            passwordStrength = 75,
            isFavorite = false,
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis()
        )
    }

    private fun dummySecretKey(): SecretKey {
        val secretKeyField = javax.crypto.spec.SecretKeySpec(ByteArray(32) { 1 }, "AES")
        return secretKeyField
    }
}
