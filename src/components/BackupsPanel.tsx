import { useEffect, useState } from 'react';
import { Archive, HardDriveDownload, RotateCcw, Save, Trash2 } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { BackupConfig, CraftyServer, ServerBackup } from '../types/crafty';

interface BackupsPanelProps {
  client: CraftyClient;
  server: CraftyServer;
}

export function BackupsPanel({ client, server }: BackupsPanelProps) {
  const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [policy, setPolicy] = useState<BackupConfig>({
    backup_name: 'Primary Backup',
    backup_location: '/crafty/backups',
    max_backups: 5,
    compress: true,
    shutdown: false,
    excluded_dirs: [],
  });
  const [excludedText, setExcludedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'restore' | 'delete' } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cfg] = await Promise.all([
        client.listBackups(server.server_id),
        client.getBackupConfig(server.server_id),
      ]);
      setBackups(list);
      setPolicy(cfg);
      setExcludedText((cfg.excluded_dirs || []).join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, server.server_id]);

  const handleBackupNow = async () => {
    setWorking(true);
    setFeedback(null);
    setError(null);
    try {
      await client.sendAction(server.server_id, 'backup_server');
      setFeedback('Backup job started.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setWorking(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setFeedback(null);
    setError(null);
    try {
      const nextCfg: BackupConfig = {
        ...policy,
        excluded_dirs: excludedText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await client.updateBackupConfig(server.server_id, nextCfg);
      setPolicy(nextCfg);
      setFeedback('Backup policy updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update backup policy');
    } finally {
      setWorking(false);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    setWorking(true);
    setError(null);
    try {
      if (confirmAction.type === 'restore') {
        await client.restoreBackup(server.server_id, confirmAction.id);
        setFeedback('Backup restore initiated.');
      } else {
        await client.deleteBackup(server.server_id, confirmAction.id);
        setFeedback('Backup deleted.');
      }
      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup operation failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="rounded-lg border border-[#232C36] bg-[#12171D] lg:col-span-7">
        <div className="flex items-center justify-between border-b border-[#232C36] px-4 py-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#E6EDF3]">Backup Archives</h3>
            <span className="font-mono text-xs tabular-nums text-[#8B98A5]">
              {backups.length} total
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleBackupNow()}
            disabled={working}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50 whitespace-nowrap"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            Backup Now
          </button>
        </div>

        {error && (
          <div className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
            {error}
          </div>
        )}
        {feedback && (
          <div className="border-b border-[#10B981]/30 bg-[#10B981]/10 px-4 py-2 text-xs text-[#10B981]">
            {feedback}
          </div>
        )}

        <div className="divide-y divide-[#232C36]/60">
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-12 animate-pulse rounded bg-[#0B0E11]" />
              <div className="h-12 animate-pulse rounded bg-[#0B0E11]" />
            </div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#E6EDF3]">No backup archives yet</p>
              <p className="mt-1 text-xs text-[#8B98A5]">
                Trigger a manual snapshot now or configure an automated schedule.
              </p>
            </div>
          ) : (
            backups.map((bkp) => (
              <div
                key={bkp.backup_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#E6EDF3]">
                    {bkp.backup_name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums text-[#8B98A5]">
                    <span>{bkp.created}</span>
                    <span>·</span>
                    <span>{bkp.size_label || `${Math.round(bkp.size_bytes / 1048576)} MB`}</span>
                  </div>
                </div>

                {confirmAction?.id === bkp.backup_id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConfirmedAction()}
                      disabled={working}
                      className={`rounded px-2.5 py-1 text-xs font-semibold text-white ${
                        confirmAction.type === 'delete' ? 'bg-[#EF4444]' : 'bg-[#F59E0B] text-[#0B0E11]'
                      }`}
                    >
                      Confirm {confirmAction.type}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="text-xs text-[#8B98A5]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ id: bkp.backup_id, type: 'restore' })}
                      className="inline-flex items-center gap-1 rounded border border-[#232C36] bg-[#0B0E11] px-2.5 py-1.5 text-xs font-medium text-[#E6EDF3] hover:border-[#F59E0B]/50 hover:text-[#F59E0B]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ id: bkp.backup_id, type: 'delete' })}
                      aria-label={`Delete ${bkp.backup_name}`}
                      className="rounded border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:border-[#EF4444]/40 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSavePolicy}
        className="space-y-4 rounded-lg border border-[#232C36] bg-[#12171D] p-4 lg:col-span-5"
      >
        <h3 className="border-b border-[#232C36] pb-3 text-sm font-semibold text-[#E6EDF3]">
          Backup Policy
        </h3>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Backup Profile Name</label>
          <input
            type="text"
            value={policy.backup_name}
            onChange={(e) => setPolicy((p) => ({ ...p, backup_name: e.target.value }))}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Backup Storage Path</label>
          <input
            type="text"
            value={policy.backup_location}
            onChange={(e) => setPolicy((p) => ({ ...p, backup_location: e.target.value }))}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
            Retention Limit (Max Backups)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={policy.max_backups}
            onChange={(e) =>
              setPolicy((p) => ({ ...p, max_backups: Math.max(1, Number(e.target.value) || 1) }))
            }
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs tabular-nums text-[#E6EDF3]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
            Excluded Directories (comma-separated)
          </label>
          <input
            type="text"
            value={excludedText}
            onChange={(e) => setExcludedText(e.target.value)}
            placeholder="logs, cache, crash-reports"
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
          <span>Compress backup archives (.zip)</span>
          <input
            type="checkbox"
            checked={policy.compress}
            onChange={(e) => setPolicy((p) => ({ ...p, compress: e.target.checked }))}
            className="h-4 w-4 accent-[#10B981]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
          <span>Stop server gracefully before backup</span>
          <input
            type="checkbox"
            checked={policy.shutdown}
            onChange={(e) => setPolicy((p) => ({ ...p, shutdown: e.target.checked }))}
            className="h-4 w-4 accent-[#10B981]"
          />
        </label>

        <button
          type="submit"
          disabled={working}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#10B981] py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save Backup Policy
        </button>
      </form>
    </div>
  );
}
