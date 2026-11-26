import { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, UserPlus, Users2 } from 'lucide-react';
import { CraftyClient } from '../network/craftyApi';
import { CraftyRole, CraftyUser } from '../types/crafty';

interface UsersRolesPanelProps {
  client: CraftyClient;
}

const ALL_PERMISSIONS = [
  'COMMANDS',
  'TERMINAL',
  'FILES',
  'BACKUP',
  'SCHEDULE',
  'CONFIG',
  'PLAYERS',
  'USERS',
];

export function UsersRolesPanel({ client }: UsersRolesPanelProps) {
  const [subTab, setSubTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<CraftyUser[]>([]);
  const [roles, setRoles] = useState<CraftyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSuperuser, setNewSuperuser] = useState(false);

  const [newRoleName, setNewRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['COMMANDS', 'TERMINAL']);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([client.listUsers(), client.listRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users and roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setError(null);
    try {
      await client.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        superuser: newSuperuser,
        roles: roles[0] ? [roles[0].role_name] : [],
      });
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewSuperuser(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleToggleUser = async (user: CraftyUser) => {
    try {
      await client.updateUser(user.user_id, { enabled: !user.enabled });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await client.deleteUser(userId);
      setConfirmDeleteUserId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await client.createRole({ role_name: newRoleName.trim(), permissions: selectedPerms });
      setNewRoleName('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#232C36] bg-[#12171D] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[#E6EDF3]">Users &amp; Access Roles</h2>
          <p className="text-xs text-[#8B98A5]">
            Manage Crafty panel accounts and role-based permissions.
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-[#232C36] bg-[#0B0E11] p-1">
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'users' ? 'bg-[#12171D] text-[#10B981]' : 'text-[#8B98A5] hover:text-[#E6EDF3]'
            }`}
          >
            <Users2 className="h-3.5 w-3.5" />
            Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('roles')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'roles' ? 'bg-[#12171D] text-[#10B981]' : 'text-[#8B98A5] hover:text-[#E6EDF3]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Roles ({roles.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2.5 text-xs text-[#EF4444]">
          {error}
        </div>
      )}

      {subTab === 'users' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-xl border border-[#232C36] bg-[#12171D] lg:col-span-7">
            <div className="border-b border-[#232C36] px-4 py-3 text-sm font-semibold text-[#E6EDF3]">
              Panel Accounts
            </div>
            <div className="divide-y divide-[#232C36]/60">
              {loading ? (
                <div className="space-y-2 p-4">
                  <div className="h-12 animate-pulse rounded bg-[#0B0E11]" />
                  <div className="h-12 animate-pulse rounded bg-[#0B0E11]" />
                </div>
              ) : users.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8B98A5]">No panel users found.</div>
              ) : (
                users.map((user) => (
                  <div key={user.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-[#E6EDF3]">
                        {user.username}
                        {user.superuser && (
                          <span className="ml-2 font-mono text-xs text-[#10B981]">· Superuser</span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-[#8B98A5]">
                        {user.email || 'no-email'} · {user.roles.join(', ') || 'No roles'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleUser(user)}
                        className={`rounded border px-2.5 py-1 text-xs font-medium ${
                          user.enabled
                            ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                            : 'border-[#232C36] bg-[#0B0E11] text-[#8B98A5]'
                        }`}
                      >
                        {user.enabled ? 'Active' : 'Disabled'}
                      </button>

                      {confirmDeleteUserId === user.user_id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteUser(user.user_id)}
                            className="rounded bg-[#EF4444] px-2 py-1 text-xs font-semibold text-white"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUserId(null)}
                            className="text-xs text-[#8B98A5]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUserId(user.user_id)}
                          aria-label={`Delete ${user.username}`}
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
            onSubmit={handleCreateUser}
            className="space-y-3 rounded-xl border border-[#232C36] bg-[#12171D] p-4 lg:col-span-5"
          >
            <div className="flex items-center gap-2 border-b border-[#232C36] pb-3 text-sm font-semibold text-[#E6EDF3]">
              <UserPlus className="h-4 w-4 text-[#10B981]" />
              Add Crafty User
            </div>
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
            <label className="flex cursor-pointer items-center justify-between py-1 text-xs text-[#E6EDF3]">
              <span>Grant Superuser Access</span>
              <input
                type="checkbox"
                checked={newSuperuser}
                onChange={(e) => setNewSuperuser(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#10B981] py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create User
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-xl border border-[#232C36] bg-[#12171D] lg:col-span-7">
            <div className="border-b border-[#232C36] px-4 py-3 text-sm font-semibold text-[#E6EDF3]">
              Permission Roles
            </div>
            <div className="divide-y divide-[#232C36]/60">
              {roles.map((role) => (
                <div key={role.role_id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-[#E6EDF3]">{role.role_name}</div>
                    <div className="mt-0.5 font-mono text-xs text-[#8B98A5]">
                      {role.permissions.join(' · ') || 'No permissions'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void client.deleteRole(role.role_id).then(loadAll)}
                    aria-label={`Delete ${role.role_name}`}
                    className="rounded border border-[#232C36] bg-[#0B0E11] p-1.5 text-[#8B98A5] hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateRole}
            className="space-y-3 rounded-xl border border-[#232C36] bg-[#12171D] p-4 lg:col-span-5"
          >
            <div className="border-b border-[#232C36] pb-3 text-sm font-semibold text-[#E6EDF3]">
              Create Role
            </div>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name (e.g. Helper)"
              className="w-full rounded-lg border border-[#232C36] bg-[#0B0E11] px-3 py-2 text-xs text-[#E6EDF3]"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex cursor-pointer items-center gap-2 rounded border border-[#232C36] bg-[#0B0E11] px-2.5 py-1.5 font-mono text-[11px] text-[#E6EDF3]"
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm)}
                    onChange={() => togglePerm(perm)}
                    className="accent-[#10B981]"
                  />
                  {perm}
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#10B981] py-2 text-xs font-semibold text-[#0B0E11] hover:bg-[#0ea572]"
            >
              Save Role
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
