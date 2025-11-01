package com.julien.genpwdpro.presentation.screens.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.sync.SyncHistoryEntry
import com.julien.genpwdpro.data.sync.SyncManager
import com.julien.genpwdpro.data.sync.SyncPreferencesManager
import com.julien.genpwdpro.data.sync.SyncStatistics
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class SyncHistoryViewModel @Inject constructor(
    private val syncManager: SyncManager,
    private val preferencesManager: SyncPreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(SyncHistoryUiState())
    val uiState: StateFlow<SyncHistoryUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val statistics = preferencesManager.getSyncStatistics()
            val metadata = runCatching { syncManager.getMetadata() }

            _uiState.update { state ->
                val history = metadata.getOrNull()?.history.orEmpty()
                state.copy(
                    isLoading = false,
                    statistics = statistics,
                    history = history,
                    errorMessage = metadata.exceptionOrNull()?.message
                )
            }
        }
    }
}

data class SyncHistoryUiState(
    val isLoading: Boolean = true,
    val statistics: SyncStatistics? = null,
    val history: List<SyncHistoryEntry> = emptyList(),
    val errorMessage: String? = null
)
