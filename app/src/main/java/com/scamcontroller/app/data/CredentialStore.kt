package com.scamcontroller.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class CredentialStore(context: Context) {

    private val masterKey: MasterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "scam_controller_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun load(): ServerConfig {
        val methodName = prefs.getString(KEY_AUTH_METHOD, AuthMethod.CREDENTIALS.name)
        val authMethod = runCatching { AuthMethod.valueOf(methodName ?: AuthMethod.CREDENTIALS.name) }
            .getOrDefault(AuthMethod.CREDENTIALS)
        return ServerConfig(
            localUrl = prefs.getString(KEY_LOCAL_URL, ServerConfig.DEFAULT_LOCAL_URL)
                ?: ServerConfig.DEFAULT_LOCAL_URL,
            tailscaleUrl = prefs.getString(KEY_TAILSCALE_URL, ServerConfig.DEFAULT_TAILSCALE_URL)
                ?: ServerConfig.DEFAULT_TAILSCALE_URL,
            authMethod = authMethod,
            apiToken = prefs.getString(KEY_API_TOKEN, "") ?: "",
            username = prefs.getString(KEY_USERNAME, "") ?: "",
            password = prefs.getString(KEY_PASSWORD, "") ?: "",
            lanTimeoutMs = prefs.getInt(KEY_LAN_TIMEOUT, 1500),
            vpnConnectTimeoutMs = prefs.getInt(KEY_VPN_TIMEOUT, 12000),
            allowSelfSignedCert = prefs.getBoolean(KEY_ALLOW_SELF_SIGNED, true),
            autoLoginEnabled = prefs.getBoolean(KEY_AUTO_LOGIN, true),
            disconnectVpnOnExit = prefs.getBoolean(KEY_DISCONNECT_EXIT, false)
        )
    }

    fun save(config: ServerConfig) {
        prefs.edit()
            .putString(KEY_LOCAL_URL, config.localUrl.trim())
            .putString(KEY_TAILSCALE_URL, config.tailscaleUrl.trim())
            .putString(KEY_AUTH_METHOD, config.authMethod.name)
            .putString(KEY_API_TOKEN, config.apiToken.trim())
            .putString(KEY_USERNAME, config.username.trim())
            .putString(KEY_PASSWORD, config.password)
            .putInt(KEY_LAN_TIMEOUT, config.lanTimeoutMs)
            .putInt(KEY_VPN_TIMEOUT, config.vpnConnectTimeoutMs)
            .putBoolean(KEY_ALLOW_SELF_SIGNED, config.allowSelfSignedCert)
            .putBoolean(KEY_AUTO_LOGIN, config.autoLoginEnabled)
            .putBoolean(KEY_DISCONNECT_EXIT, config.disconnectVpnOnExit)
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_LOCAL_URL = "local_url"
        const val KEY_TAILSCALE_URL = "tailscale_url"
        const val KEY_AUTH_METHOD = "auth_method"
        const val KEY_API_TOKEN = "api_token"
        const val KEY_USERNAME = "username"
        const val KEY_PASSWORD = "password"
        const val KEY_LAN_TIMEOUT = "lan_timeout_ms"
        const val KEY_VPN_TIMEOUT = "vpn_timeout_ms"
        const val KEY_ALLOW_SELF_SIGNED = "allow_self_signed"
        const val KEY_AUTO_LOGIN = "auto_login"
        const val KEY_DISCONNECT_EXIT = "disconnect_vpn_on_exit"
    }
}
