package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.PasswordResult

/**
 * Carte affichant un mot de passe généré
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    modifier: Modifier = Modifier,
    onSave: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null
) {
    var showContextMenu by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Mot de passe (clic simple pour copier, appui long pour menu)
            Box {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .combinedClickable(
                            onClick = onCopy,
                            onLongClick = { showContextMenu = true }
                        ),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = result.maskedPassword,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontFamily = FontFamily.Monospace
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Bouton sauvegarder (si callback fourni)
                        if (onSave != null) {
                            IconButton(onClick = onSave) {
                                Icon(
                                    imageVector = Icons.Default.Save,
                                    contentDescription = "Sauvegarder dans le vault",
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }

                        // Bouton masquer/afficher
                        IconButton(onClick = onToggleMask) {
                            Icon(
                                imageVector = if (result.isMasked) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (result.isMasked) "Show" else "Hide",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }

                        // Bouton copier
                        IconButton(onClick = onCopy) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copy",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                // Menu contextuel (appui long)
                DropdownMenu(
                    expanded = showContextMenu,
                    onDismissRequest = { showContextMenu = false },
                    offset = DpOffset(0.dp, (-8).dp)
                ) {
                    // Copier
                    DropdownMenuItem(
                        text = { Text("Copier le mot de passe") },
                        onClick = {
                            onCopy()
                            showContextMenu = false
                        },
                        leadingIcon = {
                            Icon(Icons.Default.ContentCopy, contentDescription = null)
                        }
                    )

                    // Sauvegarder dans le coffre
                    if (onSave != null) {
                        DropdownMenuItem(
                            text = { Text("Enregistrer dans le coffre") },
                            onClick = {
                                onSave()
                                showContextMenu = false
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Save, contentDescription = null)
                            }
                        )
                    }

                    // Partager (si callback fourni)
                    if (onShare != null) {
                        DropdownMenuItem(
                            text = { Text("Partager") },
                            onClick = {
                                onShare()
                                showContextMenu = false
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Share, contentDescription = null)
                            }
                        )
                    }

                    Divider()

                    // Masquer/Afficher
                    DropdownMenuItem(
                        text = {
                            Text(if (result.isMasked) "Afficher le mot de passe" else "Masquer le mot de passe")
                        },
                        onClick = {
                            onToggleMask()
                            showContextMenu = false
                        },
                        leadingIcon = {
                            Icon(
                                if (result.isMasked) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = null
                            )
                        }
                    )
                }
            }

            // Indicateur de force et barre d'entropie
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Nouvel indicateur visuel de force
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    PasswordStrengthIndicator(
                        entropy = result.entropy,
                        strength = result.strength,
                        showEntropyValue = true
                    )
                }

                // Barre de progression visuelle
                LinearProgressIndicator(
                    progress = result.strength.progress,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp),
                    color = Color(result.strength.color),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                )
            }
        }
    }
}
