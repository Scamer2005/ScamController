# ScamController (Web + Android Client)

**Entirely coded by AI (gemini)! Not my work.**

A full-featured Crafty Controller v4 replacement built for both **Web (React + Express)** and **Native Android (Kotlin + Jetpack Compose)**.

## Features
- **LAN-First + Tailscale Fallback**: Probes your local LAN Crafty URL first (`https://192.168.1.50:8443`) before falling back to Tailscale (`com.tailscale.ipn.CONNECT_VPN` on Android).
- **Dual Crafty v4 API v2 Auth**: Supports both static Crafty API Bearer tokens and username/password `/api/v2/auth/login` exchange with self-signed TLS cert trust.
- **Server Power & Telemetry**: Multi-server switcher, live CPU/RAM/player/world metrics, Start, Stop, Restart, Kill, Backup Now, and Create Server.
- **Live Console**: Polled log viewer with level highlighting, filter, auto-scroll, command history, quick commands, and `/stdin` execution.
- **File Manager & `server.properties`**: Directory browsing, create/rename/delete/edit files, and a structured visual `server.properties` editor.
- **Backups & Schedules**: Archive management, restore/delete, backup policy configuration, and cron/interval scheduled task CRUD.
- **Players, Users & Config**: Online player moderation (Kick/Ban/Op/Deop/Whitelist), Crafty panel users/roles, and server startup configuration.

## Running the Web App
```bash
npm install
npm run dev
```
Runs on `http://0.0.0.0:3000`.

## Building the Android APK
1. Open the repository root in **Android Studio** (Ladybug or newer).
2. Let Gradle sync (`settings.gradle.kts`, `build.gradle.kts`, `app/build.gradle.kts`).
3. Run **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate `app/build/outputs/apk/debug/app-debug.apk`.
4. Install the APK on your Android phone alongside **Tailscale** (with Tailscale battery usage set to **Unrestricted**).
