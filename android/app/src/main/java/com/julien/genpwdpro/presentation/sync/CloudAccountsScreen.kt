package com.julien.genpwdpro.presentation.sync

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.genpwd.corevault.ProviderKind
import com.julien.genpwdpro.R
import kotlinx.coroutines.launch

/**
 * Main screen for managing cloud provider accounts.
 *
 * Features:
 * - List all connected cloud accounts
 * - Add new accounts with OAuth flow
 * - View sync status per account
 * - Remove accounts
 * - Trigger manual sync
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloudAccountsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToAddAccount: () -> Unit,
    viewModel: CloudAccountsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Handle events
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is CloudAccountsEvent.StartOAuthFlow -> {
                    onNavigateToAddAccount()
                }
                is CloudAccountsEvent.AccountAdded -> {
                    snackbarHostState.showSnackbar("Account added successfully")
                }
                is CloudAccountsEvent.AccountRemoved -> {
                    snackbarHostState.showSnackbar("Account removed")
                }
                is CloudAccountsEvent.ShowMessage -> {
                    snackbarHostState.showSnackbar(event.message)
                }
                is CloudAccountsEvent.ShowError -> {
                    snackbarHostState.showSnackbar(
                        message = event.error,
                        duration = SnackbarDuration.Long
                    )
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cloud Accounts") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToAddAccount,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Add Account") }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is CloudAccountsUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                is CloudAccountsUiState.Success -> {
                    if (state.accounts.isEmpty()) {
                        EmptyAccountsView(
                            onAddAccount = onNavigateToAddAccount,
                            modifier = Modifier.align(Alignment.Center)
                        )
                    } else {
                        AccountsList(
                            accounts = state.accounts,
                            onSyncAccount = { kind, accountId ->
                                viewModel.syncAccount(kind, accountId)
                            },
                            onRemoveAccount = { accountId ->
                                scope.launch {
                                    val result = snackbarHostState.showSnackbar(
                                        message = "Remove this cloud account?",
                                        actionLabel = "Remove",
                                        duration = SnackbarDuration.Long
                                    )
                                    if (result == SnackbarResult.ActionPerformed) {
                                        viewModel.removeAccount(accountId)
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
                is CloudAccountsUiState.Error -> {
                    ErrorView(
                        message = state.message,
                        onRetry = { viewModel.loadAccounts() },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyAccountsView(
    onAddAccount: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            imageVector = Icons.Default.CloudOff,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "No Cloud Accounts",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = "Add a cloud account to sync your vaults across devices",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Button(
            onClick = onAddAccount,
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Account")
        }
    }
}

@Composable
private fun AccountsList(
    accounts: List<AccountWithVaults>,
    onSyncAccount: (ProviderKind, String) -> Unit,
    onRemoveAccount: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(accounts) { accountWithVaults ->
            AccountCard(
                accountWithVaults = accountWithVaults,
                onSync = { onSyncAccount(accountWithVaults.account.providerKind, accountWithVaults.account.id) },
                onRemove = { onRemoveAccount(accountWithVaults.account.id) }
            )
        }
    }
}

@Composable
private fun AccountCard(
    accountWithVaults: AccountWithVaults,
    onSync: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
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
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Provider icon
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(getProviderColor(accountWithVaults.account.providerKind)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = getProviderIcon(accountWithVaults.account.providerKind),
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }

                    Column {
                        Text(
                            text = accountWithVaults.account.providerKind.name.replace("_", " "),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = accountWithVaults.account.displayName,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Status badge
                SyncStatusBadge(status = accountWithVaults.syncStatus)
            }

            // Vaults count
            Text(
                text = "${accountWithVaults.vaults.size} vaults",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp, start = 52.dp)
            )

            // Actions
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onSync,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Sync")
                }

                OutlinedButton(
                    onClick = { expanded = !expanded },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Details")
                }

                IconButton(onClick = onRemove) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Remove",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Expanded vaults list
            AnimatedVisibility(visible = expanded) {
                Column(
                    modifier = Modifier.padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Vaults:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                    accountWithVaults.vaults.forEach { vault ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = vault.name,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "${vault.size / 1024} KB",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SyncStatusBadge(status: SyncStatus) {
    val (text, color) = when (status) {
        SyncStatus.IDLE -> "Idle" to MaterialTheme.colorScheme.onSurfaceVariant
        SyncStatus.SYNCING -> "Syncing..." to MaterialTheme.colorScheme.primary
        SyncStatus.SUCCESS -> "Synced" to MaterialTheme.colorScheme.tertiary
        SyncStatus.ERROR -> "Error" to MaterialTheme.colorScheme.error
        SyncStatus.CONFLICT -> "Conflict" to MaterialTheme.colorScheme.error
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = 0.1f)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun ErrorView(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Text(
            text = "Error",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.error
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

@Composable
private fun getProviderIcon(kind: ProviderKind): ImageVector {
    return when (kind) {
        ProviderKind.GOOGLE_DRIVE -> Icons.Default.CloudQueue
        ProviderKind.DROPBOX -> Icons.Default.Cloud
        ProviderKind.ONEDRIVE -> Icons.Default.CloudCircle
        ProviderKind.WEBDAV, ProviderKind.NEXTCLOUD -> Icons.Default.Storage
    }
}

@Composable
private fun getProviderColor(kind: ProviderKind) = when (kind) {
    ProviderKind.GOOGLE_DRIVE -> MaterialTheme.colorScheme.primary
    ProviderKind.DROPBOX -> MaterialTheme.colorScheme.secondary
    ProviderKind.ONEDRIVE -> MaterialTheme.colorScheme.tertiary
    ProviderKind.WEBDAV, ProviderKind.NEXTCLOUD -> MaterialTheme.colorScheme.primaryContainer
}
