package com.julien.genpwdpro.presentation.navigation

/**
 * Central list of navigation destinations that should enforce FLAG_SECURE.
 */
object SecureRoutes {
    private val sensitivePatterns = setOf(
        Screen.Dashboard.route,
        Screen.Generator.route,
        Screen.History.route,
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

    private val sensitiveBases: Set<String> = sensitivePatterns.flatMap { pattern ->
        listOf(
            pattern,
            pattern.substringBefore("?"),
            pattern.substringBefore("/{")
        )
    }.filter { it.isNotBlank() }.toSet()

    fun isSensitive(route: String?): Boolean {
        if (route.isNullOrBlank()) {
            return false
        }
        return sensitiveBases.any { base -> route.startsWith(base) }
    }
}
