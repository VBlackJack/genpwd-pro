package com.julien.genpwdpro.data.sync.providers

import android.app.Activity
import android.util.Log
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.extensions.android.http.AndroidHttp
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import com.julien.genpwdpro.data.sync.CloudProvider
import com.julien.genpwdpro.data.sync.models.CloudFileMetadata
import com.julien.genpwdpro.data.sync.models.StorageQuota
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * Provider pour Google Drive
 *
 * Fonctionnalités:
 * - OAuth2 Authentication avec Google Sign-In
 * - Upload/Download de fichiers chiffrés
 * - Stockage dans appDataFolder (privé à l'app)
 * - Gestion des métadonnées et quota
 *
 * Sécurité:
 * - Utilise OAuth2 (pas de mots de passe stockés)
 * - Fichiers stockés dans appDataFolder (invisible pour l'utilisateur)
 * - Toutes les données sont chiffrées avant upload
 * - Checksums MD5 pour vérifier l'intégrité
 */
class GoogleDriveProvider : CloudProvider {

    companion object {
        private const val TAG = "GoogleDriveProvider"
        private const val FOLDER_NAME = "GenPwdPro_Vaults"
        private const val MIME_TYPE = "application/octet-stream"
    }

    private var driveService: Drive? = null
    private var currentAccount: GoogleSignInAccount? = null

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    override suspend fun isAuthenticated(): Boolean = withContext(Dispatchers.IO) {
        try {
            driveService != null && currentAccount != null
        } catch (e: Exception) {
            Log.e(TAG, "Error checking authentication", e)
            false
        }
    }

    /**
     * Authentifie l'utilisateur avec Google OAuth2
     */
    override suspend fun authenticate(activity: Activity): Boolean = withContext(Dispatchers.Main) {
        try {
            val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(Scope(DriveScopes.DRIVE_APPDATA))
                .build()

            val client = GoogleSignIn.getClient(activity, signInOptions)
            val account = GoogleSignIn.getLastSignedInAccount(activity)

            if (account != null && account.grantedScopes.contains(Scope(DriveScopes.DRIVE_APPDATA))) {
                // Déjà authentifié
                setupDriveService(activity, account)
                true
            } else {
                // Besoin de se connecter
                // Note: L'activity doit gérer le startActivityForResult
                // et appeler handleSignInResult() avec le résultat
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during authentication", e)
            false
        }
    }

    /**
     * Callback pour gérer le résultat du sign-in
     * À appeler depuis l'Activity après onActivityResult
     */
    suspend fun handleSignInResult(activity: Activity, account: GoogleSignInAccount?): Boolean = withContext(Dispatchers.IO) {
        try {
            if (account != null) {
                setupDriveService(activity, account)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling sign-in result", e)
            false
        }
    }

    /**
     * Configure le service Drive avec les credentials
     */
    private fun setupDriveService(activity: Activity, account: GoogleSignInAccount) {
        currentAccount = account

        val credential = GoogleAccountCredential.usingOAuth2(
            activity,
            listOf(DriveScopes.DRIVE_APPDATA)
        )
        credential.selectedAccount = account.account

        driveService = Drive.Builder(
            AndroidHttp.newCompatibleTransport(),
            GsonFactory(),
            credential
        )
            .setApplicationName("GenPwd Pro")
            .build()
    }

    /**
     * Déconnecte l'utilisateur
     */
    override suspend fun disconnect(): Unit = withContext(Dispatchers.IO) {
        try {
            driveService = null
            currentAccount = null
        } catch (e: Exception) {
            Log.e(TAG, "Error during disconnect", e)
        }
    }

    /**
     * Upload un vault chiffré vers Google Drive
     */
    override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null
            val fileName = "vault_${vaultId}.enc"

            // Chercher si le fichier existe déjà
            val existingFile = findVaultFile(vaultId)

            val fileMetadata = File().apply {
                name = fileName
                parents = listOf("appDataFolder")
                mimeType = MIME_TYPE
            }

            val mediaContent = com.google.api.client.http.ByteArrayContent(
                MIME_TYPE,
                syncData.encryptedData
            )

            val file = if (existingFile != null) {
                // Mettre à jour le fichier existant
                service.files()
                    .update(existingFile.id, fileMetadata, mediaContent)
                    .setFields("id, name, size, modifiedTime, md5Checksum")
                    .execute()
            } else {
                // Créer un nouveau fichier
                service.files()
                    .create(fileMetadata, mediaContent)
                    .setFields("id, name, size, modifiedTime, md5Checksum")
                    .execute()
            }

            Log.d(TAG, "Vault uploaded: ${file.id}")
            file.id
        } catch (e: IOException) {
            Log.e(TAG, "Error uploading vault", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error uploading vault", e)
            null
        }
    }

    /**
     * Télécharge un vault depuis Google Drive
     */
    override suspend fun downloadVault(vaultId: String): VaultSyncData? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null
            val file = findVaultFile(vaultId) ?: return@withContext null

            val outputStream = ByteArrayOutputStream()
            service.files()
                .get(file.id)
                .executeMediaAndDownloadTo(outputStream)

            val encryptedData = outputStream.toByteArray()

            // Créer VaultSyncData à partir des métadonnées
            VaultSyncData(
                vaultId = vaultId,
                vaultName = file.name.removeSuffix(".enc").removePrefix("vault_"),
                encryptedData = encryptedData,
                timestamp = file.modifiedTime?.value ?: System.currentTimeMillis(),
                version = 1,
                deviceId = "", // Pas stocké dans les métadonnées Drive
                checksum = file.md5Checksum ?: ""
            )
        } catch (e: IOException) {
            Log.e(TAG, "Error downloading vault", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error downloading vault", e)
            null
        }
    }

    /**
     * Vérifie si une version plus récente existe sur le cloud
     */
    override suspend fun hasNewerVersion(vaultId: String, localTimestamp: Long): Boolean = withContext(Dispatchers.IO) {
        try {
            val metadata = getCloudMetadata(vaultId)
            metadata != null && metadata.modifiedTime > localTimestamp
        } catch (e: Exception) {
            Log.e(TAG, "Error checking version", e)
            false
        }
    }

    /**
     * Supprime un vault du cloud
     */
    override suspend fun deleteVault(vaultId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext false
            val file = findVaultFile(vaultId) ?: return@withContext false

            service.files().delete(file.id).execute()
            Log.d(TAG, "Vault deleted: $vaultId")
            true
        } catch (e: IOException) {
            Log.e(TAG, "Error deleting vault", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error deleting vault", e)
            false
        }
    }

    /**
     * Récupère les métadonnées d'un fichier cloud
     */
    override suspend fun getCloudMetadata(vaultId: String): CloudFileMetadata? = withContext(Dispatchers.IO) {
        try {
            val file = findVaultFile(vaultId) ?: return@withContext null

            CloudFileMetadata(
                fileId = file.id,
                fileName = file.name,
                size = file.getSize() ?: 0L,
                modifiedTime = file.modifiedTime?.value ?: 0L,
                checksum = file.md5Checksum,
                version = file.version?.toString()
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error getting metadata", e)
            null
        }
    }

    /**
     * Liste tous les vaults synchronisés
     */
    override suspend fun listVaults(): List<CloudFileMetadata> = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext emptyList()

            val result = service.files()
                .list()
                .setSpaces("appDataFolder")
                .setQ("name contains 'vault_' and name contains '.enc'")
                .setFields("files(id, name, size, modifiedTime, md5Checksum, version)")
                .execute()

            result.files.map { file ->
                CloudFileMetadata(
                    fileId = file.id,
                    fileName = file.name,
                    size = file.getSize() ?: 0L,
                    modifiedTime = file.modifiedTime?.value ?: 0L,
                    checksum = file.md5Checksum,
                    version = file.version?.toString()
                )
            }
        } catch (e: IOException) {
            Log.e(TAG, "Error listing vaults", e)
            emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error listing vaults", e)
            emptyList()
        }
    }

    /**
     * Récupère le quota de stockage
     */
    override suspend fun getStorageQuota(): StorageQuota? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null

            val about = service.about()
                .get()
                .setFields("storageQuota")
                .execute()

            val quota = about.storageQuota
            StorageQuota(
                totalBytes = quota.limit ?: 0L,
                usedBytes = quota.usage ?: 0L,
                freeBytes = (quota.limit ?: 0L) - (quota.usage ?: 0L)
            )
        } catch (e: IOException) {
            Log.e(TAG, "Error getting storage quota", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error getting storage quota", e)
            null
        }
    }

    /**
     * Recherche un fichier de vault par ID
     *
     * @param vaultId ID du vault
     * @return Fichier Drive, ou null si non trouvé
     */
    private fun findVaultFile(vaultId: String): File? {
        return try {
            val service = driveService ?: return null
            val fileName = "vault_${vaultId}.enc"

            val result = service.files()
                .list()
                .setSpaces("appDataFolder")
                .setQ("name = '$fileName'")
                .setFields("files(id, name, size, modifiedTime, md5Checksum, version)")
                .execute()

            result.files.firstOrNull()
        } catch (e: Exception) {
            Log.e(TAG, "Error finding vault file", e)
            null
        }
    }
}
