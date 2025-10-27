package com.julien.genpwd-pro.data.vault

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.util.Log
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
        val file = saveVaultFile(vaultId, vaultData, vaultKey, strategy, customPath)

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
    ): File {
        val file = if (strategy == StorageStrategy.CUSTOM && customPath != null) {
            // Utiliser SAF pour custom paths
            throw UnsupportedOperationException("Use saveVaultFileToUri for custom paths")
        } else {
            val dir = getStorageDirectory(strategy)
            File(dir, getVaultFileName(vaultId))
        }

        return writeVaultFile(file, data, vaultKey, vaultId)
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
                    Log.w(TAG, "Checksum mismatch - file may be corrupted")
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
        vaultId: String
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

            // Créer le header
            val header = VaultFileHeader(
                vaultId = vaultId,
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
}
