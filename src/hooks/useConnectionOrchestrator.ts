import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadServerConfig, saveServerConfig } from '../data/credentialStore';
import { CraftyClient, LiveCraftyClient, loginToCrafty, SandboxCraftyClient } from '../network/craftyApi';
import { probeServer } from '../network/reachabilityProber';
import { ActiveRoute, ConnectionUiState, ServerConfig } from '../types/crafty';

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function useConnectionOrchestrator() {
  const [uiState, setUiState] = useState<ConnectionUiState>(() => ({
    config: loadServerConfig(),
    phase: { type: 'Idle' },
    activeRoute: 'NONE',
    activeBaseUrl: '',
    activeToken: '',
    lastLatencyMs: null,
    authStatusMessage: null,
  }));

  const configRef = useRef<ServerConfig>(uiState.config);
  configRef.current = uiState.config;

  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const sandboxRef = useRef<SandboxCraftyClient | null>(null);

  const authenticateAndEnter = useCallback(
    async (
      targetUrl: string,
      route: ActiveRoute,
      latencyMs: number,
      cfg: ServerConfig,
      isStale: () => boolean
    ) => {
      setUiState((prev) => ({
        ...prev,
        phase: { type: 'Authenticating', targetUrl, route },
        activeRoute: route,
        lastLatencyMs: latencyMs,
      }));

      let token = cfg.apiToken.trim();
      if (cfg.authMethod === 'credentials' || !token) {
        if (!cfg.username.trim() || !cfg.password) {
          setUiState((prev) => ({
            ...prev,
            phase: {
              type: 'ErrorUnreachable',
              detail: 'Server reachable, but API token or Crafty login credentials are missing.',
              tailscaleInstalled: true,
            },
          }));
          return;
        }
        const loginRes = await loginToCrafty(
          targetUrl,
          cfg.username,
          cfg.password,
          cfg.allowSelfSignedCert
        );
        if (isStale()) return;
        if (!loginRes.ok) {
          setUiState((prev) => ({
            ...prev,
            phase: {
              type: 'ErrorUnreachable',
              detail: `Crafty login failed: ${loginRes.error}`,
              tailscaleInstalled: true,
            },
          }));
          return;
        }
        token = loginRes.token;
      }

      setUiState((prev) => ({
        ...prev,
        phase: { type: 'ReadyDashboard', targetUrl, route },
        activeRoute: route,
        activeBaseUrl: targetUrl,
        activeToken: token,
        lastLatencyMs: latencyMs,
        authStatusMessage: null,
      }));
    },
    []
  );

  const startConnectionSequence = useCallback(
    async (overrideConfig?: ServerConfig) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++seqRef.current;
      const isStale = () => controller.signal.aborted || seqRef.current !== runId;

      const cfg = overrideConfig ?? configRef.current;

      setUiState((prev) => ({
        ...prev,
        authStatusMessage: null,
        activeRoute: 'NONE',
      }));

      // Step 1: Probe Local LAN URL first
      if (cfg.localUrl.trim()) {
        setUiState((prev) => ({
          ...prev,
          phase: { type: 'ProbingLan', url: cfg.localUrl },
        }));

        const lanResult = await probeServer(
          cfg.localUrl,
          cfg.lanTimeoutMs,
          cfg.allowSelfSignedCert,
          controller.signal
        );

        if (isStale()) return;

        if (lanResult.reachable) {
          await authenticateAndEnter(cfg.localUrl, 'LAN', lanResult.latencyMs, cfg, isStale);
          return;
        }
      }

      // Step 2: LAN unreachable — Tailscale fallback check
      if (!cfg.tailscaleUrl.trim()) {
        setUiState((prev) => ({
          ...prev,
          phase: {
            type: 'ErrorUnreachable',
            detail: 'Local server unreachable and no Tailscale URL configured.',
            tailscaleInstalled: false,
          },
        }));
        return;
      }

      setUiState((prev) => ({
        ...prev,
        phase: { type: 'TriggeringTailscale' },
      }));
      await delay(350, controller.signal);
      if (isStale()) return;

      setUiState((prev) => ({
        ...prev,
        phase: {
          type: 'WaitingForVpn',
          detail: `Probing Tailscale endpoint: ${cfg.tailscaleUrl}`,
        },
      }));

      const tsTimeout = Math.min(cfg.vpnConnectTimeoutMs, 3500);
      const tsResult = await probeServer(
        cfg.tailscaleUrl,
        tsTimeout,
        cfg.allowSelfSignedCert,
        controller.signal
      );

      if (isStale()) return;

      if (tsResult.reachable) {
        await authenticateAndEnter(cfg.tailscaleUrl, 'TAILSCALE', tsResult.latencyMs, cfg, isStale);
      } else {
        setUiState((prev) => ({
          ...prev,
          phase: {
            type: 'ErrorUnreachable',
            detail: `${tsResult.reason}. Configure a reachable Crafty URL & credentials in Settings, or launch the local preview workspace to test all ScamController controls.`,
            tailscaleInstalled: true,
          },
        }));
      }
    },
    [authenticateAndEnter]
  );

  useEffect(() => {
    void startConnectionSequence();
    return () => {
      abortRef.current?.abort();
    };
  }, [startConnectionSequence]);

  const updateConfig = useCallback(
    (updated: ServerConfig, reconnectNow = true) => {
      const normalized = saveServerConfig(updated);
      configRef.current = normalized;
      setUiState((prev) => ({
        ...prev,
        config: normalized,
        authStatusMessage: null,
      }));
      if (reconnectNow) {
        void startConnectionSequence(normalized);
      }
    },
    [startConnectionSequence]
  );

  const enterSandboxMode = useCallback(() => {
    abortRef.current?.abort();
    if (!sandboxRef.current) {
      sandboxRef.current = new SandboxCraftyClient();
    }
    setUiState((prev) => ({
      ...prev,
      phase: { type: 'ReadyDashboard', targetUrl: 'sandbox://crafty-local', route: 'SANDBOX' },
      activeRoute: 'SANDBOX',
      activeBaseUrl: 'sandbox://crafty-local',
      activeToken: 'sandbox-token',
      lastLatencyMs: 1,
      authStatusMessage: 'Preview Sandbox active — actions simulate Crafty Controller v4 locally.',
    }));
  }, []);

  const disconnectTailscaleVpn = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      authStatusMessage:
        'VPN disconnect broadcast (com.tailscale.ipn.DISCONNECT_VPN) runs natively on Android devices.',
    }));
  }, []);

  const clearBanner = useCallback(() => {
    setUiState((prev) => ({ ...prev, authStatusMessage: null }));
  }, []);

  const client: CraftyClient | null = useMemo(() => {
    if (uiState.phase.type !== 'ReadyDashboard') return null;
    if (uiState.activeRoute === 'SANDBOX') {
      if (!sandboxRef.current) {
        sandboxRef.current = new SandboxCraftyClient();
      }
      return sandboxRef.current;
    }
    return new LiveCraftyClient(
      uiState.activeBaseUrl,
      uiState.activeToken,
      uiState.config.allowSelfSignedCert
    );
  }, [
    uiState.phase.type,
    uiState.activeRoute,
    uiState.activeBaseUrl,
    uiState.activeToken,
    uiState.config.allowSelfSignedCert,
  ]);

  return {
    uiState,
    client,
    startConnectionSequence,
    updateConfig,
    enterSandboxMode,
    disconnectTailscaleVpn,
    clearBanner,
  };
}
