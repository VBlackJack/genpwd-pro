package com.julien.genpwdpro.data.sync

import com.julien.genpwdpro.data.sync.models.ConflictResolutionStrategy
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour ConflictResolver
 */
class ConflictResolverTest {

    private lateinit var conflictResolver: ConflictResolver

    @Before
    fun setup() {
        conflictResolver = ConflictResolver()
    }

    @Test
    fun `resolve with LOCAL_WINS returns local data`() {
        val local = createSyncData(timestamp = 1000L, deviceId = "device1")
        val remote = createSyncData(timestamp = 2000L, deviceId = "device2")

        val result = conflictResolver.resolve(local, remote, ConflictResolutionStrategy.LOCAL_WINS)

        assertEquals(local, result)
    }

    @Test
    fun `resolve with REMOTE_WINS returns remote data`() {
        val local = createSyncData(timestamp = 2000L, deviceId = "device1")
        val remote = createSyncData(timestamp = 1000L, deviceId = "device2")

        val result = conflictResolver.resolve(local, remote, ConflictResolutionStrategy.REMOTE_WINS)

        assertEquals(remote, result)
    }

    @Test
    fun `resolve with NEWEST_WINS returns newer data when remote is newer`() {
        val local = createSyncData(timestamp = 1000L, deviceId = "device1")
        val remote = createSyncData(timestamp = 2000L, deviceId = "device2")

        val result = conflictResolver.resolve(local, remote, ConflictResolutionStrategy.NEWEST_WINS)

        assertEquals(remote, result)
    }

    @Test
    fun `resolve with NEWEST_WINS returns local data when local is newer`() {
        val local = createSyncData(timestamp = 2000L, deviceId = "device1")
        val remote = createSyncData(timestamp = 1000L, deviceId = "device2")

        val result = conflictResolver.resolve(local, remote, ConflictResolutionStrategy.NEWEST_WINS)

        assertEquals(local, result)
    }

    @Test
    fun `hasConflict returns false when checksums match`() {
        val local = createSyncData(checksum = "abc123")
        val remote = createSyncData(checksum = "abc123")

        val hasConflict = conflictResolver.hasConflict(local, remote)

        assertFalse(hasConflict)
    }

    @Test
    fun `hasConflict returns false when same device`() {
        val local = createSyncData(deviceId = "device1", checksum = "abc")
        val remote = createSyncData(deviceId = "device1", checksum = "def")

        val hasConflict = conflictResolver.hasConflict(local, remote)

        assertFalse(hasConflict)
    }

    @Test
    fun `hasConflict returns true when simultaneous modifications`() {
        val now = System.currentTimeMillis()
        val local = createSyncData(
            timestamp = now,
            deviceId = "device1",
            checksum = "abc"
        )
        val remote = createSyncData(
            timestamp = now + 1000, // 1 second difference
            deviceId = "device2",
            checksum = "def"
        )

        val hasConflict = conflictResolver.hasConflict(local, remote)

        assertTrue(hasConflict)
    }

    @Test
    fun `hasConflict returns false when clear time difference`() {
        val local = createSyncData(
            timestamp = 1000L,
            deviceId = "device1",
            checksum = "abc"
        )
        val remote = createSyncData(
            timestamp = 10000L, // 9 seconds difference
            deviceId = "device2",
            checksum = "def"
        )

        val hasConflict = conflictResolver.hasConflict(local, remote)

        assertFalse(hasConflict)
    }

    @Test
    fun `suggestStrategy returns LOCAL_WINS for same device`() {
        val local = createSyncData(deviceId = "device1")
        val remote = createSyncData(deviceId = "device1")

        val strategy = conflictResolver.suggestStrategy(local, remote)

        assertEquals(ConflictResolutionStrategy.LOCAL_WINS, strategy)
    }

    @Test
    fun `suggestStrategy returns MANUAL for simultaneous edits`() {
        val now = System.currentTimeMillis()
        val local = createSyncData(timestamp = now, deviceId = "device1")
        val remote = createSyncData(timestamp = now + 1000, deviceId = "device2")

        val strategy = conflictResolver.suggestStrategy(local, remote)

        assertEquals(ConflictResolutionStrategy.MANUAL, strategy)
    }

    @Test
    fun `suggestStrategy returns NEWEST_WINS for clear time difference`() {
        val local = createSyncData(timestamp = 1000L, deviceId = "device1")
        val remote = createSyncData(timestamp = 10000L, deviceId = "device2")

        val strategy = conflictResolver.suggestStrategy(local, remote)

        assertEquals(ConflictResolutionStrategy.NEWEST_WINS, strategy)
    }

    @Test
    fun `isRemoteNewer returns true when remote is newer`() {
        val local = createSyncData(timestamp = 1000L)
        val remote = createSyncData(timestamp = 2000L)

        val isNewer = conflictResolver.isRemoteNewer(local, remote)

        assertTrue(isNewer)
    }

    @Test
    fun `isRemoteNewer returns false when local is newer`() {
        val local = createSyncData(timestamp = 2000L)
        val remote = createSyncData(timestamp = 1000L)

        val isNewer = conflictResolver.isRemoteNewer(local, remote)

        assertFalse(isNewer)
    }

    @Test
    fun `comparePriority favors local when timestamps equal`() {
        val local = createSyncData(timestamp = 1000L, checksum = "abc")
        val remote = createSyncData(timestamp = 1000L, checksum = "abc")

        val comparison = conflictResolver.comparePriority(local, remote)

        assertTrue(comparison > 0, "Local should have higher priority")
    }

    @Test
    fun `comparePriority favors newer timestamp`() {
        val local = createSyncData(timestamp = 1000L)
        val remote = createSyncData(timestamp = 2000L)

        val comparison = conflictResolver.comparePriority(local, remote)

        assertTrue(comparison < 0, "Remote with newer timestamp should have higher priority")
    }

    // Helper function to create test data
    private fun createSyncData(
        vaultId: String = "test-vault",
        vaultName: String = "Test Vault",
        timestamp: Long = System.currentTimeMillis(),
        deviceId: String = "test-device",
        checksum: String = "test-checksum"
    ): VaultSyncData {
        return VaultSyncData(
            vaultId = vaultId,
            vaultName = vaultName,
            encryptedData = byteArrayOf(1, 2, 3, 4, 5),
            timestamp = timestamp,
            version = 1,
            deviceId = deviceId,
            checksum = checksum
        )
    }
}
