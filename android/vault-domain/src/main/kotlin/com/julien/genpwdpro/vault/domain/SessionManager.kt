package com.julien.genpwdpro.vault.domain

/**
 * Tracks the lifecycle of an authenticated session with the vault.
 */
interface SessionManager {
    fun startSession(masterKey: ByteArray)
    fun endSession()
    fun isSessionActive(): Boolean
    fun getMasterKey(): ByteArray?
}
