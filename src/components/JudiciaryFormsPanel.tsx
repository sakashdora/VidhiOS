import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  FileSignature,
  FileText,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  JUDICIARY_FORM_TEMPLATES,
  getJudiciaryTemplate,
  type JudiciaryFormCategory,
} from '../lib/legal/judiciaryTemplates';
import type { DraftDocument, JurisdictionMode, Matter } from '../types/legal';

interface JudiciaryFormsPanelProps {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  preselectedTemplateId?: string | null;
  prefilledFacts?: string | null;
  onDraftGenerated: (draft: DraftDocument) => void;
  onOpenInEditor: (draft: DraftDocument) => void;
  onToast: (msg: string) => void;
}

const CATEGORY_TABS: Array<{ id: 'all' | JudiciaryFormCategory; label: string }> = [
  { id: 'all', label: 'All Forms (13)' },
  { id: 'affidavit', label: 'Affidavits & Sec. 63 BSA' },
  { id: 'supreme_court', label: 'Supreme Court' },
  { id: 'high_court', label: 'High Court' },
  { id: 'criminal_bnss', label: 'Criminal (BNSS)' },
  { id: 'civil_commercial', label: 'Civil & Arbitration' },
];

export function JudiciaryFormsPanel({
  activeMatter,
  jurisdiction,
  preselectedTemplateId,
  prefilledFacts,
  onDraftGenerated,
  onOpenInEditor,
  onToast,
}: JudiciaryFormsPanelProps) {
  const [category, setCategory] = useState<'all' | JudiciaryFormCategory>('all');
  const [templateId, setTemplateId] = useState<string>(
    preselectedTemplateId || 'general_affidavit'
  );

  const activeTemplate = useMemo(() => getJudiciaryTemplate(templateId), [templateId]);

  const [courtName, setCourtName] = useState(
    activeMatter?.forum || activeTemplate.defaultCourt
  );
  const [caseNumber, setCaseNumber] = useState(activeTemplate.defaultCaseType);
  const [petitionerName, setPetitionerName] = useState(activeMatter?.clientName || '');
  const [respondentName, setRespondentName] = useState(activeMatter?.opposingParty || '');
  const [deponentName, setDeponentName] = useState(activeMatter?.clientName || '');
  const [deponentDetails, setDeponentDetails] = useState(
    'aged about 38 years, Authorized Signatory / Applicant, residing at Mumbai / New Delhi'
  );
  const [factsSummary, setFactsSummary] = useState(
    prefilledFacts || activeMatter?.summaryFacts || ''
  );
  const [reliefSought, setReliefSought] = useState(activeTemplate.suggestedRelief);
  const [placeOfFiling, setPlaceOfFiling] = useState('Mumbai');
  const [filingDate, setFilingDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [streaming, setStreaming] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState<DraftDocument | null>(null);
  const [metaInfo, setMetaInfo] = useState<{ engineUsed: string; latencyMs: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedTemplateId) {
      setTemplateId(preselectedTemplateId);
      const tpl = getJudiciaryTemplate(preselectedTemplateId);
      setCaseNumber(tpl.defaultCaseType);
      setReliefSought(tpl.suggestedRelief);
    }
  }, [preselectedTemplateId]);

  useEffect(() => {
    if (prefilledFacts) {
      setFactsSummary(prefilledFacts);
    }
  }, [prefilledFacts]);

  useEffect(() => {
    if (activeMatter) {
      setCourtName(activeMatter.forum || activeTemplate.defaultCourt);
      setPetitionerName(activeMatter.clientName || '');
      setRespondentName(activeMatter.opposingParty || '');
      setDeponentName(activeMatter.clientName || '');
      if (!prefilledFacts) {
        setFactsSummary(activeMatter.summaryFacts || '');
      }
    }
  }, [activeMatter?.id]);

  const filteredTemplates = useMemo(() => {
    if (category === 'all') return JUDICIARY_FORM_TEMPLATES;
    return JUDICIARY_FORM_TEMPLATES.filter((t) => t.category === category);
  }, [category]);

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = getJudiciaryTemplate(id);
    setCaseNumber(tpl.defaultCaseType);
    setReliefSought(tpl.suggestedRelief);
    if (!activeMatter?.forum) {
      setCourtName(tpl.defaultCourt);
    }
  };

  const handleGenerateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) {
      setError('Select or create an active Matter first.');
      return;
    }
    setError(null);
    setStreaming(true);
    setStreamedText('');
    setGeneratedDraft(null);
    setMetaInfo(null);

    try {
      const result = await api.streamJudiciaryForm(
        {
          matterId: activeMatter.id,
          templateId,
          courtName: courtName.trim() || activeTemplate.defaultCourt,
          caseNumber: caseNumber.trim() || activeTemplate.defaultCaseType,
          petitionerName: petitionerName.trim() || activeMatter.clientName,
          respondentName: respondentName.trim() || activeMatter.opposingParty || 'State / Respondent',
          deponentName: deponentName.trim() || petitionerName.trim() || activeMatter.clientName,
          deponentDetails: deponentDetails.trim(),
          factsSummary: factsSummary.trim(),
          reliefSought: reliefSought.trim() || activeTemplate.suggestedRelief,
          placeOfFiling: placeOfFiling.trim() || 'New Delhi',
          filingDate,
          jurisdiction,
        },
        (chunk) => {
          setStreamedText((prev) => prev + chunk);
        }
      );

      setStreamedText(result.draft.content);
      setGeneratedDraft(result.draft);
      setMetaInfo({ engineUsed: result.engineUsed, latencyMs: result.latencyMs });
      onDraftGenerated(result.draft);
      onToast(`Generated "${activeTemplate.name}" and saved to Matter Drafts.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Judiciary form generation failed.');
    } finally {
      setStreaming(false);
    }
  };

  const handleExportDocx = async () => {
    const content = streamedText.trim();
    if (!content) return;
    setExportingDocx(true);
    try {
      const file = await api.exportCourtDocx({
        title: `${activeTemplate.name} — ${petitionerName || activeMatter?.clientName || 'Filing'}`,
        courtHeader: courtName,
        matterCode: activeMatter?.matterCode,
        docType: activeTemplate.name,
        content,
      });
      onToast(`Downloaded court-formatted Word file: ${file}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed.');
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Filter Strip */}
      <div className="neu-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              Affidavits &amp; Indian Judiciary Forms Studio
            </h2>
            <p className="text-xs text-ink-muted">
              Supreme Court Rules 2013 &amp; High Court Registry templates grounded in live matter context, streaming directly to court-ready Microsoft Word (.docx).
            </p>
          </div>
          <span className="font-mono text-[11px] text-teal-accent font-semibold">
            1.5&Prime; Binding Margin · Times New Roman 12pt
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                category === tab.id
                  ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
                  : 'neu-btn-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Template Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 max-h-64 overflow-y-auto pr-1">
          {filteredTemplates.map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`text-left p-3.5 rounded-2xl border transition-all ${
                  active
                    ? 'bg-[#0f5a5f] dark:bg-[#14777e] border-[#0f5a5f] text-[#faf8f4] shadow-sm'
                    : 'neu-inset border-stone-hairline text-ink hover:border-[#0f5a5f]'
                }`}
              >
                <p className="text-xs font-semibold leading-snug">{tpl.name}</p>
                <p
                  className={`mt-1 text-[11px] leading-snug line-clamp-2 ${
                    active ? 'text-[#d4ecee]' : 'text-ink-muted'
                  }`}
                >
                  {tpl.statuteBasis}
                </p>
              </button>
            );
          })}
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

      {/* Split Workspace: User Case Data Form (5 cols) + Live Streamed Document Preview (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleGenerateForm}
          className="lg:col-span-5 neu-card rounded-3xl p-6 space-y-4"
        >
          <div className="pb-3 border-b border-stone-hairline">
            <span className="text-[11px] font-mono font-semibold text-teal-accent">
              SELECTED JUDICIARY FORM
            </span>
            <h3 className="font-display text-sm font-semibold text-ink mt-0.5">
              {activeTemplate.name}
            </h3>
            <p className="text-xs text-ink-muted mt-1">{activeTemplate.description}</p>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="jf-court" className="block text-xs font-medium text-ink-secondary mb-1">
                Court / Tribunal Heading
              </label>
              <input
                id="jf-court"
                required
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="jf-case-no" className="block text-xs font-medium text-ink-secondary mb-1">
                Case / Application Number
              </label>
              <input
                id="jf-case-no"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="jf-pet" className="block text-xs font-medium text-ink-secondary mb-1">
                  Petitioner / Applicant
                </label>
                <input
                  id="jf-pet"
                  required
                  value={petitionerName}
                  onChange={(e) => setPetitionerName(e.target.value)}
                  className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="jf-resp" className="block text-xs font-medium text-ink-secondary mb-1">
                  Respondent / Opposite Party
                </label>
                <input
                  id="jf-resp"
                  required
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="jf-deponent" className="block text-xs font-medium text-ink-secondary mb-1">
                Deponent / Executant Name
              </label>
              <input
                id="jf-deponent"
                value={deponentName}
                onChange={(e) => setDeponentName(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="jf-place" className="block text-xs font-medium text-ink-secondary mb-1">
                  Place of Filing
                </label>
                <input
                  id="jf-place"
                  value={placeOfFiling}
                  onChange={(e) => setPlaceOfFiling(e.target.value)}
                  className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="jf-date" className="block text-xs font-medium text-ink-secondary mb-1">
                  Filing Date
                </label>
                <input
                  id="jf-date"
                  type="date"
                  required
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="neu-input w-full px-3.5 py-2 text-xs font-mono rounded-xl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="jf-dep-desc" className="block text-xs font-medium text-ink-secondary mb-1">
                Deponent Particulars (Age / Designation / Residence)
              </label>
              <input
                id="jf-dep-desc"
                value={deponentDetails}
                onChange={(e) => setDeponentDetails(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="jf-facts" className="block text-xs font-medium text-ink-secondary mb-1">
                Case Facts, Chronology &amp; Specific Averments
              </label>
              <textarea
                id="jf-facts"
                required
                rows={4}
                value={factsSummary}
                onChange={(e) => setFactsSummary(e.target.value)}
                placeholder="Enter material facts, FIR/Order dates, annexure references, and sworn statements..."
                className="neu-input w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl resize-y"
              />
            </div>

            <div>
              <label htmlFor="jf-relief" className="block text-xs font-medium text-ink-secondary mb-1">
                Prayer / Specific Relief Sought
              </label>
              <textarea
                id="jf-relief"
                rows={2}
                value={reliefSought}
                onChange={(e) => setReliefSought(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-xs leading-relaxed rounded-xl resize-y"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={streaming || !activeMatter}
            className="neu-btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 text-xs font-semibold rounded-full disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            <span>
              {streaming
                ? 'Streaming Supreme Court / HC Form...'
                : 'Generate Court-Ready Form & Affidavit'}
            </span>
          </button>
        </form>

        {/* Live Output & DOCX Export Pane */}
        <section className="lg:col-span-7 neu-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-hairline">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
              <h3 className="font-display text-sm font-semibold text-ink">
                Live Court Filing Preview
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {generatedDraft && (
                <button
                  type="button"
                  onClick={() => onOpenInEditor(generatedDraft)}
                  className="neu-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Open in BNS Editor</span>
                </button>
              )}
              <button
                type="button"
                disabled={!streamedText.trim() || streaming || exportingDocx}
                onClick={handleExportDocx}
                className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap"
              >
                <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{exportingDocx ? 'Building .DOCX...' : 'Download Court .DOCX'}</span>
              </button>
            </div>
          </div>

          {metaInfo && (
            <div className="p-3 rounded-xl border border-[#156a53]/30 bg-[#156a53]/8 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#115442] dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span>{metaInfo.engineUsed}</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#156a53] dark:text-emerald-300">
                {metaInfo.latencyMs}ms · Saved to Matter Drafts
              </span>
            </div>
          )}

          {streamedText ? (
            <textarea
              aria-label="Generated judiciary form preview"
              value={streamedText}
              onChange={(e) => setStreamedText(e.target.value)}
              rows={22}
              className="neu-input w-full p-4 font-sans text-xs sm:text-sm leading-7 rounded-2xl resize-y"
            />
          ) : (
            <div className="neu-empty rounded-2xl py-16 px-6 text-center space-y-2">
              <p className="font-display text-sm font-semibold text-ink">
                Ready to draft {activeTemplate.name}
              </p>
              <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
                Verify the pre-filled Matter parties and facts on the left, then click{' '}
                <strong className="text-ink">Generate Court-Ready Form &amp; Affidavit</strong> to stream a Supreme Court / High Court formatted pleading ready for instant <strong className="text-ink">.DOCX</strong> export.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
