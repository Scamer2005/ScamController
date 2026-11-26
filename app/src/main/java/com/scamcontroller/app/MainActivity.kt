package com.scamcontroller.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scamcontroller.app.data.AuthMethod
import com.scamcontroller.app.data.ServerConfig
import com.scamcontroller.app.network.ActiveRoute
import com.scamcontroller.app.network.ConnectionOrchestrator
import com.scamcontroller.app.network.ConnectionPhase
import com.scamcontroller.app.ui.ScamControllerDashboard

class MainActivity : ComponentActivity() {

    private val orchestrator: ConnectionOrchestrator by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ScamControllerApp(orchestrator = orchestrator)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isFinishing && orchestrator.uiState.value.config.disconnectVpnOnExit) {
            orchestrator.disconnectTailscaleVpn()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScamControllerApp(orchestrator: ConnectionOrchestrator) {
    val state by orchestrator.uiState.collectAsState()
    var showSettings by remember { mutableStateOf(!state.config.isConfigured) }

    val bgCanvas = Color(0xFF0B0E11)
    val bgSurface = Color(0xFF12171D)
    val borderSubtle = Color(0xFF232C36)
    val emerald = Color(0xFF10B981)

    Surface(modifier = Modifier.fillMaxSize(), color = bgCanvas) {
        Column(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
            // Compact Tactical Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(bgSurface)
                    .border(1.dp, borderSubtle)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "ScamController",
                        color = Color(0xFFE6EDF3),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    val routeLabel = when (state.activeRoute) {
                        ActiveRoute.LAN -> "LAN · ${state.lastLatencyMs ?: 0}ms"
                        ActiveRoute.TAILSCALE -> "Tailscale · ${state.lastLatencyMs ?: 0}ms"
                        ActiveRoute.NONE -> "Connecting"
                    }
                    Text(
                        text = routeLabel,
                        color = if (state.activeRoute == ActiveRoute.NONE) Color(0xFFF59E0B) else emerald,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { orchestrator.startConnectionSequence() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reconnect", tint = Color(0xFF8B98A5))
                    }
                    IconButton(onClick = { showSettings = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color(0xFF8B98A5))
                    }
                }
            }

            state.statusBanner?.let { msg ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1A160B))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = msg, color = Color(0xFFF59E0B), fontSize = 12.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { orchestrator.dismissBanner() }) {
                        Text("Dismiss", color = Color(0xFFF59E0B), fontSize = 11.sp)
                    }
                }
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val phase = state.phase) {
                    is ConnectionPhase.ReadyDashboard -> {
                        ScamControllerDashboard(state = state, orchestrator = orchestrator)
                    }
                    is ConnectionPhase.ErrorUnreachable -> {
                        UnreachableRecoveryView(
                            detail = phase.detail,
                            tailscaleInstalled = phase.tailscaleInstalled,
                            onRetry = { orchestrator.startConnectionSequence() },
                            onOpenTailscale = { orchestrator.openTailscaleApp() },
                            onOpenSettings = { showSettings = true }
                        )
                    }
                    else -> {
                        ConnectionProgressView(phase = phase)
                    }
                }
            }
        }
    }

    if (showSettings) {
        SettingsBottomSheet(
            initial = state.config,
            onDismiss = { showSettings = false },
            onSave = { updated ->
                showSettings = false
                orchestrator.updateConfig(updated, reconnectNow = true)
            },
            onDisconnectVpn = { orchestrator.disconnectTailscaleVpn() },
            onClearCredentials = { orchestrator.clearCredentials() }
        )
    }
}

@Composable
fun ConnectionProgressView(phase: ConnectionPhase) {
    val label = when (phase) {
        ConnectionPhase.Idle -> "Initializing ScamController..."
        is ConnectionPhase.ProbingLan -> "Probing local server: ${phase.url}"
        ConnectionPhase.TriggeringTailscale -> "Local unreachable. Sending Tailscale CONNECT_VPN broadcast..."
        is ConnectionPhase.WaitingForVpn -> phase.detail
        is ConnectionPhase.Authenticating -> "Authenticating Crafty API v2 at ${phase.targetUrl}..."
        else -> "Connecting..."
    }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator(color = Color(0xFF10B981))
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = label,
            color = Color(0xFFE6EDF3),
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp
        )
    }
}

@Composable
fun UnreachableRecoveryView(
    detail: String,
    tailscaleInstalled: Boolean,
    onRetry: () -> Unit,
    onOpenTailscale: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Server Unreachable", color = Color(0xFFEF4444), fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text(detail, color = Color(0xFF8B98A5), fontSize = 13.sp, fontFamily = FontFamily.Monospace)
        Spacer(modifier = Modifier.height(20.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("Retry Connection", color = Color(0xFF0B0E11), fontWeight = FontWeight.SemiBold)
        }
        if (tailscaleInstalled) {
            Spacer(modifier = Modifier.height(10.dp))
            OutlinedButton(onClick = onOpenTailscale, shape = RoundedCornerShape(8.dp)) {
                Icon(Icons.Default.VpnKey, contentDescription = null, tint = Color(0xFF06B6D4))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Tailscale App", color = Color(0xFFE6EDF3))
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        TextButton(onClick = onOpenSettings) {
            Text("Edit Server Settings", color = Color(0xFF8B98A5))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsBottomSheet(
    initial: ServerConfig,
    onDismiss: () -> Unit,
    onSave: (ServerConfig) -> Unit,
    onDisconnectVpn: () -> Unit,
    onClearCredentials: () -> Unit
) {
    var localUrl by remember { mutableStateOf(initial.localUrl) }
    var tailscaleUrl by remember { mutableStateOf(initial.tailscaleUrl) }
    var authMethod by remember { mutableStateOf(initial.authMethod) }
    var apiToken by remember { mutableStateOf(initial.apiToken) }
    var username by remember { mutableStateOf(initial.username) }
    var password by remember { mutableStateOf(initial.password) }
    var allowSelfSigned by remember { mutableStateOf(initial.allowSelfSignedCert) }
    var disconnectOnExit by remember { mutableStateOf(initial.disconnectVpnOnExit) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF12171D),
        contentColor = Color(0xFFE6EDF3)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("ScamController Settings", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)

            OutlinedTextField(
                value = localUrl,
                onValueChange = { localUrl = it },
                label = { Text("Local LAN URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = tailscaleUrl,
                onValueChange = { tailscaleUrl = it },
                label = { Text("Tailscale URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                FilterChip(
                    selected = authMethod == AuthMethod.CREDENTIALS,
                    onClick = { authMethod = AuthMethod.CREDENTIALS },
                    label = { Text("Login") }
                )
                FilterChip(
                    selected = authMethod == AuthMethod.TOKEN,
                    onClick = { authMethod = AuthMethod.TOKEN },
                    label = { Text("API Token") }
                )
            }

            if (authMethod == AuthMethod.TOKEN) {
                OutlinedTextField(
                    value = apiToken,
                    onValueChange = { apiToken = it },
                    label = { Text("Crafty v4 API Token") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Crafty Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Crafty Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Trust self-signed cert for configured hosts", fontSize = 14.sp)
                Switch(checked = allowSelfSigned, onCheckedChange = { allowSelfSigned = it })
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Disconnect Tailscale VPN on app exit", fontSize = 14.sp)
                Switch(checked = disconnectOnExit, onCheckedChange = { disconnectOnExit = it })
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onDisconnectVpn, modifier = Modifier.weight(1f)) {
                    Text("Disconnect VPN", fontSize = 12.sp)
                }
                OutlinedButton(onClick = onClearCredentials, modifier = Modifier.weight(1f)) {
                    Text("Clear Creds", fontSize = 12.sp)
                }
            }

            Button(
                onClick = {
                    onSave(
                        initial.copy(
                            localUrl = localUrl,
                            tailscaleUrl = tailscaleUrl,
                            authMethod = authMethod,
                            apiToken = apiToken,
                            username = username,
                            password = password,
                            allowSelfSignedCert = allowSelfSigned,
                            disconnectVpnOnExit = disconnectOnExit
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Save & Connect", color = Color(0xFF0B0E11), fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
