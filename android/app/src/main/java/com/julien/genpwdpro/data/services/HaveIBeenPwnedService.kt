package com.julien.genpwdpro.data.services

import com.julien.genpwdpro.core.log.SafeLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service d'intégration avec Have I Been Pwned API
 *
 * Vérifie si des mots de passe ont été compromis dans des fuites de données.
 *
 * API: https://haveibeenpwned.com/API/v3
 * Utilise le k-anonymity model : seuls les 5 premiers caractères du hash SHA-1
 * sont envoyés au serveur.
 *
 * Exemple :
 * ```
 * Password: "password123"
 * SHA-1: "482C811DA5D5B4BC6D497FFA98491E38"
 * Prefix: "482C8" (envoyé au serveur)
 * Suffix: "11DA5D5B4BC6D497FFA98491E38" (vérifié localement)
 * ```
 */
@Singleton
class HaveIBeenPwnedService @Inject constructor() {

    companion object {
        private const val TAG = "HIBPService"
        private const val API_URL = "https://api.pwnedpasswords.com/range/"
        private const val PREFIX_LENGTH = 5
        private const val USER_AGENT = "GenPwd-Pro-Android"
    }

    /**
     * Vérifie si un mot de passe a été compromis
     *
     * @param password Le mot de passe à vérifier
     * @return Résultat contenant le nombre de fois où le password a été trouvé
     */
    suspend fun checkPassword(password: String): BreachCheckResult {
        return withContext(Dispatchers.IO) {
            try {
                // 1. Calculer le hash SHA-1
                val sha1Hash = calculateSHA1(password).uppercase()

                // 2. Extraire prefix et suffix
                val prefix = sha1Hash.substring(0, PREFIX_LENGTH)
                val suffix = sha1Hash.substring(PREFIX_LENGTH)

                // 3. Appeler l'API avec le prefix
                val response = queryAPI(prefix)

                // 4. Chercher le suffix dans les résultats
                val breachCount = findSuffixInResponse(suffix, response)

                if (breachCount > 0) {
                    SafeLog.w(TAG, "Password found in breaches (count: $breachCount)")
                    BreachCheckResult.Breached(breachCount)
                } else {
                    SafeLog.d(TAG, "Password not found in breaches")
                    BreachCheckResult.Safe
                }

            } catch (e: Exception) {
                SafeLog.e(TAG, "Error checking password", e)
                BreachCheckResult.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Calcule le hash SHA-1 d'un mot de passe
     */
    private fun calculateSHA1(input: String): String {
        val bytes = input.toByteArray()
        val digest = MessageDigest.getInstance("SHA-1")
        val hashBytes = digest.digest(bytes)

        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Appelle l'API HIBP avec le prefix
     *
     * @return Réponse brute (liste de suffixes avec counts)
     */
    private fun queryAPI(prefix: String): String {
        val url = URL("$API_URL$prefix")
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.connectTimeout = 10000 // 10 secondes
            connection.readTimeout = 10000

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw Exception("HTTP error: $responseCode")
            }

            val reader = BufferedReader(InputStreamReader(connection.inputStream))
            return reader.use { it.readText() }

        } finally {
            connection.disconnect()
        }
    }

    /**
     * Cherche le suffix dans la réponse de l'API
     *
     * Format de la réponse :
     * ```
     * 0018A45C4D1DEF81644B54AB7F969B88D65:1
     * 00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2
     * 011053FD0102E94D6AE2F8B83D76FAF94F6:1
     * ...
     * ```
     *
     * @return Nombre de fois où le password a été trouvé (0 si pas trouvé)
     */
    private fun findSuffixInResponse(suffix: String, response: String): Int {
        val lines = response.split("\n")

        for (line in lines) {
            val parts = line.split(":")
            if (parts.size == 2) {
                val responseSuffix = parts[0].trim()
                val count = parts[1].trim().toIntOrNull() ?: 0

                if (responseSuffix.equals(suffix, ignoreCase = true)) {
                    return count
                }
            }
        }

        return 0
    }

    /**
     * Vérifie plusieurs mots de passe en batch
     *
     * @param passwords Liste de mots de passe à vérifier
     * @return Map de password -> résultat
     */
    suspend fun checkPasswordsBatch(passwords: List<String>): Map<String, BreachCheckResult> {
        return withContext(Dispatchers.IO) {
            passwords.associateWith { password ->
                try {
                    checkPassword(password)
                } catch (e: Exception) {
                    BreachCheckResult.Error(e.message ?: "Unknown error")
                }
            }
        }
    }
}

/**
 * Résultat de la vérification de breach
 */
sealed class BreachCheckResult {
    /**
     * Le mot de passe n'a pas été trouvé dans les fuites
     */
    object Safe : BreachCheckResult()

    /**
     * Le mot de passe a été trouvé dans des fuites
     *
     * @param count Nombre de fois où il a été trouvé
     */
    data class Breached(val count: Int) : BreachCheckResult()

    /**
     * Erreur lors de la vérification
     *
     * @param message Message d'erreur
     */
    data class Error(val message: String) : BreachCheckResult()
}
