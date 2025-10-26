package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.dao.FolderDao
import com.julien.genpwdpro.data.local.entity.FolderEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel pour la gestion des dossiers
 *
 * Gère :
 * - CRUD des dossiers
 * - Hiérarchie (dossiers parents/enfants)
 * - Organisation visuelle (icônes, couleurs)
 * - Déplacement d'entrées entre dossiers
 */
@HiltViewModel
class FolderManagementViewModel @Inject constructor(
    private val folderDao: FolderDao
) : ViewModel() {

    private val _uiState = MutableStateFlow<FolderUiState>(FolderUiState.Loading)
    val uiState: StateFlow<FolderUiState> = _uiState.asStateFlow()

    /**
     * Charge tous les dossiers d'un vault
     */
    fun loadFolders(vaultId: String) {
        viewModelScope.launch {
            try {
                folderDao.getFoldersByVault(vaultId).collect { folders ->
                    // Construire la hiérarchie
                    val hierarchy = buildHierarchy(folders)
                    _uiState.value = FolderUiState.Success(folders, hierarchy)
                }
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    /**
     * Crée un nouveau dossier
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
                folderDao.insert(folder)
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Erreur de création")
            }
        }
    }

    /**
     * Met à jour un dossier
     */
    fun updateFolder(folder: FolderEntity) {
        viewModelScope.launch {
            try {
                folderDao.update(folder.copy(modifiedAt = System.currentTimeMillis()))
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Erreur de mise à jour")
            }
        }
    }

    /**
     * Supprime un dossier
     *
     * Les entrées du dossier ne sont pas supprimées, juste déplacées vers la racine.
     */
    fun deleteFolder(folderId: String) {
        viewModelScope.launch {
            try {
                folderDao.deleteById(folderId)
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Erreur de suppression")
            }
        }
    }

    /**
     * Déplace un dossier dans un autre parent
     */
    fun moveFolder(folderId: String, newParentId: String?) {
        viewModelScope.launch {
            try {
                val folder = folderDao.getById(folderId)
                if (folder != null) {
                    // Vérifier qu'on ne crée pas une boucle
                    if (newParentId != null && isDescendant(newParentId, folderId)) {
                        _uiState.value = FolderUiState.Error("Impossible: cela créerait une boucle")
                        return@launch
                    }

                    folderDao.update(
                        folder.copy(
                            parentFolderId = newParentId,
                            modifiedAt = System.currentTimeMillis()
                        )
                    )
                }
            } catch (e: Exception) {
                _uiState.value = FolderUiState.Error(e.message ?: "Erreur de déplacement")
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
     * Vérifie si un dossier est un descendant d'un autre
     */
    private suspend fun isDescendant(folderId: String, potentialAncestorId: String): Boolean {
        var currentFolder = folderDao.getFolderById(folderId)

        while (currentFolder != null) {
            if (currentFolder.id == potentialAncestorId) return true
            currentFolder = currentFolder.parentFolderId?.let { folderDao.getFolderById(it) }
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
