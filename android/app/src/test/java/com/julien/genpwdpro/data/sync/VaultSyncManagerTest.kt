package com.julien.genpwdpro.data.sync

import android.content.Context
import android.content.SharedPreferences
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.data.sync.models.*
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.SyncPreferencesManager
import com.julien.genpwdpro.data.sync.AutoSyncScheduler
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour VaultSyncManager
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VaultSyncManagerTest {

    private lateinit var syncManager: VaultSyncManager
    private lateinit var mockContext: Context
    private lateinit var mockVaultRepository: VaultRepository
    private lateinit var mockConflictResolver: ConflictResolver
    private lateinit var mockCloudProvider: CloudProvider
    private lateinit var mockPrefs: SharedPreferences
    private lateinit var mockEditor: SharedPreferences.Editor
    private lateinit var mockCredentialManager: ProviderCredentialManager
    private lateinit var mockSyncPreferencesManager: SyncPreferencesManager
    private lateinit var mockAutoSyncScheduler: AutoSyncScheduler

    @Before
    fun setup() {
        // Mock Context et SharedPreferences
        mockContext = mockk(relaxed = true)
        mockPrefs = mockk(relaxed = true)
        mockEditor = mockk(relaxed = true)

        every { mockContext.getSharedPreferences(any(), any()) } returns mockPrefs
        every { mockPrefs.edit() } returns mockEditor
        every { mockEditor.putString(any(), any()) } returns mockEditor
        every { mockEditor.remove(any()) } returns mockEditor
        every { mockEditor.apply() } just Runs
        every { mockPrefs.getString("device_id", null) } returns "test-device-123"
        every { mockPrefs.getString("device_name", null) } returns "Test Device"

        // Mock VaultRepository
        mockVaultRepository = mockk(relaxed = true)

        // Mock ConflictResolver
        mockConflictResolver = mockk(relaxed = true)

        // Mock CloudProvider
        mockCloudProvider = mockk(relaxed = true)

        mockCredentialManager = mockk(relaxed = true)
        mockSyncPreferencesManager = mockk(relaxed = true)
        mockAutoSyncScheduler = mockk(relaxed = true)

        // Créer VaultSyncManager
        syncManager = VaultSyncManager(
            context = mockContext,
            vaultRepository = mockVaultRepository,
            conflictResolver = mockConflictResolver,
            credentialManager = mockCredentialManager,
            syncPreferencesManager = mockSyncPreferencesManager,
            autoSyncScheduler = mockAutoSyncScheduler
        )
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `setProvider configures provider and updates config`() = runTest {
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val config = syncManager.config.first()

        assertTrue(config.enabled)
        assertEquals(CloudProviderType.GOOGLE_DRIVE, config.providerType)
        assertEquals("test-device-123", config.deviceId)
        verify { mockEditor.putString("provider_type", "GOOGLE_DRIVE") }
    }

    @Test
    fun `isAuthenticated returns false when no provider set`() = runTest {
        val isAuth = syncManager.isAuthenticated()

        assertFalse(isAuth)
    }

    @Test
    fun `isAuthenticated returns provider status when provider is set`() = runTest {
        coEvery { mockCloudProvider.isAuthenticated() } returns true

        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)
        val isAuth = syncManager.isAuthenticated()

        assertTrue(isAuth)
        coVerify { mockCloudProvider.isAuthenticated() }
    }

    @Test
    fun `disconnect clears credentials and cancels work`() = runTest {
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        syncManager.disconnect()

        verify { mockAutoSyncScheduler.cancelAllSync() }
        verify { mockCredentialManager.clearProvider(CloudProviderType.GOOGLE_DRIVE) }
        coVerify { mockSyncPreferencesManager.clearAllCredentials() }
        verify { mockEditor.remove("provider_type") }
        assertEquals(SyncStatus.NEVER_SYNCED, syncManager.syncStatus.first())
    }

    @Test
    fun `syncVault returns error when no provider configured`() = runTest {
        val result = syncManager.syncVault("vault-1", "password")

        assertTrue(result is SyncResult.Error)
        assertEquals("Aucun provider configuré", (result as SyncResult.Error).message)
    }

    @Test
    fun `syncVault successfully uploads vault`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val encryptedData = byteArrayOf(1, 2, 3)
        val vault = VaultEntity(
            id = "vault-1",
            name = "Test Vault",
            description = "",
            masterPasswordHash = "",
            salt = "",
            encryptedKey = "",
            keyIv = "",
            createdAt = 1000L,
            modifiedAt = 2000L,
            lastAccessedAt = 3000L
        )

        coEvery { mockVaultRepository.exportVault("vault-1", "password") } returns encryptedData
        coEvery { mockVaultRepository.getVaultById("vault-1") } returns vault
        coEvery { mockCloudProvider.hasNewerVersion(any(), any()) } returns false
        coEvery { mockCloudProvider.uploadVault(any(), any()) } returns "file-id-123"

        // Execute
        val result = syncManager.syncVault("vault-1", "password")

        // Verify
        assertTrue(result is SyncResult.Success)
        assertEquals(SyncStatus.SYNCED, syncManager.syncStatus.first())

        coVerify { mockVaultRepository.exportVault("vault-1", "password") }
        coVerify { mockCloudProvider.uploadVault("vault-1", any()) }
    }

    @Test
    fun `syncVault detects conflict when remote is newer`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val encryptedData = byteArrayOf(1, 2, 3)
        val vault = VaultEntity(
            id = "vault-1",
            name = "Test Vault",
            description = "",
            masterPasswordHash = "",
            salt = "",
            encryptedKey = "",
            keyIv = "",
            createdAt = 1000L,
            modifiedAt = 2000L,
            lastAccessedAt = 3000L
        )

        val remoteData = VaultSyncData(
            vaultId = "vault-1",
            vaultName = "Test Vault",
            encryptedData = byteArrayOf(4, 5, 6),
            timestamp = 5000L,
            version = 1,
            deviceId = "other-device",
            checksum = "different-checksum"
        )

        coEvery { mockVaultRepository.exportVault("vault-1", "password") } returns encryptedData
        coEvery { mockVaultRepository.getVaultById("vault-1") } returns vault
        coEvery { mockCloudProvider.hasNewerVersion(any(), any()) } returns true
        coEvery { mockCloudProvider.downloadVault("vault-1") } returns remoteData
        every { mockConflictResolver.hasConflict(any(), any()) } returns true

        // Execute
        val result = syncManager.syncVault("vault-1", "password")

        // Verify
        assertTrue(result is SyncResult.Conflict)
        assertEquals(SyncStatus.CONFLICT, syncManager.syncStatus.first())
    }

    @Test
    fun `downloadVault successfully imports vault`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val syncData = VaultSyncData(
            vaultId = "vault-1",
            vaultName = "Test Vault",
            encryptedData = byteArrayOf(1, 2, 3),
            timestamp = 1000L,
            version = 1,
            deviceId = "other-device",
            checksum = "abc123"
        )

        coEvery { mockCloudProvider.downloadVault("vault-1") } returns syncData
        coEvery { mockVaultRepository.importVault(any(), "password") } returns true

        // Execute
        val success = syncManager.downloadVault("vault-1", "password")

        // Verify
        assertTrue(success)
        assertEquals(SyncStatus.SYNCED, syncManager.syncStatus.first())

        coVerify { mockCloudProvider.downloadVault("vault-1") }
        coVerify { mockVaultRepository.importVault(syncData.encryptedData, "password") }
    }

    @Test
    fun `downloadVault returns false when no data found`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        coEvery { mockCloudProvider.downloadVault("vault-1") } returns null

        // Execute
        val success = syncManager.downloadVault("vault-1", "password")

        // Verify
        assertFalse(success)
        assertEquals(SyncStatus.ERROR, syncManager.syncStatus.first())
    }

    @Test
    fun `resolveConflict uploads resolved version`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val local = createSyncData("vault-1", timestamp = 1000L)
        val remote = createSyncData("vault-1", timestamp = 2000L)
        val resolved = remote // Supposons que la résolution choisit remote

        every { mockConflictResolver.resolve(local, remote, ConflictResolutionStrategy.NEWEST_WINS) } returns resolved
        coEvery { mockCloudProvider.uploadVault("vault-1", resolved) } returns "file-id"
        coEvery { mockVaultRepository.importVault(any(), "password") } returns true

        // Execute
        val success = syncManager.resolveConflict(
            local,
            remote,
            ConflictResolutionStrategy.NEWEST_WINS,
            "password"
        )

        // Verify
        assertTrue(success)
        coVerify { mockCloudProvider.uploadVault("vault-1", resolved) }
        coVerify { mockVaultRepository.importVault(resolved.encryptedData, "password") }
    }

    @Test
    fun `listCloudVaults returns provider vault list`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val vaultIds = listOf("vault-1", "vault-2", "vault-3")
        coEvery { mockCloudProvider.listVaults() } returns vaultIds

        // Execute
        val result = syncManager.listCloudVaults()

        // Verify
        assertEquals(vaultIds, result)
        coVerify { mockCloudProvider.listVaults() }
    }

    @Test
    fun `getStorageQuota returns provider quota`() = runTest {
        // Setup
        syncManager.setProvider(mockCloudProvider, CloudProviderType.GOOGLE_DRIVE)

        val quota = StorageQuota(
            totalBytes = 15_000_000_000, // 15 GB
            usedBytes = 5_000_000_000,   // 5 GB
            freeBytes = 10_000_000_000   // 10 GB
        )
        coEvery { mockCloudProvider.getStorageQuota() } returns quota

        // Execute
        val result = syncManager.getStorageQuota()

        // Verify
        assertEquals(quota, result)
        coVerify { mockCloudProvider.getStorageQuota() }
    }

    @Test
    fun `setAutoSync updates config`() = runTest {
        syncManager.setAutoSync(enabled = true, interval = SyncInterval.HOURLY)

        val config = syncManager.config.first()

        assertTrue(config.autoSync)
        assertEquals(SyncInterval.HOURLY, config.syncInterval)
    }

    @Test
    fun `setSyncOnWifiOnly updates config`() = runTest {
        syncManager.setSyncOnWifiOnly(enabled = false)

        val config = syncManager.config.first()

        assertFalse(config.syncOnWifiOnly)
    }

    // Helper function
    private fun createSyncData(
        vaultId: String,
        timestamp: Long = System.currentTimeMillis(),
        deviceId: String = "test-device"
    ): VaultSyncData {
        return VaultSyncData(
            vaultId = vaultId,
            vaultName = "Test Vault",
            encryptedData = byteArrayOf(1, 2, 3),
            timestamp = timestamp,
            version = 1,
            deviceId = deviceId,
            checksum = "test-checksum"
        )
    }
}
