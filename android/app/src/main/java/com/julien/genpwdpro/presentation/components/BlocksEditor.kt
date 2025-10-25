package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.CaseBlock

/**
 * Éditeur de blocs de casse (U/T/L)
 */
@Composable
fun BlocksEditor(
    blocks: List<CaseBlock>,
    onBlocksChange: (List<CaseBlock>) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Contrôles
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Boutons preset
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { onBlocksChange(listOf(CaseBlock.T, CaseBlock.T, CaseBlock.T)) },
                    modifier = Modifier.height(36.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp)
                ) {
                    Text("Tout Title", style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(
                    onClick = { onBlocksChange(listOf(CaseBlock.U, CaseBlock.U, CaseBlock.U)) },
                    modifier = Modifier.height(36.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp)
                ) {
                    Text("Tout UPPER", style = MaterialTheme.typography.labelSmall)
                }
            }

            // Boutons +/- et aléatoire
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = {
                        if (blocks.size > 1) {
                            onBlocksChange(blocks.dropLast(1))
                        }
                    },
                    enabled = blocks.size > 1
                ) {
                    Icon(Icons.Default.Remove, "Remove block")
                }

                Text(
                    text = "${blocks.size}",
                    style = MaterialTheme.typography.labelMedium
                )

                IconButton(
                    onClick = {
                        if (blocks.size < 8) {
                            onBlocksChange(blocks + CaseBlock.L)
                        }
                    },
                    enabled = blocks.size < 8
                ) {
                    Icon(Icons.Default.Add, "Add block")
                }

                IconButton(
                    onClick = {
                        val random = List(blocks.size) {
                            CaseBlock.values().random()
                        }
                        onBlocksChange(random)
                    }
                ) {
                    Icon(Icons.Default.Casino, "Random blocks", tint = MaterialTheme.colorScheme.primary)
                }
            }
        }

        // Blocs cliquables
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            blocks.forEachIndexed { index, block ->
                BlockChip(
                    block = block,
                    onClick = {
                        val newBlocks = blocks.toMutableList()
                        newBlocks[index] = when (block) {
                            CaseBlock.U -> CaseBlock.T
                            CaseBlock.T -> CaseBlock.L
                            CaseBlock.L -> CaseBlock.U
                        }
                        onBlocksChange(newBlocks)
                    }
                )
            }
        }
    }
}

/**
 * Chip représentant un bloc de casse
 */
@Composable
private fun BlockChip(
    block: CaseBlock,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val (label, color) = when (block) {
        CaseBlock.U -> "U" to MaterialTheme.colorScheme.error
        CaseBlock.T -> "T" to MaterialTheme.colorScheme.primary
        CaseBlock.L -> "L" to MaterialTheme.colorScheme.tertiary
    }

    Box(
        modifier = modifier
            .size(48.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.15f))
            .border(
                width = 2.dp,
                color = color,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}
