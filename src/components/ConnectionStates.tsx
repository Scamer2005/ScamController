import { KeyRound, Loader2, Play, RefreshCw, Server, Settings, WifiOff } from 'lucide-react';
import { ConnectionPhase } from '../types/crafty';

interface ProgressProps {
  phase: ConnectionPhase;
}

export function ConnectionProgressView({ phase }: ProgressProps) {
  let title = 'Connecting to Crafty Controller';
  let detail = 'Initializing ScamController...';

  if (phase.type === 'ProbingLan') {
    title = 'Checking Local Network';
    detail = phase.url;
  } else if (phase.type === 'TriggeringTailscale') {
    title = 'Local Server Unreachable';
    detail = 'Switching to Tailscale fallback route...';
  } else if (phase.type === 'WaitingForVpn') {
    title = 'Connecting via Tailscale';
    detail = phase.detail;
  } else if (phase.type === 'Authenticating') {
    title = 'Signing In';
    detail = `Authenticating Crafty API v2 at ${phase.targetUrl}`;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm rounded-xl border border-[#232C36] bg-[#12171D] p-7">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#10B981]" />
        <h2 className="mt-4 text-base font-semibold text-[#E6EDF3]">{title}</h2>
        <p className="mt-1.5 break-all font-mono text-xs text-[#8B98A5]">{detail}</p>
      </div>
    </div>
  );
}

interface RecoveryProps {
  detail: string;
  localUrl: string;
  tailscaleUrl: string;
  tailscaleInstalled: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
  onLaunchSandbox: () => void;
}

export function UnreachableRecoveryView({
  detail,
  localUrl,
  tailscaleUrl,
  tailscaleInstalled,
  onRetry,
  onOpenSettings,
  onLaunchSandbox,
}: RecoveryProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-[#232C36] bg-[#12171D] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]">
            <WifiOff className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#E6EDF3]">No Crafty Server Connected</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#8B98A5]">{detail}</p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-[#232C36] rounded-lg border border-[#232C36] bg-[#0B0E11] text-xs">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="text-[#8B98A5]">Local LAN</span>
            <span className="truncate font-mono text-[#E6EDF3]">{localUrl || 'Not configured'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="text-[#8B98A5]">Tailscale</span>
            <span className="truncate font-mono text-[#E6EDF3]">
              {tailscaleUrl || 'Not configured'}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#0ea572]"
          >
            <Settings className="h-4 w-4" />
            Configure Server &amp; Login
          </button>

          <button
            type="button"
            onClick={onLaunchSandbox}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-4 py-2.5 text-xs font-semibold text-[#06B6D4] transition-colors hover:bg-[#06B6D4]/15"
          >
            <Play className="h-4 w-4" />
            Open Preview Sandbox
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#232C36] pt-4 text-xs">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 font-medium text-[#E6EDF3] hover:text-[#10B981]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Probe
          </button>

          {tailscaleInstalled && (
            <a
              href={tailscaleUrl || 'https://login.tailscale.com/admin/machines'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#8B98A5] hover:text-[#E6EDF3]"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Tailscale Machines
            </a>
          )}

          <span className="inline-flex items-center gap-1.5 text-[#8B98A5]">
            <Server className="h-3.5 w-3.5" />
            Crafty API v2
          </span>
        </div>
      </div>
    </div>
  );
}
