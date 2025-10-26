package com.julien.genpwdpro.data.sync

import android.app.Activity
import android.content.Intent
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
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implémentation Google Drive pour la synchronisation cloud
 *
 * SÉCURITÉ:
 * - Stocke uniquement des fichiers chiffrés
 * - Utilise OAuth2 pour l'authentification
 * - Les fichiers sont stockés dans l'appFolder (privé à l'app)
 */
@Singleton
class GoogleDriveProvider @Inject constructor() : CloudProvider {

    override val providerType: String = "Google Drive"

    private var driveService: Drive? = null
    private var signedInAccount: GoogleSignInAccount? = null

    companion object {
        private const val FOLDER_NAME = "GenPwdPro_Vaults"
        private const val MIME_TYPE = "application/octet-stream"
        private const val REQUEST_CODE_SIGN_IN = 9003
    }

    override suspend fun isAuthenticated(): Boolean = withContext(Dispatchers.IO) {
        signedInAccount != null && driveService != null
    }

    override suspend fun authenticate(activity: Activity): Boolean = withContext(Dispatchers.IO) {
        try {
            // Configuration Google Sign-In avec Drive API scope
            val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(Scope(DriveScopes.DRIVE_APPDATA))
                .build()

            val client = GoogleSignIn.getClient(activity, signInOptions)

            // Vérifier si déjà connecté
            val existingAccount = GoogleSignIn.getLastSignedInAccount(activity)
            if (existingAccount != null) {
                signedInAccount = existingAccount
                initializeDriveService(activity, existingAccount)
                return@withContext true
            }

            // Sinon, lancer le flow de connexion
            val signInIntent = client.signInIntent
            activity.startActivityForResult(signInIntent, REQUEST_CODE_SIGN_IN)

            // Note: Le résultat sera traité dans onActivityResult
            // Pour l'instant on retourne false, l'app devra gérer le callback
            false
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * À appeler depuis onActivityResult de l'Activity
     */
    suspend fun handleSignInResult(data: Intent?, activity: Activity): Boolean = withContext(Dispatchers.IO) {
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.result
            signedInAccount = account
            initializeDriveService(activity, account)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun initializeDriveService(activity: Activity, account: GoogleSignInAccount) {
        val credential = GoogleAccountCredential.usingOAuth2(
            activity,
            listOf(DriveScopes.DRIVE_APPDATA)
        )
        credential.selectedAccount = account.account

        driveService = Drive.Builder(
            AndroidHttp.newCompatibleTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        )
            .setApplicationName("GenPwd Pro")
            .build()
    }

    override suspend fun disconnect() = withContext(Dispatchers.IO) {
        signedInAccount = null
        driveService = null
    }

    override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null

            // Créer ou récupérer le dossier de l'app
            val folderId = getOrCreateAppFolder()

            // Vérifier si le fichier existe déjà
            val existingFile = findVaultFile(vaultId)

            val fileMetadata = File().apply {
                name = "vault_$vaultId.enc"
                if (existingFile == null) {
                    parents = listOf(folderId)
                }
            }

            val mediaContent = com.google.api.client.http.ByteArrayContent(
                MIME_TYPE,
                syncData.encryptedData
            )

            val file = if (existingFile != null) {
                // Update existing file
                service.files().update(existingFile.id, fileMetadata, mediaContent)
                    .execute()
            } else {
                // Create new file
                service.files().create(fileMetadata, mediaContent)
                    .setFields("id, name, size, modifiedTime")
                    .execute()
            }

            file.id
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    override suspend fun downloadVault(vaultId: String): VaultSyncData? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null

            val file = findVaultFile(vaultId) ?: return@withContext null

            val outputStream = ByteArrayOutputStream()
            service.files().get(file.id)
                .executeMediaAndDownloadTo(outputStream)

            val encryptedData = outputStream.toByteArray()
            val timestamp = file.modifiedTime?.value ?: System.currentTimeMillis()

            VaultSyncData(
                vaultId = vaultId,
                encryptedData = encryptedData,
                timestamp = timestamp,
                deviceId = "", // Will be set by SyncManager
                checksum = "", // Will be computed by SyncManager
                version = 1
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    override suspend fun hasNewerVersion(vaultId: String, localTimestamp: Long): Boolean = withContext(Dispatchers.IO) {
        try {
            val file = findVaultFile(vaultId) ?: return@withContext false
            val cloudTimestamp = file.modifiedTime?.value ?: 0
            cloudTimestamp > localTimestamp
        } catch (e: Exception) {
            false
        }
    }

    override suspend fun getCloudMetadata(vaultId: String): CloudFileMetadata? = withContext(Dispatchers.IO) {
        try {
            val file = findVaultFile(vaultId) ?: return@withContext null

            CloudFileMetadata(
                fileId = file.id,
                name = file.name,
                size = file.getSize() ?: 0,
                modifiedTime = file.modifiedTime?.value ?: 0,
                checksum = file.md5Checksum
            )
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun deleteVault(vaultId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext false
            val file = findVaultFile(vaultId) ?: return@withContext false

            service.files().delete(file.id).execute()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    override suspend fun listVaults(): List<String> = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext emptyList()
            val folderId = getOrCreateAppFolder()

            val result = service.files().list()
                .setQ("'$folderId' in parents and name contains 'vault_' and trashed=false")
                .setSpaces("drive")
                .setFields("files(id, name)")
                .execute()

            result.files.mapNotNull { file ->
                // Extract vault ID from filename "vault_{id}.enc"
                file.name.removePrefix("vault_").removeSuffix(".enc")
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    override suspend fun getStorageQuota(): StorageQuota? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null

            val about = service.about().get()
                .setFields("storageQuota")
                .execute()

            val quota = about.storageQuota
            StorageQuota(
                usedBytes = quota.usage ?: 0,
                totalBytes = quota.limit ?: 0
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Récupère ou crée le dossier de l'application
     */
    private fun getOrCreateAppFolder(): String {
        val service = driveService ?: throw IllegalStateException("Drive service not initialized")

        // Chercher le dossier existant
        val result = service.files().list()
            .setQ("name='$FOLDER_NAME' and mimeType='application/vnd.google-apps.folder' and trashed=false")
            .setSpaces("drive")
            .setFields("files(id)")
            .execute()

        return if (result.files.isNotEmpty()) {
            result.files[0].id
        } else {
            // Créer le dossier
            val folderMetadata = File().apply {
                name = FOLDER_NAME
                mimeType = "application/vnd.google-apps.folder"
            }

            service.files().create(folderMetadata)
                .setFields("id")
                .execute()
                .id
        }
    }

    /**
     * Trouve un fichier de vault par son ID
     */
    private fun findVaultFile(vaultId: String): File? {
        val service = driveService ?: return null
        val folderId = getOrCreateAppFolder()

        val fileName = "vault_$vaultId.enc"

        val result = service.files().list()
            .setQ("name='$fileName' and '$folderId' in parents and trashed=false")
            .setSpaces("drive")
            .setFields("files(id, name, size, modifiedTime, md5Checksum)")
            .execute()

        return result.files.firstOrNull()
    }
}
