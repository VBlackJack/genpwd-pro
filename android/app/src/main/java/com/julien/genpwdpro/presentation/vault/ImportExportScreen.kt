package com.julien.genpwdpro.presentation.vault

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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.presentation.utils.SecureWindow
import kotlinx.coroutines.flow.first
import javax.crypto.SecretKey

/**
 * Écran d'import/export de données de vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportExportScreen(
    vaultId: String,
    onBackClick: () -> Unit,
    viewModel: ImportExportViewModel = hiltViewModel(),
    vaultSessionManager: VaultSessionManager
) {
    val uiState by viewModel.uiState.collectAsState()
    val exportFormat by viewModel.exportFormat.collectAsState()
    val importFormat by viewModel.importFormat.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var showCsvWarning by remember { mutableStateOf(false) }
    var pendingExportUri by remember { mutableStateOf<Uri?>(null) }
    var vaultKey by remember { mutableStateOf<SecretKey?>(null) }

    SecureWindow()

    // Récupérer la clé du vault au chargement
    LaunchedEffect(vaultId) {
        vaultKey = vaultSessionManager.getCurrentSession()?.vaultKey
    }

    // Launcher pour créer un fichier d'export
    val exportFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("*/*")
    ) { uri ->
        uri?.let {
            val key = vaultKey
            if (key != null) {
                // Si CSV, montrer le warning avant d'exporter
                if (exportFormat == ExportFormat.CSV) {
                    pendingExportUri = it
                    showCsvWarning = true
                } else {
                    viewModel.exportVault(vaultId, key, it, exportFormat)
                }
            }
        }
    }

    // Launcher pour ouvrir un fichier d'import
    val importFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let {
            val key = vaultKey
            if (key != null) {
                viewModel.importVault(vaultId, key, it, importFormat)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Import / Export") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tabs Import / Export
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Export") },
                    icon = { Icon(Icons.Default.Upload, null) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Import") },
                    icon = { Icon(Icons.Default.Download, null) }
                )
            }

            // Contenu
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .weight(1f)
            ) {
                when (selectedTab) {
                    0 -> ExportTab(
                        exportFormat = exportFormat,
                        uiState = uiState,
                        onFormatChange = { viewModel.setExportFormat(it) },
                        onExportClick = {
                            val filename = "genpwd_export_${System.currentTimeMillis()}.${exportFormat.extension}"
                            exportFileLauncher.launch(filename)
                        },
                        onResetState = { viewModel.resetState() }
                    )
                    1 -> ImportTab(
                        importFormat = importFormat,
                        uiState = uiState,
                        onFormatChange = { viewModel.setImportFormat(it) },
                        onImportClick = {
                            importFileLauncher.launch(arrayOf("*/*"))
                        },
                        onResetState = { viewModel.resetState() }
                    )
                }
            }
        }
    }

    // Dialog d'avertissement CSV non chiffré
    if (showCsvWarning) {
        CsvWarningDialog(
            onConfirm = {
                pendingExportUri?.let { uri ->
                    val key = vaultKey
                    if (key != null) {
                        viewModel.exportVault(vaultId, key, uri, ExportFormat.CSV)
                    }
                }
                showCsvWarning = false
                pendingExportUri = null
            },
            onDismiss = {
                showCsvWarning = false
                pendingExportUri = null
            }
        )
    }
}

/**
 * Tab d'export
 */
@Composable
private fun ExportTab(
    exportFormat: ExportFormat,
    uiState: ImportExportUiState,
    onFormatChange: (ExportFormat) -> Unit,
    onExportClick: () -> Unit,
    onResetState: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Info card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "Exportez vos données pour créer une sauvegarde ou migrer vers un autre gestionnaire de mots de passe.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        // Sélection du format
        Text(
            text = "Format d'export",
            style = MaterialTheme.typography.titleMedium
        )

        ExportFormat.values().forEach { format ->
            Surface(
                onClick = { onFormatChange(format) },
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = if (format == exportFormat) {
                    MaterialTheme.colorScheme.secondaryContainer
                } else {
                    MaterialTheme.colorScheme.surfaceVariant
                }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = format == exportFormat,
                        onClick = { onFormatChange(format) }
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = format.displayName,
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            text = if (format.isEncrypted) "Données chiffrées ✓" else "⚠️ Données en clair",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (format.isEncrypted) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.error
                            }
                        )
                    }
                    if (format == exportFormat) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        // Warning pour CSV
        if (exportFormat == ExportFormat.CSV) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                    Column {
                        Text(
                            text = "Attention !",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = "Le format CSV contient vos mots de passe en clair. N'utilisez ce format que pour migrer vers un autre gestionnaire, et supprimez le fichier immédiatement après.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // État
        when (uiState) {
            is ImportExportUiState.Exporting -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
                Text(
                    text = "Export en cours...",
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            is ImportExportUiState.ExportSuccess -> {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Export réussi !",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "${uiState.entriesCount} entrée(s) exportée(s)",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onResetState) {
                            Text("Nouvel export")
                        }
                    }
                }
            }
            is ImportExportUiState.Error -> {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Erreur",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = uiState.message,
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onResetState) {
                            Text("Réessayer")
                        }
                    }
                }
            }
            else -> {
                Button(
                    onClick = onExportClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Upload, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Exporter le coffre")
                }
            }
        }
    }
}

/**
 * Tab d'import
 */
@Composable
private fun ImportTab(
    importFormat: ImportFormat,
    uiState: ImportExportUiState,
    onFormatChange: (ImportFormat) -> Unit,
    onImportClick: () -> Unit,
    onResetState: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Info card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "Importez des données depuis un fichier de sauvegarde ou un autre gestionnaire de mots de passe.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        // Sélection du format
        Text(
            text = "Format d'import",
            style = MaterialTheme.typography.titleMedium
        )

        ImportFormat.values().forEach { format ->
            Surface(
                onClick = { onFormatChange(format) },
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = if (format == importFormat) {
                    MaterialTheme.colorScheme.secondaryContainer
                } else {
                    MaterialTheme.colorScheme.surfaceVariant
                }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = format == importFormat,
                        onClick = { onFormatChange(format) }
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = format.displayName,
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            text = ".${format.extension}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if (format == importFormat) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        // Warning général
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.tertiaryContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onTertiaryContainer
                )
                Text(
                    text = "Les entrées importées seront ajoutées au coffre actuel. Les doublons ne seront pas détectés.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // État
        when (uiState) {
            is ImportExportUiState.Importing -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
                Text(
                    text = "Import en cours...",
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            is ImportExportUiState.ImportSuccess -> {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Import réussi !",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "${uiState.entriesCount} entrée(s) importée(s)",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onResetState) {
                            Text("Nouvel import")
                        }
                    }
                }
            }
            is ImportExportUiState.Error -> {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Erreur",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = uiState.message,
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onResetState) {
                            Text("Réessayer")
                        }
                    }
                }
            }
            else -> {
                Button(
                    onClick = onImportClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Download, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Sélectionner un fichier")
                }
            }
        }
    }
}

/**
 * Dialog d'avertissement pour l'export CSV
 */
@Composable
private fun CsvWarningDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Warning, null, tint = MaterialTheme.colorScheme.error) },
        title = { Text("⚠️ Données non chiffrées") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Le fichier CSV contiendra tous vos mots de passe en clair.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "Assurez-vous de :",
                    style = MaterialTheme.typography.titleSmall
                )
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("• Stocker le fichier en lieu sûr", style = MaterialTheme.typography.bodySmall)
                    Text("• Le supprimer après utilisation", style = MaterialTheme.typography.bodySmall)
                    Text("• Ne jamais l'envoyer par email", style = MaterialTheme.typography.bodySmall)
                    Text("• Ne pas le synchroniser dans le cloud", style = MaterialTheme.typography.bodySmall)
                }
                Text(
                    "Continuez uniquement si vous comprenez les risques.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("J'ai compris, exporter")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
