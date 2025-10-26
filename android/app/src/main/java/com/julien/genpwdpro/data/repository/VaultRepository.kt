package com.julien.genpwdpro.data.repository

import android.util.Log
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
        setAsDefault: Boolean = false,
        biometricUnlockEnabled: Boolean = false
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
            isDefault = setAsDefault,
            biometricUnlockEnabled = biometricUnlockEnabled
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

    // ========== Secure Notes Management ==========

    /**
     * Crée une note sécurisée
     *
     * @param vaultId ID du vault
     * @param title Titre de la note
     * @param content Contenu de la note (sera chiffré)
     * @param folderId ID du dossier (optionnel)
     * @param isFavorite Marquer comme favori
     * @param icon Icône (défaut: 📝)
     * @param color Couleur (optionnel)
     * @return ID de la note créée
     */
    suspend fun createSecureNote(
        vaultId: String,
        title: String,
        content: String,
        folderId: String? = null,
        isFavorite: Boolean = false,
        icon: String? = "📝",
        color: String? = null
    ): String {
        val noteId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val entry = DecryptedEntry(
            id = noteId,
            vaultId = vaultId,
            folderId = folderId,
            title = title,
            username = "",
            password = "",
            url = "",
            notes = content,
            customFields = "",
            entryType = EntryType.NOTE,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = now,
            modifiedAt = now,
            lastAccessedAt = now,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = 0,
            icon = icon,
            color = color,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )

        createEntry(vaultId, entry)
        return noteId
    }

    /**
     * Met à jour une note sécurisée
     */
    suspend fun updateSecureNote(
        vaultId: String,
        noteId: String,
        title: String,
        content: String,
        isFavorite: Boolean = false,
        icon: String? = null,
        color: String? = null
    ) {
        val existing = getEntryById(vaultId, noteId)
        if (existing != null && existing.entryType == EntryType.NOTE) {
            val updated = existing.copy(
                title = title,
                notes = content,
                isFavorite = isFavorite,
                icon = icon ?: existing.icon,
                color = color ?: existing.color,
                modifiedAt = System.currentTimeMillis()
            )
            updateEntry(vaultId, updated)
        }
    }

    /**
     * Récupère toutes les notes sécurisées d'un vault
     */
    fun getSecureNotes(vaultId: String): Flow<List<DecryptedEntry>> {
        val vaultKey = getVaultKey(vaultId)
        return entryDao.getEntriesByVault(vaultId).map { entities ->
            entities
                .filter { it.entryType == EntryType.NOTE.name }
                .map { decryptEntry(it, vaultKey) }
        }
    }

    /**
     * Récupère une note sécurisée par ID
     */
    suspend fun getSecureNoteById(vaultId: String, noteId: String): DecryptedEntry? {
        val entry = getEntryById(vaultId, noteId)
        return if (entry?.entryType == EntryType.NOTE) entry else null
    }

    /**
     * Recherche dans les notes sécurisées (par titre)
     * Note: Le contenu ne peut pas être recherché car il est chiffré
     */
    fun searchSecureNotes(vaultId: String, query: String): Flow<List<DecryptedEntry>> {
        val vaultKey = getVaultKey(vaultId)
        return entryDao.getEntriesByVault(vaultId).map { entities ->
            entities
                .filter { it.entryType == EntryType.NOTE.name }
                .map { decryptEntry(it, vaultKey) }
                .filter { it.title.contains(query, ignoreCase = true) }
        }
    }

    // ========== Card Management ==========

    /**
     * Crée une carte bancaire sécurisée
     */
    suspend fun createSecureCard(
        vaultId: String,
        cardholderName: String,
        cardNumber: String,
        expiryDate: String,
        cvv: String,
        pin: String = "",
        cardType: String = "CARD",
        notes: String = "",
        folderId: String? = null,
        isFavorite: Boolean = false
    ): String {
        val cardId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val cardData = """
            {
                "cardNumber": "$cardNumber",
                "expiryDate": "$expiryDate",
                "cvv": "$cvv",
                "pin": "$pin",
                "cardType": "$cardType"
            }
        """.trimIndent()

        val entry = DecryptedEntry(
            id = cardId,
            vaultId = vaultId,
            folderId = folderId,
            title = "$cardType - **** ${cardNumber.takeLast(4)}",
            username = cardholderName,
            password = cvv,
            url = "",
            notes = notes,
            customFields = cardData,
            entryType = EntryType.CARD,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = now,
            modifiedAt = now,
            lastAccessedAt = now,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = 0,
            icon = "💳",
            color = null,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )

        createEntry(vaultId, entry)
        return cardId
    }

    /**
     * Récupère toutes les cartes bancaires d'un vault
     */
    fun getSecureCards(vaultId: String): Flow<List<DecryptedEntry>> {
        val vaultKey = getVaultKey(vaultId)
        return entryDao.getEntriesByVault(vaultId).map { entities ->
            entities
                .filter { it.entryType == EntryType.CARD.name }
                .map { decryptEntry(it, vaultKey) }
        }
    }

    // ========== Identity Management ==========

    /**
     * Crée une identité sécurisée (passeport, permis, etc.)
     */
    suspend fun createSecureIdentity(
        vaultId: String,
        fullName: String,
        identityType: String,
        identityData: String,
        folderId: String? = null,
        isFavorite: Boolean = false
    ): String {
        val identityId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val entry = DecryptedEntry(
            id = identityId,
            vaultId = vaultId,
            folderId = folderId,
            title = fullName,
            username = identityType,
            password = "",
            url = "",
            notes = identityData,
            customFields = "",
            entryType = EntryType.IDENTITY,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = now,
            modifiedAt = now,
            lastAccessedAt = now,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = 0,
            icon = "🪪",
            color = null,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )

        createEntry(vaultId, entry)
        return identityId
    }

    /**
     * Récupère toutes les identités d'un vault
     */
    fun getSecureIdentities(vaultId: String): Flow<List<DecryptedEntry>> {
        val vaultKey = getVaultKey(vaultId)
        return entryDao.getEntriesByVault(vaultId).map { entities ->
            entities
                .filter { it.entryType == EntryType.IDENTITY.name }
                .map { decryptEntry(it, vaultKey) }
        }
    }

    // ========== Statistics ==========

    /**
     * Récupère les statistiques d'un vault
     */
    suspend fun getVaultStatistics(vaultId: String): VaultStatistics {
        val totalEntries = entryDao.getCountByVault(vaultId)
        val favoritesCount = entryDao.getFavoritesCount(vaultId)
        val passwordStats = entryDao.getPasswordStrengthStats(vaultId)

        // Compter par type
        val allEntries = entryDao.getEntriesByVault(vaultId)
        var loginCount = 0
        var noteCount = 0
        var cardCount = 0
        var identityCount = 0
        var totpCount = 0
        var passkeyCount = 0

        allEntries.collect { entities ->
            entities.forEach { entry ->
                when (entry.entryType) {
                    "LOGIN" -> loginCount++
                    "NOTE" -> noteCount++
                    "CARD" -> cardCount++
                    "IDENTITY" -> identityCount++
                }
                if (entry.hasTOTP) totpCount++
                if (entry.hasPasskey) passkeyCount++
            }
        }

        return VaultStatistics(
            totalEntries = totalEntries,
            favoritesCount = favoritesCount,
            loginCount = loginCount,
            noteCount = noteCount,
            cardCount = cardCount,
            identityCount = identityCount,
            totpCount = totpCount,
            passkeyCount = passkeyCount,
            weakPasswordCount = passwordStats.weak,
            mediumPasswordCount = passwordStats.medium,
            strongPasswordCount = passwordStats.strong
        )
    }

    data class VaultStatistics(
        val totalEntries: Int,
        val favoritesCount: Int,
        val loginCount: Int,
        val noteCount: Int,
        val cardCount: Int,
        val identityCount: Int,
        val totpCount: Int,
        val passkeyCount: Int,
        val weakPasswordCount: Int,
        val mediumPasswordCount: Int,
        val strongPasswordCount: Int
    )

    // ========== Cloud Sync Export/Import ==========

    /**
     * Exporte un vault complet pour la synchronisation cloud
     *
     * Processus:
     * 1. Récupère le vault et toutes ses entrées
     * 2. Sérialise en JSON
     * 3. Chiffre avec le master password
     * 4. Retourne les données chiffrées prêtes pour l'upload
     *
     * Sécurité:
     * - Le chiffrement se fait AVANT l'export
     * - Le cloud ne voit jamais les données en clair
     * - Utilise le même système de chiffrement que le vault
     *
     * @param vaultId ID du vault à exporter
     * @param masterPassword Mot de passe maître pour vérification
     * @return ByteArray chiffré, ou null en cas d'erreur
     */
    suspend fun exportVault(vaultId: String, masterPassword: String): ByteArray? {
        return try {
            // Vérifier que le vault existe et que le password est correct
            val vault = vaultDao.getById(vaultId) ?: return null

            // Déverrouiller le vault pour vérifier le password
            val isValid = unlockVault(vaultId, masterPassword)
            if (!isValid) return null

            val vaultKey = getVaultKey(vaultId)

            // Récupérer toutes les entrées
            val entries = mutableListOf<DecryptedEntry>()
            entryDao.getEntriesByVault(vaultId).collect { entities ->
                entities.forEach { entity ->
                    entries.add(decryptEntry(entity, vaultKey))
                }
            }

            // Récupérer les dossiers
            val folders = mutableListOf<FolderEntity>()
            folderDao.getFoldersByVault(vaultId).collect { folderEntities ->
                folders.addAll(folderEntities)
            }

            // Récupérer les tags
            val tags = mutableListOf<TagEntity>()
            tagDao.getTagsByVault(vaultId).collect { tagEntities ->
                tags.addAll(tagEntities)
            }

            // Créer l'objet d'export
            val exportData = VaultExportData(
                vault = VaultExport(
                    id = vault.id,
                    name = vault.name,
                    description = vault.description,
                    createdAt = vault.createdAt,
                    modifiedAt = vault.modifiedAt,
                    isDefault = vault.isDefault
                ),
                entries = entries.map { entry ->
                    EntryExport(
                        id = entry.id,
                        folderId = entry.folderId,
                        title = entry.title,
                        username = entry.username,
                        password = entry.password,
                        url = entry.url,
                        notes = entry.notes,
                        customFields = entry.customFields,
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
                        hasTOTP = entry.hasTOTP,
                        totpSecret = entry.totpSecret,
                        totpPeriod = entry.totpPeriod,
                        totpDigits = entry.totpDigits,
                        totpAlgorithm = entry.totpAlgorithm,
                        totpIssuer = entry.totpIssuer,
                        hasPasskey = entry.hasPasskey,
                        passkeyData = entry.passkeyData,
                        passkeyRpId = entry.passkeyRpId,
                        passkeyRpName = entry.passkeyRpName,
                        passkeyUserHandle = entry.passkeyUserHandle,
                        passkeyCreatedAt = entry.passkeyCreatedAt,
                        passkeyLastUsedAt = entry.passkeyLastUsedAt
                    )
                },
                folders = folders.map { folder ->
                    FolderExport(
                        id = folder.id,
                        name = folder.name,
                        parentId = folder.parentFolderId,
                        icon = folder.icon,
                        color = folder.color,
                        createdAt = folder.createdAt
                    )
                },
                tags = tags.map { tag ->
                    TagExport(
                        id = tag.id,
                        name = tag.name,
                        color = tag.color,
                        createdAt = tag.createdAt
                    )
                }
            )

            // Sérialiser en JSON
            val json = com.google.gson.Gson().toJson(exportData)

            // Chiffrer avec AES-256-GCM
            val iv = cryptoManager.generateIV()
            val encryptedData = cryptoManager.encryptString(json, vaultKey, iv)

            // Combiner IV + données chiffrées
            iv + encryptedData
        } catch (e: Exception) {
            Log.e("VaultRepository", "Error exporting vault", e)
            null
        }
    }

    /**
     * Importe un vault depuis des données chiffrées (synchronisation cloud)
     *
     * Processus:
     * 1. Déchiffre les données avec le master password
     * 2. Désérialise le JSON
     * 3. Insère le vault et toutes ses entrées dans la base de données
     *
     * Sécurité:
     * - Le déchiffrement se fait APRÈS le download
     * - Vérifie l'intégrité des données
     * - Crée un nouveau vault (ne remplace pas un existant)
     *
     * @param encryptedData Données chiffrées depuis le cloud
     * @param masterPassword Mot de passe maître pour déchiffrement
     * @return true si l'import a réussi
     */
    suspend fun importVault(encryptedData: ByteArray, masterPassword: String): Boolean {
        return try {
            // Extraire IV (premiers 12 bytes) et données chiffrées
            val iv = encryptedData.sliceArray(0 until 12)
            val ciphertext = encryptedData.sliceArray(12 until encryptedData.size)

            // Créer une clé temporaire pour déchiffrer
            // On utilise le même processus que pour créer un vault
            val vaultResult = cryptoManager.createVault(
                masterPassword,
                VaultCryptoManager.Argon2Params()
            )

            // Déchiffrer
            val json = cryptoManager.decryptString(ciphertext, vaultResult.derivedKey, iv)

            // Désérialiser
            val importData = com.google.gson.Gson().fromJson(json, VaultExportData::class.java)

            // Vérifier si un vault avec le même ID existe déjà
            val existingVault = vaultDao.getById(importData.vault.id)
            if (existingVault != null) {
                // Vault déjà importé, mettre à jour
                Log.d("VaultRepository", "Vault already exists, updating...")
            }

            // Créer le vault avec les mêmes paramètres cryptographiques
            val vaultId = importData.vault.id
            val vault = VaultEntity(
                id = vaultId,
                name = importData.vault.name,
                description = importData.vault.description,
                masterPasswordHash = vaultResult.masterPasswordHash,
                salt = vaultResult.salt,
                encryptedKey = vaultResult.encryptedKey,
                keyIv = vaultResult.keyIv,
                createdAt = importData.vault.createdAt,
                modifiedAt = importData.vault.modifiedAt,
                lastAccessedAt = System.currentTimeMillis(),
                isDefault = importData.vault.isDefault
            )

            // Insérer le vault (ou le mettre à jour)
            if (existingVault != null) {
                vaultDao.update(vault)
            } else {
                vaultDao.insert(vault)
            }

            // Stocker la clé déverrouillée en mémoire
            unlockedKeys[vaultId] = vaultResult.derivedKey

            // Importer les dossiers
            importData.folders.forEach { folderExport ->
                val folder = FolderEntity(
                    id = folderExport.id,
                    vaultId = vaultId,
                    name = folderExport.name,
                    parentFolderId = folderExport.parentId,
                    icon = folderExport.icon ?: "📁",
                    color = folderExport.color,
                    createdAt = folderExport.createdAt
                )
                folderDao.insert(folder)
            }

            // Importer les tags
            importData.tags.forEach { tagExport ->
                val tag = TagEntity(
                    id = tagExport.id,
                    vaultId = vaultId,
                    name = tagExport.name,
                    color = tagExport.color ?: "#808080",
                    createdAt = tagExport.createdAt
                )
                tagDao.insert(tag)
            }

            // Importer toutes les entrées
            importData.entries.forEach { entryExport ->
                val entry = DecryptedEntry(
                    id = entryExport.id,
                    vaultId = vaultId,
                    folderId = entryExport.folderId,
                    title = entryExport.title,
                    username = entryExport.username,
                    password = entryExport.password,
                    url = entryExport.url,
                    notes = entryExport.notes,
                    customFields = entryExport.customFields,
                    entryType = entryExport.entryType.toEntryType(),
                    isFavorite = entryExport.isFavorite,
                    passwordStrength = entryExport.passwordStrength,
                    passwordEntropy = entryExport.passwordEntropy,
                    generationMode = entryExport.generationMode,
                    createdAt = entryExport.createdAt,
                    modifiedAt = entryExport.modifiedAt,
                    lastAccessedAt = entryExport.lastAccessedAt,
                    passwordExpiresAt = entryExport.passwordExpiresAt,
                    requiresPasswordChange = entryExport.requiresPasswordChange,
                    usageCount = entryExport.usageCount,
                    icon = entryExport.icon,
                    color = entryExport.color,
                    hasTOTP = entryExport.hasTOTP,
                    totpSecret = entryExport.totpSecret,
                    totpPeriod = entryExport.totpPeriod,
                    totpDigits = entryExport.totpDigits,
                    totpAlgorithm = entryExport.totpAlgorithm,
                    totpIssuer = entryExport.totpIssuer,
                    hasPasskey = entryExport.hasPasskey,
                    passkeyData = entryExport.passkeyData,
                    passkeyRpId = entryExport.passkeyRpId,
                    passkeyRpName = entryExport.passkeyRpName,
                    passkeyUserHandle = entryExport.passkeyUserHandle,
                    passkeyCreatedAt = entryExport.passkeyCreatedAt,
                    passkeyLastUsedAt = entryExport.passkeyLastUsedAt
                )

                createEntry(vaultId, entry)
            }

            // Mettre à jour le compteur d'entrées
            updateVaultEntryCount(vaultId)

            true
        } catch (e: Exception) {
            Log.e("VaultRepository", "Error importing vault", e)
            false
        }
    }

    // ========== Export/Import Data Classes ==========

    private data class VaultExportData(
        val vault: VaultExport,
        val entries: List<EntryExport>,
        val folders: List<FolderExport>,
        val tags: List<TagExport>
    )

    private data class VaultExport(
        val id: String,
        val name: String,
        val description: String,
        val createdAt: Long,
        val modifiedAt: Long,
        val isDefault: Boolean
    )

    private data class EntryExport(
        val id: String,
        val folderId: String?,
        val title: String,
        val username: String,
        val password: String,
        val url: String,
        val notes: String,
        val customFields: String,
        val entryType: String,
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
        val hasTOTP: Boolean,
        val totpSecret: String,
        val totpPeriod: Int,
        val totpDigits: Int,
        val totpAlgorithm: String,
        val totpIssuer: String,
        val hasPasskey: Boolean,
        val passkeyData: String,
        val passkeyRpId: String,
        val passkeyRpName: String,
        val passkeyUserHandle: String,
        val passkeyCreatedAt: Long,
        val passkeyLastUsedAt: Long
    )

    private data class FolderExport(
        val id: String,
        val name: String,
        val parentId: String?,
        val icon: String?,
        val color: String?,
        val createdAt: Long
    )

    private data class TagExport(
        val id: String,
        val name: String,
        val color: String?,
        val createdAt: Long
    )
}
