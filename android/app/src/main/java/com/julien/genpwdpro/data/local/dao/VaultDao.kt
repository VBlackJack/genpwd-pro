package com.julien.genpwdpro.data.local.dao

import androidx.room.*
import com.julien.genpwdpro.data.local.entity.VaultEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour les vaults (coffres-forts)
 */
@Dao
interface VaultDao {

    /**
     * Récupère tous les vaults triés par date de dernière utilisation
     */
    @Query("SELECT * FROM vaults ORDER BY lastAccessedAt DESC")
    fun getAllVaults(): Flow<List<VaultEntity>>

    /**
     * Récupère un vault par ID
     */
    @Query("SELECT * FROM vaults WHERE id = :id")
    suspend fun getById(id: String): VaultEntity?

    /**
     * Récupère un vault par ID (Flow)
     */
    @Query("SELECT * FROM vaults WHERE id = :id")
    fun getByIdFlow(id: String): Flow<VaultEntity?>

    /**
     * Récupère le vault par défaut
     */
    @Query("SELECT * FROM vaults WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefaultVault(): VaultEntity?

    /**
     * Récupère le vault par défaut (Flow)
     */
    @Query("SELECT * FROM vaults WHERE isDefault = 1 LIMIT 1")
    fun getDefaultVaultFlow(): Flow<VaultEntity?>

    /**
     * Recherche des vaults par nom
     */
    @Query("SELECT * FROM vaults WHERE name LIKE '%' || :query || '%' ORDER BY lastAccessedAt DESC")
    fun searchVaults(query: String): Flow<List<VaultEntity>>

    /**
     * Insère un vault
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(vault: VaultEntity)

    /**
     * Met à jour un vault
     */
    @Update
    suspend fun update(vault: VaultEntity)

    /**
     * Supprime un vault
     */
    @Delete
    suspend fun delete(vault: VaultEntity)

    /**
     * Supprime un vault par ID
     */
    @Query("DELETE FROM vaults WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Met à jour la date de dernier accès
     */
    @Query("UPDATE vaults SET lastAccessedAt = :timestamp WHERE id = :id")
    suspend fun updateLastAccessedAt(id: String, timestamp: Long = System.currentTimeMillis())

    /**
     * Met à jour le nombre d'entrées
     */
    @Query("UPDATE vaults SET entryCount = :count WHERE id = :id")
    suspend fun updateEntryCount(id: String, count: Int)

    /**
     * Définit un vault comme par défaut (et désactive les autres)
     */
    @Transaction
    suspend fun setDefaultVault(id: String) {
        clearDefaultVaults()
        setVaultAsDefault(id)
    }

    /**
     * Désactive tous les vaults par défaut
     */
    @Query("UPDATE vaults SET isDefault = 0")
    suspend fun clearDefaultVaults()

    /**
     * Définit un vault comme par défaut
     */
    @Query("UPDATE vaults SET isDefault = 1 WHERE id = :id")
    suspend fun setVaultAsDefault(id: String)

    /**
     * Met à jour les paramètres de verrouillage biométrique
     */
    @Query("UPDATE vaults SET biometricUnlockEnabled = :enabled WHERE id = :id")
    suspend fun updateBiometricUnlock(id: String, enabled: Boolean)

    /**
     * Met à jour le timeout de verrouillage automatique
     */
    @Query("UPDATE vaults SET autoLockTimeout = :timeout WHERE id = :id")
    suspend fun updateAutoLockTimeout(id: String, timeout: Int)

    /**
     * Compte le nombre de vaults
     */
    @Query("SELECT COUNT(*) FROM vaults")
    suspend fun getCount(): Int

    /**
     * Vérifie si un nom de vault existe déjà
     */
    @Query("SELECT COUNT(*) FROM vaults WHERE name = :name AND id != :excludeId")
    suspend fun countByName(name: String, excludeId: String = ""): Int
}
