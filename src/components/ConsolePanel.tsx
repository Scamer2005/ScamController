import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Pause, Play, RefreshCw, Search, Send, Terminal, X } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { CraftyServer } from '../types/crafty';

interface ConsolePanelProps {
  client: CraftyClient;
  server: CraftyServer;
  onActionCompleted: () => void;
}

const QUICK_COMMANDS = ['list', 'tps', 'save-all', 'whitelist reload', 'help'];

export function ConsolePanel({ client, server, onActionCompleted }: ConsolePanelProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = async () => {
    try {
      const nextLogs = await client.getLogs(server.server_id);
      setLines(nextLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchLogs();
    if (paused) return;
    const timer = window.setInterval(() => {
      void fetchLogs();
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, server.server_id, paused]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleSend = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await client.sendStdin(server.server_id, trimmed);
      setHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 40));
      setHistoryIdx(-1);
      setCommand('');
      await fetchLogs();
      onActionCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command failed');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setCommand(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setCommand('');
      } else {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setCommand(history[next] ?? '');
      }
    }
  };

  const filteredLines = filterText.trim()
    ? lines.filter((line) => line.toLowerCase().includes(filterText.trim().toLowerCase()))
    : lines;

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[460px] flex-col rounded-xl border border-[#232C36] bg-[#12171D]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232C36] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-[#10B981]" />
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Live Console</h3>
          <span className="font-mono text-xs tabular-nums text-[#8B98A5]">
            {filteredLines.length} lines
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B98A5]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter logs..."
              className="w-40 rounded-lg border border-[#232C36] bg-[#0B0E11] py-1.5 pl-8 pr-7 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none sm:w-48"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8B98A5] hover:text-[#E6EDF3]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
              autoScroll
                ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                : 'border-[#232C36] bg-[#0B0E11] text-[#8B98A5]'
            }`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Follow
          </button>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#232C36] bg-[#0B0E11] px-2.5 py-1.5 text-xs font-medium text-[#E6EDF3] hover:border-[#374352] whitespace-nowrap"
          >
            {paused ? <Play className="h-3.5 w-3.5 text-[#10B981]" /> : <Pause className="h-3.5 w-3.5 text-[#F59E0B]" />}
            {paused ? 'Resume' : 'Pause'}
          </button>

          <button
            type="button"
            onClick={() => void fetchLogs()}
            aria-label="Refresh logs"
            className="rounded-lg border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:text-[#E6EDF3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
          {error}
        </div>
      )}

      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-[#0B0E11] p-4 font-mono text-xs leading-relaxed"
      >
        {loading ? (
          <div className="space-y-2">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#12171D]" />
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#12171D]" />
            <div className="h-3.5 w-5/6 animate-pulse rounded bg-[#12171D]" />
          </div>
        ) : filteredLines.length === 0 ? (
          <p className="text-[#8B98A5]">
            {filterText ? 'No console lines match your search.' : 'No log output available yet.'}
          </p>
        ) : (
          filteredLines.map((line, index) => {
            const upper = line.toUpperCase();
            let colorClass = 'text-[#D0D7DE]';
            if (line.startsWith('>')) {
              colorClass = 'text-[#10B981] font-medium';
            } else if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('EXCEPTION')) {
              colorClass = 'text-[#EF4444]';
            } else if (upper.includes('WARN')) {
              colorClass = 'text-[#F59E0B]';
            }
            return (
              <div key={`${index}-${line.slice(0, 16)}`} className={`whitespace-pre-wrap break-words py-0.5 ${colorClass}`}>
                {line}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[#232C36] bg-[#12171D] p-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {QUICK_COMMANDS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => void handleSend(quick)}
              disabled={sending}
              className="rounded-md border border-[#232C36] bg-[#0B0E11] px-2.5 py-1 font-mono text-[11px] text-[#8B98A5] hover:border-[#10B981]/50 hover:text-[#10B981] disabled:opacity-50 whitespace-nowrap"
            >
              /{quick}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(command);
          }}
          className="flex items-center gap-2"
        >
          <span className="font-mono text-sm font-semibold text-[#10B981]">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={server.running ? 'Enter server command (Up/Down for history)...' : 'Server is offline — send stdin command...'}
            className="flex-1 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!command.trim() || sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
