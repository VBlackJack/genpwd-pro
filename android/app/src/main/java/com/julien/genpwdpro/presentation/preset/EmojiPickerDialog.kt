package com.julien.genpwdpro.presentation.preset

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

/**
 * Dialog de sélection d'emoji pour les presets
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmojiPickerDialog(
    onDismiss: () -> Unit,
    onEmojiSelected: (String) -> Unit,
    currentEmoji: String = "🔐"
) {
    var selectedCategory by remember { mutableStateOf(EmojiCategory.SYMBOLS) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 500.dp),
            shape = MaterialTheme.shapes.large
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
                    Text(
                        text = "Choisir une icône",
                        style = MaterialTheme.typography.titleLarge
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Fermer"
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Current emoji preview
                Text(
                    text = "Actuel : $currentEmoji",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Category tabs
                ScrollableTabRow(
                    selectedTabIndex = EmojiCategory.values().indexOf(selectedCategory),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    EmojiCategory.values().forEach { category ->
                        Tab(
                            selected = selectedCategory == category,
                            onClick = { selectedCategory = category },
                            text = { Text(category.label) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Emoji grid
                LazyVerticalGrid(
                    columns = GridCells.Fixed(6),
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(selectedCategory.emojis) { emoji ->
                        EmojiItem(
                            emoji = emoji,
                            isSelected = emoji == currentEmoji,
                            onClick = {
                                onEmojiSelected(emoji)
                                onDismiss()
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Item d'emoji cliquable
 */
@Composable
private fun EmojiItem(
    emoji: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .size(48.dp)
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.small,
        color = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        tonalElevation = if (isSelected) 4.dp else 0.dp
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            Text(
                text = emoji,
                fontSize = 28.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Catégories d'emojis
 */
enum class EmojiCategory(val label: String, val emojis: List<String>) {
    SYMBOLS(
        "Symboles",
        listOf(
            "🔐", "🔒", "🔓", "🔑", "🗝️", "🛡️",
            "⚡", "🔥", "💎", "⭐", "✨", "💫",
            "🎯", "🎪", "🎨", "🎭", "🎬", "🎮",
            "⚔️", "🛠️", "🔧", "🔨", "⚙️", "🔩",
            "💼", "📁", "📂", "📋", "📌", "📍",
            "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️"
        )
    ),
    OBJECTS(
        "Objets",
        listOf(
            "💻", "🖥️", "⌨️", "🖱️", "🖨️", "💾",
            "📱", "☎️", "📞", "📟", "📠", "📡",
            "🎓", "📚", "📖", "📝", "✏️", "✒️",
            "🏠", "🏢", "🏦", "🏪", "🏫", "🏬",
            "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️",
            "✈️", "🚀", "🛸", "🚁", "🛩️", "⛵"
        )
    ),
    NATURE(
        "Nature",
        listOf(
            "🌟", "🌠", "🌙", "☀️", "⛅", "🌤️",
            "🌱", "🌿", "🍀", "🌲", "🌳", "🌴",
            "🌸", "🌺", "🌻", "🌹", "🌷", "🌼",
            "🐶", "🐱", "🐭", "🐹", "🐰", "🦊",
            "🦁", "🐯", "🐻", "🐼", "🐨", "🐵",
            "🦅", "🦉", "🦇", "🐺", "🐗", "🦄"
        )
    ),
    FOOD(
        "Nourriture",
        listOf(
            "🍎", "🍊", "🍋", "🍌", "🍉", "🍇",
            "🍓", "🫐", "🍈", "🍒", "🍑", "🥭",
            "🍕", "🍔", "🍟", "🌭", "🌮", "🌯",
            "🍜", "🍝", "🍛", "🍲", "🥘", "🍱",
            "☕", "🍵", "🥤", "🧃", "🧋", "🍺",
            "🎂", "🍰", "🧁", "🍪", "🍩", "🍫"
        )
    ),
    ACTIVITIES(
        "Activités",
        listOf(
            "⚽", "🏀", "🏈", "⚾", "🎾", "🏐",
            "🎮", "🎯", "🎲", "🎰", "🎳", "🎪",
            "🎭", "🎨", "🎬", "🎤", "🎧", "🎵",
            "🎸", "🎹", "🥁", "🎺", "🎷", "🎻",
            "♟️", "🎴", "🀄", "🎯", "🎱", "🏓",
            "🏏", "🏑", "🏒", "🥅", "⛳", "🏹"
        )
    ),
    FACES(
        "Visages",
        listOf(
            "😀", "😃", "😄", "😁", "😆", "😅",
            "😂", "🤣", "😊", "😇", "🙂", "😉",
            "😍", "🥰", "😘", "😗", "😙", "😚",
            "😎", "🤓", "🧐", "🤔", "🤨", "😐",
            "😏", "😒", "🙄", "😬", "🤥", "😌",
            "😔", "😪", "🤤", "😴", "😷", "🤒"
        )
    )
}
