package com.julien.genpwdpro.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.models.vault.EntryType
import com.julien.genpwdpro.presentation.screens.GeneratorScreen
import com.julien.genpwdpro.presentation.screens.analyzer.AnalyzerScreen
import com.julien.genpwdpro.presentation.screens.customphrase.CustomPhraseScreen
import com.julien.genpwdpro.presentation.screens.history.HistoryScreen
import com.julien.genpwdpro.presentation.screens.sync.SyncSettingsScreen
import com.julien.genpwdpro.presentation.sync.CloudAccountsScreen
import com.julien.genpwdpro.presentation.sync.CloudAccountsViewModel
import com.julien.genpwdpro.presentation.sync.AddCloudAccountScreen
import com.julien.genpwdpro.presentation.sync.ConflictResolutionScreen
import com.julien.genpwdpro.presentation.vault.*
import com.julien.genpwdpro.presentation.dashboard.DashboardScreen
import kotlinx.coroutines.launch

/**
 * Routes de navigation de l'application
 */
sealed class Screen(val route: String) {
    // Dashboard (écran d'accueil unifié)
    object Dashboard : Screen("dashboard")

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

    // Cloud Sync
    object CloudAccounts : Screen("cloud_accounts")
    object AddCloudAccount : Screen("add_cloud_account")
    object ConflictResolution : Screen("conflict_resolution")

    // Autofill Settings
    object AutofillSettings : Screen("autofill_settings")

    // Security Settings
    object SecuritySettings : Screen("security_settings")
    object Privacy : Screen("privacy")

    // Preset Manager
    object PresetManager : Screen("preset_manager/{vaultId}") {
        fun createRoute(vaultId: String) = "preset_manager/$vaultId"
    }

    // Vault Manager (nouveau système de gestion des vaults)
    object VaultManager : Screen("vault_manager")

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

    // Entry - Sélection du type
    object SelectEntryType : Screen("select_entry_type/{vaultId}?password={password}") {
        fun createRoute(vaultId: String, password: String? = null) =
            if (password != null) {
                "select_entry_type/$vaultId?password=${java.net.URLEncoder.encode(password, "UTF-8")}"
            } else {
                "select_entry_type/$vaultId"
            }
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

    // Vault Presets (liste des presets dans le vault)
    object VaultPresets : Screen("vault_presets/{vaultId}") {
        fun createRoute(vaultId: String) = "vault_presets/$vaultId"
    }

    // Preset Detail (détail d'un preset)
    object PresetDetail : Screen("preset_detail/{vaultId}/{presetId}") {
        fun createRoute(vaultId: String, presetId: String) =
            "preset_detail/$vaultId/$presetId"
    }

    // Change Master Password
    object ChangeMasterPassword : Screen("change_master_password/{vaultId}") {
        fun createRoute(vaultId: String) = "change_master_password/$vaultId"
    }

    // Password Health Analysis
    object PasswordHealth : Screen("password_health/{vaultId}") {
        fun createRoute(vaultId: String) = "password_health/$vaultId"
    }
}

/**
 * NavHost principal de l'application
 */
@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Dashboard.route,
    vaultSessionManager: com.julien.genpwdpro.domain.session.VaultSessionManager
) {
    val navScope = rememberCoroutineScope()

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // ========== Dashboard (écran d'accueil unifié) ==========
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToVault = { vaultId ->
                    val currentVaultId = vaultSessionManager.getCurrentVaultId()
                    val isUnlocked = vaultSessionManager.isVaultUnlocked()

                    if (isUnlocked && currentVaultId == vaultId) {
                        navController.navigate(Screen.VaultList.createRoute(vaultId)) {
                            launchSingleTop = true
                        }
                    } else {
                        navController.navigate(Screen.UnlockVault.createRoute(vaultId))
                    }
                },
                onNavigateToVaultList = { vaultId ->
                    navController.navigate(Screen.VaultList.createRoute(vaultId)) {
                        launchSingleTop = true
                    }
                },
                onNavigateToVaultManager = {
                    navController.navigate(Screen.VaultManager.route)
                },
                onNavigateToHistory = {
                    navController.navigate(Screen.History.route)
                },
                onNavigateToAnalyzer = {
                    navController.navigate(Screen.Analyzer.route)
                },
                onNavigateToCustomPhrase = {
                    navController.navigate(Screen.CustomPhrase.route)
                },
                onNavigateToPresetManager = { vaultId ->
                    navController.navigate(Screen.PresetManager.createRoute(vaultId))
                }
            )
        }

        // ========== Générateur (écran existant) ==========
        composable(Screen.Generator.route) {
            // ✅ FIX: Utiliser VaultSessionManager (nouveau système file-based)
            val currentVaultId = vaultSessionManager.getCurrentVaultId()
            SafeLog.d(
                "NavGraph",
                "Generator - Current vault ID: ${SafeLog.redact(currentVaultId)}"
            )

            GeneratorScreen(
                vaultId = currentVaultId,
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
                onNavigateToPresetManager = {
                    currentVaultId?.let { vaultId ->
                        navController.navigate(Screen.PresetManager.createRoute(vaultId))
                    }
                },
                onSaveToVault = currentVaultId?.let { unlockedVaultId ->
                    { password ->
                        navController.navigate(
                            Screen.SelectEntryType.createRoute(
                                vaultId = unlockedVaultId,
                                password = password
                            )
                        )
                    }
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
                onNavigateBack = { navController.popBackStack() },
                onNavigateToCloudAccounts = {
                    navController.navigate(Screen.CloudAccounts.route)
                }
            )
        }

        // ========== Cloud Accounts ==========
        composable(Screen.CloudAccounts.route) {
            CloudAccountsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToAddAccount = {
                    navController.navigate(Screen.AddCloudAccount.route)
                }
            )
        }

        // ========== Add Cloud Account ==========
        composable(Screen.AddCloudAccount.route) {
            val viewModel: CloudAccountsViewModel = hiltViewModel()

            AddCloudAccountScreen(
                onNavigateBack = { navController.popBackStack() },
                onProviderSelected = { providerKind ->
                    // Start OAuth flow via ViewModel
                    viewModel.addAccount(providerKind)
                    // Stay on this screen - errors will be shown via ViewModel events
                }
            )
        }

        // ========== Conflict Resolution ==========
        composable(Screen.ConflictResolution.route) {
            // TODO: Pass actual conflicts list from state
            ConflictResolutionScreen(
                conflicts = emptyList(),
                onResolve = { conflict, resolution ->
                    // TODO: Handle conflict resolution
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Preset Manager ==========
        composable(
            route = Screen.PresetManager.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            com.julien.genpwdpro.presentation.preset.PresetListScreen(
                vaultId = vaultId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Vault Manager ==========
        composable(Screen.VaultManager.route) {
            com.julien.genpwdpro.presentation.vaultmanager.VaultManagerScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToVault = { vaultId ->
                    navController.navigate(Screen.UnlockVault.createRoute(vaultId))
                }
            )
        }

        // ========== Unlock Vault ==========
        // Note: Legacy VaultSelector and CreateVault screens were removed in favor of VaultManager (file-based system)
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
                    // Retirer explicitement l'écran de déverrouillage du back stack
                    navController.popBackStack()
                    navController.navigate(Screen.VaultList.createRoute(vaultId)) {
                        launchSingleTop = true
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
                onImportExportClick = {
                    // TODO: Import/Export feature not available in this build
                    // navController.navigate(Screen.ImportExport.createRoute(vaultId))
                },
                onPresetsClick = {
                    navController.navigate(Screen.VaultPresets.createRoute(vaultId))
                },
                onChangeMasterPasswordClick = {
                    navController.navigate(Screen.ChangeMasterPassword.createRoute(vaultId))
                },
                onPasswordHealthClick = {
                    navController.navigate(Screen.PasswordHealth.createRoute(vaultId))
                },
                onVaultManagerClick = {
                    navController.navigate(Screen.VaultManager.route) {
                        popUpTo(Screen.Dashboard.route) {
                            inclusive = false
                        }
                    }
                },
                onNavigateToHome = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(navController.graph.startDestinationId) {
                            inclusive = false
                        }
                        launchSingleTop = true
                    }
                },
                onLockClick = {
                    // Verrouiller le vault avant de naviguer
                    navScope.launch {
                        vaultSessionManager.lockVault()
                        // Return to dashboard
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Dashboard.route) {
                                inclusive = true
                            }
                        }
                    }
                }
            )
        }

        // ========== Select Entry Type ==========
        composable(
            route = Screen.SelectEntryType.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType },
                navArgument("password") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable
            val initialPassword = backStackEntry.arguments?.getString("password")

            EntryTypeSelectionScreen(
                vaultId = vaultId,
                initialPassword = initialPassword,
                onTypeSelected = { selectedType ->
                    navController.navigate(
                        Screen.CreateEntry.createRoute(
                            vaultId = vaultId,
                            type = selectedType,
                            password = initialPassword
                        )
                    )
                },
                onBackClick = { navController.popBackStack() }
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

        // ========== Vault Presets ==========
        composable(
            route = Screen.VaultPresets.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            VaultPresetsScreen(
                vaultId = vaultId,
                onNavigateBack = { navController.popBackStack() },
                onPresetClick = { presetId ->
                    navController.navigate(Screen.PresetDetail.createRoute(vaultId, presetId))
                }
            )
        }

        // ========== Preset Detail ==========
        composable(
            route = Screen.PresetDetail.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType },
                navArgument("presetId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable
            val presetId = backStackEntry.arguments?.getString("presetId") ?: return@composable

            PresetDetailScreen(
                vaultId = vaultId,
                presetId = presetId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ========== Change Master Password ==========
        composable(
            route = Screen.ChangeMasterPassword.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            ChangeMasterPasswordScreen(
                vaultId = vaultId,
                onNavigateBack = { navController.popBackStack() },
                onPasswordChanged = {
                    // Retourner au dashboard (le vault sera verrouillé)
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Dashboard.route) {
                            inclusive = true
                        }
                    }
                }
            )
        }

        // ========== Password Health Analysis ==========
        composable(
            route = Screen.PasswordHealth.route,
            arguments = listOf(
                navArgument("vaultId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val vaultId = backStackEntry.arguments?.getString("vaultId") ?: return@composable

            com.julien.genpwdpro.presentation.analysis.PasswordHealthScreen(
                vaultId = vaultId,
                onBackClick = { navController.popBackStack() },
                onEntryClick = { entryId ->
                    navController.navigate(Screen.EditEntry.createRoute(vaultId, entryId))
                }
            )
        }

        // ========== Security Settings ==========
        composable(Screen.SecuritySettings.route) {
            com.julien.genpwdpro.presentation.screens.security.SecuritySettingsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPrivacy = {
                    navController.navigate(Screen.Privacy.route)
                }
            )
        }

        // ========== Privacy ==========
        composable(Screen.Privacy.route) {
            com.julien.genpwdpro.presentation.screens.privacy.PrivacyScreen(
                onNavigateBack = { navController.popBackStack() }
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
