package com.julien.genpwdpro.presentation

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
// Temporarily disabled due to compilation error
// import com.julien.genpwdpro.data.sync.oauth.OAuthCallbackManager
import com.julien.genpwdpro.domain.session.SessionManager
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Activité principale de l'application GenPwd Pro
 *
 * Point d'entrée de l'application qui configure la navigation et le thème.
 * Utilise Jetpack Compose avec Navigation Compose pour la gestion des écrans.
 *
 * Gère également les deep links OAuth2 pour la synchronisation cloud:
 * - genpwdpro://oauth/pcloud - Callback OAuth2 pCloud
 * - genpwdpro://oauth/proton - Callback OAuth2 ProtonDrive
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    @Inject
    lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Gérer les deep links OAuth2 au lancement
        // Temporarily disabled due to OAuthCallbackManager compilation error
        // handleOAuthDeepLink(intent)

        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    // ✅ VaultSelector restauré après migration Lazysodium
                    AppNavGraph(
                        navController = navController,
                        startDestination = Screen.VaultSelector.route,
                        sessionManager = sessionManager
                    )
                }
            }
        }
    }

    /**
     * Appelé quand une nouvelle Intent arrive pendant que l'activité est active
     * (grâce à launchMode="singleTask")
     *
     * Temporarily disabled due to OAuthCallbackManager compilation error
     */
    /*
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthDeepLink(intent)
    }

    /**
     * Gérer les deep links OAuth2
     *
     * Extrait l'URI du deep link et le transmet au OAuthCallbackManager
     * qui notifiera le provider approprié.
     */
    private fun handleOAuthDeepLink(intent: Intent?) {
        val data: Uri? = intent?.data

        if (data != null && data.scheme == "genpwdpro" && data.host == "oauth") {
            Log.d(TAG, "Received OAuth deep link: $data")

            lifecycleScope.launch {
                val handled = OAuthCallbackManager.handleCallback(data)

                if (handled) {
                    Log.i(TAG, "OAuth callback handled successfully")
                    // TODO: Afficher un message de succès à l'utilisateur
                    // TODO: Naviguer vers l'écran de sync settings
                } else {
                    Log.w(TAG, "OAuth callback was not handled")
                    // TODO: Afficher un message d'erreur à l'utilisateur
                }
            }
        }
    }
    */
}
