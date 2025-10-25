package com.julien.genpwdpro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Entité représentant un dossier pour organiser les entrées
 * Support de la hiérarchie (dossiers parent/enfant)
 */
@Entity(
    tableName = "folders",
    foreignKeys = [
        ForeignKey(
            entity = VaultEntity::class,
            parentColumns = ["id"],
            childColumns = ["vaultId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FolderEntity::class,
            parentColumns = ["id"],
            childColumns = ["parentFolderId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["vaultId"]),
        Index(value = ["parentFolderId"]),
        Index(value = ["name"])
    ]
)
data class FolderEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** ID du dossier parent (null si racine) */
    val parentFolderId: String? = null,

    /** Nom du dossier */
    val name: String,

    /** Icône du dossier (emoji ou nom d'icône) */
    val icon: String = "📁",

    /** Couleur du dossier (hex string) */
    val color: String? = null,

    /** Ordre d'affichage */
    val sortOrder: Int = 0,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis()
)
