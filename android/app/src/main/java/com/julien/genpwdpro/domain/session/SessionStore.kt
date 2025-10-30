package com.julien.genpwdpro.domain.session

import kotlinx.coroutines.flow.Flow

/**
 * Abstraction for persisting vault session state outside of memory.
 *
 * The store keeps track of session metadata for expiration and bookkeeping.
 * Any secret payloads are kept in memory-only containers.
 */
interface SessionStore {

    /**
     * Metadata describing the time-to-live of a persisted session.
     *
     * @param ttlMillis Requested TTL duration in milliseconds.
     * @param expiresAtEpochMillis Epoch timestamp when the session expires.
     * @param lastExtendedAtEpochMillis Epoch timestamp when the TTL was last refreshed.
     */
    data class SessionTtlMetadata(
        val ttlMillis: Long,
        val expiresAtEpochMillis: Long,
        val lastExtendedAtEpochMillis: Long
    ) {
        init {
            require(ttlMillis > 0) { "ttlMillis must be strictly positive" }
        }

        /**
         * Returns `true` if the session is considered expired for the provided reference time.
         */
        fun isExpired(referenceTimeMillis: Long = System.currentTimeMillis()): Boolean =
            referenceTimeMillis >= expiresAtEpochMillis

        /**
         * Returns the remaining time before the session expires.
         */
        fun remainingTime(referenceTimeMillis: Long = System.currentTimeMillis()): Long =
            (expiresAtEpochMillis - referenceTimeMillis).coerceAtLeast(0L)
    }

    /**
     * Representation of a persisted session entry.
     */
    data class SessionState(
        val sessionId: String,
        val vaultId: String,
        val createdAtEpochMillis: Long,
        val lastAccessAtEpochMillis: Long,
        val ttl: SessionTtlMetadata,
        val attributes: Map<String, String> = emptyMap()
    ) {
        init {
            require(sessionId.isNotBlank()) { "sessionId must not be blank" }
            require(vaultId.isNotBlank()) { "vaultId must not be blank" }
        }

        val expiresAtEpochMillis: Long
            get() = ttl.expiresAtEpochMillis

        fun isExpired(referenceTimeMillis: Long = System.currentTimeMillis()): Boolean =
            ttl.isExpired(referenceTimeMillis)
    }

    /**
     * Returns a session by identifier or `null` if it is not stored.
     */
    suspend fun read(sessionId: String): SessionState?

    /**
     * Returns the most recently accessed (and non-expired) session.
     */
    suspend fun readActive(): SessionState?

    /**
     * Observe the most recent session entry.
     */
    fun observeActive(): Flow<SessionState?>

    /**
     * Persist or replace a session entry.
     */
    suspend fun write(state: SessionState)

    /**
     * Update timestamps and TTL metadata for an existing session.
     */
    suspend fun updateTimestamps(
        sessionId: String,
        lastAccessAtEpochMillis: Long,
        ttl: SessionTtlMetadata
    ): Boolean

    /**
     * Remove a session from the store.
     */
    suspend fun remove(sessionId: String)

    /**
     * Clear every persisted session.
     */
    suspend fun clear()

    /**
     * Delete expired sessions and return the number of rows that were removed.
     */
    suspend fun cleanupExpired(nowEpochMillis: Long = System.currentTimeMillis()): Int
}
