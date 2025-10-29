package com.julien.genpwdpro.data.db.dao

import androidx.room.*
import com.julien.genpwdpro.data.db.entity.EntryTagCrossRef
import com.julien.genpwdpro.data.db.entity.TagEntity
import com.julien.genpwdpro.data.db.entity.VaultEntryEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO pour les tags
 */
@Dao
interface TagDao {

    /**
     * Récupère tous les tags d'un vault
     */
    @Query("SELECT * FROM tags WHERE vaultId = :vaultId ORDER BY name ASC")
    fun getTagsByVault(vaultId: String): Flow<List<TagEntity>>

    /**
     * Récupère un tag par ID
     */
    @Query("SELECT * FROM tags WHERE id = :id")
    suspend fun getById(id: String): TagEntity?

    /**
     * Récupère un tag par nom
     */
    @Query("SELECT * FROM tags WHERE vaultId = :vaultId AND name = :name")
    suspend fun getByName(vaultId: String, name: String): TagEntity?

    /**
     * Recherche des tags par nom
     */
    @Query("SELECT * FROM tags WHERE vaultId = :vaultId AND name LIKE '%' || :query || '%' ORDER BY name ASC")
    fun searchTags(vaultId: String, query: String): Flow<List<TagEntity>>

    /**
     * Récupère les tags d'une entrée
     */
    @Query("""
        SELECT tags.* FROM tags
        INNER JOIN entry_tag_cross_ref ON tags.id = entry_tag_cross_ref.tagId
        WHERE entry_tag_cross_ref.entryId = :entryId
        ORDER BY tags.name ASC
    """)
    fun getTagsForEntry(entryId: String): Flow<List<TagEntity>>

    /**
     * Récupère les entrées avec un tag spécifique
     */
    @Query("""
        SELECT vault_entries.* FROM vault_entries
        INNER JOIN entry_tag_cross_ref ON vault_entries.id = entry_tag_cross_ref.entryId
        WHERE entry_tag_cross_ref.tagId = :tagId
        ORDER BY vault_entries.modifiedAt DESC
    """)
    fun getEntriesWithTag(tagId: String): Flow<List<VaultEntryEntity>>

    /**
     * Récupère les tags populaires (les plus utilisés)
     */
    @Query("""
        SELECT tags.*, COUNT(entry_tag_cross_ref.entryId) as usage_count
        FROM tags
        LEFT JOIN entry_tag_cross_ref ON tags.id = entry_tag_cross_ref.tagId
        WHERE tags.vaultId = :vaultId
        GROUP BY tags.id
        ORDER BY usage_count DESC, tags.name ASC
        LIMIT :limit
    """)
    fun getPopularTags(vaultId: String, limit: Int = 10): Flow<List<TagEntity>>

    /**
     * Insère un tag
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(tag: TagEntity): Long

    /**
     * Insère plusieurs tags
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tags: List<TagEntity>)

    /**
     * Met à jour un tag
     */
    @Update
    suspend fun update(tag: TagEntity)

    /**
     * Supprime un tag
     */
    @Delete
    suspend fun delete(tag: TagEntity)

    /**
     * Supprime un tag par ID
     */
    @Query("DELETE FROM tags WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Supprime tous les tags d'un vault
     */
    @Query("DELETE FROM tags WHERE vaultId = :vaultId")
    suspend fun deleteAllByVault(vaultId: String)

    /**
     * Ajoute un tag à une entrée
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun addTagToEntry(crossRef: EntryTagCrossRef)

    /**
     * Retire un tag d'une entrée
     */
    @Delete
    suspend fun removeTagFromEntry(crossRef: EntryTagCrossRef)

    /**
     * Retire tous les tags d'une entrée
     */
    @Query("DELETE FROM entry_tag_cross_ref WHERE entryId = :entryId")
    suspend fun removeAllTagsFromEntry(entryId: String)

    /**
     * Retire toutes les entrées d'un tag
     */
    @Query("DELETE FROM entry_tag_cross_ref WHERE tagId = :tagId")
    suspend fun removeAllEntriesFromTag(tagId: String)

    /**
     * Compte le nombre de tags dans un vault
     */
    @Query("SELECT COUNT(*) FROM tags WHERE vaultId = :vaultId")
    suspend fun getCountByVault(vaultId: String): Int

    /**
     * Compte le nombre d'entrées avec un tag
     */
    @Query("SELECT COUNT(*) FROM entry_tag_cross_ref WHERE tagId = :tagId")
    suspend fun getEntryCountForTag(tagId: String): Int

    /**
     * Compte le nombre de tags pour une entrée
     */
    @Query("SELECT COUNT(*) FROM entry_tag_cross_ref WHERE entryId = :entryId")
    suspend fun getTagCountForEntry(entryId: String): Int

    /**
     * Vérifie si un nom de tag existe déjà
     */
    @Query("SELECT COUNT(*) FROM tags WHERE vaultId = :vaultId AND name = :name AND id != :excludeId")
    suspend fun countByName(vaultId: String, name: String, excludeId: String = ""): Int
}
