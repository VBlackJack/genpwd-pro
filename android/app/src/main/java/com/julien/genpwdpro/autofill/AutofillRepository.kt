package com.julien.genpwdpro.autofill

import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
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
        return settingsDataStore.settingsFlow
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

        // Récupérer les settings actuels pour le PasswordResult
        val currentSettings = settingsDataStore.settingsFlow.first()

        val passwordResult = PasswordResult(
            password = password,
            entropy = calculateEntropy(password),
            mode = GenerationMode.SYLLABLES, // Mode par défaut pour autofill
            settings = currentSettings,
            note = note,
            isFavorite = false
        )

        historyRepository.savePassword(passwordResult)
    }

    /**
     * Calcule l'entropie approximative d'un mot de passe
     */
    private fun calculateEntropy(password: String): Double {
        if (password.isEmpty()) return 0.0

        val hasLower = password.any { it.isLowerCase() }
        val hasUpper = password.any { it.isUpperCase() }
        val hasDigit = password.any { it.isDigit() }
        val hasSpecial = password.any { !it.isLetterOrDigit() }

        var poolSize = 0
        if (hasLower) poolSize += 26
        if (hasUpper) poolSize += 26
        if (hasDigit) poolSize += 10
        if (hasSpecial) poolSize += 32

        return if (poolSize > 0) {
            password.length * Math.log(poolSize.toDouble()) / Math.log(2.0)
        } else {
            0.0
        }
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
