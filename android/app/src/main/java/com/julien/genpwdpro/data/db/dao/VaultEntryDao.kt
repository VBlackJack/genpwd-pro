package com.julien.genpwdpro.data.db.dao

import androidx.room.*
import com.julien.genpwdpro.data.db.entity.VaultEntryEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour les entrées de vault (mots de passe, notes, etc.)
 */
@Dao
interface VaultEntryDao {

    /**
     * Récupère toutes les entrées d'un vault
     */
    @Query("SELECT * FROM vault_entries WHERE vaultId = :vaultId ORDER BY modifiedAt DESC")
    fun getEntriesByVault(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées d'un dossier
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND folderId = :folderId ORDER BY modifiedAt DESC"
    )
    fun getEntriesByFolder(vaultId: String, folderId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées sans dossier (racine)
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND folderId IS NULL ORDER BY modifiedAt DESC"
    )
    fun getEntriesWithoutFolder(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les favoris d'un vault
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND isFavorite = 1 ORDER BY modifiedAt DESC"
    )
    fun getFavorites(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère une entrée par ID
     */
    @Query("SELECT * FROM vault_entries WHERE id = :id")
    suspend fun getById(id: String): VaultEntryEntity?

    /**
     * Récupère une entrée par ID (Flow)
     */
    @Query("SELECT * FROM vault_entries WHERE id = :id")
    fun getByIdFlow(id: String): Flow<VaultEntryEntity?>

    /**
     * Recherche dans les entrées (note: les champs sont chiffrés, donc recherche limitée aux métadonnées)
     */
    @Query(
        """
        SELECT * FROM vault_entries
        WHERE vaultId = :vaultId
        AND (
            totpIssuer LIKE '%' || :query || '%'
            OR passkeyRpName LIKE '%' || :query || '%'
        )
        ORDER BY modifiedAt DESC
    """
    )
    fun searchEntries(vaultId: String, query: String): Flow<List<VaultEntryEntity>>

    /**
     * Recherche avancée avec filtres
     */
    @Query(
        """
        SELECT * FROM vault_entries
        WHERE vaultId = :vaultId
        AND (:folderId = '' OR folderId = :folderId)
        AND (:entryType = '' OR entryType = :entryType)
        AND (:favoritesOnly = 0 OR isFavorite = 1)
        AND (:hasTOTP = 0 OR hasTOTP = 1)
        AND (:hasPasskey = 0 OR hasPasskey = 1)
        ORDER BY
            CASE WHEN :sortByFavorites = 1 THEN isFavorite END DESC,
            CASE WHEN :sortBy = 'modified' THEN modifiedAt END DESC,
            CASE WHEN :sortBy = 'created' THEN createdAt END DESC,
            CASE WHEN :sortBy = 'accessed' THEN lastAccessedAt END DESC,
            CASE WHEN :sortBy = 'strength' THEN passwordStrength END DESC,
            modifiedAt DESC
    """
    )
    fun searchWithFilters(
        vaultId: String,
        folderId: String = "",
        entryType: String = "",
        favoritesOnly: Boolean = false,
        hasTOTP: Boolean = false,
        hasPasskey: Boolean = false,
        sortBy: String = "modified",
        sortByFavorites: Boolean = true
    ): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées avec TOTP
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND hasTOTP = 1 ORDER BY totpIssuer ASC"
    )
    fun getEntriesWithTOTP(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées avec Passkey
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND hasPasskey = 1 ORDER BY passkeyRpName ASC"
    )
    fun getEntriesWithPasskey(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées nécessitant un changement de mot de passe
     */
    @Query(
        """
        SELECT * FROM vault_entries
        WHERE vaultId = :vaultId AND requiresPasswordChange = 1
        ORDER BY modifiedAt DESC
        """
    )
    fun getEntriesRequiringPasswordChange(vaultId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées avec mot de passe expiré
     */
    @Query(
        """
        SELECT * FROM vault_entries
        WHERE vaultId = :vaultId
        AND passwordExpiresAt > 0
        AND passwordExpiresAt < :now
        ORDER BY passwordExpiresAt ASC
        """
    )
    fun getEntriesWithExpiredPassword(vaultId: String, now: Long = System.currentTimeMillis()): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les entrées avec mot de passe faible
     */
    @Query(
        "SELECT * FROM vault_entries WHERE vaultId = :vaultId AND passwordStrength < :threshold ORDER BY passwordStrength ASC"
    )
    fun getEntriesWithWeakPassword(vaultId: String, threshold: Int = 50): Flow<List<VaultEntryEntity>>

    /**
     * Insère une entrée
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: VaultEntryEntity)

    /**
     * Insère plusieurs entrées
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<VaultEntryEntity>)

    /**
     * Met à jour une entrée
     */
    @Update
    suspend fun update(entry: VaultEntryEntity)

    /**
     * Supprime une entrée
     */
    @Delete
    suspend fun delete(entry: VaultEntryEntity)

    /**
     * Supprime une entrée par ID
     */
    @Query("DELETE FROM vault_entries WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Supprime toutes les entrées d'un vault
     */
    @Query("DELETE FROM vault_entries WHERE vaultId = :vaultId")
    suspend fun deleteAllByVault(vaultId: String)

    /**
     * Met à jour le statut favori
     */
    @Query("UPDATE vault_entries SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun updateFavoriteStatus(id: String, isFavorite: Boolean)

    /**
     * Met à jour la date de dernier accès
     */
    @Query(
        "UPDATE vault_entries SET lastAccessedAt = :timestamp, usageCount = usageCount + 1 WHERE id = :id"
    )
    suspend fun updateLastAccessedAt(id: String, timestamp: Long = System.currentTimeMillis())

    /**
     * Met à jour la date de dernière modification
     */
    @Query("UPDATE vault_entries SET modifiedAt = :timestamp WHERE id = :id")
    suspend fun updateModifiedAt(id: String, timestamp: Long = System.currentTimeMillis())

    /**
     * Déplace une entrée vers un dossier
     */
    @Query("UPDATE vault_entries SET folderId = :folderId, modifiedAt = :timestamp WHERE id = :id")
    suspend fun moveToFolder(
        id: String,
        folderId: String?,
        timestamp: Long = System.currentTimeMillis()
    )

    /**
     * Compte le nombre d'entrées dans un vault
     */
    @Query("SELECT COUNT(*) FROM vault_entries WHERE vaultId = :vaultId")
    suspend fun getCountByVault(vaultId: String): Int

    /**
     * Compte le nombre de favoris
     */
    @Query("SELECT COUNT(*) FROM vault_entries WHERE vaultId = :vaultId AND isFavorite = 1")
    suspend fun getFavoritesCount(vaultId: String): Int

    /**
     * Compte le nombre d'entrées dans un dossier
     */
    @Query("SELECT COUNT(*) FROM vault_entries WHERE folderId = :folderId")
    suspend fun getCountByFolder(folderId: String): Int

    /**
     * Récupère les statistiques de force de mots de passe
     */
    @Query(
        """
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN passwordStrength < 30 THEN 1 ELSE 0 END) as weak,
            SUM(CASE WHEN passwordStrength >= 30 AND passwordStrength < 70 THEN 1 ELSE 0 END) as medium,
            SUM(CASE WHEN passwordStrength >= 70 THEN 1 ELSE 0 END) as strong
        FROM vault_entries
        WHERE vaultId = :vaultId
    """
    )
    suspend fun getPasswordStrengthStats(vaultId: String): PasswordStrengthStats
}

/**
 * Statistiques de force des mots de passe
 */
data class PasswordStrengthStats(
    val total: Int,
    val weak: Int,
    val medium: Int,
    val strong: Int
)
