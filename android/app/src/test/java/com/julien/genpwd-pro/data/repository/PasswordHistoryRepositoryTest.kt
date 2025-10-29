package com.julien.genpwd-pro.data.repository

import com.google.gson.Gson
import com.julien.genpwd-pro.data.db.dao.PasswordHistoryDao
import com.julien.genpwd-pro.data.db.entity.PasswordHistoryEntity
import com.julien.genpwd-pro.data.models.GenerationMode
import com.julien.genpwd-pro.data.models.PasswordResult
import com.julien.genpwd-pro.data.models.PasswordStrength
import com.julien.genpwd-pro.data.models.Settings
import io.mockk.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests pour PasswordHistoryRepository
 */
class PasswordHistoryRepositoryTest {

    private lateinit var dao: PasswordHistoryDao
    private lateinit var gson: Gson
    private lateinit var repository: PasswordHistoryRepository

    @Before
    fun setup() {
        dao = mockk(relaxed = true)
        gson = Gson()
        repository = PasswordHistoryRepository(dao, gson)
    }

    @Test
    fun `getHistory returns mapped results`() = runBlocking {
        val entities = listOf(
            createEntity("1", "password1"),
            createEntity("2", "password2")
        )
        every { dao.getHistoryWithLimit(100) } returns flowOf(entities)

        val results = repository.getHistory().first()

        assertEquals(2, results.size)
        assertEquals("password1", results[0].password)
        assertEquals("password2", results[1].password)
    }

    @Test
    fun `searchHistory filters results correctly`() = runBlocking {
        val entities = listOf(
            createEntity("1", "password123")
        )
        every { dao.searchHistory("123") } returns flowOf(entities)

        val results = repository.searchHistory("123").first()

        assertEquals(1, results.size)
        assertEquals("password123", results[0].password)
        verify { dao.searchHistory("123") }
    }

    @Test
    fun `savePassword inserts entity`() = runBlocking {
        val result = createPasswordResult("1", "test")
        coEvery { dao.getCount() } returns 50

        repository.savePassword(result)

        coVerify { dao.insert(any()) }
    }

    @Test
    fun `savePassword cleans up old entries when exceeding limit`() = runBlocking {
        val result = createPasswordResult("1", "test")
        coEvery { dao.getCount() } returns 110 // Over MAX_HISTORY_SIZE (100)

        repository.savePassword(result)

        coVerify { dao.deleteOldest(10) } // 110 - 100 = 10
    }

    @Test
    fun `savePassword does not cleanup when under limit`() = runBlocking {
        val result = createPasswordResult("1", "test")
        coEvery { dao.getCount() } returns 50

        repository.savePassword(result)

        coVerify(exactly = 0) { dao.deleteOldest(any()) }
    }

    @Test
    fun `savePasswords inserts multiple entities`() = runBlocking {
        val results = listOf(
            createPasswordResult("1", "test1"),
            createPasswordResult("2", "test2"),
            createPasswordResult("3", "test3")
        )
        coEvery { dao.getCount() } returns 50

        repository.savePasswords(results)

        coVerify { dao.insertAll(match { it.size == 3 }) }
    }

    @Test
    fun `savePasswords cleans up when batch causes overflow`() = runBlocking {
        val results = listOf(
            createPasswordResult("1", "test1"),
            createPasswordResult("2", "test2")
        )
        coEvery { dao.getCount() } returns 105

        repository.savePasswords(results)

        coVerify { dao.deleteOldest(5) }
    }

    @Test
    fun `deletePassword calls dao deleteById`() = runBlocking {
        repository.deletePassword("test-id")

        coVerify { dao.deleteById("test-id") }
    }

    @Test
    fun `clearHistory calls dao deleteAll`() = runBlocking {
        repository.clearHistory()

        coVerify { dao.deleteAll() }
    }

    @Test
    fun `getCount returns dao count`() = runBlocking {
        coEvery { dao.getCount() } returns 42

        val count = repository.getCount()

        assertEquals(42, count)
        coVerify { dao.getCount() }
    }

    @Test
    fun `entity to PasswordResult conversion preserves data`() = runBlocking {
        val entity = createEntity("test-id", "TestPassword123")
        every { dao.getHistoryWithLimit(100) } returns flowOf(listOf(entity))

        val results = repository.getHistory().first()

        assertEquals("test-id", results[0].id)
        assertEquals("TestPassword123", results[0].password)
        assertEquals(GenerationMode.SYLLABLES, results[0].mode)
        assertTrue(results[0].isMasked) // Always masked from repository
    }

    @Test
    fun `PasswordResult to entity conversion preserves data`() = runBlocking {
        val result = createPasswordResult("test-id", "TestPassword123")
        val capturedEntity = slot<PasswordHistoryEntity>()

        coEvery { dao.insert(capture(capturedEntity)) } returns Unit
        coEvery { dao.getCount() } returns 50

        repository.savePassword(result)

        assertEquals("test-id", capturedEntity.captured.id)
        assertEquals("TestPassword123", capturedEntity.captured.password)
        assertEquals("SYLLABLES", capturedEntity.captured.mode)
        assertTrue(capturedEntity.captured.settingsJson.contains("\"mode\":\"SYLLABLES\""))
    }

    @Test
    fun `repository maintains MAX_HISTORY_SIZE limit of 100`() = runBlocking {
        val results = (1..150).map { createPasswordResult("id$it", "pass$it") }
        coEvery { dao.getCount() } returns 150

        repository.savePasswords(results)

        // Devrait supprimer 50 anciennes entrées (150 - 100)
        coVerify { dao.deleteOldest(50) }
    }

    // Helper functions

    private fun createEntity(id: String, password: String): PasswordHistoryEntity {
        val settings = Settings(mode = GenerationMode.SYLLABLES)
        return PasswordHistoryEntity(
            id = id,
            password = password,
            entropy = 64.0,
            mode = "SYLLABLES",
            timestamp = System.currentTimeMillis(),
            settingsJson = gson.toJson(settings)
        )
    }

    private fun createPasswordResult(id: String, password: String): PasswordResult {
        return PasswordResult(
            id = id,
            password = password,
            entropy = 64.0,
            mode = GenerationMode.SYLLABLES,
            timestamp = System.currentTimeMillis(),
            settings = Settings(mode = GenerationMode.SYLLABLES),
            isMasked = false
        )
    }
}
