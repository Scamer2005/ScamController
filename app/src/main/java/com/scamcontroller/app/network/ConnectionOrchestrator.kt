package com.scamcontroller.app.network

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.scamcontroller.app.data.AuthMethod
import com.scamcontroller.app.data.CraftyServer
import com.scamcontroller.app.data.CraftyUser
import com.scamcontroller.app.data.CredentialStore
import com.scamcontroller.app.data.ScheduledTask
import com.scamcontroller.app.data.ServerBackup
import com.scamcontroller.app.data.ServerConfig
import com.scamcontroller.app.data.ServerFileEntry
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class ActiveRoute { NONE, LAN, TAILSCALE }

enum class DashboardTab { OVERVIEW, CONSOLE, FILES, BACKUPS, SCHEDULES, PLAYERS, USERS, CONFIG }

sealed interface ConnectionPhase {
    data object Idle : ConnectionPhase
    data class ProbingLan(val url: String) : ConnectionPhase
    data object TriggeringTailscale : ConnectionPhase
    data class WaitingForVpn(val detail: String) : ConnectionPhase
    data class Authenticating(val targetUrl: String, val route: ActiveRoute) : ConnectionPhase
    data class ReadyDashboard(val targetUrl: String, val route: ActiveRoute) : ConnectionPhase
    data class ErrorUnreachable(val detail: String, val tailscaleInstalled: Boolean) : ConnectionPhase
}

data class ConnectionUiState(
    val config: ServerConfig,
    val phase: ConnectionPhase = ConnectionPhase.Idle,
    val activeRoute: ActiveRoute = ActiveRoute.NONE,
    val lastLatencyMs: Long? = null,
    val statusBanner: String? = null,
    val selectedTab: DashboardTab = DashboardTab.OVERVIEW,
    val servers: List<CraftyServer> = emptyList(),
    val selectedServerId: String = "",
    val logs: List<String> = emptyList(),
    val files: List<ServerFileEntry> = emptyList(),
    val currentDir: String = "",
    val openedFilePath: String? = null,
    val openedFileContent: String = "",
    val backups: List<ServerBackup> = emptyList(),
    val tasks: List<ScheduledTask> = emptyList(),
    val users: List<CraftyUser> = emptyList(),
    val isBusy: Boolean = false
) {
    val activeServer: CraftyServer?
        get() = servers.firstOrNull { it.serverId == selectedServerId } ?: servers.firstOrNull()
}

class ConnectionOrchestrator(application: Application) : AndroidViewModel(application) {

    private val store = CredentialStore(application)
    private val prober = ReachabilityProber()
    private val tailscale = TailscaleManager(application)

    private val _uiState = MutableStateFlow(ConnectionUiState(config = store.load()))
    val uiState: StateFlow<ConnectionUiState> = _uiState.asStateFlow()

    private var connectJob: Job? = null
    private var pollJob: Job? = null
    private var apiClient: CraftyApiClient? = null

    init {
        startConnectionSequence()
    }

    fun updateConfig(updated: ServerConfig, reconnectNow: Boolean = true) {
        store.save(updated)
        _uiState.update { it.copy(config = updated, statusBanner = null) }
        if (reconnectNow) startConnectionSequence()
    }

    fun clearCredentials() {
        store.clear()
        _uiState.update { it.copy(config = ServerConfig(), statusBanner = "Stored credentials cleared.") }
    }

    fun selectTab(tab: DashboardTab) {
        _uiState.update { it.copy(selectedTab = tab) }
        refreshActiveTabData()
    }

    fun selectServer(serverId: String) {
        _uiState.update { it.copy(selectedServerId = serverId, currentDir = "", openedFilePath = null) }
        refreshActiveTabData()
    }

    fun startConnectionSequence() {
        connectJob?.cancel()
        pollJob?.cancel()
        connectJob = viewModelScope.launch {
            val cfg = _uiState.value.config
            _uiState.update { it.copy(statusBanner = null, activeRoute = ActiveRoute.NONE) }

            if (cfg.localUrl.isNotBlank()) {
                _uiState.update { it.copy(phase = ConnectionPhase.ProbingLan(cfg.localUrl)) }
                val lanResult = prober.probe(cfg.localUrl, cfg.lanTimeoutMs, cfg.allowSelfSignedCert)
                if (lanResult is ProbeResult.Reachable) {
                    authenticateAndStart(cfg.localUrl, ActiveRoute.LAN, lanResult.latencyMs, cfg)
                    return@launch
                }
            }

            if (cfg.tailscaleUrl.isBlank()) {
                _uiState.update {
                    it.copy(
                        phase = ConnectionPhase.ErrorUnreachable(
                            detail = "Local server unreachable and no Tailscale URL configured.",
                            tailscaleInstalled = tailscale.isTailscaleInstalled()
                        )
                    )
                }
                return@launch
            }

            if (!tailscale.isTailscaleInstalled()) {
                _uiState.update {
                    it.copy(
                        phase = ConnectionPhase.ErrorUnreachable(
                            detail = "Tailscale Android app (com.tailscale.ipn) is not installed.",
                            tailscaleInstalled = false
                        )
                    )
                }
                return@launch
            }

            if (!tailscale.isVpnTransportActive()) {
                _uiState.update { it.copy(phase = ConnectionPhase.TriggeringTailscale) }
                tailscale.sendConnectBroadcast()
            }

            _uiState.update { it.copy(phase = ConnectionPhase.WaitingForVpn("Connecting Tailscale VPN...")) }
            val tsResult = tailscale.waitForVpnAndReachability(
                tailscaleUrl = cfg.tailscaleUrl,
                timeoutMs = cfg.vpnConnectTimeoutMs,
                allowSelfSignedCert = cfg.allowSelfSignedCert,
                prober = prober,
                onStatusTick = { status ->
                    _uiState.update { it.copy(phase = ConnectionPhase.WaitingForVpn(status)) }
                }
            )

            when (tsResult) {
                is ProbeResult.Reachable -> authenticateAndStart(cfg.tailscaleUrl, ActiveRoute.TAILSCALE, tsResult.latencyMs, cfg)
                is ProbeResult.Unreachable -> _uiState.update {
                    it.copy(phase = ConnectionPhase.ErrorUnreachable(tsResult.reason, tailscaleInstalled = true))
                }
            }
        }
    }

    private suspend fun authenticateAndStart(
        targetUrl: String,
        route: ActiveRoute,
        latencyMs: Long,
        cfg: ServerConfig
    ) {
        _uiState.update {
            it.copy(
                phase = ConnectionPhase.Authenticating(targetUrl, route),
                activeRoute = route,
                lastLatencyMs = latencyMs
            )
        }

        val token = if (cfg.authMethod == AuthMethod.TOKEN && cfg.apiToken.isNotBlank()) {
            cfg.apiToken.trim()
        } else {
            val tempClient = CraftyApiClient(targetUrl, "", cfg.allowSelfSignedCert)
            val login = tempClient.login(cfg.username, cfg.password)
            login.getOrElse { err ->
                _uiState.update {
                    it.copy(
                        phase = ConnectionPhase.ErrorUnreachable(
                            detail = "Crafty login failed: ${err.message}",
                            tailscaleInstalled = tailscale.isTailscaleInstalled()
                        )
                    )
                }
                return
            }
        }

        apiClient = CraftyApiClient(targetUrl, token, cfg.allowSelfSignedCert)
        _uiState.update {
            it.copy(phase = ConnectionPhase.ReadyDashboard(targetUrl, route))
        }
        refreshServers()
        startPollingLoop()
    }

    private fun startPollingLoop() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(3000)
                val client = apiClient ?: continue
                val srvId = _uiState.value.activeServer?.serverId ?: continue
                runCatching {
                    val updated = client.getServerStats(srvId)
                    _uiState.update { st ->
                        st.copy(servers = st.servers.map { if (it.serverId == srvId) updated else it })
                    }
                    if (_uiState.value.selectedTab == DashboardTab.CONSOLE) {
                        val nextLogs = client.getLogs(srvId)
                        _uiState.update { it.copy(logs = nextLogs) }
                    }
                }
            }
        }
    }

    fun refreshServers() {
        val client = apiClient ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isBusy = true) }
            runCatching { client.listServers() }
                .onSuccess { list ->
                    _uiState.update { st ->
                        val nextId = if (list.any { it.serverId == st.selectedServerId }) {
                            st.selectedServerId
                        } else {
                            list.firstOrNull()?.serverId.orEmpty()
                        }
                        st.copy(servers = list, selectedServerId = nextId, isBusy = false)
                    }
                    refreshActiveTabData()
                }
                .onFailure { err ->
                    _uiState.update { it.copy(statusBanner = err.message, isBusy = false) }
                }
        }
    }

    fun refreshActiveTabData() {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            when (_uiState.value.selectedTab) {
                DashboardTab.CONSOLE -> runCatching { client.getLogs(srv.serverId) }
                    .onSuccess { logs -> _uiState.update { it.copy(logs = logs) } }
                DashboardTab.FILES -> loadDirectory(_uiState.value.currentDir)
                DashboardTab.BACKUPS -> runCatching { client.listBackups(srv.serverId) }
                    .onSuccess { list -> _uiState.update { it.copy(backups = list) } }
                DashboardTab.SCHEDULES -> runCatching { client.listTasks(srv.serverId) }
                    .onSuccess { list -> _uiState.update { it.copy(tasks = list) } }
                DashboardTab.USERS -> runCatching { client.listUsers() }
                    .onSuccess { list -> _uiState.update { it.copy(users = list) } }
                else -> Unit
            }
        }
    }

    fun sendPowerAction(action: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.sendAction(srv.serverId, action) }
                .onSuccess {
                    _uiState.update { it.copy(statusBanner = "Executed $action") }
                    refreshServers()
                }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun sendConsoleCommand(command: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching {
                client.sendStdin(srv.serverId, command)
                client.getLogs(srv.serverId)
            }.onSuccess { logs ->
                _uiState.update { it.copy(logs = logs) }
            }.onFailure { err ->
                _uiState.update { it.copy(statusBanner = err.message) }
            }
        }
    }

    fun loadDirectory(folder: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.listFiles(srv.serverId, folder) }
                .onSuccess { list -> _uiState.update { it.copy(files = list, currentDir = folder) } }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun openFile(path: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.readFile(srv.serverId, path) }
                .onSuccess { content -> _uiState.update { it.copy(openedFilePath = path, openedFileContent = content) } }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun saveOpenedFile(content: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        val path = _uiState.value.openedFilePath ?: return
        viewModelScope.launch {
            runCatching { client.writeFile(srv.serverId, path, content) }
                .onSuccess { _uiState.update { it.copy(openedFileContent = content, statusBanner = "Saved $path") } }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun closeOpenedFile() {
        _uiState.update { it.copy(openedFilePath = null, openedFileContent = "") }
    }

    fun deleteFile(path: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.deleteFile(srv.serverId, path) }
                .onSuccess { loadDirectory(_uiState.value.currentDir) }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun restoreBackup(backupId: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.sendAction(srv.serverId, "backup_server", backupId) }
                .onSuccess { _uiState.update { it.copy(statusBanner = "Backup restore started") } }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun deleteBackup(backupId: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.deleteBackup(srv.serverId, backupId) }
                .onSuccess { refreshActiveTabData() }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun createTask(name: String, action: String, command: String, interval: Int, intervalType: String, cron: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.createTask(srv.serverId, name, action, command, interval, intervalType, cron) }
                .onSuccess { refreshActiveTabData() }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun toggleTask(scheduleId: String, enabled: Boolean) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.toggleTask(srv.serverId, scheduleId, enabled) }
                .onSuccess { refreshActiveTabData() }
        }
    }

    fun runTask(scheduleId: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.runTask(srv.serverId, scheduleId) }
                .onSuccess { _uiState.update { it.copy(statusBanner = "Task triggered") } }
        }
    }

    fun deleteTask(scheduleId: String) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.deleteTask(srv.serverId, scheduleId) }
                .onSuccess { refreshActiveTabData() }
        }
    }

    fun updateServerConfig(name: String, port: Int, command: String, autoStart: Boolean, crashDetection: Boolean) {
        val client = apiClient ?: return
        val srv = _uiState.value.activeServer ?: return
        viewModelScope.launch {
            runCatching { client.updateServer(srv.serverId, name, port, command, autoStart, crashDetection) }
                .onSuccess {
                    _uiState.update { it.copy(statusBanner = "Server configuration saved") }
                    refreshServers()
                }
                .onFailure { err -> _uiState.update { it.copy(statusBanner = err.message) } }
        }
    }

    fun dismissBanner() {
        _uiState.update { it.copy(statusBanner = null) }
    }

    fun disconnectTailscaleVpn() {
        tailscale.sendDisconnectBroadcast()
    }

    fun openTailscaleApp() {
        tailscale.openTailscaleApp()
    }
}
