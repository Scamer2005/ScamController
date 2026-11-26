package com.scamcontroller.app.network

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import kotlinx.coroutines.delay

class TailscaleManager(private val context: Context) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    fun isTailscaleInstalled(): Boolean {
        return runCatching {
            context.packageManager.getPackageInfo(TAILSCALE_PACKAGE, PackageManager.PackageInfoFlags.of(0))
            true
        }.getOrElse {
            runCatching {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(TAILSCALE_PACKAGE, 0)
                true
            }.getOrDefault(false)
        }
    }

    fun isVpnTransportActive(): Boolean {
        val networks = connectivityManager.allNetworks
        return networks.any { network ->
            val caps = connectivityManager.getNetworkCapabilities(network)
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
        }
    }

    fun sendConnectBroadcast(): Boolean {
        if (!isTailscaleInstalled()) return false
        val intent = Intent(ACTION_CONNECT_VPN).apply {
            component = ComponentName(TAILSCALE_PACKAGE, IPN_RECEIVER_CLASS)
            addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES)
        }
        context.sendBroadcast(intent)
        return true
    }

    fun sendDisconnectBroadcast(): Boolean {
        if (!isTailscaleInstalled()) return false
        val intent = Intent(ACTION_DISCONNECT_VPN).apply {
            component = ComponentName(TAILSCALE_PACKAGE, IPN_RECEIVER_CLASS)
            addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES)
        }
        context.sendBroadcast(intent)
        return true
    }

    fun openTailscaleApp(): Boolean {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(TAILSCALE_PACKAGE)
            ?: return false
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launchIntent)
        return true
    }

    suspend fun waitForVpnAndReachability(
        tailscaleUrl: String,
        timeoutMs: Int,
        allowSelfSignedCert: Boolean,
        prober: ReachabilityProber,
        onStatusTick: (String) -> Unit
    ): ProbeResult {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (isVpnTransportActive()) {
                onStatusTick("VPN tunnel active — probing Tailscale endpoint")
                val result = prober.probe(
                    rawUrl = tailscaleUrl,
                    timeoutMs = 2000,
                    allowSelfSignedCert = allowSelfSignedCert
                )
                if (result is ProbeResult.Reachable) {
                    return result
                }
            } else {
                onStatusTick("Waiting for Android TRANSPORT_VPN interface...")
            }
            delay(650)
        }
        return ProbeResult.Unreachable(
            "Timed out after ${timeoutMs}ms. Verify Tailscale background battery usage is Unrestricted."
        )
    }

    companion object {
        const val TAILSCALE_PACKAGE = "com.tailscale.ipn"
        const val IPN_RECEIVER_CLASS = "com.tailscale.ipn.IPNReceiver"
        const val ACTION_CONNECT_VPN = "com.tailscale.ipn.CONNECT_VPN"
        const val ACTION_DISCONNECT_VPN = "com.tailscale.ipn.DISCONNECT_VPN"
    }
}
