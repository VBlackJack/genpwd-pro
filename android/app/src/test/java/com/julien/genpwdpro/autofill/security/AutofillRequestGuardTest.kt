package com.julien.genpwdpro.autofill.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeClock : Clock {
    var now: Long = 0L
    override fun elapsedRealtime(): Long = now
}

private class FakeKeyguardChecker(var unlocked: Boolean = true) : KeyguardChecker {
    override fun isDeviceUnlocked(): Boolean = unlocked
}

private class FakePackageValidator(var validated: String? = null) : PackageValidator {
    override fun validate(packageName: String?): String? = validated
}

class AutofillRequestGuardTest {

    @Test
    fun `returns device locked when keyguard engaged`() {
        val guard = AutofillRequestGuard(
            keyguardChecker = FakeKeyguardChecker(unlocked = false),
            packageValidator = FakePackageValidator(validated = "com.example"),
            clock = FakeClock(),
            throttleWindowMs = 1000L,
            maxTrackedPackages = 4
        )

        val decision = guard.evaluate("com.example")

        assertTrue(decision is GuardDecision.DeviceLocked)
    }

    @Test
    fun `rejects when package validation fails`() {
        val guard = AutofillRequestGuard(
            keyguardChecker = FakeKeyguardChecker(unlocked = true),
            packageValidator = FakePackageValidator(validated = null),
            clock = FakeClock(),
            throttleWindowMs = 1000L,
            maxTrackedPackages = 4
        )

        val decision = guard.evaluate("com.unknown")

        assertTrue(decision is GuardDecision.UntrustedCaller)
    }

    @Test
    fun `throttles rapid successive requests`() {
        val clock = FakeClock()
        val guard = AutofillRequestGuard(
            keyguardChecker = FakeKeyguardChecker(unlocked = true),
            packageValidator = FakePackageValidator(validated = "com.example"),
            clock = clock,
            throttleWindowMs = 2000L,
            maxTrackedPackages = 4
        )

        val first = guard.evaluate("com.example")
        assertTrue(first is GuardDecision.Allowed)

        clock.now += 500L
        val second = guard.evaluate("com.example")
        assertTrue(second is GuardDecision.Throttled)

        clock.now += 3000L
        val third = guard.evaluate("com.example")
        assertTrue(third is GuardDecision.Allowed)
    }

    @Test
    fun `tracks most recent packages up to configured capacity`() {
        val clock = FakeClock()
        val guard = AutofillRequestGuard(
            keyguardChecker = FakeKeyguardChecker(unlocked = true),
            packageValidator = FakePackageValidator(validated = "pkg"),
            clock = clock,
            throttleWindowMs = 1L,
            maxTrackedPackages = 2
        )

        guard.evaluate("one")
        clock.now += 2L
        guard.evaluate("two")
        clock.now += 2L
        guard.evaluate("three")

        val tracked = guard.getTrackedPackages()
        assertEquals(2, tracked.size)
        assertTrue(tracked.contains("two"))
        assertTrue(tracked.contains("three"))
    }
}
