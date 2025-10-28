package com.julien.genpwdpro.presentation

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.julien.genpwdpro.data.sync.oauth.OAuthCallbackManager
import com.julien.genpwdpro.domain.session.AppLifecycleObserver
import com.julien.genpwdpro.domain.session.SessionManager
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Activité principale de l'application GenPwd Pro
 *
 * Point d'entrée de l'application qui configure la navigation et le thème.
 * Utilise Jetpack Compose avec Navigation Compose pour la gestion des écrans.
 * Hérite de FragmentActivity pour la compatibilité biométrique.
 *
 * Gère également les deep links OAuth2 pour la synchronisation cloud:
 * - genpwdpro://oauth/pcloud - Callback OAuth2 pCloud
 * - genpwdpro://oauth/proton - Callback OAuth2 ProtonDrive
 *
 * Améliorations v2:
 * - Gestion de session avec timeout (24h par défaut)
 * - Auto-lock après 5 minutes en arrière-plan
 * - Nettoyage uniquement des sessions expirées
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val SESSION_TIMEOUT_HOURS = 24L
    }

    @Inject
    lateinit var sessionManager: SessionManager

    @Inject
    lateinit var vaultSessionManager: VaultSessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setupSessionManagement()
        setupContent()
        handleDeepLinkIfPresent(intent)
    }

    /**
     * Configure la gestion de session avec timeout et auto-lock
     */
    private fun setupSessionManagement() {
        lifecycleScope.launch {
            // Nettoyer uniquement les sessions expirées (pas toutes les sessions)
            val hasExpired = sessionManager.clearExpiredSessions(SESSION_TIMEOUT_HOURS)
            if (hasExpired) {
                Log.d(TAG, "Expired sessions cleared on app start")
            } else {
                Log.d(TAG, "No expired sessions - vault remains unlocked")
            }
        }

        // Ajouter l'observateur de cycle de vie pour l'auto-lock
        lifecycle.addObserver(AppLifecycleObserver(sessionManager, vaultSessionManager))
    }

    /**
     * Configure le contenu Compose
     */
    private fun setupContent() {
        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    // Écran principal avec Dashboard et bottom navigation
                    MainScreen(
                        navController = navController,
                        sessionManager = sessionManager,
                        vaultSessionManager = vaultSessionManager
                    )
                }
            }
        }
    }

    /**
     * Gère les deep links OAuth2 si présents dans l'intent
     */
    private fun handleDeepLinkIfPresent(intent: Intent?) {
        intent?.data?.let { uri ->
            if (uri.scheme == "genpwdpro" && uri.host == "oauth") {
                handleOAuthDeepLink(uri)
            }
        }
    }

    /**
     * Appelé quand une nouvelle Intent arrive pendant que l'activité est active
     * (grâce à launchMode="singleTask")
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLinkIfPresent(intent)
    }

    /**
     * Gérer les deep links OAuth2
     *
     * Extrait l'URI du deep link et le transmet au OAuthCallbackManager
     * qui notifiera le provider approprié.
     */
    private fun handleOAuthDeepLink(uri: Uri) {
        Log.d(TAG, "Received OAuth deep link: $uri")

        lifecycleScope.launch {
            try {
                val handled = OAuthCallbackManager.handleCallback(uri)

                if (handled) {
                    Log.i(TAG, "OAuth callback handled successfully")
                    // TODO: Afficher un message de succès à l'utilisateur
                    // TODO: Naviguer vers l'écran de sync settings
                } else {
                    Log.w(TAG, "OAuth callback was not handled")
                    // TODO: Afficher un message d'erreur à l'utilisateur
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling OAuth callback", e)
                // TODO: Afficher un message d'erreur à l'utilisateur
            }
        }
    }
}
