import { useEffect, useState } from 'react';
import {
  Archive,
  CalendarClock,
  FolderOpen,
  Play,
  RotateCw,
  Skull,
  Square,
  Terminal,
  Users,
} from 'lucide-react';
import { CraftyClient, ServerPowerAction } from '../network/craftyApi';
import { CraftyServer, WorkspaceTab } from '../types/crafty';

interface OverviewPanelProps {
  client: CraftyClient;
  server: CraftyServer;
  actionLoading: string | null;
  onPowerAction: (action: ServerPowerAction) => Promise<void>;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

export function OverviewPanel({
  client,
  server,
  actionLoading,
  onPowerAction,
  onNavigateTab,
}: OverviewPanelProps) {
  const [confirmKill, setConfirmKill] = useState(false);
  const [recentLogs, setRecentLogs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    client
      .getLogs(server.server_id)
      .then((lines) => {
        if (!cancelled) setRecentLogs(lines.slice(-6));
      })
      .catch(() => {
        if (!cancelled) setRecentLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, server.server_id, server.running]);

  return (
    <div className="space-y-5">
      {/* Primary Server Hero & Separated Power Controls */}
      <div className="flex flex-col justify-between gap-5 rounded-xl border border-[#232C36] bg-[#12171D] p-5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B98A5]">
            <span
              className={`font-semibold ${
                server.running ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {server.running ? 'Online' : 'Offline'}
            </span>
            <span>·</span>
            <span className="font-mono">{server.version}</span>
            <span>·</span>
            <span className="font-mono tabular-nums">Port {server.server_port}</span>
          </div>
          <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-[#E6EDF3]">
            {server.server_name}
          </h1>
          <p className="mt-1 truncate text-xs text-[#8B98A5]">
            {server.desc || server.executable}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!server.running ? (
            <button
              type="button"
              disabled={Boolean(actionLoading)}
              onClick={() => void onPowerAction('start_server')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#0ea572] disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              {actionLoading === 'start_server' ? 'Starting...' : 'Start Server'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={Boolean(actionLoading)}
                onClick={() => void onPowerAction('restart_server')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3.5 py-2 text-xs font-medium text-[#E6EDF3] hover:border-[#06B6D4]/50 disabled:opacity-50 whitespace-nowrap"
              >
                <RotateCw className="h-3.5 w-3.5 text-[#06B6D4]" />
                {actionLoading === 'restart_server' ? 'Restarting...' : 'Restart'}
              </button>
              <button
                type="button"
                disabled={Boolean(actionLoading)}
                onClick={() => void onPowerAction('stop_server')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3.5 py-2 text-xs font-medium text-[#F59E0B] hover:bg-[#F59E0B]/15 disabled:opacity-50 whitespace-nowrap"
              >
                <Square className="h-3.5 w-3.5" />
                {actionLoading === 'stop_server' ? 'Stopping...' : 'Stop'}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={Boolean(actionLoading)}
            onClick={() => void onPowerAction('backup_server')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3.5 py-2 text-xs font-medium text-[#E6EDF3] hover:border-[#10B981]/50 disabled:opacity-50 whitespace-nowrap"
          >
            <Archive className="h-3.5 w-3.5 text-[#10B981]" />
            {actionLoading === 'backup_server' ? 'Backing up...' : 'Backup Now'}
          </button>

          {server.running && (
            <div className="border-l border-[#232C36] pl-2.5">
              {confirmKill ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmKill(false);
                      void onPowerAction('kill_server');
                    }}
                    className="text-xs font-semibold text-[#EF4444]"
                  >
                    Confirm Kill
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmKill(false)}
                    className="text-xs text-[#8B98A5]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(actionLoading)}
                  onClick={() => setConfirmKill(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#EF4444] hover:border-[#EF4444]/50 disabled:opacity-50 whitespace-nowrap"
                >
                  <Skull className="h-3.5 w-3.5" />
                  Force Kill
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4-Column Resource Telemetry */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
          <div className="text-xs text-[#8B98A5]">CPU Load</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#E6EDF3]">
            {server.cpu.toFixed(1)}%
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0B0E11]">
            <div
              className="h-full bg-[#10B981] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, server.cpu))}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
          <div className="text-xs text-[#8B98A5]">Memory Usage</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#E6EDF3]">
            {server.mem_percent.toFixed(1)}%
          </div>
          <div className="mt-1.5 font-mono text-xs tabular-nums text-[#8B98A5]">{server.mem}</div>
        </div>

        <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
          <div className="text-xs text-[#8B98A5]">Players Online</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#E6EDF3]">
            {server.online} / {server.max}
          </div>
          <div className="mt-1.5 truncate text-xs text-[#8B98A5]">
            {server.players.length > 0 ? server.players.join(', ') : 'Empty server'}
          </div>
        </div>

        <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
          <div className="text-xs text-[#8B98A5]">World Size</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#E6EDF3]">
            {server.world_size}
          </div>
          <div className="mt-1.5 truncate font-mono text-xs text-[#8B98A5]">
            {server.world_name}
          </div>
        </div>
      </div>

      {/* Live Console Preview + Quick Jump & Online Players */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl border border-[#232C36] bg-[#12171D] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#232C36] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF3]">
              <Terminal className="h-4 w-4 text-[#10B981]" />
              Recent Console Output
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('console')}
              className="text-xs font-medium text-[#10B981] hover:underline"
            >
              Open Full Console
            </button>
          </div>
          <div className="flex-1 bg-[#0B0E11] p-4 font-mono text-xs leading-relaxed">
            {recentLogs.length === 0 ? (
              <p className="text-[#8B98A5]">No recent console output.</p>
            ) : (
              recentLogs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`} className="truncate py-0.5 text-[#D0D7DE]">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
            <div className="flex items-center justify-between border-b border-[#232C36] pb-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF3]">
                <Users className="h-4 w-4 text-[#06B6D4]" />
                Active Players ({server.players.length})
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('players')}
                className="text-xs font-medium text-[#10B981] hover:underline"
              >
                Manage
              </button>
            </div>
            {server.players.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B98A5]">
                {server.running ? 'No players currently online.' : 'Start the server to accept players.'}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-xs text-[#E6EDF3]">
                {server.players.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#232C36] bg-[#12171D] p-4">
            <h3 className="border-b border-[#232C36] pb-2.5 text-sm font-semibold text-[#E6EDF3]">
              Quick Actions
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('files')}
                className="flex items-center gap-2 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2.5 text-left text-xs font-medium text-[#E6EDF3] hover:border-[#10B981]/50"
              >
                <FolderOpen className="h-4 w-4 text-[#06B6D4]" />
                server.properties
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('schedules')}
                className="flex items-center gap-2 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2.5 text-left text-xs font-medium text-[#E6EDF3] hover:border-[#10B981]/50"
              >
                <CalendarClock className="h-4 w-4 text-[#F59E0B]" />
                Schedules
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
