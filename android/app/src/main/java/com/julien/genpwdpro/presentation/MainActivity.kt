package com.julien.genpwdpro.presentation

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.julien.genpwdpro.data.sync.oauth.OAuthCallbackManager
import com.julien.genpwdpro.domain.session.AppLifecycleObserver
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.domain.session.VaultStartupLocker
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint
import com.julien.genpwdpro.core.log.SafeLog
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Activité principale de l'application GenPwd Pro
 *
 * Point d'entrée de l'application qui configure la navigation et le thème.
 * Gère les intents de deep link (OAuth) et d'autofill.
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val SESSION_TIMEOUT_HOURS = 24L
        const val EXTRA_AUTOFILL_UNLOCK_REQUEST = "AUTOFILL_UNLOCK_REQUEST"
    }

    @Inject
    lateinit var vaultSessionManager: VaultSessionManager

    @Inject
    lateinit var vaultStartupLocker: VaultStartupLocker

    @Inject
    lateinit var biometricVaultManager: com.julien.genpwdpro.security.BiometricVaultManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fixed: Use lifecycleScope instead of runBlocking to avoid blocking main thread
        // This prevents ANR (Application Not Responding) during startup
        lifecycleScope.launch {
            val startupResult = vaultStartupLocker.secureStartup()
            if (!startupResult.isSecure) {
                SafeLog.w(
                    TAG,
                    "Startup lockdown completed with warnings (fileLocked=${startupResult.fileSessionLocked}, " +
                        "registryReset=${startupResult.registryResetSucceeded}, fallback=${startupResult.fallbackApplied}). " +
                        "Errors=${SafeLog.redact(startupResult.errors)}"
                )
            }

            setupSessionManagement()

            val startDestination = handleInitialIntent(intent)

            setupContent(startDestination)

            handleDeepLinkIfPresent(intent)
        }
    }

    /**
     * Détermine la destination de départ en fonction de l'intent de lancement.
     */
    private fun handleInitialIntent(intent: Intent?): String {
        return if (intent?.getBooleanExtra(EXTRA_AUTOFILL_UNLOCK_REQUEST, false) == true) {
            SafeLog.d(TAG, "Intent d'autofill détecté, démarrage sur VaultManager.")
            Screen.VaultManager.route
        } else {
            Screen.Dashboard.route
        }
    }

    /**
     * Configure la gestion de session avec timeout et auto-lock.
     */
    private fun setupSessionManagement() {
        lifecycleScope.launch {
            val lockedExpiredSession = vaultSessionManager.clearExpiredSession(SESSION_TIMEOUT_HOURS)
            SafeLog.d(
                TAG,
                "Expired session check completed after startup lockdown (locked=$lockedExpiredSession)."
            )
        }
        lifecycle.addObserver(AppLifecycleObserver(this, vaultSessionManager))
    }

    /**
     * Configure le contenu Jetpack Compose.
     */
    private fun setupContent(startDestination: String) {
        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    MainScreen(
                        navController = navController,
                        vaultSessionManager = vaultSessionManager,
                        biometricVaultManager = biometricVaultManager,
                        startDestination = startDestination // Fournir la destination de départ
                    )
                }
            }
        }
    }

    /**
     * Gère les deep links OAuth2 si présents dans l'intent.
     */
    private fun handleDeepLinkIfPresent(intent: Intent?) {
        intent?.data?.let { uri ->
            if (uri.scheme == "genpwdpro" && uri.host == "oauth") {
                handleOAuthDeepLink(uri)
            }
        }
    }

    /**
     * Appelé quand une nouvelle Intent arrive alors que l'activité est active.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLinkIfPresent(intent)
    }

    /**
     * Gère les deep links OAuth2.
     */
    private fun handleOAuthDeepLink(uri: Uri) {
        SafeLog.d(TAG, "Deep link OAuth reçu: ${SafeLog.redact(uri)}")
        lifecycleScope.launch {
            try {
                val handled = OAuthCallbackManager.handleCallback(uri)
                if (handled) {
                    SafeLog.i(TAG, "Callback OAuth traité avec succès.")
                } else {
                    SafeLog.w(TAG, "Callback OAuth non traité.")
                }
            } catch (e: Exception) {
                SafeLog.e(TAG, "Erreur lors du traitement du callback OAuth.", e)
            }
        }
    }
}
