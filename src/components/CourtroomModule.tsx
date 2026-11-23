import React, { useState } from 'react';
import { AlertCircle, Gavel, Plus, Send, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { CourtroomSession, Matter } from '../types/legal';

interface CourtroomModuleProps {
  activeMatter: Matter | null;
  sessions: CourtroomSession[];
  onSessionCreated: (session: CourtroomSession) => void;
  onSessionUpdated: (session: CourtroomSession) => void;
  onToast: (msg: string) => void;
}

export function CourtroomModule({
  activeMatter,
  sessions,
  onSessionCreated,
  onSessionUpdated,
  onToast,
}: CourtroomModuleProps) {
  const [selectedId, setSelectedId] = useState<string>(sessions[0]?.id ?? '');
  const activeSession = sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null;

  const [showNew, setShowNew] = useState(sessions.length === 0);
  const [mode, setMode] = useState<'bench' | 'opposing_counsel'>('bench');
  const [forumContext, setForumContext] = useState(
    activeMatter?.forum ?? 'High Court Division Bench'
  );
  const [briefExcerpt, setBriefExcerpt] = useState(activeMatter?.summaryFacts ?? '');
  const [openingSubmission, setOpeningSubmission] = useState(
    'May it please Your Lordship, the present dispute is purely commercial in nature arising from a Joint Venture Agreement with an existing arbitration notice predating the FIR.'
  );
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (activeMatter) {
      setForumContext(activeMatter.forum);
      setBriefExcerpt(activeMatter.summaryFacts);
    }
  }, [activeMatter]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    setError(null);
    setBusy(true);
    try {
      const created = await api.startCourtroomSession({
        matterId: activeMatter.id,
        mode,
        forumContext,
        briefExcerpt,
        openingSubmission,
      });
      onSessionCreated(created);
      setSelectedId(created.id);
      setShowNew(false);
      onToast(
        mode === 'bench'
          ? 'Hon’ble Bench simulation started.'
          : 'Opposing Counsel cross-examination started.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation.');
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !replyText.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await api.replyCourtroomSession(activeSession.id, replyText.trim());
      onSessionUpdated(updated);
      setReplyText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send oral submission.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="neu-card rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Adversarial Courtroom Simulator
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Stress-test petitions and oral arguments against a probing Bench or aggressive Opposing Counsel before hearing day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          <span>{showNew ? 'View Active Session' : 'New Simulation'}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
        >
          {error}
        </div>
      )}

      {showNew ? (
        <form onSubmit={handleStartSession} className="neu-card rounded-3xl p-6 sm:p-7 space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-hairline">
            <h3 className="font-display text-base font-semibold text-ink">
              Configure Hearing Simulation
            </h3>
            <div className="neu-tab-bar rounded-xl px-1.5 py-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode('bench')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                  mode === 'bench'
                    ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Hon’ble Bench (Judge)
              </button>
              <button
                type="button"
                onClick={() => setMode('opposing_counsel')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                  mode === 'opposing_counsel'
                    ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Opposing Counsel
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="sim-forum" className="block text-xs font-medium text-ink-secondary mb-1">
              Court / Tribunal / Bench Context
            </label>
            <input
              id="sim-forum"
              required
              value={forumContext}
              onChange={(e) => setForumContext(e.target.value)}
              className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="sim-brief" className="block text-xs font-medium text-ink-secondary mb-1">
              Case Brief / Petition Excerpt to Stress-Test
            </label>
            <textarea
              id="sim-brief"
              required
              rows={3}
              value={briefExcerpt}
              onChange={(e) => setBriefExcerpt(e.target.value)}
              className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="sim-opening" className="block text-xs font-medium text-ink-secondary mb-1">
              Your Opening Oral Submission
            </label>
            <textarea
              id="sim-opening"
              required
              rows={3}
              value={openingSubmission}
              onChange={(e) => setOpeningSubmission(e.target.value)}
              className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="neu-btn-secondary px-4 py-2 text-xs font-semibold rounded-full"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !activeMatter}
              className="neu-btn-primary px-5 py-2.5 text-xs font-semibold rounded-full disabled:opacity-50"
            >
              {busy ? 'Opening Hearing...' : 'Start Oral Argument Simulation'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Session List */}
          <aside className="lg:col-span-3 neu-card rounded-2xl p-4 space-y-2.5">
            <h3 className="font-display text-xs font-semibold text-ink-muted">
              Rehearsal Sessions ({sessions.length})
            </h3>
            {sessions.map((s) => {
              const selected = s.id === activeSession?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'bg-[#0f5a5f] dark:bg-[#14777e] border-[#0f5a5f] text-[#faf8f4] shadow-sm'
                      : 'neu-inset border-stone-hairline text-ink hover:border-[#0f5a5f]'
                  }`}
                >
                  <p className="text-xs font-semibold">
                    {s.mode === 'bench' ? 'Hon’ble Bench Mode' : 'Opposing Counsel Mode'}
                  </p>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      selected ? 'text-[#d4ecee]' : 'text-ink-muted'
                    }`}
                  >
                    {s.forumContext}
                  </p>
                </button>
              );
            })}
          </aside>

          {/* Exchange Stream */}
          <section className="lg:col-span-6 neu-card rounded-3xl p-6 flex flex-col">
            {activeSession ? (
              <>
                <div className="pb-3.5 border-b border-stone-hairline flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-teal-accent" strokeWidth={2} />
                      <span>
                        {activeSession.mode === 'bench'
                          ? 'Hon’ble Bench Questioning'
                          : 'Opposing Counsel Cross-Attack'}
                      </span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">{activeSession.forumContext}</p>
                  </div>
                </div>

                <div className="py-4 space-y-5 max-h-[520px] overflow-y-auto pr-1">
                  {activeSession.turns.map((turn) => (
                    <div key={turn.id} className="space-y-2.5">
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          turn.speaker === 'counsel'
                            ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] ml-8 shadow-sm'
                            : 'neu-inset text-ink mr-4'
                        }`}
                      >
                        <p
                          className={`text-[11px] font-mono font-semibold mb-1 ${
                            turn.speaker === 'counsel' ? 'text-[#cbe6e8]' : 'text-teal-accent'
                          }`}
                        >
                          {turn.speaker === 'counsel'
                            ? 'Your Oral Submission'
                            : turn.speaker === 'bench'
                              ? 'Hon’ble Bench'
                              : 'Opposing Counsel'}
                        </p>
                        <p>{turn.message}</p>
                      </div>

                      {turn.suggestedRebuttal && (
                        <div className="neu-card-flat p-4 rounded-2xl text-xs space-y-2 mr-4">
                          {turn.weaknessFlag && (
                            <p className="text-[#b86b14] dark:text-amber-300 flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
                              <span>
                                <strong>Vulnerability Probed:</strong> {turn.weaknessFlag}
                              </span>
                            </p>
                          )}
                          <p className="text-ink-secondary leading-relaxed">
                            <strong className="text-ink">Suggested Rebuttal:</strong>{' '}
                            {turn.suggestedRebuttal}
                          </p>
                          {turn.authorities && turn.authorities.length > 0 && (
                            <p className="text-[11px] font-mono text-ink-muted">
                              Authorities: {turn.authorities.join(' · ')}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setReplyText(turn.suggestedRebuttal ?? '')}
                            className="text-xs font-semibold text-teal-accent hover:underline"
                          >
                            Load Suggested Rebuttal into Input
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleReply} className="pt-3.5 border-t border-stone-hairline flex gap-2">
                  <label htmlFor="sim-reply" className="sr-only">
                    Respond to Bench or Opposing Counsel
                  </label>
                  <input
                    id="sim-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Deliver your oral response..."
                    className="neu-input flex-1 px-4 py-2.5 text-sm rounded-full"
                  />
                  <button
                    type="submit"
                    disabled={busy || !replyText.trim()}
                    className="neu-btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{busy ? 'Responding...' : 'Submit'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="neu-empty rounded-2xl py-12 px-6 text-center text-sm text-ink-muted">
                Start a courtroom simulation to rehearse arguments.
              </div>
            )}
          </section>

          {/* Exposed Vulnerabilities Summary */}
          <aside className="lg:col-span-3 neu-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#b86b14] dark:text-amber-400 shrink-0" strokeWidth={2} />
              <h3 className="font-display text-sm font-semibold text-ink">
                Brief Vulnerabilities
              </h3>
            </div>
            {activeSession && activeSession.vulnerabilities.length > 0 ? (
              <ul className="space-y-2.5 text-xs text-ink-secondary divide-y divide-[#ddd5c5] dark:divide-[#263336]">
                {activeSession.vulnerabilities.map((v, i) => (
                  <li key={i} className="pt-2.5 first:pt-0 leading-relaxed">
                    {v}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-muted">
                Vulnerabilities exposed during questioning will appear here.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
