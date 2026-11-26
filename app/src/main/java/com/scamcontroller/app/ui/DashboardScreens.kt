package com.scamcontroller.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Activity
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scamcontroller.app.data.CraftyServer
import com.scamcontroller.app.network.ConnectionOrchestrator
import com.scamcontroller.app.network.ConnectionUiState
import com.scamcontroller.app.network.DashboardTab

private val BgCanvas = Color(0xFF0B0E11)
private val BgSurface = Color(0xFF12171D)
private val BorderSubtle = Color(0xFF232C36)
private val Emerald = Color(0xFF10B981)
private val Amber = Color(0xFFF59E0B)
private val Red = Color(0xFFEF4444)
private val TextPrimary = Color(0xFFE6EDF3)
private val TextMuted = Color(0xFF8B98A5)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScamControllerDashboard(
    state: ConnectionUiState,
    orchestrator: ConnectionOrchestrator
) {
    val active = state.activeServer
    var showMoreSheet by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = BgCanvas,
        bottomBar = {
            NavigationBar(containerColor = BgSurface, contentColor = TextPrimary) {
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.OVERVIEW,
                    onClick = { orchestrator.selectTab(DashboardTab.OVERVIEW) },
                    icon = { Icon(Icons.Default.Activity, contentDescription = "Overview") },
                    label = { Text("Overview", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.CONSOLE,
                    onClick = { orchestrator.selectTab(DashboardTab.CONSOLE) },
                    icon = { Icon(Icons.Default.Terminal, contentDescription = "Console") },
                    label = { Text("Console", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.FILES,
                    onClick = { orchestrator.selectTab(DashboardTab.FILES) },
                    icon = { Icon(Icons.Default.Folder, contentDescription = "Files") },
                    label = { Text("Files", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = state.selectedTab !in listOf(
                        DashboardTab.OVERVIEW,
                        DashboardTab.CONSOLE,
                        DashboardTab.FILES
                    ),
                    onClick = { showMoreSheet = true },
                    icon = { Icon(Icons.Default.MoreHoriz, contentDescription = "More") },
                    label = { Text("More", fontSize = 11.sp) }
                )
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding).background(BgCanvas)) {
            if (state.servers.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .background(BgSurface)
                        .border(1.dp, BorderSubtle)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    state.servers.forEach { srv ->
                        val selected = srv.serverId == active?.serverId
                        FilterChip(
                            selected = selected,
                            onClick = { orchestrator.selectServer(srv.serverId) },
                            label = {
                                Text(
                                    text = "${srv.serverName} · ${if (srv.running) "Online" else "Offline"}",
                                    fontSize = 12.sp
                                )
                            }
                        )
                    }
                }
            }

            if (active == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No servers available on this Crafty instance.", color = TextMuted, fontSize = 13.sp)
                }
            } else {
                Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(12.dp)) {
                    when (state.selectedTab) {
                        DashboardTab.OVERVIEW -> OverviewTab(active, orchestrator)
                        DashboardTab.CONSOLE -> ConsoleTab(state.logs, orchestrator)
                        DashboardTab.FILES -> FilesTab(state, orchestrator)
                        DashboardTab.BACKUPS -> BackupsTab(state, orchestrator)
                        DashboardTab.SCHEDULES -> SchedulesTab(state, orchestrator)
                        DashboardTab.PLAYERS -> PlayersTab(active, orchestrator)
                        DashboardTab.USERS -> UsersTab(state)
                        DashboardTab.CONFIG -> ServerConfigTab(active, orchestrator)
                    }
                }
            }
        }
    }

    if (showMoreSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMoreSheet = false },
            containerColor = BgSurface,
            contentColor = TextPrimary
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Server & Panel Tools", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                listOf(
                    DashboardTab.PLAYERS to "Players & Whitelist",
                    DashboardTab.BACKUPS to "Backups",
                    DashboardTab.SCHEDULES to "Scheduled Tasks",
                    DashboardTab.CONFIG to "Server Configuration",
                    DashboardTab.USERS to "Users & Roles"
                ).forEach { (tab, title) ->
                    OutlinedButton(
                        onClick = {
                            orchestrator.selectTab(tab)
                            showMoreSheet = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(title, color = if (state.selectedTab == tab) Emerald else TextPrimary)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun OverviewTab(server: CraftyServer, orchestrator: ConnectionOrchestrator) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                .padding(16.dp)
        ) {
            Text(
                text = if (server.running) "Online · Port ${server.serverPort}" else "Offline · Port ${server.serverPort}",
                color = if (server.running) Emerald else Red,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(4.dp))
            Text(server.serverName, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!server.running) {
                    Button(
                        onClick = { orchestrator.sendPowerAction("start_server") },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald)
                    ) { Text("Start", color = BgCanvas) }
                } else {
                    OutlinedButton(onClick = { orchestrator.sendPowerAction("restart_server") }) {
                        Text("Restart", color = TextPrimary)
                    }
                    OutlinedButton(onClick = { orchestrator.sendPowerAction("stop_server") }) {
                        Text("Stop", color = Amber)
                    }
                    OutlinedButton(onClick = { orchestrator.sendPowerAction("kill_server") }) {
                        Text("Kill", color = Red)
                    }
                }
                OutlinedButton(onClick = { orchestrator.sendPowerAction("backup_server") }) {
                    Text("Backup", color = Emerald)
                }
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricBox("CPU", "${server.cpu}%", Modifier.weight(1f))
            MetricBox("Memory", "${server.memPercent}%", Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricBox("Players", "${server.online}/${server.max}", Modifier.weight(1f))
            MetricBox("World", server.worldSize, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MetricBox(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(BgSurface, RoundedCornerShape(10.dp))
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            .padding(14.dp)
    ) {
        Text(label, color = TextMuted, fontSize = 12.sp)
        Spacer(Modifier.height(4.dp))
        Text(value, color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ConsoleTab(logs: List<String>, orchestrator: ConnectionOrchestrator) {
    var cmd by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                .padding(10.dp)
        ) {
            items(logs) { line ->
                Text(
                    text = line,
                    color = when {
                        line.startsWith(">") -> Emerald
                        line.contains("ERROR", ignoreCase = true) -> Red
                        line.contains("WARN", ignoreCase = true) -> Amber
                        else -> TextPrimary
                    },
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = cmd,
                onValueChange = { cmd = it },
                placeholder = { Text("Command...", fontSize = 12.sp) },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            Button(
                onClick = {
                    if (cmd.isNotBlank()) {
                        orchestrator.sendConsoleCommand(cmd)
                        cmd = ""
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald)
            ) { Text("Send", color = BgCanvas) }
        }
    }
}

@Composable
private fun FilesTab(state: ConnectionUiState, orchestrator: ConnectionOrchestrator) {
    if (state.openedFilePath != null) {
        var editorText by remember(state.openedFilePath) { mutableStateOf(state.openedFileContent) }
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(state.openedFilePath, color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { orchestrator.closeOpenedFile() }) { Text("Back", color = TextMuted) }
                    Button(
                        onClick = { orchestrator.saveOpenedFile(editorText) },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald)
                    ) { Text("Save", color = BgCanvas) }
                }
            }
            OutlinedTextField(
                value = editorText,
                onValueChange = { editorText = it },
                modifier = Modifier.weight(1f).fillMaxWidth()
            )
        }
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            if (state.currentDir.isNotBlank()) {
                TextButton(onClick = {
                    val parent = state.currentDir.substringBeforeLast('/', "")
                    orchestrator.loadDirectory(parent)
                }) { Text(".. (Up)", color = Emerald) }
            }
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(BgSurface, RoundedCornerShape(10.dp))
                    .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            ) {
                items(state.files) { entry ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (entry.isDir) orchestrator.loadDirectory(entry.path)
                                else orchestrator.openFile(entry.path)
                            }
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (entry.isDir) "${entry.name}/" else entry.name,
                            color = if (entry.isDir) Color(0xFF06B6D4) else TextPrimary,
                            fontSize = 13.sp
                        )
                        TextButton(onClick = { orchestrator.deleteFile(entry.path) }) {
                            Text("Delete", color = Red, fontSize = 11.sp)
                        }
                    }
                    HorizontalDivider(color = BorderSubtle)
                }
            }
        }
    }
}

@Composable
private fun BackupsTab(state: ConnectionUiState, orchestrator: ConnectionOrchestrator) {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
            onClick = { orchestrator.sendPowerAction("backup_server") },
            colors = ButtonDefaults.buttonColors(containerColor = Emerald),
            modifier = Modifier.fillMaxWidth()
        ) { Text("Backup Now", color = BgCanvas) }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
        ) {
            items(state.backups) { bkp ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(bkp.backupName, color = TextPrimary, fontSize = 13.sp)
                        Text("${bkp.created} · ${bkp.sizeLabel}", color = TextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    }
                    Row {
                        TextButton(onClick = { orchestrator.restoreBackup(bkp.backupId) }) {
                            Text("Restore", color = Amber, fontSize = 11.sp)
                        }
                        TextButton(onClick = { orchestrator.deleteBackup(bkp.backupId) }) {
                            Text("Delete", color = Red, fontSize = 11.sp)
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle)
            }
        }
    }
}

@Composable
private fun SchedulesTab(state: ConnectionUiState, orchestrator: ConnectionOrchestrator) {
    var name by remember { mutableStateOf("") }
    var action by remember { mutableStateOf("restart") }
    var interval by remember { mutableStateOf("12") }
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Task Name") }, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = action, onValueChange = { action = it }, label = { Text("Action") }, modifier = Modifier.weight(1f))
                OutlinedTextField(value = interval, onValueChange = { interval = it }, label = { Text("Hours") }, modifier = Modifier.weight(1f))
            }
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        orchestrator.createTask(name, action, "", interval.toIntOrNull() ?: 12, "hours", "")
                        name = ""
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald),
                modifier = Modifier.fillMaxWidth()
            ) { Text("Add Schedule", color = BgCanvas) }
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
        ) {
            items(state.tasks) { task ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(task.name, color = TextPrimary, fontSize = 13.sp)
                        Text("${task.action} · every ${task.interval} ${task.intervalType}", color = TextMuted, fontSize = 11.sp)
                    }
                    Row {
                        TextButton(onClick = { orchestrator.toggleTask(task.scheduleId, !task.enabled) }) {
                            Text(if (task.enabled) "On" else "Off", color = Emerald, fontSize = 11.sp)
                        }
                        TextButton(onClick = { orchestrator.runTask(task.scheduleId) }) {
                            Text("Run", color = TextPrimary, fontSize = 11.sp)
                        }
                        TextButton(onClick = { orchestrator.deleteTask(task.scheduleId) }) {
                            Text("Del", color = Red, fontSize = 11.sp)
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle)
            }
        }
    }
}

@Composable
private fun PlayersTab(server: CraftyServer, orchestrator: ConnectionOrchestrator) {
    var playerInput by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = playerInput,
                onValueChange = { playerInput = it },
                label = { Text("Player name") },
                modifier = Modifier.weight(1f)
            )
            Button(
                onClick = { if (playerInput.isNotBlank()) orchestrator.sendConsoleCommand("op $playerInput") },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald)
            ) { Text("Op", color = BgCanvas) }
            OutlinedButton(onClick = { if (playerInput.isNotBlank()) orchestrator.sendConsoleCommand("kick $playerInput") }) {
                Text("Kick", color = Amber)
            }
        }
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
        ) {
            items(server.players) { player ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(player, color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    Row {
                        TextButton(onClick = { orchestrator.sendConsoleCommand("kick $player") }) {
                            Text("Kick", color = Amber, fontSize = 11.sp)
                        }
                        TextButton(onClick = { orchestrator.sendConsoleCommand("ban $player") }) {
                            Text("Ban", color = Red, fontSize = 11.sp)
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle)
            }
        }
    }
}

@Composable
private fun UsersTab(state: ConnectionUiState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgSurface, RoundedCornerShape(10.dp))
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
    ) {
        items(state.users) { user ->
            Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                Text(
                    text = if (user.superuser) "${user.username} · Superuser" else user.username,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "${user.email} · ${user.roles.joinToString()}",
                    color = TextMuted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp
                )
            }
            HorizontalDivider(color = BorderSubtle)
        }
    }
}

@Composable
private fun ServerConfigTab(server: CraftyServer, orchestrator: ConnectionOrchestrator) {
    var name by remember(server.serverId) { mutableStateOf(server.serverName) }
    var port by remember(server.serverId) { mutableStateOf(server.serverPort.toString()) }
    var cmd by remember(server.serverId) { mutableStateOf(server.executionCommand) }
    var autoStart by remember(server.serverId) { mutableStateOf(server.autoStart) }
    var crashDetection by remember(server.serverId) { mutableStateOf(server.crashDetection) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Server Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = port, onValueChange = { port = it }, label = { Text("Port") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = cmd, onValueChange = { cmd = it }, label = { Text("Startup Command") }, modifier = Modifier.fillMaxWidth())
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Auto-start", color = TextPrimary, fontSize = 13.sp)
            Switch(checked = autoStart, onCheckedChange = { autoStart = it })
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Crash detection", color = TextPrimary, fontSize = 13.sp)
            Switch(checked = crashDetection, onCheckedChange = { crashDetection = it })
        }
        Button(
            onClick = {
                orchestrator.updateServerConfig(name, port.toIntOrNull() ?: 25565, cmd, autoStart, crashDetection)
            },
            colors = ButtonDefaults.buttonColors(containerColor = Emerald),
            modifier = Modifier.fillMaxWidth()
        ) { Text("Save Server Config", color = BgCanvas) }
    }
}
