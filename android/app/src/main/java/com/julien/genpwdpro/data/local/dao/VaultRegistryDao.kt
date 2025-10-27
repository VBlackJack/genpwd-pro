package com.julien.genpwdpro.data.local.dao

import androidx.room.*
import com.julien.genpwdpro.data.local.entity.VaultRegistryEntry
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour le registre des vaults
 */
@Dao
interface VaultRegistryDao {

    /**
     * Récupère tous les vaults du registre
     */
    @Query("SELECT * FROM vault_registry ORDER BY isDefault DESC, name ASC")
    fun getAllVaults(): Flow<List<VaultRegistryEntry>>

    /**
     * Récupère un vault par ID
     */
    @Query("SELECT * FROM vault_registry WHERE id = :vaultId")
    suspend fun getById(vaultId: String): VaultRegistryEntry?

    /**
     * Récupère le vault par défaut
     */
    @Query("SELECT * FROM vault_registry WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefaultVault(): VaultRegistryEntry?

    /**
     * Récupère les vaults chargés en mémoire
     */
    @Query("SELECT * FROM vault_registry WHERE isLoaded = 1")
    fun getLoadedVaults(): Flow<List<VaultRegistryEntry>>

    /**
     * Insère un nouveau vault
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(vault: VaultRegistryEntry)

    /**
     * Met à jour un vault
     */
    @Update
    suspend fun update(vault: VaultRegistryEntry)

    /**
     * Supprime un vault
     */
    @Delete
    suspend fun delete(vault: VaultRegistryEntry)

    /**
     * Supprime un vault par ID
     */
    @Query("DELETE FROM vault_registry WHERE id = :vaultId")
    suspend fun deleteById(vaultId: String)

    /**
     * Définit un vault comme défaut
     * Reset tous les autres vaults
     */
    @Transaction
    suspend fun setAsDefault(vaultId: String) {
        // Reset all defaults
        resetAllDefaults()
        // Set new default
        updateDefaultStatus(vaultId, true)
    }

    @Query("UPDATE vault_registry SET isDefault = 0")
    suspend fun resetAllDefaults()

    @Query("UPDATE vault_registry SET isDefault = :isDefault WHERE id = :vaultId")
    suspend fun updateDefaultStatus(vaultId: String, isDefault: Boolean)

    /**
     * Met à jour le statut de chargement
     */
    @Query("UPDATE vault_registry SET isLoaded = :isLoaded WHERE id = :vaultId")
    suspend fun updateLoadedStatus(vaultId: String, isLoaded: Boolean)

    /**
     * Met à jour le timestamp de dernier accès
     */
    @Query("UPDATE vault_registry SET lastAccessed = :timestamp WHERE id = :vaultId")
    suspend fun updateLastAccessed(vaultId: String, timestamp: Long)

    /**
     * Met à jour la taille du fichier
     */
    @Query("UPDATE vault_registry SET fileSize = :size, lastModified = :timestamp WHERE id = :vaultId")
    suspend fun updateFileInfo(vaultId: String, size: Long, timestamp: Long)

    /**
     * Compte le nombre de vaults
     */
    @Query("SELECT COUNT(*) FROM vault_registry")
    suspend fun count(): Int
}
