package com.julien.genpwdpro.presentation.sync

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.genpwd.corevault.ProviderKind

/**
 * Screen for adding a new cloud provider account.
 *
 * Allows the user to:
 * 1. Select a cloud provider
 * 2. Start OAuth authentication flow
 * 3. Handle OAuth callback
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCloudAccountScreen(
    onNavigateBack: () -> Unit,
    onProviderSelected: (ProviderKind) -> Unit
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add Cloud Account") },
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
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Text(
                text = "Select a cloud provider to sync your vaults",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 8.dp)
            )

            // Providers list
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(ProviderKind.values().toList()) { provider ->
                    ProviderCard(
                        provider = provider,
                        onClick = { onProviderSelected(provider) }
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Info card at bottom
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Column {
                        Text(
                            text = "Secure & Private",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Text(
                            text = "Your vaults are encrypted before being uploaded. " +
                                    "The cloud provider cannot read your data.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProviderCard(
    provider: ProviderKind,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Provider icon
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(getProviderColor(provider)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getProviderIcon(provider),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(32.dp)
                )
            }

            // Provider info
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = getProviderDisplayName(provider),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = getProviderDescription(provider),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Arrow icon
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun getProviderDisplayName(kind: ProviderKind): String {
    return when (kind) {
        ProviderKind.GOOGLE_DRIVE -> "Google Drive"
        ProviderKind.DROPBOX -> "Dropbox"
        ProviderKind.ONEDRIVE -> "Microsoft OneDrive"
        ProviderKind.WEBDAV -> "WebDAV"
        ProviderKind.NEXTCLOUD -> "Nextcloud"
    }
}

@Composable
private fun getProviderDescription(kind: ProviderKind): String {
    return when (kind) {
        ProviderKind.GOOGLE_DRIVE -> "Sync with your Google account"
        ProviderKind.DROPBOX -> "Sync with Dropbox cloud storage"
        ProviderKind.ONEDRIVE -> "Sync with Microsoft cloud"
        ProviderKind.WEBDAV -> "Connect to any WebDAV server"
        ProviderKind.NEXTCLOUD -> "Connect to Nextcloud server"
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
