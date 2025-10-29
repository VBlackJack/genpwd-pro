package com.julien.genpwdpro.data.crypto

import org.apache.commons.codec.binary.Base32
import java.nio.ByteBuffer
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.pow
import com.julien.genpwdpro.core.crypto.SecretUtils

/**
 * Générateur de codes TOTP (Time-based One-Time Password)
 *
 * Implémente RFC 6238 (TOTP) basé sur RFC 4226 (HOTP)
 * Compatible avec Google Authenticator, Authy, etc.
 */
@Singleton
class TotpGenerator @Inject constructor() {

    companion object {
        private const val DEFAULT_PERIOD = 30 // secondes
        private const val DEFAULT_DIGITS = 6
        private const val DEFAULT_ALGORITHM = "SHA1"
    }

    /**
     * Configuration TOTP
     */
    data class TotpConfig(
        val secret: String,              // Secret en Base32
        val period: Int = DEFAULT_PERIOD,
        val digits: Int = DEFAULT_DIGITS,
        val algorithm: String = DEFAULT_ALGORITHM
    )

    /**
     * Résultat TOTP avec code et informations de timing
     */
    data class TotpResult(
        val code: String,
        val remainingSeconds: Long,
        val period: Int
    )

    /**
     * Génère un code TOTP pour le moment actuel
     *
     * @param secret Le secret TOTP en Base32
     * @param period Période en secondes (défaut: 30)
     * @param digits Nombre de digits (défaut: 6)
     * @param algorithm Algorithme HMAC (SHA1, SHA256, SHA512)
     * @return Code TOTP à 6 chiffres
     */
    fun generateCode(
        secret: String,
        period: Int = DEFAULT_PERIOD,
        digits: Int = DEFAULT_DIGITS,
        algorithm: String = DEFAULT_ALGORITHM
    ): String {
        val counter = getCurrentCounter(period)
        return generateHOTP(secret, counter, digits, algorithm)
    }

    /**
     * Génère un code TOTP avec informations de timing
     */
    fun generateTotpResult(config: TotpConfig): TotpResult {
        val currentTime = System.currentTimeMillis() / 1000
        val counter = currentTime / config.period
        val code = generateHOTP(config.secret, counter, config.digits, config.algorithm)
        val remainingSeconds = config.period - (currentTime % config.period)

        return TotpResult(
            code = code,
            remainingSeconds = remainingSeconds,
            period = config.period
        )
    }

    /**
     * Génère un code HOTP (HMAC-based One-Time Password)
     *
     * @param secret Le secret en Base32
     * @param counter Le compteur (pour TOTP, c'est le timestamp / period)
     * @param digits Nombre de digits dans le code
     * @param algorithm Algorithme HMAC
     * @return Code HOTP
     */
    private fun generateHOTP(
        secret: String,
        counter: Long,
        digits: Int,
        algorithm: String
    ): String {
        // 1. Décoder le secret Base32
        val decodedSecret = decodeBase32(secret)

        // 2. Convertir le compteur en bytes (big-endian)
        val counterBytes = ByteBuffer.allocate(8).putLong(counter).array()

        // 3. Calculer HMAC
        val hmacAlgorithm = "Hmac$algorithm"
        val mac = Mac.getInstance(hmacAlgorithm)
        val keySpec = SecretKeySpec(decodedSecret, hmacAlgorithm)
        mac.init(keySpec)
        val hash = mac.doFinal(counterBytes)

        // 4. Dynamic Truncation (RFC 4226)
        val offset = (hash.last().toInt() and 0x0F)
        val truncatedHash = ByteBuffer.wrap(hash, offset, 4).int and 0x7FFFFFFF

        // 5. Générer le code
        val divisor = 10.0.pow(digits).toInt()
        val code = truncatedHash % divisor

        // 6. Formatter avec des zéros devant si nécessaire
        return code.toString().padStart(digits, '0')
    }

    /**
     * Calcule le compteur actuel basé sur le timestamp
     */
    private fun getCurrentCounter(period: Int): Long {
        val currentTime = System.currentTimeMillis() / 1000
        return currentTime / period
    }

    /**
     * Décode une chaîne Base32 en bytes
     */
    private fun decodeBase32(base32String: String): ByteArray {
        val base32 = Base32()
        // Nettoyer la chaîne (enlever espaces, tirets, etc.)
        val cleanString = base32String
            .replace(" ", "")
            .replace("-", "")
            .uppercase()
        return base32.decode(cleanString)
    }

    /**
     * Encode des bytes en Base32
     */
    fun encodeBase32(bytes: ByteArray): String {
        val base32 = Base32()
        return base32.encodeToString(bytes).replace("=", "")
    }

    /**
     * Vérifie si un code TOTP est valide
     *
     * @param secret Le secret TOTP
     * @param code Le code à vérifier
     * @param period Période TOTP
     * @param digits Nombre de digits
     * @param algorithm Algorithme
     * @param window Fenêtre de tolérance (nombre de périodes avant/après à vérifier)
     * @return true si le code est valide
     */
    fun verifyCode(
        secret: String,
        code: String,
        period: Int = DEFAULT_PERIOD,
        digits: Int = DEFAULT_DIGITS,
        algorithm: String = DEFAULT_ALGORITHM,
        window: Int = 1
    ): Boolean {
        val currentCounter = getCurrentCounter(period)

        val codeBytes = code.toByteArray(Charsets.UTF_8)
        return try {
            for (i in -window..window) {
                val testCode = generateHOTP(secret, currentCounter + i, digits, algorithm)
                val testBytes = testCode.toByteArray(Charsets.UTF_8)
                val matches = SecretUtils.timingSafeEquals(testBytes, codeBytes)
                SecretUtils.wipe(testBytes)
                if (matches) {
                    return true
                }
            }
            false
        } finally {
            SecretUtils.wipe(codeBytes)
        }
    }

    /**
     * Parse une URI TOTP (format otpauth://)
     *
     * Exemple: otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
     */
    fun parseTotpUri(uri: String): TotpConfig? {
        if (!uri.startsWith("otpauth://totp/")) {
            return null
        }

        return try {
            val parts = uri.removePrefix("otpauth://totp/").split("?")
            val params = if (parts.size > 1) {
                parts[1].split("&").associate {
                    val (key, value) = it.split("=")
                    key to java.net.URLDecoder.decode(value, "UTF-8")
                }
            } else {
                emptyMap()
            }

            val secret = params["secret"] ?: return null
            val period = params["period"]?.toIntOrNull() ?: DEFAULT_PERIOD
            val digits = params["digits"]?.toIntOrNull() ?: DEFAULT_DIGITS
            val algorithm = params["algorithm"] ?: DEFAULT_ALGORITHM

            TotpConfig(
                secret = secret,
                period = period,
                digits = digits,
                algorithm = algorithm
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Génère une URI TOTP
     *
     * @param accountName Nom du compte (ex: "user@example.com")
     * @param issuer Émetteur (ex: "GitHub")
     * @param config Configuration TOTP
     * @return URI au format otpauth://
     */
    fun generateTotpUri(
        accountName: String,
        issuer: String,
        config: TotpConfig
    ): String {
        val encodedAccount = java.net.URLEncoder.encode(accountName, "UTF-8")
        val encodedIssuer = java.net.URLEncoder.encode(issuer, "UTF-8")

        return buildString {
            append("otpauth://totp/")
            append("$encodedIssuer:$encodedAccount")
            append("?secret=${config.secret}")
            append("&issuer=$encodedIssuer")
            if (config.period != DEFAULT_PERIOD) {
                append("&period=${config.period}")
            }
            if (config.digits != DEFAULT_DIGITS) {
                append("&digits=${config.digits}")
            }
            if (config.algorithm != DEFAULT_ALGORITHM) {
                append("&algorithm=${config.algorithm}")
            }
        }
    }

    /**
     * Calcule le pourcentage de temps restant dans la période actuelle
     */
    fun getRemainingTimePercent(period: Int = DEFAULT_PERIOD): Float {
        val currentTime = System.currentTimeMillis() / 1000
        val remainingSeconds = period - (currentTime % period)
        return (remainingSeconds.toFloat() / period) * 100f
    }

    /**
     * Génère un secret TOTP aléatoire
     *
     * @param length Longueur en bytes (défaut: 20 bytes = 160 bits)
     * @return Secret en Base32
     */
    fun generateRandomSecret(length: Int = 20): String {
        val random = java.security.SecureRandom()
        val bytes = ByteArray(length)
        random.nextBytes(bytes)
        return encodeBase32(bytes)
    }
}
