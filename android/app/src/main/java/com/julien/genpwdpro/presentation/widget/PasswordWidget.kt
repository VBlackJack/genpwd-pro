package com.julien.genpwdpro.presentation.widget

import android.app.KeyguardManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.UserManager
import com.julien.genpwdpro.core.log.SafeLog
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import androidx.core.content.getSystemService
import androidx.core.content.IntentCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.julien.genpwdpro.R
import com.julien.genpwdpro.core.ipc.IntentSanitizer
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import com.julien.genpwdpro.domain.usecases.ApplyCasingUseCase
import com.julien.genpwdpro.domain.usecases.PlaceCharactersUseCase
import com.julien.genpwdpro.presentation.util.ClipboardUtils
import com.julien.genpwdpro.presentation.widget.storage.WidgetDeviceStorage
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
        private const val TAG = "PasswordWidget"
        private const val ACTION_GENERATE = "com.julien.genpwdpro.ACTION_GENERATE"
        private const val ACTION_COPY = "com.julien.genpwdpro.ACTION_COPY"
        private const val PREF_NAME = "PasswordWidget"
        private const val PREF_LAST_PASSWORD = "last_password"
        private const val DEFAULT_PENDING_INTENT_FLAGS =
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        private val ALLOWED_ACTIONS = setOf(
            AppWidgetManager.ACTION_APPWIDGET_UPDATE,
            AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED,
            AppWidgetManager.ACTION_APPWIDGET_ENABLED,
            AppWidgetManager.ACTION_APPWIDGET_DISABLED,
            AppWidgetManager.ACTION_APPWIDGET_DELETED,
            ACTION_GENERATE,
            ACTION_COPY
        )

        /**
         * Mise à jour manuelle du widget
         */
        fun updateWidget(
            context: Context,
            appWidgetId: Int,
            password: String,
            isUnlocked: Boolean
        ) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val views = getRemoteViews(context, password, isUnlocked)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun getRemoteViews(
            context: Context,
            password: String,
            isUnlocked: Boolean
        ): RemoteViews {
            return RemoteViews(context.packageName, R.layout.widget_password).apply {
                // Afficher le mot de passe ou un message sécurisé
                val displayText = when {
                    !isUnlocked -> context.getString(R.string.widget_locked_placeholder)
                    password.isEmpty() -> context.getString(R.string.widget_tap_to_generate)
                    else -> password
                }
                setTextViewText(R.id.widgetPasswordText, displayText)

                val copyVisibility = if (isUnlocked && password.isNotEmpty()) {
                    View.VISIBLE
                } else {
                    View.INVISIBLE
                }
                setViewVisibility(R.id.widgetCopyButton, copyVisibility)

                // Intent pour générer
                val generateIntent = Intent(context, PasswordWidget::class.java).apply {
                    action = ACTION_GENERATE
                    IntentSanitizer.stripAllExcept(this)
                }
                val generatePendingIntent = PendingIntent.getBroadcast(
                    context,
                    0,
                    generateIntent,
                    DEFAULT_PENDING_INTENT_FLAGS
                )
                setOnClickPendingIntent(R.id.widgetGenerateButton, generatePendingIntent)

                // Intent pour copier
                val copyIntent = Intent(context, PasswordWidget::class.java).apply {
                    action = ACTION_COPY
                    IntentSanitizer.stripAllExcept(this)
                }
                val copyPendingIntent = PendingIntent.getBroadcast(
                    context,
                    1,
                    copyIntent,
                    DEFAULT_PENDING_INTENT_FLAGS
                )
                setOnClickPendingIntent(R.id.widgetCopyButton, copyPendingIntent)
            }
        }

        fun updateAllWidgets(
            context: Context,
            passwordOverride: String? = null,
            widgetIds: IntArray? = null
        ) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = widgetIds ?: appWidgetManager.getAppWidgetIds(
                ComponentName(context, PasswordWidget::class.java)
            )

            if (appWidgetIds.isEmpty()) {
                return
            }

            val isUnlocked = isDeviceUnlocked(context)
            val passwordToDisplay = if (isUnlocked) {
                passwordOverride ?: getLastPassword(context)
            } else {
                WidgetDeviceStorage.markNeedsRefresh(context)
                ""
            }

            appWidgetIds.forEach { appWidgetId ->
                val options = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
                    appWidgetManager.getAppWidgetOptions(appWidgetId)
                } else {
                    null
                }
                val isKeyguardHost =
                    options?.getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY) ==
                        AppWidgetManager.APPWIDGET_HOST_CATEGORY_KEYGUARD
                // Never surface vault secrets on the keyguard host; fall back to placeholders until unlocked.
                val allowSecrets = isUnlocked && !isKeyguardHost
                val safePassword = if (allowSecrets) passwordToDisplay else ""
                updateWidget(context, appWidgetId, safePassword, allowSecrets)
            }
        }

        fun handleUserUnlocked(context: Context) {
            val appContext = context.applicationContext
            if (
                WidgetDeviceStorage.consumeNeedsRefresh(appContext) ||
                isDeviceUnlocked(appContext)
            ) {
                updateAllWidgets(appContext)
            }
        }

        fun ensureUnlocked(context: Context): Boolean {
            if (isDeviceUnlocked(context)) {
                return true
            }

            Toast.makeText(
                context,
                context.getString(R.string.widget_unlock_prompt),
                Toast.LENGTH_SHORT
            ).show()
            WidgetDeviceStorage.markNeedsRefresh(context)
            updateAllWidgets(context)
            return false
        }

        fun isDeviceUnlocked(context: Context): Boolean {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val userManager = context.getSystemService<UserManager>()
                if (userManager != null && !userManager.isUserUnlocked) {
                    return false
                }
            }

            val keyguardManager = context.getSystemService<KeyguardManager>()
            val isLocked = when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
                    keyguardManager?.isDeviceLocked == true

                else -> keyguardManager?.isKeyguardLocked == true
            }

            return !isLocked
        }

        fun saveLastPassword(context: Context, password: String) {
            securePreferences(context)?.edit()?.putString(PREF_LAST_PASSWORD, password)?.apply()
        }

        fun getLastPassword(context: Context): String {
            return securePreferences(context)?.getString(PREF_LAST_PASSWORD, "") ?: ""
        }

        fun securePreferences(context: Context): SharedPreferences? {
            if (!isDeviceUnlocked(context)) {
                SafeLog.d(TAG, "Secure preferences unavailable while device is locked")
                return null
            }

            return try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()

                EncryptedSharedPreferences.create(
                    context,
                    "${PREF_NAME}_secure",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (e: Exception) {
                SafeLog.e(TAG, "Unable to access secure preferences", e)
                null
            }
        }

        private fun resolveClipboardTtlMs(context: Context): Long {
            return try {
                val securePrefs = SecurePrefs(context.applicationContext)
                SensitiveActionPreferences(securePrefs).currentClipboardTtlMs()
            } catch (e: Exception) {
                SafeLog.w(TAG, "Falling back to default clipboard TTL", e)
                SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        if (!isDeviceUnlocked(context)) {
            WidgetDeviceStorage.markNeedsRefresh(context)
        }
        updateAllWidgets(context, widgetIds = appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        intent.extras?.let { extras ->
            IntentSanitizer.sanitize(extras, intent)
        }

        val action = intent.action
        val senderPackage = IntentCompat.getSenderPackage(intent)
        val component = intent.component?.className
        if (component != null && component != PasswordWidget::class.java.name) {
            SafeLog.w(TAG, "Ignoring broadcast targeting unexpected component: $component")
            return
        }

        if (senderPackage != null && senderPackage != context.packageName) {
            SafeLog.w(TAG, "Ignoring widget broadcast from unexpected sender: $senderPackage")
            return
        }

        if (action != null && !ALLOWED_ACTIONS.contains(action)) {
            SafeLog.w(TAG, "Ignoring unauthorized widget action: $action")
            return
        }

        when (action) {
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
        if (!ensureUnlocked(context)) {
            return
        }

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
                updateAllWidgets(context, passwordOverride = password)

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
        if (!ensureUnlocked(context)) {
            return
        }

        val password = getLastPassword(context)
        if (password.isNotEmpty()) {
            val ttlMs = resolveClipboardTtlMs(context)
            ClipboardUtils.copySensitive(
                context = context,
                label = "password",
                value = password,
                ttlMs = ttlMs
            )
            Toast.makeText(
                context,
                ClipboardUtils.buildAutoClearMessage(context, ttlMs),
                Toast.LENGTH_SHORT
            ).show()
        } else {
            Toast.makeText(context, "Générez d'abord un mot de passe", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onEnabled(context: Context) {
        // Premier widget ajouté
        Toast.makeText(context, "Widget GenPwd ajouté!", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context) {
        // Dernier widget supprimé
        securePreferences(context)?.edit()?.clear()?.apply()
    }

}
