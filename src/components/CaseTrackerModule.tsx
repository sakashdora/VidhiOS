import React, { useMemo, useState } from 'react';
import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  Circle,
  Plus,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  calculateLimitationDeadline,
  LIMITATION_RULES,
} from '../lib/legal/limitationCalculator';
import type { DeadlineItem, Matter, TrackedCase } from '../types/legal';

interface CaseTrackerModuleProps {
  activeMatter: Matter | null;
  cases: TrackedCase[];
  deadlines: DeadlineItem[];
  onCaseAdded: (tc: TrackedCase) => void;
  onCaseUpdated: (tc: TrackedCase) => void;
  onDeadlineAdded: (dl: DeadlineItem) => void;
  onDeadlineToggled: (dl: DeadlineItem) => void;
  onToast: (msg: string) => void;
}

export function CaseTrackerModule({
  activeMatter,
  cases,
  deadlines,
  onCaseAdded,
  onCaseUpdated,
  onDeadlineAdded,
  onDeadlineToggled,
  onToast,
}: CaseTrackerModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCase, setShowAddCase] = useState(false);

  const [caseNumber, setCaseNumber] = useState('');
  const [cnrNumber, setCnrNumber] = useState('');
  const [court, setCourt] = useState('Supreme Court of India');
  const [courtroom, setCourtroom] = useState('');
  const [bench, setBench] = useState('');
  const [causeListItem, setCauseListItem] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [stage, setStage] = useState('Notice / Admission');
  const [savingCase, setSavingCase] = useState(false);

  const [ruleId, setRuleId] = useState(LIMITATION_RULES[0].id);
  const [triggerDate, setTriggerDate] = useState(
    new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10)
  );
  const [pinning, setPinning] = useState(false);

  const calcResult = useMemo(() => {
    try {
      return calculateLimitationDeadline(ruleId, triggerDate);
    } catch {
      return null;
    }
  }, [ruleId, triggerDate]);

  const filteredCases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.caseNumber, c.cnrNumber, c.court, c.bench, c.stage, c.causeListItem]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [cases, searchTerm]);

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    setSavingCase(true);
    try {
      const created = await api.addTrackedCase({
        matterId: activeMatter.id,
        caseNumber,
        cnrNumber,
        court,
        courtroom,
        bench,
        causeListItem,
        nextHearingDate,
        stage,
        status: 'listed',
        notes: '',
      });
      onCaseAdded(created);
      setCaseNumber('');
      setCnrNumber('');
      setCourtroom('');
      setBench('');
      setCauseListItem('');
      setShowAddCase(false);
      onToast(`Tracked ${created.caseNumber} (${created.court}).`);
    } finally {
      setSavingCase(false);
    }
  };

  const handleStatusChange = async (caseId: string, status: TrackedCase['status']) => {
    const updated = await api.updateCaseStatus(caseId, status);
    onCaseUpdated(updated);
    onToast(`Updated ${updated.caseNumber} status to ${status.replace('_', ' ')}.`);
  };

  const handlePinDeadline = async () => {
    if (!activeMatter || !calcResult) return;
    setPinning(true);
    try {
      const created = await api.addDeadline({
        matterId: activeMatter.id,
        title: `${calcResult.rule.label} — ${activeMatter.matterCode}`,
        statuteArticle: `${calcResult.rule.statute} (${calcResult.rule.articleOrSection})`,
        triggerDate: calcResult.triggerDate,
        dueDate: calcResult.effectiveDueDate,
        graceDate: calcResult.graceDeadlineDate,
        notes: calcResult.guidanceSummary,
      });
      onDeadlineAdded(created);
      onToast(`Pinned limitation deadline (${created.dueDate}) to active Matter.`);
    } finally {
      setPinning(false);
    }
  };

  const handleToggleDeadline = async (id: string) => {
    const updated = await api.toggleDeadline(id);
    onDeadlineToggled(updated);
  };

  return (
    <div className="space-y-6">
      {/* Cause List & Live Display Board */}
      <section className="neu-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Case Tracker, Cause Lists &amp; Live Display Board
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Monitor Supreme Court, High Courts, District Courts, NCLT, and International Arbitral dockets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3.5 top-2.5" strokeWidth={2} />
              <input
                aria-label="Filter tracked cases"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search case, CNR, court..."
                className="neu-input pl-9 pr-3.5 py-2 text-xs rounded-full"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddCase((v) => !v)}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Track Case</span>
            </button>
          </div>
        </div>

        {showAddCase && (
          <form
            onSubmit={handleAddCase}
            className="neu-inset p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <input
              required
              aria-label="Case Number"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="Case No. (e.g., WP(C)/904/2026)"
              className="neu-input px-3.5 py-2 text-xs rounded-xl"
            />
            <input
              aria-label="CNR Number"
              value={cnrNumber}
              onChange={(e) => setCnrNumber(e.target.value)}
              placeholder="CNR / Diary No."
              className="neu-input px-3.5 py-2 text-xs font-mono rounded-xl"
            />
            <input
              required
              aria-label="Court or Tribunal"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              placeholder="Court / Tribunal"
              className="neu-input px-3.5 py-2 text-xs rounded-xl"
            />
            <input
              aria-label="Courtroom and Item"
              value={causeListItem}
              onChange={(e) => setCauseListItem(e.target.value)}
              placeholder="Item No. (e.g., Sr. No. 12)"
              className="neu-input px-3.5 py-2 text-xs rounded-xl"
            />
            <input
              aria-label="Courtroom"
              value={courtroom}
              onChange={(e) => setCourtroom(e.target.value)}
              placeholder="Courtroom (e.g., Court 4)"
              className="neu-input px-3.5 py-2 text-xs rounded-xl"
            />
            <input
              aria-label="Presiding Bench"
              value={bench}
              onChange={(e) => setBench(e.target.value)}
              placeholder="Bench / Judge Name"
              className="neu-input px-3.5 py-2 text-xs rounded-xl"
            />
            <input
              type="date"
              required
              aria-label="Next Hearing Date"
              value={nextHearingDate}
              onChange={(e) => setNextHearingDate(e.target.value)}
              className="neu-input px-3.5 py-2 text-xs font-mono rounded-xl"
            />
            <div className="flex gap-2">
              <input
                required
                aria-label="Stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="Stage"
                className="neu-input flex-1 min-w-0 px-3.5 py-2 text-xs rounded-xl"
              />
              <button
                type="submit"
                disabled={savingCase || !activeMatter}
                className="neu-btn-primary px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
              >
                Add
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="neu-table-head text-ink-secondary">
                <th className="py-3 pl-3 pr-4 font-semibold whitespace-nowrap rounded-l-xl">Case &amp; CNR</th>
                <th className="py-3 pr-4 font-semibold">Court &amp; Bench</th>
                <th className="py-3 pr-4 font-semibold whitespace-nowrap">Cause List / Room</th>
                <th className="py-3 pr-4 font-semibold whitespace-nowrap">Next Hearing</th>
                <th className="py-3 pr-4 font-semibold">Stage</th>
                <th className="py-3 pr-3 font-semibold whitespace-nowrap rounded-r-xl">Display Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ddd5c5] dark:divide-[#263336]">
              {filteredCases.map((tc) => (
                <tr key={tc.id} className="hover:bg-[#efe9dc]/60 dark:hover:bg-[#1f2a2d]/60 transition-colors">
                  <td className="py-3.5 pl-3 pr-4">
                    <p className="font-mono font-semibold text-ink whitespace-nowrap">
                      {tc.caseNumber}
                    </p>
                    <p className="font-mono text-[11px] text-ink-muted">
                      {tc.cnrNumber || '—'}
                    </p>
                  </td>
                  <td className="py-3.5 pr-4">
                    <p className="font-medium text-ink">{tc.court}</p>
                    <p className="text-[11px] text-ink-muted">{tc.bench || 'Bench TBD'}</p>
                  </td>
                  <td className="py-3.5 pr-4">
                    <p className="text-ink">{tc.causeListItem || 'Unlisted'}</p>
                    <p className="text-[11px] text-ink-muted">{tc.courtroom || '—'}</p>
                  </td>
                  <td className="py-3.5 pr-4 font-mono tabular-nums font-semibold text-teal-accent whitespace-nowrap">
                    {tc.nextHearingDate}
                  </td>
                  <td className="py-3.5 pr-4 text-ink-secondary">{tc.stage}</td>
                  <td className="py-3.5 pr-3">
                    <select
                      aria-label={`Status for ${tc.caseNumber}`}
                      value={tc.status}
                      onChange={(e) =>
                        handleStatusChange(tc.id, e.target.value as TrackedCase['status'])
                      }
                      className="neu-input px-3 py-1.5 text-xs rounded-full"
                    >
                      <option value="listed">Listed</option>
                      <option value="in_session">Board Running</option>
                      <option value="adjourned">Adjourned</option>
                      <option value="disposed">Disposed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    No tracked cases match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Split: Deterministic Limitation Act Calculator + Active Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 neu-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
            <h3 className="font-display text-base font-semibold text-ink">
              Indian Limitation Act &amp; Statutory Deadline Calculator
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="lim-rule" className="block text-xs font-medium text-ink-secondary mb-1">
                Statutory Provision / Remedy
              </label>
              <select
                id="lim-rule"
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
              >
                {LIMITATION_RULES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lim-trigger" className="block text-xs font-medium text-ink-secondary mb-1">
                Order / Award / Trigger Date
              </label>
              <input
                id="lim-trigger"
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs font-mono rounded-xl"
              />
            </div>
          </div>

          {calcResult && (
            <div className="neu-inset p-5 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-ink-muted">Prescribed Expiry</p>
                  <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-ink">
                    {calcResult.effectiveDueDate}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted">Days Remaining</p>
                  <p
                    className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${
                      calcResult.urgencyStatus === 'overdue'
                        ? 'text-[#9c2f28] dark:text-[#f29b94]'
                        : calcResult.urgencyStatus === 'urgent' ||
                            calcResult.urgencyStatus === 'approaching'
                          ? 'text-[#b86b14] dark:text-amber-400'
                          : 'text-[#156a53] dark:text-emerald-400'
                    }`}
                  >
                    {calcResult.daysRemaining >= 0
                      ? `${calcResult.daysRemaining} days`
                      : `${Math.abs(calcResult.daysRemaining)}d overdue`}
                  </p>
                </div>
                {calcResult.graceDeadlineDate && (
                  <div>
                    <p className="text-ink-muted">Outer Condonable Cap</p>
                    <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#b86b14] dark:text-amber-400">
                      {calcResult.graceDeadlineDate}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs leading-relaxed text-ink-secondary border-t border-stone-hairline pt-2.5">
                {calcResult.guidanceSummary}
              </p>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                <strong className="text-ink">Practice Note:</strong> {calcResult.rule.practiceNote}
              </p>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  disabled={pinning || !activeMatter}
                  onClick={handlePinDeadline}
                  className="neu-btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full disabled:opacity-50"
                >
                  <CalendarClock className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{pinning ? 'Pinning...' : 'Pin Deadline to Matter'}</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Pinned Deadlines Calendar List */}
        <section className="lg:col-span-6 neu-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-ink">
              Pinned Statutory &amp; Filing Deadlines ({deadlines.length})
            </h3>
            <span className="font-mono text-xs tabular-nums text-teal-accent font-semibold">
              {deadlines.filter((d) => !d.completed).length} open
            </span>
          </div>

          {deadlines.length === 0 ? (
            <div className="neu-empty rounded-2xl py-8 px-4 text-xs text-ink-muted text-center">
              Compute a deadline with the Limitation Calculator and pin it here.
            </div>
          ) : (
            <div className="divide-y divide-[#ddd5c5] dark:divide-[#263336]">
              {deadlines.map((dl) => (
                <div key={dl.id} className="py-3.5 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleDeadline(dl.id)}
                    aria-label={`Toggle completion for ${dl.title}`}
                    className="flex items-start gap-2.5 text-left group min-w-0"
                  >
                    {dl.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#156a53] dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
                    ) : (
                      <Circle className="w-4 h-4 text-ink-muted group-hover:text-teal-accent shrink-0 mt-0.5" strokeWidth={2} />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          dl.completed ? 'line-through text-ink-muted' : 'text-ink'
                        }`}
                      >
                        {dl.title}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">{dl.statuteArticle}</p>
                    </div>
                  </button>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs tabular-nums font-semibold text-[#b86b14] dark:text-amber-400">
                      Due {dl.dueDate}
                    </p>
                    {dl.graceDate && (
                      <p className="font-mono text-[11px] tabular-nums text-ink-muted">
                        Cap {dl.graceDate}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
