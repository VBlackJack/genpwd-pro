package com.julien.genpwdpro.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.julien.genpwdpro.presentation.screens.GeneratorScreen
import com.julien.genpwdpro.presentation.screens.history.HistoryScreen

/**
 * Routes de navigation
 */
sealed class Screen(val route: String) {
    object Generator : Screen("generator")
    object History : Screen("history")
}

/**
 * Navigation principale de l'application
 */
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Generator.route
    ) {
        // Écran de génération
        composable(Screen.Generator.route) {
            GeneratorScreen(
                onNavigateToHistory = {
                    navController.navigate(Screen.History.route)
                }
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
    }
}
