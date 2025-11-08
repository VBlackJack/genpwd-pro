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
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.presentation.navigation.AppNavGraph
import com.julien.genpwdpro.presentation.navigation.Screen
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
    vaultSessionManager: VaultSessionManager,
    biometricVaultManager: com.julien.genpwdpro.security.BiometricVaultManager,
    startDestination: String = Screen.Dashboard.route // Destination de départ
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Observer l'état de déverrouillage requis
    val requiresUnlock by vaultSessionManager.requiresUnlock.collectAsState()
    val activity = androidx.compose.ui.platform.LocalContext.current as? androidx.fragment.app.FragmentActivity

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
                    vaultSessionManager = vaultSessionManager
                )
            }
        }

        // Overlay de déverrouillage automatique après retour de l'app
        requiresUnlock?.let { unlockState ->
            QuickUnlockOverlay(
                vaultId = unlockState.vaultId,
                hasBiometric = unlockState.hasBiometric,
                activity = activity,
                vaultSessionManager = vaultSessionManager,
                biometricVaultManager = biometricVaultManager,
                onDismiss = {
                    vaultSessionManager.clearRequiresUnlock()
                },
                onUnlockSuccess = {
                    vaultSessionManager.clearRequiresUnlock()
                }
            )
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
    DrawerNavItem(
        Screen.VaultManager.route,
        Icons.Default.Storage,
        Icons.Default.Storage,
        "Gestion des Coffres"
    ),
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

/**
 * Overlay de déverrouillage rapide après retour de l'app
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickUnlockOverlay(
    vaultId: String,
    hasBiometric: Boolean,
    activity: androidx.fragment.app.FragmentActivity?,
    vaultSessionManager: VaultSessionManager,
    biometricVaultManager: com.julien.genpwdpro.security.BiometricVaultManager,
    onDismiss: () -> Unit,
    onUnlockSuccess: () -> Unit
) {
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var isUnlocking by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var biometricAttempted by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Tentative automatique de déverrouillage biométrique
    LaunchedEffect(hasBiometric, biometricAttempted) {
        if (hasBiometric && !biometricAttempted && activity != null) {
            biometricAttempted = true
            isUnlocking = true

            val result = biometricVaultManager.unlockWithBiometric(activity, vaultId)
            result.fold(
                onSuccess = { decryptedPassword ->
                    // Utiliser le password déchiffré pour déverrouiller le vault
                    val unlockResult = vaultSessionManager.unlockVault(vaultId, decryptedPassword)
                    unlockResult.fold(
                        onSuccess = {
                            onUnlockSuccess()
                        },
                        onFailure = { error ->
                            errorMessage = error.message ?: "Échec du déverrouillage"
                            isUnlocking = false
                        }
                    )
                },
                onFailure = { error ->
                    // Si biométrie échoue, afficher le formulaire de mot de passe
                    errorMessage = when (error) {
                        is com.julien.genpwdpro.security.BiometricEnrollmentInvalidatedException ->
                            "Biométrie invalidée. Veuillez utiliser votre mot de passe."
                        else -> "Biométrie échouée. Utilisez votre mot de passe."
                    }
                    isUnlocking = false
                }
            )
        }
    }

    AlertDialog(
        onDismissRequest = { /* Empêcher la fermeture involontaire */ },
        icon = {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text("Déverr ouillage requis")
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Votre session a expiré. Veuillez déverrouiller le coffre pour continuer.",
                    style = MaterialTheme.typography.bodyMedium
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                androidx.compose.material3.OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Mot de passe maître") },
                    placeholder = { Text("Entrez votre mot de passe") },
                    visualTransformation = if (showPassword)
                        androidx.compose.ui.text.input.VisualTransformation.None
                    else
                        androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Password,
                        imeAction = androidx.compose.ui.text.input.ImeAction.Done
                    ),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onDone = {
                            if (password.isNotBlank()) {
                                scope.launch {
                                    isUnlocking = true
                                    errorMessage = null
                                    val result = vaultSessionManager.unlockVault(vaultId, password)
                                    result.fold(
                                        onSuccess = { onUnlockSuccess() },
                                        onFailure = {
                                            errorMessage = it.message ?: "Échec du déverrouillage"
                                            isUnlocking = false
                                        }
                                    )
                                }
                            }
                        }
                    ),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword)
                                    Icons.Default.VisibilityOff
                                else
                                    Icons.Default.Visibility,
                                contentDescription = if (showPassword)
                                    "Masquer le mot de passe"
                                else
                                    "Afficher le mot de passe"
                            )
                        }
                    },
                    enabled = !isUnlocking,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        isUnlocking = true
                        errorMessage = null
                        val result = vaultSessionManager.unlockVault(vaultId, password)
                        result.fold(
                            onSuccess = { onUnlockSuccess() },
                            onFailure = {
                                errorMessage = it.message ?: "Échec du déverrouillage"
                                isUnlocking = false
                            }
                        )
                    }
                },
                enabled = password.isNotBlank() && !isUnlocking
            ) {
                if (isUnlocking) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Déverrouiller")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isUnlocking
            ) {
                Text("Annuler")
            }
        }
    )
}
