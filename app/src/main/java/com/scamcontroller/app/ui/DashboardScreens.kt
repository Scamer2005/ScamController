package com.scamcontroller.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.NoteAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scamcontroller.app.data.CraftyServer
import com.scamcontroller.app.network.ConnectionOrchestrator
import com.scamcontroller.app.network.ConnectionUiState
import com.scamcontroller.app.network.DashboardTab
import kotlinx.coroutines.launch

private val BgCanvas = Color(0xFF0B0E11)
private val BgSurface = Color(0xFF12171D)
private val BgInput = Color(0xFF0E1318)
private val BorderSubtle = Color(0xFF2B3644)
private val Emerald = Color(0xFF10B981)
private val Amber = Color(0xFFFBBF24)
private val Red = Color(0xFFF87171)
private val Cyan = Color(0xFF38BDF8)
private val TextPrimary = Color.White
private val TextSecondary = Color(0xFFD6E0EA)

@Composable
fun scamTextFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    disabledTextColor = Color(0xFFD6E0EA),
    cursorColor = Emerald,
    focusedBorderColor = Emerald,
    unfocusedBorderColor = Color(0xFF3B4756),
    focusedLabelColor = Emerald,
    unfocusedLabelColor = Color(0xFFD6E0EA),
    focusedPlaceholderColor = Color(0xFFB6C2CF),
    unfocusedPlaceholderColor = Color(0xFFB6C2CF),
    focusedContainerColor = BgInput,
    unfocusedContainerColor = BgInput
)

@Composable
fun scamChipColors(): SelectableChipColors = FilterChipDefaults.filterChipColors(
    containerColor = BgCanvas,
    labelColor = Color.White,
    selectedContainerColor = Emerald.copy(alpha = 0.22f),
    selectedLabelColor = Color.White
)

@Composable
fun scamSwitchColors(): SwitchColors = SwitchDefaults.colors(
    checkedThumbColor = BgCanvas,
    checkedTrackColor = Emerald,
    uncheckedThumbColor = Color.White,
    uncheckedTrackColor = Color(0xFF2B3542),
    uncheckedBorderColor = Color(0xFF4B596B)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScamControllerDashboard(
    state: ConnectionUiState,
    orchestrator: ConnectionOrchestrator
) {
    val active = state.activeServer
    var showMoreSheet by remember { mutableStateOf(false) }

    val navItemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = Emerald,
        selectedTextColor = Color.White,
        unselectedIconColor = TextSecondary,
        unselectedTextColor = TextSecondary,
        indicatorColor = Emerald.copy(alpha = 0.18f)
    )

    Scaffold(
        containerColor = BgCanvas,
        contentColor = TextPrimary,
        bottomBar = {
            NavigationBar(containerColor = BgSurface, contentColor = TextPrimary) {
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.OVERVIEW,
                    onClick = { orchestrator.selectTab(DashboardTab.OVERVIEW) },
                    colors = navItemColors,
                    icon = { Icon(Icons.Default.Home, contentDescription = "Overview") },
                    label = { Text("Overview", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.CONSOLE,
                    onClick = { orchestrator.selectTab(DashboardTab.CONSOLE) },
                    colors = navItemColors,
                    icon = { Icon(Icons.Default.Terminal, contentDescription = "Console") },
                    label = { Text("Console", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = state.selectedTab == DashboardTab.FILES,
                    onClick = { orchestrator.selectTab(DashboardTab.FILES) },
                    colors = navItemColors,
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
                    colors = navItemColors,
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
                            colors = scamChipColors(),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selected,
                                borderColor = BorderSubtle,
                                selectedBorderColor = Emerald
                            ),
                            label = {
                                Text(
                                    text = "${srv.serverName} · ${if (srv.running) "Online" else "Offline"}",
                                    color = Color.White,
                                    fontSize = 12.sp
                                )
                            }
                        )
                    }
                }
            }

            if (active == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No servers available on this Crafty instance.", color = TextSecondary, fontSize = 13.sp)
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
                Text("Server & Panel Tools", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
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
                        border = BorderStroke(1.dp, if (state.selectedTab == tab) Emerald else BorderSubtle),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(title, color = if (state.selectedTab == tab) Emerald else Color.White)
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
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!server.running) {
                    Button(
                        onClick = { orchestrator.sendPowerAction("start_server") },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald)
                    ) { Text("Start", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
                } else {
                    OutlinedButton(
                        onClick = { orchestrator.sendPowerAction("restart_server") },
                        border = BorderStroke(1.dp, BorderSubtle),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Text("Restart", color = Color.White)
                    }
                    OutlinedButton(
                        onClick = { orchestrator.sendPowerAction("stop_server") },
                        border = BorderStroke(1.dp, Amber.copy(alpha = 0.6f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Amber)
                    ) {
                        Text("Stop", color = Amber)
                    }
                    OutlinedButton(
                        onClick = { orchestrator.sendPowerAction("kill_server") },
                        border = BorderStroke(1.dp, Red.copy(alpha = 0.6f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Red)
                    ) {
                        Text("Kill", color = Red)
                    }
                }
                OutlinedButton(
                    onClick = { orchestrator.sendPowerAction("backup_server") },
                    border = BorderStroke(1.dp, Emerald.copy(alpha = 0.6f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Emerald)
                ) {
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
        Text(label, color = TextSecondary, fontSize = 12.sp)
        Spacer(Modifier.height(4.dp))
        Text(value, color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ConsoleTab(logs: List<String>, orchestrator: ConnectionOrchestrator) {
    var cmd by remember { mutableStateOf("") }
    var autoScroll by remember { mutableStateOf(true) }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(logs.size, autoScroll) {
        if (autoScroll && logs.isNotEmpty()) {
            listState.animateScrollToItem(logs.lastIndex)
        }
    }

    val submitCommand = {
        val trimmed = cmd.trim()
        if (trimmed.isNotEmpty()) {
            autoScroll = true
            orchestrator.sendConsoleCommand(trimmed)
            cmd = ""
            coroutineScope.launch {
                if (logs.isNotEmpty()) {
                    listState.animateScrollToItem(logs.lastIndex)
                }
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Terminal · ${logs.size} Zeilen",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FilterChip(
                    selected = autoScroll,
                    onClick = {
                        autoScroll = !autoScroll
                        if (autoScroll && logs.isNotEmpty()) {
                            coroutineScope.launch { listState.animateScrollToItem(logs.lastIndex) }
                        }
                    },
                    colors = scamChipColors(),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = autoScroll,
                        borderColor = BorderSubtle,
                        selectedBorderColor = Emerald
                    ),
                    leadingIcon = {
                        Icon(
                            Icons.Default.ArrowDownward,
                            contentDescription = null,
                            tint = if (autoScroll) Emerald else Color.White,
                            modifier = Modifier.size(15.dp)
                        )
                    },
                    label = {
                        Text(
                            text = if (autoScroll) "Auto-Scroll: An" else "Auto-Scroll: Aus",
                            color = Color.White,
                            fontSize = 11.sp
                        )
                    }
                )
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                .padding(10.dp)
        ) {
            if (logs.isEmpty()) {
                item {
                    Text(
                        text = "Noch keine Konsolenausgabe vorhanden.",
                        color = TextSecondary,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
            } else {
                items(logs) { line ->
                    Text(
                        text = line,
                        color = when {
                            line.startsWith(">") -> Emerald
                            line.contains("ERROR", ignoreCase = true) || line.contains("FATAL", ignoreCase = true) -> Red
                            line.contains("WARN", ignoreCase = true) -> Amber
                            else -> Color.White
                        },
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = cmd,
                onValueChange = { cmd = it },
                placeholder = { Text("Command...", fontSize = 12.sp) },
                singleLine = true,
                colors = scamTextFieldColors(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { submitCommand() }),
                modifier = Modifier.weight(1f)
            )
            Button(
                onClick = submitCommand,
                colors = ButtonDefaults.buttonColors(containerColor = Emerald)
            ) { Text("Send", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
        }
    }
}

@Composable
private fun FilesTab(state: ConnectionUiState, orchestrator: ConnectionOrchestrator) {
    var showCreateKind by remember { mutableStateOf<Boolean?>(null) } // true = folder, false = file
    var newItemName by remember { mutableStateOf("") }

    if (state.openedFilePath != null) {
        var editorText by remember(state.openedFilePath, state.openedFileContent) {
            mutableStateOf(state.openedFileContent)
        }
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    IconButton(onClick = { orchestrator.closeOpenedFile() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                    Text(
                        text = state.openedFilePath,
                        color = Color.White,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { orchestrator.closeOpenedFile() },
                        border = BorderStroke(1.dp, BorderSubtle),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) { Text("Back", color = Color.White) }
                    Button(
                        onClick = { orchestrator.saveOpenedFile(editorText) },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald)
                    ) { Text("Save", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
                }
            }
            OutlinedTextField(
                value = editorText,
                onValueChange = { editorText = it },
                colors = scamTextFieldColors(),
                textStyle = LocalTextStyle.current.copy(
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp
                ),
                modifier = Modifier.weight(1f).fillMaxWidth()
            )
        }
    } else {
        Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (state.currentDir.isBlank()) "/ (Root)" else "/${state.currentDir}",
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { showCreateKind = false; newItemName = "" }) {
                        Icon(Icons.Default.NoteAdd, contentDescription = "New File", tint = Color.White)
                    }
                    IconButton(onClick = { showCreateKind = true; newItemName = "" }) {
                        Icon(Icons.Default.CreateNewFolder, contentDescription = "New Folder", tint = Cyan)
                    }
                    IconButton(onClick = { orchestrator.loadDirectory(state.currentDir) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reload Files", tint = Emerald)
                    }
                }
            }

            if (showCreateKind != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(BgSurface, RoundedCornerShape(10.dp))
                        .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = newItemName,
                        onValueChange = { newItemName = it },
                        label = { Text(if (showCreateKind == true) "Ordnername" else "Dateiname") },
                        singleLine = true,
                        colors = scamTextFieldColors(),
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            if (newItemName.isNotBlank()) {
                                orchestrator.createFileOrDir(newItemName.trim(), showCreateKind == true)
                                showCreateKind = null
                                newItemName = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald)
                    ) { Text("OK", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.currentDir.isNotBlank()) {
                    OutlinedButton(
                        onClick = {
                            val parent = state.currentDir.substringBeforeLast('/', "")
                            orchestrator.loadDirectory(parent)
                        },
                        border = BorderStroke(1.dp, Emerald.copy(alpha = 0.6f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Emerald)
                    ) { Text(".. (Zurück)", color = Emerald, fontSize = 12.sp) }
                }
                OutlinedButton(
                    onClick = { orchestrator.openFile("server.properties") },
                    border = BorderStroke(1.dp, BorderSubtle),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) { Text("server.properties", color = Color.White, fontSize = 12.sp) }
            }

            state.filesError?.let { err ->
                Text(
                    text = err,
                    color = Red,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Red.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                )
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(BgSurface, RoundedCornerShape(10.dp))
                    .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            ) {
                when {
                    state.filesLoading -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Emerald)
                        }
                    }
                    state.files.isEmpty() -> {
                        Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                            Text(
                                text = "Dieser Ordner ist leer oder wurde noch nicht geladen.",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                        }
                    }
                    else -> {
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            items(state.files, key = { it.path }) { entry ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (entry.isDir) orchestrator.loadDirectory(entry.path)
                                            else orchestrator.openFile(entry.path)
                                        }
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = if (entry.isDir) Icons.Default.Folder else Icons.Default.Description,
                                            contentDescription = null,
                                            tint = if (entry.isDir) Cyan else Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Column {
                                            Text(
                                                text = if (entry.isDir) "${entry.name}/" else entry.name,
                                                color = if (entry.isDir) Cyan else Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                            val metaText = buildString {
                                                if (!entry.isDir) {
                                                    val sizeStr = entry.sizeLabel.ifBlank { "${entry.sizeBytes} B" }
                                                    append(sizeStr)
                                                } else {
                                                    append("Ordner")
                                                }
                                                if (entry.modified.isNotBlank()) {
                                                    append(" · ")
                                                    append(entry.modified)
                                                }
                                            }
                                            Text(metaText, color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                        }
                                    }
                                    TextButton(onClick = { orchestrator.deleteFile(entry.path) }) {
                                        Text("Delete", color = Red, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                                HorizontalDivider(color = BorderSubtle)
                            }
                        }
                    }
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
        ) { Text("Backup Now", color = BgCanvas, fontWeight = FontWeight.SemiBold) }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
        ) {
            if (state.backups.isEmpty()) {
                item {
                    Text(
                        "Keine Backups vorhanden.",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            } else {
                items(state.backups) { bkp ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(bkp.backupName, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Text("${bkp.created} · ${bkp.sizeLabel}", color = TextSecondary, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                        }
                        Row {
                            TextButton(onClick = { orchestrator.restoreBackup(bkp.backupId) }) {
                                Text("Restore", color = Amber, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            }
                            TextButton(onClick = { orchestrator.deleteBackup(bkp.backupId) }) {
                                Text("Delete", color = Red, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    HorizontalDivider(color = BorderSubtle)
                }
            }
        }
    }
}

@Composable
private fun SchedulesTab(state: ConnectionUiState, orchestrator: ConnectionOrchestrator) {
    var name by remember { mutableStateOf("") }
    var action by remember { mutableStateOf("restart") }
    var interval by remember { mutableStateOf("12") }
    val fieldColors = scamTextFieldColors()

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Task Name") }, colors = fieldColors, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = action, onValueChange = { action = it }, label = { Text("Action") }, colors = fieldColors, modifier = Modifier.weight(1f))
                OutlinedTextField(value = interval, onValueChange = { interval = it }, label = { Text("Hours") }, colors = fieldColors, modifier = Modifier.weight(1f))
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
            ) { Text("Add Schedule", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
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
                        Text(task.name, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text("${task.action} · every ${task.interval} ${task.intervalType}", color = TextSecondary, fontSize = 11.sp)
                    }
                    Row {
                        TextButton(onClick = { orchestrator.toggleTask(task.scheduleId, !task.enabled) }) {
                            Text(if (task.enabled) "On" else "Off", color = Emerald, fontSize = 11.sp)
                        }
                        TextButton(onClick = { orchestrator.runTask(task.scheduleId) }) {
                            Text("Run", color = Color.White, fontSize = 11.sp)
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
                colors = scamTextFieldColors(),
                modifier = Modifier.weight(1f)
            )
            Button(
                onClick = { if (playerInput.isNotBlank()) orchestrator.sendConsoleCommand("op $playerInput") },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald)
            ) { Text("Op", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
            OutlinedButton(
                onClick = { if (playerInput.isNotBlank()) orchestrator.sendConsoleCommand("kick $playerInput") },
                border = BorderStroke(1.dp, Amber.copy(alpha = 0.6f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Amber)
            ) {
                Text("Kick", color = Amber)
            }
        }
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BgSurface, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
        ) {
            if (server.players.isEmpty()) {
                item {
                    Text(
                        "Keine Spieler online.",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            } else {
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
                    color = TextSecondary,
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
    val fieldColors = scamTextFieldColors()

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Server Name") }, colors = fieldColors, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = port, onValueChange = { port = it }, label = { Text("Port") }, colors = fieldColors, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = cmd, onValueChange = { cmd = it }, label = { Text("Startup Command") }, colors = fieldColors, modifier = Modifier.fillMaxWidth())
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Auto-start", color = TextPrimary, fontSize = 13.sp)
            Switch(checked = autoStart, onCheckedChange = { autoStart = it }, colors = scamSwitchColors())
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Crash detection", color = TextPrimary, fontSize = 13.sp)
            Switch(checked = crashDetection, onCheckedChange = { crashDetection = it }, colors = scamSwitchColors())
        }
        Button(
            onClick = {
                orchestrator.updateServerConfig(name, port.toIntOrNull() ?: 25565, cmd, autoStart, crashDetection)
            },
            colors = ButtonDefaults.buttonColors(containerColor = Emerald),
            modifier = Modifier.fillMaxWidth()
        ) { Text("Save Server Config", color = BgCanvas, fontWeight = FontWeight.SemiBold) }
    }
}
