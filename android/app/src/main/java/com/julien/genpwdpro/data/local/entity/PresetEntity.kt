package com.julien.genpwdpro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.julien.genpwdpro.data.models.GenerationMode
import java.util.UUID

/**
 * Entité représentant un preset de génération de mot de passe
 * Stocké dans un vault spécifique et chiffré
 *
 * Limites:
 * - 1 preset par défaut non modifiable
 * - Maximum 3 presets personnalisés par mode (SYLLABLES, PASSPHRASE)
 * - Presets LEET et CUSTOM_PHRASE non supportés pour simplification
 */
@Entity(
    tableName = "presets",
    foreignKeys = [
        ForeignKey(
            entity = VaultEntity::class,
            parentColumns = ["id"],
            childColumns = ["vaultId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("vaultId"),
        Index("generationMode"),
        Index("isDefault")
    ]
)
data class PresetEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault auquel appartient ce preset */
    val vaultId: String,

    /** Nom du preset (chiffré) */
    val encryptedName: String,
    val nameIv: String,

    /** Icône emoji (non chiffré pour affichage rapide) */
    val icon: String = "🔐",

    /** Mode de génération (SYLLABLES ou PASSPHRASE uniquement) */
    val generationMode: String, // GenerationMode.name

    /** Paramètres de génération chiffrés (JSON de Settings) */
    val encryptedSettings: String,
    val settingsIv: String,

    /** Preset par défaut (un seul par vault) */
    val isDefault: Boolean = false,

    /** Preset système non modifiable */
    val isSystemPreset: Boolean = false,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis(),

    /** Date de dernière utilisation (timestamp) */
    val lastUsedAt: Long? = null,

    /** Nombre d'utilisations */
    val usageCount: Int = 0
)
