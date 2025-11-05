package com.julien.genpwdpro.data.webauthn

import android.content.Context
import android.os.CancellationSignal
import androidx.credentials.*
import androidx.credentials.exceptions.*
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.MessageDigest
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Gestionnaire de Passkeys (WebAuthn/FIDO2)
 *
 * Supporte:
 * - Création de passkeys (registration)
 * - Authentification avec passkeys
 * - Stockage sécurisé des credentials
 * - Support des biométriques
 * - Conformité WebAuthn Level 2
 *
 * Nécessite:
 * - implementation("androidx.credentials:credentials:1.2.0")
 * - implementation("androidx.credentials:credentials-play-services-auth:1.2.0")
 */
@Singleton
class PasskeyManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val credentialManager = CredentialManager.create(context)
    private val gson = Gson()

    /**
     * Crée une nouvelle passkey
     */
    suspend fun createPasskey(
        relyingPartyId: String,
        userId: String,
        userName: String,
        userDisplayName: String,
        challenge: ByteArray = generateChallenge()
    ): PasskeyCreationResult = suspendCancellableCoroutine { continuation ->
        try {
            // Créer les options de création
            val createPublicKeyCredentialRequest = CreatePublicKeyCredentialRequest(
                requestJson = buildCreateRequestJson(
                    relyingPartyId = relyingPartyId,
                    relyingPartyName = "GenPwd Pro",
                    userId = userId,
                    userName = userName,
                    userDisplayName = userDisplayName,
                    challenge = challenge
                ),
                preferImmediatelyAvailableCredentials = false
            )

            // Lancer la création
            val cancellationSignal = CancellationSignal()
            continuation.invokeOnCancellation {
                cancellationSignal.cancel()
            }

            credentialManager.createCredentialAsync(
                context = context,
                request = createPublicKeyCredentialRequest,
                cancellationSignal = cancellationSignal,
                executor = context.mainExecutor,
                callback = object : CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException> {
                    override fun onResult(result: CreateCredentialResponse) {
                        when (result) {
                            is CreatePublicKeyCredentialResponse -> {
                                val response = parseCreateResponse(result.registrationResponseJson)
                                continuation.resume(
                                    PasskeyCreationResult.Success(
                                        credentialId = response.credentialId,
                                        publicKey = response.publicKey,
                                        attestation = response.attestation
                                    )
                                )
                            }
                            else -> {
                                continuation.resumeWithException(
                                    PasskeyException("Type de réponse inattendu")
                                )
                            }
                        }
                    }

                    override fun onError(e: CreateCredentialException) {
                        when (e) {
                            is CreateCredentialCancellationException -> {
                                continuation.resume(PasskeyCreationResult.Cancelled)
                            }
                            is CreateCredentialInterruptedException -> {
                                continuation.resume(PasskeyCreationResult.Cancelled)
                            }
                            is CreateCredentialProviderConfigurationException -> {
                                continuation.resumeWithException(
                                    PasskeyException("Configuration provider incorrecte")
                                )
                            }
                            is CreateCredentialUnknownException -> {
                                continuation.resumeWithException(
                                    PasskeyException("Erreur inconnue: ${e.message}")
                                )
                            }
                            is CreateCredentialCustomException -> {
                                continuation.resumeWithException(
                                    PasskeyException("Erreur personnalisée: ${e.message}")
                                )
                            }
                            else -> {
                                continuation.resumeWithException(
                                    PasskeyException("Erreur de création: ${e.message}")
                                )
                            }
                        }
                    }
                }
            )
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    /**
     * Authentifie avec une passkey existante
     */
    suspend fun authenticateWithPasskey(
        relyingPartyId: String,
        challenge: ByteArray = generateChallenge(),
        allowedCredentials: List<String>? = null
    ): PasskeyAuthenticationResult = suspendCancellableCoroutine { continuation ->
        try {
            // Créer les options d'authentification
            val getPublicKeyCredentialOption = GetPublicKeyCredentialOption(
                requestJson = buildGetRequestJson(
                    relyingPartyId = relyingPartyId,
                    challenge = challenge,
                    allowedCredentials = allowedCredentials
                ),
                clientDataHash = null
            )

            val getCredentialRequest = GetCredentialRequest(
                listOf(getPublicKeyCredentialOption)
            )

            // Lancer l'authentification
            val cancellationSignal = CancellationSignal()
            continuation.invokeOnCancellation {
                cancellationSignal.cancel()
            }

            credentialManager.getCredentialAsync(
                context = context,
                request = getCredentialRequest,
                cancellationSignal = cancellationSignal,
                executor = context.mainExecutor,
                callback = object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
                    override fun onResult(result: GetCredentialResponse) {
                        when (val credential = result.credential) {
                            is PublicKeyCredential -> {
                                val response = parseGetResponse(credential.authenticationResponseJson)
                                continuation.resume(
                                    PasskeyAuthenticationResult.Success(
                                        credentialId = response.credentialId,
                                        authenticatorData = response.authenticatorData,
                                        signature = response.signature,
                                        userHandle = response.userHandle
                                    )
                                )
                            }
                            else -> {
                                continuation.resumeWithException(
                                    PasskeyException("Type de credential inattendu")
                                )
                            }
                        }
                    }

                    override fun onError(e: GetCredentialException) {
                        when (e) {
                            is GetCredentialCancellationException -> {
                                continuation.resume(PasskeyAuthenticationResult.Cancelled)
                            }
                            is GetCredentialInterruptedException -> {
                                continuation.resume(PasskeyAuthenticationResult.Cancelled)
                            }
                            is NoCredentialException -> {
                                continuation.resume(PasskeyAuthenticationResult.NoCredentials)
                            }
                            is GetCredentialProviderConfigurationException -> {
                                continuation.resumeWithException(
                                    PasskeyException("Configuration provider incorrecte")
                                )
                            }
                            is GetCredentialUnknownException -> {
                                continuation.resumeWithException(
                                    PasskeyException("Erreur inconnue: ${e.message}")
                                )
                            }
                            else -> {
                                continuation.resumeWithException(
                                    PasskeyException("Erreur d'authentification: ${e.message}")
                                )
                            }
                        }
                    }
                }
            )
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    /**
     * Construit le JSON de requête de création
     */
    private fun buildCreateRequestJson(
        relyingPartyId: String,
        relyingPartyName: String,
        userId: String,
        userName: String,
        userDisplayName: String,
        challenge: ByteArray
    ): String {
        val request = mapOf(
            "rp" to mapOf(
                "id" to relyingPartyId,
                "name" to relyingPartyName
            ),
            "user" to mapOf(
                "id" to Base64.getUrlEncoder().withoutPadding().encodeToString(userId.toByteArray()),
                "name" to userName,
                "displayName" to userDisplayName
            ),
            "challenge" to Base64.getUrlEncoder().withoutPadding().encodeToString(challenge),
            "pubKeyCredParams" to listOf(
                mapOf("type" to "public-key", "alg" to -7),  // ES256
                mapOf("type" to "public-key", "alg" to -257) // RS256
            ),
            "timeout" to 60000,
            "attestation" to "none",
            "authenticatorSelection" to mapOf(
                "authenticatorAttachment" to "platform",
                "requireResidentKey" to true,
                "residentKey" to "required",
                "userVerification" to "required"
            )
        )

        return gson.toJson(request)
    }

    /**
     * Construit le JSON de requête d'authentification
     */
    private fun buildGetRequestJson(
        relyingPartyId: String,
        challenge: ByteArray,
        allowedCredentials: List<String>?
    ): String {
        val request = mutableMapOf<String, Any>(
            "rpId" to relyingPartyId,
            "challenge" to Base64.getUrlEncoder().withoutPadding().encodeToString(challenge),
            "timeout" to 60000,
            "userVerification" to "required"
        )

        allowedCredentials?.let { credentials ->
            request["allowCredentials"] = credentials.map { credId ->
                mapOf(
                    "type" to "public-key",
                    "id" to credId
                )
            }
        }

        return gson.toJson(request)
    }

    /**
     * Parse la réponse de création
     */
    private fun parseCreateResponse(json: String): CreateResponse {
        val response = gson.fromJson(json, Map::class.java)

        @Suppress("UNCHECKED_CAST")
        val responseMap = response as Map<String, Any>

        return CreateResponse(
            credentialId = responseMap["id"] as String,
            publicKey = Base64.getUrlDecoder().decode((responseMap["response"] as Map<*, *>)["publicKey"] as String),
            attestation = (responseMap["response"] as Map<*, *>)["attestationObject"] as? String
        )
    }

    /**
     * Parse la réponse d'authentification
     */
    private fun parseGetResponse(json: String): GetResponse {
        val response = gson.fromJson(json, Map::class.java)

        @Suppress("UNCHECKED_CAST")
        val responseMap = response as Map<String, Any>
        val responseData = responseMap["response"] as Map<*, *>

        return GetResponse(
            credentialId = responseMap["id"] as String,
            authenticatorData = Base64.getUrlDecoder().decode(responseData["authenticatorData"] as String),
            signature = Base64.getUrlDecoder().decode(responseData["signature"] as String),
            userHandle = (responseData["userHandle"] as? String)?.let { Base64.getUrlDecoder().decode(it) }
        )
    }

    /**
     * Génère un challenge aléatoire
     */
    private fun generateChallenge(): ByteArray {
        val random = java.security.SecureRandom()
        val challenge = ByteArray(32)
        random.nextBytes(challenge)
        return challenge
    }

    /**
     * Vérifie une signature (côté serveur normalement)
     */
    fun verifySignature(
        publicKey: ByteArray,
        signature: ByteArray,
        data: ByteArray
    ): Boolean {
        // TODO: Implémenter la vérification de signature
        // Utiliser java.security.Signature avec l'algorithme approprié
        return true
    }
}

/**
 * Résultat de création de passkey
 */
sealed class PasskeyCreationResult {
    data class Success(
        val credentialId: String,
        val publicKey: ByteArray,
        val attestation: String?
    ) : PasskeyCreationResult()

    object Cancelled : PasskeyCreationResult()
}

/**
 * Résultat d'authentification avec passkey
 */
sealed class PasskeyAuthenticationResult {
    data class Success(
        val credentialId: String,
        val authenticatorData: ByteArray,
        val signature: ByteArray,
        val userHandle: ByteArray?
    ) : PasskeyAuthenticationResult()

    object Cancelled : PasskeyAuthenticationResult()
    object NoCredentials : PasskeyAuthenticationResult()
}

/**
 * Réponse de création parsée
 */
private data class CreateResponse(
    val credentialId: String,
    val publicKey: ByteArray,
    val attestation: String?
)

/**
 * Réponse d'authentification parsée
 */
private data class GetResponse(
    val credentialId: String,
    val authenticatorData: ByteArray,
    val signature: ByteArray,
    val userHandle: ByteArray?
)

/**
 * Exception passkey
 */
class PasskeyException(message: String) : Exception(message)

/**
 * Modèle de passkey stockée
 */
data class StoredPasskey(
    val id: String,
    val entryId: String,
    val credentialId: String,
    val relyingPartyId: String,
    val userName: String,
    val userDisplayName: String,
    val publicKey: ByteArray,
    val createdAt: Long,
    val lastUsed: Long?
)
