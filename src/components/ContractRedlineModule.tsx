import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileCheck2,
  Plus,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ContractReview, Matter, RedlineClause } from '../types/legal';

interface ContractRedlineModuleProps {
  activeMatter: Matter | null;
  reviews: ContractReview[];
  onReviewCreated: (review: ContractReview) => void;
  onReviewUpdated: (review: ContractReview) => void;
  onToast: (msg: string) => void;
}

const PLAYBOOKS = [
  'Indian Corporate & Arbitration Act Playbook',
  'M&A Buyer-Side SPA / SHA Due Diligence Playbook',
  'UK / US Cross-Border Commercial SaaS Playbook',
  'Banking & Project Finance Covenant Playbook',
];

export function ContractRedlineModule({
  activeMatter,
  reviews,
  onReviewCreated,
  onReviewUpdated,
  onToast,
}: ContractRedlineModuleProps) {
  const [selectedId, setSelectedId] = useState<string>(reviews[0]?.id ?? '');
  const activeReview = reviews.find((r) => r.id === selectedId) ?? reviews[0] ?? null;

  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'accepted'>('all');
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [playbook, setPlaybook] = useState(PLAYBOOKS[0]);
  const [contractText, setContractText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredClauses = useMemo(() => {
    if (!activeReview) return [];
    return activeReview.clauses.filter((cl) => {
      if (severityFilter === 'all') return true;
      if (severityFilter === 'accepted') return cl.decision === 'accepted';
      return cl.severity === severityFilter;
    });
  }, [activeReview, severityFilter]);

  const counts = useMemo(() => {
    const clauses = activeReview?.clauses ?? [];
    return {
      total: clauses.length,
      high: clauses.filter((c) => c.severity === 'high').length,
      accepted: clauses.filter((c) => c.decision === 'accepted').length,
      rejected: clauses.filter((c) => c.decision === 'rejected').length,
    };
  }, [activeReview]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    setError(null);
    setAnalyzing(true);
    try {
      const created = await api.runContractRedline({
        matterId: activeMatter.id,
        title,
        playbook,
        contractText,
      });
      onReviewCreated(created);
      setSelectedId(created.id);
      setShowNew(false);
      setTitle('');
      setContractText('');
      onToast(`Completed redline audit: ${created.clauses.length} risk clauses flagged.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contract analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDecision = async (
    clauseId: string,
    decision: RedlineClause['decision']
  ) => {
    if (!activeReview) return;
    try {
      const updated = await api.decideRedlineClause(activeReview.id, clauseId, decision);
      onReviewUpdated(updated);
      onToast(
        decision === 'accepted'
          ? 'Redline accepted and applied to export buffer.'
          : decision === 'rejected'
            ? 'Redline rejected; original clause retained.'
            : 'Clause reset to pending.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update clause decision.');
    }
  };

  const handleExportRedlined = () => {
    if (!activeReview) return;
    let output = activeReview.sourceText;
    for (const cl of activeReview.clauses) {
      if (cl.decision === 'accepted' && output.includes(cl.originalText)) {
        output = output.replace(cl.originalText, cl.proposedText);
      }
    }
    const report = [
      `# ${activeReview.title} — Redlined Draft & DD Requisitions`,
      `Playbook: ${activeReview.playbook}`,
      '',
      '## Executive Summary',
      activeReview.summary,
      '',
      '## Accepted Redlines Applied',
      output,
      '',
      '## Due Diligence Requisitions',
      ...activeReview.requisitions.map((r, i) => `${i + 1}. ${r}`),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReview.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-redline.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported revised contract & DD requisition report.');
  };

  const severityLabel = (sev: RedlineClause['severity']) => {
    if (sev === 'high') return { text: 'High Risk', cls: 'text-[#9c2f28] dark:text-[#f29b94]' };
    if (sev === 'medium') return { text: 'Medium Risk', cls: 'text-[#b86b14] dark:text-amber-400' };
    return { text: 'Low Risk', cls: 'text-ink-muted' };
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="neu-card rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Contract Redline &amp; Due Diligence Matrix
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Playbook-backed clause extraction, interactive side-by-side redline diffs, and M&amp;A requisition generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {reviews.length > 0 && (
            <select
              aria-label="Select contract review"
              value={activeReview?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="neu-input px-3.5 py-2 text-xs font-medium rounded-full max-w-xs truncate"
            >
              {reviews.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Audit Contract</span>
          </button>
          {activeReview && (
            <button
              type="button"
              onClick={handleExportRedlined}
              className="neu-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Export Redline</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
        >
          {error}
        </div>
      )}

      {showNew && (
        <form onSubmit={handleAnalyze} className="neu-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Run Playbook Contract Redline Audit
            </h3>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="cr-title" className="block text-xs font-medium text-ink-secondary mb-1">
                Agreement Title
              </label>
              <input
                id="cr-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Vendor Cloud MSA — Draft v2"
                className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="cr-playbook" className="block text-xs font-medium text-ink-secondary mb-1">
                Review Playbook
              </label>
              <select
                id="cr-playbook"
                value={playbook}
                onChange={(e) => setPlaybook(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
              >
                {PLAYBOOKS.map((pb) => (
                  <option key={pb}>{pb}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cr-text" className="block text-xs font-medium text-ink-secondary mb-1">
              Paste Contract Clauses / Agreement Text
            </label>
            <textarea
              id="cr-text"
              required
              minLength={30}
              rows={6}
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              placeholder="Paste indemnification, limitation of liability, termination, IP ownership, and arbitration clauses..."
              className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={analyzing || !activeMatter}
              className="neu-btn-primary px-5 py-2.5 text-xs font-semibold rounded-full disabled:opacity-50"
            >
              {analyzing ? 'Auditing Against Playbook...' : 'Generate Risk Matrix & Redlines'}
            </button>
          </div>
        </form>
      )}

      {activeReview ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Summary + Clause Risk Matrix */}
          <div className="lg:col-span-8 space-y-5">
            <section className="neu-card rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-hairline">
                <div>
                  <p className="text-xs font-mono text-teal-accent font-medium">
                    {activeReview.playbook}
                  </p>
                  <h3 className="font-display text-base font-semibold text-ink mt-0.5">
                    {activeReview.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3.5 text-xs font-mono tabular-nums">
                  <span className="text-[#9c2f28] dark:text-[#f29b94] font-semibold">
                    {counts.high} High
                  </span>
                  <span aria-hidden="true" className="text-ink-muted/60">
                    /
                  </span>
                  <span className="text-[#156a53] dark:text-emerald-400 font-semibold">
                    {counts.accepted} Accepted
                  </span>
                  <span aria-hidden="true" className="text-ink-muted/60">
                    /
                  </span>
                  <span className="text-ink-muted">{counts.total} Total</span>
                </div>
              </div>
              <p className="mt-3.5 text-sm leading-relaxed text-ink-secondary">
                {activeReview.summary}
              </p>

              {/* Filter Tab Strip */}
              <div className="mt-4 pt-4 border-t border-stone-hairline flex flex-wrap items-center gap-2">
                {(
                  [
                    ['all', 'All Clauses'],
                    ['high', 'High Risk'],
                    ['medium', 'Medium Risk'],
                    ['low', 'Low Risk'],
                    ['accepted', 'Accepted Redlines'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverityFilter(key)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                      severityFilter === key
                        ? 'neu-btn-primary'
                        : 'neu-btn-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Clause Diff Cards */}
            <div className="space-y-4">
              {filteredClauses.map((clause) => {
                const sev = severityLabel(clause.severity);
                return (
                  <article key={clause.id} className="neu-card rounded-3xl p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-ink">
                            {clause.clauseRef}
                          </span>
                          <span aria-hidden="true" className="text-ink-muted">
                            ·
                          </span>
                          <span className={`font-semibold inline-flex items-center gap-1 ${sev.cls}`}>
                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>{sev.text}</span>
                          </span>
                          <span aria-hidden="true" className="text-ink-muted">
                            ·
                          </span>
                          <span className="font-medium text-ink-secondary capitalize">
                            Status: {clause.decision}
                          </span>
                        </div>
                        <h4 className="mt-1 font-display text-sm font-semibold text-ink">
                          {clause.title}
                        </h4>
                        <p className="text-xs text-ink-muted mt-0.5">{clause.issueSummary}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDecision(clause.id, 'accepted')}
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                            clause.decision === 'accepted'
                              ? 'bg-[#156a53] text-[#faf8f4] shadow-sm'
                              : 'neu-btn-secondary'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          <span>Accept Redline</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(clause.id, 'rejected')}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                            clause.decision === 'rejected'
                              ? 'bg-[#4e5b5d] text-[#faf8f4] shadow-sm'
                              : 'neu-btn-secondary'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Side-by-Side Redline Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs leading-relaxed">
                      <div className="p-4 rounded-2xl bg-[#b23a32]/7 border border-[#b23a32]/25">
                        <p className="font-mono text-[11px] font-semibold text-[#9c2f28] dark:text-[#f29b94] mb-1.5">
                          Original Counterparty Clause
                        </p>
                        <p className="text-ink line-through decoration-[#b23a32]/65">
                          {clause.originalText}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#156a53]/8 border border-[#156a53]/25">
                        <p className="font-mono text-[11px] font-semibold text-[#156a53] dark:text-emerald-400 mb-1.5">
                          Proposed Balanced Redline
                        </p>
                        <p className="text-ink">{clause.proposedText}</p>
                      </div>
                    </div>

                    <p className="text-xs text-ink-secondary leading-relaxed pt-2 border-t border-stone-hairline">
                      <strong className="text-ink">Legal Rationale:</strong> {clause.legalRationale}
                    </p>
                  </article>
                );
              })}

              {filteredClauses.length === 0 && (
                <div className="neu-empty rounded-2xl p-8 text-center text-xs text-ink-muted">
                  No clauses match this filter.
                </div>
              )}
            </div>
          </div>

          {/* Right: Due Diligence Requisitions */}
          <aside className="lg:col-span-4 neu-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
              <h3 className="font-display text-sm font-semibold text-ink">
                Due Diligence Requisitions
              </h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Actionable disclosure items to issue to counterparty counsel before execution or closing.
            </p>
            <ol className="space-y-3.5 text-xs text-ink-secondary divide-y divide-[#ddd5c5] dark:divide-[#263336]">
              {activeReview.requisitions.map((req, idx) => (
                <li key={idx} className="pt-3.5 first:pt-0 flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-teal-accent shrink-0">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span className="leading-relaxed">{req}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      ) : (
        <div className="neu-empty rounded-3xl p-12 text-center">
          <p className="text-sm text-ink-secondary">
            No contract reviews saved for this matter yet.
          </p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="neu-btn-primary mt-4 px-5 py-2.5 text-xs font-semibold rounded-full"
          >
            Audit First Contract
          </button>
        </div>
      )}
    </div>
  );
}
