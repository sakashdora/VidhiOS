import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AdminUserSummary, JurisdictionMode, UserProfile } from '../types/legal';

interface AdminPanelProps {
  currentUser: UserProfile;
  onToast: (msg: string) => void;
}

export function AdminPanel({ currentUser, onToast }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('all');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUserSummary | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserSummary | null>(null);

  // Create User Form State
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Advocate',
    organization: 'Independent Chambers',
    defaultJurisdiction: 'india_litigation' as JurisdictionMode,
    isAdmin: false,
  });

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    role: '',
    organization: '',
    defaultJurisdiction: 'india_litigation' as JurisdictionMode,
    isAdmin: false,
  });

  // Reset Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAdminUsers();
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.organization.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase();
      const matchesJurisdiction =
        jurisdictionFilter === 'all' || u.defaultJurisdiction === jurisdictionFilter;
      const matchesAdmin = !adminOnlyFilter || Boolean(u.isAdmin);

      return matchesSearch && matchesRole && matchesJurisdiction && matchesAdmin;
    });
  }, [users, searchQuery, roleFilter, jurisdictionFilter, adminOnlyFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const adminCount = users.filter((u) => u.isAdmin || u.role.toLowerCase() === 'admin' || u.role.toLowerCase() === 'administrator').length;
    const totalMatters = users.reduce((acc, u) => acc + (u.mattersCount || 0), 0);
    const totalDrafts = users.reduce((acc, u) => acc + (u.draftsCount || 0), 0);
    return { totalUsers, adminCount, totalMatters, totalDrafts };
  }, [users]);

  // Handle Create User Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email.includes('@') || createForm.password.length < 8) {
      onToast('Provide a valid email and minimum 8-character password.');
      return;
    }
    try {
      setActionLoading(true);
      await api.createAdminUser(createForm);
      onToast(`Account created successfully for ${createForm.fullName}`);
      setShowCreateModal(false);
      setCreateForm({
        fullName: '',
        email: '',
        password: '',
        role: 'Advocate',
        organization: 'Independent Chambers',
        defaultJurisdiction: 'india_litigation',
        isAdmin: false,
      });
      await fetchUsers();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create user account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: AdminUserSummary) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName,
      role: user.role,
      organization: user.organization,
      defaultJurisdiction: user.defaultJurisdiction,
      isAdmin: Boolean(user.isAdmin),
    });
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setActionLoading(true);
      await api.updateAdminUser(editingUser.id, editForm);
      onToast(`Updated user profile for ${editForm.fullName}`);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update user profile.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || newPassword.length < 8) {
      onToast('Password must be at least 8 characters long.');
      return;
    }
    try {
      setActionLoading(true);
      await api.resetUserPassword(resetPasswordUser.id, newPassword);
      onToast(`Password successfully reset for ${resetPasswordUser.email}`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete User Submit
  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser.id) {
      onToast('You cannot delete your own active administrator account.');
      return;
    }
    try {
      setActionLoading(true);
      await api.deleteAdminUser(deletingUser.id);
      onToast(`User account ${deletingUser.email} has been deleted.`);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete user account.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatJurisdiction = (j: JurisdictionMode) => {
    switch (j) {
      case 'india_litigation':
        return 'India Litigation';
      case 'corporate_ma':
        return 'Corporate M&A';
      case 'global_multi':
        return 'Cross-Border Arbitration';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-hairline">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-accent" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Chambers &amp; User Administration
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-accent/15 text-teal-accent border border-teal-accent/30">
              Admin Console
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">
            Manage advocate memberships, assign practice jurisdictions, configure administrator privileges, and oversee chamber accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="neu-btn px-3 py-2 text-xs font-medium text-ink flex items-center gap-1.5 rounded-lg border border-stone-hairline hover:bg-stone-50 dark:hover:bg-slate-800 transition"
            title="Reload user roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-accent hover:opacity-95 rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">Total Accounts</p>
            <Users className="w-4 h-4 text-teal-accent" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink">{stats.totalUsers}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Registered advocates &amp; staff</p>
        </div>

        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">Administrators</p>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-600">{stats.adminCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Full chamber governance</p>
        </div>

        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">Matters Handled</p>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-600">{stats.totalMatters}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Active cross-jurisdiction files</p>
        </div>

        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">Courtroom Filings</p>
            <UserCog className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-blue-600">{stats.totalDrafts}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Generated drafts &amp; forms</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="neu-card rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, chamber..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-stone-hairline rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-teal-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-stone-hairline rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-teal-accent"
          >
            <option value="all">All Roles</option>
            <option value="Advocate">Advocate</option>
            <option value="Managing Partner">Managing Partner</option>
            <option value="Senior Advocate">Senior Advocate</option>
            <option value="Associate">Associate</option>
            <option value="Administrator">Administrator</option>
          </select>

          {/* Jurisdiction Filter */}
          <select
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-stone-hairline rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-teal-accent"
          >
            <option value="all">All Jurisdictions</option>
            <option value="india_litigation">India Litigation</option>
            <option value="corporate_ma">Corporate M&amp;A</option>
            <option value="global_multi">Cross-Border</option>
          </select>

          {/* Admin Toggle Filter */}
          <button
            type="button"
            onClick={() => setAdminOnlyFilter(!adminOnlyFilter)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              adminOnlyFilter
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                : 'border-stone-hairline text-ink-muted hover:text-ink'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admins Only
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="neu-card rounded-2xl overflow-hidden border border-stone-hairline">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-hairline bg-stone-50/75 dark:bg-slate-900/50 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                <th className="py-3.5 px-4">User &amp; Contact</th>
                <th className="py-3.5 px-4">Role &amp; Chambers</th>
                <th className="py-3.5 px-4">Jurisdiction</th>
                <th className="py-3.5 px-4">Privileges</th>
                <th className="py-3.5 px-4">Workspace Workload</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-hairline text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-accent" />
                    Loading user roster...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No users matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const initials = u.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-stone-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-accent/10 border border-teal-accent/25 text-teal-accent flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              {u.fullName}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 text-[10px] bg-teal-accent/20 text-teal-accent rounded font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Org */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-ink">{u.role}</div>
                        <div className="text-[11px] text-ink-muted">{u.organization}</div>
                      </td>

                      {/* Jurisdiction */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 dark:bg-slate-800 text-ink border border-stone-hairline">
                          {formatJurisdiction(u.defaultJurisdiction)}
                        </span>
                      </td>

                      {/* Privileges */}
                      <td className="py-3 px-4">
                        {u.isAdmin || u.role.toLowerCase() === 'admin' || u.role.toLowerCase() === 'administrator' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-ink-muted border border-stone-hairline">
                            Standard
                          </span>
                        )}
                      </td>

                      {/* Workspace Workload */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                          <span>
                            <strong className="text-ink">{u.mattersCount || 0}</strong> matters
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-ink">{u.draftsCount || 0}</strong> drafts
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-ink">{u.vaultCount || 0}</strong> docs
                          </span>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-[11px] text-ink-muted whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-ink-muted hover:text-ink hover:bg-stone-100 dark:hover:bg-slate-800 rounded-md transition"
                            title="Edit user details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordUser(u);
                              setNewPassword('');
                            }}
                            className="p-1.5 text-ink-muted hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition"
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => setDeletingUser(u)}
                            className={`p-1.5 rounded-md transition ${
                              isCurrent
                                ? 'opacity-30 cursor-not-allowed text-ink-muted'
                                : 'text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                            }`}
                            title={isCurrent ? 'Cannot delete your active account' : 'Delete user'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-stone-hairline rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-hairline">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-accent" />
                <h3 className="font-display text-lg font-bold text-ink">Add New User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-ink-muted hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="Adv. Rajesh Kulkarni"
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="rajesh@chambers.in"
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Designation / Role</label>
                  <input
                    type="text"
                    required
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    placeholder="Advocate"
                    className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">Chambers / Firm</label>
                  <input
                    type="text"
                    value={createForm.organization}
                    onChange={(e) => setCreateForm({ ...createForm, organization: e.target.value })}
                    placeholder="Deshmukh & Associates"
                    className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Primary Practice Jurisdiction</label>
                <select
                  value={createForm.defaultJurisdiction}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      defaultJurisdiction: e.target.value as JurisdictionMode,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                >
                  <option value="india_litigation">Republic of India (Supreme Court, High Courts, Tribunals)</option>
                  <option value="corporate_ma">Corporate M&amp;A, Private Equity &amp; Contracts</option>
                  <option value="global_multi">Global Multi-Jurisdiction &amp; Cross-Border Arbitration</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.isAdmin}
                    onChange={(e) => setCreateForm({ ...createForm, isAdmin: e.target.checked })}
                    className="w-4 h-4 text-teal-accent rounded border-stone-hairline focus:ring-teal-accent"
                  />
                  <div>
                    <span className="font-semibold text-ink">Grant Administrator Privileges</span>
                    <p className="text-[11px] text-ink-muted">
                      Allows this user to access the Admin Panel, manage users, and configure chamber settings.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-hairline">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-accent hover:opacity-95 rounded-lg flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-stone-hairline rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-hairline">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-teal-accent" />
                <h3 className="font-display text-lg font-bold text-ink">Edit User Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-ink-muted hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink-muted mb-1">Email Address (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 bg-stone-100 dark:bg-slate-800 border border-stone-hairline rounded-lg text-ink-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Designation / Role</label>
                  <input
                    type="text"
                    required
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">Chambers / Firm</label>
                  <input
                    type="text"
                    value={editForm.organization}
                    onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Primary Practice Jurisdiction</label>
                <select
                  value={editForm.defaultJurisdiction}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      defaultJurisdiction: e.target.value as JurisdictionMode,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                >
                  <option value="india_litigation">Republic of India (Supreme Court, High Courts, Tribunals)</option>
                  <option value="corporate_ma">Corporate M&amp;A, Private Equity &amp; Contracts</option>
                  <option value="global_multi">Global Multi-Jurisdiction &amp; Cross-Border Arbitration</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isAdmin}
                    onChange={(e) => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                    className="w-4 h-4 text-teal-accent rounded border-stone-hairline focus:ring-teal-accent"
                  />
                  <div>
                    <span className="font-semibold text-ink">Administrator Privileges</span>
                    <p className="text-[11px] text-ink-muted">
                      Permits user to manage advocate accounts, reset passwords, and oversee firm configuration.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-hairline">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-accent hover:opacity-95 rounded-lg flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-stone-hairline rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-hairline">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-display text-lg font-bold text-ink">Reset User Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="text-ink-muted hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 text-xs">
              <p className="text-ink-muted">
                Resetting password for advocate{' '}
                <strong className="text-ink">{resetPasswordUser.fullName}</strong> ({resetPasswordUser.email}).
              </p>

              <div>
                <label className="block font-medium text-ink mb-1">New Secure Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 bg-stone-50/50 dark:bg-slate-800/50 border border-stone-hairline rounded-lg text-ink focus:ring-1 focus:ring-teal-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-hairline">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  Set New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-ink">Delete User Account</h3>
                <p className="text-xs text-ink-muted">This operation is permanent and irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              Are you sure you want to delete <strong className="text-red-600">{deletingUser.fullName}</strong> ({deletingUser.email})? All associated matters, case deadlines, and document records created by this user will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-hairline">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
