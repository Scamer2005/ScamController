import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  CalendarClock,
  FolderOpen,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Server,
  ServerCog,
  Settings,
  Terminal,
  Users,
  Users2,
  X,
} from 'lucide-react';
import { BackupsPanel } from './components/BackupsPanel';
import { ConnectionProgressView, UnreachableRecoveryView } from './components/ConnectionStates';
import { ConsolePanel } from './components/ConsolePanel';
import { FileManagerPanel } from './components/FileManagerPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { PlayersPanel } from './components/PlayersPanel';
import { SchedulesPanel } from './components/SchedulesPanel';
import { CreateServerModal, ServerSettingsPanel } from './components/ServerSettingsPanel';
import { SettingsModal } from './components/SettingsModal';
import { UsersRolesPanel } from './components/UsersRolesPanel';
import { clearStoredCredentials, DEFAULT_SERVER_CONFIG } from './data/credentialStore';
import { useConnectionOrchestrator } from './hooks/useConnectionOrchestrator';
import { ServerPowerAction } from './network/craftyApi';
import { CraftyServer, CraftyServerCreateInput, WorkspaceTab } from './types/crafty';

interface NavGroup {
  heading: string;
  items: Array<{ id: WorkspaceTab; label: string; icon: typeof Activity }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Server',
    items: [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'console', label: 'Console', icon: Terminal },
      { id: 'players', label: 'Players', icon: Users },
    ],
  },
  {
    heading: 'Files & Safety',
    items: [
      { id: 'files', label: 'Files & Properties', icon: FolderOpen },
      { id: 'backups', label: 'Backups', icon: Archive },
      { id: 'schedules', label: 'Schedules', icon: CalendarClock },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { id: 'server-settings', label: 'Server Config', icon: ServerCog },
      { id: 'users', label: 'Users & Roles', icon: Users2 },
    ],
  },
];

const MOBILE_PRIMARY_TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'files', label: 'Files', icon: FolderOpen },
];

const MOBILE_MORE_TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof Activity }> = [
  { id: 'players', label: 'Players', icon: Users },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock },
  { id: 'server-settings', label: 'Server Config', icon: ServerCog },
  { id: 'users', label: 'Users & Roles', icon: Users2 },
];

export function App() {
  const {
    uiState,
    client,
    startConnectionSequence,
    updateConfig,
    enterSandboxMode,
    disconnectTailscaleVpn,
    clearBanner,
  } = useConnectionOrchestrator();

  const [showSettings, setShowSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [servers, setServers] = useState<CraftyServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [loadingServers, setLoadingServers] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    if (!client) return;
    setLoadingServers(true);
    setServerError(null);
    try {
      const list = await client.listServers();
      setServers(list);
      setSelectedServerId((prev) =>
        list.some((s) => s.server_id === prev) ? prev : list[0]?.server_id || ''
      );
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to load servers from Crafty');
    } finally {
      setLoadingServers(false);
    }
  }, [client]);

  useEffect(() => {
    if (client) {
      void loadServers();
    } else {
      setServers([]);
    }
  }, [client, loadServers]);

  useEffect(() => {
    if (!client || !selectedServerId) return;
    const timer = window.setInterval(async () => {
      try {
        const stats = await client.getServerStats(selectedServerId);
        if (stats) {
          setServers((prev) => prev.map((s) => (s.server_id === selectedServerId ? stats : s)));
        }
      } catch {
        // Ignore transient poll glitches
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [client, selectedServerId]);

  const activeServer = servers.find((s) => s.server_id === selectedServerId) || null;

  const handlePowerAction = async (action: ServerPowerAction) => {
    if (!client || !activeServer) return;
    setActionLoading(action);
    setServerError(null);
    try {
      await client.sendAction(activeServer.server_id, action);
      const refreshed = await client.getServerStats(activeServer.server_id);
      if (refreshed) {
        setServers((prev) =>
          prev.map((s) => (s.server_id === activeServer.server_id ? refreshed : s))
        );
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Server action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateServer = async (input: CraftyServerCreateInput) => {
    if (!client) return;
    const created = await client.createServer(input);
    await loadServers();
    setSelectedServerId(created.server_id);
    setActiveTab('overview');
  };

  const routeLabel =
    uiState.activeRoute === 'LAN'
      ? `LAN · ${uiState.lastLatencyMs ?? 0}ms`
      : uiState.activeRoute === 'TAILSCALE'
        ? `Tailscale · ${uiState.lastLatencyMs ?? 0}ms`
        : uiState.activeRoute === 'SANDBOX'
          ? 'Sandbox'
          : 'Connecting';

  const currentTabLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((t) => t.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0E11] text-[#E6EDF3]">
      {/* Clean Single-Purpose Top Bar */}
      <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-4 border-b border-[#232C36] bg-[#12171D] px-4 lg:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold tracking-tight text-[#E6EDF3] whitespace-nowrap shrink-0">
            ScamController
          </span>
          {activeServer && (
            <div className="hidden md:flex items-center gap-2 text-xs text-[#8B98A5] min-w-0">
              <span aria-hidden="true">/</span>
              <span className="truncate font-medium text-[#E6EDF3]">{activeServer.server_name}</span>
              <span aria-hidden="true">/</span>
              <span className="whitespace-nowrap">{currentTabLabel}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-mono text-xs tabular-nums whitespace-nowrap ${
              uiState.activeRoute === 'NONE'
                ? 'text-[#F59E0B]'
                : uiState.activeRoute === 'SANDBOX'
                  ? 'text-[#06B6D4]'
                  : 'text-[#10B981]'
            }`}
          >
            {routeLabel}
          </span>

          <button
            type="button"
            onClick={() => void startConnectionSequence()}
            aria-label="Reconnect"
            title="Reconnect"
            className="rounded-lg border border-[#232C36] bg-[#0B0E11] p-2 text-[#8B98A5] hover:border-[#374352] hover:text-[#E6EDF3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-1.5 text-xs font-medium text-[#E6EDF3] hover:border-[#374352] whitespace-nowrap"
          >
            <Settings className="h-3.5 w-3.5 text-[#8B98A5]" />
            Connection
          </button>
        </div>
      </header>

      {uiState.authStatusMessage && (
        <div className="flex items-center justify-between border-b border-[#F59E0B]/30 bg-[#1A160B] px-4 py-1.5 text-xs text-[#F59E0B]">
          <span>{uiState.authStatusMessage}</span>
          <button type="button" onClick={clearBanner} className="ml-4 text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      {uiState.phase.type === 'ErrorUnreachable' ? (
        <UnreachableRecoveryView
          detail={uiState.phase.detail}
          localUrl={uiState.config.localUrl}
          tailscaleUrl={uiState.config.tailscaleUrl}
          tailscaleInstalled={uiState.phase.tailscaleInstalled}
          onRetry={() => void startConnectionSequence()}
          onOpenSettings={() => setShowSettings(true)}
          onLaunchSandbox={enterSandboxMode}
        />
      ) : uiState.phase.type !== 'ReadyDashboard' || !client ? (
        <ConnectionProgressView phase={uiState.phase} />
      ) : (
        <div className="flex flex-1 flex-col md:flex-row">
          {/* Desktop Sidebar: Server Switcher + Grouped Sections */}
          <aside className="hidden w-64 shrink-0 flex-col border-r border-[#232C36] bg-[#12171D] md:flex">
            <div className="flex items-center justify-between border-b border-[#232C36] px-4 py-3">
              <span className="text-xs font-semibold text-[#8B98A5]">Servers</span>
              <button
                type="button"
                onClick={() => setShowCreateServer(true)}
                className="inline-flex items-center gap-1 rounded-md border border-[#232C36] bg-[#0B0E11] px-2 py-1 text-[11px] font-medium text-[#10B981] hover:border-[#10B981]/50"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto border-b border-[#232C36] p-2.5">
              {loadingServers ? (
                <div className="space-y-1.5 p-1">
                  <div className="h-10 animate-pulse rounded bg-[#0B0E11]" />
                  <div className="h-10 animate-pulse rounded bg-[#0B0E11]" />
                </div>
              ) : servers.length === 0 ? (
                <div className="p-2 text-xs text-[#8B98A5]">No servers found.</div>
              ) : (
                servers.map((srv) => {
                  const isSelected = srv.server_id === selectedServerId;
                  return (
                    <button
                      key={srv.server_id}
                      type="button"
                      onClick={() => setSelectedServerId(srv.server_id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border border-[#10B981]/40 bg-[#0B0E11]'
                          : 'border border-transparent hover:bg-[#161D24]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#E6EDF3]">
                          {srv.server_name}
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            srv.running ? 'text-[#10B981]' : 'text-[#8B98A5]'
                          }`}
                        >
                          {srv.running ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#8B98A5]">
                        :{srv.server_port} · {srv.online}/{srv.max} players
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto p-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.heading}>
                  <div className="mb-1.5 px-2.5 text-[11px] font-semibold text-[#8B98A5]">
                    {group.heading}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-[#0B0E11] text-[#10B981]'
                              : 'text-[#8B98A5] hover:bg-[#161D24] hover:text-[#E6EDF3]'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Mobile Compact Server Selector */}
          <div className="flex items-center gap-2 border-b border-[#232C36] bg-[#12171D] px-3 py-2.5 md:hidden">
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="flex-1 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#E6EDF3]"
            >
              {servers.map((srv) => (
                <option key={srv.server_id} value={srv.server_id}>
                  {srv.server_name} ({srv.running ? 'Online' : 'Offline'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateServer(true)}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] p-2 text-[#10B981]"
              aria-label="Add server"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Main Workspace Viewport */}
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6 lg:p-6">
            {serverError && (
              <div className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2.5 text-xs text-[#EF4444]">
                {serverError}
              </div>
            )}

            {activeTab === 'users' ? (
              <UsersRolesPanel client={client} />
            ) : !activeServer ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#232C36] bg-[#12171D] p-10 text-center">
                <Server className="h-8 w-8 text-[#8B98A5]" />
                <h3 className="mt-3 text-sm font-semibold text-[#E6EDF3]">No Server Selected</h3>
                <p className="mt-1 text-xs text-[#8B98A5]">
                  Add a new Crafty server or refresh the connection.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateServer(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#0B0E11]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Server
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <OverviewPanel
                    client={client}
                    server={activeServer}
                    actionLoading={actionLoading}
                    onPowerAction={handlePowerAction}
                    onNavigateTab={setActiveTab}
                  />
                )}
                {activeTab === 'console' && (
                  <ConsolePanel
                    client={client}
                    server={activeServer}
                    onActionCompleted={() => void loadServers()}
                  />
                )}
                {activeTab === 'files' && (
                  <FileManagerPanel client={client} server={activeServer} />
                )}
                {activeTab === 'backups' && (
                  <BackupsPanel client={client} server={activeServer} />
                )}
                {activeTab === 'schedules' && (
                  <SchedulesPanel client={client} server={activeServer} />
                )}
                {activeTab === 'players' && (
                  <PlayersPanel
                    client={client}
                    server={activeServer}
                    onActionCompleted={() => void loadServers()}
                  />
                )}
                {activeTab === 'server-settings' && (
                  <ServerSettingsPanel
                    client={client}
                    server={activeServer}
                    onUpdated={() => void loadServers()}
                    onDeleted={() => void loadServers()}
                  />
                )}
              </>
            )}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#232C36] bg-[#12171D] md:hidden">
            {MOBILE_PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowMobileMore(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                    active ? 'text-[#10B981]' : 'text-[#8B98A5]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowMobileMore((v) => !v)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                MOBILE_MORE_TABS.some((t) => t.id === activeTab) || showMobileMore
                  ? 'text-[#10B981]'
                  : 'text-[#8B98A5]'
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
          </nav>

          {/* Mobile More Sheet */}
          {showMobileMore && (
            <div className="fixed inset-0 z-40 flex items-end bg-black/60 md:hidden">
              <div className="w-full rounded-t-xl border-t border-[#232C36] bg-[#12171D] p-4 pb-8">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#E6EDF3]">More Tools</span>
                  <button
                    type="button"
                    onClick={() => setShowMobileMore(false)}
                    className="p-1 text-[#8B98A5]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MOBILE_MORE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowMobileMore(false);
                        }}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-3 text-xs font-medium ${
                          active
                            ? 'border-[#10B981]/40 bg-[#0B0E11] text-[#10B981]'
                            : 'border-[#232C36] bg-[#0B0E11] text-[#E6EDF3]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <SettingsModal
          initial={uiState.config}
          activeBaseUrl={uiState.activeBaseUrl}
          onDismiss={() => setShowSettings(false)}
          onSave={(updated) => {
            setShowSettings(false);
            updateConfig(updated, true);
          }}
          onDisconnectVpn={disconnectTailscaleVpn}
          onClearCredentials={() => {
            clearStoredCredentials();
            updateConfig(DEFAULT_SERVER_CONFIG, false);
          }}
        />
      )}

      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={handleCreateServer}
        />
      )}
    </div>
  );
}

export default App;
