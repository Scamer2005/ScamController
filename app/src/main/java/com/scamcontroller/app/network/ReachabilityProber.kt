package com.scamcontroller.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URI
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

sealed interface ProbeResult {
    data class Reachable(val latencyMs: Long, val statusCode: Int) : ProbeResult
    data class Unreachable(val reason: String) : ProbeResult
}

class ReachabilityProber {

    suspend fun probe(
        rawUrl: String,
        timeoutMs: Int,
        allowSelfSignedCert: Boolean
    ): ProbeResult = withContext(Dispatchers.IO) {
        if (rawUrl.isBlank()) {
            return@withContext ProbeResult.Unreachable("URL is blank")
        }

        val uri = runCatching { URI(rawUrl) }.getOrNull()
            ?: return@withContext ProbeResult.Unreachable("Malformed URL")

        val host = uri.host
            ?: return@withContext ProbeResult.Unreachable("Missing host")

        val client = buildClient(timeoutMs.toLong(), allowSelfSignedCert, host)
        val request = Request.Builder()
            .url(rawUrl)
            .head()
            .build()

        val startNs = System.nanoTime()
        runCatching {
            client.newCall(request).execute().use { response ->
                val elapsedMs = (System.nanoTime() - startNs) / 1_000_000L
                ProbeResult.Reachable(latencyMs = elapsedMs, statusCode = response.code)
            }
        }.getOrElse { error ->
            ProbeResult.Unreachable(error.message ?: error.javaClass.simpleName)
        }
    }

    private fun buildClient(
        timeoutMs: Long,
        allowSelfSigned: Boolean,
        expectedHost: String
    ): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .followRedirects(true)

        if (allowSelfSigned) {
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

        return builder.build()
    }
}
