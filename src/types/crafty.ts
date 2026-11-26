export const DEFAULT_LOCAL_URL = 'https://192.168.1.50:8443';
export const DEFAULT_TAILSCALE_URL = 'https://crafty-node.tailnet.ts.net:8443';

export type AuthMethod = 'token' | 'credentials';

export interface ServerConfig {
  localUrl: string;
  tailscaleUrl: string;
  authMethod: AuthMethod;
  apiToken: string;
  username: string;
  password: string;
  lanTimeoutMs: number;
  vpnConnectTimeoutMs: number;
  allowSelfSignedCert: boolean;
  autoLoginEnabled: boolean;
  disconnectVpnOnExit: boolean;
}

export function isServerConfigured(config: ServerConfig): boolean {
  return config.localUrl.trim().length > 0 || config.tailscaleUrl.trim().length > 0;
}

export type ActiveRoute = 'NONE' | 'LAN' | 'TAILSCALE' | 'SANDBOX';

export type ConnectionPhase =
  | { type: 'Idle' }
  | { type: 'ProbingLan'; url: string }
  | { type: 'TriggeringTailscale' }
  | { type: 'WaitingForVpn'; detail: string }
  | { type: 'Authenticating'; targetUrl: string; route: ActiveRoute }
  | { type: 'ReadyDashboard'; targetUrl: string; route: ActiveRoute }
  | { type: 'ErrorUnreachable'; detail: string; tailscaleInstalled: boolean };

export type WorkspaceTab =
  | 'overview'
  | 'console'
  | 'files'
  | 'backups'
  | 'schedules'
  | 'players'
  | 'users'
  | 'server-settings';

export interface ConnectionUiState {
  config: ServerConfig;
  phase: ConnectionPhase;
  activeRoute: ActiveRoute;
  activeBaseUrl: string;
  activeToken: string;
  lastLatencyMs: number | null;
  authStatusMessage: string | null;
}

export type ProbeResult =
  | { reachable: true; latencyMs: number; statusCode: number }
  | { reachable: false; reason: string };

export interface CraftyServer {
  server_id: string;
  server_name: string;
  type: string;
  server_port: number;
  server_ip: string;
  executable: string;
  execution_command: string;
  java_selection?: string;
  auto_start: boolean;
  crash_detection: boolean;
  stop_command: string;
  log_path: string;
  path: string;
  created?: string;
  running: boolean;
  crashed?: boolean;
  cpu: number;
  mem: string;
  mem_percent: number;
  world_name: string;
  world_size: string;
  online: number;
  max: number;
  players: string[];
  version: string;
  desc: string;
  updating?: boolean;
  waiting_start?: boolean;
}

export interface ServerFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  sizeLabel?: string;
  modified: string;
}

export interface ServerBackup {
  backup_id: string;
  backup_name: string;
  backup_path: string;
  created: string;
  size_bytes: number;
  size_label: string;
  included_dirs?: string[];
  excluded_dirs?: string[];
}

export interface BackupConfig {
  backup_id?: string;
  backup_name: string;
  backup_location: string;
  max_backups: number;
  compress: boolean;
  shutdown: boolean;
  excluded_dirs: string[];
  before_backup_command?: string;
  after_backup_command?: string;
}

export interface ScheduledTask {
  schedule_id: string;
  server_id: string;
  name: string;
  action: 'start' | 'stop' | 'restart' | 'backup' | 'command';
  command: string;
  interval: number;
  interval_type: 'minutes' | 'hours' | 'days' | 'cron';
  cron_string: string;
  enabled: boolean;
  one_time: boolean;
  next_run?: string;
}

export interface CraftyUser {
  user_id: string;
  username: string;
  email: string;
  enabled: boolean;
  superuser: boolean;
  roles: string[];
  last_login?: string;
}

export interface CraftyRole {
  role_id: string;
  role_name: string;
  permissions: string[];
}

export interface PlayerRecord {
  name: string;
  online: boolean;
  isOp: boolean;
  whitelisted: boolean;
  banned: boolean;
  pingMs?: number;
  joinedAt?: string;
}

export interface CraftyServerCreateInput {
  server_name: string;
  type: 'minecraft-java' | 'minecraft-bedrock';
  server_port: number;
  executable: string;
  execution_command: string;
  auto_start: boolean;
}
