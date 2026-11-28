import React, { useState } from 'react';
import { FileDown, Languages, Mic, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, InfoBanner, PageHeader, StatusBadge } from './ui/DesignSystem';
import type { JurisdictionMode, Matter, MeetingBrief } from '../types/legal';

const TRANSLATION_LANGUAGES = [
  'English',
  'Hindi',
  'Odia',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Kannada',
  'Malayalam',
];

export function TranslationStudioModule({
  activeMatter,
  jurisdiction,
  onToast,
}: {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  onToast: (msg: string) => void;
}) {
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [sourceText, setSourceText] = useState('');
  const [segments, setSegments] = useState<Array<{ original: string; translated: string }>>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [warning, setWarning] = useState('');
  const [translating, setTranslating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim()) return;
    setError(null);
    setTranslating(true);
    try {
      const res = await api.translateLegalText({
        sourceText: sourceText.trim(),
        sourceLanguage,
        targetLanguage,
        jurisdiction,
      });
      setSegments(res.segments);
      setNotes(res.terminologyNotes);
      setWarning(res.qualityWarning);
      onToast(`Translated into ${targetLanguage}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSegmentEdit = (idx: number, val: string) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, translated: val } : s)));
  };

  const handleExportDocx = async () => {
    if (segments.length === 0) return;
    setExporting(true);
    try {
      const combined = segments.map((s) => s.translated).join('\n\n');
      const file = await api.exportCourtDocx({
        title: `Translation (${targetLanguage}) — ${activeMatter?.matterCode || 'Legal Document'}`,
        courtHeader: activeMatter?.forum,
        matterCode: activeMatter?.matterCode,
        docType: `Certified Legal Translation (${targetLanguage})`,
        content: combined,
      });
      onToast(`Exported translated DOCX: ${file}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Translation Studio"
        subtitle="Bilingual side-by-side legal translation across 10 Indian languages with terminology preservation, human editing, and .DOCX export."
        badge="10 Indian Languages"
      />

      <form onSubmit={handleTranslate} className="neu-card rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="tr-src-lang" className="block text-xs font-medium text-ink-secondary mb-1">
              Source Language
            </label>
            <select
              id="tr-src-lang"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="neu-input w-full px-3 py-2 text-xs rounded-lg"
            >
              {TRANSLATION_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tr-tgt-lang" className="block text-xs font-medium text-ink-secondary mb-1">
              Target Language
            </label>
            <select
              id="tr-tgt-lang"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="neu-input w-full px-3 py-2 text-xs rounded-lg"
            >
              {TRANSLATION_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={translating || !sourceText.trim()}
              className="neu-btn-primary w-full py-2 px-4 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {translating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              <span>{translating ? 'Translating...' : 'Translate Legal Text'}</span>
            </button>
          </div>
        </div>
        <textarea
          required
          rows={5}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste pleading paragraphs, FIR excerpts, witness statements, or contract clauses to translate..."
          className="neu-input w-full p-3.5 text-xs leading-relaxed rounded-xl"
        />
      </form>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {warning && <InfoBanner tone="warning">{warning}</InfoBanner>}

      {segments.length > 0 && (
        <section className="neu-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-hairline pb-3">
            <h3 className="font-display text-sm font-semibold text-ink">
              Bilingual Side-by-Side Comparison &amp; Human Correction
            </h3>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportDocx}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export .DOCX'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {segments.map((seg, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="neu-inset p-3.5 rounded-lg whitespace-pre-wrap text-ink-secondary leading-relaxed">
                  <span className="font-mono text-[10px] text-ink-muted block mb-1">
                    {sourceLanguage} · Paragraph {idx + 1}
                  </span>
                  {seg.original}
                </div>
                <div>
                  <span className="font-mono text-[10px] text-teal-accent block mb-1">
                    {targetLanguage} (Editable)
                  </span>
                  <textarea
                    rows={4}
                    value={seg.translated}
                    onChange={(e) => handleSegmentEdit(idx, e.target.value)}
                    className="neu-input w-full p-3 rounded-lg text-xs leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>

          {notes.length > 0 && (
            <div className="neu-inset p-3.5 rounded-lg text-xs">
              <p className="font-semibold text-ink mb-1">Legal Terminology Notes</p>
              <ul className="list-disc pl-4 text-ink-secondary space-y-0.5">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function MeetingAssistantModule({
  activeMatter,
  briefs,
  onRefreshWorkspace,
  onToast,
}: {
  activeMatter: Matter | null;
  briefs: MeetingBrief[];
  onRefreshWorkspace: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [base64Audio, setBase64Audio] = useState<string | undefined>(undefined);
  const [mimeType, setMimeType] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedId, setSelectedId] = useState(briefs[0]?.id ?? '');
  const [pinningIdx, setPinningIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeBrief = briefs.find((b) => b.id === selectedId) ?? briefs[0] ?? null;

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 14 * 1024 * 1024) {
      setError('Audio file exceeds 14 MB cap.');
      return;
    }
    setFileName(file.name);
    setMimeType(file.type || 'audio/mpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? '');
      const idx = res.indexOf(',');
      if (idx !== -1) setBase64Audio(res.slice(idx + 1));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    if (!base64Audio && !transcriptText.trim()) {
      setError('Upload consultation audio or paste transcript text.');
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const created = await api.createMeetingBrief({
        matterId: activeMatter.id,
        title: title.trim() || 'Client Conference Note',
        durationLabel: '08:00',
        base64Audio,
        mimeType,
        transcriptText: transcriptText.trim() || undefined,
      });
      setTitle('');
      setTranscriptText('');
      setBase64Audio(undefined);
      setFileName('');
      setSelectedId(created.id);
      await onRefreshWorkspace();
      onToast('Consultation brief & action items generated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Meeting brief generation failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPinAction = async (actionItem: string, idx: number) => {
    if (!activeMatter) return;
    setPinningIdx(idx);
    try {
      await api.createTask({
        matterId: activeMatter.id,
        title: actionItem,
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      });
      await onRefreshWorkspace();
      onToast('Confirmed and saved action item as Matter task.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save action item.');
    } finally {
      setPinningIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice & Meeting Assistant"
        subtitle="Transcribe client conferences, extract key facts, statutory issues, and action items with explicit advocate confirmation before saving to matter tasks."
      />

      <form onSubmit={handleSubmit} className="neu-card rounded-xl p-5 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Conference Title (e.g., Pre-bail briefing with Director)"
            className="neu-input px-3.5 py-2 text-xs rounded-lg"
          />
          <label className="neu-empty flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg cursor-pointer">
            <Mic className="w-3.5 h-3.5 text-teal-accent shrink-0" />
            <span className="truncate">{fileName || 'Upload Audio (MP3, WAV, M4A, WEBM)'}</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="sr-only"
            />
          </label>
        </div>
        <textarea
          rows={3}
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder="Or paste raw consultation notes / transcript here..."
          className="neu-input w-full p-3 text-xs rounded-lg"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!activeMatter || processing}
            className="neu-btn-primary px-5 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {processing ? 'Transcribing & Extracting...' : 'Generate Structured Case Note'}
          </button>
        </div>
      </form>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 neu-card rounded-xl p-4 space-y-2">
          <h3 className="font-display text-xs font-semibold text-ink-muted">
            Consultation Briefs ({briefs.length})
          </h3>
          {briefs.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">No meeting briefs saved yet.</p>
          ) : (
            briefs.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`w-full text-left p-3 rounded-lg border text-xs ${
                  b.id === activeBrief?.id
                    ? 'bg-[#0d5c63] border-[#0d5c63] text-white'
                    : 'neu-inset text-ink'
                }`}
              >
                <p className="font-semibold truncate">{b.title}</p>
                <p className="font-mono text-[10px] opacity-80 mt-0.5">{b.createdAt.slice(0, 10)}</p>
              </button>
            ))
          )}
        </aside>

        <section className="lg:col-span-8 neu-card rounded-xl p-5 space-y-4">
          {activeBrief ? (
            <>
              <div className="flex items-center justify-between border-b border-stone-hairline pb-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">{activeBrief.title}</h3>
                  <p className="text-[11px] font-mono text-ink-muted">{activeBrief.createdAt.slice(0, 10)}</p>
                </div>
                <StatusBadge tone="teal">{activeBrief.actionItems.length} action items</StatusBadge>
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">{activeBrief.summary}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink">
                  Extracted Action Items (Confirm before saving to official Matter Tasks):
                </p>
                {activeBrief.actionItems.map((act, idx) => (
                  <div key={idx} className="neu-inset p-3 rounded-lg flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink">{act}</span>
                    <button
                      type="button"
                      disabled={pinningIdx === idx}
                      onClick={() => handleConfirmPinAction(act, idx)}
                      className="neu-btn-secondary px-3 py-1 text-[11px] font-semibold rounded-lg shrink-0"
                    >
                      {pinningIdx === idx ? 'Saving...' : 'Confirm & Save Task'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted py-8 text-center">
              Select or create a consultation brief to inspect structured notes and action items.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
