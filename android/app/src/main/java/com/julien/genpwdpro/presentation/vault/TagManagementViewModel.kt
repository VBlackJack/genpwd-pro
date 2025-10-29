package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.db.dao.TagDao
import com.julien.genpwdpro.data.db.entity.EntryTagCrossRef
import com.julien.genpwdpro.data.db.entity.TagEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel pour la gestion des tags
 *
 * Gère :
 * - CRUD des tags
 * - Association tags ↔ entrées (many-to-many)
 * - Couleurs personnalisées
 * - Statistiques d'utilisation
 */
@HiltViewModel
class TagManagementViewModel @Inject constructor(
    private val tagDao: TagDao
) : ViewModel() {

    private val _uiState = MutableStateFlow<TagUiState>(TagUiState.Loading)
    val uiState: StateFlow<TagUiState> = _uiState.asStateFlow()

    /**
     * Charge tous les tags d'un vault
     */
    fun loadTags(vaultId: String) {
        viewModelScope.launch {
            try {
                tagDao.getTagsByVault(vaultId).collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    /**
     * Crée un nouveau tag
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
                tagDao.insert(tag)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de création")
            }
        }
    }

    /**
     * Met à jour un tag
     */
    fun updateTag(tag: TagEntity) {
        viewModelScope.launch {
            try {
                tagDao.update(tag)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de mise à jour")
            }
        }
    }

    /**
     * Supprime un tag
     *
     * Les associations avec les entrées sont supprimées automatiquement (CASCADE).
     */
    fun deleteTag(tagId: String) {
        viewModelScope.launch {
            try {
                tagDao.deleteById(tagId)
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de suppression")
            }
        }
    }

    /**
     * Ajoute un tag à une entrée
     */
    fun addTagToEntry(entryId: String, tagId: String) {
        viewModelScope.launch {
            try {
                tagDao.addTagToEntry(
                    EntryTagCrossRef(
                        entryId = entryId,
                        tagId = tagId
                    )
                )
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur d'ajout")
            }
        }
    }

    /**
     * Retire un tag d'une entrée
     */
    fun removeTagFromEntry(entryId: String, tagId: String) {
        viewModelScope.launch {
            try {
                tagDao.removeTagFromEntry(
                    EntryTagCrossRef(
                        entryId = entryId,
                        tagId = tagId
                    )
                )
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de retrait")
            }
        }
    }

    /**
     * Charge les statistiques des tags (nombre d'entrées par tag)
     */
    fun loadTagStatistics(vaultId: String) {
        viewModelScope.launch {
            try {
                tagDao.getTagsByVault(vaultId).collect { tags ->
                    val statistics = tags.map { tag ->
                        val count = tagDao.getEntryCountForTag(tag.id)
                        TagStatistic(tag, count)
                    }.sortedByDescending { it.count }

                    _uiState.value = TagUiState.SuccessWithStats(tags, statistics)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    /**
     * Charge les tags d'une entrée spécifique
     */
    fun loadTagsForEntry(entryId: String) {
        viewModelScope.launch {
            try {
                tagDao.getTagsForEntry(entryId).collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    /**
     * Recherche des tags par nom
     */
    fun searchTags(vaultId: String, query: String) {
        viewModelScope.launch {
            try {
                tagDao.searchTags(vaultId, "%$query%").collect { tags ->
                    _uiState.value = TagUiState.Success(tags)
                }
            } catch (e: Exception) {
                _uiState.value = TagUiState.Error(e.message ?: "Erreur de recherche")
            }
        }
    }
}

/**
 * Statistique d'un tag
 */
data class TagStatistic(
    val tag: TagEntity,
    val count: Int
)

/**
 * États UI pour la gestion des tags
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
