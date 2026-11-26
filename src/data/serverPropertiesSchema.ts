export interface PropertyDefinition {
  key: string;
  label: string;
  category: 'Gameplay' | 'Network & Security' | 'World & Performance';
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  description: string;
}

export const SERVER_PROPERTIES_SCHEMA: PropertyDefinition[] = [
  {
    key: 'motd',
    label: 'Server MOTD',
    category: 'Gameplay',
    type: 'text',
    description: 'Message displayed in the Minecraft multiplayer server list.',
  },
  {
    key: 'gamemode',
    label: 'Default Gamemode',
    category: 'Gameplay',
    type: 'select',
    options: ['survival', 'creative', 'adventure', 'spectator'],
    description: 'Default mode assigned to new players.',
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    category: 'Gameplay',
    type: 'select',
    options: ['peaceful', 'easy', 'normal', 'hard'],
    description: 'Controls mob damage and hunger mechanics.',
  },
  {
    key: 'hardcore',
    label: 'Hardcore Mode',
    category: 'Gameplay',
    type: 'boolean',
    description: 'Players are set to spectator on death.',
  },
  {
    key: 'pvp',
    label: 'Enable PvP',
    category: 'Gameplay',
    type: 'boolean',
    description: 'Allow player-versus-player combat.',
  },
  {
    key: 'max-players',
    label: 'Max Players',
    category: 'Network & Security',
    type: 'number',
    description: 'Maximum concurrent connected players.',
  },
  {
    key: 'server-port',
    label: 'Server Port',
    category: 'Network & Security',
    type: 'number',
    description: 'TCP/UDP port bound by the server.',
  },
  {
    key: 'online-mode',
    label: 'Online Mode (Mojang Auth)',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Verify connecting players against Mojang session servers.',
  },
  {
    key: 'white-list',
    label: 'Enable Whitelist',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Restrict server entry to whitelisted accounts.',
  },
  {
    key: 'enforce-whitelist',
    label: 'Enforce Whitelist',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Kick online players removed from the whitelist on reload.',
  },
  {
    key: 'enforce-secure-profile',
    label: 'Enforce Secure Profile',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Require Mojang-signed chat public keys.',
  },
  {
    key: 'allow-flight',
    label: 'Allow Flight',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Prevent kicking players who fly via mods or elytra.',
  },
  {
    key: 'enable-command-block',
    label: 'Enable Command Blocks',
    category: 'Gameplay',
    type: 'boolean',
    description: 'Allow redstone command blocks to execute commands.',
  },
  {
    key: 'level-name',
    label: 'World Folder Name',
    category: 'World & Performance',
    type: 'text',
    description: 'Directory name for the primary world save.',
  },
  {
    key: 'level-seed',
    label: 'World Seed',
    category: 'World & Performance',
    type: 'text',
    description: 'Seed used when generating new terrain.',
  },
  {
    key: 'view-distance',
    label: 'View Distance (Chunks)',
    category: 'World & Performance',
    type: 'number',
    description: 'Chunk radius sent to clients (3–32).',
  },
  {
    key: 'simulation-distance',
    label: 'Simulation Distance (Chunks)',
    category: 'World & Performance',
    type: 'number',
    description: 'Chunk radius where entities and redstone tick.',
  },
  {
    key: 'allow-nether',
    label: 'Allow Nether',
    category: 'World & Performance',
    type: 'boolean',
    description: 'Enable Nether dimension portals and loading.',
  },
  {
    key: 'spawn-protection',
    label: 'Spawn Protection Radius',
    category: 'World & Performance',
    type: 'number',
    description: 'Block radius around world spawn protected from non-ops.',
  },
  {
    key: 'enable-rcon',
    label: 'Enable RCON',
    category: 'Network & Security',
    type: 'boolean',
    description: 'Expose remote RCON console listener.',
  },
];

export function parseServerProperties(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

export function serializeServerProperties(
  originalRaw: string,
  updates: Record<string, string>
): string {
  const remaining = { ...updates };
  const lines = originalRaw.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return line;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key in remaining) {
      const value = remaining[key];
      delete remaining[key];
      return `${key}=${value}`;
    }
    return line;
  });

  for (const [key, val] of Object.entries(remaining)) {
    lines.push(`${key}=${val}`);
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}
