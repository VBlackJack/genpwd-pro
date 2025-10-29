package com.julien.genpwdpro.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Entité représentant un tag pour catégoriser les entrées
 */
@Entity(
    tableName = "tags",
    foreignKeys = [
        ForeignKey(
            entity = VaultEntity::class,
            parentColumns = ["id"],
            childColumns = ["vaultId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["vaultId"]),
        Index(value = ["name"], unique = true)
    ]
)
data class TagEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** Nom du tag (unique par vault) */
    val name: String,

    /** Couleur du tag (hex string) */
    val color: String,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Table de jonction pour la relation many-to-many entre entries et tags
 */
@Entity(
    tableName = "entry_tag_cross_ref",
    primaryKeys = ["entryId", "tagId"],
    foreignKeys = [
        ForeignKey(
            entity = VaultEntryEntity::class,
            parentColumns = ["id"],
            childColumns = ["entryId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = TagEntity::class,
            parentColumns = ["id"],
            childColumns = ["tagId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["entryId"]),
        Index(value = ["tagId"])
    ]
)
data class EntryTagCrossRef(
    val entryId: String,
    val tagId: String
)
