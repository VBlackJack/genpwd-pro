package com.julien.genpwdpro.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.NavHostController
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.domain.session.SessionManager
import kotlinx.coroutines.launch

/**
 * Écran principal avec Navigation Drawer (barre latérale rétractable)
 *
 * Features:
 * - Swipe depuis le bord gauche pour ouvrir
 * - Fermeture automatique après sélection
 * - Icône hamburger pour ouvrir manuellement
 * - Design Material Design 3
 * - Gain d'espace vertical (pas de bottom bar)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    navController: NavHostController,
    sessionManager: SessionManager
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // État du drawer
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Routes pour lesquelles afficher le menu hamburger
    val screensWithDrawer = listOf(
        Screen.Dashboard.route,
        Screen.Generator.route,
        Screen.History.route,
        Screen.VaultManager.route
    )

    val showDrawer = currentDestination?.route in screensWithDrawer

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.width(280.dp)
            ) {
                // Header du drawer
                DrawerHeader()

                Spacer(Modifier.height(12.dp))

                // Items de navigation
                drawerItems.forEach { item ->
                    val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true

                    NavigationDrawerItem(
                        icon = {
                            Icon(
                                imageVector = if (selected) item.selectedIcon else item.icon,
                                contentDescription = item.label
                            )
                        },
                        label = { Text(item.label) },
                        selected = selected,
                        onClick = {
                            if (!selected) {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }

                            // Fermer le drawer après sélection
                            scope.launch {
                                drawerState.close()
                            }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                Spacer(Modifier.height(8.dp))
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(8.dp))

                // Items secondaires
                secondaryDrawerItems.forEach { item ->
                    val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true

                    NavigationDrawerItem(
                        icon = {
                            Icon(
                                imageVector = if (selected) item.selectedIcon else item.icon,
                                contentDescription = item.label
                            )
                        },
                        label = { Text(item.label) },
                        selected = selected,
                        onClick = {
                            navController.navigate(item.route)

                            // Fermer le drawer après sélection
                            scope.launch {
                                drawerState.close()
                            }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }
        },
        // Activer le swipe gesture
        gesturesEnabled = showDrawer
    ) {
        Scaffold(
            topBar = {
                if (showDrawer) {
                    TopAppBar(
                        title = {
                            Text(
                                text = getCurrentScreenTitle(currentDestination?.route),
                                style = MaterialTheme.typography.titleLarge
                            )
                        },
                        navigationIcon = {
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        drawerState.open()
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Menu,
                                    contentDescription = "Menu"
                                )
                            }
                        }
                    )
                }
            }
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                AppNavGraph(
                    navController = navController,
                    startDestination = Screen.Dashboard.route,
                    sessionManager = sessionManager
                )
            }
        }
    }
}

/**
 * Header du Navigation Drawer
 */
@Composable
fun DrawerHeader() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primaryContainer,
        tonalElevation = 4.dp
    ) {
        Column(
            modifier = Modifier.padding(24.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "GenPwd Pro",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                text = "Password Manager",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * Obtient le titre de l'écran actuel
 */
fun getCurrentScreenTitle(route: String?): String {
    return when (route) {
        Screen.Dashboard.route -> "GenPwd Pro"
        Screen.Generator.route -> "Générateur"
        Screen.History.route -> "Historique"
        Screen.VaultManager.route -> "Gestion des Coffres"
        Screen.Analyzer.route -> "Analyseur"
        else -> "GenPwd Pro"
    }
}

/**
 * Item du Navigation Drawer
 */
data class DrawerNavItem(
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val selectedIcon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String
)

/**
 * Items principaux du drawer
 */
private val drawerItems = listOf(
    DrawerNavItem(
        route = Screen.Dashboard.route,
        icon = Icons.Default.Home,
        selectedIcon = Icons.Default.Home,
        label = "Accueil"
    ),
    DrawerNavItem(
        route = Screen.Generator.route,
        icon = Icons.Default.VpnKey,
        selectedIcon = Icons.Default.VpnKey,
        label = "Générateur"
    ),
    DrawerNavItem(
        route = Screen.VaultManager.route,
        icon = Icons.Default.Storage,
        selectedIcon = Icons.Default.Storage,
        label = "Gestion des Coffres"
    ),
    DrawerNavItem(
        route = Screen.History.route,
        icon = Icons.Default.History,
        selectedIcon = Icons.Default.History,
        label = "Historique"
    )
)

/**
 * Items secondaires du drawer
 */
private val secondaryDrawerItems = listOf(
    DrawerNavItem(
        route = Screen.Analyzer.route,
        icon = Icons.Default.Security,
        selectedIcon = Icons.Default.Security,
        label = "Analyseur"
    ),
    DrawerNavItem(
        route = Screen.SyncSettings.route,
        icon = Icons.Default.Settings,
        selectedIcon = Icons.Default.Settings,
        label = "Paramètres"
    )
)
