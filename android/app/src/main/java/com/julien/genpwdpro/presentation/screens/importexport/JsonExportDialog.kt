package com.julien.genpwdpro.presentation.screens.importexport

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff

/**
 * Dialogue pour exporter un vault en JSON chiffré
 * Demande le mot de passe maître et permet de choisir la destination
 */
@Composable
fun JsonExportDialog(
    vaultId: String,
    onDismiss: () -> Unit,
    onConfirm: (masterPassword: String, uri: Uri) -> Unit
) {
    var masterPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var selectedUri by remember { mutableStateOf<Uri?>(null) }

    // Lanceur pour le Storage Access Framework (SAF)
    val createDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        uri?.let {
            selectedUri = it
            onConfirm(masterPassword, it)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Exporter en JSON chiffré") },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Entrez le mot de passe maître pour chiffrer l'export :",
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = masterPassword,
                    onValueChange = { masterPassword = it },
                    label = { Text("Mot de passe maître") },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (passwordVisible) "Masquer le mot de passe" else "Afficher le mot de passe"
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    // Déclencher le sélecteur de fichier SAF
                    createDocumentLauncher.launch("vault_export.json")
                },
                enabled = masterPassword.isNotBlank()
            ) {
                Text("Exporter")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
