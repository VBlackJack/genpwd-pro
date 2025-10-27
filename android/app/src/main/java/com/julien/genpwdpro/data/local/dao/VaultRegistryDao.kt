package com.julien.genpwdpro.data.local.dao

import androidx.room.*
import com.julien.genpwdpro.data.local.entity.VaultRegistryEntry
import kotlinx.coroutines.flow.Flow

/**
 * DAO for vault registry operations
 * Manages vault file (.gpv) metadata and statistics
 */
@Dao
interface VaultRegistryDao {

    /**
     * Get all vault registry entries ordered by last accessed
     */
    @Query("SELECT * FROM vault_registry ORDER BY lastAccessed DESC")
    fun getAllVaultRegistries(): Flow<List<VaultRegistryEntry>>

    /**
     * Get all vault registry entries (suspend)
     */
    @Query("SELECT * FROM vault_registry ORDER BY lastAccessed DESC")
    suspend fun getAllVaultRegistriesSync(): List<VaultRegistryEntry>

    /**
     * Get a vault registry entry by ID
     */
    @Query("SELECT * FROM vault_registry WHERE id = :id")
    suspend fun getById(id: String): VaultRegistryEntry?

    /**
     * Get a vault registry entry by ID (Flow)
     */
    @Query("SELECT * FROM vault_registry WHERE id = :id")
    fun getByIdFlow(id: String): Flow<VaultRegistryEntry?>

    /**
     * Get a vault registry entry by file path
     */
    @Query("SELECT * FROM vault_registry WHERE filePath = :filePath")
    suspend fun getByFilePath(filePath: String): VaultRegistryEntry?

    /**
     * Get the default vault registry entry
     */
    @Query("SELECT * FROM vault_registry WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefaultVaultRegistry(): VaultRegistryEntry?

    /**
     * Get the default vault registry entry (Flow)
     */
    @Query("SELECT * FROM vault_registry WHERE isDefault = 1 LIMIT 1")
    fun getDefaultVaultRegistryFlow(): Flow<VaultRegistryEntry?>

    /**
     * Get all loaded vaults
     */
    @Query("SELECT * FROM vault_registry WHERE isLoaded = 1")
    fun getLoadedVaults(): Flow<List<VaultRegistryEntry>>

    /**
     * Search vault registries by name
     */
    @Query("SELECT * FROM vault_registry WHERE name LIKE '%' || :query || '%' ORDER BY lastAccessed DESC")
    fun searchVaultRegistries(query: String): Flow<List<VaultRegistryEntry>>

    /**
     * Insert a vault registry entry
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: VaultRegistryEntry)

    /**
     * Insert multiple vault registry entries
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<VaultRegistryEntry>)

    /**
     * Update a vault registry entry
     */
    @Update
    suspend fun update(entry: VaultRegistryEntry)

    /**
     * Delete a vault registry entry
     */
    @Delete
    suspend fun delete(entry: VaultRegistryEntry)

    /**
     * Delete a vault registry entry by ID
     */
    @Query("DELETE FROM vault_registry WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Delete a vault registry entry by file path
     */
    @Query("DELETE FROM vault_registry WHERE filePath = :filePath")
    suspend fun deleteByFilePath(filePath: String)

    /**
     * Update last accessed timestamp
     */
    @Query("UPDATE vault_registry SET lastAccessed = :timestamp WHERE id = :id")
    suspend fun updateLastAccessed(id: String, timestamp: Long = System.currentTimeMillis())

    /**
     * Update vault statistics
     */
    @Query("""
        UPDATE vault_registry
        SET entryCount = :entryCount,
            folderCount = :folderCount,
            presetCount = :presetCount,
            tagCount = :tagCount,
            totalSize = :totalSize
        WHERE id = :id
    """)
    suspend fun updateStatistics(
        id: String,
        entryCount: Int,
        folderCount: Int,
        presetCount: Int,
        tagCount: Int,
        totalSize: Long
    )

    /**
     * Update file size and last modified timestamp
     */
    @Query("UPDATE vault_registry SET fileSize = :fileSize, lastModified = :lastModified WHERE id = :id")
    suspend fun updateFileSizeAndModified(id: String, fileSize: Long, lastModified: Long)

    /**
     * Set loaded state for a vault
     */
    @Query("UPDATE vault_registry SET isLoaded = :isLoaded WHERE id = :id")
    suspend fun updateLoadedState(id: String, isLoaded: Boolean)

    /**
     * Set a vault as default (and unset all others)
     */
    @Transaction
    suspend fun setDefaultVault(id: String) {
        clearDefaultVaults()
        setVaultAsDefault(id)
    }

    /**
     * Clear all default vaults
     */
    @Query("UPDATE vault_registry SET isDefault = 0")
    suspend fun clearDefaultVaults()

    /**
     * Set a specific vault as default
     */
    @Query("UPDATE vault_registry SET isDefault = 1 WHERE id = :id")
    suspend fun setVaultAsDefault(id: String)

    /**
     * Get count of vault registries
     */
    @Query("SELECT COUNT(*) FROM vault_registry")
    suspend fun getCount(): Int

    /**
     * Check if a vault name already exists (excluding a specific ID)
     */
    @Query("SELECT COUNT(*) FROM vault_registry WHERE name = :name AND id != :excludeId")
    suspend fun countByName(name: String, excludeId: String = ""): Int

    /**
     * Get total size of all vaults
     */
    @Query("SELECT SUM(totalSize) FROM vault_registry")
    suspend fun getTotalVaultSize(): Long?

    /**
     * Get vaults by storage strategy
     */
    @Query("SELECT * FROM vault_registry WHERE storageStrategy = :strategy ORDER BY lastAccessed DESC")
    fun getVaultsByStorageStrategy(strategy: String): Flow<List<VaultRegistryEntry>>
}
