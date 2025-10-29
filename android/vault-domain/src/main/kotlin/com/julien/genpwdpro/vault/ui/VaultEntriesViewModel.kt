package com.julien.genpwdpro.vault.ui

import com.julien.genpwdpro.vault.domain.InMemoryVaultRepository
import com.julien.genpwdpro.vault.domain.VaultEntry
import com.julien.genpwdpro.vault.domain.VaultGroup
import com.julien.genpwdpro.vault.domain.VaultRepository
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Lightweight ViewModel-like facade that exposes vault entry data to the UI layer.
 *
 * The class only depends on the vault domain interfaces which makes it suitable
 * for multiplatform use. It relies on [InMemoryVaultRepository] for now, but any
 * implementation of [VaultRepository] can be provided later on.
 */
class VaultEntriesViewModel(
    private val repository: VaultRepository = InMemoryVaultRepository()
) {

    private val _uiState = MutableStateFlow(VaultEntriesUiState())
    val uiState: StateFlow<VaultEntriesUiState> = _uiState.asStateFlow()

    init {
        reload()
    }

    /**
     * Reloads the complete repository content and reapplies the current query.
     */
    fun reload() {
        val groups = repository.getGroups()
        val entries = repository.getEntries()
        updateState(entries = entries, groups = groups)
    }

    /**
     * Updates the search query and recomputes the filtered list of entries.
     */
    fun search(query: String) {
        val normalized = query.trim()
        val allEntries = repository.getEntries()
        updateState(entries = allEntries, query = normalized)
    }

    /**
     * Creates a new entry associated with an optional group and notes the
     * resulting identifier. The provided [secret] buffer is wiped once the
     * operation completes to avoid leaking sensitive information.
     */
    fun createEntry(
        title: String,
        username: String? = null,
        secret: CharArray? = null,
        groupId: String? = null,
        notes: String? = null,
        url: String? = null
    ): String {
        val id = UUID.randomUUID().toString()
        val entry = VaultEntry(
            id = id,
            title = title,
            username = username,
            password = secret?.concatToString(),
            groupId = groupId,
            notes = notes,
            url = url,
            updatedAt = Instant.now()
        )

        try {
            repository.saveEntry(entry)
        } finally {
            secret?.fill('\u0000')
        }

        val allEntries = repository.getEntries()
        updateState(entries = allEntries, lastEditedEntryId = id)
        return id
    }

    /**
     * Creates or updates a group and refreshes the UI state.
     */
    fun upsertGroup(group: VaultGroup) {
        repository.saveGroup(group)
        updateState(groups = repository.getGroups())
    }

    /**
     * Updates an existing entry by applying [transform]. When the entry is not
     * found the method returns quietly. The optional [secret] buffer is wiped
     * after use.
     */
    fun updateEntry(
        entryId: String,
        secret: CharArray? = null,
        transform: (VaultEntry) -> VaultEntry
    ) {
        val current = repository.getEntryById(entryId) ?: return
        val updated = transform(current).copy(
            password = secret?.concatToString() ?: current.password,
            updatedAt = Instant.now()
        )

        try {
            repository.saveEntry(updated)
        } finally {
            secret?.fill('\u0000')
        }

        val allEntries = repository.getEntries()
        updateState(entries = allEntries, lastEditedEntryId = entryId)
    }

    fun deleteEntry(entryId: String) {
        repository.deleteEntry(entryId)
        val allEntries = repository.getEntries()
        updateState(entries = allEntries, lastEditedEntryId = null)
    }

    private fun updateState(
        entries: List<VaultEntry>? = null,
        groups: List<VaultGroup>? = null,
        query: String? = null,
        lastEditedEntryId: String? = _uiState.value.lastEditedEntryId
    ) {
        val effectiveQuery = query ?: _uiState.value.query
        val allEntries = entries ?: repository.getEntries()
        val filtered = if (effectiveQuery.isBlank()) {
            allEntries
        } else {
            filterEntries(allEntries, effectiveQuery)
        }

        _uiState.value = _uiState.value.copy(
            entries = filtered,
            query = effectiveQuery,
            groups = groups ?: repository.getGroups(),
            lastEditedEntryId = lastEditedEntryId
        )
    }

    private fun filterEntries(entries: List<VaultEntry>, query: String): List<VaultEntry> {
        val lowered = query.lowercase()
        return entries.filter { entry ->
            sequenceOf(
                entry.title,
                entry.username,
                entry.notes,
                entry.url
            ).filterNotNull().any { candidate ->
                candidate.contains(lowered, ignoreCase = true)
            }
        }
    }
}

data class VaultEntriesUiState(
    val entries: List<VaultEntry> = emptyList(),
    val groups: List<VaultGroup> = emptyList(),
    val query: String = "",
    val lastEditedEntryId: String? = null
)
