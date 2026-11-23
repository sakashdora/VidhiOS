import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  Copy,
  FileDown,
  FileText,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { stripMarkdownForPlainText } from '../lib/legal/responseFormatter';
import { CitationTextRenderer } from './CitationTextRenderer';
import type {
  CaseAnalysisReport,
  JurisdictionMode,
  Matter,
  ResearchMemo,
} from '../types/legal';

interface CaseAnalysisPanelProps {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  onMemoSaved?: (memo: ResearchMemo) => void;
  onLaunchJudiciaryForm: (templateId: string, facts: string) => void;
  onToast: (msg: string) => void;
}

const COURT_LEVELS = [
  'Supreme Court of India (Art. 136 SLP / Art. 32 Writ)',
  'High Court of Judicature (Art. 226 / Sec. 482 & 528 BNSS / Commercial Division)',
  'Sessions & District Court (Bail / Trial / Civil Suit)',
  'NCLT / NCLAT (IBC & Company Law)',
  'International Arbitration Tribunal (SIAC / ICC / Domestic Sec. 9 & 11)',
];

export function CaseAnalysisPanel({
  activeMatter,
  jurisdiction,
  onMemoSaved,
  onLaunchJudiciaryForm,
  onToast,
}: CaseAnalysisPanelProps) {
  const [caseTitle, setCaseTitle] = useState(activeMatter?.title || '');
  const [courtLevel, setCourtLevel] = useState(COURT_LEVELS[1]);
  const [parties, setParties] = useState(
    activeMatter
      ? `${activeMatter.clientName} v. ${activeMatter.opposingParty || 'State / Respondent'}`
      : ''
  );
  const [caseStage, setCaseStage] = useState('Pre-Filing / Interim Relief & Maintainability');
  const [userFactsAndData, setUserFactsAndData] = useState(activeMatter?.summaryFacts || '');
  const [keyLegalQuestions, setKeyLegalQuestions] = useState(
    'Evaluate maintainability, BNS/BNSS/BSA statutory compliance, binding Supreme Court precedents, vulnerabilities, and immediate pleadings/affidavits to file.'
  );
  const [saveToResearch, setSaveToResearch] = useState(true);

  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [report, setReport] = useState<CaseAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopyOpinion = async () => {
    if (!report?.detailedMarkdown) return;
    try {
      await navigator.clipboard.writeText(stripMarkdownForPlainText(report.detailedMarkdown));
    } catch {
      // Ignore clipboard restriction in headless mode
    }
    setCopiedMemo(true);
    onToast('Copied clean legal opinion memorandum to clipboard.');
    window.setTimeout(() => setCopiedMemo(false), 1800);
  };

  useEffect(() => {
    if (activeMatter) {
      setCaseTitle(activeMatter.title);
      setParties(
        `${activeMatter.clientName} v. ${activeMatter.opposingParty || 'State / Respondent'}`
      );
      setUserFactsAndData(activeMatter.summaryFacts);
    }
  }, [activeMatter?.id]);

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) {
      setError('Select an active Matter first.');
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const res = await api.runCaseAnalysis({
        matterId: activeMatter.id,
        caseTitle: caseTitle.trim(),
        courtLevel,
        jurisdiction,
        parties: parties.trim(),
        caseStage: caseStage.trim(),
        userFactsAndData: userFactsAndData.trim(),
        keyLegalQuestions: keyLegalQuestions.trim(),
        saveToResearch,
      });
      setReport(res.report);
      if (res.savedMemo && onMemoSaved) {
        onMemoSaved(res.savedMemo);
      }
      onToast(
        `Supreme Court / HC Case Analysis completed in ${res.report.latencyMs}ms.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Case analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportReportDocx = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const content = [
        `COURT CASE ANALYSIS & STRATEGIC OPINION`,
        `CASE: ${report.title}`,
        `FORUM: ${report.courtLevel}`,
        `MAINTAINABILITY POSTURE: ${report.maintainabilityScore}`,
        '',
        'EXECUTIVE ASSESSMENT',
        report.executiveAssessment,
        '',
        'JURISDICTION & LIMITATION AUDIT',
        report.jurisdictionAndLimitation,
        '',
        'APPLICABLE STATUTES',
        ...report.applicableStatutes.map((s, i) => `${i + 1}. ${s}`),
        '',
        'BINDING SUPREME COURT & HIGH COURT CASE STUDIES',
        ...report.landmarkCaseStudies.map(
          (cs, i) =>
            `${i + 1}. ${cs.caseName}, ${cs.citation} (${cs.court}) — ${cs.relevance} Application: ${cs.applicationToFacts}`
        ),
        '',
        'VULNERABILITIES & COUNTER-STRATEGIES',
        ...report.vulnerabilitiesAndCounters.map(
          (v, i) => `${i + 1}. Risk: ${v.risk} | Counter: ${v.counterStrategy}`
        ),
        '',
        'DETAILED LEGAL OPINION MEMORANDUM',
        report.detailedMarkdown,
      ].join('\n');

      const file = await api.exportCourtDocx({
        title: `Case Analysis — ${report.title}`,
        courtHeader: report.courtLevel,
        matterCode: activeMatter?.matterCode,
        docType: 'Supreme Court / High Court Case Analysis Opinion',
        content,
      });
      onToast(`Exported Case Analysis Word file: ${file}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <form onSubmit={handleRunAnalysis} className="neu-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-hairline">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              Supreme Court &amp; High Court Case Analysis Studio
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Combines your real-time case dossier, Vault exhibits, docket deadlines, and verified SC/HC landmark case studies into a structured filing roadmap.
            </p>
          </div>
          <span className="font-mono text-[11px] font-semibold text-teal-accent">
            Real-Time Context · BNS/BNSS/BSA Verified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="ca-title" className="block text-xs font-medium text-ink-secondary mb-1">
              Case Title / Dossier Name
            </label>
            <input
              id="ca-title"
              required
              minLength={3}
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            />
          </div>
          <div>
            <label htmlFor="ca-court" className="block text-xs font-medium text-ink-secondary mb-1">
              Target Court Standard
            </label>
            <select
              id="ca-court"
              value={courtLevel}
              onChange={(e) => setCourtLevel(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            >
              {COURT_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ca-parties" className="block text-xs font-medium text-ink-secondary mb-1">
              Parties (Petitioner v. Respondent)
            </label>
            <input
              id="ca-parties"
              required
              value={parties}
              onChange={(e) => setParties(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            />
          </div>
          <div>
            <label htmlFor="ca-stage" className="block text-xs font-medium text-ink-secondary mb-1">
              Current Procedural Stage
            </label>
            <input
              id="ca-stage"
              required
              value={caseStage}
              onChange={(e) => setCaseStage(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ca-facts" className="block text-xs font-medium text-ink-secondary mb-1">
            User&apos;s Case Data (FIR Excerpts, Impugned Order, Dates, Evidence, Contract Terms)
          </label>
          <textarea
            id="ca-facts"
            required
            minLength={20}
            rows={5}
            value={userFactsAndData}
            onChange={(e) => setUserFactsAndData(e.target.value)}
            placeholder="Paste complete factual chronology, FIR sections, trial/HC order excerpts, and client instructions..."
            className="neu-input w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl resize-y"
          />
        </div>

        <div>
          <label htmlFor="ca-questions" className="block text-xs font-medium text-ink-secondary mb-1">
            Specific Legal Questions &amp; Strategic Goals
          </label>
          <input
            id="ca-questions"
            value={keyLegalQuestions}
            onChange={(e) => setKeyLegalQuestions(e.target.value)}
            className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={saveToResearch}
              onChange={(e) => setSaveToResearch(e.target.checked)}
              className="accent-[#0f5a5f] w-4 h-4 rounded"
            />
            <span>Save opinion memorandum to Legal Research Memos</span>
          </label>

          <button
            type="submit"
            disabled={analyzing || !activeMatter}
            className="neu-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-full disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            <span>
              {analyzing
                ? 'Running Supreme Court / HC Analysis...'
                : 'Analyze Case with Real SC/HC Precedents'}
            </span>
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
        >
          {error}
        </div>
      )}

      {/* Analysis Output */}
      {report && (
        <div className="space-y-6">
          {/* Executive Posture Banner */}
          <section className="neu-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-hairline">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold ${
                      report.maintainabilityScore === 'Strong'
                        ? 'bg-[#156a53]/12 text-[#115442] dark:text-emerald-300'
                        : report.maintainabilityScore === 'Moderate'
                          ? 'bg-[#a6671a]/12 text-[#855110] dark:text-amber-300'
                          : 'bg-[#b23a32]/12 text-[#9c2f28] dark:text-[#f29b94]'
                    }`}
                  >
                    Maintainability: {report.maintainabilityScore}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                    {report.latencyMs}ms · {report.engineUsed}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {report.title}
                </h3>
              </div>

              <button
                type="button"
                disabled={exporting}
                onClick={handleExportReportDocx}
                className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{exporting ? 'Exporting...' : 'Export Case Analysis .DOCX'}</span>
              </button>
            </div>

            <CitationTextRenderer
              markdown={report.executiveAssessment}
              onCopyCitation={(label) => onToast(`Copied citation: ${label}`)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="neu-inset p-4 rounded-2xl space-y-1.5">
                <p className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                  <span>Jurisdiction &amp; Limitation Audit</span>
                </p>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {report.jurisdictionAndLimitation}
                </p>
              </div>
              <div className="neu-inset p-4 rounded-2xl space-y-2">
                <p className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                  <span>Applicable Statutes &amp; BNS/BNSS/BSA Mapping</span>
                </p>
                <ul className="space-y-1">
                  {report.applicableStatutes.map((stat, idx) => (
                    <li key={idx} className="text-xs font-mono text-ink-secondary">
                      • {stat}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Verified SC / HC Case Studies + Vulnerabilities */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 neu-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-stone-hairline">
                <BookOpenCheck className="w-4 h-4 text-teal-accent" strokeWidth={2} />
                <h3 className="font-display text-sm font-semibold text-ink">
                  Verified Supreme Court &amp; High Court Case Studies ({report.landmarkCaseStudies.length})
                </h3>
              </div>

              <div className="space-y-3.5">
                {report.landmarkCaseStudies.map((cs, idx) => (
                  <article key={idx} className="neu-inset p-4 rounded-2xl space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-display text-xs font-semibold text-ink">
                        {cs.caseName}
                      </h4>
                      <span className="font-mono text-[11px] font-semibold text-teal-accent">
                        {cs.citation}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-ink-muted">{cs.court}</p>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      <span className="font-semibold text-ink">Ratio:</span> {cs.relevance}
                    </p>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      <span className="font-semibold text-teal-accent">Application to Your Facts:</span>{' '}
                      {cs.applicationToFacts}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <aside className="lg:col-span-5 space-y-6">
              {/* Vulnerabilities */}
              <section className="neu-card rounded-3xl p-6 space-y-3.5">
                <div className="flex items-center gap-2 pb-2.5 border-b border-stone-hairline">
                  <AlertTriangle className="w-4 h-4 text-[#a6671a]" strokeWidth={2} />
                  <h3 className="font-display text-sm font-semibold text-ink">
                    Risks &amp; Courtroom Counters
                  </h3>
                </div>
                <div className="space-y-3">
                  {report.vulnerabilitiesAndCounters.map((v, idx) => (
                    <div key={idx} className="neu-inset p-3.5 rounded-2xl space-y-1.5">
                      <p className="text-xs font-semibold text-[#9c2f28] dark:text-[#f29b94]">
                        Risk: {v.risk}
                      </p>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        <span className="font-semibold text-[#156a53] dark:text-emerald-300">
                          Counter:
                        </span>{' '}
                        {v.counterStrategy}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* One-Click Recommended Judiciary Forms */}
              <section className="neu-card rounded-3xl p-6 space-y-3.5">
                <h3 className="font-display text-sm font-semibold text-ink pb-2.5 border-b border-stone-hairline">
                  Recommended Affidavits &amp; Judiciary Filings
                </h3>
                <div className="space-y-2.5">
                  {report.recommendedFilings.map((rec, idx) => (
                    <div
                      key={idx}
                      className="neu-inset p-3.5 rounded-2xl flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-ink">{rec.title}</p>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          {rec.rationale}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onLaunchJudiciaryForm(rec.formId, userFactsAndData)}
                        className="neu-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-full whitespace-nowrap shrink-0"
                      >
                        <span>Draft</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          {/* Full Formatted Legal Opinion Memorandum */}
          {report.detailedMarkdown && (
            <section className="neu-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-hairline">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">
                      Full Legal Opinion Memorandum
                    </h3>
                    <p className="text-[11px] text-ink-muted">
                      Hover or click any highlighted statute or Supreme Court / High Court citation for instant summary &amp; official links.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyOpinion}
                  className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap"
                >
                  {copiedMemo ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#156a53] dark:text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Clean Opinion</span>
                    </>
                  )}
                </button>
              </div>

              <CitationTextRenderer
                markdown={report.detailedMarkdown}
                onCopyCitation={(label) => onToast(`Copied citation: ${label}`)}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
