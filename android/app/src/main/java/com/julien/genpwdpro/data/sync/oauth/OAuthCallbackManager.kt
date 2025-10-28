package com.julien.genpwdpro.data.sync.oauth

import android.net.Uri
import android.util.Log
import com.julien.genpwdpro.data.sync.models.CloudProviderType

/**
 * Gestionnaire centralisé des callbacks OAuth2
 *
 * Permet aux providers de s'enregistrer pour recevoir les callbacks
 * depuis les deep links OAuth2 (genpwdpro://oauth/[provider])
 *
 * Pattern Singleton thread-safe
 */
object OAuthCallbackManager {

    private const val TAG = "OAuthCallbackManager"

    /**
     * Callback handler pour chaque provider
     */
    private val callbacks = mutableMapOf<CloudProviderType, suspend (Uri) -> Boolean>()

    /**
     * Enregistrer un callback pour un provider
     *
     * @param providerType Type de provider (PCLOUD, PROTON_DRIVE, etc.)
     * @param callback Fonction suspend qui reçoit l'URI et retourne true si succès
     */
    fun registerCallback(
        providerType: CloudProviderType,
        callback: suspend (Uri) -> Boolean
    ) {
        Log.d(TAG, "Registering OAuth callback for $providerType")
        callbacks[providerType] = callback
    }

    /**
     * Désenregistrer un callback
     *
     * @param providerType Type de provider à désenregistrer
     */
    fun unregisterCallback(providerType: CloudProviderType) {
        Log.d(TAG, "Unregistering OAuth callback for $providerType")
        callbacks.remove(providerType)
    }

    /**
     * Gérer un callback OAuth2 depuis un deep link
     *
     * @param uri URI du deep link (ex: genpwdpro://oauth/pcloud?code=xxx)
     * @return true si le callback a été géré avec succès
     */
    suspend fun handleCallback(uri: Uri): Boolean {
        val path = uri.path ?: return false

        Log.d(TAG, "Handling OAuth callback: $uri")
        Log.d(TAG, "Path: $path, Query: ${uri.query}")

        // Déterminer le provider depuis le path
        val providerType = when (path) {
            "/pcloud" -> CloudProviderType.PCLOUD
            "/proton" -> CloudProviderType.PROTON_DRIVE
            else -> {
                Log.w(TAG, "Unknown OAuth callback path: $path")
                return false
            }
        }

        // Trouver et exécuter le callback
        val callback = callbacks[providerType]
        if (callback == null) {
            Log.w(TAG, "No callback registered for $providerType")
            return false
        }

        return try {
            val success = callback(uri)
            Log.d(TAG, "OAuth callback for $providerType: ${if (success) "SUCCESS" else "FAILED"}")
            success
        } catch (e: Exception) {
            Log.e(TAG, "Error handling OAuth callback for $providerType", e)
            false
        }
    }

    /**
     * Vérifier si un callback est enregistré pour un provider
     */
    fun hasCallback(providerType: CloudProviderType): Boolean {
        return callbacks.containsKey(providerType)
    }

    /**
     * Nettoyer tous les callbacks (utile pour les tests ou le cleanup)
     */
    fun clearAllCallbacks() {
        Log.d(TAG, "Clearing all OAuth callbacks")
        callbacks.clear()
    }
}
