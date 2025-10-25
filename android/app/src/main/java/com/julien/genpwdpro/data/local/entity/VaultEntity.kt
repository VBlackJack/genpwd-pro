package com.julien.genpwdpro.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Entité représentant un coffre-fort (vault)
 * Un utilisateur peut avoir plusieurs vaults avec des master passwords différents
 */
@Entity(tableName = "vaults")
data class VaultEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** Nom du vault */
    val name: String,

    /** Description optionnelle */
    val description: String = "",

    /** Hash du master password (Argon2id) */
    val masterPasswordHash: String,

    /** Salt utilisé pour le hash (hex string) */
    val salt: String,

    /** Clé de chiffrement dérivée, chiffrée avec le master password (hex string) */
    val encryptedKey: String,

    /** IV utilisé pour chiffrer la clé (hex string) */
    val keyIv: String,

    /** Nombre d'itérations Argon2id */
    val iterations: Int = 3,

    /** Mémoire en KB pour Argon2id */
    val memory: Int = 65536,

    /** Parallélisme pour Argon2id */
    val parallelism: Int = 4,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis(),

    /** Date de dernier accès (timestamp) */
    val lastAccessedAt: Long = System.currentTimeMillis(),

    /** Nombre total d'entrées dans le vault */
    val entryCount: Int = 0,

    /** Timeout de verrouillage automatique en minutes (0 = jamais) */
    val autoLockTimeout: Int = 5,

    /** Activer le déverrouillage biométrique */
    val biometricUnlockEnabled: Boolean = false,

    /** Vault par défaut */
    val isDefault: Boolean = false,

    /** Icône du vault (nom d'icône ou emoji) */
    val icon: String = "🔐",

    /** Couleur du vault (hex string) */
    val color: String = "#1976D2"
)
