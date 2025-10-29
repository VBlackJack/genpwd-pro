package com.julien.genpwdpro.presentation.navigation

/**
 * Central list of navigation destinations that should enforce FLAG_SECURE.
 *
 * The logic favours fail-safe defaults: any unknown or deep-linked route that contains
 * sensitive keywords will automatically be considered secure to support multi-window and
 * multi-backstack scenarios.
 */
object SecureRoutes {
    private val sensitivePatterns = setOf(
        Screen.Dashboard.route,
        Screen.Generator.route,
        Screen.History.route,
        Screen.Analyzer.route,
        Screen.CustomPhrase.route,
        Screen.SyncSettings.route,
        Screen.SyncHistory.route,
        Screen.AutofillSettings.route,
        Screen.SecuritySettings.route,
        Screen.VaultManager.route,
        Screen.VaultList.route,
        Screen.UnlockVault.route,
        Screen.SelectEntryType.route,
        Screen.CreateEntry.route,
        Screen.EditEntry.route,
        Screen.PresetManager.route,
        Screen.CreateVault.route,
        Screen.VaultSelector.route
    )

    private val explicitSafeRoutes = setOf(
        Screen.Onboarding.route
    ).map { it.lowercase() }.toSet()

    private val sensitiveBases: Set<String> = sensitivePatterns.flatMap { pattern ->
        listOf(
            pattern,
            pattern.substringBefore("?"),
            pattern.substringBefore("/{")
        ).map { it.lowercase() }
    }.filter { it.isNotBlank() }.toSet()

    private val fallbackKeywords = listOf(
        "vault",
        "password",
        "secret",
        "history",
        "sync",
        "autofill",
        "generator",
        "analyzer",
        "entry"
    )

    fun isSensitive(route: String?): Boolean {
        if (route.isNullOrBlank()) {
            return true
        }
        val canonical = canonicalize(route)
        if (explicitSafeRoutes.contains(canonical)) {
            return false
        }
        if (sensitiveBases.any { canonical.startsWith(it) }) {
            return true
        }
        if (fallbackKeywords.any { canonical.contains(it) }) {
            return true
        }
        // Fail-safe: treat unknown destinations as sensitive (multi-window, deep links, etc.)
        return true
    }

    private fun canonicalize(route: String): String {
        return route.substringBefore("?")
            .substringBefore("/{")
            .lowercase()
    }
}
