package com.julien.genpwdpro.presentation.screens.sync

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.providers.PCloudProvider
import com.julien.genpwdpro.data.sync.providers.ProviderInfo

/**
 * Configuration universelle pour les cloud providers
 *
 * Supporte:
 * - Google Drive (OAuth uniquement, pas de config)
 * - OneDrive (Client ID Azure AD)
 * - pCloud (App Key, App Secret, Région)
 * - ProtonDrive (Client ID, Client Secret)
 * - WebDAV (voir WebDAVConfigDialog)
 */
@Composable
fun CloudProviderConfigDialog(
    providerInfo: ProviderInfo,
    onDismiss: () -> Unit,
    onAuthenticate: (CloudProviderConfig) -> Unit
) {
    when (providerInfo.type) {
        CloudProviderType.GOOGLE_DRIVE -> {
            GoogleDriveConfigDialog(
                onDismiss = onDismiss,
                onAuthenticate = { onAuthenticate(CloudProviderConfig.GoogleDrive) }
            )
        }
        CloudProviderType.ONEDRIVE -> {
            OneDriveConfigDialog(
                onDismiss = onDismiss,
                onAuthenticate = { clientId ->
                    onAuthenticate(CloudProviderConfig.OneDrive(clientId))
                }
            )
        }
        CloudProviderType.PCLOUD -> {
            PCloudConfigDialog(
                onDismiss = onDismiss,
                onAuthenticate = { appKey, appSecret, region ->
                    onAuthenticate(CloudProviderConfig.PCloud(appKey, appSecret, region))
                }
            )
        }
        CloudProviderType.PROTON_DRIVE -> {
            ProtonDriveConfigDialog(
                onDismiss = onDismiss,
                onAuthenticate = { clientId, clientSecret ->
                    onAuthenticate(CloudProviderConfig.ProtonDrive(clientId, clientSecret))
                }
            )
        }
        CloudProviderType.WEBDAV -> {
            // Use WebDAVConfigDialog separately
        }
        CloudProviderType.NONE -> {
            // No config needed
        }
    }
}

/**
 * Google Drive - OAuth uniquement
 */
@Composable
private fun GoogleDriveConfigDialog(
    onDismiss: () -> Unit,
    onAuthenticate: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📁", style = MaterialTheme.typography.headlineMedium)
                    Column {
                        Text(
                            text = "Google Drive",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "15 GB gratuits",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                InfoCardSimple(
                    message = "Google Drive utilise OAuth2 pour l'authentification. Vous serez redirigé vers Google pour vous connecter."
                )

                // Features list
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Fonctionnalités",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        FeatureRow("✓", "15 GB de stockage gratuit")
                        FeatureRow("✓", "Synchronisation automatique")
                        FeatureRow("✓", "Chiffrement E2E (AES-256-GCM)")
                        FeatureRow("✓", "Gestion des quotas")
                    }
                }

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Annuler")
                    }
                    Button(
                        onClick = onAuthenticate,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Login, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Se connecter")
                    }
                }
            }
        }
    }
}

/**
 * OneDrive - Client ID Azure AD
 */
@Composable
private fun OneDriveConfigDialog(
    onDismiss: () -> Unit,
    onAuthenticate: (String) -> Unit
) {
    var clientId by remember { mutableStateOf("") }
    val isValid = clientId.isNotBlank()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("☁️", style = MaterialTheme.typography.headlineMedium)
                        Column {
                            Text(
                                text = "Microsoft OneDrive",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "5 GB gratuits",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "Fermer")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    InfoCardSimple(
                        message = "OneDrive nécessite un Client ID Azure AD. Suivez le guide OAUTH2_SETUP_GUIDE.md pour obtenir vos identifiants."
                    )

                    OutlinedTextField(
                        value = clientId,
                        onValueChange = { clientId = it.trim() },
                        label = { Text("Client ID (Application ID)") },
                        placeholder = { Text("00000000-0000-0000-0000-000000000000") },
                        leadingIcon = {
                            Icon(Icons.Default.Key, contentDescription = null)
                        },
                        supportingText = {
                            Text("ID de l'application depuis Azure AD")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    SetupGuideCard(
                        steps = listOf(
                            "Créer une app dans Azure AD Portal",
                            "Configurer la redirection Mobile/Desktop",
                            "Ajouter les permissions Files.ReadWrite",
                            "Copier l'Application (client) ID"
                        ),
                        guideFile = "OAUTH2_SETUP_GUIDE.md"
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Annuler")
                    }
                    Button(
                        onClick = { if (isValid) onAuthenticate(clientId) },
                        modifier = Modifier.weight(1f),
                        enabled = isValid
                    ) {
                        Icon(Icons.Default.Login, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Continuer")
                    }
                }
            }
        }
    }
}

/**
 * pCloud - App Key, App Secret, Region
 */
@Composable
private fun PCloudConfigDialog(
    onDismiss: () -> Unit,
    onAuthenticate: (String, String, PCloudProvider.PCloudRegion) -> Unit
) {
    var appKey by remember { mutableStateOf("") }
    var appSecret by remember { mutableStateOf("") }
    var selectedRegion by remember { mutableStateOf(PCloudProvider.PCloudRegion.EU) }
    var showSecret by remember { mutableStateOf(false) }

    val isValid = appKey.isNotBlank() && appSecret.isNotBlank()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("☁️", style = MaterialTheme.typography.headlineMedium)
                        Column {
                            Text(
                                text = "pCloud",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "10 GB gratuits - Serveurs européens",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "Fermer")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    InfoCardSimple(
                        message = "pCloud nécessite une app OAuth2. Obtenez vos identifiants depuis pCloud App Console."
                    )

                    OutlinedTextField(
                        value = appKey,
                        onValueChange = { appKey = it.trim() },
                        label = { Text("App Key (OAuth2 Client ID)") },
                        leadingIcon = {
                            Icon(Icons.Default.Key, contentDescription = null)
                        },
                        supportingText = {
                            Text("Clé d'application pCloud")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = appSecret,
                        onValueChange = { appSecret = it.trim() },
                        label = { Text("App Secret (OAuth2 Client Secret)") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null)
                        },
                        trailingIcon = {
                            IconButton(onClick = { showSecret = !showSecret }) {
                                Icon(
                                    if (showSecret) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (showSecret) "Masquer" else "Afficher"
                                )
                            }
                        },
                        visualTransformation = if (showSecret)
                            VisualTransformation.None
                        else
                            PasswordVisualTransformation(),
                        supportingText = {
                            Text("Secret d'application pCloud")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Region selection
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "Région du serveur",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                PCloudProvider.PCloudRegion.values().forEach { region ->
                                    FilterChip(
                                        selected = selectedRegion == region,
                                        onClick = { selectedRegion = region },
                                        label = {
                                            Text(
                                                when (region) {
                                                    PCloudProvider.PCloudRegion.EU -> "Europe (Recommandé)"
                                                    PCloudProvider.PCloudRegion.US -> "États-Unis"
                                                }
                                            )
                                        },
                                        leadingIcon = if (selectedRegion == region) {
                                            {
                                                Icon(
                                                    Icons.Default.Check,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        } else null,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }

                    SetupGuideCard(
                        steps = listOf(
                            "Créer un compte sur pcloud.com",
                            "Accéder à pCloud App Console",
                            "Créer une nouvelle application OAuth2",
                            "Configurer genpwdpro://oauth/pcloud",
                            "Copier App Key et App Secret"
                        ),
                        guideFile = "OAUTH2_SETUP_GUIDE.md"
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Annuler")
                    }
                    Button(
                        onClick = {
                            if (isValid) onAuthenticate(appKey, appSecret, selectedRegion)
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isValid
                    ) {
                        Icon(Icons.Default.Login, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Continuer")
                    }
                }
            }
        }
    }
}

/**
 * ProtonDrive - Client ID, Client Secret
 */
@Composable
private fun ProtonDriveConfigDialog(
    onDismiss: () -> Unit,
    onAuthenticate: (String, String) -> Unit
) {
    var clientId by remember { mutableStateOf("") }
    var clientSecret by remember { mutableStateOf("") }
    var showSecret by remember { mutableStateOf(false) }

    val isValid = clientId.isNotBlank() && clientSecret.isNotBlank()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("🔐", style = MaterialTheme.typography.headlineMedium)
                        Column {
                            Text(
                                text = "Proton Drive",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Maximum Privacy - Serveurs Suisses",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "Fermer")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    InfoCardSimple(
                        message = "Proton Drive offre le plus haut niveau de confidentialité avec chiffrement end-to-end natif et serveurs suisses."
                    )

                    // Privacy badge
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFE8F5E9)
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Security,
                                contentDescription = null,
                                tint = Color(0xFF388E3C)
                            )
                            Column {
                                Text(
                                    text = "Privacy Maximale",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF1B5E20)
                                )
                                Text(
                                    text = "Zero-access encryption + E2E natif",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF2E7D32)
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = clientId,
                        onValueChange = { clientId = it.trim() },
                        label = { Text("Client ID Proton OAuth2") },
                        leadingIcon = {
                            Icon(Icons.Default.Key, contentDescription = null)
                        },
                        supportingText = {
                            Text("ID client depuis Proton Developer Portal")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = clientSecret,
                        onValueChange = { clientSecret = it.trim() },
                        label = { Text("Client Secret Proton OAuth2") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null)
                        },
                        trailingIcon = {
                            IconButton(onClick = { showSecret = !showSecret }) {
                                Icon(
                                    if (showSecret) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (showSecret) "Masquer" else "Afficher"
                                )
                            }
                        },
                        visualTransformation = if (showSecret)
                            VisualTransformation.None
                        else
                            PasswordVisualTransformation(),
                        supportingText = {
                            Text("Secret client depuis Proton Developer Portal")
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    SetupGuideCard(
                        steps = listOf(
                            "Créer un compte Proton",
                            "Accéder au Proton Developer Portal",
                            "Créer une application OAuth2",
                            "Configurer genpwdpro://oauth/proton",
                            "Activer les scopes: drive.read, drive.write",
                            "Copier Client ID et Client Secret"
                        ),
                        guideFile = "OAUTH2_SETUP_GUIDE.md"
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Annuler")
                    }
                    Button(
                        onClick = {
                            if (isValid) onAuthenticate(clientId, clientSecret)
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isValid
                    ) {
                        Icon(Icons.Default.Login, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Continuer")
                    }
                }
            }
        }
    }
}

// ========== Helper Composables ==========

@Composable
private fun InfoCardSimple(message: String) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE3F2FD)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Info,
                contentDescription = null,
                tint = Color(0xFF1976D2)
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF0D47A1)
            )
        }
    }
}

@Composable
private fun SetupGuideCard(steps: List<String>, guideFile: String) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Guide de configuration",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            steps.forEachIndexed { index, step ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = "${index + 1}.",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = step,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Divider(modifier = Modifier.padding(vertical = 4.dp))

            Text(
                text = "📖 Voir $guideFile pour plus de détails",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.tertiary,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun FeatureRow(icon: String, text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = icon,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Configuration pour chaque provider
 */
sealed class CloudProviderConfig {
    object GoogleDrive : CloudProviderConfig()
    data class OneDrive(val clientId: String) : CloudProviderConfig()
    data class PCloud(
        val appKey: String,
        val appSecret: String,
        val region: PCloudProvider.PCloudRegion
    ) : CloudProviderConfig()
    data class ProtonDrive(
        val clientId: String,
        val clientSecret: String
    ) : CloudProviderConfig()
}
