package com.julien.genpwdpro.vault.ui

import com.julien.genpwdpro.vault.domain.InMemoryVaultRepository
import com.julien.genpwdpro.vault.domain.VaultGroup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class VaultEntriesViewModelIntegrationTest {

    @Test
    fun `create, search and update entries using in-memory repository`() {
        val repository = InMemoryVaultRepository()
        val viewModel = VaultEntriesViewModel(repository)

        viewModel.upsertGroup(VaultGroup(id = "group-1", name = "Personal"))

        val secret = charArrayOf('s', '3', 'c', 'r', '3', 't')
        val entryId = viewModel.createEntry(
            title = "Email",
            username = "user@example.com",
            secret = secret,
            groupId = "group-1",
            notes = "Primary account"
        )

        assertTrue(secret.all { it == '\u0000' }, "secret buffer should be wiped")

        val afterCreate = viewModel.uiState.value
        assertEquals(1, afterCreate.entries.size)
        assertEquals("Email", afterCreate.entries.first().title)
        assertEquals("group-1", afterCreate.entries.first().groupId)

        viewModel.search("email")
        val searchState = viewModel.uiState.value
        assertEquals(1, searchState.entries.size)
        assertEquals(entryId, searchState.entries.first().id)

        viewModel.updateEntry(entryId) { existing ->
            existing.copy(title = "Email (Updated)")
        }

        val updatedState = viewModel.uiState.value
        assertEquals("Email (Updated)", updatedState.entries.single().title)
        assertEquals(entryId, updatedState.lastEditedEntryId)

        viewModel.search("missing")
        assertTrue(viewModel.uiState.value.entries.isEmpty())

        viewModel.search("")
        assertEquals(1, viewModel.uiState.value.entries.size)
    }
}
