package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.Settings

/**
 * Section configuration de la casse
 */
@Composable
fun CasingSection(
    settings: Settings,
    onSettingsChange: (Settings) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Mode de casse
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Mode de casse",
                style = MaterialTheme.typography.bodyMedium
            )
            CaseModeDropdown(
                selectedMode = settings.caseMode,
                onModeSelected = { onSettingsChange(settings.copy(caseMode = it)) }
            )
        }

        // Éditeur de blocs (si mode BLOCKS)
        if (settings.caseMode == CaseMode.BLOCKS) {
            BlocksEditor(
                blocks = settings.caseBlocks,
                onBlocksChange = { onSettingsChange(settings.copy(caseBlocks = it)) }
            )
        }
    }
}

@Composable
private fun CaseModeDropdown(
    selectedMode: CaseMode,
    onModeSelected: (CaseMode) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = getCaseModeLabel(selectedMode),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            CaseMode.values().forEach { mode ->
                DropdownMenuItem(
                    text = { Text(getCaseModeLabel(mode)) },
                    leadingIcon = {
                        Icon(
                            imageVector = getCaseModeIcon(mode),
                            contentDescription = null,
                            tint = if (mode == selectedMode)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.onSurface
                        )
                    },
                    onClick = {
                        onModeSelected(mode)
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun getCaseModeIcon(mode: CaseMode): ImageVector = when (mode) {
    CaseMode.MIXED -> Icons.Default.Shuffle
    CaseMode.UPPER -> Icons.Default.KeyboardArrowUp
    CaseMode.LOWER -> Icons.Default.KeyboardArrowDown
    CaseMode.TITLE -> Icons.Default.Title
    CaseMode.BLOCKS -> Icons.Default.ViewModule
}

private fun getCaseModeLabel(mode: CaseMode): String = when (mode) {
    CaseMode.MIXED -> "Mixte (aléatoire)"
    CaseMode.UPPER -> "MAJUSCULES"
    CaseMode.LOWER -> "minuscules"
    CaseMode.TITLE -> "Title Case"
    CaseMode.BLOCKS -> "Blocs (U/T/L)"
}
