import { useEffect, useState } from 'react';
import { CalendarClock, Play, Plus, Trash2 } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { CraftyServer, ScheduledTask } from '../types/crafty';

interface SchedulesPanelProps {
  client: CraftyClient;
  server: CraftyServer;
}

export function SchedulesPanel({ client, server }: SchedulesPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [action, setAction] = useState<ScheduledTask['action']>('restart');
  const [command, setCommand] = useState('');
  const [intervalType, setIntervalType] = useState<ScheduledTask['interval_type']>('hours');
  const [interval, setIntervalValue] = useState('12');
  const [cronString, setCronString] = useState('0 */12 * * *');
  const [oneTime, setOneTime] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.listTasks(server.server_id);
      setTasks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, server.server_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await client.createTask(server.server_id, {
        name: name.trim(),
        action,
        command: action === 'command' ? command.trim() : '',
        interval: Math.max(1, Number(interval) || 1),
        interval_type: intervalType,
        cron_string: intervalType === 'cron' ? cronString.trim() : '',
        enabled: true,
        one_time: oneTime,
      });
      setName('');
      setCommand('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    try {
      await client.updateTask(server.server_id, task.schedule_id, { enabled: !task.enabled });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    }
  };

  const handleRunNow = async (taskId: string) => {
    try {
      await client.runTask(server.server_id, taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await client.deleteTask(server.server_id, taskId);
      setConfirmDeleteId(null);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="rounded-lg border border-[#232C36] bg-[#12171D] lg:col-span-7">
        <div className="flex items-center justify-between border-b border-[#232C36] px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#E6EDF3]">Scheduled Tasks</h3>
            <span className="font-mono text-xs tabular-nums text-[#8B98A5]">
              {tasks.length} configured
            </span>
          </div>
        </div>

        {error && (
          <div className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
            {error}
          </div>
        )}

        <div className="divide-y divide-[#232C36]/60">
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-14 animate-pulse rounded bg-[#0B0E11]" />
              <div className="h-14 animate-pulse rounded bg-[#0B0E11]" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#E6EDF3]">No scheduled tasks</p>
              <p className="mt-1 text-xs text-[#8B98A5]">
                Automate restarts, nightly backups, or broadcast commands using the form.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.schedule_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#E6EDF3]">{task.name}</span>
                    <span className="font-mono text-xs text-[#8B98A5]">
                      · {task.action}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-[#8B98A5]">
                    {task.interval_type === 'cron'
                      ? `cron: ${task.cron_string}`
                      : `every ${task.interval} ${task.interval_type}`}
                    {task.command ? ` · "${task.command}"` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleToggle(task)}
                    className={`rounded border px-2.5 py-1 text-xs font-medium ${
                      task.enabled
                        ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                        : 'border-[#232C36] bg-[#0B0E11] text-[#8B98A5]'
                    }`}
                  >
                    {task.enabled ? 'Enabled' : 'Paused'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRunNow(task.schedule_id)}
                    title="Run now"
                    className="rounded border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#E6EDF3] hover:border-[#10B981]/50 hover:text-[#10B981]"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>

                  {confirmDeleteId === task.schedule_id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleDelete(task.schedule_id)}
                        className="rounded bg-[#EF4444] px-2 py-1 text-xs font-semibold text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-[#8B98A5]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(task.schedule_id)}
                      aria-label={`Delete ${task.name}`}
                      className="rounded border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border border-[#232C36] bg-[#12171D] p-4 lg:col-span-5"
      >
        <h3 className="border-b border-[#232C36] pb-3 text-sm font-semibold text-[#E6EDF3]">
          Create Schedule
        </h3>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Task Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nightly Restart"
            className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as ScheduledTask['action'])}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-2.5 py-2 text-xs text-[#E6EDF3]"
            >
              <option value="restart">Restart Server</option>
              <option value="backup">Run Backup</option>
              <option value="start">Start Server</option>
              <option value="stop">Stop Server</option>
              <option value="command">Console Command</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Schedule Mode</label>
            <select
              value={intervalType}
              onChange={(e) => setIntervalType(e.target.value as ScheduledTask['interval_type'])}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-2.5 py-2 text-xs text-[#E6EDF3]"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="cron">Cron Expression</option>
            </select>
          </div>
        </div>

        {action === 'command' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Command</label>
            <input
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="say Server restarting in 5m"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>
        )}

        {intervalType === 'cron' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">Cron String</label>
            <input
              type="text"
              value={cronString}
              onChange={(e) => setCronString(e.target.value)}
              placeholder="0 4 * * *"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3]"
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B98A5]">
              Interval ({intervalType})
            </label>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setIntervalValue(e.target.value)}
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs tabular-nums text-[#E6EDF3]"
            />
          </div>
        )}

        <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
          <span>Run once only</span>
          <input
            type="checkbox"
            checked={oneTime}
            onChange={(e) => setOneTime(e.target.checked)}
            className="h-4 w-4 accent-[#10B981]"
          />
        </label>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#10B981] py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Schedule
        </button>
      </form>
    </div>
  );
}
