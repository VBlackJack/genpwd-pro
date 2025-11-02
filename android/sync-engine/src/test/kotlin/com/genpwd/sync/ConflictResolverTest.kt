package com.genpwd.sync

import com.genpwd.corevault.PendingOp
import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.Vault
import com.genpwd.corevault.VaultId
import com.genpwd.corevault.VaultItem
import com.genpwd.corevault.VaultMeta
import com.genpwd.sync.conflict.ConflictResolver
import org.junit.Assert.assertEquals
import org.junit.Test

class ConflictResolverTest {
    private val resolver = ConflictResolver()

    @Test
    fun `merge prioritises remote updates by timestamp`() {
        val local = createVault(
            items = listOf(
                VaultItem("1", "local", updatedAt = 10, updatedBy = "device"),
            ),
        )
        val remote = createVault(
            items = listOf(
                VaultItem("1", "remote", updatedAt = 20, updatedBy = "remote"),
            ),
        )

        val result = resolver.merge(local, remote, pendingOps = emptyList())

        assertEquals("remote", result.merged.items.single().encryptedPayload)
    }

    @Test
    fun `merge duplicates conflict with identical timestamp`() {
        val local = createVault(
            items = listOf(
                VaultItem("1", "local", updatedAt = 10, updatedBy = "device"),
            ),
        )
        val remote = createVault(
            items = listOf(
                VaultItem("1", "remote", updatedAt = 10, updatedBy = "remote"),
            ),
        )

        val result = resolver.merge(local, remote, pendingOps = emptyList())

        assertEquals(2, result.merged.items.size)
        assertEquals(1, result.conflicts.size)
    }

    @Test
    fun `pending operations applied after merge`() {
        val local = createVault(emptyList())
        val remote = createVault(emptyList())
        val pending = listOf(
            PendingOp.Add("op1", updatedAtUtc = 10, item = VaultItem("1", "local", 10, "device")),
        )

        val result = resolver.merge(local, remote, pending)

        assertEquals(1, result.merged.items.size)
        assertEquals("1", result.merged.items.first().itemId)
    }

    private fun createVault(items: List<VaultItem>): Vault = Vault(
        meta = VaultMeta(
            id = VaultId("/demo", ProviderKind.GOOGLE_DRIVE, "acc"),
            name = "demo",
            version = 1L,
            lastModifiedUtc = 0L,
            size = 0L,
            remoteEtag = null,
        ),
        items = items,
        changeVector = "device#0",
    )
}
