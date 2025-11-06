package com.julien.genpwdpro.presentation.screens.importexport

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Écran Import/Export pour la gestion des données
 *
 * Fonctionnalités:
 * - Export CSV (non chiffré, avec avertissement)
 * - Import CSV
 * - Export JSON chiffré (backup sécurisé)
 * - Import/Restore JSON chiffré
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportExportScreen(
    onNavigateBack: () -> Unit,
    vaultId: String?,
    viewModel: ImportExportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Dialogues
    var showCsvExportWarning by remember { mutableStateOf(false) }
    var showJsonExportDialog by remember { mutableStateOf(false) }
    var showJsonImportDialog by remember { mutableStateOf(false) }
    var showKdbxImportDialog by remember { mutableStateOf(false) }

    // Launchers pour sélection de fichiers
    val csvExportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        uri?.let {
            if (vaultId != null) {
                viewModel.exportToCsv(vaultId, it)
            }
        }
    }

    val csvImportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            if (vaultId != null) {
                viewModel.importFromCsv(vaultId, it)
            }
        }
    }

    val jsonExportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        uri?.let {
            showJsonExportDialog = true
        }
    }

    val jsonImportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            showJsonImportDialog = true
        }
    }

    var kdbxImportUri by remember { mutableStateOf<Uri?>(null) }
    val kdbxImportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            kdbxImportUri = it
            showKdbxImportDialog = true
        }
    }

    // Afficher les messages de succès/erreur
    LaunchedEffect(uiState.exportSuccessMessage) {
        uiState.exportSuccessMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    LaunchedEffect(uiState.importSuccessMessage) {
        uiState.importSuccessMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    LaunchedEffect(uiState.exportError) {
        uiState.exportError?.let {
            snackbarHostState.showSnackbar("❌ $it", duration = SnackbarDuration.Long)
            viewModel.clearMessages()
        }
    }

    LaunchedEffect(uiState.importError) {
        uiState.importError?.let {
            snackbarHostState.showSnackbar("❌ $it", duration = SnackbarDuration.Long)
            viewModel.clearMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Import / Export") },
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
            // Vérifier si un vault est déverrouillé
            if (vaultId == null) {
                NoVaultUnlockedCard()
            } else {
                // Section CSV
                CsvSectionCard(
                    onExport = { showCsvExportWarning = true },
                    onImport = { csvImportLauncher.launch("text/csv") },
                    isLoading = uiState.isExporting || uiState.isImporting
                )

                // Section JSON chiffré (Backup)
                JsonBackupSectionCard(
                    onExport = { jsonExportLauncher.launch("genpwd_backup_${System.currentTimeMillis()}.json") },
                    onImport = { jsonImportLauncher.launch("application/json") },
                    isLoading = uiState.isExporting || uiState.isImporting
                )

                // Section KeePass KDBX (Import only)
                KdbxImportSectionCard(
                    onImport = { kdbxImportLauncher.launch("application/octet-stream") },
                    isLoading = uiState.isImporting
                )

                // Informations et bonnes pratiques
                ImportExportInfoCard()
            }
        }

        // Dialogue d'avertissement CSV Export
        if (showCsvExportWarning) {
            CsvExportWarningDialog(
                onDismiss = { showCsvExportWarning = false },
                onConfirm = {
                    showCsvExportWarning = false
                    csvExportLauncher.launch("genpwd_export_${System.currentTimeMillis()}.csv")
                }
            )
        }

        // Dialogue JSON Export (demande master password)
        if (showJsonExportDialog) {
            JsonExportDialog(
                vaultId = vaultId ?: "",
                onDismiss = { showJsonExportDialog = false },
                onConfirm = { masterPassword, uri ->
                    viewModel.exportToEncryptedJson(vaultId ?: "", masterPassword, uri)
                    showJsonExportDialog = false
                }
            )
        }

        // Dialogue JSON Import (demande master password)
        if (showJsonImportDialog) {
            JsonImportDialog(
                onDismiss = { showJsonImportDialog = false },
                onConfirm = { masterPassword, uri, newName ->
                    viewModel.importFromEncryptedJson(masterPassword, uri, newName)
                    showJsonImportDialog = false
                }
            )
        }

        // Dialogue KDBX Import (demande master password KeePass)
        if (showKdbxImportDialog && kdbxImportUri != null) {
            KdbxImportDialog(
                uri = kdbxImportUri!!,
                onDismiss = {
                    showKdbxImportDialog = false
                    kdbxImportUri = null
                },
                onConfirm = { masterPassword, uri, newName ->
                    viewModel.importFromKdbx(masterPassword, uri, newName)
                    showKdbxImportDialog = false
                    kdbxImportUri = null
                }
            )
        }
    }
}

/**
 * Carte d'absence de vault déverrouillé
 */
@Composable
private fun NoVaultUnlockedCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
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
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
                Text(
                    "Aucun vault déverrouillé",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
            Text(
                "Vous devez déverrouiller un vault avant de pouvoir importer ou exporter des données.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
        }
    }
}

/**
 * Section CSV Import/Export
 */
@Composable
private fun CsvSectionCard(
    onExport: () -> Unit,
    onImport: () -> Unit,
    isLoading: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "📄 Export / Import CSV",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Format compatible avec d'autres gestionnaires de mots de passe.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onExport,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading
                ) {
                    Icon(Icons.Default.FileUpload, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Exporter CSV")
                }

                Button(
                    onClick = onImport,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading
                ) {
                    Icon(Icons.Default.FileDownload, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Importer CSV")
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.1f),
                shape = MaterialTheme.shapes.small
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        "⚠️ Les fichiers CSV contiennent vos données en clair (non chiffrées)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

/**
 * Section JSON Backup chiffré
 */
@Composable
private fun JsonBackupSectionCard(
    onExport: () -> Unit,
    onImport: () -> Unit,
    isLoading: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "🔐 Backup Chiffré (JSON)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Sauvegarde complète et sécurisée de votre vault avec chiffrement AES-256-GCM.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onExport,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(Icons.Default.Save, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Créer Backup")
                }

                Button(
                    onClick = onImport,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(Icons.Default.RestoreFromTrash, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Restaurer")
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                shape = MaterialTheme.shapes.small
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Security,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        "✅ Recommandé : Chiffrement Argon2id + AES-256-GCM",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

/**
 * Carte d'informations et bonnes pratiques
 */
@Composable
private fun ImportExportInfoCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                "💡 Bonnes Pratiques",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            InfoItem("Effectuez des backups réguliers (hebdomadaires recommandé)")
            InfoItem("Stockez les backups dans un endroit sûr (cloud chiffré, clé USB)")
            InfoItem("Ne partagez jamais vos exports CSV (données en clair)")
            InfoItem("Testez vos backups en restaurant sur un autre appareil")
            InfoItem("Utilisez un mot de passe fort pour les backups JSON")
        }
    }
}

@Composable
private fun InfoItem(text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            "•",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Dialogue d'avertissement pour export CSV
 */
@Composable
private fun CsvExportWarningDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Warning, contentDescription = null) },
        title = { Text("⚠️ Attention : Données non chiffrées") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Le fichier CSV contiendra vos mots de passe en clair (non chiffrés).")
                Text("Utilisez cette option uniquement pour migrer vers un autre gestionnaire de mots de passe.")
                Text("Pour un backup sécurisé, utilisez l'export JSON chiffré.", fontWeight = FontWeight.Bold)
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("J'ai compris, continuer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

/**
 * Section KeePass KDBX Import
 */
@Composable
private fun KdbxImportSectionCard(
    onImport: () -> Unit,
    isLoading: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Default.Key,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onTertiaryContainer
                )
                Text(
                    "🔑 Import KeePass (KDBX)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                "Importez vos mots de passe depuis KeePass 2.x (formats KDBX 3.x et 4.x).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.8f)
            )

            Button(
                onClick = onImport,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.tertiary
                )
            ) {
                Icon(Icons.Default.FileDownload, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Importer depuis KDBX")
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.tertiary.copy(alpha = 0.1f),
                shape = MaterialTheme.shapes.small
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            "✅ Support KDBX 3.x et 4.x (Argon2, AES-256, ChaCha20)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            "✅ Import de tous les groupes et entrées",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            "✅ Création automatique d'un nouveau vault",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                }
            }
        }
    }
}

/**
 * Dialogue pour import KDBX (demande master password KeePass)
 */
@Composable
private fun KdbxImportDialog(
    uri: Uri,
    onDismiss: () -> Unit,
    onConfirm: (String, Uri, String?) -> Unit
) {
    var masterPassword by remember { mutableStateOf("") }
    var newVaultName by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Key, contentDescription = null) },
        title = { Text("Importer depuis KeePass") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Entrez le master password de votre fichier KeePass :",
                    style = MaterialTheme.typography.bodyMedium
                )

                OutlinedTextField(
                    value = masterPassword,
                    onValueChange = { masterPassword = it },
                    label = { Text("Master Password KeePass") },
                    visualTransformation = if (showPassword) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (showPassword) "Masquer" else "Afficher"
                            )
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = newVaultName,
                    onValueChange = { newVaultName = it },
                    label = { Text("Nom du nouveau vault") },
                    placeholder = { Text("KeePass Import") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            "ℹ️ Information",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Un nouveau vault sera créé avec toutes vos entrées KeePass.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Le fichier KDBX original ne sera pas modifié.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onConfirm(
                        masterPassword,
                        uri,
                        newVaultName.takeIf { it.isNotEmpty() }
                    )
                },
                enabled = masterPassword.isNotEmpty()
            ) {
                Text("Importer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
