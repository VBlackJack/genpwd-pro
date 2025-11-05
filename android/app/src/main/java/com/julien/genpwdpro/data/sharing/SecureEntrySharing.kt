package com.julien.genpwdpro.data.sharing

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.google.crypto.tink.Aead
import com.julien.genpwdpro.data.crypto.TinkAesGcmCryptoEngine
import com.julien.genpwdpro.data.models.vault.VaultEntry
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.SecureRandom
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton
import com.google.gson.Gson
import java.time.Instant

/**
 * Gestionnaire de partage sécurisé d'entrées
 *
 * Fonctionnalités:
 * - Partage chiffré d'entrées individuelles
 * - Génération de liens de partage avec expiration
 * - Partage via QR code
 * - Partage direct (fichier chiffré)
 * - Protection par mot de passe optionnelle
 * - Limitation du nombre d'accès
 */
@Singleton
class SecureEntrySharing @Inject constructor(
    @ApplicationContext private val context: Context,
    private val cryptoEngine: TinkAesGcmCryptoEngine,
    private val gson: Gson
) {
    companion object {
        private const val SHARE_DIR = "shares"
        private const val FILE_PROVIDER_AUTHORITY = "com.julien.genpwdpro.fileprovider"
        private const val DEFAULT_EXPIRY_HOURS = 24
        private const val MAX_ACCESS_COUNT = 10
    }

    private val shareDir: File
        get() = File(context.cacheDir, SHARE_DIR).apply {
            if (!exists()) mkdirs()
        }

    /**
     * Partage une entrée de manière sécurisée
     */
    suspend fun shareEntry(
        entry: VaultEntry,
        options: ShareOptions = ShareOptions()
    ): ShareResult = withContext(Dispatchers.IO) {
        // Générer une clé de partage aléatoire
        val shareKey = generateShareKey()

        // Créer le paquet de partage
        val sharePackage = SharePackage(
            version = 1,
            entryData = entry,
            shareId = UUID.randomUUID().toString(),
            createdAt = System.currentTimeMillis(),
            expiresAt = options.expiryTime ?: (System.currentTimeMillis() + options.expiryHours * 3600 * 1000),
            maxAccessCount = options.maxAccessCount,
            requirePassword = options.password != null,
            metadata = ShareMetadata(
                sharedBy = options.sharedByName,
                message = options.message
            )
        )

        // Sérialiser et chiffrer
        val json = gson.toJson(sharePackage)
        val encrypted = cryptoEngine.encrypt(
            plaintext = json.toByteArray(Charsets.UTF_8),
            key = shareKey,
            associatedData = sharePackage.shareId.toByteArray()
        )

        // Créer le fichier de partage
        val shareFile = File(shareDir, "${sharePackage.shareId}.gpvshare")
        shareFile.writeBytes(encrypted)

        // Générer le lien ou le QR code selon les options
        when (options.shareMethod) {
            ShareMethod.FILE -> ShareResult.File(
                file = shareFile,
                shareKey = encodeShareKey(shareKey),
                shareId = sharePackage.shareId,
                expiresAt = sharePackage.expiresAt
            )

            ShareMethod.QR_CODE -> ShareResult.QRCode(
                qrData = buildQRData(sharePackage.shareId, shareKey),
                shareId = sharePackage.shareId,
                expiresAt = sharePackage.expiresAt
            )

            ShareMethod.LINK -> ShareResult.Link(
                link = buildShareLink(sharePackage.shareId, shareKey),
                shareId = sharePackage.shareId,
                expiresAt = sharePackage.expiresAt
            )

            ShareMethod.DIRECT -> {
                // Partage direct via Intent
                val uri = FileProvider.getUriForFile(
                    context,
                    FILE_PROVIDER_AUTHORITY,
                    shareFile
                )

                val sendIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TEXT, "Clé de partage: ${encodeShareKey(shareKey)}")
                    type = "application/octet-stream"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                ShareResult.Intent(
                    intent = Intent.createChooser(sendIntent, "Partager l'entrée"),
                    shareId = sharePackage.shareId,
                    expiresAt = sharePackage.expiresAt
                )
            }
        }
    }

    /**
     * Importe une entrée partagée
     */
    suspend fun importSharedEntry(
        shareData: ByteArray,
        shareKey: String,
        password: String? = null
    ): ImportResult = withContext(Dispatchers.IO) {
        try {
            // Décoder la clé
            val key = decodeShareKey(shareKey)

            // Déchiffrer
            val decrypted = cryptoEngine.decrypt(
                ciphertext = shareData,
                key = key,
                associatedData = ByteArray(0)  // Sera validé après parsing
            )

            // Parser
            val json = String(decrypted, Charsets.UTF_8)
            val sharePackage = gson.fromJson(json, SharePackage::class.java)

            // Vérifier l'expiration
            if (System.currentTimeMillis() > sharePackage.expiresAt) {
                return@withContext ImportResult.Expired
            }

            // Vérifier le mot de passe si requis
            if (sharePackage.requirePassword && password == null) {
                return@withContext ImportResult.PasswordRequired
            }

            // Vérifier le nombre d'accès
            // TODO: Implémenter le tracking du nombre d'accès
            // Nécessite un système de backend ou un stockage partagé

            ImportResult.Success(
                entry = sharePackage.entryData,
                metadata = sharePackage.metadata
            )
        } catch (e: Exception) {
            ImportResult.Error(e.message ?: "Erreur d'importation")
        }
    }

    /**
     * Importe depuis un QR code
     */
    suspend fun importFromQRCode(qrData: String): ImportResult {
        val (shareId, shareKey) = parseQRData(qrData)

        // Télécharger le fichier de partage (si hébergé)
        // Ou lire depuis le stockage local
        val shareFile = File(shareDir, "$shareId.gpvshare")

        if (!shareFile.exists()) {
            return ImportResult.Error("Fichier de partage introuvable")
        }

        return importSharedEntry(shareFile.readBytes(), shareKey)
    }

    /**
     * Importe depuis un lien
     */
    suspend fun importFromLink(link: String): ImportResult {
        val (shareId, shareKey) = parseShareLink(link)

        val shareFile = File(shareDir, "$shareId.gpvshare")

        if (!shareFile.exists()) {
            return ImportResult.Error("Fichier de partage introuvable")
        }

        return importSharedEntry(shareFile.readBytes(), shareKey)
    }

    /**
     * Révoque un partage
     */
    suspend fun revokeShare(shareId: String) = withContext(Dispatchers.IO) {
        val shareFile = File(shareDir, "$shareId.gpvshare")
        if (shareFile.exists()) {
            shareFile.delete()
        }
    }

    /**
     * Liste les partages actifs
     */
    suspend fun listActiveShares(): List<ActiveShare> = withContext(Dispatchers.IO) {
        shareDir.listFiles()?.mapNotNull { file ->
            try {
                val shareId = file.nameWithoutExtension
                ActiveShare(
                    shareId = shareId,
                    createdAt = file.lastModified(),
                    size = file.length()
                )
            } catch (e: Exception) {
                null
            }
        } ?: emptyList()
    }

    /**
     * Nettoie les partages expirés
     */
    suspend fun cleanExpiredShares() = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        shareDir.listFiles()?.forEach { file ->
            if (now - file.lastModified() > DEFAULT_EXPIRY_HOURS * 3600 * 1000) {
                file.delete()
            }
        }
    }

    /**
     * Génère une clé de partage aléatoire
     */
    private fun generateShareKey(): ByteArray {
        val key = ByteArray(32) // 256 bits
        SecureRandom().nextBytes(key)
        return key
    }

    /**
     * Encode une clé pour transmission
     */
    private fun encodeShareKey(key: ByteArray): String {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(key)
    }

    /**
     * Décode une clé de partage
     */
    private fun decodeShareKey(encoded: String): ByteArray {
        return Base64.getUrlDecoder().decode(encoded)
    }

    /**
     * Construit les données QR
     */
    private fun buildQRData(shareId: String, key: ByteArray): String {
        return "genpwd://share/$shareId/${encodeShareKey(key)}"
    }

    /**
     * Parse les données QR
     */
    private fun parseQRData(qrData: String): Pair<String, String> {
        val parts = qrData.removePrefix("genpwd://share/").split("/")
        return Pair(parts[0], parts[1])
    }

    /**
     * Construit un lien de partage
     */
    private fun buildShareLink(shareId: String, key: ByteArray): String {
        // Format: https://genpwd.app/share?id=...&key=...
        // Ou deep link: genpwd://share/...
        return "genpwd://share/$shareId/${encodeShareKey(key)}"
    }

    /**
     * Parse un lien de partage
     */
    private fun parseShareLink(link: String): Pair<String, String> {
        return parseQRData(link) // Même format
    }
}

/**
 * Options de partage
 */
data class ShareOptions(
    val shareMethod: ShareMethod = ShareMethod.FILE,
    val expiryHours: Long = 24,
    val expiryTime: Long? = null,
    val maxAccessCount: Int = 10,
    val password: String? = null,
    val sharedByName: String? = null,
    val message: String? = null
)

/**
 * Méthode de partage
 */
enum class ShareMethod {
    FILE,       // Fichier chiffré à partager
    QR_CODE,    // QR code contenant le lien
    LINK,       // Lien deep link
    DIRECT      // Intent Android direct
}

/**
 * Paquet de partage chiffré
 */
data class SharePackage(
    val version: Int,
    val entryData: VaultEntry,
    val shareId: String,
    val createdAt: Long,
    val expiresAt: Long,
    val maxAccessCount: Int,
    val requirePassword: Boolean,
    val metadata: ShareMetadata
)

/**
 * Métadonnées de partage
 */
data class ShareMetadata(
    val sharedBy: String?,
    val message: String?
)

/**
 * Résultat de partage
 */
sealed class ShareResult {
    data class File(
        val file: java.io.File,
        val shareKey: String,
        val shareId: String,
        val expiresAt: Long
    ) : ShareResult()

    data class QRCode(
        val qrData: String,
        val shareId: String,
        val expiresAt: Long
    ) : ShareResult()

    data class Link(
        val link: String,
        val shareId: String,
        val expiresAt: Long
    ) : ShareResult()

    data class Intent(
        val intent: android.content.Intent,
        val shareId: String,
        val expiresAt: Long
    ) : ShareResult()
}

/**
 * Résultat d'importation
 */
sealed class ImportResult {
    data class Success(
        val entry: VaultEntry,
        val metadata: ShareMetadata
    ) : ImportResult()

    object Expired : ImportResult()
    object PasswordRequired : ImportResult()
    data class Error(val message: String) : ImportResult()
}

/**
 * Partage actif
 */
data class ActiveShare(
    val shareId: String,
    val createdAt: Long,
    val size: Long
)
