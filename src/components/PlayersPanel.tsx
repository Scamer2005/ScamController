import { useEffect, useState } from 'react';
import { Ban, ShieldCheck, ShieldOff, UserCheck, UserMinus, Users } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { CraftyServer } from '../types/crafty';

interface PlayersPanelProps {
  client: CraftyClient;
  server: CraftyServer;
  onActionCompleted: () => void;
}

export function PlayersPanel({ client, server, onActionCompleted }: PlayersPanelProps) {
  const [targetName, setTargetName] = useState('');
  const [whitelistNames, setWhitelistNames] = useState<string[]>([]);
  const [opNames, setOpNames] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadJsonLists = async () => {
    try {
      const [wlRaw, opsRaw] = await Promise.all([
        client.readFile(server.server_id, 'whitelist.json').catch(() => ''),
        client.readFile(server.server_id, 'ops.json').catch(() => ''),
      ]);
      if (wlRaw) {
        const parsed = JSON.parse(wlRaw) as Array<{ name?: string }>;
        setWhitelistNames(parsed.map((p) => p.name || '').filter(Boolean));
      } else {
        setWhitelistNames([]);
      }
      if (opsRaw) {
        const parsed = JSON.parse(opsRaw) as Array<{ name?: string }>;
        setOpNames(parsed.map((p) => p.name || '').filter(Boolean));
      } else {
        setOpNames([]);
      }
    } catch {
      // Ignore missing or non-JSON lists on fresh servers
    }
  };

  useEffect(() => {
    void loadJsonLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, server.server_id]);

  const runPlayerCommand = async (cmd: string, label: string) => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await client.sendStdin(server.server_id, cmd);
      setFeedback(`Sent: ${label}`);
      onActionCompleted();
      await loadJsonLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Player command failed');
    } finally {
      setBusy(false);
    }
  };

  const handleManualAction = (verb: 'kick' | 'ban' | 'pardon' | 'op' | 'deop' | 'whitelist add' | 'whitelist remove') => {
    const clean = targetName.trim();
    if (!clean) return;
    void runPlayerCommand(`${verb} ${clean}`, `${verb} ${clean}`);
    setTargetName('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#232C36] bg-[#12171D] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232C36] pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#E6EDF3]">Player Moderation &amp; Access</h3>
            <span className="font-mono text-xs tabular-nums text-[#8B98A5]">
              {server.online} / {server.max} online
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
            {error}
          </div>
        )}
        {feedback && (
          <div className="mt-3 rounded border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 font-mono text-xs text-[#10B981]">
            {feedback}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            placeholder="Enter player username..."
            className="flex-1 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('op')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#10B981] hover:border-[#10B981]/40 disabled:opacity-50"
            >
              Op
            </button>
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('deop')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#8B98A5] hover:text-[#E6EDF3] disabled:opacity-50"
            >
              Deop
            </button>
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('whitelist add')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#06B6D4] hover:border-[#06B6D4]/40 disabled:opacity-50"
            >
              Whitelist +
            </button>
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('kick')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#F59E0B] hover:border-[#F59E0B]/40 disabled:opacity-50"
            >
              Kick
            </button>
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('ban')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#EF4444] hover:border-[#EF4444]/40 disabled:opacity-50"
            >
              Ban
            </button>
            <button
              type="button"
              disabled={busy || !targetName.trim()}
              onClick={() => handleManualAction('pardon')}
              className="rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#E6EDF3] hover:border-[#374352] disabled:opacity-50"
            >
              Pardon
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-[#232C36] bg-[#12171D] lg:col-span-7">
          <div className="border-b border-[#232C36] px-4 py-3 text-sm font-semibold text-[#E6EDF3]">
            Online Players
          </div>
          {server.players.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8B98A5]">
              {server.running ? 'No players are currently connected.' : 'Server is offline.'}
            </div>
          ) : (
            <div className="divide-y divide-[#232C36]/60">
              {server.players.map((player) => {
                const isOp = opNames.includes(player);
                return (
                  <div key={player} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="font-mono text-sm font-medium text-[#E6EDF3]">{player}</div>
                      <div className="text-xs text-[#8B98A5]">
                        {isOp ? 'Operator' : 'Player'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runPlayerCommand(
                            `${isOp ? 'deop' : 'op'} ${player}`,
                            `${isOp ? 'Deop' : 'Op'} ${player}`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded border border-[#232C36] bg-[#0B0E11] px-2.5 py-1 text-xs text-[#E6EDF3] hover:border-[#10B981]/40"
                      >
                        {isOp ? <ShieldOff className="h-3.5 w-3.5 text-[#8B98A5]" /> : <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />}
                        {isOp ? 'Deop' : 'Op'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runPlayerCommand(`kick ${player}`, `Kick ${player}`)}
                        className="inline-flex items-center gap-1 rounded border border-[#232C36] bg-[#0B0E11] px-2.5 py-1 text-xs text-[#F59E0B] hover:border-[#F59E0B]/40"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Kick
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runPlayerCommand(`ban ${player}`, `Ban ${player}`)}
                        className="inline-flex items-center gap-1 rounded border border-[#232C36] bg-[#0B0E11] px-2.5 py-1 text-xs text-[#EF4444] hover:border-[#EF4444]/40"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Ban
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-lg border border-[#232C36] bg-[#12171D] p-4">
            <div className="flex items-center justify-between border-b border-[#232C36] pb-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF3]">
                <UserCheck className="h-4 w-4 text-[#06B6D4]" />
                Whitelist ({whitelistNames.length})
              </div>
            </div>
            {whitelistNames.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B98A5]">No whitelist.json entries loaded.</p>
            ) : (
              <div className="mt-3 divide-y divide-[#232C36]/60">
                {whitelistNames.map((name) => (
                  <div key={name} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-mono text-[#E6EDF3]">{name}</span>
                    <button
                      type="button"
                      onClick={() => void runPlayerCommand(`whitelist remove ${name}`, `Remove ${name}`)}
                      className="text-[#8B98A5] hover:text-[#EF4444]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#232C36] bg-[#12171D] p-4">
            <div className="flex items-center gap-2 border-b border-[#232C36] pb-2.5 text-sm font-semibold text-[#E6EDF3]">
              <ShieldCheck className="h-4 w-4 text-[#10B981]" />
              Operators ({opNames.length})
            </div>
            {opNames.length === 0 ? (
              <p className="mt-3 text-xs text-[#8B98A5]">No ops.json entries loaded.</p>
            ) : (
              <div className="mt-3 divide-y divide-[#232C36]/60">
                {opNames.map((name) => (
                  <div key={name} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-mono text-[#E6EDF3]">{name}</span>
                    <button
                      type="button"
                      onClick={() => void runPlayerCommand(`deop ${name}`, `Deop ${name}`)}
                      className="text-[#8B98A5] hover:text-[#F59E0B]"
                    >
                      Revoke Op
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
