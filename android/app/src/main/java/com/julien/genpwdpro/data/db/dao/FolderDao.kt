package com.julien.genpwdpro.data.db.dao

import androidx.room.*
import com.julien.genpwdpro.data.db.entity.FolderEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour les dossiers de vault
 */
@Dao
interface FolderDao {

    /**
     * Récupère tous les dossiers d'un vault
     */
    @Query("SELECT * FROM folders WHERE vaultId = :vaultId ORDER BY sortOrder ASC, name ASC")
    fun getFoldersByVault(vaultId: String): Flow<List<FolderEntity>>

    /**
     * Récupère les dossiers racine (sans parent)
     */
    @Query(
        "SELECT * FROM folders WHERE vaultId = :vaultId AND parentFolderId IS NULL ORDER BY sortOrder ASC, name ASC"
    )
    fun getRootFolders(vaultId: String): Flow<List<FolderEntity>>

    /**
     * Récupère les sous-dossiers d'un dossier
     */
    @Query(
        "SELECT * FROM folders WHERE parentFolderId = :parentId ORDER BY sortOrder ASC, name ASC"
    )
    fun getSubFolders(parentId: String): Flow<List<FolderEntity>>

    /**
     * Récupère un dossier par ID
     */
    @Query("SELECT * FROM folders WHERE id = :id")
    suspend fun getById(id: String): FolderEntity?

    /**
     * Récupère un dossier par ID (Flow)
     */
    @Query("SELECT * FROM folders WHERE id = :id")
    fun getByIdFlow(id: String): Flow<FolderEntity?>

    /**
     * Recherche des dossiers par nom
     */
    @Query(
        "SELECT * FROM folders WHERE vaultId = :vaultId AND name LIKE '%' || :query || '%' ORDER BY name ASC"
    )
    fun searchFolders(vaultId: String, query: String): Flow<List<FolderEntity>>

    /**
     * Insère un dossier
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(folder: FolderEntity)

    /**
     * Insère plusieurs dossiers
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(folders: List<FolderEntity>)

    /**
     * Met à jour un dossier
     */
    @Update
    suspend fun update(folder: FolderEntity)

    /**
     * Supprime un dossier
     */
    @Delete
    suspend fun delete(folder: FolderEntity)

    /**
     * Supprime un dossier par ID
     */
    @Query("DELETE FROM folders WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Supprime tous les dossiers d'un vault
     */
    @Query("DELETE FROM folders WHERE vaultId = :vaultId")
    suspend fun deleteAllByVault(vaultId: String)

    /**
     * Met à jour le parent d'un dossier
     */
    @Query("UPDATE folders SET parentFolderId = :parentId, modifiedAt = :timestamp WHERE id = :id")
    suspend fun updateParent(
        id: String,
        parentId: String?,
        timestamp: Long = System.currentTimeMillis()
    )

    /**
     * Met à jour l'ordre de tri
     */
    @Query("UPDATE folders SET sortOrder = :order WHERE id = :id")
    suspend fun updateSortOrder(id: String, order: Int)

    /**
     * Compte le nombre de dossiers dans un vault
     */
    @Query("SELECT COUNT(*) FROM folders WHERE vaultId = :vaultId")
    suspend fun getCountByVault(vaultId: String): Int

    /**
     * Compte le nombre de sous-dossiers
     */
    @Query("SELECT COUNT(*) FROM folders WHERE parentFolderId = :parentId")
    suspend fun getSubFolderCount(parentId: String): Int

    /**
     * Vérifie si un nom de dossier existe déjà dans le même parent
     */
    @Query(
        """
        SELECT COUNT(*) FROM folders
        WHERE vaultId = :vaultId
        AND name = :name
        AND COALESCE(parentFolderId, '') = COALESCE(:parentId, '')
        AND id != :excludeId
    """
    )
    suspend fun countByName(
        vaultId: String,
        name: String,
        parentId: String?,
        excludeId: String = ""
    ): Int
}
