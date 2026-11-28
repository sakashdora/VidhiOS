import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileDown,
  History,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  applyCitationReplacements,
  lookupStatuteMappings,
  scanDraftForLegacyCitations,
} from '../lib/legal/statuteCrosswalk';
import { JudiciaryFormsPanel } from './JudiciaryFormsPanel';
import { CaseAnalysisPanel } from './CaseAnalysisPanel';
import type { DraftDocument, JurisdictionMode, Matter, ResearchMemo } from '../types/legal';

interface DraftingModuleProps {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  drafts: DraftDocument[];
  onDraftCreated: (draft: DraftDocument) => void;
  onDraftUpdated: (draft: DraftDocument) => void;
  onMemoCreated?: (memo: ResearchMemo) => void;
  onToast: (msg: string) => void;
}

export function DraftingModule({
  activeMatter,
  jurisdiction,
  drafts,
  onDraftCreated,
  onDraftUpdated,
  onMemoCreated,
  onToast,
}: DraftingModuleProps) {
  const [studioMode, setStudioMode] = useState<'editor' | 'forms' | 'analysis'>('editor');
  const [preselectedFormId, setPreselectedFormId] = useState<string | null>(null);
  const [prefilledFormFacts, setPrefilledFormFacts] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>(drafts[0]?.id ?? '');
  const currentDraft = drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null;

  const [editorTitle, setEditorTitle] = useState<string>(currentDraft?.title ?? '');
  const [editorContent, setEditorContent] = useState<string>(currentDraft?.content ?? '');
  const [inspectorTab, setInspectorTab] = useState<'validator' | 'crosswalk'>('validator');
  const [crosswalkQuery, setCrosswalkQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [compareVersionNum, setCompareVersionNum] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);

  const [showGenForm, setShowGenForm] = useState(false);
  const [genTitle, setGenTitle] = useState('');
  const [genDocType, setGenDocType] = useState('Anticipatory Bail Application (Sec. 482 BNSS)');
  const [genInstructions, setGenInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectDraft = (d: DraftDocument) => {
    setSelectedId(d.id);
    setEditorTitle(d.title);
    setEditorContent(d.content);
    setError(null);
  };

  React.useEffect(() => {
    const match = drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null;
    if (match && match.id !== selectedId) {
      setSelectedId(match.id);
      setEditorTitle(match.title);
      setEditorContent(match.content);
    } else if (!match) {
      setSelectedId('');
      setEditorTitle('');
      setEditorContent('');
    }
  }, [drafts, selectedId]);

  const legacyMatches = useMemo(
    () => scanDraftForLegacyCitations(editorContent),
    [editorContent]
  );

  const crosswalkResults = useMemo(
    () => lookupStatuteMappings(crosswalkQuery),
    [crosswalkQuery]
  );

  const handleSave = async (overrideContent?: string) => {
    if (!currentDraft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDraft(currentDraft.id, {
        title: editorTitle,
        content: overrideContent ?? editorContent,
      });
      onDraftUpdated(updated);
      onToast(`Saved "${updated.title}" (v${updated.version})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceSingle = async (matchId: string) => {
    const updatedText = applyCitationReplacements(editorContent, legacyMatches, [matchId]);
    setEditorContent(updatedText);
    if (currentDraft) {
      await handleSave(updatedText);
    }
  };

  const handleReplaceAll = async () => {
    if (legacyMatches.length === 0) return;
    const count = legacyMatches.length;
    const updatedText = applyCitationReplacements(editorContent, legacyMatches);
    setEditorContent(updatedText);
    if (currentDraft) {
      await handleSave(updatedText);
    }
    onToast(`Replaced ${count} legacy IPC/CrPC/IEA citation(s) with BNS/BNSS/BSA equivalents.`);
  };

  const handleInlineRewrite = async (instructionOverride?: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selectedText = editorContent.slice(start, end).trim();
    const instruction = (instructionOverride ?? rewritePrompt).trim();

    if (!selectedText) {
      setError('Highlight a paragraph or clause inside the editor first to run surgical AI rewriting.');
      return;
    }
    if (!instruction) {
      setError('Enter an editing instruction (or click a quick action).');
      return;
    }

    setError(null);
    setRewriting(true);
    try {
      const { rewritten } = await api.rewriteSelection({
        selection: selectedText,
        instruction,
        jurisdiction,
      });
      const next = editorContent.slice(0, start) + rewritten + editorContent.slice(end);
      setEditorContent(next);
      setRewritePrompt('');
      onToast('Selected paragraph updated in editor.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rewrite failed.');
    } finally {
      setRewriting(false);
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    setError(null);
    setGenerating(true);
    try {
      const created = await api.generateDraft({
        matterId: activeMatter.id,
        title: genTitle,
        docType: genDocType,
        instructions: genInstructions,
        jurisdiction,
      });
      onDraftCreated(created);
      selectDraft(created);
      setShowGenForm(false);
      setGenTitle('');
      setGenInstructions('');
      onToast(`Generated "${created.title}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!editorContent) return;
    const blob = new Blob([`# ${editorTitle}\n\n${editorContent}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(editorTitle || 'legal-draft').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported draft as Markdown (.md).');
  };

  const handlePrintPdf = () => {
    if (!editorContent) return;
    const printWin = window.open('', '_blank', 'width=880,height=720');
    if (!printWin) {
      onToast('Allow popups to export/print PDF.');
      return;
    }
    const safeTitle = (editorTitle || 'Legal Draft').replace(/</g, '&lt;');
    const safeBody = editorContent.replace(/</g, '&lt;').replace(/\n/g, '<br/>');
    printWin.document.write(`<!doctype html><html><head><title>${safeTitle}</title><style>body{font-family:'Times New Roman',serif;margin:1in 1.2in;line-height:1.6;font-size:12pt;color:#111}h1{font-size:14pt;text-align:center;text-transform:uppercase;margin-bottom:24px}</style></head><body><h1>${safeTitle}</h1><div>${safeBody}</div><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWin.document.close();
  };

  const handleStatusChange = async (status: DraftDocument['status']) => {
    if (!currentDraft) return;
    try {
      const updated = await api.updateDraft(currentDraft.id, { status });
      onDraftUpdated(updated);
      onToast(`Draft status updated to ${status?.replace('_', ' ')}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleExportDocx = async () => {
    if (!editorContent) return;
    setExportingDocx(true);
    setError(null);
    try {
      const filename = await api.exportCourtDocx({
        title: editorTitle || 'Legal Draft',
        courtHeader: activeMatter?.forum,
        matterCode: activeMatter?.matterCode,
        docType: currentDraft?.docType || 'Court Pleading',
        content: editorContent,
      });
      onToast(`Exported court-formatted Word file: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed.');
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Studio Mode Switcher: Editor & BNS Audit | Affidavits & Judiciary Forms | Court Case Analysis */}
      <div className="neu-tab-bar rounded-2xl p-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setStudioMode('editor')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all text-center ${
            studioMode === 'editor'
              ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
              : 'text-ink-secondary hover:text-ink'
          }`}
        >
          Editor &amp; BNS Audit ({drafts.length})
        </button>
        <button
          type="button"
          onClick={() => setStudioMode('forms')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all text-center ${
            studioMode === 'forms'
              ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
              : 'text-ink-secondary hover:text-ink'
          }`}
        >
          Affidavits &amp; Judiciary Forms
        </button>
        <button
          type="button"
          onClick={() => setStudioMode('analysis')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all text-center ${
            studioMode === 'analysis'
              ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
              : 'text-ink-secondary hover:text-ink'
          }`}
        >
          Court Case Analysis (SC / HC)
        </button>
      </div>

      {studioMode === 'forms' ? (
        <JudiciaryFormsPanel
          activeMatter={activeMatter}
          jurisdiction={jurisdiction}
          preselectedTemplateId={preselectedFormId}
          prefilledFacts={prefilledFormFacts}
          onDraftGenerated={(draft) => {
            onDraftCreated(draft);
          }}
          onOpenInEditor={(draft) => {
            selectDraft(draft);
            setStudioMode('editor');
          }}
          onToast={onToast}
        />
      ) : studioMode === 'analysis' ? (
        <CaseAnalysisPanel
          activeMatter={activeMatter}
          jurisdiction={jurisdiction}
          onMemoSaved={onMemoCreated}
          onLaunchJudiciaryForm={(formId, facts) => {
            setPreselectedFormId(formId);
            setPrefilledFormFacts(facts);
            setStudioMode('forms');
          }}
          onToast={onToast}
        />
      ) : (
        <>
          {/* Top Toolbar */}
          <div className="neu-card rounded-2xl px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 min-w-0 w-full sm:w-auto">
          <label htmlFor="draft-selector" className="text-xs font-medium text-ink-muted whitespace-nowrap">
            Active Draft
          </label>
          <select
            id="draft-selector"
            value={currentDraft?.id ?? ''}
            onChange={(e) => {
              const found = drafts.find((d) => d.id === e.target.value);
              if (found) selectDraft(found);
            }}
            className="neu-input px-3.5 py-2 text-xs font-medium rounded-full w-full sm:max-w-xs truncate"
          >
            {drafts.length === 0 && <option value="">No drafts in this matter</option>}
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} (v{d.version})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowGenForm((v) => !v)}
            className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>New AI Draft</span>
          </button>
          <button
            type="button"
            disabled={!currentDraft || saving}
            onClick={() => handleSave()}
            className="neu-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            disabled={!editorContent || exportingDocx}
            onClick={handleExportDocx}
            className="neu-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
            <span>{exportingDocx ? 'Building...' : 'Export .DOCX'}</span>
          </button>
          <button
            type="button"
            disabled={!editorContent}
            onClick={handleExportMarkdown}
            className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2} />
            <span>.MD</span>
          </button>
          <button
            type="button"
            disabled={!editorContent}
            onClick={handlePrintPdf}
            className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={2} />
            <span>PDF</span>
          </button>
          {currentDraft && (
            <button
              type="button"
              onClick={() => setShowVersionModal(true)}
              className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
            >
              <History className="w-3.5 h-3.5" strokeWidth={2} />
              <span>History ({currentDraft.versions?.length ?? 1})</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible New Draft Generator */}
      {showGenForm && (
        <form onSubmit={handleGenerateDraft} className="neu-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Generate Court-Ready / Transactional Draft with Matter Context
            </h3>
            <button
              type="button"
              onClick={() => setShowGenForm(false)}
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="gen-title" className="block text-xs font-medium text-ink-secondary mb-1">
                Draft Title
              </label>
              <input
                id="gen-title"
                required
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                placeholder="Section 528 BNSS Quashing Petition"
                className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="gen-type" className="block text-xs font-medium text-ink-secondary mb-1">
                Document Type
              </label>
              <select
                id="gen-type"
                value={genDocType}
                onChange={(e) => setGenDocType(e.target.value)}
                className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
              >
                <option>Anticipatory Bail Application (Sec. 482 BNSS)</option>
                <option>Sworn Affidavit-in-Support (Order XIX CPC)</option>
                <option>Counter Affidavit / Affidavit-in-Reply</option>
                <option>Section 63 BSA Electronic Evidence Certificate</option>
                <option>Special Leave Petition (SLP — Article 136)</option>
                <option>Writ Petition (Article 226 / Article 32)</option>
                <option>High Court Quashing Petition (Sec. 528 BNSS)</option>
                <option>Commercial Plaint / Statement of Claim</option>
                <option>Legal Demand Notice (Sec. 138 NI Act / Commercial)</option>
                <option>Master Services Agreement (MSA)</option>
                <option>Shareholders Agreement (SHA)</option>
                <option>SIAC Notice of Arbitration</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="gen-instr" className="block text-xs font-medium text-ink-secondary mb-1">
              Specific Reliefs, Clauses, and Arguments
            </label>
            <textarea
              id="gen-instr"
              required
              rows={3}
              value={genInstructions}
              onChange={(e) => setGenInstructions(e.target.value)}
              placeholder="Specify prayers, key precedents to weave in, commercial caps, or interim relief sought..."
              className="neu-input w-full px-3.5 py-2 text-sm rounded-xl"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={generating || !activeMatter}
              className="neu-btn-primary px-5 py-2 text-xs font-semibold rounded-full disabled:opacity-50"
            >
              {generating ? 'Drafting Document...' : 'Generate Draft'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
        >
          {error}
        </div>
      )}

      {/* Main Split: Legal Editor (7 cols) + Statute Validator & Crosswalk Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 neu-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-hairline">
            <input
              aria-label="Draft title"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              placeholder="Untitled Legal Draft"
              className="font-display text-base font-semibold text-ink bg-transparent focus:outline-none w-full"
            />
            {currentDraft && (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Draft review status"
                  value={currentDraft.status || 'draft'}
                  onChange={(e) => handleStatusChange(e.target.value as DraftDocument['status'])}
                  className="neu-input px-2.5 py-1 text-[11px] font-medium rounded-lg"
                >
                  <option value="draft">Draft</option>
                  <option value="awaiting_review">Awaiting Review</option>
                  <option value="approved">Approved</option>
                </select>
                <span className="font-mono text-xs tabular-nums text-ink-muted whitespace-nowrap">
                  v{currentDraft.version} · {editorContent.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            aria-label="Legal document editor"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            rows={20}
            placeholder="Select a draft or generate a new legal document..."
            className="neu-input w-full p-4 font-sans text-sm leading-7 rounded-2xl resize-y"
          />

          {/* Selection Rewrite Bar */}
          <div className="pt-3 border-t border-stone-hairline space-y-2.5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-ink-secondary inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-accent shrink-0" strokeWidth={2} />
                <span>Inline Paragraph AI Rewrite (highlight text in editor)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  'Strengthen Authority',
                  'Make Concise',
                  'Formal Court Tone',
                  'Simplify Language',
                  'Identify Missing Facts',
                  'Identify Procedural Issues',
                  'Translate to Hindi',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={rewriting}
                    onClick={() => handleInlineRewrite(preset)}
                    className="neu-btn-secondary px-3 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Custom rewrite instruction"
                value={rewritePrompt}
                onChange={(e) => setRewritePrompt(e.target.value)}
                placeholder="e.g., Add BNS 318(4) distinction per Delhi Race Club (2024)..."
                className="neu-input flex-1 px-3.5 py-2 text-xs rounded-full"
              />
              <button
                type="button"
                disabled={rewriting}
                onClick={() => handleInlineRewrite()}
                className="neu-btn-primary px-4 py-2 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {rewriting ? 'Rewriting...' : 'Apply Rewrite'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Inspector: BNS/BNSS/BSA Validator & Crosswalk */}
        <aside className="lg:col-span-5 neu-card rounded-3xl p-6 space-y-4">
          {/* Reference-Style Tab Strip with Teal Active Underline */}
          <div className="neu-tab-bar rounded-xl px-2 py-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setInspectorTab('validator')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                inspectorTab === 'validator'
                  ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Draft BNS Validator ({legacyMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('crosswalk')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                inspectorTab === 'crosswalk'
                  ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              IPC / CrPC / IEA Crosswalk
            </button>
          </div>

          {inspectorTab === 'validator' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-hairline">
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">
                    Repealed Citation Audit
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Deterministic live scan for legacy IPC, CrPC &amp; Indian Evidence Act citations.
                  </p>
                </div>
                {legacyMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReplaceAll}
                    className="neu-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Replace All ({legacyMatches.length})</span>
                  </button>
                )}
              </div>

              {legacyMatches.length === 0 ? (
                <div className="p-4 rounded-2xl border border-[#156a53]/30 bg-[#156a53]/8 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#156a53] dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
                  <div className="text-xs">
                    <p className="font-semibold text-[#115442] dark:text-emerald-200">
                      No repealed IPC / CrPC / IEA citations detected
                    </p>
                    <p className="text-[#156a53] dark:text-emerald-400 mt-0.5">
                      This draft is compliant with BNS 2023, BNSS 2023, and BSA 2023 statutory numbering.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {legacyMatches.map((m) => (
                    <div key={m.id} className="neu-inset p-4 rounded-2xl space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9c2f28] dark:text-[#f29b94]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                          <span className="font-mono">{m.matchedText}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReplaceSingle(m.id)}
                          className="text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap shrink-0"
                        >
                          Replace Inline
                        </button>
                      </div>
                      <p className="text-xs font-mono font-medium text-[#156a53] dark:text-emerald-300">
                        → {m.replacementText}
                      </p>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        <span className="font-semibold text-ink">{m.mapping.title}:</span>{' '}
                        {m.mapping.keyChangeNote}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-2.5" strokeWidth={2} />
                <input
                  aria-label="Search IPC CrPC IEA to BNS BNSS BSA crosswalk"
                  value={crosswalkQuery}
                  onChange={(e) => setCrosswalkQuery(e.target.value)}
                  placeholder="Search section or offence (e.g., 420, 438, 65B, bail, cheating)..."
                  className="neu-input w-full pl-10 pr-3.5 py-2 text-xs rounded-full"
                />
              </div>

              <div className="divide-y divide-[#ddd5c5] dark:divide-[#263336] max-h-[520px] overflow-y-auto pr-1">
                {crosswalkResults.map((row) => (
                  <div key={`${row.legacyCode}-${row.legacySection}`} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-semibold text-ink inline-flex items-center gap-1.5">
                        <span>
                          {row.legacyCode} {row.legacySection}
                        </span>
                        <ArrowRightLeft className="w-3 h-3 text-teal-accent" />
                        <span className="text-teal-accent">
                          {row.newCode} {row.newSection}
                        </span>
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        {row.changeImpact === 'substantive_change'
                          ? 'Substantive Change'
                          : row.changeImpact === 'expanded_scope'
                            ? 'Expanded Scope'
                            : 'Renumbered'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-ink">{row.title}</p>
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      {row.keyChangeNote}
                    </p>
                  </div>
                ))}
                {crosswalkResults.length === 0 && (
                  <p className="py-6 text-xs text-ink-muted text-center">
                    No matching statute found for &ldquo;{crosswalkQuery}&rdquo;.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
        </>
      )}

      {showVersionModal && currentDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Draft Version History"
          className="fixed inset-0 z-50 bg-[#101617]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-4xl neu-modal rounded-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-hairline">
              <h3 className="font-display text-base font-semibold text-ink">
                Version History &amp; Comparison — {currentDraft.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="neu-btn-secondary p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
              <div className="md:col-span-4 space-y-2 overflow-y-auto pr-1">
                {(currentDraft.versions ?? []).map((ver) => (
                  <button
                    key={ver.version}
                    type="button"
                    onClick={() => setCompareVersionNum(ver.version)}
                    className={`w-full text-left p-3 rounded-lg border text-xs ${
                      compareVersionNum === ver.version
                        ? 'bg-[#0d5c63] border-[#0d5c63] text-white'
                        : 'neu-inset text-ink'
                    }`}
                  >
                    <p className="font-mono font-semibold">Version {ver.version}</p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {ver.savedBy || 'Counsel'} · {ver.savedAt.slice(0, 16).replace('T', ' ')}
                    </p>
                  </button>
                ))}
                {(currentDraft.versions ?? []).length === 0 && (
                  <p className="text-xs text-ink-muted">Current version v{currentDraft.version} only.</p>
                )}
              </div>
              <div className="md:col-span-8 neu-inset rounded-xl p-4 overflow-y-auto text-xs whitespace-pre-wrap leading-relaxed text-ink">
                {(() => {
                  const snap = (currentDraft.versions ?? []).find(
                    (v) => v.version === compareVersionNum
                  );
                  return snap ? snap.content : editorContent;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
