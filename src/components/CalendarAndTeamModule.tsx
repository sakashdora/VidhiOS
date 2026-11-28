import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CreditCard,
  Gavel,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, InfoBanner, PageHeader, StatusBadge } from './ui/DesignSystem';
import type {
  HearingRecord,
  Matter,
  SubscriptionTier,
  WorkspaceBundle,
} from '../types/legal';

const COURT_DIRECTORY = [
  { name: 'Supreme Court of India', tier: 'Apex Constitutional & Appellate Court', location: 'New Delhi', source: 'sci.gov.in' },
  { name: 'High Court of Judicature at Bombay', tier: 'High Court (Original & Appellate)', location: 'Mumbai / Nagpur / Aurangabad / Goa', source: 'bombayhighcourt.nic.in' },
  { name: 'High Court of Delhi', tier: 'High Court (Commercial & Writ)', location: 'New Delhi', source: 'delhihighcourt.nic.in' },
  { name: 'National Company Law Tribunal (NCLT)', tier: 'Corporate & IBC Tribunal', location: 'All Benches', source: 'nclt.gov.in' },
  { name: 'District & Sessions Courts (eCourts)', tier: 'Trial & Commercial Courts', location: 'Pan-India Districts', source: 'ecourts.gov.in' },
];

export function CourtCalendarModule({
  bundle,
  activeMatter,
  onRefreshWorkspace,
  onToast,
}: {
  bundle: WorkspaceBundle;
  activeMatter: Matter | null;
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [hearingDate, setHearingDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );
  const [court, setCourt] = useState(activeMatter?.forum || 'High Court of Judicature at Bombay');
  const [courtroom, setCourtroom] = useState('Court Room 14');
  const [bench, setBench] = useState('Hon’ble Division Bench');
  const [outcome, setOutcome] = useState<HearingRecord['outcome']>('scheduled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hearings = bundle.hearings ?? [];

  const handleAddHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    setError(null);
    setSaving(true);
    try {
      await api.createHearing({
        matterId: activeMatter.id,
        hearingDate,
        court,
        courtroom,
        bench,
        outcome,
        notes,
      });
      setNotes('');
      await onRefreshWorkspace();
      onToast('Hearing logged in Court Calendar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log hearing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Court Calendar & Court Intelligence"
        subtitle="Cause-list schedules, adjournment & hearing history, court directory, and statutory deadline calendar."
        badge="Last Verified Sync: Local Dossier"
      />

      <InfoBanner>
        Live eCourts / Supreme Court cause-list feeds require authorized API integration. Entries below reflect verified user/chambers docket records; any un-synced external court status is explicitly marked as requiring manual cause-list verification.
      </InfoBanner>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleAddHearing} className="lg:col-span-5 neu-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-accent" />
            <span>Schedule / Log Hearing</span>
          </h3>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="date"
              required
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
              className="neu-input px-3 py-2 text-xs font-mono rounded-lg"
            />
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as any)}
              className="neu-input px-3 py-2 text-xs rounded-lg"
            >
              <option value="scheduled">Scheduled</option>
              <option value="heard">Heard</option>
              <option value="adjourned">Adjourned</option>
              <option value="part_heard">Part Heard</option>
              <option value="order_reserved">Order Reserved</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
          <input
            required
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="Court / Tribunal"
            className="neu-input w-full px-3 py-2 text-xs rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={courtroom}
              onChange={(e) => setCourtroom(e.target.value)}
              placeholder="Courtroom"
              className="neu-input px-3 py-2 text-xs rounded-lg"
            />
            <input
              value={bench}
              onChange={(e) => setBench(e.target.value)}
              placeholder="Bench / Judge"
              className="neu-input px-3 py-2 text-xs rounded-lg"
            />
          </div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hearing notes, adjournment reason, or interim direction..."
            className="neu-input w-full px-3 py-2 text-xs rounded-lg"
          />
          <button
            type="submit"
            disabled={!activeMatter || saving}
            className="neu-btn-primary w-full py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Hearing Record'}
          </button>
        </form>

        <section className="lg:col-span-7 neu-card rounded-xl p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-ink">
            Hearing History &amp; Cause List ({hearings.length + bundle.trackedCases.length})
          </h3>
          <div className="divide-y divide-[var(--border-hairline)] text-xs">
            {bundle.trackedCases.map((tc) => (
              <div key={tc.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    {tc.caseNumber} · {tc.court}
                  </p>
                  <p className="text-ink-muted">
                    {tc.courtroom} · {tc.bench} · {tc.stage}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-teal-accent">{tc.nextHearingDate}</p>
                  <StatusBadge tone="neutral">{tc.status}</StatusBadge>
                </div>
              </div>
            ))}
            {hearings.map((h) => (
              <div key={h.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{h.court}</p>
                  <p className="text-ink-muted">
                    {h.courtroom} · {h.bench}
                  </p>
                  {h.notes && <p className="text-ink-secondary mt-0.5">{h.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-teal-accent">{h.hearingDate}</p>
                  <StatusBadge tone={h.outcome === 'adjourned' ? 'warning' : 'teal'}>
                    {h.outcome.replace('_', ' ')}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Court Directory */}
      <section className="neu-card rounded-xl p-5 space-y-3">
        <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
          <Gavel className="w-4 h-4 text-teal-accent" />
          <span>Indian Court Hierarchy &amp; Official Portal Directory</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {COURT_DIRECTORY.map((c) => (
            <div key={c.name} className="neu-inset p-3.5 rounded-lg space-y-1">
              <p className="font-semibold text-ink">{c.name}</p>
              <p className="text-ink-secondary">{c.tier}</p>
              <p className="font-mono text-[10px] text-teal-accent">{c.location} · {c.source}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AnalyticsModule({ bundle }: { bundle: WorkspaceBundle }) {
  const stats = useMemo(
    () => [
      { label: 'Total Matters', value: bundle.matters.length },
      { label: 'Research Memos', value: bundle.researchMemos.length },
      { label: 'Legal Drafts', value: bundle.drafts.length },
      { label: 'Vault Exhibits', value: bundle.vaultDocuments.length },
      { label: 'Contract Audits', value: bundle.contractReviews.length },
      { label: 'Courtroom Sessions', value: bundle.courtroomSessions.length },
      { label: 'Workflow Runs', value: bundle.workflowRuns?.length ?? 0 },
      { label: 'Open Tasks', value: (bundle.tasks ?? []).filter((t) => t.status !== 'done').length },
    ],
    [bundle]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Productivity Analytics"
        subtitle="Real-time metrics computed directly from persisted database records for your organization."
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="neu-card rounded-xl p-4">
            <p className="text-xs text-ink-muted">{s.label}</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="neu-card rounded-xl p-5 space-y-3">
        <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-accent" />
          <span>Organization Activity Breakdown</span>
        </h3>
        <div className="divide-y divide-[var(--border-hairline)] text-xs">
          {(bundle.activityLogs ?? []).slice(0, 12).map((al) => (
            <div key={al.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-ink">
                <strong className="text-teal-accent">{al.actorName}</strong> — {al.summary}
              </span>
              <span className="font-mono text-[10px] text-ink-muted shrink-0">
                {al.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
          {(bundle.activityLogs ?? []).length === 0 && (
            <p className="text-ink-muted py-4">Activity logs will populate as your team works.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function TeamAndClientsModule({
  bundle,
  onRefreshWorkspace,
  onToast,
}: {
  bundle: WorkspaceBundle;
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [portalAccess, setPortalAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clients = bundle.clients ?? [];
  const members = bundle.organizationMembers ?? [];

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createClient({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        portalAccessEnabled: portalAccess,
      });
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      await onRefreshWorkspace();
      onToast('Client profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Collaboration & Client Directory"
        subtitle="Manage chamber team members, organization roles, and client profiles with matter-level portal controls."
        badge={bundle.organization?.name}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleAddClient} className="lg:col-span-5 neu-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-ink">Add Client Profile</h3>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client Full Name"
            className="neu-input w-full px-3 py-2 text-xs rounded-lg"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Entity / Organization"
            className="neu-input w-full px-3 py-2 text-xs rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="neu-input px-3 py-2 text-xs rounded-lg"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="neu-input px-3 py-2 text-xs rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={portalAccess}
              onChange={(e) => setPortalAccess(e.target.checked)}
              className="accent-[#0d5c63]"
            />
            <span>Enable strictly matter-scoped Client Portal access</span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="neu-btn-primary w-full py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Client Profile'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-5">
          <section className="neu-card rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-accent" />
              <span>Clients ({clients.length})</span>
            </h3>
            {clients.length === 0 ? (
              <p className="text-xs text-ink-muted">No client profiles added yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)] text-xs">
                {clients.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-ink-muted">
                        {c.company || 'Individual'} · {c.email || c.phone || 'No contact'}
                      </p>
                    </div>
                    <StatusBadge tone={c.portalAccessEnabled ? 'teal' : 'neutral'}>
                      {c.portalAccessEnabled ? 'Portal Enabled' : 'Internal Only'}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="neu-card rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-ink">
              Organization Team ({members.length})
            </h3>
            <div className="divide-y divide-[var(--border-hairline)] text-xs">
              {members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{m.fullName}</p>
                    <p className="text-ink-muted">{m.email}</p>
                  </div>
                  <StatusBadge tone="teal">{m.role}</StatusBadge>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SettingsModule({
  bundle,
  onRefreshWorkspace,
  onToast,
}: {
  bundle: WorkspaceBundle;
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sub = bundle.subscription;

  const TIERS: Array<{ id: SubscriptionTier; label: string; quota: string }> = [
    { id: 'FREE', label: 'FREE', quota: '40 AI queries · 100 MB · 5 matters' },
    { id: 'PRO', label: 'PRO', quota: '500 AI queries · 2 GB · 100 matters' },
    { id: 'CHAMBERS', label: 'CHAMBERS', quota: '2,500 AI queries · 10 GB · 25 seats' },
    { id: 'ENTERPRISE', label: 'ENTERPRISE', quota: '25,000 AI queries · 100 GB · Custom governance' },
  ];

  const handlePlanChange = async (tier: SubscriptionTier) => {
    setError(null);
    setUpgrading(true);
    try {
      const res = await api.upgradeSubscription(tier);
      await onRefreshWorkspace();
      onToast(`${res.billingNote}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan change failed.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings, Subscription & Legal Compliance"
        subtitle="Manage organization plan limits, AI metering, storage usage, and responsible AI disclosures."
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {sub && (
        <section className="neu-card rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-hairline pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-accent" />
              <h3 className="font-display text-sm font-semibold text-ink">
                Organization Subscription ({sub.tier})
              </h3>
            </div>
            <StatusBadge tone="success">{sub.status}</StatusBadge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="neu-inset p-3 rounded-lg">
              <p className="text-ink-muted">AI Queries Used</p>
              <p className="font-mono text-base font-semibold text-ink">
                {sub.aiQueriesUsed} / {sub.aiQueriesLimit}
              </p>
            </div>
            <div className="neu-inset p-3 rounded-lg">
              <p className="text-ink-muted">AI Tokens Metered</p>
              <p className="font-mono text-base font-semibold text-ink">{sub.aiTokensUsed}</p>
            </div>
            <div className="neu-inset p-3 rounded-lg">
              <p className="text-ink-muted">Storage Used</p>
              <p className="font-mono text-base font-semibold text-ink">
                {sub.storageUsedMb} / {sub.storageLimitMb} MB
              </p>
            </div>
            <div className="neu-inset p-3 rounded-lg">
              <p className="text-ink-muted">Plan Expiry</p>
              <p className="font-mono text-base font-semibold text-ink">{sub.expiresAt.slice(0, 10)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {TIERS.map((t) => (
              <div key={t.id} className="neu-inset p-3.5 rounded-lg flex flex-col justify-between gap-2 text-xs">
                <div>
                  <p className="font-mono font-semibold text-teal-accent">{t.label}</p>
                  <p className="text-[11px] text-ink-muted mt-1">{t.quota}</p>
                </div>
                <button
                  type="button"
                  disabled={upgrading || sub.tier === t.id}
                  onClick={() => handlePlanChange(t.id)}
                  className={
                    sub.tier === t.id
                      ? 'neu-btn-secondary py-1.5 rounded-lg text-[11px] opacity-60'
                      : 'neu-btn-primary py-1.5 rounded-lg text-[11px] font-semibold'
                  }
                >
                  {sub.tier === t.id ? 'Current Plan' : `Switch to ${t.id}`}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">
            Note: External payment processing is intentionally disabled until pricing and a licensed payment gateway (e.g., Razorpay/Stripe) are configured.
          </p>
        </section>
      )}

      <section className="neu-card rounded-xl p-5 space-y-2 text-xs text-ink-secondary">
        <p className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-accent" />
          <span>Responsible Legal AI &amp; Statutory Accuracy Notice</span>
        </p>
        <p className="leading-relaxed">
          VidhiOS assists legal professionals with structured research, BNS/BNSS/BSA 2023 statutory crosswalks, limitation calculations, and court-formatted drafting. AI-generated outputs do not constitute formal legal advice or court-approved filings. Advocates must independently verify citations, commencement dates, state amendments, and primary official judgments prior to filing.
        </p>
      </section>
    </div>
  );
}
