import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileDown,
  Globe2,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { parseLegalCitations } from '../lib/legal/citationParser';
import { CitationTextRenderer } from './CitationTextRenderer';
import type { JurisdictionMode, Matter, ResearchMemo, VerifiedCitation } from '../types/legal';

interface ResearchModuleProps {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  memos: ResearchMemo[];
  onMemoCreated: (memo: ResearchMemo) => void;
  onToast?: (msg: string) => void;
}

interface StreamStage {
  stage: string;
  label: string;
}

interface LiveAuthority {
  title: string;
  url: string;
  court?: string;
  sourceType: string;
  snippet?: string;
}

const SAMPLE_PROMPTS: Record<JurisdictionMode, string[]> = {
  india_litigation: [
    'Scope of anticipatory bail under Section 482 BNSS in economic offences with civil arbitration pending',
    'Mandatory requirements for Section 63 BSA electronic evidence certificate vs Section 65B IEA',
    'Supreme Court tests for quashing criminal FIR under Section 528 BNSS in commercial breach disputes',
  ],
  corporate_ma: [
    'Enforceability of unilateral arbitrator appointment clauses post 2024 Supreme Court Constitution Bench ruling',
    'Indemnity cap and consequential damages exclusions under Section 73 Indian Contract Act in M&A SPAs',
    'RBI Payment Aggregator change-of-control notification timelines in Series B acquisitions',
  ],
  global_multi: [
    'Public policy defence under Section 48 Arbitration Act & Article V(2)(b) New York Convention for SIAC awards',
    'English law liquidated damages penalty test (Cavendish Square v. Makdessi) in EPC solar contracts',
    'GDPR cross-border data transfer safeguards for India-EU SaaS master services agreements',
  ],
};

export function ResearchModule({
  activeMatter,
  jurisdiction,
  memos,
  onMemoCreated,
  onToast,
}: ResearchModuleProps) {
  const [query, setQuery] = useState('');
  const [modelTier, setModelTier] = useState<'fast' | 'expert'>('fast');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(memos[0]?.id ?? null);
  const [highlightCitations, setHighlightCitations] = useState(true);

  // Streaming real-time state
  const [streamingText, setStreamingText] = useState('');
  const [currentStage, setCurrentStage] = useState<StreamStage | null>(null);
  const [liveAuthorities, setLiveAuthorities] = useState<LiveAuthority[]>([]);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);

  const selectedMemo = memos.find((m) => m.id === selectedMemoId) ?? memos[0] ?? null;

  const parsedMemoCitations = useMemo(() => {
    if (!selectedMemo) return null;
    return parseLegalCitations(selectedMemo.answerMarkdown, selectedMemo.citations);
  }, [selectedMemo]);

  // Detected key search keywords for real-time preview
  const liveStatuteChips = useMemo(() => {
    if (!query) return [];
    const tokens: string[] = [];
    const qLower = query.toLowerCase();
    if (qLower.includes('482') || qLower.includes('bail') || qLower.includes('anticipatory')) {
      tokens.push('BNSS Sec. 482 (Anticipatory Bail)');
    }
    if (qLower.includes('528') || qLower.includes('quash') || qLower.includes('fir')) {
      tokens.push('BNSS Sec. 528 (High Court Inherent Powers)');
    }
    if (qLower.includes('63') || qLower.includes('65b') || qLower.includes('electronic')) {
      tokens.push('BSA Sec. 63 (Electronic Evidence)');
    }
    if (qLower.includes('420') || qLower.includes('cheating') || qLower.includes('318')) {
      tokens.push('BNS Sec. 318 (Cheating)');
    }
    if (qLower.includes('arbitration') || qLower.includes('34') || qLower.includes('award')) {
      tokens.push('Arbitration Act Sec. 34 (Setting Aside Award)');
    }
    if (qLower.includes('contract') || qLower.includes('indemnity') || qLower.includes('73')) {
      tokens.push('Indian Contract Act Sec. 73 (Damages)');
    }
    return tokens;
  }, [query]);

  // Handle DOCX Export
  const handleExportMemoDocx = async () => {
    if (!selectedMemo) return;
    setExporting(true);
    setError(null);
    try {
      const citationBlock =
        selectedMemo.citations.length > 0
          ? `\n\nVERIFIED AUTHORITIES & PRECEDENTS\n${selectedMemo.citations
              .map((c, i) => `${i + 1}. ${c.title} (${c.courtOrSource || 'Verified'}) — ${c.url}`)
              .join('\n')}`
          : '';
      const file = await api.exportCourtDocx({
        title: selectedMemo.query.slice(0, 90),
        courtHeader: activeMatter?.forum,
        matterCode: activeMatter?.matterCode,
        docType: 'IRAC Legal Research Memorandum',
        content: `${selectedMemo.answerMarkdown}${citationBlock}`,
      });
      onToast?.(`Exported research memorandum: ${file}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed.');
    } finally {
      setExporting(false);
    }
  };

  // Copy Markdown Response
  const handleCopyMemo = async () => {
    if (!selectedMemo) return;
    try {
      await navigator.clipboard.writeText(selectedMemo.answerMarkdown);
      setCopied(true);
      onToast?.('Research memorandum copied to clipboard.');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      onToast?.('Failed to copy text.');
    }
  };

  // Real-Time Streaming Search Execution
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter || !query.trim()) return;

    setError(null);
    setLoading(true);
    setStreamingText('');
    setLiveAuthorities([]);
    setCurrentStage({
      stage: 'init',
      label: 'Initializing real-time legal research query...',
    });

    const start = Date.now();
    setStreamStartTime(start);
    const timerInterval = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - start) / 1000));
    }, 500);

    try {
      const memo = await api.streamResearch(
        {
          matterId: activeMatter.id,
          query: query.trim(),
          jurisdiction,
          tier: modelTier,
        },
        {
          onStage: (st) => {
            setCurrentStage(st);
          },
          onAuthorities: (data) => {
            if (Array.isArray(data.authorities)) {
              setLiveAuthorities(data.authorities);
            }
          },
          onChunk: (delta) => {
            setStreamingText((prev) => prev + delta);
          },
        }
      );

      clearInterval(timerInterval);
      onMemoCreated(memo);
      setSelectedMemoId(memo.id);
      setStreamingText('');
      setQuery('');
      setCurrentStage(null);
      onToast?.('IRAC Legal Memorandum generated and verified.');
    } catch (err) {
      clearInterval(timerInterval);
      setError(err instanceof Error ? err.message : 'Real-time research query failed.');
    } finally {
      clearInterval(timerInterval);
      setLoading(false);
      setStreamStartTime(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Composer Card */}
      <section className="neu-card rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                Citation-Grounded Legal Research AI
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <Globe2 className="w-3 h-3 animate-pulse text-emerald-600" />
                Live Kanoon &amp; BNS Grounding
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Fetches real-time case records from Indian Kanoon and Supreme Court authorities, grounded with active matter context from{' '}
              <span className="font-medium text-ink">
                {activeMatter?.title ?? 'your active matter'}
              </span>
              .
            </p>
          </div>

          {/* Model Optimization Selector */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl border border-stone-hairline self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setModelTier('fast')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                modelTier === 'fast'
                  ? 'bg-white dark:bg-slate-900 text-teal-accent shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Nemotron 30B Lightning: ~500ms ultra-low latency response"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Real-Time Lightning</span>
            </button>
            <button
              type="button"
              onClick={() => setModelTier('expert')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                modelTier === 'expert'
                  ? 'bg-white dark:bg-slate-900 text-teal-accent shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Mistral Large: Deep IRAC reasoning across complex statutes"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-accent" />
              <span>Deep Precision</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-3.5">
          <label htmlFor="research-query" className="sr-only">
            Legal research question
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-3.5" strokeWidth={2} />
              <input
                id="research-query"
                type="text"
                required
                minLength={5}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a legal research question (e.g., 'Grounds for quashing u/s 528 BNSS in commercial JV dispute')..."
                className="neu-input w-full pl-11 pr-4 py-2.5 text-sm rounded-full"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !activeMatter}
              className="neu-btn-primary px-6 py-2.5 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching Real-Time Data ({elapsedSecs}s)...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Generate Real-Time Response</span>
                </>
              )}
            </button>
          </div>

          {/* Real-Time Live Statute Chips detected while typing */}
          {liveStatuteChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Live Statute Alignment:
              </span>
              {liveStatuteChips.map((chip) => (
                <span
                  key={chip}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-accent/10 text-teal-accent border border-teal-accent/25"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Sample Prompts */}
          <div className="flex flex-wrap gap-2 pt-1">
            {SAMPLE_PROMPTS[jurisdiction].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setQuery(sample)}
                className="neu-btn-secondary text-left text-xs px-3.5 py-1.5 rounded-xl hover:border-teal-accent transition"
              >
                {sample}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </section>

      {/* Real-Time Streaming Generation Live Indicator */}
      {loading && (
        <section className="neu-card rounded-2xl p-5 border border-teal-accent/40 bg-teal-accent/[0.03] space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-hairline">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-teal-accent/15 flex items-center justify-center text-teal-accent">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-ink">
                  {currentStage?.label || 'Processing legal query...'}
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Model: {modelTier === 'fast' ? 'nvidia/nemotron-3.5-lightning-30b-a3b' : 'mistralai/mistral-large-4-1t-a52b'} · Real-time SSE Stream
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-teal-accent">
              <Clock className="w-3.5 h-3.5" />
              <span>{elapsedSecs}s elapsed</span>
            </div>
          </div>

          {/* Live Authorities Preview while Streaming */}
          {liveAuthorities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-teal-accent" />
                Live Authorities &amp; Judgments Retrieved ({liveAuthorities.length}):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveAuthorities.map((a, i) => (
                  <a
                    key={`${a.url}-${i}`}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-stone-hairline bg-white dark:bg-slate-900 hover:border-teal-accent transition text-xs block group"
                  >
                    <div className="font-semibold text-teal-accent group-hover:underline flex items-center justify-between gap-1">
                      <span className="truncate">{a.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </div>
                    {a.court && <div className="text-[11px] text-ink-muted mt-0.5">{a.court}</div>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Live Streaming Delta Text Render */}
          {streamingText && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-stone-hairline text-xs font-mono text-ink whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {streamingText}
              <span className="inline-block w-2 h-4 ml-0.5 bg-teal-accent animate-pulse align-middle" />
            </div>
          )}
        </section>
      )}

      {/* Main Results Layout: Saved Memos List + Memo Reader + Citation Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Saved Memos Roster */}
        <aside className="lg:col-span-3 neu-card rounded-2xl p-4">
          <h3 className="font-display text-xs font-semibold text-ink-muted mb-3">
            Saved Research Memos ({memos.length})
          </h3>
          {memos.length === 0 ? (
            <div className="neu-empty rounded-xl p-4 text-xs text-ink-muted text-center">
              Run your first query above to generate a verified research memo.
            </div>
          ) : (
            <div className="space-y-2.5">
              {memos.map((memo) => {
                const isSelected = memo.id === selectedMemo?.id;
                return (
                  <button
                    key={memo.id}
                    type="button"
                    onClick={() => setSelectedMemoId(memo.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#0f5a5f] dark:bg-[#14777e] border-[#0f5a5f] text-[#faf8f4] shadow-sm'
                        : 'neu-inset border-stone-hairline text-ink hover:border-[#0f5a5f]'
                    }`}
                  >
                    <p className="text-xs font-medium line-clamp-2">{memo.query}</p>
                    <p
                      className={`mt-1.5 text-[11px] font-mono tabular-nums ${
                        isSelected ? 'text-[#d4ecee]' : 'text-ink-muted'
                      }`}
                    >
                      {memo.citations.length} source(s) · {memo.createdAt.slice(0, 10)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Center: IRAC Research Memorandum Reader */}
        <article className="lg:col-span-6 neu-card rounded-3xl p-6">
          {selectedMemo ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-teal-accent font-mono tabular-nums font-semibold">
                      IRAC Legal Memorandum
                    </p>
                    <span className="text-ink-muted text-xs">·</span>
                    <span className="text-xs text-ink-muted font-mono">
                      {new Date(selectedMemo.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink leading-snug">
                    {selectedMemo.query}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap"
                    title="Copy markdown content"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-ink-muted" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportMemoDocx}
                    className="neu-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <FileDown className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                    <span>{exporting ? 'Exporting...' : 'Export .DOCX'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Citation Parser Strip */}
              {parsedMemoCitations && parsedMemoCitations.citations.length > 0 && (
                <div className="mt-4 px-3.5 py-2.5 rounded-2xl bg-[#efe9dc]/80 dark:bg-[#151d1f] border border-stone-hairline flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-ink-secondary">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#0c4d52] dark:text-[#6fd3da]">
                      <Scale className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      <span className="font-mono tabular-nums font-semibold">
                        {parsedMemoCitations.uniqueCases.length}
                      </span>
                      <span>
                        {parsedMemoCitations.uniqueCases.length === 1 ? 'Case' : 'Cases'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#8a5210] dark:text-[#eab354]">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      <span className="font-mono tabular-nums font-semibold">
                        {parsedMemoCitations.uniqueStatutes.length}
                      </span>
                      <span>
                        {parsedMemoCitations.uniqueStatutes.length === 1 ? 'Statute' : 'Statutes'}
                      </span>
                    </span>
                    <span className="text-[11px] text-ink-muted hidden sm:inline">
                      Hover or click highlighted authorities for live ratios &amp; links
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHighlightCitations((prev) => !prev)}
                    aria-pressed={highlightCitations}
                    className="text-[11px] font-semibold text-teal-accent hover:underline whitespace-nowrap shrink-0"
                  >
                    {highlightCitations ? 'Hide Highlights' : 'Show Highlights'}
                  </button>
                </div>
              )}

              {/* Memo Body with Interactive Citation Linking */}
              <div className="mt-5 pt-5 border-t border-stone-hairline">
                <CitationTextRenderer
                  markdown={selectedMemo.answerMarkdown}
                  groundedCitations={selectedMemo.citations}
                  highlightCitations={highlightCitations}
                  onCopyCitation={(label) => onToast?.(`Copied citation: ${label}`)}
                />
              </div>
            </div>
          ) : (
            <div className="neu-empty rounded-2xl py-12 px-6 text-center text-sm text-ink-muted">
              Select a research memo or submit a legal query above to inspect real-time verified authorities.
            </div>
          )}
        </article>

        {/* Right: Citation Integrity & Live Sources Panel */}
        <aside className="lg:col-span-3 neu-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
            <h3 className="font-display text-sm font-semibold text-ink">
              Citation Integrity &amp; Real-Time Sources
            </h3>
          </div>

          {selectedMemo ? (
            <>
              <div className="text-xs space-y-2.5 border-y border-stone-hairline py-3.5">
                <div className="flex justify-between gap-2">
                  <span className="text-ink-muted">Verification Mode</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                    {selectedMemo.citationIntegrity.confidenceLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-muted">Grounded Sources</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">
                    {selectedMemo.citations.length}
                  </span>
                </div>
                {parsedMemoCitations && (
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Parsed Inline Refs</span>
                    <span className="font-mono tabular-nums font-semibold text-teal-accent">
                      {parsedMemoCitations.uniqueCases.length} cases · {parsedMemoCitations.uniqueStatutes.length} laws
                    </span>
                  </div>
                )}
                <p className="text-ink-secondary pt-1 leading-relaxed text-[11px]">
                  {selectedMemo.citationIntegrity.bnsComplianceNote}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-ink-muted mb-2.5">
                  Verified Authorities &amp; Links ({selectedMemo.citations.length})
                </h4>
                {selectedMemo.citations.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No external web links attached; verify cited precedents against official reporters before filing.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {selectedMemo.citations.map((cit, idx) => (
                      <li
                        key={`${cit.url}-${idx}`}
                        className="text-xs border-b border-stone-hairline pb-2.5 last:border-b-0"
                      >
                        <a
                          href={cit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-teal-accent hover:underline inline-flex items-start gap-1"
                        >
                          <span>{cit.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                        </a>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {cit.courtOrSource || 'Verified Source'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted">
              Select or generate a research memo to inspect live citations and statutory integrity.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
