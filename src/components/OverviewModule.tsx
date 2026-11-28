import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Calculator,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  FileEdit,
  FileText,
  FolderSearch,
  Gavel,
  MessageSquare,
  Plus,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, PageHeader, StatusBadge } from './ui/DesignSystem';
import type {
  JurisdictionMode,
  Matter,
  MatterTask,
  WorkspaceBundle,
  WorkspaceSection,
} from '../types/legal';

interface OverviewModuleProps {
  bundle: WorkspaceBundle;
  activeMatter: Matter | null;
  onSelectMatter: (matterId: string) => void;
  onNavigate: (section: WorkspaceSection) => void;
  onCreateMatter: (payload: {
    title: string;
    matterCode: string;
    clientName: string;
    opposingParty: string;
    jurisdiction: JurisdictionMode;
    forum: string;
    status: Matter['status'];
    summaryFacts: string;
  }) => Promise<void>;
  onBundleRefresh?: () => Promise<void>;
  onToast?: (msg: string) => void;
}

const JURISDICTION_LABELS: Record<JurisdictionMode, string> = {
  india_litigation: 'Indian Litigation (BNS / SC / HC)',
  corporate_ma: 'Corporate M&A & Commercial',
  global_multi: 'Global Multi-Jurisdiction & SIAC',
};

export function OverviewModule({
  bundle,
  activeMatter,
  onSelectMatter,
  onNavigate,
  onCreateMatter,
  onBundleRefresh,
  onToast,
}: OverviewModuleProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [title, setTitle] = useState('');
  const [matterCode, setMatterCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionMode>('india_litigation');
  const [forum, setForum] = useState('');
  const [summaryFacts, setSummaryFacts] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Task creation & WhatsApp command state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [waCommand, setWaCommand] = useState('');
  const [waSending, setWaSending] = useState(false);

  const upcomingCases = useMemo(() => bundle.trackedCases.slice(0, 5), [bundle.trackedCases]);
  const openDeadlines = useMemo(
    () => bundle.deadlines.filter((d) => !d.completed),
    [bundle.deadlines]
  );
  const draftsAwaitingReview = useMemo(
    () => bundle.drafts.filter((d) => d.status === 'awaiting_review' || d.status === 'draft'),
    [bundle.drafts]
  );
  const tasks = bundle.tasks ?? [];
  const notifications = bundle.notifications ?? [];
  const activityLogs = bundle.activityLogs ?? [];

  // Real case status distribution from DB matters
  const statusDistribution = useMemo(() => {
    const counts = { active: 0, pending_hearing: 0, in_review: 0, closed: 0 };
    for (const m of bundle.matters) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    const total = Math.max(1, bundle.matters.length);
    return [
      { key: 'active', label: 'Active', count: counts.active, pct: Math.round((counts.active / total) * 100), color: 'bg-[#0d5c63]' },
      { key: 'pending_hearing', label: 'Pending Hearing', count: counts.pending_hearing, pct: Math.round((counts.pending_hearing / total) * 100), color: 'bg-amber-600' },
      { key: 'in_review', label: 'In Review', count: counts.in_review, pct: Math.round((counts.in_review / total) * 100), color: 'bg-sky-600' },
      { key: 'closed', label: 'Closed', count: counts.closed, pct: Math.round((counts.closed / total) * 100), color: 'bg-stone-400' },
    ];
  }, [bundle.matters]);

  // Weekly workload breakdown across upcoming 7 days from actual trackedCases, deadlines, and tasks
  const weeklyWorkload = useMemo(() => {
    const days: Array<{ date: string; label: string; hearings: number; deadlines: number; tasks: number }> = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      days.push({
        date: iso,
        label,
        hearings: bundle.trackedCases.filter((c) => c.nextHearingDate === iso).length,
        deadlines: openDeadlines.filter((dl) => dl.dueDate === iso).length,
        tasks: tasks.filter((t) => t.status !== 'done' && t.dueDate === iso).length,
      });
    }
    return days;
  }, [bundle.trackedCases, openDeadlines, tasks]);

  const handleSubmitMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await onCreateMatter({
        title,
        matterCode,
        clientName,
        opposingParty,
        jurisdiction,
        forum,
        status: 'active',
        summaryFacts,
      });
      setTitle('');
      setMatterCode('');
      setClientName('');
      setOpposingParty('');
      setForum('');
      setSummaryFacts('');
      setShowNewModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create matter.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter || !newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await api.createTask({
        matterId: activeMatter.id,
        title: newTaskTitle.trim(),
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      });
      setNewTaskTitle('');
      onToast?.('Task added to matter.');
      await onBundleRefresh?.();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to add task.');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: MatterTask) => {
    try {
      await api.updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done');
      await onBundleRefresh?.();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to update task.');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      await onBundleRefresh?.();
    } catch {
      // Ignore silent failure
    }
  };

  const handleWhatsAppCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waCommand.trim() || waSending) return;
    setWaSending(true);
    try {
      await api.sendWhatsAppCommand(activeMatter?.id ?? null, waCommand.trim());
      setWaCommand('');
      onToast?.('Command executed.');
      await onBundleRefresh?.();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Command failed.');
    } finally {
      setWaSending(false);
    }
  };

  const quickActions: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    onClick: () => void;
    primary?: boolean;
  }> = [
    { label: 'Create Matter', icon: Plus, onClick: () => setShowNewModal(true), primary: true },
    { label: 'Legal Research', icon: BookOpen, onClick: () => onNavigate('research') },
    { label: 'Legal Draft', icon: FileEdit, onClick: () => onNavigate('drafting') },
    { label: 'Upload Document', icon: Upload, onClick: () => onNavigate('vault') },
    { label: 'Limitation Calc', icon: Calculator, onClick: () => onNavigate('cases') },
    { label: 'Schedule Hearing', icon: CalendarClock, onClick: () => onNavigate('calendar') },
    { label: 'Ask Vidhi AI', icon: Bot, onClick: () => onNavigate('assistant') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chambers Operational Overview"
        subtitle={
          activeMatter
            ? `Active context: ${activeMatter.matterCode} — ${activeMatter.title}`
            : 'Real-time overview of matters, court dockets, statutory deadlines, and AI workflows.'
        }
        badge={bundle.organization?.tier ? `${bundle.organization.tier} Plan` : undefined}
        actions={
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>New Matter</span>
          </button>
        }
      />

      {/* Quick Actions Strip */}
      <section aria-label="Quick actions" className="flex flex-wrap gap-2">
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                act.primary ? 'neu-btn-primary' : 'neu-btn-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{act.label}</span>
            </button>
          );
        })}
      </section>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-card rounded-xl p-4">
          <p className="text-xs font-medium text-ink-muted">Active Matters</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">
            {bundle.matters.length}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {bundle.clients?.length ?? 0} client profile(s)
          </p>
        </div>
        <div className="neu-card rounded-xl p-4">
          <p className="text-xs font-medium text-ink-muted">Upcoming Hearings</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-teal-accent">
            {bundle.trackedCases.length}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            Next: {upcomingCases[0]?.nextHearingDate ?? 'None listed'}
          </p>
        </div>
        <div className="neu-card rounded-xl p-4">
          <p className="text-xs font-medium text-ink-muted">Pending Deadlines</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {openDeadlines.length}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {tasks.filter((t) => t.status !== 'done').length} open task(s)
          </p>
        </div>
        <div className="neu-card rounded-xl p-4">
          <p className="text-xs font-medium text-ink-muted">Drafts &amp; Exhibits</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">
            {bundle.drafts.length + bundle.vaultDocuments.length}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {draftsAwaitingReview.length} draft(s) in review · {bundle.researchMemos.length} memos
          </p>
        </div>
      </div>

      {/* Active Matter + Case Status Distribution & Weekly Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section className="lg:col-span-7 neu-card rounded-xl p-5 flex flex-col justify-between space-y-4">
          {activeMatter ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-teal-accent font-mono font-semibold">
                    {activeMatter.matterCode} · {JURISDICTION_LABELS[activeMatter.jurisdiction]}
                  </p>
                  <h3 className="mt-1 font-display text-base font-semibold text-ink">
                    {activeMatter.title}
                  </h3>
                </div>
                <StatusBadge tone="teal">{activeMatter.status.replace('_', ' ')}</StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs border-y border-stone-hairline py-3">
                <div>
                  <span className="text-ink-muted">Client: </span>
                  <span className="font-medium text-ink">{activeMatter.clientName}</span>
                </div>
                <div>
                  <span className="text-ink-muted">Opposing: </span>
                  <span className="font-medium text-ink">
                    {activeMatter.opposingParty || 'Not specified'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-ink-muted">Forum: </span>
                  <span className="font-medium text-ink">{activeMatter.forum}</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                {activeMatter.summaryFacts || 'No factual summary recorded yet.'}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<Gavel className="w-5 h-5" />}
              title="No Matters Yet"
              description="Create your first legal matter to organize research, drafts, vault exhibits, and court hearings."
              action={
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="neu-btn-primary px-4 py-2 text-xs font-semibold rounded-lg"
                >
                  Create First Matter
                </button>
              }
            />
          )}

          {bundle.matters.length > 0 && (
            <div className="pt-3 border-t border-stone-hairline">
              <p className="text-[11px] font-medium text-ink-muted mb-2">Switch Active Matter</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {bundle.matters.slice(0, 6).map((m) => {
                  const selected = m.id === activeMatter?.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMatter(m.id)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-[#0d5c63] border-[#0d5c63] text-white'
                          : 'neu-inset text-ink hover:border-[#0d5c63]'
                      }`}
                    >
                      <p className={`font-mono text-[10px] truncate ${selected ? 'text-teal-100' : 'text-ink-muted'}`}>
                        {m.matterCode}
                      </p>
                      <p className="text-xs font-semibold truncate">{m.title}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Case Status Distribution + 7-Day Workload */}
        <section className="lg:col-span-5 neu-card rounded-xl p-5 space-y-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink mb-3">
              Case Status Distribution
            </h3>
            {bundle.matters.length === 0 ? (
              <p className="text-xs text-ink-muted">No matters to distribute yet.</p>
            ) : (
              <div className="space-y-2.5">
                {statusDistribution.map((item) => (
                  <div key={item.key} className="space-y-1 text-xs">
                    <div className="flex justify-between text-ink-secondary">
                      <span>{item.label}</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-inset)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-stone-hairline">
            <h3 className="font-display text-sm font-semibold text-ink mb-3">
              7-Day Chamber Workload
            </h3>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weeklyWorkload.map((day) => {
                const total = day.hearings + day.deadlines + day.tasks;
                return (
                  <div key={day.date} className="neu-inset rounded-lg p-2 space-y-1">
                    <p className="text-[10px] font-medium text-ink-muted">{day.label}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-ink">{total}</p>
                    <p className="text-[9px] text-ink-muted tabular-nums">
                      {day.hearings}H·{day.deadlines}D
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Operational Grids: Hearings, Deadlines, Tasks, Recent Docs/Drafts/Research */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming Hearings & Deadlines */}
        <section className="neu-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-2.5">
            <h3 className="font-display text-sm font-semibold text-ink">Upcoming Hearings &amp; Deadlines</h3>
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="text-xs font-medium text-teal-accent hover:underline"
            >
              View All
            </button>
          </div>
          {upcomingCases.length === 0 && openDeadlines.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">No hearings or pending deadlines recorded.</p>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)] text-xs">
              {upcomingCases.slice(0, 3).map((c) => (
                <div key={c.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{c.caseNumber}</p>
                    <p className="text-[11px] text-ink-muted truncate">{c.court} · {c.stage}</p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-teal-accent shrink-0">
                    {c.nextHearingDate}
                  </span>
                </div>
              ))}
              {openDeadlines.slice(0, 3).map((d) => (
                <div key={d.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{d.title}</p>
                    <p className="text-[11px] text-ink-muted truncate">{d.statuteArticle}</p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                    Due {d.dueDate}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Assigned Tasks */}
        <section className="neu-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-2.5">
            <h3 className="font-display text-sm font-semibold text-ink">Assigned Tasks ({tasks.length})</h3>
            <StatusBadge tone="neutral">{tasks.filter((t) => t.status !== 'done').length} open</StatusBadge>
          </div>
          {activeMatter && (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add matter task..."
                className="neu-input flex-1 px-3 py-1.5 text-xs rounded-lg"
              />
              <button
                type="submit"
                disabled={addingTask || !newTaskTitle.trim()}
                className="neu-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
          {tasks.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">No tasks assigned yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {tasks.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToggleTask(t)}
                  className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--surface-inset)] transition-colors text-xs"
                >
                  {t.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={t.status === 'done' ? 'line-through text-ink-muted' : 'text-ink font-medium'}>
                      {t.title}
                    </p>
                    <p className="text-[11px] text-ink-muted">Due {t.dueDate}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Documents, Research & Drafts Awaiting Review */}
        <section className="neu-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-2.5">
            <h3 className="font-display text-sm font-semibold text-ink">Recent Work &amp; Drafts</h3>
            <button
              type="button"
              onClick={() => onNavigate('drafting')}
              className="text-xs font-medium text-teal-accent hover:underline"
            >
              Drafting
            </button>
          </div>
          <div className="space-y-2.5 text-xs max-h-60 overflow-y-auto">
            {draftsAwaitingReview.slice(0, 2).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-ink truncate">
                  <FileText className="w-3.5 h-3.5 text-teal-accent shrink-0" />
                  <span className="truncate">{d.title}</span>
                </span>
                <StatusBadge tone="warning">v{d.version}</StatusBadge>
              </div>
            ))}
            {bundle.vaultDocuments.slice(0, 2).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-ink truncate">
                  <FolderSearch className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="truncate">{v.fileName}</span>
                </span>
                <StatusBadge tone="neutral">{v.docCategory}</StatusBadge>
              </div>
            ))}
            {bundle.researchMemos.slice(0, 2).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-ink truncate">
                  <BookOpen className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="truncate">{r.query}</span>
                </span>
                <span className="font-mono text-[10px] text-ink-muted shrink-0">{r.citations.length} src</span>
              </div>
            ))}
            {bundle.drafts.length === 0 &&
              bundle.vaultDocuments.length === 0 &&
              bundle.researchMemos.length === 0 && (
                <p className="text-xs text-ink-muted py-4">No drafts, research memos, or exhibits yet.</p>
              )}
          </div>
        </section>
      </div>

      {/* Activity Feed, Notifications & WhatsApp Chambers Command Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notifications & Recent AI Activity */}
        <section className="lg:col-span-6 neu-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-2.5">
            <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-accent" />
              <span>Notifications &amp; Recent AI Activity</span>
            </h3>
            <StatusBadge tone="teal">{notifications.filter((n) => !n.read).length} unread</StatusBadge>
          </div>
          <div className="space-y-2.5 max-h-56 overflow-y-auto text-xs">
            {notifications.slice(0, 4).map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                  n.read ? 'border-stone-hairline opacity-75' : 'border-[#0d5c63]/30 bg-[#e6f2f2]/40 dark:bg-[#132e31]/40'
                }`}
              >
                <div>
                  <p className="font-semibold text-ink">{n.title}</p>
                  <p className="text-ink-secondary mt-0.5">{n.message}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkNotificationRead(n.id)}
                    className="text-[11px] font-semibold text-teal-accent hover:underline shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
            {activityLogs.slice(0, 4).map((al) => (
              <div key={al.id} className="flex items-start gap-2 text-ink-secondary py-1">
                <Activity className="w-3.5 h-3.5 text-teal-accent shrink-0 mt-0.5" />
                <span className="flex-1">{al.summary}</span>
                <span className="font-mono text-[10px] text-ink-muted shrink-0">
                  {al.createdAt.slice(11, 16)}
                </span>
              </div>
            ))}
            {notifications.length === 0 && activityLogs.length === 0 && (
              <p className="text-xs text-ink-muted py-4">No recent notifications or activity.</p>
            )}
          </div>
        </section>

        {/* WhatsApp / Chamber Slash Command Console */}
        <section className="lg:col-span-6 neu-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-2.5">
            <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-accent" />
              <span>Chambers Quick Command Console</span>
            </h3>
            <span className="font-mono text-[10px] text-ink-muted">/hearings · /bns · /remind · /brief</span>
          </div>
          <div className="neu-inset rounded-lg p-3 h-40 overflow-y-auto space-y-2 text-xs">
            {(bundle.whatsappMessages ?? []).slice(-6).map((wm) => (
              <div key={wm.id} className={wm.sender === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block px-3 py-1.5 rounded-lg max-w-[90%] whitespace-pre-wrap ${
                    wm.sender === 'user'
                      ? 'bg-[#0d5c63] text-white'
                      : 'bg-[var(--surface)] border border-stone-hairline text-ink'
                  }`}
                >
                  {wm.body}
                </span>
              </div>
            ))}
            {(bundle.whatsappMessages ?? []).length === 0 && (
              <p className="text-ink-muted text-center py-8">
                Try <code className="font-mono">/bns 420</code>, <code className="font-mono">/hearings</code>, or <code className="font-mono">/remind File vakalatnama</code>.
              </p>
            )}
          </div>
          <form onSubmit={handleWhatsAppCommand} className="flex gap-2">
            <input
              value={waCommand}
              onChange={(e) => setWaCommand(e.target.value)}
              placeholder="Run /hearings, /bns 438, /deadlines, /remind..."
              className="neu-input flex-1 px-3 py-2 text-xs rounded-lg"
            />
            <button
              type="submit"
              disabled={waSending || !waCommand.trim()}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Run</span>
            </button>
          </form>
        </section>
      </div>

      {/* New Matter Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Legal Matter"
          className="fixed inset-0 z-50 bg-[#101617]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl neu-modal rounded-2xl p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-hairline">
              <h3 className="font-display text-base font-semibold text-ink">Create New Matter</h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowNewModal(false)}
                className="neu-btn-secondary p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitMatter} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="m-title" className="block text-xs font-medium text-ink-secondary mb-1">
                    Matter Title
                  </label>
                  <input
                    id="m-title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ABC Infra Ltd. v. NHAI"
                    className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="m-code" className="block text-xs font-medium text-ink-secondary mb-1">
                    Docket / Ref Code
                  </label>
                  <input
                    id="m-code"
                    required
                    value={matterCode}
                    onChange={(e) => setMatterCode(e.target.value)}
                    placeholder="DEL-HC-2026-88"
                    className="neu-input w-full px-3 py-2 text-sm font-mono rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="m-client" className="block text-xs font-medium text-ink-secondary mb-1">
                    Client Name
                  </label>
                  <input
                    id="m-client"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ABC Infrastructure Ltd."
                    className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="m-opp" className="block text-xs font-medium text-ink-secondary mb-1">
                    Opposing Party
                  </label>
                  <input
                    id="m-opp"
                    value={opposingParty}
                    onChange={(e) => setOpposingParty(e.target.value)}
                    placeholder="National Highways Authority of India"
                    className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="m-jur" className="block text-xs font-medium text-ink-secondary mb-1">
                    Jurisdiction &amp; Practice Mode
                  </label>
                  <select
                    id="m-jur"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value as JurisdictionMode)}
                    className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                  >
                    <option value="india_litigation">Indian Litigation (SC/HC/District/BNS)</option>
                    <option value="corporate_ma">Corporate M&amp;A &amp; Commercial</option>
                    <option value="global_multi">Global Multi-Jurisdiction &amp; Arbitration</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="m-forum" className="block text-xs font-medium text-ink-secondary mb-1">
                    Court / Tribunal / Forum
                  </label>
                  <input
                    id="m-forum"
                    required
                    value={forum}
                    onChange={(e) => setForum(e.target.value)}
                    placeholder="Delhi High Court (Commercial Division)"
                    className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="m-facts" className="block text-xs font-medium text-ink-secondary mb-1">
                  Core Facts &amp; Matter Context
                </label>
                <textarea
                  id="m-facts"
                  rows={3}
                  value={summaryFacts}
                  onChange={(e) => setSummaryFacts(e.target.value)}
                  placeholder="Summarize dispute background, dates, key statutes..."
                  className="neu-input w-full px-3 py-2 text-sm rounded-lg"
                />
              </div>

              {formError && <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="neu-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-5 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Matter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
