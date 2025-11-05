package com.julien.genpwdpro.presentation.screens.security

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import com.julien.genpwdpro.security.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * Écran de configuration de la sécurité
 *
 * Fonctionnalités:
 * - Authentification biométrique
 * - Verrouillage automatique de l'application
 * - Informations sur le Keystore matériel
 * - Gestion des clés de chiffrement
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecuritySettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPrivacy: () -> Unit = {},
    viewModel: SecuritySettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val unlockErrorMessage = stringResource(R.string.sensitive_actions_unlock_error)

    var showTimeoutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.checkBiometricAvailability(context)
    }

    SecuritySettingsLayout(
        uiState = uiState,
        onNavigateBack = onNavigateBack,
        onNavigateToPrivacy = onNavigateToPrivacy,
        snackbarHostState = snackbarHostState,
        unlockErrorMessage = unlockErrorMessage,
        showTimeoutDialog = showTimeoutDialog,
        onShowTimeoutDialogChange = { showTimeoutDialog = it },
        viewModel = viewModel,
        context = context,
        scope = scope
    )
}

@Composable
private fun SecuritySettingsLayout(
    uiState: SecuritySettingsUiState,
    onNavigateBack: () -> Unit,
    onNavigateToPrivacy: () -> Unit,
    snackbarHostState: SnackbarHostState,
    unlockErrorMessage: String,
    showTimeoutDialog: Boolean,
    onShowTimeoutDialogChange: (Boolean) -> Unit,
    viewModel: SecuritySettingsViewModel,
    context: Context,
    scope: CoroutineScope
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sécurité") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            BiometricStatusCard(
                availability = uiState.biometricAvailability,
                isEnabled = uiState.isBiometricEnabled
            )

            if (uiState.biometricAvailability == BiometricAvailability.AVAILABLE) {
                // Section: Verrouillage automatique
                AppLockCard(
                    isEnabled = uiState.isAppLockEnabled,
                    timeout = uiState.lockTimeout,
                    onToggle = {
                        if (it && context is FragmentActivity) {
                            viewModel.toggleAppLock(context, it)
                        } else {
                            viewModel.toggleAppLock(context, false)
                        }
                    },
                    onTimeoutClick = { onShowTimeoutDialogChange(true) },
                    getTimeoutName = { viewModel.getTimeoutDisplayName(it) }
                )

                // Section: Biométrie au démarrage
                BiometricOnStartCard(
                    isEnabled = uiState.requireBiometricOnAppStart,
                    onToggle = { enabled ->
                        val success = viewModel.setBiometricOnAppStart(enabled)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    }
                )

                // Section: Actions sensibles (copie, vue, suppression)
                SensitiveActionsCard(
                    isEnabled = uiState.requireBiometricForSensitiveActions,
                    clipboardTtlMs = uiState.clipboardTtlMs,
                    onToggle = { enabled ->
                        val success = viewModel.setSensitiveActionBiometricRequirement(enabled)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    },
                    onClipboardTtlChange = { ttl ->
                        val success = viewModel.setClipboardTtlMs(ttl)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    }
                )

                // Section: Import/Export
                ImportExportBiometricCard(
                    requireBiometricForExport = uiState.requireBiometricForExport,
                    requireBiometricForImport = uiState.requireBiometricForImport,
                    onExportToggle = { enabled ->
                        val success = viewModel.setBiometricForExport(enabled)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    },
                    onImportToggle = { enabled ->
                        val success = viewModel.setBiometricForImport(enabled)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    }
                )

                // Section: Autofill
                AutofillBiometricCard(
                    requireBiometricForAutofill = uiState.requireBiometricForAutofill,
                    onToggle = { enabled ->
                        val success = viewModel.setBiometricForAutofill(enabled)
                        if (!success) {
                            scope.launch {
                                snackbarHostState.showSnackbar(unlockErrorMessage)
                            }
                        }
                    }
                )
            }

            KeystoreInfoCard(
                isHardwareBacked = uiState.isHardwareBackedKeystore,
                keyCount = uiState.keystoreKeyCount
            )

            SecurityActionsCard(
                onDeleteKeys = {
                    viewModel.deleteAllKeys()
                    scope.launch {
                        snackbarHostState.showSnackbar("Toutes les clés ont été supprimées")
                    }
                }
            )

            SecurityTipsCard()

            PrivacySummaryCard(onNavigateToPrivacy)
        }

        if (showTimeoutDialog) {
            TimeoutSelectionDialog(
                currentTimeout = uiState.lockTimeout,
                timeouts = viewModel.getAllTimeouts(),
                onDismiss = { onShowTimeoutDialogChange(false) },
                onSelect = { timeout ->
                    viewModel.setLockTimeout(timeout)
                    onShowTimeoutDialogChange(false)
                }
            )
        }
    }
}

/**
 * Carte de statut biométrique
 */
@Composable
private fun BiometricStatusCard(
    availability: BiometricAvailability,
    isEnabled: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (availability) {
                BiometricAvailability.AVAILABLE -> MaterialTheme.colorScheme.primaryContainer
                BiometricAvailability.NONE_ENROLLED -> MaterialTheme.colorScheme.tertiaryContainer
                else -> MaterialTheme.colorScheme.errorContainer
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = when (availability) {
                        BiometricAvailability.AVAILABLE -> Icons.Default.Fingerprint
                        else -> Icons.Default.Warning
                    },
                    contentDescription = null
                )
                Text(
                    text = "Authentification biométrique",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = when (availability) {
                    BiometricAvailability.AVAILABLE -> "✅ Disponible et prête"
                    BiometricAvailability.NO_HARDWARE -> "❌ Pas de capteur biométrique"
                    BiometricAvailability.HARDWARE_UNAVAILABLE -> "⚠️ Capteur temporairement indisponible"
                    BiometricAvailability.NONE_ENROLLED -> "⚠️ Aucune biométrie enregistrée"
                    BiometricAvailability.SECURITY_UPDATE_REQUIRED -> "⚠️ Mise à jour de sécurité requise"
                    BiometricAvailability.UNSUPPORTED -> "❌ Non supporté"
                    BiometricAvailability.UNKNOWN -> "❓ État inconnu"
                },
                style = MaterialTheme.typography.bodyMedium
            )

            if (availability == BiometricAvailability.NONE_ENROLLED) {
                Text(
                    text = "Configurez une empreinte digitale ou reconnaissance faciale dans les paramètres de votre appareil",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
        }
    }
}

/**
 * Carte de verrouillage de l'application
 */
@Composable
private fun AppLockCard(
    isEnabled: Boolean,
    timeout: Long,
    onToggle: (Boolean) -> Unit,
    onTimeoutClick: () -> Unit,
    getTimeoutName: (Long) -> String
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Verrouillage automatique",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (isEnabled) "L'app se verrouille après inactivité" else "Désactivé",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = isEnabled,
                    onCheckedChange = onToggle
                )
            }

            if (isEnabled) {
                Divider()

                // Sélection du délai
                OutlinedButton(
                    onClick = onTimeoutClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Timer, null, Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Délai: ${getTimeoutName(timeout)}")
                }

                Text(
                    text = "L'app demandera l'authentification biométrique après ce délai d'inactivité",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SensitiveActionsCard(
    isEnabled: Boolean,
    clipboardTtlMs: Long,
    onToggle: (Boolean) -> Unit,
    onClipboardTtlChange: (Long) -> Unit
) {
    val title = stringResource(R.string.sensitive_actions_title)
    val subtitle = stringResource(R.string.sensitive_actions_subtitle)
    val enabledLabel = stringResource(R.string.sensitive_actions_state_on)
    val disabledLabel = stringResource(R.string.sensitive_actions_state_off)
    val ttlOptions = listOf(5_000L, 10_000L, 30_000L, 60_000L)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.VerifiedUser,
                    contentDescription = null
                )
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isEnabled) enabledLabel else disabledLabel,
                    style = MaterialTheme.typography.bodyMedium
                )
                Switch(
                    checked = isEnabled,
                    onCheckedChange = onToggle
                )
            }

            Text(
                text = stringResource(R.string.sensitive_actions_clipboard_ttl_title),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = stringResource(R.string.sensitive_actions_clipboard_ttl_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ttlOptions.forEach { option ->
                    FilterChip(
                        selected = clipboardTtlMs == option,
                        onClick = { onClipboardTtlChange(option) },
                        label = {
                            Text("${option / 1000}s")
                        }
                    )
                }
            }
        }
    }
}

/**
 * Carte de biométrie au démarrage de l'application
 */
@Composable
private fun BiometricOnStartCard(
    isEnabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.LockOpen,
                    contentDescription = null
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Biométrie au démarrage",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Requiert l'authentification biométrique à chaque démarrage de l'application",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }
                Switch(
                    checked = isEnabled,
                    onCheckedChange = onToggle
                )
            }

            if (isEnabled) {
                Text(
                    text = "ℹ️ Cette option offre une protection maximale en demandant systématiquement une authentification biométrique, même si l'app n'a pas été inactive.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
        }
    }
}

/**
 * Carte de protection biométrique pour Import/Export
 */
@Composable
private fun ImportExportBiometricCard(
    requireBiometricForExport: Boolean,
    requireBiometricForImport: Boolean,
    onExportToggle: (Boolean) -> Unit,
    onImportToggle: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ImportExport,
                    contentDescription = null
                )
                Text(
                    text = "Protection Import/Export",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            // Export
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Biométrie pour export",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Protège l'export de vos données (CSV, JSON, KDBX)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
                Switch(
                    checked = requireBiometricForExport,
                    onCheckedChange = onExportToggle
                )
            }

            Divider()

            // Import
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Biométrie pour import",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Requiert l'authentification avant d'importer",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
                Switch(
                    checked = requireBiometricForImport,
                    onCheckedChange = onImportToggle
                )
            }

            Text(
                text = "💡 L'export est activé par défaut pour sécurité maximale. L'export expose vos données et nécessite une protection renforcée.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

/**
 * Carte de protection biométrique pour Autofill
 */
@Composable
private fun AutofillBiometricCard(
    requireBiometricForAutofill: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Biométrie pour auto-remplissage",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Requiert l'authentification biométrique avant d'utiliser l'auto-remplissage",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                Switch(
                    checked = requireBiometricForAutofill,
                    onCheckedChange = onToggle
                )
            }

            if (requireBiometricForAutofill) {
                Text(
                    text = "🔐 Chaque utilisation de l'auto-remplissage demandera votre empreinte digitale ou reconnaissance faciale.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

/**
 * Carte d'informations Keystore
 */
@Composable
private fun KeystoreInfoCard(
    isHardwareBacked: Boolean,
    keyCount: Int
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Key, null)
                Text(
                    text = "Android Keystore",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Stockage matériel sécurisé:", style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = if (isHardwareBacked) "✅ Oui (TEE/SE)" else "⚠️ Software",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Clés stockées:", style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = "$keyCount",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = if (isHardwareBacked) {
                    "Vos clés sont stockées dans un environnement d'exécution de confiance (TEE) ou un élément sécurisé (SE). Elles ne peuvent pas être extraites."
                } else {
                    "Vos clés sont stockées de manière sécurisée mais sans protection matérielle."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Carte des actions de sécurité
 */
@Composable
private fun SecurityActionsCard(
    onDeleteKeys: () -> Unit
) {
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Actions de sécurité",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            OutlinedButton(
                onClick = { showDeleteConfirmation = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.DeleteForever, null, Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Supprimer toutes les clés")
            }

            Text(
                text = "⚠️ Cette action supprimera toutes les clés de chiffrement. Les données chiffrées ne pourront plus être déchiffrées.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }

    // Dialogue de confirmation
    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Confirmer la suppression") },
            text = {
                Text(
                    "Êtes-vous sûr de vouloir supprimer toutes les clés de chiffrement ? Cette action est irréversible."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDeleteKeys()
                        showDeleteConfirmation = false
                    }
                ) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text("Annuler")
                }
            }
        )
    }
}

/**
 * Carte des conseils de sécurité
 */
@Composable
private fun SecurityTipsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Lightbulb, null)
                Text(
                    text = "Bonnes pratiques",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            val tips = listOf(
                "🔐 Activez le verrouillage automatique pour protéger vos mots de passe",
                "👆 Configurez une empreinte digitale pour plus de sécurité",
                "⏱️ Choisissez un délai de verrouillage court (1-5 minutes)",
                "🔑 Le Keystore matériel protège vos clés contre l'extraction",
                "📱 Verrouillez votre téléphone avec un code PIN fort",
                "🔄 Mettez à jour régulièrement votre système Android"
            )

            tips.forEach { tip ->
                Text(
                    text = tip,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
private fun PrivacySummaryCard(onNavigateToPrivacy: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.PrivacyTip, contentDescription = null)
                Text(
                    text = stringResource(R.string.privacy_summary_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(
                text = stringResource(R.string.privacy_summary_body),
                style = MaterialTheme.typography.bodyMedium
            )
            Button(
                onClick = onNavigateToPrivacy
            ) {
                Text(stringResource(R.string.privacy_summary_cta))
            }
        }
    }
}

/**
 * Dialogue de sélection du délai
 */
@Composable
private fun TimeoutSelectionDialog(
    currentTimeout: Long,
    timeouts: List<LockTimeout>,
    onDismiss: () -> Unit,
    onSelect: (Long) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Délai de verrouillage") },
        text = {
            Column {
                timeouts.forEach { timeout ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = timeout.milliseconds == currentTimeout,
                            onClick = { onSelect(timeout.milliseconds) }
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(timeout.displayName)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fermer")
            }
        }
    )
}

/**
 * ViewModel pour la sécurité
 */
@HiltViewModel
class SecuritySettingsViewModel @Inject constructor(
    private val biometricManager: BiometricManager,
    private val keystoreManager: KeystoreManager,
    private val appLockManager: AppLockManager,
    private val sensitiveActionPreferences: SensitiveActionPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(SecuritySettingsUiState())
    val uiState: StateFlow<SecuritySettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // Observer l'état du verrouillage
            appLockManager.isAppLockEnabled.collect { enabled ->
                _uiState.update { it.copy(isAppLockEnabled = enabled) }
            }
        }

        viewModelScope.launch {
            // Observer le délai de verrouillage
            appLockManager.lockTimeout.collect { timeout ->
                _uiState.update { it.copy(lockTimeout = timeout) }
            }
        }

        viewModelScope.launch {
            // Vérifier le Keystore matériel
            val isHardware = keystoreManager.isHardwareBackedKeystore()
            val keyCount = keystoreManager.listKeys().size

            _uiState.update {
                it.copy(
                    isHardwareBackedKeystore = isHardware,
                    keystoreKeyCount = keyCount
                )
            }
        }

        viewModelScope.launch {
            sensitiveActionPreferences.requireBiometricForSensitiveActions.collect { required ->
                _uiState.update { it.copy(requireBiometricForSensitiveActions = required) }
            }
        }

        viewModelScope.launch {
            sensitiveActionPreferences.clipboardTtlMs.collect { ttl ->
                _uiState.update { it.copy(clipboardTtlMs = ttl) }
            }
        }

        // Observer les nouvelles préférences biométriques
        viewModelScope.launch {
            sensitiveActionPreferences.requireBiometricForAutofill.collect { required ->
                _uiState.update { it.copy(requireBiometricForAutofill = required) }
            }
        }

        viewModelScope.launch {
            sensitiveActionPreferences.requireBiometricForExport.collect { required ->
                _uiState.update { it.copy(requireBiometricForExport = required) }
            }
        }

        viewModelScope.launch {
            sensitiveActionPreferences.requireBiometricForImport.collect { required ->
                _uiState.update { it.copy(requireBiometricForImport = required) }
            }
        }

        viewModelScope.launch {
            sensitiveActionPreferences.requireBiometricOnAppStart.collect { required ->
                _uiState.update { it.copy(requireBiometricOnAppStart = required) }
            }
        }
    }

    fun checkBiometricAvailability(context: Context) {
        val availability = biometricManager.isBiometricAvailable(context)
        _uiState.update {
            it.copy(
                biometricAvailability = availability,
                isBiometricEnabled = availability == BiometricAvailability.AVAILABLE
            )
        }
    }

    fun toggleAppLock(context: Context, enabled: Boolean) {
        if (enabled && context is FragmentActivity) {
            // Demander l'authentification biométrique pour activer
            biometricManager.authenticate(
                activity = context,
                title = "Activer le verrouillage",
                subtitle = "Authentifiez-vous pour activer le verrouillage de l'application",
                onSuccess = {
                    viewModelScope.launch {
                        appLockManager.setAppLockEnabled(true)
                    }
                },
                onError = { _, _ ->
                    // Échec de l'authentification
                }
            )
        } else {
            viewModelScope.launch {
                appLockManager.setAppLockEnabled(false)
            }
        }
    }

    fun setSensitiveActionBiometricRequirement(enabled: Boolean): Boolean {
        val success = sensitiveActionPreferences.setRequireBiometricForSensitiveActions(enabled)
        if (!success) {
            return false
        }
        _uiState.update { it.copy(requireBiometricForSensitiveActions = enabled) }
        return true
    }

    fun setLockTimeout(timeoutMs: Long) {
        viewModelScope.launch {
            appLockManager.setLockTimeout(timeoutMs)
        }
    }

    fun setClipboardTtlMs(ttlMs: Long): Boolean {
        val success = sensitiveActionPreferences.setClipboardTtlMs(ttlMs)
        if (success) {
            _uiState.update { it.copy(clipboardTtlMs = ttlMs) }
        }
        return success
    }

    fun setBiometricForAutofill(enabled: Boolean): Boolean {
        val success = sensitiveActionPreferences.setRequireBiometricForAutofill(enabled)
        if (success) {
            _uiState.update { it.copy(requireBiometricForAutofill = enabled) }
        }
        return success
    }

    fun setBiometricForExport(enabled: Boolean): Boolean {
        val success = sensitiveActionPreferences.setRequireBiometricForExport(enabled)
        if (success) {
            _uiState.update { it.copy(requireBiometricForExport = enabled) }
        }
        return success
    }

    fun setBiometricForImport(enabled: Boolean): Boolean {
        val success = sensitiveActionPreferences.setRequireBiometricForImport(enabled)
        if (success) {
            _uiState.update { it.copy(requireBiometricForImport = enabled) }
        }
        return success
    }

    fun setBiometricOnAppStart(enabled: Boolean): Boolean {
        val success = sensitiveActionPreferences.setRequireBiometricOnAppStart(enabled)
        if (success) {
            _uiState.update { it.copy(requireBiometricOnAppStart = enabled) }
        }
        return success
    }

    fun deleteAllKeys() {
        keystoreManager.deleteAllKeys()
        _uiState.update { it.copy(keystoreKeyCount = 0) }
    }

    fun getTimeoutDisplayName(timeoutMs: Long): String {
        return appLockManager.getTimeoutDisplayName(timeoutMs)
    }

    fun getAllTimeouts(): List<LockTimeout> {
        return appLockManager.getAllTimeouts()
    }
}

/**
 * État de l'UI
 */
data class SecuritySettingsUiState(
    val biometricAvailability: BiometricAvailability = BiometricAvailability.UNKNOWN,
    val isBiometricEnabled: Boolean = false,
    val isAppLockEnabled: Boolean = false,
    val lockTimeout: Long = AppLockManager.TIMEOUT_1_MINUTE,
    val isHardwareBackedKeystore: Boolean = false,
    val keystoreKeyCount: Int = 0,
    val requireBiometricForSensitiveActions: Boolean = false,
    val clipboardTtlMs: Long = SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS,
    // Nouvelles options biométriques
    val requireBiometricForAutofill: Boolean = false,
    val requireBiometricForExport: Boolean = true,
    val requireBiometricForImport: Boolean = false,
    val requireBiometricOnAppStart: Boolean = false
)
