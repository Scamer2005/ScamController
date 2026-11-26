import { useEffect, useState } from 'react';
import { Save, ServerCog, Trash2, X } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { CraftyServer, CraftyServerCreateInput } from '../types/crafty';

interface ServerSettingsPanelProps {
  client: CraftyClient;
  server: CraftyServer;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function ServerSettingsPanel({
  client,
  server,
  onUpdated,
  onDeleted,
}: ServerSettingsPanelProps) {
  const [serverName, setServerName] = useState(server.server_name);
  const [serverPort, setServerPort] = useState(String(server.server_port));
  const [executable, setExecutable] = useState(server.executable);
  const [executionCommand, setExecutionCommand] = useState(server.execution_command);
  const [stopCommand, setStopCommand] = useState(server.stop_command);
  const [logPath, setLogPath] = useState(server.log_path);
  const [autoStart, setAutoStart] = useState(server.auto_start);
  const [crashDetection, setCrashDetection] = useState(server.crash_detection);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setServerName(server.server_name);
    setServerPort(String(server.server_port));
    setExecutable(server.executable);
    setExecutionCommand(server.execution_command);
    setStopCommand(server.stop_command);
    setLogPath(server.log_path);
    setAutoStart(server.auto_start);
    setCrashDetection(server.crash_detection);
    setConfirmDelete(false);
    setStatusMsg(null);
    setError(null);
  }, [server]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatusMsg(null);
    try {
      await client.updateServer(server.server_id, {
        server_name: serverName.trim(),
        server_port: Number(serverPort) || 25565,
        executable: executable.trim(),
        execution_command: executionCommand.trim(),
        stop_command: stopCommand.trim() || 'stop',
        log_path: logPath.trim(),
        auto_start: autoStart,
        crash_detection: crashDetection,
      });
      setStatusMsg('Server configuration saved.');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSpecialAction = async (action: 'update_executable' | 'eula', label: string) => {
    setError(null);
    try {
      await client.sendAction(server.server_id, action);
      setStatusMsg(`${label} triggered.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  };

  const handleDelete = async () => {
    try {
      await client.deleteServer(server.server_id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove server');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg border border-[#232C36] bg-[#12171D] p-5 lg:col-span-8"
      >
        <div className="flex items-center gap-2 border-b border-[#232C36] pb-3">
          <ServerCog className="h-4 w-4 text-[#10B981]" />
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Server Execution &amp; Runtime Config</h3>
        </div>

        {error && (
          <div className="rounded border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs text-[#10B981]">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Server Name</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Server Port</label>
            <input
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs tabular-nums text-[#E6EDF3]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Server Executable</label>
            <input
              type="text"
              value={executable}
              onChange={(e) => setExecutable(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Stop Command</label>
            <input
              type="text"
              value={stopCommand}
              onChange={(e) => setStopCommand(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
            Java / Startup Execution Command
          </label>
          <input
            type="text"
            value={executionCommand}
            onChange={(e) => setExecutionCommand(e.target.value)}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Console Log File Path</label>
          <input
            type="text"
            value={logPath}
            onChange={(e) => setLogPath(e.target.value)}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
          />
        </div>

        <div className="space-y-2 border-t border-[#232C36] pt-3">
          <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
            <span>Auto-start when Crafty Controller boots</span>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="h-4 w-4 accent-[#10B981]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
            <span>Enable crash detection &amp; auto-recovery</span>
            <input
              type="checkbox"
              checked={crashDetection}
              onChange={(e) => setCrashDetection(e.target.checked)}
              className="h-4 w-4 accent-[#10B981]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Server Config'}
        </button>
      </form>

      <div className="space-y-4 lg:col-span-4">
        <div className="space-y-2.5 rounded-lg border border-[#232C36] bg-[#12171D] p-4">
          <h4 className="border-b border-[#232C36] pb-2 text-sm font-semibold text-[#E6EDF3]">
            Maintenance Actions
          </h4>
          <button
            type="button"
            onClick={() => void handleSpecialAction('update_executable', 'Executable update')}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-left text-xs font-medium text-[#E6EDF3] hover:border-[#10B981]/40"
          >
            Update Server Executable
          </button>
          <button
            type="button"
            onClick={() => void handleSpecialAction('eula', 'Accept Mojang EULA')}
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-left text-xs font-medium text-[#E6EDF3] hover:border-[#10B981]/40"
          >
            Accept Mojang EULA
          </button>
        </div>

        <div className="rounded-lg border border-[#EF4444]/30 bg-[#12171D] p-4">
          <h4 className="text-sm font-semibold text-[#EF4444]">Remove Server</h4>
          <p className="mt-1 text-xs text-[#8B98A5]">
            Removes this server entry from Crafty Controller.
          </p>
          {confirmDelete ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-[#8B98A5]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs font-medium text-[#EF4444]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Server
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateServerModalProps {
  onClose: () => void;
  onCreate: (input: CraftyServerCreateInput) => Promise<void>;
}

export function CreateServerModal({ onClose, onCreate }: CreateServerModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CraftyServerCreateInput['type']>('minecraft-java');
  const [port, setPort] = useState('25565');
  const [executable, setExecutable] = useState('paper-1.21.4.jar');
  const [command, setCommand] = useState('java -Xms2G -Xmx4G -jar paper-1.21.4.jar nogui');
  const [autoStart, setAutoStart] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        server_name: name.trim(),
        type,
        server_port: Number(port) || 25565,
        executable: executable.trim(),
        execution_command: command.trim(),
        auto_start: autoStart,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#232C36] bg-[#12171D] p-5 text-[#E6EDF3]">
        <div className="flex items-center justify-between border-b border-[#232C36] pb-3">
          <h3 className="text-base font-semibold">Add Server</h3>
          <button type="button" onClick={onClose} className="text-[#8B98A5] hover:text-[#E6EDF3]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Server Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Modded Survival"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Engine Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CraftyServerCreateInput['type'])}
                className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-2.5 py-2 text-xs text-[#E6EDF3]"
              >
                <option value="minecraft-java">Minecraft Java</option>
                <option value="minecraft-bedrock">Minecraft Bedrock</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Executable Path</label>
            <input
              type="text"
              value={executable}
              onChange={(e) => setExecutable(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Startup Command</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between py-1 text-xs">
            <span>Auto-start with Crafty</span>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="h-4 w-4 accent-[#10B981]"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#10B981] py-2.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50"
          >
            {submitting ? 'Provisioning...' : 'Create Server'}
          </button>
        </form>
      </div>
    </div>
  );
}
