import { useEffect, useState } from 'react';
import {
  ChevronRight,
  FileCode2,
  FilePlus2,
  Folder,
  FolderPlus,
  Pencil,
  Save,
  Search,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  parseServerProperties,
  serializeServerProperties,
  SERVER_PROPERTIES_SCHEMA,
} from '../data/serverPropertiesSchema';
import { CraftyClient } from '../network/craftyApi';
import { CraftyServer, ServerFileEntry } from '../types/crafty';

interface FileManagerPanelProps {
  client: CraftyClient;
  server: CraftyServer;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileManagerPanel({ client, server }: FileManagerPanelProps) {
  const [currentDir, setCurrentDir] = useState('');
  const [entries, setEntries] = useState<ServerFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [propertiesMode, setPropertiesMode] = useState<'structured' | 'raw'>('structured');
  const [propValues, setPropValues] = useState<Record<string, string>>({});
  const [propSearch, setPropSearch] = useState('');

  const [newItemType, setNewItemType] = useState<'file' | 'dir' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.listFiles(server.server_id, dirPath);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to list files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentDir('');
    setSelectedFile(null);
    void loadDirectory('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, server.server_id]);

  const openFile = async (filePath: string) => {
    setError(null);
    setStatusMsg(null);
    try {
      const content = await client.readFile(server.server_id, filePath);
      setSelectedFile(filePath);
      setFileContent(content);
      setSavedContent(content);
      if (filePath.endsWith('server.properties')) {
        setPropValues(parseServerProperties(content));
        setPropertiesMode('structured');
      } else {
        setPropertiesMode('raw');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read file');
    }
  };

  const currentEditorText =
    selectedFile?.endsWith('server.properties') && propertiesMode === 'structured'
      ? serializeServerProperties(fileContent, propValues)
      : fileContent;
  const hasUnsavedChanges = Boolean(selectedFile) && currentEditorText !== savedContent;

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      const nextContent = currentEditorText;
      await client.writeFile(server.server_id, selectedFile, nextContent);
      setFileContent(nextContent);
      setSavedContent(nextContent);
      setStatusMsg(`Saved ${selectedFile}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemType || !newItemName.trim()) return;
    try {
      await client.createFileOrDir(
        server.server_id,
        currentDir,
        newItemName.trim(),
        newItemType === 'dir'
      );
      setNewItemType(null);
      setNewItemName('');
      await loadDirectory(currentDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await client.deleteFile(server.server_id, path);
      if (selectedFile === path) setSelectedFile(null);
      setConfirmDeletePath(null);
      await loadDirectory(currentDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPath || !renameValue.trim()) return;
    try {
      await client.renameFile(server.server_id, renamingPath, renameValue.trim());
      setRenamingPath(null);
      setRenameValue('');
      await loadDirectory(currentDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const breadcrumbs = currentDir ? currentDir.split('/') : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Directory Browser */}
      <div className="flex flex-col rounded-xl border border-[#232C36] bg-[#12171D] lg:col-span-5">
        <div className="flex items-center justify-between gap-2 border-b border-[#232C36] px-4 py-3">
          <div className="flex min-w-0 items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentDir('');
                void loadDirectory('');
              }}
              className="font-semibold text-[#10B981] hover:underline whitespace-nowrap"
            >
              root
            </button>
            {breadcrumbs.map((segment, idx) => {
              const target = breadcrumbs.slice(0, idx + 1).join('/');
              return (
                <div key={target} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#8B98A5]" />
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDir(target);
                      void loadDirectory(target);
                    }}
                    className="truncate text-[#E6EDF3] hover:underline"
                  >
                    {segment}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void openFile('server.properties')}
              className="rounded-md border border-[#232C36] bg-[#0B0E11] px-2 py-1 text-[11px] font-medium text-[#10B981] hover:border-[#10B981]/50 whitespace-nowrap"
            >
              server.properties
            </button>
            <button
              type="button"
              onClick={() => {
                setNewItemType('file');
                setNewItemName('');
              }}
              title="New File"
              className="rounded-md border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:text-[#E6EDF3]"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setNewItemType('dir');
                setNewItemName('');
              }}
              title="New Folder"
              className="rounded-md border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:text-[#E6EDF3]"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {newItemType && (
          <form onSubmit={handleCreateItem} className="flex items-center gap-2 border-b border-[#232C36] bg-[#0B0E11] px-4 py-2.5">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={newItemType === 'dir' ? 'New folder name...' : 'New file name...'}
              className="flex-1 rounded border border-[#232C36] bg-[#12171D] px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#0B0E11]"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setNewItemType(null)}
              className="rounded px-2 py-1.5 text-xs text-[#8B98A5] hover:text-[#E6EDF3]"
            >
              Cancel
            </button>
          </form>
        )}

        <div className="max-h-[540px] divide-y divide-[#232C36]/60 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-8 animate-pulse rounded bg-[#0B0E11]" />
              <div className="h-8 animate-pulse rounded bg-[#0B0E11]" />
              <div className="h-8 animate-pulse rounded bg-[#0B0E11]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8B98A5]">Directory is empty.</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-[#161D24] ${
                  selectedFile === entry.path ? 'bg-[#161D24]' : ''
                }`}
              >
                {renamingPath === entry.path ? (
                  <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 rounded border border-[#232C36] bg-[#0B0E11] px-2 py-1 text-xs text-[#E6EDF3]"
                    />
                    <button type="submit" className="text-xs font-medium text-[#10B981]">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingPath(null)}
                      className="text-xs text-[#8B98A5]"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.isDir) {
                          setCurrentDir(entry.path);
                          void loadDirectory(entry.path);
                        } else {
                          void openFile(entry.path);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      {entry.isDir ? (
                        <Folder className="h-4 w-4 shrink-0 text-[#06B6D4]" />
                      ) : (
                        <FileCode2 className="h-4 w-4 shrink-0 text-[#8B98A5]" />
                      )}
                      <span className="truncate font-medium text-[#E6EDF3]">{entry.name}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] tabular-nums text-[#8B98A5]">
                        {entry.isDir ? 'dir' : formatBytes(entry.sizeBytes)}
                      </span>
                      {confirmDeletePath === entry.path ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(entry.path)}
                            className="rounded bg-[#EF4444] px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePath(null)}
                            className="px-1 text-[11px] text-[#8B98A5]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          {!entry.isDir && (
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingPath(entry.path);
                                setRenameValue(entry.name);
                              }}
                              aria-label={`Rename ${entry.name}`}
                              className="rounded p-1 text-[#8B98A5] hover:text-[#E6EDF3]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePath(entry.path)}
                            aria-label={`Delete ${entry.name}`}
                            className="rounded p-1 text-[#8B98A5] hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right File & server.properties Editor */}
      <div className="flex flex-col rounded-xl border border-[#232C36] bg-[#12171D] lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232C36] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-mono text-xs font-semibold text-[#E6EDF3]">
              {selectedFile || 'Select a file to inspect or edit'}
            </h3>
            {hasUnsavedChanges && (
              <span className="font-mono text-[11px] text-[#F59E0B]">· Unsaved</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedFile?.endsWith('server.properties') && (
              <div className="flex items-center rounded-lg border border-[#232C36] bg-[#0B0E11] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPropValues(parseServerProperties(fileContent));
                    setPropertiesMode('structured');
                  }}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    propertiesMode === 'structured'
                      ? 'bg-[#12171D] text-[#10B981]'
                      : 'text-[#8B98A5]'
                  }`}
                >
                  <Sliders className="h-3 w-3" />
                  Properties UI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFileContent(serializeServerProperties(fileContent, propValues));
                    setPropertiesMode('raw');
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    propertiesMode === 'raw' ? 'bg-[#12171D] text-[#10B981]' : 'text-[#8B98A5]'
                  }`}
                >
                  Raw Text
                </button>
              </div>
            )}

            {selectedFile && (
              <button
                type="button"
                onClick={() => void handleSaveFile()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572] disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="border-b border-[#10B981]/30 bg-[#10B981]/10 px-4 py-2 text-xs text-[#10B981]">
            {statusMsg}
          </div>
        )}

        {!selectedFile ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
            <FileCode2 className="h-8 w-8 text-[#8B98A5]" />
            <p className="mt-3 text-sm font-medium text-[#E6EDF3]">No file open</p>
            <p className="mt-1 max-w-sm text-xs text-[#8B98A5]">
              Pick any server configuration file from the left tree, or open{' '}
              <span className="font-mono text-[#E6EDF3]">server.properties</span> to adjust settings cleanly.
            </p>
            <button
              type="button"
              onClick={() => void openFile('server.properties')}
              className="mt-4 rounded-lg border border-[#232C36] bg-[#0B0E11] px-3.5 py-2 text-xs font-medium text-[#10B981] hover:border-[#10B981]/50"
            >
              Open server.properties
            </button>
          </div>
        ) : selectedFile.endsWith('server.properties') && propertiesMode === 'structured' ? (
          <div className="flex max-h-[540px] flex-col">
            <div className="border-b border-[#232C36] bg-[#0B0E11] px-4 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B98A5]" />
                <input
                  type="text"
                  value={propSearch}
                  onChange={(e) => setPropSearch(e.target.value)}
                  placeholder="Search properties (e.g. whitelist, pvp, view-distance)..."
                  className="w-full rounded-lg border border-[#232C36] bg-[#12171D] py-1.5 pl-8 pr-3 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-6 overflow-y-auto p-4">
              {(['Gameplay', 'Network & Security', 'World & Performance'] as const).map((category) => {
                const items = SERVER_PROPERTIES_SCHEMA.filter(
                  (d) =>
                    d.category === category &&
                    (!propSearch.trim() ||
                      d.label.toLowerCase().includes(propSearch.trim().toLowerCase()) ||
                      d.key.toLowerCase().includes(propSearch.trim().toLowerCase()))
                );
                if (items.length === 0) return null;
                return (
                  <div key={category} className="space-y-3">
                    <h4 className="border-b border-[#232C36] pb-1.5 text-xs font-semibold text-[#8B98A5]">
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {items.map((def) => {
                        const currentVal = propValues[def.key] ?? '';
                        return (
                          <div
                            key={def.key}
                            className="rounded-lg border border-[#232C36] bg-[#0B0E11] p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-medium text-[#E6EDF3]">{def.label}</div>
                                <div className="font-mono text-[11px] text-[#8B98A5]">{def.key}</div>
                              </div>
                              {def.type === 'boolean' && (
                                <input
                                  type="checkbox"
                                  checked={currentVal === 'true'}
                                  onChange={(e) =>
                                    setPropValues((prev) => ({
                                      ...prev,
                                      [def.key]: e.target.checked ? 'true' : 'false',
                                    }))
                                  }
                                  className="mt-0.5 h-4 w-4 accent-[#10B981]"
                                />
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-[#8B98A5]">{def.description}</p>
                            {def.type === 'select' && (
                              <select
                                value={currentVal || def.options?.[0] || ''}
                                onChange={(e) =>
                                  setPropValues((prev) => ({ ...prev, [def.key]: e.target.value }))
                                }
                                className="mt-2 w-full rounded border border-[#232C36] bg-[#12171D] px-2.5 py-1.5 text-xs text-[#E6EDF3]"
                              >
                                {def.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}
                            {(def.type === 'text' || def.type === 'number') && (
                              <input
                                type={def.type}
                                value={currentVal}
                                onChange={(e) =>
                                  setPropValues((prev) => ({ ...prev, [def.key]: e.target.value }))
                                }
                                className="mt-2 w-full rounded border border-[#232C36] bg-[#12171D] px-2.5 py-1.5 font-mono text-xs text-[#E6EDF3]"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            spellCheck={false}
            className="min-h-[480px] w-full flex-1 resize-none bg-[#0B0E11] p-4 font-mono text-xs leading-relaxed text-[#E6EDF3] focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
