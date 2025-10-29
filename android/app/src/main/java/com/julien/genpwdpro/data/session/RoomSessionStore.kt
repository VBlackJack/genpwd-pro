package com.julien.genpwdpro.data.session

import com.julien.genpwdpro.data.session.db.SessionDao
import com.julien.genpwdpro.data.session.db.SessionEntity
import com.julien.genpwdpro.domain.session.SessionStore
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Singleton
class RoomSessionStore @Inject constructor(
    private val sessionDao: SessionDao,
    private val ioDispatcher: CoroutineDispatcher,
    @Named("session_cleanup_interval_ms") private val cleanupIntervalMillis: Long
) : SessionStore {

    private val cleanupScope = CoroutineScope(SupervisorJob() + ioDispatcher)

    init {
        cleanupScope.launch {
            cleanupExpiredLocked()
            if (cleanupIntervalMillis > 0) {
                while (isActive) {
                    delay(cleanupIntervalMillis)
                    cleanupExpiredLocked()
                }
            }
        }
    }

    override suspend fun read(sessionId: String): SessionStore.SessionState? =
        withContext(ioDispatcher) {
            cleanupExpiredLocked()
            sessionDao.getById(sessionId)?.toDomain()?.takeUnless { it.isExpired() }
        }

    override suspend fun readActive(): SessionStore.SessionState? =
        withContext(ioDispatcher) {
            cleanupExpiredLocked()
            sessionDao.getLatest()?.toDomain()?.takeUnless { it.isExpired() }
        }

    override fun observeActive(): Flow<SessionStore.SessionState?> {
        return sessionDao.observeLatest()
            .map { entity ->
                val state = entity?.toDomain()
                if (state != null && state.isExpired()) {
                    cleanupScope.launch { cleanupExpiredLocked() }
                    null
                } else {
                    state
                }
            }
            .distinctUntilChanged()
    }

    override suspend fun write(state: SessionStore.SessionState) {
        withContext(ioDispatcher) {
            cleanupExpiredLocked()
            sessionDao.upsert(state.toEntity())
        }
    }

    override suspend fun updateTimestamps(
        sessionId: String,
        lastAccessAtEpochMillis: Long,
        ttl: SessionStore.SessionTtlMetadata
    ): Boolean = withContext(ioDispatcher) {
        cleanupExpiredLocked()
        sessionDao.updateTimestamps(
            sessionId = sessionId,
            lastAccessAtEpochMillis = lastAccessAtEpochMillis,
            ttlMillis = ttl.ttlMillis,
            expiresAtEpochMillis = ttl.expiresAtEpochMillis,
            lastExtendedAtEpochMillis = ttl.lastExtendedAtEpochMillis
        ) > 0
    }

    override suspend fun remove(sessionId: String) {
        withContext(ioDispatcher) {
            sessionDao.delete(sessionId)
        }
    }

    override suspend fun clear() {
        withContext(ioDispatcher) {
            sessionDao.deleteAll()
        }
    }

    override suspend fun cleanupExpired(nowEpochMillis: Long): Int =
        withContext(ioDispatcher) {
            cleanupExpiredLocked(nowEpochMillis)
        }

    private suspend fun cleanupExpiredLocked(nowEpochMillis: Long = System.currentTimeMillis()): Int {
        return sessionDao.deleteExpired(nowEpochMillis)
    }

    private fun SessionEntity.toDomain(): SessionStore.SessionState {
        return SessionStore.SessionState(
            sessionId = sessionId,
            vaultId = vaultId,
            payload = payload.copyOf(),
            createdAtEpochMillis = createdAtEpochMillis,
            lastAccessAtEpochMillis = lastAccessAtEpochMillis,
            ttl = SessionStore.SessionTtlMetadata(
                ttlMillis = ttlMillis,
                expiresAtEpochMillis = expiresAtEpochMillis,
                lastExtendedAtEpochMillis = lastExtendedAtEpochMillis
            ),
            attributes = attributes
        )
    }

    private fun SessionStore.SessionState.toEntity(): SessionEntity {
        return SessionEntity(
            sessionId = sessionId,
            vaultId = vaultId,
            payload = payload.copyOf(),
            createdAtEpochMillis = createdAtEpochMillis,
            lastAccessAtEpochMillis = lastAccessAtEpochMillis,
            ttlMillis = ttl.ttlMillis,
            expiresAtEpochMillis = ttl.expiresAtEpochMillis,
            lastExtendedAtEpochMillis = ttl.lastExtendedAtEpochMillis,
            attributes = attributes
        )
    }
}
