package com.julien.genpwdpro.data.vault

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.julien.genpwdpro.core.log.SafeLog
import androidx.documentfile.provider.DocumentFile
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.models.vault.*
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream
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
        private const val MIME_TYPE_VAULT = "application/octet-stream"
    }

    data class VaultFileLocation(
        val file: File? = null,
        val uri: Uri? = null
    ) {
        fun requirePath(): String {
            return file?.absolutePath ?: uri?.toString()
                ?: throw IllegalStateException("Vault file location is undefined")
        }
    }

    private val publicRelativePath: String =
        "${Environment.DIRECTORY_DOCUMENTS}/$PUBLIC_DIR_NAME/"

    /**
     * Récupère le répertoire de stockage selon la stratégie
     */
    fun getStorageDirectory(strategy: StorageStrategy, customPath: Uri? = null): File {
        val directory = when (strategy) {
            StorageStrategy.INTERNAL -> {
                File(context.filesDir, VAULTS_DIR_NAME)
            }
            StorageStrategy.APP_STORAGE -> {
                File(context.getExternalFilesDir(null), VAULTS_DIR_NAME)
            }
            StorageStrategy.PUBLIC_DOCUMENTS -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    throw UnsupportedOperationException(
                        "Public documents strategy uses MediaStore on Android 10+"
                    )
                }
                File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
                    PUBLIC_DIR_NAME
                )
            }
            StorageStrategy.CUSTOM -> {
                // Pour custom, on utilise le SAF, géré séparément
                throw UnsupportedOperationException("Custom paths use Storage Access Framework")
            }
        }

        ensureDirectory(directory)
        return directory
    }

    private fun ensureDirectory(directory: File) {
        if (!directory.exists()) {
            val created = directory.mkdirs()
            if (!created && !directory.exists()) {
                SafeLog.e(TAG, "Unable to create storage directory: ${SafeLog.redact(directory.absolutePath)}")
                throw IOException("Unable to create storage directory")
            }
        }

        if (!directory.isDirectory) {
            SafeLog.e(TAG, "Storage path is not a directory: ${SafeLog.redact(directory.absolutePath)}")
            throw IOException("Invalid storage directory")
        }

        if (!directory.canWrite()) {
            SafeLog.e(TAG, "Storage directory not writable: ${SafeLog.redact(directory.absolutePath)}")
            throw IOException("Storage directory not writable")
        }
    }

    /**
     * Génère le nom de fichier pour un vault
     */
    private fun getVaultFileName(vaultId: String): String {
        return "vault_$vaultId$VAULT_EXTENSION"
    }

    private data class VaultPayload(
        val headerBytes: ByteArray,
        val encryptedContent: ByteArray
    )

    private fun buildVaultPayload(
        data: VaultData,
        vaultKey: SecretKey,
        vaultId: String
    ): VaultPayload {
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
            vaultId = vaultId,
            createdAt = updatedData.metadata.createdAt,
            modifiedAt = updatedData.metadata.modifiedAt,
            checksum = checksum
        )

        val headerJson = gson.toJson(header)
        val headerBytes = headerJson.toByteArray(Charsets.UTF_8)
        val paddedHeader = ByteArray(VaultFileHeader.HEADER_SIZE)
        System.arraycopy(
            headerBytes,
            0,
            paddedHeader,
            0,
            minOf(headerBytes.size, paddedHeader.size)
        )

        return VaultPayload(
            headerBytes = paddedHeader,
            encryptedContent = encryptedContent
        )
    }

    private fun OutputStream.writeVaultPayload(payload: VaultPayload) {
        write(payload.headerBytes)
        write(payload.encryptedContent)
        flush()
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
    ): Pair<String, VaultFileLocation> {
        val vaultId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()

        // Créer la clé depuis le master password
        // Utilise vaultId comme seed pour un salt déterministe
        val salt = cryptoManager.generateSaltFromString(vaultId)
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

        // Sauvegarder
        val location = saveVaultFile(vaultId, vaultData, vaultKey, strategy, customPath)

        return Pair(vaultId, location)
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

        // Dériver la clé depuis le master password
        // Utilise vaultId comme seed pour le salt (même salt qu'à la création)
        val salt = cryptoManager.generateSaltFromString(vaultId)
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
        customPath: Uri? = null
    ): VaultFileLocation {
        if (strategy == StorageStrategy.CUSTOM && customPath != null) {
            // Utiliser SAF pour custom paths
            throw UnsupportedOperationException(
                "Use createVaultFileToUri for custom paths - this returns Uri, not File"
            )
        }

        return if (strategy == StorageStrategy.PUBLIC_DOCUMENTS && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val uri = writeVaultFileToPublicDocuments(vaultId, data, vaultKey)
            VaultFileLocation(uri = uri)
        } else {
            val dir = getStorageDirectory(strategy)
            val file = File(dir, getVaultFileName(vaultId))
            val written = writeVaultFile(file, data, vaultKey, vaultId)
            VaultFileLocation(file = written)
        }
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

                // Valider le checksum
                val contentChecksum = calculateChecksum(decryptedString)
                if (contentChecksum != header.checksum) {
                    SafeLog.w(TAG, "Checksum mismatch - file may be corrupted")
                }

                return vaultData
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error reading vault file", e)
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
        vaultId: String
    ): File {
        try {
            val payload = buildVaultPayload(data, vaultKey, vaultId)

            FileOutputStream(file).use { fos ->
                fos.writeVaultPayload(payload)
            }

            SafeLog.d(TAG, "Vault file written successfully: ${SafeLog.redact(file.absolutePath)}")
            return file
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error writing vault file", e)
            throw e
        }
    }

    private fun findExistingPublicDocumentUri(fileName: String): Uri? {
        val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val projection = arrayOf(MediaStore.Files.FileColumns._ID)
        val selection =
            "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
        val selectionArgs = arrayOf(fileName, publicRelativePath)

        return context.contentResolver.query(
            collection,
            projection,
            selection,
            selectionArgs,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val id = cursor.getLong(idColumn)
                ContentUris.withAppendedId(collection, id)
            } else {
                null
            }
        }
    }

    private fun preparePublicDocumentUri(fileName: String): Pair<Uri, Boolean> {
        val resolver = context.contentResolver
        val existingUri = findExistingPublicDocumentUri(fileName)
        if (existingUri != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val pendingValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                resolver.update(existingUri, pendingValues, null, null)
            }
            return existingUri to false
        }

        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, MIME_TYPE_VAULT)
            put(MediaStore.MediaColumns.RELATIVE_PATH, publicRelativePath)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val createdUri = resolver.insert(collection, values)
            ?: throw IOException("Unable to create public documents entry")

        return createdUri to true
    }

    private suspend fun writeVaultFileToPublicDocuments(
        vaultId: String,
        data: VaultData,
        vaultKey: SecretKey
    ): Uri {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw UnsupportedOperationException("MediaStore public documents requires Android 10+")
        }

        val fileName = getVaultFileName(vaultId)
        val (targetUri, isNewEntry) = preparePublicDocumentUri(fileName)
        val resolver = context.contentResolver
        val payload = buildVaultPayload(data, vaultKey, vaultId)

        var writeSucceeded = false
        try {
            resolver.openOutputStream(targetUri, "wt")?.use { outputStream ->
                outputStream.writeVaultPayload(payload)
            } ?: throw IOException("Cannot open output stream for MediaStore URI")
            writeSucceeded = true
            SafeLog.d(TAG, "Vault file written to public documents: ${SafeLog.redact(targetUri)}")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error writing vault file to public documents", e)
            if (isNewEntry) {
                resolver.delete(targetUri, null, null)
            }
            throw e
        } finally {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val finalizeValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.IS_PENDING, 0)
                }
                resolver.update(targetUri, finalizeValues, null, null)
            }

            if (!writeSucceeded && isNewEntry) {
                // Ensure cleanup when write failed before reaching catch (rare cases)
                resolver.delete(targetUri, null, null)
            }
        }

        return targetUri
    }

    private fun copyRawFileToPublicDocuments(tempFile: File, vaultId: String): Uri {
        val fileName = getVaultFileName(vaultId)
        val (targetUri, isNewEntry) = preparePublicDocumentUri(fileName)
        val resolver = context.contentResolver

        var writeSucceeded = false
        try {
            resolver.openOutputStream(targetUri, "wt")?.use { outputStream ->
                tempFile.inputStream().use { inputStream ->
                    inputStream.copyTo(outputStream)
                }
            } ?: throw IOException("Cannot open output stream for MediaStore URI")
            writeSucceeded = true
            SafeLog.d(
                TAG,
                "Vault file copied to public documents: ${SafeLog.redact(targetUri)}"
            )
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error copying vault file to public documents", e)
            if (isNewEntry) {
                resolver.delete(targetUri, null, null)
            }
            throw e
        } finally {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val finalizeValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.IS_PENDING, 0)
                }
                resolver.update(targetUri, finalizeValues, null, null)
            }

            if (!writeSucceeded && isNewEntry) {
                resolver.delete(targetUri, null, null)
            }
        }

        return targetUri
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
        val targetUri = pathToUri(filePath)
        return when {
            targetUri != null -> deleteVaultFile(targetUri)
            else -> deleteVaultFile(File(filePath))
        }
    }

    suspend fun deleteVaultFile(file: File): Boolean = runCatching {
        if (!file.exists()) {
            SafeLog.w(TAG, "Vault file not found for deletion: ${SafeLog.redact(file.absolutePath)}")
            true
        } else {
            file.delete()
        }
    }.getOrElse {
        SafeLog.e(TAG, "Error deleting vault file", it)
        false
    }

    suspend fun deleteVaultFile(fileUri: Uri): Boolean = runCatching {
        val document = DocumentFile.fromSingleUri(context, fileUri)
        if (document == null) {
            SafeLog.w(TAG, "DocumentFile not found for URI: ${SafeLog.redact(fileUri.toString())}")
            true
        } else if (!document.exists()) {
            SafeLog.w(TAG, "Vault file not found for deletion (URI): ${SafeLog.redact(fileUri.toString())}")
            true
        } else {
            document.delete()
        }
    }.getOrElse {
        SafeLog.e(TAG, "Error deleting vault file from URI", it)
        false
    }

    /**
     * Exporte un vault vers une destination
     */
    suspend fun exportVault(sourcePath: String, destinationPath: String): Boolean {
        return try {
            val destination = File(destinationPath)

            val bytesCopied = copyVaultToStream(
                sourcePath = sourcePath,
                openOutputStream = { destination.outputStream() }
            )

            if (bytesCopied <= 0L) {
                SafeLog.e(
                    TAG,
                    "No bytes exported from ${SafeLog.redact(sourcePath)} to ${SafeLog.redact(destinationPath)}"
                )
                return false
            }

            SafeLog.d(TAG, "Vault exported to: ${SafeLog.redact(destinationPath)} (${bytesCopied} bytes)")
            true
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error exporting vault", e)
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
            val bytesCopied = copyVaultToStream(
                sourcePath = sourceFilePath,
                openOutputStream = {
                    context.contentResolver.openOutputStream(destinationUri)
                        ?: throw IOException("Unable to open output stream for destination URI")
                }
            )

            if (bytesCopied <= 0L) {
                SafeLog.e(
                    TAG,
                    "No bytes exported for vault=${SafeLog.redact(vaultId)}"
                )
                return false
            }

            SafeLog.d(TAG, "Vault exported to URI: ${SafeLog.redact(destinationUri)}")
            true
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error exporting vault to URI", e)
            false
        }
    }

    private fun copyVaultToStream(
        sourcePath: String,
        openOutputStream: () -> OutputStream
    ): Long {
        val sourceUri = pathToUri(sourcePath)
        return if (sourceUri != null) {
            copyFromUri(sourceUri, openOutputStream)
        } else {
            copyFromFile(File(sourcePath), openOutputStream)
        }
    }

    private fun copyFromFile(
        sourceFile: File,
        openOutputStream: () -> OutputStream
    ): Long {
        if (!sourceFile.exists()) {
            SafeLog.e(TAG, "Source vault file not found: ${SafeLog.redact(sourceFile.absolutePath)}")
            return 0L
        }

        return try {
            openOutputStream().use { outputStream ->
                FileInputStream(sourceFile).use { inputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        } catch (ioe: IOException) {
            SafeLog.e(TAG, "Error copying vault from file", ioe)
            0L
        }
    }

    private fun copyFromUri(
        sourceUri: Uri,
        openOutputStream: () -> OutputStream
    ): Long {
        return try {
            context.contentResolver.openInputStream(sourceUri)?.use { inputStream ->
                openOutputStream().use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            } ?: run {
                SafeLog.e(TAG, "Unable to open input stream from URI: ${SafeLog.redact(sourceUri.toString())}")
                0L
            }
        } catch (ioe: IOException) {
            SafeLog.e(TAG, "Error copying vault from URI", ioe)
            0L
        }
    }

    /**
     * Importe un vault depuis une URI (Storage Access Framework)
     */
    suspend fun importVault(
        sourceUri: Uri,
        destinationStrategy: StorageStrategy
    ): Pair<String, VaultFileLocation> {
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

            val location = if (destinationStrategy == StorageStrategy.PUBLIC_DOCUMENTS && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val uri = copyRawFileToPublicDocuments(tempFile, vaultId)
                tempFile.delete()
                SafeLog.d(
                    TAG,
                    "Vault imported to public documents: ${SafeLog.redact(vaultId)} -> ${SafeLog.redact(uri)}"
                )
                VaultFileLocation(uri = uri)
            } else {
                val destDir = getStorageDirectory(destinationStrategy)
                val destFile = File(destDir, getVaultFileName(vaultId))

                tempFile.copyTo(destFile, overwrite = true)
                tempFile.delete()

                SafeLog.d(
                    TAG,
                    "Vault imported: ${SafeLog.redact(vaultId)} to ${SafeLog.redact(destFile.absolutePath)}"
                )
                VaultFileLocation(file = destFile)
            }

            return Pair(vaultId, location)
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error importing vault", e)
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
            SafeLog.e(TAG, "Error reading vault file info", e)
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

        // Créer la clé depuis le master password
        val salt = cryptoManager.generateSaltFromString(vaultId)
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

        // Sauvegarder dans le dossier SAF
        val fileUri = saveVaultFileToUri(vaultId, vaultData, vaultKey, customFolderUri)

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
        customFolderUri: Uri
    ): Uri {
        try {
            val folder = DocumentFile.fromTreeUri(context, customFolderUri)
                ?: throw IllegalStateException("Cannot access custom folder")

            val fileName = getVaultFileName(vaultId)

            // Vérifier si le fichier existe déjà
            var vaultFile = folder.findFile(fileName)

            // Si le fichier n'existe pas, le créer
            if (vaultFile == null) {
                vaultFile = folder.createFile(MIME_TYPE_VAULT, fileName)
                    ?: throw IllegalStateException("Cannot create vault file in custom folder")
            }

            val payload = buildVaultPayload(data, vaultKey, vaultId)

            // Écrire le fichier via SAF
            context.contentResolver.openOutputStream(vaultFile.uri, "wt")?.use { outputStream ->
                outputStream.writeVaultPayload(payload)
            } ?: throw IllegalStateException("Cannot open output stream")

            SafeLog.d(TAG, "Vault file written to SAF URI: ${SafeLog.redact(vaultFile.uri)}")
            return vaultFile.uri
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error writing vault file to SAF", e)
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
            val payload = buildVaultPayload(data, vaultKey, data.metadata.vaultId)

            context.contentResolver.openOutputStream(fileUri, "wt")?.use { outputStream ->
                outputStream.writeVaultPayload(payload)
            } ?: throw IllegalStateException("Cannot open output stream for URI: $fileUri")

            SafeLog.d(TAG, "Vault file updated at SAF URI: ${SafeLog.redact(fileUri)}")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error updating vault file at SAF URI", e)
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
            // Dériver la clé depuis le master password
            val salt = cryptoManager.generateSaltFromString(vaultId)
            val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

            context.contentResolver.openInputStream(fileUri)?.use { inputStream ->
                // Lire le header (256 bytes)
                val headerBytes = ByteArray(VaultFileHeader.HEADER_SIZE)
                inputStream.read(headerBytes)
                val headerJson = String(headerBytes).trim('\u0000')
                val header = gson.fromJson(headerJson, VaultFileHeader::class.java)

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

                // Valider le checksum
                val contentChecksum = calculateChecksum(decryptedString)
                if (contentChecksum != header.checksum) {
                    SafeLog.w(TAG, "Checksum mismatch - file may be corrupted")
                }

                return vaultData
            } ?: throw IllegalStateException("Cannot open input stream from URI")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error reading vault file from SAF", e)
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
            SafeLog.e(TAG, "Error getting file size from URI", e)
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
