package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.local.entity.TagEntity

/**
 * Chip pour afficher un tag avec sa couleur
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagChip(
    tag: TagEntity,
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val tagColor = try {
        Color(android.graphics.Color.parseColor(tag.color))
    } catch (e: Exception) {
        MaterialTheme.colorScheme.primary
    }

    AssistChip(
        onClick = { },
        label = {
            Text(
                text = tag.name,
                style = MaterialTheme.typography.labelMedium
            )
        },
        leadingIcon = {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(tagColor)
            )
        },
        trailingIcon = onRemove?.let {
            {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Remove tag",
                    modifier = Modifier
                        .size(16.dp)
                        .clickable { onRemove() }
                )
            }
        },
        modifier = modifier
    )
}

/**
 * Liste horizontale de tags
 */
@Composable
fun TagsList(
    tags: List<TagEntity>,
    onRemoveTag: ((TagEntity) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    if (tags.isNotEmpty()) {
        LazyRow(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(tags) { tag ->
                TagChip(
                    tag = tag,
                    onRemove = onRemoveTag?.let { { it(tag) } }
                )
            }
        }
    }
}

/**
 * Sélecteur de tags avec dialog
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagSelector(
    selectedTags: List<TagEntity>,
    availableTags: List<TagEntity>,
    onTagAdded: (TagEntity) -> Unit,
    onTagRemoved: (TagEntity) -> Unit,
    onCreateTag: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showTagDialog by remember { mutableStateOf(false) }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Tags",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            IconButton(onClick = { showTagDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add tag")
            }
        }

        // Liste des tags sélectionnés
        if (selectedTags.isNotEmpty()) {
            TagsList(
                tags = selectedTags,
                onRemoveTag = onTagRemoved
            )
        } else {
            Text(
                text = "Aucun tag",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    // Dialog de sélection/création de tags
    if (showTagDialog) {
        TagSelectionDialog(
            selectedTags = selectedTags,
            availableTags = availableTags,
            onTagSelected = onTagAdded,
            onTagDeselected = onTagRemoved,
            onCreateTag = onCreateTag,
            onDismiss = { showTagDialog = false }
        )
    }
}

/**
 * Dialog pour sélectionner ou créer des tags
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagSelectionDialog(
    selectedTags: List<TagEntity>,
    availableTags: List<TagEntity>,
    onTagSelected: (TagEntity) -> Unit,
    onTagDeselected: (TagEntity) -> Unit,
    onCreateTag: (String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var showCreateDialog by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Gérer les tags") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Liste des tags disponibles
                if (availableTags.isNotEmpty()) {
                    Text(
                        text = "Tags disponibles",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )

                    availableTags.forEach { tag ->
                        val isSelected = selectedTags.any { it.id == tag.id }
                        val tagColor = try {
                            Color(android.graphics.Color.parseColor(tag.color))
                        } catch (e: Exception) {
                            MaterialTheme.colorScheme.primary
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (isSelected) {
                                        onTagDeselected(tag)
                                    } else {
                                        onTagSelected(tag)
                                    }
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = {
                                    if (it) onTagSelected(tag) else onTagDeselected(tag)
                                }
                            )

                            Box(
                                modifier = Modifier
                                    .size(16.dp)
                                    .clip(CircleShape)
                                    .background(tagColor)
                            )

                            Text(
                                text = tag.name,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                } else {
                    Text(
                        text = "Aucun tag disponible",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(Modifier.height(8.dp))

                // Bouton créer un nouveau tag
                OutlinedButton(
                    onClick = { showCreateDialog = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Créer un nouveau tag")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fermer")
            }
        }
    )

    // Dialog de création de tag
    if (showCreateDialog) {
        CreateTagDialog(
            onCreateTag = { name, color ->
                onCreateTag(name, color)
                showCreateDialog = false
            },
            onDismiss = { showCreateDialog = false }
        )
    }
}

/**
 * Dialog pour créer un nouveau tag
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateTagDialog(
    onCreateTag: (name: String, color: String) -> Unit,
    onDismiss: () -> Unit
) {
    var tagName by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf("#FF6B6B") }

    val predefinedColors = listOf(
        "#FF6B6B", // Rouge
        "#F59E0B", // Orange
        "#10B981", // Vert
        "#15BEFF", // Bleu
        "#8B5CF6", // Violet
        "#EC4899", // Rose
        "#6366F1", // Indigo
        "#14B8A6"  // Teal
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouveau tag") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedTextField(
                    value = tagName,
                    onValueChange = { tagName = it },
                    label = { Text("Nom du tag") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Text(
                    text = "Couleur",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                // Grille de couleurs
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    predefinedColors.chunked(4).forEach { rowColors ->
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            rowColors.forEach { colorHex ->
                                val color = Color(android.graphics.Color.parseColor(colorHex))
                                val isSelected = selectedColor == colorHex

                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(color)
                                        .clickable { selectedColor = colorHex },
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isSelected) {
                                        Icon(
                                            imageVector = Icons.Default.Check,
                                            contentDescription = "Selected",
                                            tint = Color.White,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (tagName.isNotBlank()) {
                        onCreateTag(tagName.trim(), selectedColor)
                    }
                },
                enabled = tagName.isNotBlank()
            ) {
                Text("Créer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
