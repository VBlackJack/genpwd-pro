package com.julien.genpwdpro.data.repository

import android.content.Context
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.local.dao.VaultDao
import com.julien.genpwdpro.data.local.dao.VaultEntryDao
import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.data.local.entity.VaultEntryEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.util.*
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository pour l'import/export de données
 *
 * Supporte :
 * - CSV export/import (non chiffré, pour migration)
 * - JSON export (chiffré avec AES-256-GCM)
 * - JSON import (déchiffrement)
 * - Mapping de colonnes CSV personnalisé
 */
@Singleton
class ImportExportRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultDao: VaultDao,
    private val vaultEntryDao: VaultEntryDao,
    private val cryptoManager: VaultCryptoManager,
    private val vaultRepository: VaultRepository
) {

    private val gson = Gson()

    /**
     * Exporte les entrées d'un vault en CSV (NON CHIFFRÉ)
     *
     * ⚠️ ATTENTION: Le CSV contient des données en clair !
     * À utiliser uniquement pour migration vers d'autres gestionnaires.
     */
    suspend fun exportToCsv(
        vaultId: String,
        vaultKey: SecretKey,
        uri: Uri
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val entries = vaultEntryDao.getEntriesForVault(vaultId)

            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                BufferedWriter(OutputStreamWriter(outputStream)).use { writer ->
                    // Header CSV
                    writer.write("title,username,password,url,notes,type,totp_secret,favorite,icon,folder,tags,created_at,updated_at\n")

                    // Écrire chaque entrée
                    var count = 0
                    for (entry in entries) {
                        // Déchiffrer les champs
                        val title = cryptoManager.decryptString(
                            cryptoManager.hexToBytes(entry.encryptedTitle),
                            vaultKey,
                            cryptoManager.hexToBytes(entry.titleIv)
                        )

                        val username = if (entry.encryptedUsername.isNotEmpty()) {
                            cryptoManager.decryptString(
                                cryptoManager.hexToBytes(entry.encryptedUsername),
                                vaultKey,
                                cryptoManager.hexToBytes(entry.usernameIv)
                            )
                        } else ""

                        val password = if (entry.encryptedPassword.isNotEmpty()) {
                            cryptoManager.decryptString(
                                cryptoManager.hexToBytes(entry.encryptedPassword),
                                vaultKey,
                                cryptoManager.hexToBytes(entry.passwordIv)
                            )
                        } else ""

                        val url = if (entry.encryptedUrl.isNotEmpty()) {
                            cryptoManager.decryptString(
                                cryptoManager.hexToBytes(entry.encryptedUrl),
                                vaultKey,
                                cryptoManager.hexToBytes(entry.urlIv)
                            )
                        } else ""

                        val notes = if (entry.encryptedNotes.isNotEmpty()) {
                            cryptoManager.decryptString(
                                cryptoManager.hexToBytes(entry.encryptedNotes),
                                vaultKey,
                                cryptoManager.hexToBytes(entry.notesIv)
                            )
                        } else ""

                        val totpSecret = if (entry.hasTOTP && entry.encryptedTotpSecret.isNotEmpty()) {
                            cryptoManager.decryptString(
                                cryptoManager.hexToBytes(entry.encryptedTotpSecret),
                                vaultKey,
                                cryptoManager.hexToBytes(entry.totpSecretIv)
                            )
                        } else ""

                        // Écrire la ligne CSV (échapper les guillemets et virgules)
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
                            "," + // tags (à implémenter)
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

                            // Créer l'entrée via VaultRepository
                            val decryptedEntry = VaultRepository.DecryptedEntry(
                                id = UUID.randomUUID().toString(),
                                vaultId = vaultId,
                                folderId = null,
                                title = title,
                                username = username,
                                password = password,
                                url = url,
                                notes = notes,
                                customFields = "",
                                entryType = type,
                                isFavorite = favorite,
                                passwordStrength = calculatePasswordStrength(password),
                                passwordEntropy = 0.0,
                                generationMode = null,
                                createdAt = System.currentTimeMillis(),
                                modifiedAt = System.currentTimeMillis(),
                                lastAccessedAt = 0L,
                                passwordExpiresAt = 0,
                                requiresPasswordChange = false,
                                usageCount = 0,
                                icon = "🔐",
                                color = "#2196F3",
                                // TOTP
                                hasTOTP = totpSecret.isNotEmpty(),
                                totpSecret = totpSecret,
                                totpPeriod = 30,
                                totpDigits = 6,
                                totpAlgorithm = "SHA1",
                                totpIssuer = "",
                                // Passkey
                                hasPasskey = false,
                                passkeyData = "",
                                passkeyRpId = "",
                                passkeyRpName = "",
                                passkeyUserHandle = "",
                                passkeyCreatedAt = 0,
                                passkeyLastUsedAt = 0
                            )

                            vaultRepository.createEntry(vaultId, decryptedEntry)
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
     * Exporte un vault complet en JSON chiffré
     *
     * Le JSON est chiffré avec AES-256-GCM et une clé dérivée du master password.
     * Format sécurisé pour backup.
     */
    suspend fun exportToEncryptedJson(
        vaultId: String,
        masterPassword: String,
        uri: Uri
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val vault = vaultDao.getVaultById(vaultId) ?: return@withContext Result.failure(
                Exception("Vault non trouvé")
            )

            val entries = vaultEntryDao.getEntriesForVault(vaultId)

            // Créer l'export data
            val exportData = VaultExportData(
                version = 1,
                exportedAt = System.currentTimeMillis(),
                vault = vault,
                entries = entries
            )

            val json = gson.toJson(exportData)

            // Chiffrer le JSON avec le master password
            val salt = cryptoManager.generateSalt()
            val derivedKey = cryptoManager.deriveKey(
                masterPassword,
                salt,
                VaultCryptoManager.Argon2Params(
                    iterations = vault.iterations,
                    memory = vault.memory,
                    parallelism = vault.parallelism
                )
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
     * Importe un vault depuis un JSON chiffré
     *
     * Restaure complètement un vault avec toutes ses entrées.
     */
    suspend fun importFromEncryptedJson(
        masterPassword: String,
        uri: Uri,
        newVaultName: String? = null
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                    // Vérifier le header
                    val header = reader.readLine()
                    if (header != "GENPWDPRO_BACKUP_V1") {
                        return@withContext Result.failure(Exception("Format de fichier invalide"))
                    }

                    // Lire les données chiffrées
                    val encrypted = reader.readLine()
                    val parts = encrypted.split(":")
                    if (parts.size != 3) {
                        return@withContext Result.failure(Exception("Format de fichier invalide"))
                    }

                    val salt = cryptoManager.hexToBytes(parts[0])
                    val iv = cryptoManager.hexToBytes(parts[1])
                    val encryptedData = cryptoManager.hexToBytes(parts[2])

                    // Dériver la clé et déchiffrer
                    val derivedKey = cryptoManager.deriveKey(
                        masterPassword,
                        salt,
                        VaultCryptoManager.Argon2Params() // Utiliser les params par défaut
                    )

                    val json = cryptoManager.decryptString(encryptedData, derivedKey, iv)

                    // Parser le JSON
                    val exportData = gson.fromJson(json, VaultExportData::class.java)

                    // Créer un nouveau vault avec un nouvel ID
                    val newVaultId = UUID.randomUUID().toString()
                    val newVault = exportData.vault.copy(
                        id = newVaultId,
                        name = newVaultName ?: "${exportData.vault.name} (Importé)",
                        createdAt = System.currentTimeMillis(),
                        modifiedAt = System.currentTimeMillis()
                    )

                    vaultDao.insert(newVault)

                    // Importer toutes les entrées
                    for (entry in exportData.entries) {
                        val newEntry = entry.copy(
                            id = UUID.randomUUID().toString(),
                            vaultId = newVaultId,
                            createdAt = System.currentTimeMillis(),
                            modifiedAt = System.currentTimeMillis()
                        )
                        vaultEntryDao.insert(newEntry)
                    }

                    Result.success(newVaultId)
                }
            } ?: Result.failure(Exception("Impossible d'ouvrir le fichier"))
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
     * Structure de données pour export JSON
     */
    data class VaultExportData(
        @SerializedName("version") val version: Int,
        @SerializedName("exported_at") val exportedAt: Long,
        @SerializedName("vault") val vault: VaultEntity,
        @SerializedName("entries") val entries: List<VaultEntryEntity>
    )
}
