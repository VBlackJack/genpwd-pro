package com.julien.genpwdpro.data.db.dao

import androidx.room.*
import com.julien.genpwdpro.data.db.entity.PresetEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour la gestion des presets de génération
 */
@Dao
interface PresetDao {
    /**
     * Récupère tous les presets d'un vault
     */
    @Query(
        "SELECT * FROM presets WHERE vaultId = :vaultId ORDER BY isDefault DESC, lastUsedAt DESC, createdAt DESC"
    )
    fun getPresetsByVault(vaultId: String): Flow<List<PresetEntity>>

    /**
     * Récupère le preset par défaut d'un vault
     */
    @Query("SELECT * FROM presets WHERE vaultId = :vaultId AND isDefault = 1 LIMIT 1")
    suspend fun getDefaultPreset(vaultId: String): PresetEntity?

    /**
     * Récupère les presets par mode de génération
     */
    @Query(
        "SELECT * FROM presets WHERE vaultId = :vaultId AND generationMode = :mode ORDER BY createdAt DESC"
    )
    suspend fun getPresetsByMode(vaultId: String, mode: String): List<PresetEntity>

    /**
     * Compte le nombre de presets personnalisés pour un mode donné
     */
    @Query(
        "SELECT COUNT(*) FROM presets WHERE vaultId = :vaultId AND generationMode = :mode AND isSystemPreset = 0"
    )
    suspend fun countCustomPresetsByMode(vaultId: String, mode: String): Int

    /**
     * Récupère un preset par ID
     */
    @Query("SELECT * FROM presets WHERE id = :id")
    suspend fun getById(id: String): PresetEntity?

    /**
     * Insère un preset
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(preset: PresetEntity)

    /**
     * Met à jour un preset
     */
    @Update
    suspend fun update(preset: PresetEntity)

    /**
     * Supprime un preset
     */
    @Delete
    suspend fun delete(preset: PresetEntity)

    /**
     * Supprime un preset par ID (si non système)
     */
    @Query("DELETE FROM presets WHERE id = :id AND isSystemPreset = 0")
    suspend fun deleteById(id: String)

    /**
     * Désactive tous les presets par défaut d'un vault
     */
    @Query("UPDATE presets SET isDefault = 0 WHERE vaultId = :vaultId")
    suspend fun clearDefaultFlag(vaultId: String)

    /**
     * Met à jour les statistiques d'utilisation
     */
    @Query("UPDATE presets SET lastUsedAt = :timestamp, usageCount = usageCount + 1 WHERE id = :id")
    suspend fun recordUsage(id: String, timestamp: Long)

    /**
     * Supprime tous les presets d'un vault
     */
    @Query("DELETE FROM presets WHERE vaultId = :vaultId")
    suspend fun deleteAllByVault(vaultId: String)
}
