package com.julien.genpwdpro.domain.utils

import android.content.Context
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import java.io.IOException

/**
 * Format d'export JSON compatible avec la version web
 */
data class ExportData(
    val version: String = "2.5.2",
    val exportDate: Long = System.currentTimeMillis(),
    val platform: String = "android",
    val settings: Settings? = null,
    val passwords: List<ExportPasswordData> = emptyList()
)

/**
 * Format simplifié de mot de passe pour l'export
 */
data class ExportPasswordData(
    val password: String,
    val entropy: Double,
    val mode: String,
    val timestamp: Long
)

/**
 * Utilitaires pour export/import de données JSON
 * Compatible avec la version web de GenPwd Pro
 */
object ExportImportUtils {

    private val gson: Gson = GsonBuilder()
        .setPrettyPrinting()
        .create()

    /**
     * Exporte les paramètres et mots de passe en JSON
     *
     * @param context Context Android
     * @param uri URI du fichier de destination
     * @param settings Paramètres à exporter (optionnel)
     * @param passwords Liste de mots de passe à exporter
     * @return Result avec succès ou erreur
     */
    fun exportToJson(
        context: Context,
        uri: Uri,
        settings: Settings? = null,
        passwords: List<PasswordResult> = emptyList()
    ): Result<Unit> {
        return try {
            val exportData = ExportData(
                settings = settings,
                passwords = passwords.map { result ->
                    ExportPasswordData(
                        password = result.password,
                        entropy = result.entropy,
                        mode = result.mode.name,
                        timestamp = result.timestamp
                    )
                }
            )

            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                val json = gson.toJson(exportData)
                outputStream.write(json.toByteArray())
            } ?: return Result.failure(IOException("Impossible d'ouvrir le fichier"))

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Importe les données depuis un fichier JSON
     *
     * @param context Context Android
     * @param uri URI du fichier source
     * @return Result avec les données importées ou erreur
     */
    fun importFromJson(
        context: Context,
        uri: Uri
    ): Result<ExportData> {
        return try {
            val json = context.contentResolver.openInputStream(uri)?.use { inputStream ->
                inputStream.bufferedReader().readText()
            } ?: return Result.failure(IOException("Impossible de lire le fichier"))

            val exportData = gson.fromJson(json, ExportData::class.java)
                ?: return Result.failure(IOException("Format JSON invalide"))

            Result.success(exportData)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Exporte uniquement les mots de passe en format texte simple
     * Un mot de passe par ligne
     *
     * @param context Context Android
     * @param uri URI du fichier de destination
     * @param passwords Liste de mots de passe
     * @return Result avec succès ou erreur
     */
    fun exportPasswordsAsText(
        context: Context,
        uri: Uri,
        passwords: List<PasswordResult>
    ): Result<Unit> {
        return try {
            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                passwords.forEach { result ->
                    outputStream.write("${result.password}\n".toByteArray())
                }
            } ?: return Result.failure(IOException("Impossible d'ouvrir le fichier"))

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Exporte avec métadonnées détaillées (CSV-like)
     *
     * @param context Context Android
     * @param uri URI du fichier de destination
     * @param passwords Liste de mots de passe
     * @return Result avec succès ou erreur
     */
    fun exportPasswordsWithMetadata(
        context: Context,
        uri: Uri,
        passwords: List<PasswordResult>
    ): Result<Unit> {
        return try {
            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                // Header
                outputStream.write("Password,Entropy,Mode,Timestamp\n".toByteArray())

                // Data
                passwords.forEach { result ->
                    val line = "${result.password},${result.entropy},${result.mode.name},${result.timestamp}\n"
                    outputStream.write(line.toByteArray())
                }
            } ?: return Result.failure(IOException("Impossible d'ouvrir le fichier"))

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Génère un nom de fichier pour l'export
     */
    fun generateExportFilename(type: String = "json"): String {
        val timestamp = System.currentTimeMillis()
        val date = java.text.SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", java.util.Locale.getDefault())
            .format(java.util.Date(timestamp))
        return "genpwd_export_$date.$type"
    }
}
