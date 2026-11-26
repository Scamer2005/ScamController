import { useState } from 'react';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';
import { AuthMethod, ServerConfig } from '../types/crafty';

interface SettingsModalProps {
  initial: ServerConfig;
  activeBaseUrl: string;
  onDismiss: () => void;
  onSave: (updated: ServerConfig) => void;
  onDisconnectVpn: () => void;
  onClearCredentials: () => void;
}

export function SettingsModal({
  initial,
  activeBaseUrl,
  onDismiss,
  onSave,
  onDisconnectVpn,
  onClearCredentials,
}: SettingsModalProps) {
  const [localUrl, setLocalUrl] = useState(initial.localUrl);
  const [tailscaleUrl, setTailscaleUrl] = useState(initial.tailscaleUrl);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initial.authMethod);
  const [apiToken, setApiToken] = useState(initial.apiToken);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState(initial.password);
  const [lanTimeoutMs, setLanTimeoutMs] = useState(String(initial.lanTimeoutMs));
  const [allowSelfSignedCert, setAllowSelfSignedCert] = useState(initial.allowSelfSignedCert);
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(initial.autoLoginEnabled);
  const [disconnectVpnOnExit, setDisconnectVpnOnExit] = useState(initial.disconnectVpnOnExit);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...initial,
      localUrl,
      tailscaleUrl,
      authMethod,
      apiToken,
      username,
      password,
      lanTimeoutMs: Math.max(400, Number(lanTimeoutMs) || 1500),
      allowSelfSignedCert,
      autoLoginEnabled,
      disconnectVpnOnExit,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-xl border border-[#232C36] bg-[#12171D] text-[#E6EDF3] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-[#232C36] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">ScamController Settings</h2>
            <p className="text-xs text-[#8B98A5]">
              LAN / Tailscale routing &amp; Crafty Controller v4 authentication
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close settings"
            className="rounded-md p-1.5 text-[#8B98A5] hover:bg-[#1A212A] hover:text-[#E6EDF3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                Local LAN URL
              </label>
              <input
                type="url"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="https://192.168.1.50:8443"
                className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                Tailscale URL
              </label>
              <input
                type="url"
                value={tailscaleUrl}
                onChange={(e) => setTailscaleUrl(e.target.value)}
                placeholder="https://crafty-node.tailnet.ts.net:8443"
                className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                Authentication Method
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#232C36] bg-[#0B0E11] p-1">
                <button
                  type="button"
                  onClick={() => setAuthMethod('credentials')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    authMethod === 'credentials'
                      ? 'bg-[#12171D] text-[#10B981]'
                      : 'text-[#8B98A5] hover:text-[#E6EDF3]'
                  }`}
                >
                  Username &amp; Password
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('token')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    authMethod === 'token'
                      ? 'bg-[#12171D] text-[#10B981]'
                      : 'text-[#8B98A5] hover:text-[#E6EDF3]'
                  }`}
                >
                  Crafty v4 API Token
                </button>
              </div>
            </div>

            {authMethod === 'token' ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                  Crafty API Bearer Token
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Paste API key from Crafty Profile -> API Keys"
                  className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                    Crafty Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                    Crafty Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
                LAN Probe Timeout (ms)
              </label>
              <input
                type="number"
                min={400}
                max={10000}
                value={lanTimeoutMs}
                onChange={(e) => setLanTimeoutMs(e.target.value)}
                className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs tabular-nums text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 border-t border-[#232C36] pt-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
              <span className="text-xs text-[#E6EDF3]">
                Trust self-signed cert for configured hosts
              </span>
              <input
                type="checkbox"
                checked={allowSelfSignedCert}
                onChange={(e) => setAllowSelfSignedCert(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
              <span className="text-xs text-[#E6EDF3]">
                Auto-authenticate on connection
              </span>
              <input
                type="checkbox"
                checked={autoLoginEnabled}
                onChange={(e) => setAutoLoginEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
              <span className="text-xs text-[#E6EDF3]">
                Disconnect Tailscale VPN on Android app exit
              </span>
              <input
                type="checkbox"
                checked={disconnectVpnOnExit}
                onChange={(e) => setDisconnectVpnOnExit(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-[#232C36] pt-3">
            <button
              type="button"
              onClick={onDisconnectVpn}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#E6EDF3] hover:border-[#374352]"
            >
              Disconnect VPN
            </button>
            <button
              type="button"
              onClick={onClearCredentials}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#F59E0B] hover:border-[#F59E0B]/40"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Clear Credentials
            </button>
          </div>

          {activeBaseUrl && !activeBaseUrl.startsWith('sandbox://') && (
            <a
              href={activeBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#8B98A5] hover:text-[#E6EDF3]"
            >
              <span>Open original Crafty URL in browser tab</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-[#0B0E11] transition-colors hover:bg-[#0ea572]"
          >
            Save &amp; Connect
          </button>
        </form>
      </div>
    </div>
  );
}
