package com.scamcontroller.app.data

data class CraftyServer(
    val serverId: String,
    val serverName: String,
    val type: String,
    val serverPort: Int,
    val executable: String,
    val executionCommand: String,
    val stopCommand: String,
    val logPath: String,
    val autoStart: Boolean,
    val crashDetection: Boolean,
    val running: Boolean,
    val cpu: Double,
    val mem: String,
    val memPercent: Double,
    val worldName: String,
    val worldSize: String,
    val online: Int,
    val max: Int,
    val players: List<String>,
    val version: String,
    val desc: String
)

data class ServerFileEntry(
    val name: String,
    val path: String,
    val isDir: Boolean,
    val sizeBytes: Long
)

data class ServerBackup(
    val backupId: String,
    val backupName: String,
    val created: String,
    val sizeLabel: String
)

data class ScheduledTask(
    val scheduleId: String,
    val name: String,
    val action: String,
    val command: String,
    val interval: Int,
    val intervalType: String,
    val cronString: String,
    val enabled: Boolean
)

data class CraftyUser(
    val userId: String,
    val username: String,
    val email: String,
    val enabled: Boolean,
    val superuser: Boolean,
    val roles: List<String>
)
