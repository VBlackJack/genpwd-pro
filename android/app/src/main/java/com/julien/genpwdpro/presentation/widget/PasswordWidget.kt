package com.julien.genpwdpro.presentation.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.Toast
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import com.julien.genpwdpro.domain.usecases.ApplyCasingUseCase
import com.julien.genpwdpro.domain.usecases.PlaceCharactersUseCase
import com.julien.genpwdpro.presentation.utils.ClipboardUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Widget pour générer des mots de passe depuis l'écran d'accueil
 *
 * Fonctionnalités:
 * - Génération rapide d'un mot de passe
 * - Copie en un clic
 * - Mise à jour automatique
 * - Compact et élégant
 */
class PasswordWidget : AppWidgetProvider() {

    companion object {
        private const val ACTION_GENERATE = "com.julien.genpwdpro.ACTION_GENERATE"
        private const val ACTION_COPY = "com.julien.genpwdpro.ACTION_COPY"
        private const val PREF_NAME = "PasswordWidget"
        private const val PREF_LAST_PASSWORD = "last_password"

        /**
         * Mise à jour manuelle du widget
         */
        fun updateWidget(context: Context, appWidgetId: Int, password: String) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val views = getRemoteViews(context, password)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun getRemoteViews(context: Context, password: String): RemoteViews {
            return RemoteViews(context.packageName, R.layout.widget_password).apply {
                // Afficher le mot de passe
                setTextViewText(R.id.widgetPasswordText, password.ifEmpty { "Tap to generate" })

                // Intent pour générer
                val generateIntent = Intent(context, PasswordWidget::class.java).apply {
                    action = ACTION_GENERATE
                }
                val generatePendingIntent = PendingIntent.getBroadcast(
                    context, 0, generateIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widgetGenerateButton, generatePendingIntent)

                // Intent pour copier
                val copyIntent = Intent(context, PasswordWidget::class.java).apply {
                    action = ACTION_COPY
                }
                val copyPendingIntent = PendingIntent.getBroadcast(
                    context, 1, copyIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widgetCopyButton, copyPendingIntent)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Mise à jour de chaque instance du widget
        appWidgetIds.forEach { appWidgetId ->
            val lastPassword = getLastPassword(context)
            updateWidget(context, appWidgetId, lastPassword)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_GENERATE -> {
                // Générer un nouveau mot de passe
                generatePassword(context)
            }
            ACTION_COPY -> {
                // Copier le dernier mot de passe
                copyLastPassword(context)
            }
        }
    }

    private fun generatePassword(context: Context) {
        CoroutineScope(Dispatchers.Default).launch {
            try {
                // Générateur de mots de passe rapide (syllabes)
                val generator = SyllablesGenerator()
                val applyCasingUseCase = ApplyCasingUseCase()
                val placeCharactersUseCase = PlaceCharactersUseCase()

                // Settings par défaut pour le widget (rapide et sûr)
                val settings = Settings(
                    mode = GenerationMode.SYLLABLES,
                    syllablesLength = 16,
                    digitsCount = 2,
                    specialsCount = 2
                )

                // Génération
                var password = generator.generate(settings)
                password = applyCasingUseCase(password, settings)
                password = placeCharactersUseCase(password, settings)

                // Sauvegarder et mettre à jour
                saveLastPassword(context, password)
                updateAllWidgets(context, password)

                // Feedback utilisateur
                CoroutineScope(Dispatchers.Main).launch {
                    Toast.makeText(context, "Mot de passe généré!", Toast.LENGTH_SHORT).show()
                }

            } catch (e: Exception) {
                CoroutineScope(Dispatchers.Main).launch {
                    Toast.makeText(context, "Erreur de génération", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun copyLastPassword(context: Context) {
        val password = getLastPassword(context)
        if (password.isNotEmpty()) {
            ClipboardUtils.copyWithTimeout(
                context = context,
                text = password,
                delayMs = 10_000L,
                showToast = false
            )
            Toast.makeText(context, "Copié!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Générez d'abord un mot de passe", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveLastPassword(context: Context, password: String) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_LAST_PASSWORD, password)
            .apply()
    }

    private fun getLastPassword(context: Context): String {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .getString(PREF_LAST_PASSWORD, "") ?: ""
    }

    private fun updateAllWidgets(context: Context, password: String) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
            android.content.ComponentName(context, PasswordWidget::class.java)
        )

        appWidgetIds.forEach { appWidgetId ->
            updateWidget(context, appWidgetId, password)
        }
    }

    override fun onEnabled(context: Context) {
        // Premier widget ajouté
        Toast.makeText(context, "Widget GenPwd ajouté!", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context) {
        // Dernier widget supprimé
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }
}
