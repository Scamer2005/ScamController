import {
  DEFAULT_LOCAL_URL,
  DEFAULT_TAILSCALE_URL,
  ServerConfig,
} from '../types/crafty';

const STORAGE_KEY = 'scam_controller_config';
const LEGACY_STORAGE_KEY = 'crafty_bridge_secure_prefs';

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  localUrl: DEFAULT_LOCAL_URL,
  tailscaleUrl: DEFAULT_TAILSCALE_URL,
  authMethod: 'credentials',
  apiToken: '',
  username: '',
  password: '',
  lanTimeoutMs: 1500,
  vpnConnectTimeoutMs: 12000,
  allowSelfSignedCert: true,
  autoLoginEnabled: true,
  disconnectVpnOnExit: false,
};

export function loadServerConfig(): ServerConfig {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_SERVER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
      localUrl: typeof parsed.localUrl === 'string' ? parsed.localUrl : DEFAULT_LOCAL_URL,
      tailscaleUrl:
        typeof parsed.tailscaleUrl === 'string' ? parsed.tailscaleUrl : DEFAULT_TAILSCALE_URL,
      authMethod: parsed.authMethod === 'token' ? 'token' : 'credentials',
      apiToken: typeof parsed.apiToken === 'string' ? parsed.apiToken : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
      lanTimeoutMs: typeof parsed.lanTimeoutMs === 'number' ? parsed.lanTimeoutMs : 1500,
      vpnConnectTimeoutMs:
        typeof parsed.vpnConnectTimeoutMs === 'number' ? parsed.vpnConnectTimeoutMs : 12000,
      allowSelfSignedCert:
        typeof parsed.allowSelfSignedCert === 'boolean' ? parsed.allowSelfSignedCert : true,
      autoLoginEnabled:
        typeof parsed.autoLoginEnabled === 'boolean' ? parsed.autoLoginEnabled : true,
      disconnectVpnOnExit:
        typeof parsed.disconnectVpnOnExit === 'boolean' ? parsed.disconnectVpnOnExit : false,
    };
  } catch {
    return DEFAULT_SERVER_CONFIG;
  }
}

export function saveServerConfig(config: ServerConfig): ServerConfig {
  const normalized: ServerConfig = {
    ...config,
    localUrl: config.localUrl.trim(),
    tailscaleUrl: config.tailscaleUrl.trim(),
    apiToken: config.apiToken.trim(),
    username: config.username.trim(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors in restricted environments
  }
  return normalized;
}

export function clearStoredCredentials(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
