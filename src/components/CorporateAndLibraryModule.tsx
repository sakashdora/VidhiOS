import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  GraduationCap,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { lookupStatuteMappings } from '../lib/legal/statuteCrosswalk';
import { SUPREME_COURT_CORPUS } from '../lib/legal/supremeCourtCorpus';
import { ErrorBanner, InfoBanner, PageHeader, StatusBadge } from './ui/DesignSystem';
import type { CorporateProfileRecord, Matter } from '../types/legal';

export function CorporateIntelligenceModule({
  activeMatter,
  profiles,
  onRefreshWorkspace,
  onToast,
}: {
  activeMatter: Matter | null;
  profiles: CorporateProfileRecord[];
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const activeProfile = profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.lookupCorporate({
        query: query.trim(),
        matterId: activeMatter?.id,
      });
      setSelectedId(res.profile.id);
      setQuery('');
      await onRefreshWorkspace();
      onToast(
        res.providerConfigured
          ? `Fetched corporate profile for ${res.profile.companyName}`
          : `Loaded sandbox mock profile for ${res.profile.companyName}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Corporate lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corporate Intelligence & MCA Compliance"
        subtitle="Company master lookup (CIN), directors, registered charges, MCA filings, and compliance due diligence."
        badge="Provider Abstraction"
      />

      <form onSubmit={handleLookup} className="neu-card rounded-xl p-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-2.5" />
          <input
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter CIN (e.g., U45200MH2019PTC321845) or Company Name..."
            className="neu-input w-full pl-10 pr-3 py-2 text-xs rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="neu-btn-primary px-5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap disabled:opacity-50"
        >
          {loading ? 'Looking up...' : 'Lookup Company & Filings'}
        </button>
      </form>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <InfoBanner tone="warning">
        Live MCA v3 / RoC data requires configuring licensed corporate data provider credentials (<code>MCA_API_URL</code> and <code>MCA_API_KEY</code>). When unconfigured, VidhiOS displays clearly labeled sandbox mock data and never scrapes protected government portals.
      </InfoBanner>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 neu-card rounded-xl p-4 space-y-2.5">
          <h3 className="font-display text-xs font-semibold text-ink-muted">
            Corporate Dossiers ({profiles.length})
          </h3>
          {profiles.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">Run a CIN or company search above.</p>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left p-3 rounded-lg border text-xs ${
                  p.id === activeProfile?.id
                    ? 'bg-[#0d5c63] border-[#0d5c63] text-white'
                    : 'neu-inset text-ink'
                }`}
              >
                <p className="font-semibold truncate">{p.companyName}</p>
                <p className="font-mono text-[10px] opacity-80 mt-0.5">{p.cin}</p>
              </button>
            ))
          )}
        </aside>

        <section className="lg:col-span-9 neu-card rounded-xl p-6 space-y-5">
          {activeProfile ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-stone-hairline">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-accent" />
                    <h3 className="font-display text-base font-semibold text-ink">
                      {activeProfile.companyName}
                    </h3>
                    <StatusBadge tone={activeProfile.isMockData ? 'warning' : 'success'}>
                      {activeProfile.isMockData ? 'Sandbox Mock Data' : 'Licensed API Verified'}
                    </StatusBadge>
                  </div>
                  <p className="text-xs font-mono text-ink-muted mt-1">
                    CIN: {activeProfile.cin} · {activeProfile.roc} · Source Date: {activeProfile.sourceDate}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Origin: {activeProfile.sourceProvider}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-ink-muted">Paid-up Capital</p>
                  <p className="font-mono font-semibold text-ink">{activeProfile.paidUpCapital}</p>
                </div>
              </div>

              <div className="neu-inset p-4 rounded-xl text-xs space-y-1.5">
                <p className="font-semibold text-ink">AI-Assisted Due Diligence Summary</p>
                <p className="text-ink-secondary leading-relaxed">{activeProfile.aiDueDiligenceSummary}</p>
              </div>

              {activeProfile.redFlags.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 text-xs space-y-1.5">
                  <p className="font-semibold text-amber-900 dark:text-amber-300 inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Compliance &amp; Diligence Review Items (Not Proven Misconduct)</span>
                  </p>
                  <ul className="list-disc pl-4 text-ink-secondary space-y-1">
                    {activeProfile.redFlags.map((rf, i) => (
                      <li key={i}>{rf}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="neu-inset p-4 rounded-xl space-y-2">
                  <h4 className="font-semibold text-ink">Directors ({activeProfile.directors.length})</h4>
                  {activeProfile.directors.map((d, i) => (
                    <div key={i} className="flex justify-between gap-2 border-b border-stone-hairline pb-1.5 last:border-0">
                      <span className="font-medium text-ink">{d.name}</span>
                      <span className="font-mono text-ink-muted">DIN {d.din}</span>
                    </div>
                  ))}
                </div>
                <div className="neu-inset p-4 rounded-xl space-y-2">
                  <h4 className="font-semibold text-ink">Registered Charges ({activeProfile.charges.length})</h4>
                  {activeProfile.charges.map((c, i) => (
                    <div key={i} className="flex justify-between gap-2 border-b border-stone-hairline pb-1.5 last:border-0">
                      <span className="text-ink">{c.holder}</span>
                      <span className="font-mono text-teal-accent">{c.amount} ({c.status})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="neu-table-head text-ink-secondary">
                      <th className="py-2 pl-3 pr-4 font-semibold">Form</th>
                      <th className="py-2 pr-4 font-semibold">Filing Date</th>
                      <th className="py-2 pr-4 font-semibold">Description</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {activeProfile.filings.map((f, i) => (
                      <tr key={i}>
                        <td className="py-2.5 pl-3 pr-4 font-mono font-semibold text-teal-accent">{f.form}</td>
                        <td className="py-2.5 pr-4 font-mono">{f.date}</td>
                        <td className="py-2.5 pr-4 text-ink">{f.description}</td>
                        <td className="py-2.5 pr-3 text-ink-secondary">{f.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted py-10 text-center">
              Search by CIN or entity name to inspect corporate master data, charges, and compliance filings.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function LegalLibraryModule() {
  const [tab, setTab] = useState<'crosswalk' | 'precedents' | 'learning'>('crosswalk');
  const [query, setQuery] = useState('');
  const [studyTopic, setStudyTopic] = useState(0);

  const mappings = useMemo(() => lookupStatuteMappings(query), [query]);
  const precedents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPREME_COURT_CORPUS;
    return SUPREME_COURT_CORPUS.filter(
      (p) =>
        p.caseName.toLowerCase().includes(q) ||
        p.ratio.toLowerCase().includes(q) ||
        p.statutes.some((s) => s.toLowerCase().includes(q))
    );
  }, [query]);

  const STUDY_MODULES = [
    {
      title: 'BNS 2023 vs IPC 1860 — Core Structural Reforms',
      summary:
        'Master the consolidation of offences, introduction of community service, Sec. 152 replacing Sec. 124A, and mutually exclusive Cheating (Sec. 318) vs Criminal Breach of Trust (Sec. 316).',
      practiceQuestion:
        'Explain why simultaneous charges under Section 318(4) BNS and Section 316(2) BNS cannot survive on the same commercial payment default (cite Delhi Race Club, 2024 INSC 626).',
    },
    {
      title: 'BSA 2023 Sec. 63 — Electronic Evidence Certification',
      summary:
        'Compare Section 65B IEA with Section 63 BSA 2023, focusing on mandatory Schedule Part A (party certificate) and Part B (hash & expert certification) and Arjun Panditrao Khotkar (2020) 7 SCC 1.',
      practiceQuestion:
        'Draft a short oral submission defending admissibility of WhatsApp chats produced from a primary mobile device versus secondary printout.',
    },
    {
      title: 'BNSS 2023 — Bail, Zero FIR & Preliminary Inquiry',
      summary:
        'Understand Section 35(3) notice before arrest (Arnesh Kumar), Section 173(3) preliminary inquiry for 3–7 year offences, and Section 482 anticipatory bail duration (Sushila Aggarwal).',
      practiceQuestion:
        'When is a Preliminary Inquiry legally permissible under Section 173(3) BNSS and Lalita Kumari (2014) 2 SCC 1?',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indian Legal Library & Learning Studio"
        subtitle="Verified BNS/BNSS/BSA 2023 statutory crosswalk, Supreme Court precedent corpus, and isolated Law Student study mode."
        badge="2023 Criminal Codes"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="neu-tab-bar rounded-xl p-1 flex flex-wrap gap-1">
          {[
            ['crosswalk', 'Statute Crosswalk (IPC/CrPC/IEA → BNS/BNSS/BSA)'],
            ['precedents', `SC / HC Corpus (${SUPREME_COURT_CORPUS.length})`],
            ['learning', 'Law Student & Mock Study Mode'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as any)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg ${
                tab === id ? 'bg-[#0d5c63] text-white' : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== 'learning' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter section, offence, or case..."
              className="neu-input w-full pl-9 pr-3 py-1.5 text-xs rounded-lg"
            />
          </div>
        )}
      </div>

      {tab === 'crosswalk' && (
        <div className="neu-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="neu-table-head text-ink-secondary">
                  <th className="py-3 pl-4 pr-4 font-semibold">Legacy Provision</th>
                  <th className="py-3 pr-4 font-semibold">2023 Provision</th>
                  <th className="py-3 pr-4 font-semibold">Offence / Subject</th>
                  <th className="py-3 pr-4 font-semibold">Key Legislative Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {mappings.map((m) => (
                  <tr key={`${m.legacyCode}-${m.legacySection}`} className="hover:bg-[var(--surface-inset)]">
                    <td className="py-3 pl-4 pr-4 font-mono font-semibold text-ink whitespace-nowrap">
                      {m.legacyCode} {m.legacySection}
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-teal-accent whitespace-nowrap">
                      {m.newCode} {m.newSection}
                    </td>
                    <td className="py-3 pr-4 font-medium text-ink">{m.title}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{m.keyChangeNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'precedents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {precedents.map((p) => (
            <article key={p.id} className="neu-card rounded-xl p-5 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-teal-accent shrink-0" />
                  <span>{p.caseName}</span>
                </h3>
                <StatusBadge tone="teal">{p.citation}</StatusBadge>
              </div>
              <p className="text-[11px] text-ink-muted">
                {p.court} · {p.bench} ({p.year})
              </p>
              <p className="text-ink-secondary leading-relaxed">
                <strong className="text-ink">Ratio:</strong> {p.ratio}
              </p>
              <p className="text-ink-muted leading-relaxed">
                <strong className="text-teal-accent">Application:</strong> {p.practicalApplication}
              </p>
            </article>
          ))}
        </div>
      )}

      {tab === 'learning' && (
        <div className="space-y-4">
          <InfoBanner>
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <GraduationCap className="w-4 h-4 text-teal-accent" />
              Isolated Academic &amp; Moot Study Mode
            </span>
            <p className="mt-1">
              Student exercises and mock oral practice remain strictly separate from active client matters.
            </p>
          </InfoBanner>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STUDY_MODULES.map((mod, idx) => (
              <button
                key={mod.title}
                type="button"
                onClick={() => setStudyTopic(idx)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  studyTopic === idx
                    ? 'bg-[#0d5c63] border-[#0d5c63] text-white'
                    : 'neu-card text-ink'
                }`}
              >
                <BookOpen className="w-4 h-4 mb-2" />
                <p className="font-display text-sm font-semibold">{mod.title}</p>
              </button>
            ))}
          </div>
          <div className="neu-card rounded-xl p-6 space-y-3 text-xs">
            <h3 className="font-display text-base font-semibold text-ink">
              {STUDY_MODULES[studyTopic].title}
            </h3>
            <p className="text-ink-secondary leading-relaxed">
              {STUDY_MODULES[studyTopic].summary}
            </p>
            <div className="neu-inset p-4 rounded-lg space-y-1">
              <p className="font-semibold text-teal-accent inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Moot Court / Exam Assignment Prompt</span>
              </p>
              <p className="text-ink">{STUDY_MODULES[studyTopic].practiceQuestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
