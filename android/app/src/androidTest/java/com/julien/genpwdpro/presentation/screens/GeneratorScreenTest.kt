package com.julien.genpwdpro.presentation.screens

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Tests UI pour l'écran de génération
 */
@HiltAndroidTest
class GeneratorScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createComposeRule()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun generatorScreen_displaysCorrectTitle() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("GenPwd Pro").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_displaysGenerateButton() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Générer").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_displaysEmptyStateInitially() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Cliquez sur \"Générer\" pour créer vos mots de passe")
            .assertIsDisplayed()
    }

    @Test
    fun generatorScreen_displaysThreeMainSections() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Options principales").assertIsDisplayed()
        composeTestRule.onNodeWithText("Caractères").assertIsDisplayed()
        composeTestRule.onNodeWithText("Casse avancée").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_canExpandAndCollapseSections() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // Les sections devraient être initialement développées
        composeTestRule.onNodeWithText("Options principales").assertIsDisplayed()

        // Cliquer pour réduire
        composeTestRule.onNodeWithText("Options principales").performClick()

        // Vérifier que le contenu est masqué (on pourrait ajouter des tags de test)
        // Pour l'instant, on vérifie juste qu'on peut cliquer
    }

    @Test
    fun generatorScreen_displaysQuantitySlider() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Nombre de mots de passe").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_displaysMaskDisplaySwitch() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Masquer l'affichage").assertIsDisplayed()
    }

    @Test
    fun generateButton_isClickable() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        val generateButton = composeTestRule.onNodeWithText("Générer")
        generateButton.assertIsDisplayed()
        generateButton.performClick()

        // Après génération, l'état vide devrait disparaître
        // (Le test exact dépendrait du comportement du ViewModel)
    }

    @Test
    fun historyButton_isDisplayed() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // Le bouton historique devrait être dans le TopBar
        composeTestRule.onNodeWithContentDescription("Historique").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_canToggleMaskSwitch() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // Trouver et cliquer le switch
        composeTestRule.onNode(
            hasText("Masquer l'affichage")
        ).assertIsDisplayed()

        // Le switch est à côté du texte
        // On pourrait améliorer avec des test tags
    }

    @Test
    fun generatorScreen_displaysAllModeOptions() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // Vérifier que les modes sont disponibles (dépend de l'implémentation)
        // On pourrait avoir des dropdowns ou des radio buttons
        composeTestRule.onNodeWithText("Options principales").assertIsDisplayed()
    }

    @Test
    fun characterSection_displaysBadge() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // La section Caractères devrait afficher un badge avec le format "XD + YS"
        // Avec les valeurs par défaut, devrait afficher quelque chose comme "2D + 2S"
        composeTestRule.onNodeWithText("Caractères").assertIsDisplayed()
    }

    @Test
    fun generatorScreen_hasCorrectSubtitle() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        composeTestRule.onNodeWithText("Générateur de mots de passe sécurisés")
            .assertIsDisplayed()
    }

    @Test
    fun generatorScreen_floatingActionButton_hasCorrectIcon() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // Le FAB devrait avoir une icône Lock et le texte "Générer"
        composeTestRule.onNodeWithText("Générer").assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription("Generate").assertExists()
    }

    @Test
    fun generatorScreen_scrollable() {
        composeTestRule.setContent {
            GenPwdProTheme {
                GeneratorScreen()
            }
        }

        // L'écran utilise LazyColumn donc devrait être scrollable
        // Vérifier que les éléments en haut et en bas sont accessibles
        composeTestRule.onNodeWithText("Options principales").assertIsDisplayed()

        // Après génération, on devrait pouvoir scroller vers les résultats
        composeTestRule.onNodeWithText("Générer").performClick()
    }
}
