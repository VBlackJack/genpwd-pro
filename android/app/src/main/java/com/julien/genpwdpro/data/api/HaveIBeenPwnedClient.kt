package com.julien.genpwdpro.data.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Client pour l'API HaveIBeenPwned
 * Vérifie si un mot de passe a été compromis dans des fuites de données
 *
 * API: https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * Utilise le k-Anonymity model:
 * - On envoie seulement les 5 premiers caractères du hash SHA-1
 * - L'API retourne tous les hashes commençant par ces 5 caractères
 * - On vérifie localement si le hash complet est dans la liste
 *
 * Ainsi, le mot de passe complet n'est JAMAIS envoyé sur internet
 */
class HaveIBeenPwnedClient {

    private val baseUrl = "https://api.pwnedpasswords.com/range/"

    /**
     * Vérifie si un mot de passe a été compromis
     *
     * @param password Mot de passe à vérifier
     * @return Pair<Boolean, Int> - (isCompromised, breachCount)
     *         isCompromised = true si le mot de passe a été trouvé
     *         breachCount = nombre de fois où il a été vu dans des fuites
     */
    suspend fun checkPassword(password: String): Result<Pair<Boolean, Int>> = withContext(Dispatchers.IO) {
        try {
            // 1. Calculer le hash SHA-1 du mot de passe
            val hash = sha1Hash(password).uppercase()

            // 2. Séparer : 5 premiers caractères (prefix) et le reste (suffix)
            val prefix = hash.substring(0, 5)
            val suffix = hash.substring(5)

            // 3. Appeler l'API avec le prefix
            val url = URL("$baseUrl$prefix")
            val connection = url.openConnection() as HttpURLConnection

            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10000 // 10 secondes
                readTimeout = 10000
                setRequestProperty("User-Agent", "GenPwdPro-Android")
                setRequestProperty("Add-Padding", "true") // Padding pour plus de confidentialité
            }

            val responseCode = connection.responseCode
            if (responseCode != 200) {
                return@withContext Result.failure(Exception("API error: $responseCode"))
            }

            // 4. Lire la réponse
            val response = connection.inputStream.bufferedReader().use { it.readText() }
            connection.disconnect()

            // 5. Parser la réponse (format: HASH_SUFFIX:COUNT)
            val breachCount = response.lines()
                .firstOrNull { line ->
                    val parts = line.split(":")
                    parts.firstOrNull()?.equals(suffix, ignoreCase = true) == true
                }
                ?.split(":")
                ?.getOrNull(1)
                ?.toIntOrNull() ?: 0

            // 6. Retourner le résultat
            val isCompromised = breachCount > 0
            Result.success(Pair(isCompromised, breachCount))

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Calcule le hash SHA-1 d'une chaîne
     */
    private fun sha1Hash(input: String): String {
        val bytes = input.toByteArray()
        val md = MessageDigest.getInstance("SHA-1")
        val digest = md.digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }
}

/**
 * Résultat de la vérification d'un mot de passe
 */
data class PasswordBreachResult(
    val isCompromised: Boolean,
    val breachCount: Int,
    val riskLevel: RiskLevel
) {
    enum class RiskLevel {
        SAFE,        // 0 breaches
        LOW,         // 1-10 breaches
        MEDIUM,      // 11-100 breaches
        HIGH,        // 101-1000 breaches
        CRITICAL     // 1000+ breaches
    }

    companion object {
        fun from(isCompromised: Boolean, breachCount: Int): PasswordBreachResult {
            val riskLevel = when {
                breachCount == 0 -> RiskLevel.SAFE
                breachCount <= 10 -> RiskLevel.LOW
                breachCount <= 100 -> RiskLevel.MEDIUM
                breachCount <= 1000 -> RiskLevel.HIGH
                else -> RiskLevel.CRITICAL
            }
            return PasswordBreachResult(isCompromised, breachCount, riskLevel)
        }
    }
}
