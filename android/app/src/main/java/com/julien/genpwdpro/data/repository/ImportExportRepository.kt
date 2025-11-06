package com.julien.genpwdpro.data.repository

import android.content.Context
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.import.KeePassImporter
import com.julien.genpwdpro.data.models.vault.EntryType
import com.julien.genpwdpro.data.models.vault.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.model.VaultStatistics
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.util.*
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

/**
 * Repository for data import/export (file-based system)
 *
 * Supports:
 * - CSV export/import (unencrypted, for migration)
 * - JSON export (encrypted with AES-256-GCM)
 * - JSON import (decryption)
 * - Custom CSV column mapping
 *
 * Migrated to use FileVaultRepository
 */
@Singleton
class ImportExportRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultRegistryDao: VaultRegistryDao,
    private val cryptoManager: VaultCryptoManager,
    private val fileVaultRepository: FileVaultRepository,
    private val vaultSessionManager: VaultSessionManager,
    private val vaultFileManager: VaultFileManager
) {

    private val gson = Gson()

    /**
     * Exports vault entries to CSV (UNENCRYPTED)
     *
     * ⚠️ WARNING: CSV contains plaintext data!
     * Use only for migration to other password managers.
     *
     * Note: Vault must be unlocked before calling this method.
     */
    suspend fun exportToCsv(
        vaultId: String,
        vaultKey: SecretKey, // Kept for backward compatibility but not used
        uri: Uri
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            // Get entries from session (already decrypted)
            val entries = fileVaultRepository.getEntries().first()

            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                BufferedWriter(OutputStreamWriter(outputStream)).use { writer ->
                    // Header CSV
                    writer.write(
                        "title,username,password,url,notes,type,totp_secret,favorite,icon,folder,tags,created_at,updated_at\n"
                    )

                    // Write each entry (data is already decrypted)
                    var count = 0
                    for (entry in entries) {
                        // Fields are already decrypted in memory
                        val title = entry.title
                        val username = entry.username ?: ""
                        val password = entry.password ?: ""
                        val url = entry.url ?: ""
                        val notes = entry.notes ?: ""
                        val totpSecret = if (entry.hasTOTP()) entry.totpSecret ?: "" else ""

                        // Write CSV line (escape quotes and commas)
                        writer.write(
                            "${escapeCsv(title)}," +
                                "${escapeCsv(username)}," +
                                "${escapeCsv(password)}," +
                                "${escapeCsv(url)}," +
                                "${escapeCsv(notes)}," +
                                "${entry.entryType}," +
                                "${escapeCsv(totpSecret)}," +
                                "${entry.isFavorite}," +
                                "${entry.icon}," +
                                "${entry.folderId ?: ""}," +
                                "," + // tags (to be implemented)
                                "${entry.createdAt}," +
                                "${entry.modifiedAt}\n"
                        )
                        count++
                    }

                    Result.success(count)
                }
            } ?: Result.failure(Exception("Impossible d'ouvrir le fichier pour écriture"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Importe des entrées depuis un CSV
     *
     * Format attendu : title,username,password,url,notes,type,totp_secret,favorite
     * Si le format est différent, utilisez importCsvWithMapping()
     */
    suspend fun importFromCsv(
        vaultId: String,
        vaultKey: SecretKey,
        uri: Uri
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                    // Ignorer la première ligne (header)
                    reader.readLine()

                    var count = 0
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val fields = parseCsvLine(line!!)
                        if (fields.size < 3) continue // Minimum: title, username, password

                        try {
                            val title = fields.getOrNull(0) ?: continue
                            val username = fields.getOrNull(1) ?: ""
                            val password = fields.getOrNull(2) ?: ""
                            val url = fields.getOrNull(3) ?: ""
                            val notes = fields.getOrNull(4) ?: ""
                            val type = fields.getOrNull(5)?.let {
                                try { EntryType.valueOf(it) } catch (e: Exception) { EntryType.LOGIN }
                            } ?: EntryType.LOGIN
                            val totpSecret = fields.getOrNull(6) ?: ""
                            val favorite = fields.getOrNull(7)?.toBoolean() ?: false

                            // Créer l'entrée via FileVaultRepository
                            val entryEntity = VaultEntryEntity(
                                id = UUID.randomUUID().toString(),
                                vaultId = vaultId,
                                folderId = null,
                                title = title,
                                username = username.takeIf { it.isNotEmpty() },
                                password = password.takeIf { it.isNotEmpty() },
                                url = url.takeIf { it.isNotEmpty() },
                                notes = notes.takeIf { it.isNotEmpty() },
                                customFields = null,
                                entryType = type.name,
                                isFavorite = favorite,
                                passwordStrength = calculatePasswordStrength(password),
                                passwordEntropy = 0.0,
                                generationMode = null,
                                createdAt = System.currentTimeMillis(),
                                modifiedAt = System.currentTimeMillis(),
                                lastAccessedAt = System.currentTimeMillis(),
                                passwordExpiresAt = 0,
                                requiresPasswordChange = false,
                                usageCount = 0,
                                icon = "🔐",
                                color = "#2196F3",
                                // TOTP
                                hasTOTP = totpSecret.isNotEmpty(),
                                totpSecret = totpSecret.takeIf { it.isNotEmpty() },
                                totpPeriod = 30,
                                totpDigits = 6,
                                totpAlgorithm = "SHA1",
                                totpIssuer = "",
                                // Passkey
                                hasPasskey = false,
                                passkeyData = null,
                                passkeyRpId = "",
                                passkeyRpName = "",
                                passkeyUserHandle = "",
                                passkeyCreatedAt = 0,
                                passkeyLastUsedAt = 0
                            )

                            // Utiliser FileVaultRepository pour ajouter l'entrée
                            fileVaultRepository.addEntry(entryEntity).getOrThrow()
                            count++
                        } catch (e: Exception) {
                            // Ignorer les lignes invalides
                            continue
                        }
                    }

                    Result.success(count)
                }
            } ?: Result.failure(Exception("Impossible d'ouvrir le fichier pour lecture"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Exports complete vault to encrypted JSON
     *
     * JSON is encrypted with AES-256-GCM and key derived from master password.
     * Secure format for backup.
     *
     * Note: Vault must be unlocked before calling this method.
     */
    suspend fun exportToEncryptedJson(
        vaultId: String,
        masterPassword: String,
        uri: Uri
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            // Get vault metadata from registry
            val registryEntry = vaultRegistryDao.getById(vaultId)
                ?: return@withContext Result.failure(Exception("Vault not found"))

            // Get entries from session (already decrypted)
            val entries = fileVaultRepository.getEntries().first()

            // Create export data
            val exportData = VaultExportData(
                version = 1,
                exportedAt = System.currentTimeMillis(),
                vaultName = registryEntry.name,
                vaultDescription = registryEntry.description,
                entries = entries
            )

            val json = gson.toJson(exportData)

            // Encrypt JSON with master password (using default Argon2 params)
            val salt = cryptoManager.generateSalt()
            val derivedKey = cryptoManager.deriveKey(
                masterPassword,
                salt,
                VaultCryptoManager.Argon2Params() // Use defaults
            )

            val iv = cryptoManager.generateIV()
            val encrypted = cryptoManager.encryptString(json, derivedKey, iv)

            // Structure du fichier : salt (64 hex) + iv (24 hex) + encrypted (variable)
            val saltHex = cryptoManager.bytesToHex(salt)
            val ivHex = cryptoManager.bytesToHex(iv)
            val encryptedHex = cryptoManager.bytesToHex(encrypted)

            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                BufferedWriter(OutputStreamWriter(outputStream)).use { writer ->
                    writer.write("GENPWDPRO_BACKUP_V1\n")
                    writer.write("$saltHex:$ivHex:$encryptedHex")
                }
            }

            Result.success(entries.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Imports vault from encrypted JSON
     *
     * Restores a complete vault with all entries.
     * Creates a new .gpv file and registers it in the vault registry.
     */
    suspend fun importFromEncryptedJson(
        masterPassword: String,
        uri: Uri,
        newVaultName: String? = null
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                    // Verify header
                    val header = reader.readLine()
                    if (header != "GENPWDPRO_BACKUP_V1") {
                        return@withContext Result.failure(Exception("Invalid file format"))
                    }

                    // Read encrypted data
                    val encrypted = reader.readLine()
                    val parts = encrypted.split(":")
                    if (parts.size != 3) {
                        return@withContext Result.failure(Exception("Invalid file format"))
                    }

                    val salt = cryptoManager.hexToBytes(parts[0])
                    val iv = cryptoManager.hexToBytes(parts[1])
                    val encryptedData = cryptoManager.hexToBytes(parts[2])

                    // Derive key and decrypt
                    val derivedKey = cryptoManager.deriveKey(
                        masterPassword,
                        salt,
                        VaultCryptoManager.Argon2Params() // Use defaults
                    )

                    val json = cryptoManager.decryptString(encryptedData, derivedKey, iv)

                    // Parse JSON
                    val exportData = gson.fromJson(json, VaultExportData::class.java)

                    // Create new vault file
                    val finalVaultName = newVaultName ?: "${exportData.vaultName} (Imported)"
                    val (newVaultId, location) = vaultFileManager.createVaultFile(
                        name = finalVaultName,
                        masterPassword = masterPassword,
                        strategy = StorageStrategy.INTERNAL,
                        description = exportData.vaultDescription
                    )

                    val file = location.file
                    val uri = location.uri
                    val filePath = file?.absolutePath ?: uri?.let { vaultFileManager.uriToPath(it) }
                        ?: throw IllegalStateException("Vault file location unavailable")
                    val fileSize = file?.length() ?: uri?.let { vaultFileManager.getVaultFileSizeFromUri(it) }
                        ?: 0L
                    val lastModified = file?.lastModified() ?: System.currentTimeMillis()

                    // Register vault in registry
                    val registryEntry = VaultRegistryEntry(
                        id = newVaultId,
                        name = finalVaultName,
                        description = exportData.vaultDescription,
                        filePath = filePath,
                        storageStrategy = StorageStrategy.INTERNAL,
                        fileSize = fileSize,
                        lastModified = lastModified,
                        lastAccessed = null,
                        isDefault = false,
                        isLoaded = false,
                        statistics = com.julien.genpwdpro.data.models.vault.VaultStatistics(
                            entryCount = exportData.entries.size,
                            folderCount = 0,
                            presetCount = 0,
                            tagCount = 0,
                            totalSize = fileSize
                        ),
                        createdAt = System.currentTimeMillis(),
                        biometricUnlockEnabled = false,
                        encryptedMasterPassword = null,
                        masterPasswordIv = null
                    )
                    vaultRegistryDao.insert(registryEntry)

                    // Unlock vault to add entries
                    vaultSessionManager.unlockVault(
                        vaultId = newVaultId,
                        masterPassword = masterPassword
                    ).getOrThrow()

                    // Import all entries
                    for (entry in exportData.entries) {
                        val newEntry = entry.copy(
                            id = UUID.randomUUID().toString(),
                            vaultId = newVaultId,
                            createdAt = System.currentTimeMillis(),
                            modifiedAt = System.currentTimeMillis()
                        )
                        fileVaultRepository.addEntry(newEntry).getOrThrow()
                    }

                    // Lock vault after import
                    vaultSessionManager.lockVault()

                    Result.success(newVaultId)
                }
            } ?: Result.failure(Exception("Cannot open file"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Échappe les caractères spéciaux CSV
     */
    private fun escapeCsv(value: String): String {
        return if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }

    /**
     * Parse une ligne CSV avec gestion des guillemets
     */
    private fun parseCsvLine(line: String): List<String> {
        val fields = mutableListOf<String>()
        var current = StringBuilder()
        var inQuotes = false

        for (i in line.indices) {
            val char = line[i]
            when {
                char == '"' && inQuotes && line.getOrNull(i + 1) == '"' -> {
                    current.append('"')
                    // Skip next quote
                }
                char == '"' -> {
                    inQuotes = !inQuotes
                }
                char == ',' && !inQuotes -> {
                    fields.add(current.toString())
                    current = StringBuilder()
                }
                else -> {
                    current.append(char)
                }
            }
        }
        fields.add(current.toString())

        return fields
    }

    /**
     * Calcule la force d'un mot de passe (score 0-100)
     */
    private fun calculatePasswordStrength(password: String): Int {
        var strength = 0

        // Longueur
        strength += when {
            password.length >= 16 -> 30
            password.length >= 12 -> 20
            password.length >= 8 -> 10
            else -> 0
        }

        // Variété de caractères
        if (password.any { it.isUpperCase() }) strength += 15
        if (password.any { it.isLowerCase() }) strength += 15
        if (password.any { it.isDigit() }) strength += 15
        if (password.any { !it.isLetterOrDigit() }) strength += 25

        return strength.coerceIn(0, 100)
    }

    /**
     * Importe depuis un fichier KeePass KDBX
     *
     * Supporte KDBX 3.x et 4.x (KeePass 2.x)
     * Crée un nouveau vault avec toutes les entrées importées
     *
     * @param uri URI du fichier .kdbx
     * @param masterPassword Mot de passe du fichier KeePass
     * @param newVaultName Nom du nouveau vault à créer
     * @param keyFileUri URI optionnel du fichier clé
     * @return Result contenant l'ID du vault créé
     */
    suspend fun importFromKdbx(
        uri: Uri,
        masterPassword: String,
        newVaultName: String? = null,
        keyFileUri: Uri? = null
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Ouvrir le fichier KDBX
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: return@withContext Result.failure(Exception("Impossible d'ouvrir le fichier KDBX"))

            // Ouvrir le fichier clé si fourni
            val keyFileStream = keyFileUri?.let { keyUri ->
                context.contentResolver.openInputStream(keyUri)
            }

            // Parser le fichier KDBX
            val importer = KeePassImporter()
            val keepassDb = inputStream.use { input ->
                keyFileStream?.use { keyInput ->
                    importer.import(input, masterPassword, keyInput)
                } ?: importer.import(input, masterPassword, null)
            }

            // Créer un nouveau vault pour les données importées
            val vaultName = newVaultName ?: keepassDb.name

            // Créer d'abord le fichier vault pour obtenir le filePath
            val (createdVaultId, vaultLocation) = vaultFileManager.createVaultFile(
                name = vaultName,
                masterPassword = masterPassword,
                strategy = StorageStrategy.INTERNAL,
                description = "Importé depuis KeePass: ${keepassDb.name}"
            )

            // Utiliser le vaultId retourné par createVaultFile
            val timestamp = System.currentTimeMillis()
            val registryEntry = VaultRegistryEntry(
                id = createdVaultId,
                name = vaultName,
                filePath = vaultLocation.requirePath(),
                storageStrategy = StorageStrategy.INTERNAL,
                fileSize = 0,
                lastModified = timestamp,
                lastAccessed = null,
                isDefault = false,
                isLoaded = false,
                statistics = VaultStatistics(
                    entryCount = keepassDb.entries.size,
                    folderCount = 0,
                    presetCount = 0,
                    tagCount = 0,
                    sizeInBytes = 0
                ),
                description = "Importé depuis KeePass: ${keepassDb.name}",
                createdAt = timestamp,
                biometricUnlockEnabled = false,
                encryptedMasterPassword = null,
                masterPasswordIv = null
            )

            vaultRegistryDao.insert(registryEntry)

            // Ouvrir une session pour ce vault
            vaultSessionManager.unlockVault(createdVaultId, masterPassword).getOrThrow()

            // Convertir les entrées KeePass en VaultEntryEntity
            var importedCount = 0
            for (keepassEntry in keepassDb.entries) {
                try {
                    val entryEntity = VaultEntryEntity(
                        id = UUID.randomUUID().toString(),
                        vaultId = createdVaultId,
                        folderId = null, // Les dossiers KeePass peuvent être mappés plus tard
                        title = keepassEntry.title,
                        username = keepassEntry.username.takeIf { it.isNotEmpty() },
                        password = keepassEntry.password.takeIf { it.isNotEmpty() },
                        url = keepassEntry.url.takeIf { it.isNotEmpty() },
                        notes = keepassEntry.notes.takeIf { it.isNotEmpty() },
                        customFields = if (keepassEntry.customFields.isNotEmpty()) {
                            gson.toJson(keepassEntry.customFields)
                        } else null,
                        entryType = EntryType.LOGIN.name,
                        isFavorite = false,
                        passwordStrength = calculatePasswordStrength(keepassEntry.password),
                        passwordEntropy = 0.0,
                        generationMode = null,
                        createdAt = System.currentTimeMillis(),
                        modifiedAt = System.currentTimeMillis(),
                        lastAccessedAt = System.currentTimeMillis(),
                        passwordExpiresAt = 0,
                        requiresPasswordChange = false,
                        usageCount = 0,
                        icon = "🔐",
                        color = "#2196F3",
                        // TOTP - Pas supporté dans KDBX basique
                        hasTOTP = false,
                        totpSecret = null,
                        totpPeriod = 30,
                        totpDigits = 6,
                        totpAlgorithm = "SHA1",
                        totpIssuer = "",
                        // Passkey
                        hasPasskey = false,
                        passkeyData = null,
                        passkeyRpId = "",
                        passkeyRpName = "",
                        passkeyUserHandle = "",
                        passkeyCreatedAt = 0,
                        passkeyLastUsedAt = 0
                    )

                    fileVaultRepository.addEntry(entryEntity).getOrThrow()
                    importedCount++
                } catch (e: Exception) {
                    // Ignorer les entrées qui échouent
                    continue
                }
            }

            // Fermer la session
            vaultSessionManager.lockVault()

            Result.success(createdVaultId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Data structure for JSON export
     * Uses simplified vault metadata instead of full VaultEntity
     */
    data class VaultExportData(
        @SerializedName("version") val version: Int,
        @SerializedName("exported_at") val exportedAt: Long,
        @SerializedName("vault_name") val vaultName: String,
        @SerializedName("vault_description") val vaultDescription: String?,
        @SerializedName("entries") val entries: List<VaultEntryEntity>
    )
}
