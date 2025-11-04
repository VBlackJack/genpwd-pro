package com.julien.genpwdpro.presentation.screens.privacy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.R

@Composable
fun PrivacyScreen(onNavigateBack: () -> Unit) {
    val points = listOf(
        PrivacyPoint(
            icon = Icons.Default.CameraAlt,
            title = R.string.privacy_camera_title,
            description = R.string.privacy_camera_body
        ),
        PrivacyPoint(
            icon = Icons.Default.CloudOff,
            title = R.string.privacy_images_title,
            description = R.string.privacy_images_body
        ),
        PrivacyPoint(
            icon = Icons.Default.Security,
            title = R.string.privacy_encryption_title,
            description = R.string.privacy_encryption_body
        ),
        PrivacyPoint(
            icon = Icons.Default.ContentCopy,
            title = R.string.privacy_clipboard_title,
            description = R.string.privacy_clipboard_body
        ),
        PrivacyPoint(
            icon = Icons.Default.Lock,
            title = R.string.privacy_backup_title,
            description = R.string.privacy_backup_body
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(id = R.string.privacy_screen_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = null)
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(id = R.string.privacy_screen_intro),
                style = MaterialTheme.typography.bodyMedium
            )

            points.forEach { point ->
                PrivacyCard(point)
            }
        }
    }
}

@Composable
private fun PrivacyCard(point: PrivacyPoint) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = point.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = stringResource(id = point.title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = stringResource(id = point.description),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

private data class PrivacyPoint(
    val icon: ImageVector,
    val title: Int,
    val description: Int
)
