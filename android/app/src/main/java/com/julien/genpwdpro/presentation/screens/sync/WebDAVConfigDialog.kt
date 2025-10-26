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

/**
 * Dialog de configuration pour WebDAV
 *
 * Permet à l'utilisateur de configurer manuellement:
 * - L'URL du serveur WebDAV
 * - Le nom d'utilisateur
 * - Le mot de passe
 * - La validation SSL
 *
 * Cas d'usage:
 * - Nextcloud self-hosted
 * - ownCloud
 * - Synology NAS
 * - Serveur WebDAV custom
 */
@Composable
fun WebDAVConfigDialog(
    onDismiss: () -> Unit,
    onSave: (serverUrl: String, username: String, password: String, validateSSL: Boolean) -> Unit,
    onTestConnection: (serverUrl: String, username: String, password: String, validateSSL: Boolean) -> Unit,
    isTestingConnection: Boolean = false,
    testConnectionResult: TestConnectionResult? = null
) {
    var serverUrl by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var validateSSL by remember { mutableStateOf(true) }
    var showPassword by remember { mutableStateOf(false) }

    // Validation
    val isServerUrlValid = serverUrl.isNotBlank() &&
        (serverUrl.startsWith("https://") || serverUrl.startsWith("http://"))
    val isUsernameValid = username.isNotBlank()
    val isPasswordValid = password.isNotBlank()
    val isFormValid = isServerUrlValid && isUsernameValid && isPasswordValid

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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Configuration WebDAV",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Configurez votre serveur WebDAV",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
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
                    // Info Card
                    InfoCard()

                    // Server URL Field
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it.trim() },
                        label = { Text("URL du serveur") },
                        placeholder = { Text("https://cloud.example.com/remote.php/dav/files/username/") },
                        leadingIcon = {
                            Icon(Icons.Default.Cloud, contentDescription = null)
                        },
                        isError = serverUrl.isNotBlank() && !isServerUrlValid,
                        supportingText = {
                            if (serverUrl.isNotBlank() && !isServerUrlValid) {
                                Text("L'URL doit commencer par https:// ou http://")
                            } else {
                                Text("URL complète du dossier WebDAV")
                            }
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Uri
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Username Field
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it.trim() },
                        label = { Text("Nom d'utilisateur") },
                        leadingIcon = {
                            Icon(Icons.Default.Person, contentDescription = null)
                        },
                        isError = username.isNotBlank() && !isUsernameValid,
                        supportingText = {
                            Text("Votre nom d'utilisateur WebDAV")
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Password Field
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Mot de passe") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null)
                        },
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    if (showPassword) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (showPassword) "Masquer" else "Afficher"
                                )
                            }
                        },
                        visualTransformation = if (showPassword)
                            VisualTransformation.None
                        else
                            PasswordVisualTransformation(),
                        isError = password.isNotBlank() && !isPasswordValid,
                        supportingText = {
                            Text("Mot de passe ou app password")
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // SSL Validation Toggle
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Valider le certificat SSL",
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = if (validateSSL)
                                        "Recommandé pour une sécurité maximale"
                                    else
                                        "Désactivé (certificats auto-signés)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (validateSSL)
                                        MaterialTheme.colorScheme.primary
                                    else
                                        MaterialTheme.colorScheme.error
                                )
                            }
                            Switch(
                                checked = validateSSL,
                                onCheckedChange = { validateSSL = it }
                            )
                        }
                    }

                    // Warning for non-SSL
                    if (!validateSSL) {
                        WarningCard(
                            message = "Attention: Désactiver la validation SSL expose vos données à des attaques MITM. N'utilisez cette option que pour des certificats auto-signés de confiance."
                        )
                    }

                    // Test Connection Button
                    OutlinedButton(
                        onClick = {
                            if (isFormValid) {
                                onTestConnection(serverUrl, username, password, validateSSL)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = isFormValid && !isTestingConnection
                    ) {
                        if (isTestingConnection) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Test en cours...")
                        } else {
                            Icon(
                                Icons.Default.Wifi,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Tester la connexion")
                        }
                    }

                    // Test Result
                    testConnectionResult?.let { result ->
                        TestResultCard(result)
                    }

                    // Examples
                    ExamplesCard()
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
                            if (isFormValid) {
                                onSave(serverUrl, username, password, validateSSL)
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isFormValid && testConnectionResult is TestConnectionResult.Success
                    ) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Enregistrer")
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoCard() {
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
                text = "WebDAV vous permet de synchroniser avec votre propre serveur. Compatible avec Nextcloud, ownCloud, Synology, et plus.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF0D47A1)
            )
        }
    }
}

@Composable
private fun WarningCard(message: String) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFEBEE)
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
                Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFD32F2F)
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFB71C1C)
            )
        }
    }
}

@Composable
private fun TestResultCard(result: TestConnectionResult) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = when (result) {
                is TestConnectionResult.Success -> Color(0xFFE8F5E9)
                is TestConnectionResult.Failure -> Color(0xFFFFEBEE)
            }
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
                when (result) {
                    is TestConnectionResult.Success -> Icons.Default.CheckCircle
                    is TestConnectionResult.Failure -> Icons.Default.Error
                },
                contentDescription = null,
                tint = when (result) {
                    is TestConnectionResult.Success -> Color(0xFF388E3C)
                    is TestConnectionResult.Failure -> Color(0xFFD32F2F)
                }
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when (result) {
                        is TestConnectionResult.Success -> "Connexion réussie!"
                        is TestConnectionResult.Failure -> "Échec de la connexion"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = when (result) {
                        is TestConnectionResult.Success -> Color(0xFF1B5E20)
                        is TestConnectionResult.Failure -> Color(0xFFB71C1C)
                    }
                )
                if (result is TestConnectionResult.Success) {
                    Text(
                        text = result.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF2E7D32)
                    )
                } else if (result is TestConnectionResult.Failure) {
                    Text(
                        text = result.error,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFC62828)
                    )
                }
            }
        }
    }
}

@Composable
private fun ExamplesCard() {
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
                text = "Exemples d'URLs",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            ExampleRow(
                service = "Nextcloud",
                url = "https://cloud.example.com/remote.php/dav/files/username/"
            )

            ExampleRow(
                service = "ownCloud",
                url = "https://owncloud.example.com/remote.php/webdav/"
            )

            ExampleRow(
                service = "Synology",
                url = "https://synology.example.com:5006/home/"
            )

            ExampleRow(
                service = "Box.com",
                url = "https://dav.box.com/dav/"
            )
        }
    }
}

@Composable
private fun ExampleRow(service: String, url: String) {
    Column(
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = service,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = url,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
        )
    }
}

/**
 * Résultat du test de connexion
 */
sealed class TestConnectionResult {
    data class Success(val message: String) : TestConnectionResult()
    data class Failure(val error: String) : TestConnectionResult()
}
