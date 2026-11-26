package com.scamcontroller.app.data

enum class AuthMethod { CREDENTIALS, TOKEN }

data class ServerConfig(
    val localUrl: String = DEFAULT_LOCAL_URL,
    val tailscaleUrl: String = DEFAULT_TAILSCALE_URL,
    val authMethod: AuthMethod = AuthMethod.CREDENTIALS,
    val apiToken: String = "",
    val username: String = "",
    val password: String = "",
    val lanTimeoutMs: Int = 1500,
    val vpnConnectTimeoutMs: Int = 12000,
    val allowSelfSignedCert: Boolean = true,
    val autoLoginEnabled: Boolean = true,
    val disconnectVpnOnExit: Boolean = false
) {
    val isConfigured: Boolean
        get() = localUrl.isNotBlank() || tailscaleUrl.isNotBlank()

    companion object {
        const val DEFAULT_LOCAL_URL = "https://192.168.1.50:8443"
        const val DEFAULT_TAILSCALE_URL = "https://crafty-node.tailnet.ts.net:8443"
    }
}
