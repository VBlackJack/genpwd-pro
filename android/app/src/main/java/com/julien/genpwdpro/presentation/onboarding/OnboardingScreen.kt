package com.julien.genpwdpro.presentation.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.accompanist.pager.*

/**
 * Écran d'onboarding en 3 pages
 */
@OptIn(ExperimentalPagerApi::class, ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState()
    val pages = listOf(
        OnboardingPage(
            title = "Bienvenue sur GenPwd Pro",
            description = "Générez des mots de passe sécurisés avec plusieurs modes : syllabes, passphrase, ou leet speak.",
            icon = Icons.Default.Lock,
            color = MaterialTheme.colorScheme.primary
        ),
        OnboardingPage(
            title = "Comprendre la force",
            description = "L'entropie mesure la force de votre mot de passe en bits. Plus c'est élevé, plus c'est sécurisé.\n\n• <40 bits = Faible\n• 60-80 bits = Moyen\n• 80-100 bits = Fort\n• >100 bits = Très fort",
            icon = Icons.Default.Shield,
            color = MaterialTheme.colorScheme.tertiary
        ),
        OnboardingPage(
            title = "Fonctionnalités avancées",
            description = "• Widget écran d'accueil\n• Raccourcis rapides\n• Copie sécurisée (60s)\n• Historique local\n• 5 langues supportées",
            icon = Icons.Default.Star,
            color = MaterialTheme.colorScheme.secondary
        )
    )

    Scaffold(
        bottomBar = {
            OnboardingBottomBar(
                currentPage = pagerState.currentPage,
                totalPages = pages.size,
                onSkip = onComplete,
                onNext = {
                    if (pagerState.currentPage < pages.size - 1) {
                        // Page suivante
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    } else {
                        // Terminer
                        onComplete()
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
        }
    ) { padding ->
        HorizontalPager(
            count = pages.size,
            state = pagerState,
            modifier = modifier
                .fillMaxSize()
                .padding(padding)
        ) { page ->
            OnboardingPageContent(
                page = pages[page],
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

/**
 * Contenu d'une page d'onboarding
 */
@Composable
private fun OnboardingPageContent(
    page: OnboardingPage,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icône
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .background(page.color.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = page.icon,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = page.color
            )
        }

        Spacer(modifier = Modifier.height(48.dp))

        // Titre
        Text(
            text = page.title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Description
        Text(
            text = page.description,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp)
        )
    }
}

/**
 * Barre de navigation en bas
 */
@Composable
private fun OnboardingBottomBar(
    currentPage: Int,
    totalPages: Int,
    onSkip: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 3.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Bouton Skip (seulement si pas dernière page)
            if (currentPage < totalPages - 1) {
                TextButton(onClick = onSkip) {
                    Text("Passer")
                }
            } else {
                Spacer(modifier = Modifier.width(72.dp))
            }

            // Indicateurs de page
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(totalPages) { index ->
                    PageIndicator(
                        isActive = index == currentPage,
                        color = if (index == currentPage)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                    )
                }
            }

            // Bouton Next / Terminer
            Button(
                onClick = onNext,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text(
                    text = if (currentPage < totalPages - 1) "Suivant" else "Commencer",
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    }
}

/**
 * Indicateur de page (point)
 */
@Composable
private fun PageIndicator(
    isActive: Boolean,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(if (isActive) 12.dp else 8.dp)
            .clip(CircleShape)
            .background(color)
    )
}

/**
 * Modèle de données pour une page d'onboarding
 */
private data class OnboardingPage(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val color: androidx.compose.ui.graphics.Color
)
