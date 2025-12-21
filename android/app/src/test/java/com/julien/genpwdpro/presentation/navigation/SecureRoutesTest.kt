package com.julien.genpwdpro.presentation.navigation

import com.julien.genpwdpro.data.models.vault.EntryType
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SecureRoutesTest {

    @Test
    fun `dashboard route is sensitive`() {
        assertTrue(SecureRoutes.isSensitive(Screen.Dashboard.route))
    }

    @Test
    fun `create entry dynamic route is sensitive`() {
        val route = Screen.CreateEntry.createRoute("vault123", EntryType.LOGIN, password = "temp")
        assertTrue(SecureRoutes.isSensitive(route))
    }

    @Test
    fun `onboarding route is explicitly safe`() {
        assertFalse(SecureRoutes.isSensitive(Screen.Onboarding.route))
    }

    @Test
    fun `unknown routes fall back to secure`() {
        assertTrue(SecureRoutes.isSensitive("mystery_destination"))
    }
}
