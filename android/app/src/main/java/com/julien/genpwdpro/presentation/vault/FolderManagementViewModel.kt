package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.data.models.vault.FolderEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel for folder management (file-based system)
 *
 * Handles:
 * - Folder CRUD operations
 * - Hierarchy (parent/child folders)
 * - Visual organization (icons, colors)
 * - Moving entries between folders
 *
 * Migrated to use FileVaultRepository
 */
@HiltViewModel
class FolderManagementViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FolderUiState>(FolderUiState.Loading)
    val uiState: StateFlow<FolderUiState> = _uiState.asStateFlow()

    /**
     * Loads all folders for a vault
     * Note: vaultId kept for backward compatibility, uses active session
     */
    fun loadFolders(vaultId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.getFolders().collect { folders ->
                    // Build hierarchy
                    val hierarchy = buildHierarchy(folders)
                    _uiState.value = FolderUiState.Success(folders, hierarchy)
                }
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Error loading folders")
            }
        }
    }

    /**
     * Creates a new folder
     */
    fun createFolder(
        vaultId: String,
        name: String,
        parentFolderId: String? = null,
        icon: String = "📁",
        color: String = "#2196F3"
    ) {
        viewModelScope.launch {
            try {
                val folder = FolderEntity(
                    id = UUID.randomUUID().toString(),
                    vaultId = vaultId,
                    parentFolderId = parentFolderId,
                    name = name,
                    icon = icon,
                    color = color,
                    createdAt = System.currentTimeMillis(),
                    modifiedAt = System.currentTimeMillis()
                )
                fileVaultRepository.addFolder(folder)
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Error creating folder")
            }
        }
    }

    /**
     * Updates a folder
     */
    fun updateFolder(folder: FolderEntity) {
        viewModelScope.launch {
            try {
                fileVaultRepository.updateFolder(folder.copy(modifiedAt = System.currentTimeMillis()))
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Error updating folder")
            }
        }
    }

    /**
     * Deletes a folder
     *
     * Entries in the folder are not deleted, just moved to root.
     */
    fun deleteFolder(folderId: String) {
        viewModelScope.launch {
            try {
                fileVaultRepository.deleteFolder(folderId)
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Error deleting folder")
            }
        }
    }

    /**
     * Moves a folder to a different parent
     */
    fun moveFolder(folderId: String, newParentId: String?) {
        viewModelScope.launch {
            try {
                val folder = fileVaultRepository.getFolderById(folderId)
                if (folder != null) {
                    // Check that we don't create a loop
                    if (newParentId != null && isDescendant(newParentId, folderId)) {
                        _uiState.value = FolderUiState.Error("Cannot move: would create a loop")
                        return@launch
                    }

                    fileVaultRepository.updateFolder(
                        folder.copy(
                            parentFolderId = newParentId,
                            modifiedAt = System.currentTimeMillis()
                        )
                    )
                }
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Error moving folder")
            }
        }
    }

    /**
     * Construit la hiérarchie des dossiers
     */
    private fun buildHierarchy(folders: List<FolderEntity>): List<FolderNode> {
        val folderMap = folders.associateBy { it.id }
        val rootFolders = folders.filter { it.parentFolderId == null }

        fun buildNode(folder: FolderEntity): FolderNode {
            val children = folders
                .filter { it.parentFolderId == folder.id }
                .map { buildNode(it) }
                .sortedBy { it.folder.name }

            return FolderNode(
                folder = folder,
                children = children,
                level = calculateLevel(folder, folderMap)
            )
        }

        return rootFolders
            .map { buildNode(it) }
            .sortedBy { it.folder.name }
    }

    /**
     * Calcule le niveau d'un dossier dans la hiérarchie
     */
    private fun calculateLevel(folder: FolderEntity, folderMap: Map<String, FolderEntity>): Int {
        var level = 0
        var currentFolder = folder

        while (currentFolder.parentFolderId != null) {
            val parent = folderMap[currentFolder.parentFolderId] ?: break
            level++
            currentFolder = parent
        }

        return level
    }

    /**
     * Checks if a folder is a descendant of another
     */
    private suspend fun isDescendant(folderId: String, potentialAncestorId: String): Boolean {
        var currentFolder = fileVaultRepository.getFolderById(folderId)

        while (currentFolder != null) {
            if (currentFolder.id == potentialAncestorId) return true
            currentFolder = currentFolder.parentFolderId?.let { fileVaultRepository.getFolderById(it) }
        }

        return false
    }
}

/**
 * Nœud dans l'arbre de hiérarchie des dossiers
 */
data class FolderNode(
    val folder: FolderEntity,
    val children: List<FolderNode>,
    val level: Int
)

/**
 * États UI pour la gestion des dossiers
 */
sealed class FolderUiState {
    object Loading : FolderUiState()
    data class Success(
        val folders: List<FolderEntity>,
        val hierarchy: List<FolderNode>
    ) : FolderUiState()
    data class Error(val message: String) : FolderUiState()
}
