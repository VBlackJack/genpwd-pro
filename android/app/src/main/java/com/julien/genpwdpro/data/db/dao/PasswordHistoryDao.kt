package com.julien.genpwdpro.data.db.dao

import androidx.room.*
import com.julien.genpwdpro.data.db.entity.PasswordHistoryEntity
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
    @Query(
        "SELECT * FROM password_history WHERE password LIKE '%' || :query || '%' ORDER BY timestamp DESC"
    )
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
    @Query(
        "DELETE FROM password_history WHERE id IN (SELECT id FROM password_history ORDER BY timestamp ASC LIMIT :count)"
    )
    suspend fun deleteOldest(count: Int)

    /**
     * Récupère uniquement les favoris
     */
    @Query("SELECT * FROM password_history WHERE isFavorite = 1 ORDER BY timestamp DESC")
    fun getFavorites(): Flow<List<PasswordHistoryEntity>>

    /**
     * Marque/démarque comme favori
     */
    @Query("UPDATE password_history SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun updateFavoriteStatus(id: String, isFavorite: Boolean)

    /**
     * Met à jour la note
     */
    @Query("UPDATE password_history SET note = :note WHERE id = :id")
    suspend fun updateNote(id: String, note: String)

    /**
     * Recherche avancée avec filtres
     */
    @Query(
        """
        SELECT * FROM password_history
        WHERE (:query = '' OR password LIKE '%' || :query || '%' OR note LIKE '%' || :query || '%')
        AND (:favoritesOnly = 0 OR isFavorite = 1)
        AND (:modeFilter = '' OR mode = :modeFilter)
        ORDER BY
            CASE WHEN :sortByFavorites = 1 THEN isFavorite END DESC,
            timestamp DESC
    """
    )
    fun searchWithFilters(
        query: String = "",
        favoritesOnly: Boolean = false,
        modeFilter: String = "",
        sortByFavorites: Boolean = true
    ): Flow<List<PasswordHistoryEntity>>

    /**
     * Compte le nombre de favoris
     */
    @Query("SELECT COUNT(*) FROM password_history WHERE isFavorite = 1")
    suspend fun getFavoritesCount(): Int
}
