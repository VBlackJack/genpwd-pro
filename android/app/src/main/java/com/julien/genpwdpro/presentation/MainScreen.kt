package com.julien.genpwdpro.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.NavHostController
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
import com.julien.genpwdpro.domain.session.SessionManager
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.launch

/**
 * Écran principal avec Navigation Drawer (barre latérale rétractable)
 *
 * Gère la navigation principale et la structure de l'UI (TopAppBar, Drawer).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    navController: NavHostController,
    sessionManager: SessionManager,
    vaultSessionManager: VaultSessionManager,
    startDestination: String = Screen.Dashboard.route // Destination de départ
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val screensWithDrawer = listOf(
        Screen.Dashboard.route,
        Screen.Generator.route,
        Screen.History.route,
        Screen.VaultManager.route,
        // Enable drawer in vault screens for better navigation
        "vault_list/{vaultId}" // VaultList screen pattern
    )
    // Check if current route matches any drawer-enabled screen (including parameterized routes)
    val showDrawer = screensWithDrawer.any { pattern ->
        currentDestination?.route?.startsWith(pattern.substringBefore("{")) == true ||
        currentDestination?.route == pattern
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.width(280.dp)
            ) {
                DrawerHeader()
                Spacer(Modifier.height(12.dp))

                drawerItems.forEach { item ->
                    val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                    NavigationDrawerItem(
                        icon = { Icon(if (selected) item.selectedIcon else item.icon, item.label) },
                        label = { Text(item.label) },
                        selected = selected,
                        onClick = {
                            if (!selected) {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                            scope.launch { drawerState.close() }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                Spacer(Modifier.height(8.dp))
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(8.dp))

                secondaryDrawerItems.forEach { item ->
                    val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                    NavigationDrawerItem(
                        icon = { Icon(if (selected) item.selectedIcon else item.icon, item.label) },
                        label = { Text(item.label) },
                        selected = selected,
                        onClick = {
                            navController.navigate(item.route)
                            scope.launch { drawerState.close() }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }
        },
        gesturesEnabled = showDrawer
    ) {
        Scaffold(
            topBar = {
                if (showDrawer) {
                    TopAppBar(
                        title = { Text(getCurrentScreenTitle(currentDestination?.route)) },
                        navigationIcon = {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Default.Menu, "Menu")
                            }
                        }
                    )
                }
            }
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                AppNavGraph(
                    navController = navController,
                    startDestination = startDestination, // Utiliser la destination dynamique
                    sessionManager = sessionManager,
                    vaultSessionManager = vaultSessionManager
                )
            }
        }
    }
}

@Composable
fun DrawerHeader() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primaryContainer,
        tonalElevation = 4.dp
    ) {
        Column(modifier = Modifier.padding(24.dp)) {
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

fun getCurrentScreenTitle(route: String?): String {
    return when {
        route == Screen.Dashboard.route -> "GenPwd Pro"
        route == Screen.Generator.route -> "Générateur"
        route == Screen.History.route -> "Historique"
        route == Screen.VaultManager.route -> "Gestion des Coffres"
        route == Screen.Analyzer.route -> "Analyseur"
        route?.startsWith("vault_list/") == true -> "Coffre-fort"
        else -> "GenPwd Pro"
    }
}

data class DrawerNavItem(
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val selectedIcon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String
)

private val drawerItems = listOf(
    DrawerNavItem(Screen.Dashboard.route, Icons.Default.Home, Icons.Default.Home, "Accueil"),
    DrawerNavItem(Screen.Generator.route, Icons.Default.VpnKey, Icons.Default.VpnKey, "Générateur"),
    DrawerNavItem(Screen.VaultManager.route, Icons.Default.Storage, Icons.Default.Storage, "Gestion des Coffres"),
    DrawerNavItem(Screen.History.route, Icons.Default.History, Icons.Default.History, "Historique")
)

private val secondaryDrawerItems = listOf(
    DrawerNavItem(
        Screen.Analyzer.route,
        Icons.Default.Security,
        Icons.Default.Security,
        "Analyseur"
    ),
    DrawerNavItem(
        Screen.CustomPhrase.route,
        Icons.Default.Key,
        Icons.Default.Key,
        "Phrases personnalisées"
    ),
    DrawerNavItem(
        Screen.SyncSettings.route,
        Icons.Default.Settings,
        Icons.Default.Settings,
        "Paramètres"
    )
)
