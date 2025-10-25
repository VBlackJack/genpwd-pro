package com.julien.genpwdpro.data.local.dao

import androidx.room.*
import com.julien.genpwdpro.data.local.entity.PasswordHistoryEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour l'historique des mots de passe
 */
@Dao
interface PasswordHistoryDao {

    /**
     * Récupère tout l'historique trié par date (plus récent en premier)
     */
    @Query("SELECT * FROM password_history ORDER BY timestamp DESC")
    fun getAllHistory(): Flow<List<PasswordHistoryEntity>>

    /**
     * Récupère l'historique avec limite
     */
    @Query("SELECT * FROM password_history ORDER BY timestamp DESC LIMIT :limit")
    fun getHistoryWithLimit(limit: Int = 100): Flow<List<PasswordHistoryEntity>>

    /**
     * Récupère un mot de passe par ID
     */
    @Query("SELECT * FROM password_history WHERE id = :id")
    suspend fun getById(id: String): PasswordHistoryEntity?

    /**
     * Recherche dans l'historique
     */
    @Query("SELECT * FROM password_history WHERE password LIKE '%' || :query || '%' ORDER BY timestamp DESC")
    fun searchHistory(query: String): Flow<List<PasswordHistoryEntity>>

    /**
     * Insère un mot de passe dans l'historique
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(password: PasswordHistoryEntity)

    /**
     * Insère plusieurs mots de passe
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(passwords: List<PasswordHistoryEntity>)

    /**
     * Supprime un mot de passe
     */
    @Delete
    suspend fun delete(password: PasswordHistoryEntity)

    /**
     * Supprime par ID
     */
    @Query("DELETE FROM password_history WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Supprime tout l'historique
     */
    @Query("DELETE FROM password_history")
    suspend fun deleteAll()

    /**
     * Compte le nombre d'entrées
     */
    @Query("SELECT COUNT(*) FROM password_history")
    suspend fun getCount(): Int

    /**
     * Supprime les entrées les plus anciennes si dépassement de la limite
     */
    @Query("DELETE FROM password_history WHERE id IN (SELECT id FROM password_history ORDER BY timestamp ASC LIMIT :count)")
    suspend fun deleteOldest(count: Int)
}
