package com.julien.genpwd-pro.autofill

import com.julien.genpwdpro.data.local.entity.PasswordHistoryEntity
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.repository.PasswordHistoryRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository pour gérer les données d'auto-remplissage
 *
 * Responsabilités:
 * - Accès aux paramètres de génération
 * - Sauvegarde dans l'historique
 * - Configuration de l'auto-remplissage
 */
@Singleton
class AutofillRepository @Inject constructor(
    private val settingsDataStore: SettingsDataStore,
    private val historyRepository: PasswordHistoryRepository
) {

    /**
     * Récupère les paramètres de génération actuels
     */
    fun getSettings(): Flow<Settings> {
        return settingsDataStore.settings
    }

    /**
     * Sauvegarde un mot de passe généré dans l'historique
     *
     * @param password Mot de passe généré
     * @param username Username associé (optionnel)
     * @param packageName Nom du package de l'application cible
     */
    suspend fun saveToHistory(
        password: String,
        username: String = "",
        packageName: String
    ) {
        val appName = extractAppName(packageName)
        val note = buildString {
            append("Auto-rempli pour: $appName")
            if (username.isNotEmpty()) {
                append(" (Username: $username)")
            }
        }

        historyRepository.insertPassword(
            PasswordHistoryEntity(
                password = password,
                timestamp = System.currentTimeMillis(),
                note = note
            )
        )
    }

    /**
     * Extrait un nom lisible depuis un package name
     */
    private fun extractAppName(packageName: String): String {
        return packageName.split(".").lastOrNull()?.capitalize() ?: packageName
    }

    /**
     * Vérifie si l'auto-remplissage est activé
     */
    suspend fun isAutofillEnabled(): Boolean {
        // TODO: Ajouter un flag dans Settings
        return true
    }

    /**
     * Active/désactive l'auto-remplissage
     */
    suspend fun setAutofillEnabled(enabled: Boolean) {
        // TODO: Persister dans DataStore
    }
}
