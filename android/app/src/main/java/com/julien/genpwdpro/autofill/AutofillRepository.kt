package com.julien.genpwdpro.autofill

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import com.julien.genpwdpro.R
import com.julien.genpwdpro.core.ipc.IntentSanitizer
import com.julien.genpwdpro.data.db.entity.VaultEntryEntity
import com.julien.genpwdpro.data.db.entity.password
import com.julien.genpwdpro.data.db.entity.title
import com.julien.genpwdpro.data.db.entity.url
import com.julien.genpwdpro.data.db.entity.username
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.presentation.MainActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Repository pour gérer les données d'auto-remplissage
 *
 * Responsabilités:
 * - Accès aux paramètres de génération
 * - Recherche d'entrées dans le coffre-fort
 * - Construction des réponses d'auto-remplissage (Dataset, FillResponse)
 */
@RequiresApi(Build.VERSION_CODES.O)
@Singleton
class AutofillRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settingsDataStore: SettingsDataStore,
    private val historyRepository: PasswordHistoryRepository,
    private val vaultSessionManager: VaultSessionManager
) {

    /**
     * Récupère les paramètres de génération actuels
     */
    fun getSettings(): Flow<Settings> {
        return settingsDataStore.settingsFlow
    }

    /**
     * Vérifie si un coffre-fort est actuellement déverrouillé
     */
    fun isVaultUnlocked(): Boolean {
        return vaultSessionManager.isVaultUnlocked()
    }

    /**
     * Trouve les entrées correspondantes pour une application donnée
     */
    fun findMatchingEntries(packageName: String): Flow<List<VaultEntryEntity>> {
        val session = vaultSessionManager.getCurrentSession()
        if (session == null) {
            return kotlinx.coroutines.flow.flowOf(emptyList())
        }

        return session.vaultData.map { vaultData ->
            vaultData.entries.filter { entry ->
                // Logique de correspondance améliorée
                val formattedUrl = entry.url?.lowercase() ?: ""
                val formattedPackage = packageName.lowercase()
                formattedUrl.contains(formattedPackage) || entry.title.lowercase().contains(
                    formattedPackage
                )
            }
        }
    }

    /**
     * Crée la réponse pour demander à l'utilisateur de déverrouiller le coffre
     */
    fun createUnlockVaultResponse(): FillResponse {
        val presentation = RemoteViews(context.packageName, R.layout.autofill_item).apply {
            setTextViewText(R.id.autofill_text, "Déverrouiller GenPwd Pro")
            setTextViewText(R.id.autofill_subtext, "Touchez pour vous authentifier")
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra(MainActivity.EXTRA_AUTOFILL_UNLOCK_REQUEST, true)
            IntentSanitizer.stripAllExcept(this, setOf(MainActivity.EXTRA_AUTOFILL_UNLOCK_REQUEST))
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)

        return FillResponse.Builder()
            .setAuthentication(emptyArray(), pendingIntent.intentSender, presentation)
            .build()
    }

    /**
     * Crée un Dataset à partir d'une entrée de coffre-fort déchiffrée
     */
    fun createCredentialDataset(
        entry: VaultEntryEntity,
        autofillFields: AutofillFieldsMetadata
    ): Dataset {
        val presentation = RemoteViews(context.packageName, R.layout.autofill_item).apply {
            setTextViewText(R.id.autofill_text, entry.title)
            entry.username?.let { setTextViewText(R.id.autofill_subtext, it) }
        }

        val datasetBuilder = Dataset.Builder(presentation)

        // Remplir le champ username (si non-nul)
        autofillFields.usernameField?.let { field ->
            entry.username?.let {
                datasetBuilder.setValue(field.autofillId, AutofillValue.forText(it))
            }
        }

        // Remplir le champ password (si non-nul)
        autofillFields.passwordField?.let { field ->
            entry.password?.let {
                datasetBuilder.setValue(field.autofillId, AutofillValue.forText(it))
            }
        }

        return datasetBuilder.build()
    }

    /**
     * Sauvegarde un mot de passe généré dans l'historique
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

    private fun calculateEntropy(password: String): Double {
        if (password.isEmpty()) return 0.0
        val charPool = mutableSetOf<Char>()
        password.forEach { charPool.add(it) }
        val poolSize = charPool.size
        return if (poolSize > 1) password.length * kotlin.math.log2(poolSize.toDouble()) else 0.0
    }

    private fun extractAppName(packageName: String): String {
        return packageName.split(".").lastOrNull()?.replaceFirstChar { it.uppercase() } ?: packageName
    }

    suspend fun isAutofillEnabled(): Boolean {
        // TODO: Ajouter un flag dans Settings
        return true
    }

    suspend fun setAutofillEnabled(enabled: Boolean) {
        // TODO: Persister dans DataStore
    }
}
