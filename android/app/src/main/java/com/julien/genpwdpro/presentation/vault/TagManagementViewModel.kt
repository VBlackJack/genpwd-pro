package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.data.models.vault.TagEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel for tag management (file-based system)
 *
 * Handles:
 * - Tag CRUD operations
 * - Tag ↔ entry associations (many-to-many)
 * - Custom colors
 * - Usage statistics
 *
 * Migrated to use FileVaultRepository
 */
@HiltViewModel
class TagManagementViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<TagUiState>(TagUiState.Loading)
    val uiState: StateFlow<TagUiState> = _uiState.asStateFlow()

    /**
     * Loads all tags for a vault
     * Note: vaultId kept for backward compatibility, uses active session
     */
    fun loadTags(vaultId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.getTags().collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error loading tags")
            }
        }
    }

    /**
     * Creates a new tag
     */
    fun createTag(
        vaultId: String,
        name: String,
        color: String = "#2196F3"
    ) {
        viewModelScope.launch {
            try {
                val tag = TagEntity(
                    id = UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    name = name,
                    color = color,
                    createdAt = System.currentTimeMillis()
                )
                fileVaultRepository.addTag(tag)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error creating tag")
            }
        }
    }

    /**
     * Updates a tag
     */
    fun updateTag(tag: TagEntity) {
        viewModelScope.launch {
            try {
                fileVaultRepository.updateTag(tag)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error updating tag")
            }
        }
    }

    /**
     * Deletes a tag
     *
     * Entry associations are removed automatically.
     */
    fun deleteTag(tagId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.deleteTag(tagId)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error deleting tag")
            }
        }
    }

    /**
     * Adds a tag to an entry
     */
    fun addTagToEntry(entryId: String, tagId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.addTagToEntry(entryId, tagId)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error adding tag to entry")
            }
        }
    }

    /**
     * Removes a tag from an entry
     */
    fun removeTagFromEntry(entryId: String, tagId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.removeTagFromEntry(entryId, tagId)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error removing tag from entry")
            }
        }
    }

    /**
     * Loads tag statistics (entry count per tag)
     */
    fun loadTagStatistics(vaultId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.getTags().collect { tags ->
                    val statistics = tags.map { tag ->
                        val count = fileVaultRepository.getEntryCountForTag(tag.id)
                        TagStatistic(tag, count)
                    }.sortedByDescending { it.count }

                    _uiState.value = TagUiState.SuccessWithStats(tags, statistics)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error loading statistics")
            }
        }
    }

    /**
     * Loads tags for a specific entry
     */
    fun loadTagsForEntry(entryId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.getTagsForEntry(entryId).collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error loading tags")
            }
        }
    }

    /**
     * Searches tags by name
     */
    fun searchTags(vaultId: String, query: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.searchTags(query).collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Error searching tags")
            }
        }
    }
}

/**
 * Tag statistic
 */
data class TagStatistic(
    val tag: TagEntity,
    val count: Int
)

/**
 * UI states for tag management
 */
sealed class TagUiState {
    object Loading : TagUiState()
    data class Success(val tags: List<TagEntity>) : TagUiState()
    data class SuccessWithStats(
        val tags: List<TagEntity>,
        val statistics: List<TagStatistic>
    ) : TagUiState()
    data class Error(val message: String) : TagUiState()
}
