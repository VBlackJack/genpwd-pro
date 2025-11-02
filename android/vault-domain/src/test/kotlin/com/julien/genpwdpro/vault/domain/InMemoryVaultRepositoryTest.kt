package com.julien.genpwdpro.vault.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class InMemoryVaultRepositoryTest {

    @Test
    fun `saving and retrieving entry returns stored copy`() {
        val repository = InMemoryVaultRepository()
        val group = VaultGroup(id = "group-1", name = "Personal")
        repository.saveGroup(group)

        val entry = VaultEntry(id = "entry-1", title = "Email", groupId = group.id)
        repository.saveEntry(entry)

        val retrieved = repository.getEntryById(entry.id)
        assertEquals(entry, retrieved)

        val mutated = retrieved!!.copy(title = "Changed")
        assertEquals("Changed", mutated.title)
        assertEquals("Email", repository.getEntryById(entry.id)?.title)
    }

    @Test
    fun `saving entry with unknown group fails`() {
        val repository = InMemoryVaultRepository()
        val entry = VaultEntry(id = "entry-2", title = "Secure", groupId = "missing")

        assertFailsWith<IllegalArgumentException> {
            repository.saveEntry(entry)
        }
    }

    @Test
    fun `deleting group detaches contained entries`() {
        val repository = InMemoryVaultRepository()
        val parent = VaultGroup(id = "group-2", name = "Work")
        repository.saveGroup(parent)
        repository.saveEntry(VaultEntry(id = "entry-3", title = "VPN", groupId = parent.id))

        assertTrue(repository.deleteGroup(parent.id))

        val entry = repository.getEntryById("entry-3")
        assertNotNull(entry)
        assertNull(entry.groupId)
    }

    @Test
    fun `deleting entry reports status`() {
        val repository = InMemoryVaultRepository()
        repository.saveEntry(VaultEntry(id = "entry-4", title = "Blog"))

        assertTrue(repository.deleteEntry("entry-4"))
        assertFalse(repository.deleteEntry("entry-4"))
    }

    @Test
    fun `saving group with missing parent fails`() {
        val repository = InMemoryVaultRepository()
        val child = VaultGroup(id = "group-3", name = "Child", parentGroupId = "unknown")

        assertFailsWith<IllegalArgumentException> {
            repository.saveGroup(child)
        }
    }
}
