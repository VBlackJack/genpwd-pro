package com.julien.genpwdpro.ui.onboarding

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.accompanist.pager.*

/**
 * Onboarding Screen for GenPwd Pro
 *
 * Shows a series of introductory screens to new users
 * explaining the main features of the app.
 *
 * @param onFinish Callback when user completes or skips onboarding
 */
@OptIn(ExperimentalPagerApi::class)
@Composable
fun OnboardingScreen(
    onFinish: () -> Unit
) {
    val pagerState = rememberPagerState()

    val pages = remember {
        listOf(
            OnboardingPage(
                title = "Welcome to GenPwd Pro",
                description = "Generate secure, memorable passwords in seconds. No internet required, zero data collection.",
                icon = "🔐",
                color = Color(0xFF667EEA)
            ),
            OnboardingPage(
                title = "Choose Your Mode",
                description = "Syllables for pronounceable passwords, Passphrase for easy-to-remember phrases, or Leet speak for complexity.",
                icon = "🎯",
                color = Color(0xFF764BA2)
            ),
            OnboardingPage(
                title = "Encrypted Vault",
                description = "Store passwords securely with AES-256-GCM encryption and Argon2id key derivation. Everything stays on your device.",
                icon = "🗄️",
                color = Color(0xFF4FACFE)
            ),
            OnboardingPage(
                title = "Cloud Sync (Optional)",
                description = "End-to-end encrypted sync to Google Drive, Dropbox, or OneDrive. You control your data.",
                icon = "☁️",
                color = Color(0xFF00F2FE)
            ),
            OnboardingPage(
                title = "Import & Export",
                description = "Import from 1Password, LastPass, KeePass. Export to JSON, CSV, or KDBX for backup.",
                icon = "📦",
                color = Color(0xFF43E97B)
            ),
            OnboardingPage(
                title = "Privacy First",
                description = "100% offline. No tracking. No ads. No data collection. Open source. Your passwords, your control.",
                icon = "🛡️",
                color = Color(0xFF38F9D7)
            )
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Skip button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            contentAlignment = Alignment.TopEnd
        ) {
            TextButton(onClick = onFinish) {
                Text(
                    "Skip",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 16.sp
                )
            }
        }

        // Pager
        HorizontalPager(
            count = pages.size,
            state = pagerState,
            modifier = Modifier.weight(1f)
        ) { page ->
            OnboardingPageContent(pages[page])
        }

        // Page indicators
        HorizontalPagerIndicator(
            pagerState = pagerState,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .padding(16.dp),
            activeColor = MaterialTheme.colorScheme.primary,
            inactiveColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
        )

        // Bottom buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Previous button
            if (pagerState.currentPage > 0) {
                OutlinedButton(
                    onClick = {
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                            pagerState.animateScrollToPage(pagerState.currentPage - 1)
                        }
                    }
                ) {
                    Text("Previous")
                }
            } else {
                Spacer(modifier = Modifier.width(80.dp))
            }

            // Next or Finish button
            Button(
                onClick = {
                    if (pagerState.currentPage < pages.size - 1) {
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    } else {
                        onFinish()
                    }
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text(
                    if (pagerState.currentPage < pages.size - 1) "Next" else "Get Started",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun OnboardingPageContent(page: OnboardingPage) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icon
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .background(page.color.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = page.icon,
                fontSize = 64.sp
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Title
        Text(
            text = page.title,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Description
        Text(
            text = page.description,
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            textAlign = TextAlign.Center,
            lineHeight = 24.sp
        )
    }
}

/**
 * Data class representing an onboarding page
 */
data class OnboardingPage(
    val title: String,
    val description: String,
    val icon: String,
    val color: Color
)
