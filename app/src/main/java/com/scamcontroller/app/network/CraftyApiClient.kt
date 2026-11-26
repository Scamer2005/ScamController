package com.scamcontroller.app.network

import com.scamcontroller.app.data.CraftyServer
import com.scamcontroller.app.data.CraftyUser
import com.scamcontroller.app.data.ScheduledTask
import com.scamcontroller.app.data.ServerBackup
import com.scamcontroller.app.data.ServerFileEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class CraftyApiClient(
    private val baseUrl: String,
    private val token: String,
    private val allowSelfSignedCert: Boolean
) {
    private val cleanBase = baseUrl.trim().trimEnd('/')
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    private val textMedia = "text/plain; charset=utf-8".toMediaType()

    private val client: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(8000, TimeUnit.MILLISECONDS)
            .readTimeout(12000, TimeUnit.MILLISECONDS)
            .writeTimeout(12000, TimeUnit.MILLISECONDS)

        val expectedHost = runCatching { URI(cleanBase).host }.getOrNull() ?: ""
        if (allowSelfSignedCert && expectedHost.isNotBlank()) {
            val trustManager = object : X509TrustManager {
                override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
                override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
                override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            }
            val sslContext = SSLContext.getInstance("TLS").apply {
                init(null, arrayOf<TrustManager>(trustManager), SecureRandom())
            }
            builder.sslSocketFactory(sslContext.socketFactory, trustManager)
            builder.hostnameVerifier { hostname, _ ->
                hostname.equals(expectedHost, ignoreCase = true)
            }
        }
        builder.build()
    }

    suspend fun login(username: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val body = JSONObject()
                .put("username", username)
                .put("password", password)
                .toString()
                .toRequestBody(jsonMedia)
            val req = Request.Builder()
                .url("$cleanBase/api/v2/auth/login")
                .post(body)
                .build()
            client.newCall(req).execute().use { res ->
                val raw = res.body?.string().orEmpty()
                if (!res.isSuccessful) error("HTTP ${res.code}: $raw")
                val json = JSONObject(raw)
                val data = json.optJSONObject("data") ?: error("Missing data payload")
                data.optString("token").takeIf { it.isNotBlank() } ?: error("Missing token")
            }
        }
    }

    private suspend fun executeJson(
        method: String,
        path: String,
        jsonBody: JSONObject? = null,
        rawText: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val builder = Request.Builder()
            .url("$cleanBase/api/v2$path")
            .header("Authorization", "Bearer $token")

        val body = when {
            rawText != null -> rawText.toRequestBody(textMedia)
            jsonBody != null -> jsonBody.toString().toRequestBody(jsonMedia)
            method == "POST" || method == "PATCH" || method == "PUT" -> "".toRequestBody(jsonMedia)
            else -> null
        }

        builder.method(method, body)
        client.newCall(builder.build()).execute().use { res ->
            val raw = res.body?.string().orEmpty()
            if (!res.isSuccessful) error("Crafty HTTP ${res.code}: $raw")
            runCatching { JSONObject(raw) }.getOrElse { JSONObject().put("data", raw) }
        }
    }

    suspend fun listServers(): List<CraftyServer> {
        val json = executeJson("GET", "/servers")
        val arr = json.optJSONArray("data") ?: return emptyList()
        val list = mutableListOf<CraftyServer>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("server_id")
            val stats = runCatching { getServerStats(id) }.getOrNull()
            list.add(
                stats ?: CraftyServer(
                    serverId = id,
                    serverName = obj.optString("server_name", "Server"),
                    type = obj.optString("type", "minecraft-java"),
                    serverPort = obj.optInt("server_port", 25565),
                    executable = obj.optString("executable", "server.jar"),
                    executionCommand = obj.optString("execution_command", ""),
                    stopCommand = obj.optString("stop_command", "stop"),
                    logPath = obj.optString("log_path", "logs/latest.log"),
                    autoStart = obj.optBoolean("auto_start", false),
                    crashDetection = obj.optBoolean("crash_detection", true),
                    running = obj.optBoolean("running", false),
                    cpu = obj.optDouble("cpu", 0.0),
                    mem = obj.optString("mem", "0 MB"),
                    memPercent = obj.optDouble("mem_percent", 0.0),
                    worldName = obj.optString("world_name", "world"),
                    worldSize = obj.optString("world_size", "0 MB"),
                    online = obj.optInt("online", 0),
                    max = obj.optInt("max", 20),
                    players = emptyList(),
                    version = obj.optString("version", "Unknown"),
                    desc = obj.optString("desc", "")
                )
            )
        }
        return list
    }

    suspend fun getServerStats(serverId: String): CraftyServer {
        val raw = executeJson("GET", "/servers/$serverId/stats").optJSONObject("data") ?: JSONObject()
        val srv = raw.optJSONObject("server_id") ?: JSONObject()
        val players = mutableListOf<String>()
        val playersArr = raw.optJSONArray("players")
        if (playersArr != null) {
            for (i in 0 until playersArr.length()) {
                players.add(playersArr.optString(i))
            }
        }
        return CraftyServer(
            serverId = srv.optString("server_id", serverId),
            serverName = srv.optString("server_name", raw.optString("world_name", "Server")),
            type = srv.optString("type", "minecraft-java"),
            serverPort = srv.optInt("server_port", 25565),
            executable = srv.optString("executable", ""),
            executionCommand = srv.optString("execution_command", ""),
            stopCommand = srv.optString("stop_command", "stop"),
            logPath = srv.optString("log_path", "logs/latest.log"),
            autoStart = srv.optBoolean("auto_start", false),
            crashDetection = srv.optBoolean("crash_detection", true),
            running = raw.optBoolean("running", false),
            cpu = raw.optDouble("cpu", 0.0),
            mem = raw.optString("mem", "0 MB"),
            memPercent = raw.optDouble("mem_percent", 0.0),
            worldName = raw.optString("world_name", "world"),
            worldSize = raw.optString("world_size", "0 MB"),
            online = raw.optInt("online", 0),
            max = raw.optInt("max", 20),
            players = players,
            version = raw.optString("version", "Unknown"),
            desc = raw.optString("desc", "")
        )
    }

    suspend fun sendAction(serverId: String, action: String, actionId: String? = null) {
        val suffix = if (!actionId.isNullOrBlank()) "/$actionId" else ""
        executeJson("POST", "/servers/$serverId/action/$action$suffix")
    }

    suspend fun getLogs(serverId: String): List<String> {
        val json = executeJson("GET", "/servers/$serverId/logs")
        val arr = json.optJSONArray("data") ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                add(arr.optString(i))
            }
        }
    }

    suspend fun sendStdin(serverId: String, command: String) {
        executeJson("POST", "/servers/$serverId/stdin", rawText = command)
    }

    suspend fun listFiles(serverId: String, folder: String): List<ServerFileEntry> {
        val payload = JSONObject().put("page", "files").put("folder", folder)
        val data = executeJson("POST", "/servers/$serverId/files", jsonBody = payload).optJSONObject("data")
            ?: return emptyList()
        val entries = mutableListOf<ServerFileEntry>()
        val keys = data.keys()
        while (keys.hasNext()) {
            val name = keys.next()
            if (name == "top" || name == "parent") continue
            val meta = data.optJSONObject(name) ?: continue
            entries.add(
                ServerFileEntry(
                    name = name,
                    path = meta.optString("path", if (folder.isBlank()) name else "$folder/$name"),
                    isDir = meta.optBoolean("dir", false),
                    sizeBytes = meta.optLong("size", 0L)
                )
            )
        }
        return entries.sortedWith(compareByDescending<ServerFileEntry> { it.isDir }.thenBy { it.name })
    }

    suspend fun readFile(serverId: String, filePath: String): String {
        val payload = JSONObject().put("file", filePath)
        val json = executeJson("POST", "/servers/$serverId/files", jsonBody = payload)
        return json.optString("data", "")
    }

    suspend fun writeFile(serverId: String, filePath: String, content: String) {
        val payload = JSONObject().put("file", filePath).put("contents", content)
        executeJson("PATCH", "/servers/$serverId/files", jsonBody = payload)
    }

    suspend fun deleteFile(serverId: String, filePath: String) {
        val payload = JSONObject().put("file", filePath)
        executeJson("DELETE", "/servers/$serverId/files", jsonBody = payload)
    }

    suspend fun listBackups(serverId: String): List<ServerBackup> {
        val arr = executeJson("GET", "/servers/$serverId/backups").optJSONArray("data") ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                add(
                    ServerBackup(
                        backupId = obj.optString("backup_id"),
                        backupName = obj.optString("backup_name", "Backup"),
                        created = obj.optString("created", ""),
                        sizeLabel = obj.optString("size_label", "")
                    )
                )
            }
        }
    }

    suspend fun deleteBackup(serverId: String, backupId: String) {
        executeJson("DELETE", "/servers/$serverId/backups/backup/$backupId")
    }

    suspend fun listTasks(serverId: String): List<ScheduledTask> {
        val arr = executeJson("GET", "/servers/$serverId/tasks").optJSONArray("data") ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                add(
                    ScheduledTask(
                        scheduleId = obj.optString("schedule_id"),
                        name = obj.optString("name", "Task"),
                        action = obj.optString("action", "command"),
                        command = obj.optString("command", ""),
                        interval = obj.optInt("interval", 1),
                        intervalType = obj.optString("interval_type", "hours"),
                        cronString = obj.optString("cron_string", ""),
                        enabled = obj.optBoolean("enabled", true)
                    )
                )
            }
        }
    }

    suspend fun createTask(
        serverId: String,
        name: String,
        action: String,
        command: String,
        interval: Int,
        intervalType: String,
        cronString: String
    ) {
        val payload = JSONObject()
            .put("name", name)
            .put("action", action)
            .put("command", command)
            .put("interval", interval)
            .put("interval_type", intervalType)
            .put("cron_string", cronString)
            .put("enabled", true)
            .put("one_time", false)
        executeJson("POST", "/servers/$serverId/tasks", jsonBody = payload)
    }

    suspend fun toggleTask(serverId: String, scheduleId: String, enabled: Boolean) {
        executeJson("PATCH", "/servers/$serverId/tasks/$scheduleId", jsonBody = JSONObject().put("enabled", enabled))
    }

    suspend fun runTask(serverId: String, scheduleId: String) {
        executeJson("POST", "/servers/$serverId/tasks/$scheduleId/run")
    }

    suspend fun deleteTask(serverId: String, scheduleId: String) {
        executeJson("DELETE", "/servers/$serverId/tasks/$scheduleId")
    }

    suspend fun updateServer(serverId: String, serverName: String, serverPort: Int, executionCommand: String, autoStart: Boolean, crashDetection: Boolean) {
        val payload = JSONObject()
            .put("server_name", serverName)
            .put("server_port", serverPort)
            .put("execution_command", executionCommand)
            .put("auto_start", autoStart)
            .put("crash_detection", crashDetection)
        executeJson("PATCH", "/servers/$serverId", jsonBody = payload)
    }

    suspend fun listUsers(): List<CraftyUser> {
        val arr = executeJson("GET", "/users").optJSONArray("data") ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val rolesArr = obj.optJSONArray("roles") ?: JSONArray()
                val roles = buildList {
                    for (r in 0 until rolesArr.length()) add(rolesArr.optString(r))
                }
                add(
                    CraftyUser(
                        userId = obj.optString("user_id"),
                        username = obj.optString("username"),
                        email = obj.optString("email", ""),
                        enabled = obj.optBoolean("enabled", true),
                        superuser = obj.optBoolean("superuser", false),
                        roles = roles
                    )
                )
            }
        }
    }
}
