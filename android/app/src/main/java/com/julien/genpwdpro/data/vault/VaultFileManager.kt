package com.julien.genpwdpro.data.vault

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.models.vault.*
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de fichiers vault (.gpv)
 *
 * Responsable de:
 * - Création/lecture/écriture de fichiers .gpv
 * - Chiffrement/déchiffrement du contenu
 * - Gestion des différentes stratégies de stockage
 * - Export/import de vaults
 */
@Singleton
class VaultFileManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val cryptoManager: VaultCryptoManager
) {
    private val gson: Gson = GsonBuilder()
        .setPrettyPrinting()
        .create()

    companion object {
        private const val TAG = "VaultFileManager"
        private const val VAULT_EXTENSION = ".gpv"
        private const val VAULTS_DIR_NAME = "vaults"
        private const val PUBLIC_DIR_NAME = "GenPwdPro"
    }

    /**
     * Récupère le répertoire de stockage selon la stratégie
     */
    fun getStorageDirectory(strategy: StorageStrategy, customPath: Uri? = null): File {
        return when (strategy) {
            StorageStrategy.INTERNAL -> {
                File(context.filesDir, VAULTS_DIR_NAME)
            }
            StorageStrategy.APP_STORAGE -> {
                File(context.getExternalFilesDir(null), VAULTS_DIR_NAME)
            }
            StorageStrategy.PUBLIC_DOCUMENTS -> {
                File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
                    PUBLIC_DIR_NAME
                )
            }
            StorageStrategy.CUSTOM -> {
                // Pour custom, on utilise le SAF, géré séparément
                throw UnsupportedOperationException("Custom paths use Storage Access Framework")
            }
        }.also { dir ->
            if (!dir.exists()) {
                dir.mkdirs()
            }
        }
    }

    /**
     * Génère le nom de fichier pour un vault
     */
    private fun getVaultFileName(vaultId: String): String {
        return "vault_$vaultId$VAULT_EXTENSION"
    }

    /**
     * Crée un nouveau fichier vault
     */
    suspend fun createVaultFile(
        name: String,
        masterPassword: String,
        strategy: StorageStrategy,
        description: String? = null,
        customPath: Uri? = null
    ): Pair<String, File> {
        val vaultId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()

        // SECURITY FIX: Generate a RANDOM salt (not deterministic)
        // This prevents rainbow table attacks and improves Argon2id security
        val salt = cryptoManager.generateSalt()
        val saltHex = cryptoManager.bytesToHex(salt)
        val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

        // Créer les métadonnées initiales
        val metadata = VaultMetadata(
            vaultId = vaultId,
            name = name,
            description = description,
            isDefault = false,
            createdAt = timestamp,
            modifiedAt = timestamp,
            statistics = VaultStatistics()
        )

        // Créer le vault vide
        val vaultData = VaultData(
            metadata = metadata,
            entries = emptyList(),
            folders = emptyList(),
            tags = emptyList(),
            presets = emptyList(),
            entryTags = emptyList()
        )

        // Sauvegarder avec le salt généré
        val file = saveVaultFile(vaultId, vaultData, vaultKey, strategy, customPath, saltHex)

        return Pair(vaultId, file)
    }

    /**
     * Charge un fichier vault
     */
    suspend fun loadVaultFile(
        vaultId: String,
        masterPassword: String,
        filePath: String
    ): VaultData {
        val file = File(filePath)
        if (!file.exists()) {
            throw IllegalStateException("Vault file not found: $filePath")
        }

        // SECURITY FIX: Read salt from file header (no longer deterministic)
        val header = getVaultFileInfo(filePath)
            ?: throw IllegalStateException("Invalid vault file header")

        val salt = cryptoManager.hexToBytes(header.salt)
        val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

        return readVaultFile(file, vaultKey)
    }

    /**
     * Sauvegarde un fichier vault
     */
    suspend fun saveVaultFile(
        vaultId: String,
        data: VaultData,
        vaultKey: SecretKey,
        strategy: StorageStrategy,
        customPath: Uri? = null,
        saltHex: String? = null  // SECURITY FIX: Pass salt for storage in header
    ): File {
        if (strategy == StorageStrategy.CUSTOM && customPath != null) {
            // Utiliser SAF pour custom paths
            throw UnsupportedOperationException("Use createVaultFileToUri for custom paths - this returns Uri, not File")
        }

        val dir = getStorageDirectory(strategy)
        val file = File(dir, getVaultFileName(vaultId))

        // If salt not provided, try to read from existing file header
        val effectiveSalt = saltHex ?: run {
            if (file.exists()) {
                getVaultFileInfo(file.absolutePath)?.salt
                    ?: throw IllegalStateException("Cannot read salt from existing file")
            } else {
                throw IllegalArgumentException("Salt must be provided for new vault files")
            }
        }

        return writeVaultFile(file, data, vaultKey, vaultId, effectiveSalt)
    }

    /**
     * Lit un fichier vault et déchiffre le contenu
     */
    private suspend fun readVaultFile(file: File, vaultKey: SecretKey): VaultData {
        try {
            FileInputStream(file).use { fis ->
                // Lire le header (256 bytes)
                val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                fis.read(headerBytes)
                val headerJson = String(headerBytes).trim('\u0000')
                val header = gson.fromJson(headerJson, VaultFileHeader::class.java)

                // Valider le header
                if (!header.isValid()) {
                    throw IllegalStateException("Invalid vault file header")
                }

                // Lire le contenu chiffré
                val encryptedContent = fis.readBytes()

                // Déchiffrer le contenu
                val decryptedJson = cryptoManager.decryptBytes(encryptedContent, vaultKey)
                val decryptedString = String(decryptedJson, Charsets.UTF_8)

                // Parser le JSON
                val vaultData = gson.fromJson(decryptedString, VaultData::class.java)

                // SECURITY FIX: Valider le checksum strictement
                val contentChecksum = calculateChecksum(decryptedString)
                if (contentChecksum != header.checksum) {
                    Log.e(TAG, "Checksum mismatch! Expected: ${header.checksum}, Got: $contentChecksum")
                    throw com.julien.genpwdpro.domain.exceptions.VaultException.DataCorruption(
                        "Vault file checksum mismatch. File may be corrupted or tampered with."
                    )
                }

                return vaultData
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading vault file", e)
            throw e
        }
    }

    /**
     * Écrit un fichier vault avec chiffrement
     */
    private suspend fun writeVaultFile(
        file: File,
        data: VaultData,
        vaultKey: SecretKey,
        vaultId: String,
        saltHex: String  // SECURITY FIX: Salt to include in header
    ): File {
        try {
            // Mettre à jour le timestamp de modification
            val updatedData = data.copy(
                metadata = data.metadata.copy(
                    modifiedAt = System.currentTimeMillis()
                )
            )

            // Sérialiser les données
            val dataJson = gson.toJson(updatedData)

            // Chiffrer le contenu
            val encryptedContent = cryptoManager.encryptBytes(
                dataJson.toByteArray(Charsets.UTF_8),
                vaultKey
            )

            // Calculer le checksum
            val checksum = calculateChecksum(dataJson)

            // Créer le header avec le salt
            val header = VaultFileHeader(
                vaultId = vaultId,
                salt = effectiveSalt,  // SECURITY FIX: Store random salt in header
                createdAt = updatedData.metadata.createdAt,
                modifiedAt = updatedData.metadata.modifiedAt,
                checksum = checksum
            )

            // Écrire le fichier
            FileOutputStream(file).use { fos ->
                // Écrire le header (padding à 256 bytes)
                val headerJson = gson.toJson(header)
                val headerBytes = headerJson.toByteArray(Charsets.UTF_8)
                val paddedHeader = ByteArray(VaultFileHeader.HEADER_SIZE)
                System.arraycopy(headerBytes, 0, paddedHeader, 0, minOf(headerBytes.size, paddedHeader.size))
                fos.write(paddedHeader)

                // Écrire le contenu chiffré
                fos.write(encryptedContent)
            }

            Log.d(TAG, "Vault file written successfully: ${file.absolutePath}")
            return file

        } catch (e: Exception) {
            Log.e(TAG, "Error writing vault file", e)
            throw e
        }
    }

    /**
     * Calcule le checksum SHA-256 d'une chaîne
     */
    private fun calculateChecksum(data: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Supprime un fichier vault
     */
    suspend fun deleteVaultFile(filePath: String): Boolean {
        return try {
            val file = File(filePath)
            if (file.exists()) {
                file.delete()
            } else {
                Log.w(TAG, "Vault file not found for deletion: $filePath")
                true  // Already deleted
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting vault file", e)
            false
        }
    }

    /**
     * Exporte un vault vers une destination
     */
    suspend fun exportVault(sourcePath: String, destinationPath: String): Boolean {
        return try {
            val source = File(sourcePath)
            val destination = File(destinationPath)

            source.copyTo(destination, overwrite = true)

            Log.d(TAG, "Vault exported to: $destinationPath")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error exporting vault", e)
            false
        }
    }

    /**
     * Exporte un vault vers une URI (Storage Access Framework)
     */
    suspend fun exportVault(
        vaultId: String,
        sourceFilePath: String,
        destinationUri: Uri
    ): Boolean {
        return try {
            val sourceFile = File(sourceFilePath)
            if (!sourceFile.exists()) {
                Log.e(TAG, "Source vault file not found: $sourceFilePath")
                return false
            }

            context.contentResolver.openOutputStream(destinationUri)?.use { outputStream ->
                sourceFile.inputStream().use { inputStream ->
                    inputStream.copyTo(outputStream)
                }
            }

            Log.d(TAG, "Vault exported to URI: $destinationUri")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error exporting vault to URI", e)
            false
        }
    }

    /**
     * Importe un vault depuis une URI (Storage Access Framework)
     */
    suspend fun importVault(
        sourceUri: Uri,
        destinationStrategy: StorageStrategy
    ): Pair<String, File> {
        try {
            // Lire le fichier source
            val tempFile = File(context.cacheDir, "temp_import_${System.currentTimeMillis()}.gpv")

            context.contentResolver.openInputStream(sourceUri)?.use { inputStream ->
                tempFile.outputStream().use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            } ?: throw IllegalStateException("Cannot open input stream from URI")

            // Lire le header pour obtenir le vaultId
            val header = getVaultFileInfo(tempFile.absolutePath)
                ?: throw IllegalStateException("Invalid vault file")

            val vaultId = header.vaultId

            // Copier vers la destination finale
            val destDir = getStorageDirectory(destinationStrategy)
            val destFile = File(destDir, getVaultFileName(vaultId))

            tempFile.copyTo(destFile, overwrite = true)
            tempFile.delete()

            Log.d(TAG, "Vault imported: $vaultId to ${destFile.absolutePath}")
            return Pair(vaultId, destFile)

        } catch (e: Exception) {
            Log.e(TAG, "Error importing vault", e)
            throw e
        }
    }

    /**
     * Récupère les informations d'un fichier vault sans le déchiffrer
     */
    fun getVaultFileInfo(filePath: String): VaultFileHeader? {
        return try {
            val file = File(filePath)
            if (!file.exists()) return null

            FileInputStream(file).use { fis ->
                val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                fis.read(headerBytes)
                val headerJson = String(headerBytes).trim('\u0000')
                gson.fromJson(headerJson, VaultFileHeader::class.java)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading vault file info", e)
            null
        }
    }

    /**
     * Vérifie si un fichier vault existe
     */
    fun vaultFileExists(filePath: String): Boolean {
        return File(filePath).exists()
    }

    /**
     * Récupère la taille d'un fichier vault
     */
    fun getVaultFileSize(filePath: String): Long {
        return File(filePath).length()
    }

    // ========== Storage Access Framework (SAF) Methods ==========

    /**
     * Crée un nouveau vault dans un dossier sélectionné via SAF
     *
     * @param name Nom du vault
     * @param masterPassword Master password
     * @param customFolderUri URI du dossier sélectionné via SAF
     * @param description Description optionnelle
     * @return Pair(vaultId, fileUri)
     */
    suspend fun createVaultFileToUri(
        name: String,
        masterPassword: String,
        customFolderUri: Uri,
        description: String? = null
    ): Pair<String, Uri> {
        val vaultId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()

        // Prendre les permissions persistantes sur le dossier
        context.contentResolver.takePersistableUriPermission(
            customFolderUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )

        // SECURITY FIX: Generate a RANDOM salt (not deterministic)
        val salt = cryptoManager.generateSalt()
        val saltHex = cryptoManager.bytesToHex(salt)
        val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

        // Créer les métadonnées initiales
        val metadata = VaultMetadata(
            vaultId = vaultId,
            name = name,
            description = description,
            isDefault = false,
            createdAt = timestamp,
            modifiedAt = timestamp,
            statistics = VaultStatistics()
        )

        // Créer le vault vide
        val vaultData = VaultData(
            metadata = metadata,
            entries = emptyList(),
            folders = emptyList(),
            tags = emptyList(),
            presets = emptyList(),
            entryTags = emptyList()
        )

        // Sauvegarder dans le dossier SAF avec le salt généré
        val fileUri = saveVaultFileToUri(vaultId, vaultData, vaultKey, customFolderUri, saltHex)

        return Pair(vaultId, fileUri)
    }

    /**
     * Sauvegarde un vault dans un dossier SAF
     *
     * @param vaultId ID du vault
     * @param data Données du vault
     * @param vaultKey Clé de chiffrement
     * @param customFolderUri URI du dossier
     * @return URI du fichier créé
     */
    suspend fun saveVaultFileToUri(
        vaultId: String,
        data: VaultData,
        vaultKey: SecretKey,
        customFolderUri: Uri,
        saltHex: String? = null  // SECURITY FIX: Pass salt for storage in header
    ): Uri {
        try {
            val folder = DocumentFile.fromTreeUri(context, customFolderUri)
                ?: throw IllegalStateException("Cannot access custom folder")

            val fileName = getVaultFileName(vaultId)

            // Vérifier si le fichier existe déjà
            var vaultFile = folder.findFile(fileName)
            var existingFile = false

            // Si le fichier n'existe pas, le créer
            if (vaultFile == null) {
                vaultFile = folder.createFile("application/octet-stream", fileName)
                    ?: throw IllegalStateException("Cannot create vault file in custom folder")
            } else {
                existingFile = true
            }

            // SECURITY FIX: Determine effective salt
            val effectiveSalt = saltHex ?: run {
                if (existingFile) {
                    // Read salt from existing file header
                    val existingHeader = try {
                        context.contentResolver.openInputStream(vaultFile.uri)?.use { inputStream ->
                            val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                            inputStream.read(headerBytes)
                            val headerJson = String(headerBytes).trim('\u0000')
                            gson.fromJson(headerJson, VaultFileHeader::class.java)
                        }
                    } catch (e: Exception) {
                        null
                    }
                    existingHeader?.salt ?: throw IllegalStateException("Cannot read salt from existing file")
                } else {
                    throw IllegalArgumentException("Salt must be provided for new vault files")
                }
            }

            // Mettre à jour le timestamp de modification
            val updatedData = data.copy(
                metadata = data.metadata.copy(
                    modifiedAt = System.currentTimeMillis()
                )
            )

            // Sérialiser les données
            val dataJson = gson.toJson(updatedData)

            // Chiffrer le contenu
            val encryptedContent = cryptoManager.encryptBytes(
                dataJson.toByteArray(Charsets.UTF_8),
                vaultKey
            )

            // Calculer le checksum
            val checksum = calculateChecksum(dataJson)

            // Créer le header avec le salt
            val header = VaultFileHeader(
                vaultId = vaultId,
                salt = effectiveSalt,  // SECURITY FIX: Store random salt in header
                createdAt = updatedData.metadata.createdAt,
                modifiedAt = updatedData.metadata.modifiedAt,
                checksum = checksum
            )

            // Écrire le fichier via SAF
            context.contentResolver.openOutputStream(vaultFile.uri, "wt")?.use { outputStream ->
                // Écrire le header (padding à 256 bytes)
                val headerJson = gson.toJson(header)
                val headerBytes = headerJson.toByteArray(Charsets.UTF_8)
                val paddedHeader = ByteArray(VaultFileHeader.HEADER_SIZE)
                System.arraycopy(headerBytes, 0, paddedHeader, 0, minOf(headerBytes.size, paddedHeader.size))
                outputStream.write(paddedHeader)

                // Écrire le contenu chiffré
                outputStream.write(encryptedContent)
                outputStream.flush()
            } ?: throw IllegalStateException("Cannot open output stream")

            Log.d(TAG, "Vault file written to SAF URI: ${vaultFile.uri}")
            return vaultFile.uri

        } catch (e: Exception) {
            Log.e(TAG, "Error writing vault file to SAF", e)
            throw e
        }
    }

    /**
     * Met à jour un fichier vault existant à une URI SAF donnée
     *
     * @param fileUri URI du fichier existant
     * @param data Données du vault à écrire
     * @param vaultKey Clé de chiffrement dérivée du master password
     */
    suspend fun updateVaultFileAtUri(
        fileUri: Uri,
        data: VaultData,
        vaultKey: SecretKey
    ) {
        try {
            // SECURITY FIX: Read salt from existing file header
            val existingSalt = context.contentResolver.openInputStream(fileUri)?.use { inputStream ->
                val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                inputStream.read(headerBytes)
                val headerJson = String(headerBytes).trim('\u0000')
                val header = gson.fromJson(headerJson, VaultFileHeader::class.java)
                header.salt
            } ?: throw IllegalStateException("Cannot read salt from existing file at URI: $fileUri")

            val updatedData = data.copy(
                metadata = data.metadata.copy(
                    modifiedAt = System.currentTimeMillis()
                )
            )

            val dataJson = gson.toJson(updatedData)
            val encryptedContent = cryptoManager.encryptBytes(
                dataJson.toByteArray(Charsets.UTF_8),
                vaultKey
            )

            val checksum = calculateChecksum(dataJson)
            val header = VaultFileHeader(
                vaultId = updatedData.metadata.vaultId,
                salt = existingSalt,  // SECURITY FIX: Preserve salt from existing file
                createdAt = updatedData.metadata.createdAt,
                modifiedAt = updatedData.metadata.modifiedAt,
                checksum = checksum
            )

            context.contentResolver.openOutputStream(fileUri, "wt")?.use { outputStream ->
                val headerJson = gson.toJson(header)
                val headerBytes = headerJson.toByteArray(Charsets.UTF_8)
                val paddedHeader = ByteArray(VaultFileHeader.HEADER_SIZE)
                System.arraycopy(headerBytes, 0, paddedHeader, 0, minOf(headerBytes.size, paddedHeader.size))
                outputStream.write(paddedHeader)
                outputStream.write(encryptedContent)
                outputStream.flush()
            } ?: throw IllegalStateException("Cannot open output stream for URI: $fileUri")

            Log.d(TAG, "Vault file updated at SAF URI: $fileUri")
        } catch (e: Exception) {
            Log.e(TAG, "Error updating vault file at SAF URI", e)
            throw e
        }
    }

    /**
     * Charge un vault depuis une URI SAF
     *
     * @param vaultId ID du vault
     * @param masterPassword Master password
     * @param fileUri URI du fichier
     * @return Données déchiffrées du vault
     */
    suspend fun loadVaultFileFromUri(
        vaultId: String,
        masterPassword: String,
        fileUri: Uri
    ): VaultData {
        try {
            context.contentResolver.openInputStream(fileUri)?.use { inputStream ->
                // Lire le header (256 bytes)
                val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                inputStream.read(headerBytes)
                val headerJson = String(headerBytes).trim('\u0000')
                val header = gson.fromJson(headerJson, VaultFileHeader::class.java)

                // SECURITY FIX: Read salt from header (no longer deterministic)
                val salt = cryptoManager.hexToBytes(header.salt)
                val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

                // Valider le header
                if (!header.isValid()) {
                    throw IllegalStateException("Invalid vault file header")
                }

                // Lire le contenu chiffré
                val encryptedContent = inputStream.readBytes()

                // Déchiffrer le contenu
                val decryptedJson = cryptoManager.decryptBytes(encryptedContent, vaultKey)
                val decryptedString = String(decryptedJson, Charsets.UTF_8)

                // Parser le JSON
                val vaultData = gson.fromJson(decryptedString, VaultData::class.java)

                // SECURITY FIX: Valider le checksum strictement
                val contentChecksum = calculateChecksum(decryptedString)
                if (contentChecksum != header.checksum) {
                    Log.e(TAG, "Checksum mismatch! Expected: ${header.checksum}, Got: $contentChecksum")
                    throw com.julien.genpwdpro.domain.exceptions.VaultException.DataCorruption(
                        "Vault file checksum mismatch. File may be corrupted or tampered with."
                    )
                }

                return vaultData
            } ?: throw IllegalStateException("Cannot open input stream from URI")

        } catch (e: Exception) {
            Log.e(TAG, "Error reading vault file from SAF", e)
            throw e
        }
    }

    /**
     * Obtient la taille d'un fichier via son URI SAF
     */
    fun getVaultFileSizeFromUri(fileUri: Uri): Long {
        return try {
            val documentFile = DocumentFile.fromSingleUri(context, fileUri)
            documentFile?.length() ?: 0L
        } catch (e: Exception) {
            Log.e(TAG, "Error getting file size from URI", e)
            0L
        }
    }

    /**
     * Convertit une URI en chemin pour stockage dans la base de données
     * Pour SAF, on stocke l'URI en string
     */
    fun uriToPath(uri: Uri): String {
        return uri.toString()
    }

    /**
     * Convertit un chemin stocké en URI
     * Détecte automatiquement si c'est un chemin File ou une URI
     */
    fun pathToUri(path: String): Uri? {
        return try {
            if (path.startsWith("content://")) {
                Uri.parse(path)
            } else {
                null // C'est un chemin File normal
            }
        } catch (e: Exception) {
            null
        }
    }
}
