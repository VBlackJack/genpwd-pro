package com.julien.genpwdpro.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.presentation.onboarding.OnboardingScreen
import com.julien.genpwdpro.presentation.screens.GeneratorScreen
import com.julien.genpwdpro.presentation.screens.analyzer.AnalyzerScreen
import com.julien.genpwdpro.presentation.screens.autofill.AutofillSettingsScreen
import com.julien.genpwdpro.presentation.screens.customphrase.CustomPhraseScreen
import com.julien.genpwdpro.presentation.screens.history.HistoryScreen
import com.julien.genpwdpro.presentation.screens.security.SecuritySettingsScreen
import com.julien.genpwdpro.presentation.screens.sync.SyncSettingsScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Routes de navigation
 */
sealed class Screen(val route: String) {
    object Onboarding : Screen("onboarding")
    object Generator : Screen("generator")
    object History : Screen("history")
    object Analyzer : Screen("analyzer")
    object CustomPhrase : Screen("custom_phrase")
    object SyncSettings : Screen("sync_settings")
    object AutofillSettings : Screen("autofill_settings")
    object SecuritySettings : Screen("security_settings")
}

/**
 * Navigation principale de l'application
 */
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController(),
    generationMode: String? = null,
    quickGenerate: Boolean = false,
    viewModel: NavigationViewModel = hiltViewModel()
) {
    val isOnboardingCompleted by viewModel.isOnboardingCompleted.collectAsState(initial = true)

    val startDestination = if (isOnboardingCompleted) {
        Screen.Generator.route
    } else {
        Screen.Onboarding.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Écran d'onboarding
        composable(Screen.Onboarding.route) {
            OnboardingScreen(
                onComplete = {
                    viewModel.completeOnboarding()
                    navController.navigate(Screen.Generator.route) {
                        // Supprimer l'onboarding de la pile
                        popUpTo(Screen.Onboarding.route) { inclusive = true }
                    }
                }
            )
        }

        // Écran de génération
        composable(Screen.Generator.route) {
            GeneratorScreen(
                onNavigateToHistory = {
                    navController.navigate(Screen.History.route)
                },
                onNavigateToAnalyzer = {
                    navController.navigate(Screen.Analyzer.route)
                },
                onNavigateToCustomPhrase = {
                    navController.navigate(Screen.CustomPhrase.route)
                },
                onNavigateToSyncSettings = {
                    navController.navigate(Screen.SyncSettings.route)
                },
                initialMode = generationMode,
                autoGenerate = quickGenerate
            )
        }

        // Écran d'historique
        composable(Screen.History.route) {
            HistoryScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Écran d'analyse
        composable(Screen.Analyzer.route) {
            AnalyzerScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Écran Custom Phrase
        composable(Screen.CustomPhrase.route) {
            CustomPhraseScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onSaveAndGenerate = { words, format, wordCount, separator ->
                    // TODO: Sauvegarder et retourner au générateur
                    navController.popBackStack()
                }
            )
        }

        // Écran Sync Settings
        composable(Screen.SyncSettings.route) {
            SyncSettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToAutofill = {
                    navController.navigate(Screen.AutofillSettings.route)
                },
                onNavigateToSecurity = {
                    navController.navigate(Screen.SecuritySettings.route)
                }
            )
        }

        // Écran Autofill Settings
        composable(Screen.AutofillSettings.route) {
            AutofillSettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Écran Security Settings
        composable(Screen.SecuritySettings.route) {
            SecuritySettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}

/**
 * ViewModel pour gérer l'état de la navigation
 */
@HiltViewModel
class NavigationViewModel @Inject constructor(
    private val settingsDataStore: SettingsDataStore
) : ViewModel() {

    val isOnboardingCompleted = settingsDataStore.isOnboardingCompleted
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = true // Par défaut true pour éviter le flash
        )

    fun completeOnboarding() {
        viewModelScope.launch {
            settingsDataStore.setOnboardingCompleted()
        }
    }
}
