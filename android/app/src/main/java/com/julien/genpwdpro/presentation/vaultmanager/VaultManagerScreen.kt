package com.julien.genpwdpro.presentation.vaultmanager

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.local.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import java.text.SimpleDateFormat
import java.util.*

/**
 * Écran de gestion des vaults
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultManagerScreen(
    viewModel: VaultManagerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToVault: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val vaults by viewModel.vaults.collectAsState()
    val defaultVault by viewModel.defaultVault.collectAsState()
    val loadedVaults by viewModel.loadedVaults.collectAsState()

    // Dialogs
    if (uiState.showCreateDialog) {
        CreateVaultDialog(
            viewModel = viewModel,
            uiState = uiState,
            onDismiss = { viewModel.hideCreateDialog() },
            onCreate = { name, password, strategy, description, setAsDefault, enableBiometric ->
                viewModel.createVault(name, password, strategy, description, setAsDefault, enableBiometric)
            }
        )
    }

    if (uiState.showMigrationDialog) {
        MigrationDialog(
            isActive = uiState.isMigrating,
            progress = uiState.migrationProgress,
            onDismiss = { viewModel.hideMigrationDialog() },
            onConfirm = { passwords ->
                viewModel.startMigration(passwords)
            }
        )
    }

    uiState.confirmDeleteVaultId?.let { vaultId ->
        val vault = vaults.find { it.id == vaultId }
        if (vault != null) {
            ConfirmDeleteDialog(
                vaultName = vault.name,
                onConfirm = {
                    viewModel.deleteVault(vaultId)
                },
                onDismiss = { viewModel.hideDeleteConfirmation() }
            )
        }
    }

    // Snackbar pour les messages
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(
                message = it,
                duration = SnackbarDuration.Long
            )
            viewModel.clearError()
        }
    }

    LaunchedEffect(uiState.successMessage) {
        uiState.successMessage?.let {
            snackbarHostState.showSnackbar(
                message = it,
                duration = SnackbarDuration.Short
            )
            viewModel.clearSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vault Manager") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.showCreateDialog() }
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Vault")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (vaults.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "No vaults yet",
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        text = "Create your first vault to get started",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(onClick = { viewModel.showCreateDialog() }) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Create Vault")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(vaults) { vault ->
                    VaultCard(
                        vault = vault,
                        isDefault = vault.id == defaultVault?.id,
                        isLoaded = loadedVaults.any { it.id == vault.id },
                        onSetDefault = { viewModel.setAsDefault(vault.id) },
                        onLoad = {
                            viewModel.loadVault(vault.id)
                            onNavigateToVault(vault.id)
                        },
                        onUnload = { viewModel.unloadVault(vault.id) },
                        onDelete = { viewModel.showDeleteConfirmation(vault.id) },
                        onOpen = { onNavigateToVault(vault.id) }
                    )
                }
            }
        }
    }
}

/**
 * Carte pour afficher un vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultCard(
    vault: VaultRegistryEntry,
    isDefault: Boolean,
    isLoaded: Boolean,
    onSetDefault: () -> Unit,
    onLoad: () -> Unit,
    onUnload: () -> Unit,
    onDelete: () -> Unit,
    onOpen: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = if (isDefault) {
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        } else {
            CardDefaults.cardColors()
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = vault.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (isDefault) {
                            AssistChip(
                                onClick = { },
                                label = { Text("Default", style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                modifier = Modifier.height(24.dp)
                            )
                        }
                        if (isLoaded) {
                            AssistChip(
                                onClick = { },
                                label = { Text("Loaded", style = MaterialTheme.typography.labelSmall) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = MaterialTheme.colorScheme.tertiaryContainer
                                ),
                                modifier = Modifier.height(24.dp)
                            )
                        }
                    }

                    vault.description?.let { desc ->
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(onClick = { expanded = !expanded }) {
                    Icon(
                        if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (expanded) "Collapse" else "Expand"
                    )
                }
            }

            // Info basique
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                InfoChip(
                    icon = Icons.Default.Storage,
                    label = vault.storageStrategy.name.lowercase().replaceFirstChar { it.uppercase() }
                )
                InfoChip(
                    icon = Icons.Default.Description,
                    label = "${vault.statistics.entryCount} entries"
                )
                InfoChip(
                    icon = Icons.Default.Folder,
                    label = formatFileSize(vault.fileSize)
                )
            }

            // Info détaillée (expandable)
            if (expanded) {
                Spacer(Modifier.height(12.dp))
                Divider()
                Spacer(Modifier.height(12.dp))

                DetailRow("Created", formatDate(vault.createdAt))
                DetailRow("Modified", formatDate(vault.lastModified))
                vault.lastAccessed?.let {
                    DetailRow("Last Accessed", formatDate(it))
                }
                DetailRow("Path", vault.filePath)

                // Actions
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Bouton principal : Ouvrir le vault
                    Button(
                        onClick = onOpen,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.LockOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Open", style = MaterialTheme.typography.labelMedium)
                    }

                    if (!isDefault) {
                        OutlinedButton(
                            onClick = onSetDefault,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Default", style = MaterialTheme.typography.labelMedium)
                        }
                    }

                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Delete", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}

@Composable
fun InfoChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Dialog de création de vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateVaultDialog(
    viewModel: VaultManagerViewModel,
    uiState: VaultManagerUiState,
    onDismiss: () -> Unit,
    onCreate: (String, String, StorageStrategy, String?, Boolean, Boolean) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedStrategy by remember { mutableStateOf(StorageStrategy.APP_STORAGE) }
    var setAsDefault by remember { mutableStateOf(false) }
    var enableBiometric by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }

    // Vérifier la disponibilité de la biométrie
    val context = LocalContext.current
    val isBiometricAvailable = remember {
        try {
            val biometricManager = androidx.biometric.BiometricManager.from(context)
            // Essayer d'abord BIOMETRIC_STRONG, puis fallback sur BIOMETRIC_WEAK | DEVICE_CREDENTIAL
            val strongResult = biometricManager.canAuthenticate(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            val weakResult = biometricManager.canAuthenticate(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK or
                androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )

            android.util.Log.d("CreateVaultDialog", "Biometric STRONG: $strongResult")
            android.util.Log.d("CreateVaultDialog", "Biometric WEAK|CREDENTIAL: $weakResult")

            strongResult == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS ||
            weakResult == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
        } catch (e: Exception) {
            android.util.Log.e("CreateVaultDialog", "Error checking biometric availability", e)
            false
        }
    }

    // Folder picker launcher for CUSTOM strategy
    val folderPickerLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocumentTree()
    ) { uri: android.net.Uri? ->
        viewModel.setCustomFolderUri(uri)
    }

    val isValid = name.isNotBlank() &&
            password.isNotBlank() &&
            password == confirmPassword &&
            password.length >= 8 &&
            (selectedStrategy != StorageStrategy.CUSTOM || uiState.customFolderUri != null)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create New Vault") },
        text = {
            Column(
                modifier = Modifier
                    .heightIn(max = 500.dp) // Limite la hauteur maximale
                    .verticalScroll(rememberScrollState()), // Rend le contenu scrollable
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Vault Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Storage Strategy Selector
                Text(
                    text = "Storage Location",
                    style = MaterialTheme.typography.labelMedium
                )
                StorageStrategy.values().forEach { strategy ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedStrategy == strategy,
                            onClick = { selectedStrategy = strategy }
                        )
                        Column(modifier = Modifier.padding(start = 8.dp)) {
                            Text(
                                text = strategy.name.lowercase().replaceFirstChar { it.uppercase() },
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = when (strategy) {
                                    StorageStrategy.INTERNAL -> "App private storage (deleted on uninstall)"
                                    StorageStrategy.APP_STORAGE -> "External app storage (survives uninstall)"
                                    StorageStrategy.PUBLIC_DOCUMENTS -> "Public Documents folder (easy backup)"
                                    StorageStrategy.CUSTOM -> "Custom location (choose manually)"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Custom folder picker button
                if (selectedStrategy == StorageStrategy.CUSTOM) {
                    OutlinedButton(
                        onClick = { folderPickerLauncher.launch(null) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            Icons.Default.Folder,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = if (uiState.customFolderUri != null) {
                                "Folder Selected ✓"
                            } else {
                                "Select Folder"
                            }
                        )
                    }
                    if (uiState.customFolderUri == null) {
                        Text(
                            text = "Please select a folder to store the vault",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Master Password") },
                    visualTransformation = if (showPassword) {
                        androidx.compose.ui.text.input.VisualTransformation.None
                    } else {
                        androidx.compose.ui.text.input.PasswordVisualTransformation()
                    },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (showPassword) "Hide password" else "Show password"
                            )
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Confirm Password") },
                    visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    singleLine = true,
                    isError = confirmPassword.isNotBlank() && password != confirmPassword,
                    supportingText = if (confirmPassword.isNotBlank() && password != confirmPassword) {
                        { Text("Passwords don't match") }
                    } else null,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = setAsDefault,
                        onCheckedChange = { setAsDefault = it }
                    )
                    Text(
                        text = "Set as default vault",
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }

                // Option biométrie
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = enableBiometric,
                        onCheckedChange = { enableBiometric = it },
                        enabled = isBiometricAvailable
                    )
                    Column(modifier = Modifier.padding(start = 8.dp)) {
                        Text(
                            text = "Enable biometric unlock",
                            color = if (isBiometricAvailable) {
                                MaterialTheme.colorScheme.onSurface
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                        if (!isBiometricAvailable) {
                            Text(
                                text = "Not available on this device",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    if (isBiometricAvailable) {
                        Spacer(Modifier.weight(1f))
                        Icon(
                            Icons.Default.Fingerprint,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onCreate(
                        name,
                        password,
                        selectedStrategy,
                        description.takeIf { it.isNotBlank() },
                        setAsDefault,
                        enableBiometric
                    )
                },
                enabled = isValid
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Dialog de confirmation de suppression
 */
@Composable
fun ConfirmDeleteDialog(
    vaultName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error
            )
        },
        title = { Text("Delete Vault?") },
        text = {
            Text("Are you sure you want to delete \"$vaultName\"? This action cannot be undone and all data will be permanently lost.")
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Dialog de migration
 */
@Composable
fun MigrationDialog(
    isActive: Boolean,
    progress: com.julien.genpwdpro.data.vault.VaultMigrationManager.MigrationProgress?,
    onDismiss: () -> Unit,
    onConfirm: (Map<String, String>) -> Unit
) {
    AlertDialog(
        onDismissRequest = if (isActive) {
            {}
        } else {
            onDismiss
        },
        title = { Text("Migrate Vaults") },
        text = {
            if (isActive && progress != null) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("Migrating vaults to new file-based system...")
                    LinearProgressIndicator(
                        progress = if (progress.totalVaults > 0) {
                            progress.currentVault.toFloat() / progress.totalVaults
                        } else 0f,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(
                        text = "${progress.currentVault}/${progress.totalVaults}: ${progress.vaultName}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            } else {
                Text("Your vaults will be migrated to the new file-based storage system. This is a one-time operation and may take a few moments.")
            }
        },
        confirmButton = {
            if (!isActive) {
                Button(onClick = { onConfirm(emptyMap()) }) {
                    Text("Start Migration")
                }
            }
        },
        dismissButton = {
            if (!isActive) {
                TextButton(onClick = onDismiss) {
                    Text("Later")
                }
            }
        }
    )
}

// Utility functions
private fun formatDate(timestamp: Long): String {
    val sdf = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
    }
}
