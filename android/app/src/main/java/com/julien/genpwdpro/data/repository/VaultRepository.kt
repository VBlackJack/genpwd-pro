package com.julien.genpwdpro.data.repository

import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.local.dao.*
import com.julien.genpwdpro.data.local.entity.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository pour la gestion des vaults et de leurs entrées
 *
 * Gère:
 * - Création et déverrouillage des vaults
 * - Chiffrement/déchiffrement des entrées
 * - CRUD sur les entrées, dossiers et tags
 * - Recherche et statistiques
 */
@Singleton
class VaultRepository @Inject constructor(
    private val vaultDao: VaultDao,
    private val entryDao: VaultEntryDao,
    private val folderDao: FolderDao,
    private val tagDao: TagDao,
    private val cryptoManager: VaultCryptoManager
) {

    /**
     * Clé de vault déverrouillée actuellement (en mémoire, jamais stockée)
     * Map: vaultId → SecretKey
     */
    private val unlockedKeys = mutableMapOf<String, SecretKey>()

    /**
     * Données d'une entrée déchiffrée
     */
    data class DecryptedEntry(
        val id: String,
        val vaultId: String,
        val folderId: String?,
        val title: String,
        val username: String,
        val password: String,
        val url: String,
        val notes: String,
        val customFields: String,
        val entryType: EntryType,
        val isFavorite: Boolean,
        val passwordStrength: Int,
        val passwordEntropy: Double,
        val generationMode: String?,
        val createdAt: Long,
        val modifiedAt: Long,
        val lastAccessedAt: Long,
        val passwordExpiresAt: Long,
        val requiresPasswordChange: Boolean,
        val usageCount: Int,
        val icon: String?,
        val color: String?,
        // TOTP
        val hasTOTP: Boolean,
        val totpSecret: String,
        val totpPeriod: Int,
        val totpDigits: Int,
        val totpAlgorithm: String,
        val totpIssuer: String,
        // Passkey
        val hasPasskey: Boolean,
        val passkeyData: String,
        val passkeyRpId: String,
        val passkeyRpName: String,
        val passkeyUserHandle: String,
        val passkeyCreatedAt: Long,
        val passkeyLastUsedAt: Long
    )

    // ========== Vault Management ==========

    /**
     * Crée un nouveau vault
     *
     * @param name Nom du vault
     * @param masterPassword Mot de passe maître
     * @param description Description optionnelle
     * @param setAsDefault Définir comme vault par défaut
     * @return ID du vault créé
     */
    suspend fun createVault(
        name: String,
        masterPassword: String,
        description: String = "",
        setAsDefault: Boolean = false
    ): String {
        // Vérifier si le nom existe déjà
        val existingCount = vaultDao.countByName(name)
        require(existingCount == 0) { "Un vault avec ce nom existe déjà" }

        // Créer le vault avec cryptographie
        val vaultResult = cryptoManager.createVault(
            masterPassword,
            VaultCryptoManager.Argon2Params()
        )

        val vaultId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val vault = VaultEntity(
            id = vaultId,
            name = name,
            description = description,
            masterPasswordHash = vaultResult.masterPasswordHash,
            salt = vaultResult.salt,
            encryptedKey = vaultResult.encryptedKey,
            keyIv = vaultResult.keyIv,
            createdAt = now,
            modifiedAt = now,
            lastAccessedAt = now,
            isDefault = setAsDefault
        )

        vaultDao.insert(vault)

        // Si défini comme par défaut, désactiver les autres
        if (setAsDefault) {
            vaultDao.setDefaultVault(vaultId)
        }

        // Stocker la clé déverrouillée en mémoire
        unlockedKeys[vaultId] = vaultResult.derivedKey

        return vaultId
    }

    /**
     * Déverrouille un vault
     *
     * @param vaultId ID du vault
     * @param masterPassword Mot de passe maître
     * @return true si déverrouillé avec succès
     */
    suspend fun unlockVault(vaultId: String, masterPassword: String): Boolean {
        val vault = vaultDao.getById(vaultId) ?: return false

        // Dériver la clé et déchiffrer la clé de vault
        val vaultKey = cryptoManager.unlockVault(
            masterPassword = masterPassword,
            salt = vault.salt,
            encryptedKey = vault.encryptedKey,
            keyIv = vault.keyIv,
            params = VaultCryptoManager.Argon2Params(
                iterations = vault.iterations,
                memory = vault.memory,
                parallelism = vault.parallelism
            )
        ) ?: return false

        // Stocker la clé en mémoire
        unlockedKeys[vaultId] = vaultKey

        // Mettre à jour la date de dernier accès
        vaultDao.updateLastAccessedAt(vaultId)

        return true
    }

    /**
     * Verrouille un vault (retire la clé de la mémoire)
     */
    fun lockVault(vaultId: String) {
        unlockedKeys[vaultId]?.let { key ->
            cryptoManager.wipeKey(key)
            unlockedKeys.remove(vaultId)
        }
    }

    /**
     * Verrouille tous les vaults
     */
    fun lockAllVaults() {
        unlockedKeys.keys.toList().forEach { lockVault(it) }
    }

    /**
     * Vérifie si un vault est déverrouillé
     */
    fun isVaultUnlocked(vaultId: String): Boolean {
        return unlockedKeys.containsKey(vaultId)
    }

    /**
     * Récupère la clé d'un vault déverrouillé
     */
    private fun getVaultKey(vaultId: String): SecretKey {
        return unlockedKeys[vaultId]
            ?: throw IllegalStateException("Vault $vaultId n'est pas déverrouillé")
    }

    /**
     * Récupère tous les vaults
     */
    fun getAllVaults(): Flow<List<VaultEntity>> {
        return vaultDao.getAllVaults()
    }

    /**
     * Récupère un vault par ID
     */
    suspend fun getVaultById(id: String): VaultEntity? {
        return vaultDao.getById(id)
    }

    /**
     * Récupère le vault par défaut
     */
    suspend fun getDefaultVault(): VaultEntity? {
        return vaultDao.getDefaultVault()
    }

    /**
     * Supprime un vault et toutes ses données
     */
    suspend fun deleteVault(vaultId: String) {
        lockVault(vaultId)
        vaultDao.deleteById(vaultId)
    }

    // ========== Entry Management ==========

    /**
     * Crée une nouvelle entrée chiffrée
     */
    suspend fun createEntry(
        vaultId: String,
        entry: DecryptedEntry
    ): String {
        val vaultKey = getVaultKey(vaultId)

        // Chiffrer tous les champs sensibles
        val titleIv = cryptoManager.generateIV()
        val usernameIv = cryptoManager.generateIV()
        val passwordIv = cryptoManager.generateIV()
        val urlIv = cryptoManager.generateIV()
        val notesIv = cryptoManager.generateIV()
        val customFieldsIv = cryptoManager.generateIV()
        val totpSecretIv = cryptoManager.generateIV()
        val passkeyDataIv = cryptoManager.generateIV()

        val entity = VaultEntryEntity(
            id = entry.id,
            vaultId = vaultId,
            folderId = entry.folderId,
            encryptedTitle = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.title, vaultKey, titleIv)
            ),
            titleIv = cryptoManager.bytesToHex(titleIv),
            encryptedUsername = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.username, vaultKey, usernameIv)
            ),
            usernameIv = cryptoManager.bytesToHex(usernameIv),
            encryptedPassword = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.password, vaultKey, passwordIv)
            ),
            passwordIv = cryptoManager.bytesToHex(passwordIv),
            encryptedUrl = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.url, vaultKey, urlIv)
            ),
            urlIv = cryptoManager.bytesToHex(urlIv),
            encryptedNotes = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.notes, vaultKey, notesIv)
            ),
            notesIv = cryptoManager.bytesToHex(notesIv),
            encryptedCustomFields = cryptoManager.bytesToHex(
                cryptoManager.encryptString(entry.customFields, vaultKey, customFieldsIv)
            ),
            customFieldsIv = cryptoManager.bytesToHex(customFieldsIv),
            entryType = entry.entryType.name,
            isFavorite = entry.isFavorite,
            passwordStrength = entry.passwordStrength,
            passwordEntropy = entry.passwordEntropy,
            generationMode = entry.generationMode,
            createdAt = entry.createdAt,
            modifiedAt = entry.modifiedAt,
            lastAccessedAt = entry.lastAccessedAt,
            passwordExpiresAt = entry.passwordExpiresAt,
            requiresPasswordChange = entry.requiresPasswordChange,
            usageCount = entry.usageCount,
            icon = entry.icon,
            color = entry.color,
            // TOTP
            hasTOTP = entry.hasTOTP,
            encryptedTotpSecret = if (entry.hasTOTP) {
                cryptoManager.bytesToHex(
                    cryptoManager.encryptString(entry.totpSecret, vaultKey, totpSecretIv)
                )
            } else "",
            totpSecretIv = if (entry.hasTOTP) cryptoManager.bytesToHex(totpSecretIv) else "",
            totpPeriod = entry.totpPeriod,
            totpDigits = entry.totpDigits,
            totpAlgorithm = entry.totpAlgorithm,
            totpIssuer = entry.totpIssuer,
            // Passkey
            hasPasskey = entry.hasPasskey,
            encryptedPasskeyData = if (entry.hasPasskey) {
                cryptoManager.bytesToHex(
                    cryptoManager.encryptString(entry.passkeyData, vaultKey, passkeyDataIv)
                )
            } else "",
            passkeyDataIv = if (entry.hasPasskey) cryptoManager.bytesToHex(passkeyDataIv) else "",
            passkeyRpId = entry.passkeyRpId,
            passkeyRpName = entry.passkeyRpName,
            passkeyUserHandle = entry.passkeyUserHandle,
            passkeyCreatedAt = entry.passkeyCreatedAt,
            passkeyLastUsedAt = entry.passkeyLastUsedAt
        )

        entryDao.insert(entity)

        // Mettre à jour le compteur d'entrées du vault
        updateVaultEntryCount(vaultId)

        return entry.id
    }

    /**
     * Déchiffre une entrée
     */
    private fun decryptEntry(entity: VaultEntryEntity, vaultKey: SecretKey): DecryptedEntry {
        return DecryptedEntry(
            id = entity.id,
            vaultId = entity.vaultId,
            folderId = entity.folderId,
            title = cryptoManager.decryptString(
                cryptoManager.hexToBytes(entity.encryptedTitle),
                vaultKey,
                cryptoManager.hexToBytes(entity.titleIv)
            ),
            username = if (entity.encryptedUsername.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedUsername),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.usernameIv)
                )
            } else "",
            password = cryptoManager.decryptString(
                cryptoManager.hexToBytes(entity.encryptedPassword),
                vaultKey,
                cryptoManager.hexToBytes(entity.passwordIv)
            ),
            url = if (entity.encryptedUrl.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedUrl),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.urlIv)
                )
            } else "",
            notes = if (entity.encryptedNotes.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedNotes),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.notesIv)
                )
            } else "",
            customFields = if (entity.encryptedCustomFields.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedCustomFields),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.customFieldsIv)
                )
            } else "",
            entryType = entity.entryType.toEntryType(),
            isFavorite = entity.isFavorite,
            passwordStrength = entity.passwordStrength,
            passwordEntropy = entity.passwordEntropy,
            generationMode = entity.generationMode,
            createdAt = entity.createdAt,
            modifiedAt = entity.modifiedAt,
            lastAccessedAt = entity.lastAccessedAt,
            passwordExpiresAt = entity.passwordExpiresAt,
            requiresPasswordChange = entity.requiresPasswordChange,
            usageCount = entity.usageCount,
            icon = entity.icon,
            color = entity.color,
            // TOTP
            hasTOTP = entity.hasTOTP,
            totpSecret = if (entity.hasTOTP && entity.encryptedTotpSecret.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedTotpSecret),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.totpSecretIv)
                )
            } else "",
            totpPeriod = entity.totpPeriod,
            totpDigits = entity.totpDigits,
            totpAlgorithm = entity.totpAlgorithm,
            totpIssuer = entity.totpIssuer,
            // Passkey
            hasPasskey = entity.hasPasskey,
            passkeyData = if (entity.hasPasskey && entity.encryptedPasskeyData.isNotEmpty()) {
                cryptoManager.decryptString(
                    cryptoManager.hexToBytes(entity.encryptedPasskeyData),
                    vaultKey,
                    cryptoManager.hexToBytes(entity.passkeyDataIv)
                )
            } else "",
            passkeyRpId = entity.passkeyRpId,
            passkeyRpName = entity.passkeyRpName,
            passkeyUserHandle = entity.passkeyUserHandle,
            passkeyCreatedAt = entity.passkeyCreatedAt,
            passkeyLastUsedAt = entity.passkeyLastUsedAt
        )
    }

    /**
     * Récupère toutes les entrées déchiffrées d'un vault
     */
    fun getEntries(vaultId: String): Flow<List<DecryptedEntry>> {
        val vaultKey = getVaultKey(vaultId)
        return entryDao.getEntriesByVault(vaultId).map { entities ->
            entities.map { decryptEntry(it, vaultKey) }
        }
    }

    /**
     * Récupère une entrée par ID
     */
    suspend fun getEntryById(vaultId: String, entryId: String): DecryptedEntry? {
        val vaultKey = getVaultKey(vaultId)
        val entity = entryDao.getById(entryId) ?: return null
        return decryptEntry(entity, vaultKey)
    }

    /**
     * Met à jour une entrée
     */
    suspend fun updateEntry(vaultId: String, entry: DecryptedEntry) {
        // Supprimer l'ancienne entrée et créer la nouvelle (pour re-chiffrer)
        entryDao.deleteById(entry.id)
        createEntry(vaultId, entry.copy(modifiedAt = System.currentTimeMillis()))
    }

    /**
     * Supprime une entrée
     */
    suspend fun deleteEntry(entryId: String) {
        val entity = entryDao.getById(entryId)
        if (entity != null) {
            entryDao.deleteById(entryId)
            updateVaultEntryCount(entity.vaultId)
        }
    }

    /**
     * Met à jour le compteur d'entrées d'un vault
     */
    private suspend fun updateVaultEntryCount(vaultId: String) {
        val count = entryDao.getCountByVault(vaultId)
        vaultDao.updateEntryCount(vaultId, count)
    }

    /**
     * Toggle favori
     */
    suspend fun toggleFavorite(entryId: String, isFavorite: Boolean) {
        entryDao.updateFavoriteStatus(entryId, isFavorite)
    }

    // ========== Folder Management ==========

    fun getFolders(vaultId: String): Flow<List<FolderEntity>> {
        return folderDao.getFoldersByVault(vaultId)
    }

    suspend fun createFolder(folder: FolderEntity) {
        folderDao.insert(folder)
    }

    suspend fun deleteFolder(folderId: String) {
        folderDao.deleteById(folderId)
    }

    // ========== Tag Management ==========

    fun getTags(vaultId: String): Flow<List<TagEntity>> {
        return tagDao.getTagsByVault(vaultId)
    }

    suspend fun createTag(tag: TagEntity) {
        tagDao.insert(tag)
    }

    suspend fun deleteTag(tagId: String) {
        tagDao.deleteById(tagId)
    }

    suspend fun addTagToEntry(entryId: String, tagId: String) {
        tagDao.addTagToEntry(EntryTagCrossRef(entryId, tagId))
    }

    suspend fun removeTagFromEntry(entryId: String, tagId: String) {
        tagDao.removeTagFromEntry(EntryTagCrossRef(entryId, tagId))
    }
}
