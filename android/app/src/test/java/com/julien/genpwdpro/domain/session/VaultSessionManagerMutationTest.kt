package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultMetadata
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.exceptions.VaultException
import com.julien.genpwdpro.security.KeystoreManager
import io.mockk.MockKAnnotations
import io.mockk.clearAllMocks
import io.mockk.coVerify
import io.mockk.any
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

    private lateinit var sessionManager: VaultSessionManager

    private var activeSessionScope: CoroutineScope? = null

    @BeforeTest
    fun setUp() {
        MockKAnnotations.init(this, relaxUnitFun = true)
        sessionManager = VaultSessionManager(
            vaultFileManager = vaultFileManager,
            vaultRegistryDao = vaultRegistryDao,
            cryptoManager = cryptoManager,
            keystoreManager = keystoreManager
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
            vaultFileManager.saveVaultFile(any(), any(), any(), any(), any())
        }
    }

    private fun configureSession(initialData: VaultData, testScope: TestScope) {
        val session = VaultSessionManager.VaultSession(
            vaultId = initialData.metadata.vaultId,
            vaultKey = dummySecretKey(),
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
            encryptedTitle = "title",
            titleIv = "iv-title",
            encryptedPassword = "pwd",
            passwordIv = "iv-pwd"
        )
    }

    private fun dummySecretKey(): SecretKey {
        val secretKeyField = javax.crypto.spec.SecretKeySpec(ByteArray(32) { 1 }, "AES")
        return secretKeyField
    }
}
