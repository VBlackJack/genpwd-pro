package com.julien.genpwdpro.vault.domain

/**
 * Abstraction over the persistence layer for vault entries and groups.
 */
interface VaultRepository {
    fun getEntries(): List<VaultEntry>
    fun getEntryById(id: String): VaultEntry?
    fun saveEntry(entry: VaultEntry): VaultEntry
    fun deleteEntry(id: String): Boolean

    fun getGroups(): List<VaultGroup>
    fun getGroupById(id: String): VaultGroup?
    fun saveGroup(group: VaultGroup): VaultGroup
    fun deleteGroup(id: String): Boolean
}

/**
 * In-memory implementation useful for tests and previews.
 */
class InMemoryVaultRepository : VaultRepository {
    private val entries = LinkedHashMap<String, VaultEntry>()
    private val groups = LinkedHashMap<String, VaultGroup>()

    override fun getEntries(): List<VaultEntry> = entries.values.map { it.copy() }

    override fun getEntryById(id: String): VaultEntry? = entries[id]?.copy()

    override fun saveEntry(entry: VaultEntry): VaultEntry {
        val groupId = entry.groupId
        if (groupId != null) {
            require(groups.containsKey(groupId)) {
                "Cannot assign entry to missing group $groupId"
            }
        }
        entries[entry.id] = entry
        return entry
    }

    override fun deleteEntry(id: String): Boolean = entries.remove(id) != null

    override fun getGroups(): List<VaultGroup> = groups.values.map { it.copy() }

    override fun getGroupById(id: String): VaultGroup? = groups[id]?.copy()

    override fun saveGroup(group: VaultGroup): VaultGroup {
        val parentId = group.parentGroupId
        if (parentId != null) {
            require(groups.containsKey(parentId)) {
                "Cannot assign group to missing parent $parentId"
            }
        }
        groups[group.id] = group
        return group
    }

    override fun deleteGroup(id: String): Boolean {
        val removed = groups.remove(id) != null
        if (removed) {
            entries
                .filterValues { it.groupId == id }
                .forEach { (key, entry) ->
                    entries[key] = entry.copy(groupId = null)
                }
        }
        return removed
    }
}
