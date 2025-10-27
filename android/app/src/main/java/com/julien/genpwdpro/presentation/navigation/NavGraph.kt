package com.julien.genpwdpro.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.presentation.screens.GeneratorScreen
import com.julien.genpwdpro.presentation.screens.analyzer.AnalyzerScreen
import com.julien.genpwdpro.presentation.screens.customphrase.CustomPhraseScreen
import com.julien.genpwdpro.presentation.screens.history.HistoryScreen
import com.julien.genpwdpro.presentation.screens.sync.SyncSettingsScreen
import com.julien.genpwdpro.presentation.vault.*

/**
 * Routes de navigation de l'application
 */
sealed class Screen(val route: String) {
    // Générateur (écran existant)
    object Generator : Screen("generator")

    // Historique (écran existant)
    object History : Screen("history")

    // Onboarding
    object Onboarding : Screen("onboarding")

    // Analyzer
    object Analyzer : Screen("analyzer")

    // Custom Phrase
    object CustomPhrase : Screen("custom_phrase")

    // Sync Settings
    object SyncSettings : Screen("sync_settings")
    object SyncHistory : Screen("sync_history")

    // Autofill Settings
    object AutofillSettings : Screen("autofill_settings")

    // Security Settings
    object SecuritySettings : Screen("security_settings")

    // Vault - Sélection/Création
    object VaultSelector : Screen("vault_selector")
    object CreateVault : Screen("create_vault")

    // Vault - Déverrouillage et liste
    object UnlockVault : Screen("unlock_vault/{vaultId}") {
        fun createRoute(vaultId: String) = "unlock_vault/$vaultId"
    }

    object VaultList : Screen("vault_list/{vaultId}") {
        fun createRoute(vaultId: String) = "vault_list/$vaultId"
    }

    // Entry - Création/Édition
    object CreateEntry : Screen("create_entry/{vaultId}?type={type}&password={password}") {
        fun createRoute(vaultId: String, type: EntryType = EntryType.LOGIN, password: String? = null) =
            if (password != null) {
                "create_entry/$vaultId?type=${type.name}&password=${java.net.URLEncoder.encode(password, "UTF-8")}"
            } else {
                "create_entry/$vaultId?type=${type.name}"
            }
    }

    object EditEntry : Screen("edit_entry/{vaultId}/{entryId}") {
        fun createRoute(vaultId: String, entryId: String) =
            "edit_entry/$vaultId/$entryId"
    }
}

/**
 * NavHost principal de l'application
 */
@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String = Screen.VaultSelector.route,
    sessionManager: com.julien.genpwdpro.domain.session.SessionManager
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // ========== Générateur (écran existant) ==========
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
                onNavigateToSecurity = {
                    navController.navigate(Screen.SecuritySettings.route)
                },
                onSaveToVault = { password ->
                    // Vérifier si un vault est déverrouillé
                    val vaultId = sessionManager.getCurrentVaultId()
                    if (vaultId != null) {
                        // Naviguer vers CreateEntry avec le mot de passe
                        navController.navigate(
                            Screen.CreateEntry.createRoute(
                                vaultId = vaultId,
                                type = EntryType.LOGIN,
                                password = password
                            )
                        )
                    }
                    // Sinon, le GeneratorScreen affichera déjà le message d'erreur
                }
            )
        }

        // ========== Historique (écran existant) ==========
        composable(Screen.History.route) {
            HistoryScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Analyzer ==========
        composable(Screen.Analyzer.route) {
            AnalyzerScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Custom Phrase ==========
        composable(Screen.CustomPhrase.route) {
            CustomPhraseScreen(
                onNavigateBack = { navController.popBackStack() },
                onSaveAndGenerate = { wordList, format, wordCount, separator ->
                    // Navigate back to generator with custom phrase settings
                    navController.popBackStack()
                }
            )
        }

        // ========== Sync Settings ==========
        composable(Screen.SyncSettings.route) {
            SyncSettingsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Vault Selector ==========
        composable(Screen.VaultSelector.route) {
            VaultSelectorScreen(
                onVaultSelected = { vault ->
                    navController.navigate(Screen.UnlockVault.createRoute(vault.id))
                },
                onCreateVault = {
                    navController.navigate(Screen.CreateVault.route)
                },
                onNavigateToGenerator = {
                    navController.navigate(Screen.Generator.route)
                }
            )
        }

        // ========== Create Vault ==========
        composable(Screen.CreateVault.route) {
            CreateVaultScreen(
                onVaultCreated = { vaultId ->
                    // Après création, aller directement à la liste (vault déjà déverrouillé)
                    navController.navigate(Screen.VaultList.createRoute(vaultId)) {
                        // Nettoyer le backstack
                        popUpTo(Screen.VaultSelector.route) {
                            inclusive = false
                        }
                    }
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        // ========== Unlock Vault ==========
        composable(
            route = Screen.UnlockVault.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            // Récupérer le vault depuis le ViewModel
            // Pour simplifier, on passe vaultId et le screen charge les détails
            UnlockVaultScreen(
                vaultId = vaultId,
                onVaultUnlocked = {
                    navController.navigate(Screen.VaultList.createRoute(vaultId)) {
                        // Remplacer l'unlock screen
                        popUpTo(Screen.UnlockVault.route) {
                            inclusive = true
                        }
                    }
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        // ========== Vault List ==========
        composable(
            route = Screen.VaultList.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            VaultListScreen(
                vaultId = vaultId,
                onEntryClick = { entryId ->
                    navController.navigate(Screen.EditEntry.createRoute(vaultId, entryId))
                },
                onAddEntry = { entryType ->
                    navController.navigate(Screen.CreateEntry.createRoute(vaultId, entryType))
                },
                onSettingsClick = {
                    navController.navigate(Screen.SyncSettings.route)
                },
                onLockClick = {
                    // Retourner au vault selector
                    navController.navigate(Screen.VaultSelector.route) {
                        popUpTo(Screen.VaultSelector.route) {
                            inclusive = true
                        }
                    }
                }
            )
        }

        // ========== Create Entry ==========
        composable(
            route = Screen.CreateEntry.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType },
                navArgument("type") {
                    type = NavType.StringType
                    defaultValue = EntryType.LOGIN.name
                },
                navArgument("password") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable
            val typeString = backStackEntry.arguments?.getString("type") ?: EntryType.LOGIN.name
            val entryType = try {
                EntryType.valueOf(typeString)
            } catch (e: IllegalArgumentException) {
                EntryType.LOGIN
            }
            val initialPassword = backStackEntry.arguments?.getString("password")

            EntryEditScreen(
                vaultId = vaultId,
                entryId = null,
                entryType = entryType,
                initialPassword = initialPassword,
                onSaved = {
                    navController.popBackStack()
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        // ========== Edit Entry ==========
        composable(
            route = Screen.EditEntry.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType },
                navArgument("entryId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable
            val entryId = backStackEntry.arguments?.getString("entryId") ?: return@composable

            EntryEditScreen(
                vaultId = vaultId,
                entryId = entryId,
                onSaved = {
                    navController.popBackStack()
                },
                onBackClick = { navController.popBackStack() }
            )
        }
    }
}

/**
 * Extension pour simplifier la navigation
 */
fun NavHostController.navigateToVaultList(vaultId: String) {
    navigate(Screen.VaultList.createRoute(vaultId))
}

fun NavHostController.navigateToCreateEntry(vaultId: String, type: EntryType = EntryType.LOGIN) {
    navigate(Screen.CreateEntry.createRoute(vaultId, type))
}

fun NavHostController.navigateToEditEntry(vaultId: String, entryId: String) {
    navigate(Screen.EditEntry.createRoute(vaultId, entryId))
}
