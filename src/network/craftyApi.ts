import {
  BackupConfig,
  CraftyRole,
  CraftyServer,
  CraftyServerCreateInput,
  CraftyUser,
  ScheduledTask,
  ServerBackup,
  ServerFileEntry,
} from '../types/crafty';

export type ServerPowerAction =
  | 'start_server'
  | 'stop_server'
  | 'restart_server'
  | 'kill_server'
  | 'backup_server'
  | 'update_executable'
  | 'eula';

export interface CraftyClient {
  readonly isSandbox: boolean;
  listServers(): Promise<CraftyServer[]>;
  getServerStats(serverId: string): Promise<CraftyServer | null>;
  createServer(input: CraftyServerCreateInput): Promise<CraftyServer>;
  updateServer(serverId: string, patch: Partial<CraftyServer>): Promise<void>;
  deleteServer(serverId: string): Promise<void>;
  sendAction(serverId: string, action: ServerPowerAction, actionId?: string): Promise<void>;
  getLogs(serverId: string): Promise<string[]>;
  sendStdin(serverId: string, command: string): Promise<void>;
  listFiles(serverId: string, dirPath: string): Promise<ServerFileEntry[]>;
  readFile(serverId: string, filePath: string): Promise<string>;
  writeFile(serverId: string, filePath: string, content: string): Promise<void>;
  createFileOrDir(serverId: string, dirPath: string, name: string, isDir: boolean): Promise<void>;
  deleteFile(serverId: string, filePath: string): Promise<void>;
  renameFile(serverId: string, oldPath: string, newName: string): Promise<void>;
  listBackups(serverId: string): Promise<ServerBackup[]>;
  getBackupConfig(serverId: string): Promise<BackupConfig>;
  updateBackupConfig(serverId: string, config: BackupConfig): Promise<void>;
  restoreBackup(serverId: string, backupId: string): Promise<void>;
  deleteBackup(serverId: string, backupId: string): Promise<void>;
  listTasks(serverId: string): Promise<ScheduledTask[]>;
  createTask(serverId: string, task: Omit<ScheduledTask, 'schedule_id' | 'server_id'>): Promise<ScheduledTask>;
  updateTask(serverId: string, scheduleId: string, patch: Partial<ScheduledTask>): Promise<void>;
  deleteTask(serverId: string, scheduleId: string): Promise<void>;
  runTask(serverId: string, scheduleId: string): Promise<void>;
  listUsers(): Promise<CraftyUser[]>;
  createUser(input: { username: string; email: string; password: string; superuser: boolean; roles: string[] }): Promise<CraftyUser>;
  updateUser(userId: string, patch: Partial<CraftyUser>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  listRoles(): Promise<CraftyRole[]>;
  createRole(input: { role_name: string; permissions: string[] }): Promise<CraftyRole>;
  deleteRole(roleId: string): Promise<void>;
}

export async function loginToCrafty(
  baseUrl: string,
  username: string,
  password: string,
  allowSelfSignedCert: boolean
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/crafty/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, username, password, allowSelfSignedCert }),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      error?: string;
      data?: { status?: string; data?: { token?: string }; error?: string; info?: string };
    };
    const token = payload.data?.data?.token;
    if (payload.ok && token) {
      return { ok: true, token };
    }
    const errMsg =
      payload.error ||
      payload.data?.error ||
      payload.data?.info ||
      `Authentication failed (HTTP ${res.status})`;
    return { ok: false, error: errMsg };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Login request failed' };
  }
}

interface ProxyResponse<T> {
  ok: boolean;
  status: number;
  error?: string;
  data: { status?: string; data?: T; error?: string; info?: string } | T;
}

export class LiveCraftyClient implements CraftyClient {
  readonly isSandbox = false;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly allowSelfSignedCert: boolean
  ) {}

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    options?: { body?: unknown; rawBody?: string; contentType?: string }
  ): Promise<T> {
    const res = await fetch('/api/crafty/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: this.baseUrl,
        token: this.token,
        method,
        path,
        body: options?.body,
        rawBody: options?.rawBody,
        contentType: options?.contentType,
        allowSelfSignedCert: this.allowSelfSignedCert,
      }),
    });

    const json = (await res.json()) as ProxyResponse<T>;
    if (!json.ok) {
      const wrapped = json.data as { error?: string; info?: string } | undefined;
      throw new Error(json.error || wrapped?.error || wrapped?.info || `Crafty API error (${json.status})`);
    }

    if (json.data && typeof json.data === 'object' && 'data' in json.data) {
      return (json.data as { data: T }).data;
    }
    return json.data as T;
  }

  async listServers(): Promise<CraftyServer[]> {
    const rows = await this.request<Partial<CraftyServer>[]>('GET', '/servers');
    const enriched = await Promise.all(
      (Array.isArray(rows) ? rows : []).map(async (srv) => {
        const id = String(srv.server_id || '');
        const stats = id ? await this.getServerStats(id).catch(() => null) : null;
        return {
          server_id: id,
          server_name: srv.server_name || stats?.server_name || 'Unnamed Server',
          type: srv.type || stats?.type || 'minecraft-java',
          server_port: Number(srv.server_port ?? stats?.server_port ?? 25565),
          server_ip: srv.server_ip || stats?.server_ip || '0.0.0.0',
          executable: srv.executable || stats?.executable || 'server.jar',
          execution_command: srv.execution_command || stats?.execution_command || '',
          java_selection: srv.java_selection || stats?.java_selection,
          auto_start: Boolean(srv.auto_start ?? stats?.auto_start),
          crash_detection: Boolean(srv.crash_detection ?? stats?.crash_detection),
          stop_command: srv.stop_command || stats?.stop_command || 'stop',
          log_path: srv.log_path || stats?.log_path || 'logs/latest.log',
          path: srv.path || stats?.path || '',
          created: srv.created || stats?.created,
          running: Boolean(stats?.running ?? srv.running),
          crashed: Boolean(stats?.crashed ?? srv.crashed),
          cpu: Number(stats?.cpu ?? srv.cpu ?? 0),
          mem: String(stats?.mem ?? srv.mem ?? '0 MB'),
          mem_percent: Number(stats?.mem_percent ?? srv.mem_percent ?? 0),
          world_name: String(stats?.world_name ?? srv.world_name ?? 'world'),
          world_size: String(stats?.world_size ?? srv.world_size ?? '0 MB'),
          online: Number(stats?.online ?? srv.online ?? 0),
          max: Number(stats?.max ?? srv.max ?? 20),
          players: Array.isArray(stats?.players) ? stats.players : [],
          version: String(stats?.version ?? srv.version ?? 'Unknown'),
          desc: String(stats?.desc ?? srv.desc ?? ''),
        } satisfies CraftyServer;
      })
    );
    return enriched;
  }

  async getServerStats(serverId: string): Promise<CraftyServer | null> {
    const raw = await this.request<Record<string, unknown>>('GET', `/servers/${serverId}/stats`);
    const serverIdObj = (raw.server_id as Record<string, unknown> | undefined) || {};
    let parsedPlayers: string[] = [];
    if (Array.isArray(raw.players)) {
      parsedPlayers = raw.players.map(String);
    } else if (typeof raw.players === 'string' && raw.players.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(raw.players.replace(/'/g, '"')) as unknown[];
        parsedPlayers = arr.map(String);
      } catch {
        parsedPlayers = [];
      }
    }

    return {
      server_id: String(serverIdObj.server_id ?? serverId),
      server_name: String(serverIdObj.server_name ?? raw.world_name ?? 'Server'),
      type: String(serverIdObj.type ?? 'minecraft-java'),
      server_port: Number(serverIdObj.server_port ?? 25565),
      server_ip: String(serverIdObj.server_ip ?? '0.0.0.0'),
      executable: String(serverIdObj.executable ?? ''),
      execution_command: String(serverIdObj.execution_command ?? ''),
      auto_start: Boolean(serverIdObj.auto_start),
      crash_detection: Boolean(serverIdObj.crash_detection),
      stop_command: String(serverIdObj.stop_command ?? 'stop'),
      log_path: String(serverIdObj.log_path ?? 'logs/latest.log'),
      path: String(serverIdObj.path ?? ''),
      running: Boolean(raw.running),
      crashed: Boolean(raw.crashed),
      cpu: Number(raw.cpu ?? 0),
      mem: String(raw.mem ?? '0 MB'),
      mem_percent: Number(raw.mem_percent ?? 0),
      world_name: String(raw.world_name ?? 'world'),
      world_size: String(raw.world_size ?? '0 MB'),
      online: Number(raw.online ?? 0),
      max: Number(raw.max ?? 20),
      players: parsedPlayers,
      version: String(raw.version ?? 'Unknown'),
      desc: String(raw.desc ?? ''),
      updating: Boolean(raw.updating),
      waiting_start: Boolean(raw.waiting_start),
    };
  }

  async createServer(input: CraftyServerCreateInput): Promise<CraftyServer> {
    const res = await this.request<{ server_id?: string }>('POST', '/servers', {
      body: {
        name: input.server_name,
        monitoring_type: 'minecraft_java',
        minecraft_java_monitoring_data: {
          host: '127.0.0.1',
          port: input.server_port,
        },
        create_type: 'minecraft_java',
        minecraft_java_create_data: {
          create_type: 'import_server',
          import_server_create_data: {
            existing_server_path: '',
            existing_executable_path: input.executable,
          },
        },
        server_name: input.server_name,
        type: input.type,
        server_port: input.server_port,
        executable: input.executable,
        execution_command: input.execution_command,
        auto_start: input.auto_start,
      },
    });
    return {
      server_id: res.server_id || crypto.randomUUID(),
      server_name: input.server_name,
      type: input.type,
      server_port: input.server_port,
      server_ip: '0.0.0.0',
      executable: input.executable,
      execution_command: input.execution_command,
      auto_start: input.auto_start,
      crash_detection: true,
      stop_command: 'stop',
      log_path: 'logs/latest.log',
      path: '',
      running: false,
      cpu: 0,
      mem: '0 MB',
      mem_percent: 0,
      world_name: 'world',
      world_size: '0 MB',
      online: 0,
      max: 20,
      players: [],
      version: '1.21',
      desc: input.server_name,
    };
  }

  async updateServer(serverId: string, patch: Partial<CraftyServer>): Promise<void> {
    await this.request('PATCH', `/servers/${serverId}`, { body: patch });
  }

  async deleteServer(serverId: string): Promise<void> {
    await this.request('DELETE', `/servers/${serverId}`);
  }

  async sendAction(serverId: string, action: ServerPowerAction, actionId?: string): Promise<void> {
    const suffix = actionId ? `/${actionId}` : '';
    await this.request('POST', `/servers/${serverId}/action/${action}${suffix}`);
  }

  async getLogs(serverId: string): Promise<string[]> {
    const res = await this.request<string[] | string>('GET', `/servers/${serverId}/logs`);
    if (Array.isArray(res)) return res.map(String);
    if (typeof res === 'string') return res.split('\n');
    return [];
  }

  async sendStdin(serverId: string, command: string): Promise<void> {
    await this.request('POST', `/servers/${serverId}/stdin`, {
      rawBody: command,
      contentType: 'text/plain',
    });
  }

  async listFiles(serverId: string, dirPath: string): Promise<ServerFileEntry[]> {
    const res = await this.request<
      Record<string, { path?: string; dir?: boolean; size?: number | string; modified?: string }>
    >('POST', `/servers/${serverId}/files`, { body: { page: 'files', path: dirPath } });
    if (!res || typeof res !== 'object') return [];
    return Object.entries(res)
      .filter(([key]) => key !== 'root_path' && key !== 'top' && key !== 'parent')
      .map(([name, meta]) => {
        const rawSize = meta?.size;
        const sizeBytes = typeof rawSize === 'number' ? rawSize : Number(rawSize) || 0;
        const sizeLabel = typeof rawSize === 'string' ? rawSize : undefined;
        return {
          name,
          path: meta?.path || `${dirPath ? `${dirPath}/` : ''}${name}`,
          isDir: Boolean(meta?.dir),
          sizeBytes,
          sizeLabel,
          modified: meta?.modified || '',
        };
      })
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  }

  async readFile(serverId: string, filePath: string): Promise<string> {
    const res = await this.request<string | { content?: string }>('POST', `/servers/${serverId}/files`, {
      body: { page: 'files', path: filePath },
    });
    if (typeof res === 'string') return res;
    return res?.content ?? '';
  }

  async writeFile(serverId: string, filePath: string, content: string): Promise<void> {
    await this.request('PATCH', `/servers/${serverId}/files`, {
      body: { path: filePath, contents: content, overwrite: true },
    });
  }

  async createFileOrDir(serverId: string, dirPath: string, name: string, isDir: boolean): Promise<void> {
    await this.request('PUT', `/servers/${serverId}/files/create`, {
      body: { parent: dirPath, name, directory: isDir },
    });
  }

  async deleteFile(serverId: string, filePath: string): Promise<void> {
    await this.request('DELETE', `/servers/${serverId}/files`, {
      body: { file_system_objects: [{ filename: filePath }] },
    });
  }

  async renameFile(serverId: string, oldPath: string, newName: string): Promise<void> {
    await this.request('PATCH', `/servers/${serverId}/files/create`, {
      body: { path: oldPath, new_name: newName },
    });
  }

  async listBackups(serverId: string): Promise<ServerBackup[]> {
    const res = await this.request<ServerBackup[] | { backups?: ServerBackup[] }>(
      'GET',
      `/servers/${serverId}/backups`
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.backups)) return res.backups;
    return [];
  }

  async getBackupConfig(serverId: string): Promise<BackupConfig> {
    const res = await this.request<Partial<BackupConfig>[]>('GET', `/servers/${serverId}/backups`);
    const first = Array.isArray(res) && res.length > 0 ? res[0] : {};
    return {
      backup_id: first.backup_id,
      backup_name: first.backup_name || 'Primary Backup',
      backup_location: first.backup_location || '/crafty/backups',
      max_backups: Number(first.max_backups ?? 5),
      compress: Boolean(first.compress ?? true),
      shutdown: Boolean(first.shutdown ?? false),
      excluded_dirs: Array.isArray(first.excluded_dirs) ? first.excluded_dirs : [],
    };
  }

  async updateBackupConfig(serverId: string, config: BackupConfig): Promise<void> {
    const path = config.backup_id
      ? `/servers/${serverId}/backups/backup/${config.backup_id}`
      : `/servers/${serverId}/backups`;
    await this.request('PATCH', path, { body: config });
  }

  async restoreBackup(serverId: string, backupId: string): Promise<void> {
    await this.request('POST', `/servers/${serverId}/action/backup_server/${backupId}`);
  }

  async deleteBackup(serverId: string, backupId: string): Promise<void> {
    await this.request('DELETE', `/servers/${serverId}/backups/backup/${backupId}`);
  }

  async listTasks(serverId: string): Promise<ScheduledTask[]> {
    const res = await this.request<ScheduledTask[]>('GET', `/servers/${serverId}/tasks`);
    return Array.isArray(res) ? res : [];
  }

  async createTask(
    serverId: string,
    task: Omit<ScheduledTask, 'schedule_id' | 'server_id'>
  ): Promise<ScheduledTask> {
    const res = await this.request<{ schedule_id?: string }>('POST', `/servers/${serverId}/tasks`, {
      body: task,
    });
    return {
      ...task,
      server_id: serverId,
      schedule_id: res.schedule_id || crypto.randomUUID(),
    };
  }

  async updateTask(serverId: string, scheduleId: string, patch: Partial<ScheduledTask>): Promise<void> {
    await this.request('PATCH', `/servers/${serverId}/tasks/${scheduleId}`, { body: patch });
  }

  async deleteTask(serverId: string, scheduleId: string): Promise<void> {
    await this.request('DELETE', `/servers/${serverId}/tasks/${scheduleId}`);
  }

  async runTask(serverId: string, scheduleId: string): Promise<void> {
    await this.request('POST', `/servers/${serverId}/tasks/${scheduleId}/run`);
  }

  async listUsers(): Promise<CraftyUser[]> {
    const res = await this.request<CraftyUser[]>('GET', '/users');
    return Array.isArray(res) ? res : [];
  }

  async createUser(input: {
    username: string;
    email: string;
    password: string;
    superuser: boolean;
    roles: string[];
  }): Promise<CraftyUser> {
    const res = await this.request<{ user_id?: string }>('POST', '/users', { body: input });
    return {
      user_id: res.user_id || crypto.randomUUID(),
      username: input.username,
      email: input.email,
      enabled: true,
      superuser: input.superuser,
      roles: input.roles,
    };
  }

  async updateUser(userId: string, patch: Partial<CraftyUser>): Promise<void> {
    await this.request('PATCH', `/users/${userId}`, { body: patch });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request('DELETE', `/users/${userId}`);
  }

  async listRoles(): Promise<CraftyRole[]> {
    const res = await this.request<CraftyRole[]>('GET', '/roles');
    return Array.isArray(res) ? res : [];
  }

  async createRole(input: { role_name: string; permissions: string[] }): Promise<CraftyRole> {
    const res = await this.request<{ role_id?: string }>('POST', '/roles', { body: input });
    return {
      role_id: res.role_id || crypto.randomUUID(),
      role_name: input.role_name,
      permissions: input.permissions,
    };
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.request('DELETE', `/roles/${roleId}`);
  }
}

export class SandboxCraftyClient implements CraftyClient {
  readonly isSandbox = true;

  private servers: CraftyServer[] = [
    {
      server_id: 'srv-survival-01',
      server_name: 'SMP Survival',
      type: 'minecraft-java',
      server_port: 25565,
      server_ip: '0.0.0.0',
      executable: 'paper-1.21.4.jar',
      execution_command: 'java -Xms4G -Xmx8G -XX:+UseG1GC -jar paper-1.21.4.jar nogui',
      java_selection: 'Temurin 21',
      auto_start: true,
      crash_detection: true,
      stop_command: 'stop',
      log_path: 'logs/latest.log',
      path: '/crafty/servers/smp-survival',
      running: true,
      cpu: 18.4,
      mem: '3.42 GB / 8 GB',
      mem_percent: 42.8,
      world_name: 'world_season_4',
      world_size: '4.18 GB',
      online: 4,
      max: 24,
      players: ['Scamer2005', 'KairoMC', 'Vexel_', 'NoraBuilds'],
      version: 'Paper 1.21.4',
      desc: 'ScamController Main SMP · Season 4',
    },
    {
      server_id: 'srv-creative-02',
      server_name: 'Redstone Lab',
      type: 'minecraft-java',
      server_port: 25566,
      server_ip: '0.0.0.0',
      executable: 'fabric-server-launch.jar',
      execution_command: 'java -Xms2G -Xmx4G -jar fabric-server-launch.jar nogui',
      java_selection: 'Temurin 21',
      auto_start: false,
      crash_detection: true,
      stop_command: 'stop',
      log_path: 'logs/latest.log',
      path: '/crafty/servers/redstone-lab',
      running: false,
      cpu: 0,
      mem: '0 MB / 4 GB',
      mem_percent: 0,
      world_name: 'redstone_flat',
      world_size: '612 MB',
      online: 0,
      max: 10,
      players: [],
      version: 'Fabric 1.21.4',
      desc: 'Testing & Contraption Sandbox',
    },
  ];

  private logs: Record<string, string[]> = {
    'srv-survival-01': [
      '[10:14:02 INFO]: Starting minecraft server version 1.21.4',
      '[10:14:03 INFO]: Loading properties',
      '[10:14:05 INFO]: Preparing level "world_season_4"',
      '[10:14:09 INFO]: Done (4.812s)! For help, type "help"',
      '[10:18:22 INFO]: Scamer2005 joined the game',
      '[10:19:44 INFO]: KairoMC joined the game',
      '[10:21:11 INFO]: Vexel_ joined the game',
      '[10:22:08 INFO]: NoraBuilds joined the game',
    ],
    'srv-creative-02': [
      '[09:02:11 INFO]: Stopping server',
      '[09:02:12 INFO]: Saving chunks for level ServerLevel[redstone_flat]',
      '[09:02:13 INFO]: ThreadedAnvilChunkStorage: All dimensions are saved',
    ],
  };

  private files: Record<string, Record<string, string>> = {
    'srv-survival-01': {
      'server.properties': [
        '#Minecraft server properties',
        'gamemode=survival',
        'difficulty=hard',
        'max-players=24',
        'motd=ScamController Main SMP - Season 4',
        'server-port=25565',
        'online-mode=true',
        'pvp=true',
        'white-list=true',
        'enforce-whitelist=true',
        'view-distance=12',
        'simulation-distance=8',
        'allow-nether=true',
        'allow-flight=false',
        'enable-command-block=true',
        'spawn-protection=16',
        'hardcore=false',
        'level-name=world_season_4',
      ].join('\n'),
      'bukkit.yml': 'settings:\n  allow-end: true\n  warn-on-overload: true\nspawn-limits:\n  monsters: 70\n  animals: 10\n',
      'paper-global.yml': 'proxies:\n  velocity:\n    enabled: false\nchunk-loading:\n  min-load-radius: 2\n',
      'whitelist.json': JSON.stringify(
        [
          { uuid: 'a1b2c3d4-0001', name: 'Scamer2005' },
          { uuid: 'a1b2c3d4-0002', name: 'KairoMC' },
          { uuid: 'a1b2c3d4-0003', name: 'Vexel_' },
          { uuid: 'a1b2c3d4-0004', name: 'NoraBuilds' },
        ],
        null,
        2
      ),
      'ops.json': JSON.stringify([{ uuid: 'a1b2c3d4-0001', name: 'Scamer2005', level: 4 }], null, 2),
      'logs/latest.log': '[10:14:09 INFO]: Done (4.812s)! For help, type "help"\n',
      'plugins/Essentials/config.yml': 'ops-name-color: "c"\nchange-displayname: true\n',
    },
    'srv-creative-02': {
      'server.properties': [
        'gamemode=creative',
        'difficulty=peaceful',
        'max-players=10',
        'motd=Redstone Lab',
        'server-port=25566',
        'online-mode=true',
        'pvp=false',
        'white-list=true',
        'view-distance=16',
        'level-name=redstone_flat',
      ].join('\n'),
    },
  };

  private backups: Record<string, ServerBackup[]> = {
    'srv-survival-01': [
      {
        backup_id: 'bkp-1001',
        backup_name: 'Nightly Full Snapshot',
        backup_path: '/crafty/backups/smp-2026-11-26.zip',
        created: '2026-11-26 04:00:00',
        size_bytes: 1_845_493_760,
        size_label: '1.72 GB',
      },
      {
        backup_id: 'bkp-1000',
        backup_name: 'Pre-Update Archive',
        backup_path: '/crafty/backups/smp-2026-11-25.zip',
        created: '2026-11-25 18:30:00',
        size_bytes: 1_812_000_000,
        size_label: '1.69 GB',
      },
    ],
    'srv-creative-02': [],
  };

  private backupConfigs: Record<string, BackupConfig> = {
    'srv-survival-01': {
      backup_id: 'cfg-1',
      backup_name: 'Nightly Full Snapshot',
      backup_location: '/crafty/backups/smp-survival',
      max_backups: 7,
      compress: true,
      shutdown: false,
      excluded_dirs: ['logs', 'cache', 'crash-reports'],
    },
    'srv-creative-02': {
      backup_id: 'cfg-2',
      backup_name: 'Creative Snapshot',
      backup_location: '/crafty/backups/redstone-lab',
      max_backups: 3,
      compress: true,
      shutdown: false,
      excluded_dirs: ['logs'],
    },
  };

  private tasks: Record<string, ScheduledTask[]> = {
    'srv-survival-01': [
      {
        schedule_id: 'tsk-1',
        server_id: 'srv-survival-01',
        name: 'Nightly Backup',
        action: 'backup',
        command: '',
        interval: 24,
        interval_type: 'hours',
        cron_string: '0 4 * * *',
        enabled: true,
        one_time: false,
        next_run: '2026-11-27 04:00:00',
      },
      {
        schedule_id: 'tsk-2',
        server_id: 'srv-survival-01',
        name: 'Auto-Save Warning',
        action: 'command',
        command: 'say Saving world data...',
        interval: 30,
        interval_type: 'minutes',
        cron_string: '*/30 * * * *',
        enabled: true,
        one_time: false,
        next_run: '2026-11-26 11:00:00',
      },
    ],
    'srv-creative-02': [],
  };

  private users: CraftyUser[] = [
    {
      user_id: 'usr-admin',
      username: 'Scamer2005',
      email: 'admin@scamcontroller.local',
      enabled: true,
      superuser: true,
      roles: ['Owner'],
      last_login: '2026-11-26 10:20:00',
    },
    {
      user_id: 'usr-mod',
      username: 'KairoMC',
      email: 'kairo@scamcontroller.local',
      enabled: true,
      superuser: false,
      roles: ['Moderator'],
      last_login: '2026-11-25 22:14:00',
    },
  ];

  private roles: CraftyRole[] = [
    {
      role_id: 'role-owner',
      role_name: 'Owner',
      permissions: ['COMMANDS', 'TERMINAL', 'FILES', 'BACKUP', 'SCHEDULE', 'CONFIG', 'PLAYERS', 'USERS'],
    },
    {
      role_id: 'role-mod',
      role_name: 'Moderator',
      permissions: ['COMMANDS', 'TERMINAL', 'PLAYERS'],
    },
  ];

  private nowStamp(): string {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  }

  private appendLog(serverId: string, line: string) {
    if (!this.logs[serverId]) this.logs[serverId] = [];
    this.logs[serverId].push(line);
    if (this.logs[serverId].length > 300) {
      this.logs[serverId] = this.logs[serverId].slice(-300);
    }
  }

  async listServers(): Promise<CraftyServer[]> {
    return this.servers.map((s) => ({ ...s, players: [...s.players] }));
  }

  async getServerStats(serverId: string): Promise<CraftyServer | null> {
    const srv = this.servers.find((s) => s.server_id === serverId);
    if (!srv) return null;
    if (srv.running) {
      srv.cpu = Number((12 + Math.random() * 14).toFixed(1));
    }
    return { ...srv, players: [...srv.players] };
  }

  async createServer(input: CraftyServerCreateInput): Promise<CraftyServer> {
    const created: CraftyServer = {
      server_id: `srv-${Date.now()}`,
      server_name: input.server_name,
      type: input.type,
      server_port: input.server_port,
      server_ip: '0.0.0.0',
      executable: input.executable,
      execution_command: input.execution_command,
      java_selection: 'Temurin 21',
      auto_start: input.auto_start,
      crash_detection: true,
      stop_command: 'stop',
      log_path: 'logs/latest.log',
      path: `/crafty/servers/${input.server_name.toLowerCase().replace(/\s+/g, '-')}`,
      running: false,
      cpu: 0,
      mem: '0 MB / 4 GB',
      mem_percent: 0,
      world_name: 'world',
      world_size: '12 MB',
      online: 0,
      max: 20,
      players: [],
      version: '1.21.4',
      desc: input.server_name,
    };
    this.servers.push(created);
    this.logs[created.server_id] = [`[${this.nowStamp()} INFO]: Server "${created.server_name}" provisioned.`];
    this.files[created.server_id] = {
      'server.properties': `gamemode=survival\ndifficulty=normal\nmax-players=20\nmotd=${created.server_name}\nserver-port=${created.server_port}\n`,
    };
    this.backups[created.server_id] = [];
    this.tasks[created.server_id] = [];
    return created;
  }

  async updateServer(serverId: string, patch: Partial<CraftyServer>): Promise<void> {
    this.servers = this.servers.map((s) => (s.server_id === serverId ? { ...s, ...patch } : s));
  }

  async deleteServer(serverId: string): Promise<void> {
    this.servers = this.servers.filter((s) => s.server_id !== serverId);
  }

  async sendAction(serverId: string, action: ServerPowerAction): Promise<void> {
    const srv = this.servers.find((s) => s.server_id === serverId);
    if (!srv) return;
    const t = this.nowStamp();

    if (action === 'start_server') {
      srv.running = true;
      srv.cpu = 22.5;
      srv.mem = '2.84 GB / 8 GB';
      srv.mem_percent = 35.5;
      this.appendLog(serverId, `[${t} INFO]: Starting minecraft server (${srv.executable})...`);
      this.appendLog(serverId, `[${t} INFO]: Done (2.14s)! Listening on *:${srv.server_port}`);
    } else if (action === 'stop_server') {
      srv.running = false;
      srv.cpu = 0;
      srv.mem = '0 MB';
      srv.mem_percent = 0;
      srv.online = 0;
      srv.players = [];
      this.appendLog(serverId, `[${t} INFO]: Stopping the server`);
      this.appendLog(serverId, `[${t} INFO]: ThreadedAnvilChunkStorage: All dimensions are saved`);
    } else if (action === 'restart_server') {
      srv.running = true;
      srv.cpu = 24.0;
      this.appendLog(serverId, `[${t} INFO]: Restarting server gracefully...`);
      this.appendLog(serverId, `[${t} INFO]: Server back online on port ${srv.server_port}`);
    } else if (action === 'kill_server') {
      srv.running = false;
      srv.cpu = 0;
      srv.mem = '0 MB';
      srv.mem_percent = 0;
      srv.online = 0;
      srv.players = [];
      this.appendLog(serverId, `[${t} WARN]: Server process terminated forcefully (SIGKILL)`);
    } else if (action === 'backup_server') {
      const bkp: ServerBackup = {
        backup_id: `bkp-${Date.now()}`,
        backup_name: `Manual Backup (${t})`,
        backup_path: `/crafty/backups/${srv.server_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.zip`,
        created: new Date().toISOString().replace('T', ' ').slice(0, 19),
        size_bytes: 1_850_000_000,
        size_label: '1.72 GB',
      };
      this.backups[serverId] = [bkp, ...(this.backups[serverId] || [])];
      this.appendLog(serverId, `[${t} INFO]: [Crafty] Backup completed: ${bkp.backup_name}`);
    }
  }

  async getLogs(serverId: string): Promise<string[]> {
    return [...(this.logs[serverId] || [])];
  }

  async sendStdin(serverId: string, command: string): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed) return;
    const t = this.nowStamp();
    this.appendLog(serverId, `> ${trimmed}`);
    const srv = this.servers.find((s) => s.server_id === serverId);
    if (!srv) return;

    const lower = trimmed.toLowerCase();
    if (lower === 'list') {
      this.appendLog(
        serverId,
        `[${t} INFO]: There are ${srv.players.length} of a max of ${srv.max} players online: ${srv.players.join(', ')}`
      );
    } else if (lower.startsWith('say ')) {
      this.appendLog(serverId, `[${t} INFO]: [Server] ${trimmed.slice(4)}`);
    } else if (lower.startsWith('kick ')) {
      const target = trimmed.split(/\s+/)[1];
      srv.players = srv.players.filter((p) => p.toLowerCase() !== target?.toLowerCase());
      srv.online = srv.players.length;
      this.appendLog(serverId, `[${t} INFO]: Kicked ${target}`);
    } else if (lower.startsWith('ban ')) {
      const target = trimmed.split(/\s+/)[1];
      srv.players = srv.players.filter((p) => p.toLowerCase() !== target?.toLowerCase());
      srv.online = srv.players.length;
      this.appendLog(serverId, `[${t} INFO]: Banned ${target}`);
    } else if (lower.startsWith('op ')) {
      const target = trimmed.split(/\s+/)[1];
      this.appendLog(serverId, `[${t} INFO]: Made ${target} a server operator`);
    } else if (lower.startsWith('deop ')) {
      const target = trimmed.split(/\s+/)[1];
      this.appendLog(serverId, `[${t} INFO]: Made ${target} no longer a server operator`);
    } else if (lower === 'stop') {
      await this.sendAction(serverId, 'stop_server');
    } else if (lower === 'help') {
      this.appendLog(serverId, `[${t} INFO]: Commands: help, list, say <msg>, op <player>, kick <player>, ban <player>, stop`);
    } else {
      this.appendLog(serverId, `[${t} INFO]: Executed command "${trimmed}"`);
    }
  }

  async listFiles(serverId: string, dirPath: string): Promise<ServerFileEntry[]> {
    const fileMap = this.files[serverId] || {};
    const prefix = dirPath ? `${dirPath.replace(/^\/+|\/+$/g, '')}/` : '';
    const entries = new Map<string, ServerFileEntry>();

    for (const [fullPath, content] of Object.entries(fileMap)) {
      if (!fullPath.startsWith(prefix)) continue;
      const rest = fullPath.slice(prefix.length);
      if (!rest) continue;
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        entries.set(rest, {
          name: rest,
          path: fullPath,
          isDir: false,
          sizeBytes: content.length,
          modified: '2026-11-26 10:14',
        });
      } else {
        const dirName = rest.slice(0, slashIdx);
        if (!entries.has(dirName)) {
          entries.set(dirName, {
            name: dirName,
            path: `${prefix}${dirName}`,
            isDir: true,
            sizeBytes: 0,
            modified: '2026-11-26 10:14',
          });
        }
      }
    }

    return Array.from(entries.values()).sort(
      (a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)
    );
  }

  async readFile(serverId: string, filePath: string): Promise<string> {
    return this.files[serverId]?.[filePath] ?? '';
  }

  async writeFile(serverId: string, filePath: string, content: string): Promise<void> {
    if (!this.files[serverId]) this.files[serverId] = {};
    this.files[serverId][filePath] = content;
  }

  async createFileOrDir(serverId: string, dirPath: string, name: string, isDir: boolean): Promise<void> {
    if (!this.files[serverId]) this.files[serverId] = {};
    const base = dirPath ? `${dirPath.replace(/^\/+|\/+$/g, '')}/` : '';
    if (isDir) {
      this.files[serverId][`${base}${name}/.keep`] = '';
    } else {
      this.files[serverId][`${base}${name}`] = '';
    }
  }

  async deleteFile(serverId: string, filePath: string): Promise<void> {
    const map = this.files[serverId];
    if (!map) return;
    delete map[filePath];
    const dirPrefix = `${filePath}/`;
    for (const key of Object.keys(map)) {
      if (key.startsWith(dirPrefix)) {
        delete map[key];
      }
    }
  }

  async renameFile(serverId: string, oldPath: string, newName: string): Promise<void> {
    const map = this.files[serverId];
    if (!map || !(oldPath in map)) return;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const nextPath = parts.join('/');
    map[nextPath] = map[oldPath];
    delete map[oldPath];
  }

  async listBackups(serverId: string): Promise<ServerBackup[]> {
    return [...(this.backups[serverId] || [])];
  }

  async getBackupConfig(serverId: string): Promise<BackupConfig> {
    return (
      this.backupConfigs[serverId] || {
        backup_name: 'Default Backup',
        backup_location: '/crafty/backups',
        max_backups: 5,
        compress: true,
        shutdown: false,
        excluded_dirs: [],
      }
    );
  }

  async updateBackupConfig(serverId: string, config: BackupConfig): Promise<void> {
    this.backupConfigs[serverId] = { ...config };
  }

  async restoreBackup(serverId: string, backupId: string): Promise<void> {
    const bkp = (this.backups[serverId] || []).find((b) => b.backup_id === backupId);
    if (bkp) {
      this.appendLog(serverId, `[${this.nowStamp()} INFO]: Restored archive "${bkp.backup_name}"`);
    }
  }

  async deleteBackup(serverId: string, backupId: string): Promise<void> {
    this.backups[serverId] = (this.backups[serverId] || []).filter((b) => b.backup_id !== backupId);
  }

  async listTasks(serverId: string): Promise<ScheduledTask[]> {
    return [...(this.tasks[serverId] || [])];
  }

  async createTask(
    serverId: string,
    task: Omit<ScheduledTask, 'schedule_id' | 'server_id'>
  ): Promise<ScheduledTask> {
    const created: ScheduledTask = {
      ...task,
      server_id: serverId,
      schedule_id: `tsk-${Date.now()}`,
    };
    this.tasks[serverId] = [...(this.tasks[serverId] || []), created];
    return created;
  }

  async updateTask(serverId: string, scheduleId: string, patch: Partial<ScheduledTask>): Promise<void> {
    this.tasks[serverId] = (this.tasks[serverId] || []).map((t) =>
      t.schedule_id === scheduleId ? { ...t, ...patch } : t
    );
  }

  async deleteTask(serverId: string, scheduleId: string): Promise<void> {
    this.tasks[serverId] = (this.tasks[serverId] || []).filter((t) => t.schedule_id !== scheduleId);
  }

  async runTask(serverId: string, scheduleId: string): Promise<void> {
    const task = (this.tasks[serverId] || []).find((t) => t.schedule_id === scheduleId);
    if (!task) return;
    if (task.action === 'backup') {
      await this.sendAction(serverId, 'backup_server');
    } else if (task.action === 'start') {
      await this.sendAction(serverId, 'start_server');
    } else if (task.action === 'stop') {
      await this.sendAction(serverId, 'stop_server');
    } else if (task.action === 'restart') {
      await this.sendAction(serverId, 'restart_server');
    } else if (task.action === 'command' && task.command) {
      await this.sendStdin(serverId, task.command);
    }
  }

  async listUsers(): Promise<CraftyUser[]> {
    return [...this.users];
  }

  async createUser(input: {
    username: string;
    email: string;
    password: string;
    superuser: boolean;
    roles: string[];
  }): Promise<CraftyUser> {
    const user: CraftyUser = {
      user_id: `usr-${Date.now()}`,
      username: input.username,
      email: input.email,
      enabled: true,
      superuser: input.superuser,
      roles: input.roles,
    };
    this.users = [...this.users, user];
    return user;
  }

  async updateUser(userId: string, patch: Partial<CraftyUser>): Promise<void> {
    this.users = this.users.map((u) => (u.user_id === userId ? { ...u, ...patch } : u));
  }

  async deleteUser(userId: string): Promise<void> {
    this.users = this.users.filter((u) => u.user_id !== userId);
  }

  async listRoles(): Promise<CraftyRole[]> {
    return [...this.roles];
  }

  async createRole(input: { role_name: string; permissions: string[] }): Promise<CraftyRole> {
    const role: CraftyRole = {
      role_id: `role-${Date.now()}`,
      role_name: input.role_name,
      permissions: input.permissions,
    };
    this.roles = [...this.roles, role];
    return role;
  }

  async deleteRole(roleId: string): Promise<void> {
    this.roles = this.roles.filter((r) => r.role_id !== roleId);
  }
}
