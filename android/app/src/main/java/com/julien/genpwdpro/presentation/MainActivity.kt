package com.julien.genpwdpro.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Activité principale de l'application GenPwd Pro
 *
 * Point d'entrée de l'application qui configure la navigation et le thème.
 * Utilise Jetpack Compose avec Navigation Compose pour la gestion des écrans.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    // Point d'entrée : VaultSelector
                    // L'utilisateur pourra soit :
                    // - Créer un nouveau vault
                    // - Déverrouiller un vault existant
                    // - Utiliser le générateur simple (mode standalone)
                    AppNavGraph(
                        navController = navController,
                        startDestination = Screen.VaultSelector.route
                    )
                }
            }
        }
    }
}
