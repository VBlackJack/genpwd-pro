package com.julien.genpwdpro.presentation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.NavHostController
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.domain.session.SessionManager

/**
 * Écran principal avec bottom navigation
 *
 * Structure:
 * - Dashboard (Accueil unifié)
 * - Generator (Générateur complet)
 * - Vaults (Gestion des coffres)
 */
@Composable
fun MainScreen(
    navController: NavHostController,
    sessionManager: SessionManager
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Routes pour lesquelles afficher la bottom navigation
    val screensWithBottomNav = listOf(
        Screen.Dashboard.route,
        Screen.Generator.route,
        Screen.VaultSelector.route
    )

    // Afficher la bottom nav seulement sur certains écrans
    val showBottomBar = currentDestination?.route in screensWithBottomNav

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true

                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (selected) item.selectedIcon else item.icon,
                                    contentDescription = item.label,
                                    modifier = Modifier.size(24.dp)
                                )
                            },
                            selected = selected,
                            alwaysShowLabel = false,
                            onClick = {
                                if (!selected) {
                                    navController.navigate(item.route) {
                                        // Pop up to start destination to avoid building a large back stack
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        // Avoid multiple copies of the same destination
                                        launchSingleTop = true
                                        // Restore state when reselecting a previously selected item
                                        restoreState = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        // Apply padding from Scaffold to avoid bottom bar covering content
        Box(modifier = Modifier.padding(paddingValues)) {
            AppNavGraph(
                navController = navController,
                startDestination = Screen.Dashboard.route,
                sessionManager = sessionManager
            )
        }
    }
}

/**
 * Item de la bottom navigation
 */
data class BottomNavItem(
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val selectedIcon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String
)

/**
 * Liste des items de la bottom navigation
 */
private val bottomNavItems = listOf(
    BottomNavItem(
        route = Screen.Dashboard.route,
        icon = Icons.Default.Home,
        selectedIcon = Icons.Default.Home,
        label = "Accueil"
    ),
    BottomNavItem(
        route = Screen.Generator.route,
        icon = Icons.Default.VpnKey,
        selectedIcon = Icons.Default.VpnKey,
        label = "Générateur"
    ),
    BottomNavItem(
        route = Screen.VaultSelector.route,
        icon = Icons.Default.Lock,
        selectedIcon = Icons.Default.Lock,
        label = "Coffres"
    )
)
