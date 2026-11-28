import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileCheck,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { CitationTextRenderer } from './CitationTextRenderer';
import { ErrorBanner, InfoBanner, PageHeader, StatusBadge } from './ui/DesignSystem';
import type {
  EvidenceItemRecord,
  LitigationStrategyRecord,
  Matter,
  VaultDocument,
  WorkflowRunRecord,
} from '../types/legal';

interface CaseIntelligenceModuleProps {
  activeMatter: Matter | null;
  vaultDocuments: VaultDocument[];
  workflowRuns: WorkflowRunRecord[];
  evidenceItems: EvidenceItemRecord[];
  strategies: LitigationStrategyRecord[];
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function CaseIntelligenceModule({
  activeMatter,
  vaultDocuments,
  workflowRuns,
  evidenceItems,
  strategies,
  onRefreshWorkspace,
  onToast,
}: CaseIntelligenceModuleProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'graph' | 'strategy' | 'evidence'>('agents');
  const [workflowType, setWorkflowType] = useState<
    'full_matter_brief' | 'research_verification' | 'draft_audit' | 'contract_risk_audit' | 'compliance_deadline_check'
  >('full_matter_brief');
  const [goal, setGoal] = useState(
    'Prepare a verified multi-agent litigation brief identifying controlling BNS/BNSS/BSA authorities, procedural risks, and immediate next filings.'
  );
  const [runningAgent, setRunningAgent] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<{
    nodes: Array<{ id: string; label: string; category: string }>;
    edges: Array<{ from: string; to: string; relation: string }>;
  } | null>(null);
  const [conflicts, setConflicts] = useState<
    Array<{
      topic: string;
      supportingAuthority: string;
      adverseOrDistinguishedAuthority: string;
      courtHierarchyNote: string;
      distinctionSummary: string;
    }>
  >([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [exhibitNum, setExhibitNum] = useState('Exh. P-1');
  const [exhibitTitle, setExhibitTitle] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [admissibility, setAdmissibility] =
    useState<EvidenceItemRecord['admissibilityStatus']>('verified_63_bsa');
  const [exhibitNotes, setExhibitNotes] = useState('');
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStrategy = strategies.find((s) => activeMatter && s.matterId === activeMatter.id) ?? null;
  const matterEvidence = evidenceItems.filter((e) => !activeMatter || e.matterId === activeMatter.id);

  const loadKnowledgeGraph = async () => {
    if (!activeMatter) return;
    setLoadingGraph(true);
    try {
      const res = await api.getKnowledgeGraph(activeMatter.id);
      setGraphData(res.graph);
      setConflicts(res.conflicts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge graph.');
    } finally {
      setLoadingGraph(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'graph' && activeMatter) {
      void loadKnowledgeGraph();
    }
  }, [activeTab, activeMatter?.id]);

  const handleRunWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setError(null);
    setRunningAgent(true);
    try {
      await api.runMultiAgentWorkflow({
        matterId: activeMatter?.id ?? null,
        workflowType,
        goal: goal.trim(),
      });
      await onRefreshWorkspace();
      onToast('Multi-agent workflow executed. Human verification pending.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow failed.');
    } finally {
      setRunningAgent(false);
    }
  };

  const handleApproveRun = async (runId: string) => {
    setApprovingId(runId);
    try {
      await api.approveWorkflowRun(runId);
      await onRefreshWorkspace();
      onToast('Workflow approved by counsel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleGenerateStrategy = async () => {
    if (!activeMatter) return;
    setError(null);
    setGeneratingStrategy(true);
    try {
      await api.generateStrategy(activeMatter.id);
      await onRefreshWorkspace();
      onToast('Litigation Strategy Board updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strategy generation failed.');
    } finally {
      setGeneratingStrategy(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter || !exhibitTitle.trim()) return;
    setSavingEvidence(true);
    setError(null);
    try {
      await api.addEvidenceItem({
        matterId: activeMatter.id,
        exhibitNumber: exhibitNum.trim(),
        title: exhibitTitle.trim(),
        sourceDocumentId: vaultDocuments[0]?.id,
        witnessName: witnessName.trim() || undefined,
        admissibilityStatus: admissibility,
        notes: exhibitNotes.trim(),
      });
      setExhibitTitle('');
      setWitnessName('');
      setExhibitNotes('');
      await onRefreshWorkspace();
      onToast('Exhibit indexed in Evidence Intelligence.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exhibit.');
    } finally {
      setSavingEvidence(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Case Intelligence & Multi-Agent Orchestrator"
        subtitle="Controlled 7-agent legal workflows, Legal Knowledge Graph, Litigation Strategy Board, and Evidence Admissibility Matrix."
        badge={activeMatter?.matterCode || 'Workspace'}
      />

      <div className="neu-tab-bar rounded-xl p-1 flex flex-wrap gap-1">
        {(
          [
            ['agents', 'Multi-Agent Workflows (7 Agents)'],
            ['graph', 'Knowledge Graph & Conflicts'],
            ['strategy', 'Litigation Strategy'],
            ['evidence', `Evidence Intelligence (${matterEvidence.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === id
                ? 'bg-[#0d5c63] text-white'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleRunWorkflow} className="lg:col-span-5 neu-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-hairline pb-3">
              <Bot className="w-4 h-4 text-teal-accent" />
              <h3 className="font-display text-sm font-semibold text-ink">
                Launch Controlled Agent Pipeline
              </h3>
            </div>
            <div>
              <label htmlFor="wf-type" className="block text-xs font-medium text-ink-secondary mb-1">
                Pipeline Preset
              </label>
              <select
                id="wf-type"
                value={workflowType}
                onChange={(e) => setWorkflowType(e.target.value as any)}
                className="neu-input w-full px-3 py-2 text-xs rounded-lg"
              >
                <option value="full_matter_brief">Full Matter Brief (Doc → Research → Analysis → Compliance → QA)</option>
                <option value="research_verification">Research &amp; Precedent Verification</option>
                <option value="draft_audit">Drafting &amp; Procedural Compliance Audit</option>
                <option value="contract_risk_audit">Contract Review &amp; Compliance Pipeline</option>
                <option value="compliance_deadline_check">Compliance &amp; Limitation Check</option>
              </select>
            </div>
            <div>
              <label htmlFor="wf-goal" className="block text-xs font-medium text-ink-secondary mb-1">
                Task Objective
              </label>
              <textarea
                id="wf-goal"
                rows={4}
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="neu-input w-full px-3 py-2 text-xs rounded-lg"
              />
            </div>
            <InfoBanner>
              Agents execute inside a bounded 5-step pipeline, track token/API usage, and pause for human counsel approval before any consequential action.
            </InfoBanner>
            <button
              type="submit"
              disabled={runningAgent}
              className="neu-btn-primary w-full py-2.5 px-4 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {runningAgent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{runningAgent ? 'Executing Agents...' : 'Run Multi-Agent Workflow'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {workflowRuns.length === 0 ? (
              <div className="neu-empty rounded-xl p-10 text-center text-xs text-ink-muted">
                Run a multi-agent legal workflow on the left to inspect step-by-step agent logs and verification checks.
              </div>
            ) : (
              workflowRuns.slice(0, 5).map((run) => (
                <article key={run.id} className="neu-card rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-hairline">
                    <div>
                      <p className="font-mono text-[11px] text-teal-accent uppercase font-semibold">
                        {run.workflowType.replace(/_/g, ' ')} · {run.totalTokens} tokens · {run.totalLatencyMs}ms
                      </p>
                      <h4 className="font-display text-sm font-semibold text-ink mt-0.5">{run.goal}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={run.status === 'completed' ? 'success' : 'warning'}>
                        {run.status.replace('_', ' ')}
                      </StatusBadge>
                      {run.status === 'awaiting_approval' && (
                        <button
                          type="button"
                          disabled={approvingId === run.id}
                          onClick={() => handleApproveRun(run.id)}
                          className="neu-btn-primary px-3 py-1.5 text-[11px] font-semibold rounded-lg"
                        >
                          {approvingId === run.id ? 'Approving...' : 'Approve Output'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {run.steps.map((st) => (
                      <div key={st.id} className="neu-inset rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink inline-flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-accent" />
                            <span>{st.agentName}</span>
                          </span>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {st.latencyMs}ms · {st.tokensUsed} tok
                          </span>
                        </div>
                        <CitationTextRenderer markdown={st.outputSummary} density="compact" />
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 neu-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-hairline pb-3">
              <h3 className="font-display text-sm font-semibold text-ink inline-flex items-center gap-2">
                <Network className="w-4 h-4 text-teal-accent" />
                <span>Matter Legal Knowledge Graph</span>
              </h3>
              <button
                type="button"
                onClick={loadKnowledgeGraph}
                disabled={loadingGraph || !activeMatter}
                className="neu-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg"
              >
                {loadingGraph ? 'Refreshing...' : 'Refresh Graph'}
              </button>
            </div>
            {graphData && graphData.nodes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {graphData.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="neu-inset px-3 py-2 rounded-lg text-xs border border-stone-hairline"
                    >
                      <span className="font-mono text-[10px] uppercase text-teal-accent block">
                        {node.category}
                      </span>
                      <span className="font-medium text-ink">{node.label}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-stone-hairline pt-3">
                  <p className="text-xs font-semibold text-ink mb-2">
                    Verified Relationships ({graphData.edges.length})
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
                    {graphData.edges.map((e, idx) => {
                      const fromNode = graphData.nodes.find((n) => n.id === e.from)?.label || e.from;
                      const toNode = graphData.nodes.find((n) => n.id === e.to)?.label || e.to;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-ink-secondary">
                          <span className="font-medium text-ink truncate max-w-[38%]">{fromNode}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-inset)] text-teal-accent shrink-0">
                            {e.relation}
                          </span>
                          <span className="truncate flex-1">{toNode}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted py-6">Select an active matter to inspect its entity &amp; precedent graph.</p>
            )}
          </section>

          <section className="lg:col-span-5 neu-card rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-hairline pb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-display text-sm font-semibold text-ink">
                Precedent Conflict Detector ({conflicts.length})
              </h3>
            </div>
            {conflicts.length === 0 ? (
              <p className="text-xs text-ink-muted py-4">
                No conflicting doctrinal lines detected for this matter&apos;s current facts.
              </p>
            ) : (
              <div className="space-y-3">
                {conflicts.map((c, i) => (
                  <div key={i} className="neu-inset rounded-xl p-3.5 text-xs space-y-1.5">
                    <p className="font-semibold text-ink">{c.topic}</p>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      <strong>Supporting:</strong> {c.supportingAuthority}
                    </p>
                    <p className="text-amber-800 dark:text-amber-300">
                      <strong>Adverse / Distinguished:</strong> {c.adverseOrDistinguishedAuthority}
                    </p>
                    <p className="text-ink-secondary">{c.courtHierarchyNote}</p>
                    <p className="text-ink-muted">{c.distinctionSummary}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'strategy' && (
        <section className="neu-card rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-hairline pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-ink">
                Litigation Strategy Workspace
              </h3>
              <p className="text-xs text-ink-muted">
                Organize case theory, supporting/adverse facts, precedents, evidentiary gaps, and cross-examination questions.
              </p>
            </div>
            <button
              type="button"
              disabled={!activeMatter || generatingStrategy}
              onClick={handleGenerateStrategy}
              className="neu-btn-primary px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {generatingStrategy ? 'Generating Strategy...' : 'Generate AI Strategy Board'}
            </button>
          </div>

          {activeStrategy ? (
            <div className="space-y-4">
              <InfoBanner tone="warning">{activeStrategy.aiGeneratedDisclaimer}</InfoBanner>
              <div className="neu-inset p-4 rounded-xl text-xs space-y-1">
                <p className="font-semibold text-teal-accent uppercase font-mono text-[11px]">
                  Case Theory (AI-Assisted Draft)
                </p>
                <p className="text-ink leading-relaxed">{activeStrategy.caseTheory}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  ['Legal Issues', activeStrategy.legalIssues],
                  ['Supporting Facts', activeStrategy.supportingFacts],
                  ['Adverse Facts & Risks', activeStrategy.adverseFacts],
                  ['Supporting Precedents', activeStrategy.supportingPrecedents],
                  ['Evidence Requirements', activeStrategy.evidenceRequirements],
                  ['Cross-Examination Questions', activeStrategy.crossExamQuestions],
                ].map(([heading, items]) => (
                  <div key={String(heading)} className="neu-inset p-4 rounded-xl space-y-2">
                    <h4 className="font-semibold text-ink">{heading as string}</h4>
                    <ul className="space-y-1 text-ink-secondary list-disc pl-4">
                      {(items as string[]).map((it, idx) => (
                        <li key={idx}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted py-6">
              Click &ldquo;Generate AI Strategy Board&rdquo; to structure a strategy workspace for {activeMatter?.title || 'your active matter'}.
            </p>
          )}
        </section>
      )}

      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleAddEvidence} className="lg:col-span-5 neu-card rounded-xl p-5 space-y-3.5">
            <h3 className="font-display text-sm font-semibold text-ink flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-accent" />
              <span>Register Exhibit / Evidence Item</span>
            </h3>
            <p className="text-[11px] text-ink-muted">
              Original Vault source files are never modified; track exhibit numbers, witnesses, and Section 63 BSA admissibility status.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                required
                value={exhibitNum}
                onChange={(e) => setExhibitNum(e.target.value)}
                placeholder="Exh. P-1"
                className="neu-input px-3 py-2 text-xs font-mono rounded-lg"
              />
              <select
                value={admissibility}
                onChange={(e) => setAdmissibility(e.target.value as any)}
                className="neu-input px-3 py-2 text-xs rounded-lg"
              >
                <option value="verified_63_bsa">Verified Sec. 63 BSA</option>
                <option value="primary_original">Primary Original</option>
                <option value="requires_certificate">Needs Sec. 63 Cert</option>
                <option value="contested">Contested</option>
              </select>
            </div>
            <input
              required
              value={exhibitTitle}
              onChange={(e) => setExhibitTitle(e.target.value)}
              placeholder="Exhibit Title (e.g., Signed JV Agreement & Ledger)"
              className="neu-input w-full px-3 py-2 text-xs rounded-lg"
            />
            <input
              value={witnessName}
              onChange={(e) => setWitnessName(e.target.value)}
              placeholder="Custodian / Witness Name (optional)"
              className="neu-input w-full px-3 py-2 text-xs rounded-lg"
            />
            <textarea
              rows={2}
              value={exhibitNotes}
              onChange={(e) => setExhibitNotes(e.target.value)}
              placeholder="Admissibility notes or contradiction cross-reference..."
              className="neu-input w-full px-3 py-2 text-xs rounded-lg"
            />
            <button
              type="submit"
              disabled={!activeMatter || savingEvidence}
              className="neu-btn-primary w-full py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {savingEvidence ? 'Saving...' : 'Add Exhibit Record'}
            </button>
          </form>

          <section className="lg:col-span-7 neu-card rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-ink">
              Matter Evidence &amp; Exhibit Matrix ({matterEvidence.length})
            </h3>
            {matterEvidence.length === 0 ? (
              <p className="text-xs text-ink-muted py-6">No exhibits indexed for this matter yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)] text-xs">
                {matterEvidence.map((ev) => (
                  <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        <span className="font-mono text-teal-accent mr-2">{ev.exhibitNumber}</span>
                        {ev.title}
                      </p>
                      {ev.witnessName && (
                        <p className="text-[11px] text-ink-muted mt-0.5">Witness/Custodian: {ev.witnessName}</p>
                      )}
                      {ev.notes && <p className="text-ink-secondary mt-1">{ev.notes}</p>}
                    </div>
                    <StatusBadge
                      tone={
                        ev.admissibilityStatus === 'verified_63_bsa' || ev.admissibilityStatus === 'primary_original'
                          ? 'success'
                          : ev.admissibilityStatus === 'contested'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {ev.admissibilityStatus.replace(/_/g, ' ')}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
