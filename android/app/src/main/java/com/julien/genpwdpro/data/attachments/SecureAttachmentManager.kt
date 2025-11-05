package com.julien.genpwdpro.data.attachments

import android.content.Context
import android.net.Uri
import com.google.crypto.tink.Aead
import com.julien.genpwdpro.crypto.TinkAesGcmCryptoEngine
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de pièces jointes sécurisées
 *
 * Fonctionnalités:
 * - Chiffrement AES-256-GCM de tous les fichiers
 * - Stockage sécurisé dans le répertoire privé de l'app
 * - Gestion de la taille et du quota
 * - Détection de type MIME
 * - Miniatures pour les images
 * - Vérification d'intégrité (SHA-256)
 *
 * TODO: Réactiver Hilt injection une fois que TinkAesGcmCryptoEngine aura un module Hilt
 */
// @Singleton
class SecureAttachmentManager /* @Inject */ constructor(
    // @ApplicationContext
    private val context: Context,
    private val cryptoEngine: TinkAesGcmCryptoEngine
) {
    companion object {
        private const val ATTACHMENTS_DIR = "secure_attachments"
        private const val MAX_FILE_SIZE = 50 * 1024 * 1024L // 50 MB
        private const val MAX_TOTAL_SIZE = 500 * 1024 * 1024L // 500 MB
        private const val CHUNK_SIZE = 8192

        // Types MIME autorisés (sécurité)
        private val ALLOWED_MIME_TYPES = setOf(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "text/plain", "text/csv",
            "application/json",
            "application/zip", "application/x-zip-compressed"
        )
    }

    private val attachmentsDir: File
        get() = File(context.filesDir, ATTACHMENTS_DIR).apply {
            if (!exists()) mkdirs()
        }

    /**
     * Ajoute une pièce jointe chiffrée
     */
    suspend fun addAttachment(
        entryId: String,
        uri: Uri,
        encryptionKey: ByteArray
    ): SecureAttachment = withContext(Dispatchers.IO) {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw IllegalArgumentException("Impossible d'ouvrir le fichier")

        inputStream.use { input ->
            // Vérifier la taille
            val fileSize = getFileSize(uri)
            if (fileSize > MAX_FILE_SIZE) {
                throw AttachmentException("Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} MB)")
            }

            // Vérifier le quota total
            val totalSize = getTotalAttachmentsSize()
            if (totalSize + fileSize > MAX_TOTAL_SIZE) {
                throw AttachmentException("Quota de stockage atteint (max ${MAX_TOTAL_SIZE / 1024 / 1024} MB)")
            }

            // Déterminer le type MIME
            val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"

            // Vérifier le type MIME
            if (mimeType !in ALLOWED_MIME_TYPES && !mimeType.startsWith("text/")) {
                throw AttachmentException("Type de fichier non autorisé: $mimeType")
            }

            // Obtenir le nom du fichier
            val fileName = getFileName(uri) ?: "attachment_${UUID.randomUUID()}"

            // Générer un ID unique pour la pièce jointe
            val attachmentId = UUID.randomUUID().toString()

            // Chiffrer et sauvegarder
            val encryptedFile = File(attachmentsDir, "$attachmentId.enc")
            val sha256Hash = encryptAndSave(input, encryptedFile, encryptionKey)

            SecureAttachment(
                id = attachmentId,
                entryId = entryId,
                fileName = fileName,
                mimeType = mimeType,
                size = fileSize,
                sha256Hash = sha256Hash,
                encryptedPath = encryptedFile.absolutePath,
                createdAt = System.currentTimeMillis()
            )
        }
    }

    /**
     * Chiffre et sauvegarde un fichier
     */
    private fun encryptAndSave(
        input: InputStream,
        outputFile: File,
        key: ByteArray
    ): String {
        val sha256 = MessageDigest.getInstance("SHA-256")

        outputFile.outputStream().use { output ->
            val buffer = ByteArray(CHUNK_SIZE)
            var bytesRead: Int

            // Lire et chiffrer par chunks
            while (input.read(buffer).also { bytesRead = it } != -1) {
                // Mettre à jour le hash
                sha256.update(buffer, 0, bytesRead)

                // Chiffrer le chunk
                val chunk = buffer.copyOf(bytesRead)
                val encrypted = cryptoEngine.encrypt(chunk, key)
                output.write(encrypted)
            }
        }

        return bytesToHex(sha256.digest())
    }

    /**
     * Récupère une pièce jointe déchiffrée
     */
    suspend fun getAttachment(
        attachment: SecureAttachment,
        encryptionKey: ByteArray
    ): ByteArray = withContext(Dispatchers.IO) {
        val encryptedFile = File(attachment.encryptedPath)

        if (!encryptedFile.exists()) {
            throw AttachmentException("Pièce jointe introuvable")
        }

        // Lire et déchiffrer
        val encrypted = encryptedFile.readBytes()
        val decrypted = cryptoEngine.decrypt(encrypted, encryptionKey)

        // Vérifier l'intégrité
        val sha256 = MessageDigest.getInstance("SHA-256")
        val hash = bytesToHex(sha256.digest(decrypted))

        if (hash != attachment.sha256Hash) {
            throw AttachmentException("Intégrité de la pièce jointe compromise")
        }

        decrypted
    }

    /**
     * Supprime une pièce jointe
     */
    suspend fun deleteAttachment(attachment: SecureAttachment) = withContext(Dispatchers.IO) {
        val file = File(attachment.encryptedPath)
        if (file.exists()) {
            // Écraser le fichier avec des données aléatoires avant suppression (sécurité)
            secureDelete(file)
        }
    }

    /**
     * Liste toutes les pièces jointes d'une entrée
     */
    suspend fun getAttachmentsForEntry(entryId: String): List<SecureAttachment> {
        // À implémenter avec une base de données pour stocker les métadonnées
        // Pour l'instant, retourne une liste vide
        return emptyList()
    }

    /**
     * Obtient la taille d'un fichier via URI
     */
    private fun getFileSize(uri: Uri): Long {
        return context.contentResolver.openInputStream(uri)?.use { input ->
            input.available().toLong()
        } ?: 0L
    }

    /**
     * Obtient le nom d'un fichier via URI
     */
    private fun getFileName(uri: Uri): String? {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        return cursor?.use {
            val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (it.moveToFirst() && nameIndex != -1) {
                it.getString(nameIndex)
            } else null
        }
    }

    /**
     * Calcule la taille totale des pièces jointes
     */
    private fun getTotalAttachmentsSize(): Long {
        return attachmentsDir.listFiles()?.sumOf { it.length() } ?: 0L
    }

    /**
     * Suppression sécurisée d'un fichier (overwrite)
     */
    private fun secureDelete(file: File) {
        if (!file.exists()) return

        val size = file.length()
        val random = Random()

        // Écraser 3 fois avec des données aléatoires
        repeat(3) {
            file.outputStream().use { output ->
                val buffer = ByteArray(CHUNK_SIZE)
                var written = 0L
                while (written < size) {
                    random.nextBytes(buffer)
                    val toWrite = minOf(CHUNK_SIZE.toLong(), size - written).toInt()
                    output.write(buffer, 0, toWrite)
                    written += toWrite
                }
            }
        }

        // Supprimer finalement
        file.delete()
    }

    /**
     * Convertit bytes en hex
     */
    private fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Génère une miniature pour les images
     */
    suspend fun generateThumbnail(
        attachment: SecureAttachment,
        encryptionKey: ByteArray,
        maxSize: Int = 256
    ): ByteArray? = withContext(Dispatchers.IO) {
        if (!attachment.mimeType.startsWith("image/")) return@withContext null

        try {
            val imageData = getAttachment(attachment, encryptionKey)

            // TODO: Implémenter la génération de miniature avec Android Bitmap
            // val bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.size)
            // val thumbnail = Bitmap.createScaledBitmap(bitmap, maxSize, maxSize, true)
            // ...

            null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Nettoie les pièces jointes orphelines
     */
    suspend fun cleanOrphanedAttachments(validEntryIds: Set<String>) = withContext(Dispatchers.IO) {
        // À implémenter: supprimer les fichiers dont les entrées n'existent plus
    }
}

/**
 * Modèle de pièce jointe sécurisée
 */
data class SecureAttachment(
    val id: String,
    val entryId: String,
    val fileName: String,
    val mimeType: String,
    val size: Long,
    val sha256Hash: String,
    val encryptedPath: String,
    val createdAt: Long,
    val thumbnailPath: String? = null
)

/**
 * Exception pour les erreurs de pièces jointes
 */
class AttachmentException(message: String) : Exception(message)
