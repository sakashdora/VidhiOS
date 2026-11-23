import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  FileCheck2,
  FileEdit,
  FolderSearch,
  Gavel,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  JurisdictionMode,
  Matter,
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

  const matterDrafts = activeMatter
    ? bundle.drafts.filter((d) => d.matterId === activeMatter.id)
    : [];
  const matterDocs = activeMatter
    ? bundle.vaultDocuments.filter((v) => v.matterId === activeMatter.id)
    : [];
  const matterReviews = activeMatter
    ? bundle.contractReviews.filter((c) => c.matterId === activeMatter.id)
    : [];
  const upcomingCases = bundle.trackedCases.slice(0, 5);
  const openDeadlines = bundle.deadlines.filter((d) => !d.completed);

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

  const quickLaunchers: Array<{
    section: WorkspaceSection;
    title: string;
    detail: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    {
      section: 'research',
      title: 'Grounded Legal Research',
      detail: 'Web-verified precedents, IRAC memos & citation integrity',
      icon: BookOpen,
    },
    {
      section: 'drafting',
      title: 'Drafting Studio & BNS Validator',
      detail: 'Generate petitions/contracts & scan legacy IPC/CrPC/IEA',
      icon: FileEdit,
    },
    {
      section: 'courtroom',
      title: 'Adversarial Courtroom Simulator',
      detail: 'Rehearse Hon’ble Bench & Opposing Counsel questioning',
      icon: Gavel,
    },
    {
      section: 'redline',
      title: 'Contract Redline & DD Matrix',
      detail: 'Clause-level risk scoring, redline diffs & requisitions',
      icon: FileCheck2,
    },
    {
      section: 'vault',
      title: 'Vault OCR, Chronology & Translation',
      detail: 'Extract List of Dates, flag contradictions & translate',
      icon: FolderSearch,
    },
    {
      section: 'cases',
      title: 'Cause Lists & Limitation Calculator',
      detail: 'Monitor courtrooms & compute statutory filing windows',
      icon: CalendarClock,
    },
    ...(bundle.user.isAdmin ||
    bundle.user.role.toLowerCase() === 'admin' ||
    bundle.user.role.toLowerCase() === 'administrator' ||
    bundle.user.email === 'chambers@vidhios.in'
      ? [
          {
            section: 'admin' as WorkspaceSection,
            title: 'Chambers & User Administration',
            detail: 'Manage advocate accounts, assign roles & access controls',
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* KPI Strip — Tactile Raised Alabaster Cards with Tabular Figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-card rounded-2xl p-5">
          <p className="text-xs font-medium text-ink-muted">Active Matters</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">
            {bundle.matters.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Across 3 practice jurisdictions
          </p>
        </div>
        <div className="neu-card rounded-2xl p-5">
          <p className="text-xs font-medium text-ink-muted">Tracked Hearings</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-teal-accent">
            {bundle.trackedCases.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Next: {upcomingCases[0]?.nextHearingDate ?? 'None scheduled'}
          </p>
        </div>
        <div className="neu-card rounded-2xl p-5">
          <p className="text-xs font-medium text-ink-muted">Open Deadlines</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#b86b14] dark:text-amber-400">
            {openDeadlines.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Limitation &amp; filing calendar
          </p>
        </div>
        <div className="neu-card rounded-2xl p-5">
          <p className="text-xs font-medium text-ink-muted">Matter Artifacts</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">
            {bundle.drafts.length + bundle.vaultDocuments.length + bundle.contractReviews.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Drafts, OCR docs &amp; redlines
          </p>
        </div>
      </div>

      {/* Active Matter Context + Upcoming Hearings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 neu-card rounded-3xl p-6 flex flex-col justify-between">
          {activeMatter ? (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-teal-accent font-mono tabular-nums font-medium">
                    {activeMatter.matterCode} · {JURISDICTION_LABELS[activeMatter.jurisdiction]}
                  </p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">
                    {activeMatter.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="neu-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>New Matter</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-y border-stone-hairline py-3.5">
                <div>
                  <span className="text-ink-muted">Client: </span>
                  <span className="font-medium text-ink">{activeMatter.clientName}</span>
                </div>
                <div>
                  <span className="text-ink-muted">Opposing Party: </span>
                  <span className="font-medium text-ink">
                    {activeMatter.opposingParty || 'Not specified'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-ink-muted">Forum / Practice: </span>
                  <span className="font-medium text-ink">{activeMatter.forum}</span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
                {activeMatter.summaryFacts || 'No brief summary added yet.'}
              </p>

              <div className="mt-5 pt-4 border-t border-stone-hairline flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted font-mono tabular-nums">
                <span>{matterDrafts.length} draft(s) linked</span>
                <span aria-hidden="true">·</span>
                <span>{matterDocs.length} vault document(s)</span>
                <span aria-hidden="true">·</span>
                <span>{matterReviews.length} contract review(s)</span>
              </div>
            </div>
          ) : (
            <div className="neu-empty rounded-2xl py-10 px-6 text-center">
              <p className="text-sm text-ink-secondary">
                Create your first legal matter to organize research, drafts, evidence, and hearings.
              </p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="neu-btn-primary mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-full"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Matter</span>
              </button>
            </div>
          )}

          {/* Matter Switcher Strip */}
          {bundle.matters.length > 0 && (
            <div className="mt-6 pt-4 border-t border-stone-hairline">
              <p className="text-xs font-medium text-ink-muted mb-2.5">
                Switch Active Matter Context
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {bundle.matters.map((m) => {
                  const selected = m.id === activeMatter?.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMatter(m.id)}
                      className={`text-left px-3.5 py-2.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-[#0f5a5f] dark:bg-[#14777e] border-[#0f5a5f] text-[#faf8f4] shadow-sm'
                          : 'neu-inset border-stone-hairline text-ink hover:border-[#0f5a5f]'
                      }`}
                    >
                      <p
                        className={`font-mono text-[11px] truncate ${
                          selected ? 'text-[#d4ecee]' : 'text-ink-muted'
                        }`}
                      >
                        {m.matterCode}
                      </p>
                      <p className="text-xs font-semibold truncate mt-0.5">{m.title}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Upcoming Hearings & Cause List Snapshot */}
        <section className="lg:col-span-5 neu-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-hairline">
              <h3 className="font-display text-sm font-semibold text-ink">
                Upcoming Cause List &amp; Deadlines
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('cases')}
                className="text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap shrink-0"
              >
                Open Tracker
              </button>
            </div>

            <div className="divide-y divide-[#ddd5c5] dark:divide-[#263336] mt-1">
              {upcomingCases.map((c) => (
                <div key={c.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {c.caseNumber} · {c.court}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5 truncate">
                      {c.causeListItem} · {c.stage}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums font-semibold text-teal-accent whitespace-nowrap shrink-0">
                    {c.nextHearingDate}
                  </span>
                </div>
              ))}
              {upcomingCases.length === 0 && (
                <p className="py-6 text-xs text-ink-muted">No upcoming hearings listed.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-hairline">
            <p className="text-xs font-medium text-ink-muted mb-2.5">
              Priority Statutory Deadlines
            </p>
            <div className="space-y-2.5">
              {openDeadlines.slice(0, 2).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink truncate">{d.title}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#b86b14] dark:text-amber-400 whitespace-nowrap shrink-0">
                    Due {d.dueDate}
                  </span>
                </div>
              ))}
              {openDeadlines.length === 0 && (
                <p className="text-xs text-ink-muted">No pending statutory deadlines.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Specialized Module Launch Grid */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <h3 className="font-display text-sm font-semibold text-ink">
            Legal Intelligence Modules
          </h3>
          <span className="text-xs text-ink-muted">
            All modules automatically inherit active Matter context
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {quickLaunchers.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => onNavigate(item.section)}
                className="group text-left neu-card-interactive rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-teal-accent">
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-teal-accent transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <h4 className="mt-3.5 font-display text-sm font-semibold text-ink">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    {item.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* New Matter Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Legal Matter"
          className="fixed inset-0 z-50 bg-[#121819]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl neu-modal rounded-3xl p-6 sm:p-7">
            <div className="flex items-center justify-between pb-4 border-b border-stone-hairline">
              <h3 className="font-display text-lg font-semibold text-ink">
                Create New Matter
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowNewModal(false)}
                className="neu-btn-secondary p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitMatter} className="mt-4 space-y-4">
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
                    className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
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
                    className="neu-input w-full px-3.5 py-2 text-sm font-mono rounded-xl"
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
                    className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="m-opp" className="block text-xs font-medium text-ink-secondary mb-1">
                    Opposing Party / Counterparty
                  </label>
                  <input
                    id="m-opp"
                    value={opposingParty}
                    onChange={(e) => setOpposingParty(e.target.value)}
                    placeholder="National Highways Authority of India"
                    className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
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
                    className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
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
                    className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
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
                  placeholder="Summarize dispute background, dates, key statutes, or transaction parameters..."
                  className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
                />
              </div>

              {formError && (
                <p className="text-xs text-[#9c2f28] dark:text-[#f29b94]">{formError}</p>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="neu-btn-secondary px-4 py-2 text-xs font-semibold rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-5 py-2 text-xs font-semibold rounded-full disabled:opacity-50"
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
