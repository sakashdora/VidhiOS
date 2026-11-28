import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Languages,
  Save,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { StatusBadge } from './ui/DesignSystem';
import type { Matter, VaultDocument } from '../types/legal';

interface VaultModuleProps {
  activeMatter: Matter | null;
  documents: VaultDocument[];
  onDocumentAdded: (doc: VaultDocument) => void;
  onDocumentUpdated?: (doc: VaultDocument) => void;
  onToast: (msg: string) => void;
}

const LANGUAGES = [
  'None',
  'Hindi',
  'Odia',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'English',
];

export function VaultModule({
  activeMatter,
  documents,
  onDocumentAdded,
  onDocumentUpdated,
  onToast,
}: VaultModuleProps) {
  const [selectedId, setSelectedId] = useState<string>(documents[0]?.id ?? '');
  const activeDoc = documents.find((d) => d.id === selectedId) ?? documents[0] ?? null;

  const [activeTab, setActiveTab] = useState<
    'chronology' | 'matter_timeline' | 'entities' | 'contradictions' | 'ocr' | 'translation'
  >('chronology');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('text/plain');
  const [docCategory, setDocCategory] = useState('FIR / Police Record');
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [textInput, setTextInput] = useState('');
  const [base64Data, setBase64Data] = useState<string | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingOcr, setEditingOcr] = useState(false);
  const [ocrDraftText, setOcrDraftText] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        d.extractedText.toLowerCase().includes(q) ||
        d.docCategory.toLowerCase().includes(q)
    );
  }, [documents, searchQuery]);

  const unifiedTimeline = useMemo(() => {
    return documents
      .flatMap((doc) =>
        doc.chronology.map((ev) => ({
          ...ev,
          docId: doc.id,
          docFileName: doc.fileName,
        }))
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setError('File exceeds 12 MB upload cap.');
      return;
    }
    setError(null);
    setFileName(file.name);
    setMimeType(file.type || 'application/pdf');

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIdx = result.indexOf(',');
      if (file.type === 'text/plain') {
        setTextInput(result);
        setBase64Data(undefined);
      } else if (commaIdx !== -1) {
        setBase64Data(result.slice(commaIdx + 1));
      }
    };
    if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatter) return;
    if (!base64Data && !textInput.trim()) {
      setError('Upload a scanned PDF/image or paste document text to process.');
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const created = await api.processVaultDocument({
        matterId: activeMatter.id,
        fileName: fileName.trim() || `Annexure_${Date.now()}.txt`,
        mimeType,
        docCategory,
        base64Data,
        textInput: textInput.trim() || undefined,
        targetLanguage,
      });
      onDocumentAdded(created);
      setSelectedId(created.id);
      setFileName('');
      setTextInput('');
      setBase64Data(undefined);
      onToast(`Processed "${created.fileName}" — extracted ${created.chronology.length} events.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveOcrCorrection = async () => {
    if (!activeDoc) return;
    setSavingCorrection(true);
    try {
      const updated = await api.updateVaultDocument(activeDoc.id, {
        extractedText: ocrDraftText,
        processingStatus: 'completed',
      });
      onDocumentUpdated?.(updated);
      setEditingOcr(false);
      onToast('Saved human correction to Vault document.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save correction.');
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ingestion & Processing Panel */}
      <form onSubmit={handleProcess} className="neu-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Legal Document Intelligence &amp; Vault
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload exhibits for OCR, entity extraction, unified matter chronology, contradiction checks, and legal translation. Original files are preserved separately from extracted outputs.
            </p>
          </div>
          <StatusBadge tone="teal">Max 12 MB · PDF, PNG, JPG, TXT</StatusBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div>
            <label htmlFor="vault-file" className="block text-xs font-medium text-ink-secondary mb-1">
              Upload PDF / Image / Text
            </label>
            <label
              htmlFor="vault-file"
              className="neu-empty flex items-center gap-2 px-3.5 py-2 text-xs rounded-xl text-ink cursor-pointer hover:border-[#0f5a5f] truncate"
            >
              <Upload className="w-3.5 h-3.5 shrink-0 text-teal-accent" strokeWidth={2} />
              <span className="truncate">{fileName || 'Choose PDF, PNG, JPG, TXT'}</span>
            </label>
            <input
              id="vault-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          <div>
            <label htmlFor="vault-cat" className="block text-xs font-medium text-ink-secondary mb-1">
              Document Category
            </label>
            <select
              id="vault-cat"
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            >
              <option>FIR / Police Record</option>
              <option>Court Order / Judgment</option>
              <option>Contract / Annexure</option>
              <option>Legal Notice / Reply</option>
              <option>Affidavit / Deposition</option>
            </select>
          </div>

          <div>
            <label htmlFor="vault-lang" className="block text-xs font-medium text-ink-secondary mb-1">
              Bilingual Legal Translation
            </label>
            <select
              id="vault-lang"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'None' ? 'OCR & Chronology Only' : `Translate to ${lang}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={processing || !activeMatter}
              className="neu-btn-primary w-full py-2.5 px-4 text-xs font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap"
            >
              {processing ? 'Processing Document...' : 'Process & Index Document'}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="vault-paste" className="block text-xs font-medium text-ink-secondary mb-1">
            Or Paste Scanned / Extracted Text Directly
          </label>
          <textarea
            id="vault-paste"
            rows={2}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste order text, notice content, or vernacular excerpt..."
            className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </form>

      {/* Vault Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 neu-card rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
            <input
              aria-label="Search within vault documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search uploaded documents..."
              className="neu-input w-full pl-8 pr-3 py-1.5 text-xs rounded-lg"
            />
          </div>
          <h3 className="font-display text-xs font-semibold text-ink-muted">
            Indexed Vault Files ({filteredDocuments.length})
          </h3>
          {filteredDocuments.length === 0 ? (
            <div className="neu-empty rounded-xl p-4 text-xs text-ink-muted text-center">
              No matching documents in this matter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const selected = doc.id === activeDoc?.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(doc.id);
                      setEditingOcr(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selected
                        ? 'bg-[#0d5c63] border-[#0d5c63] text-white shadow-sm'
                        : 'neu-inset text-ink hover:border-[#0d5c63]'
                    }`}
                  >
                    <p className="text-xs font-semibold truncate">{doc.fileName}</p>
                    <p
                      className={`text-[11px] mt-1 font-mono tabular-nums ${
                        selected ? 'text-teal-100' : 'text-ink-muted'
                      }`}
                    >
                      {doc.chronology.length} dates · {doc.contradictions.length} conflict(s)
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="lg:col-span-9 neu-card rounded-2xl p-6 space-y-4">
          {activeDoc ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-hairline">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-teal-accent font-mono">
                      {activeDoc.docCategory} · {activeDoc.mimeType}
                    </p>
                    <StatusBadge
                      tone={
                        activeDoc.processingStatus === 'failed'
                          ? 'danger'
                          : activeDoc.processingStatus === 'review_required'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {activeDoc.processingStatus || 'completed'}
                    </StatusBadge>
                  </div>
                  <h3 className="font-display text-base font-semibold text-ink mt-0.5">
                    {activeDoc.fileName}
                  </h3>
                </div>
                <div className="neu-tab-bar rounded-xl px-1.5 py-1 flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['chronology', `Doc Dates (${activeDoc.chronology.length})`],
                      ['matter_timeline', `Unified Timeline (${unifiedTimeline.length})`],
                      ['entities', 'Entities & Summary'],
                      ['contradictions', `Contradictions (${activeDoc.contradictions.length})`],
                      ['ocr', 'OCR Text'],
                      ['translation', `Translation${activeDoc.targetLanguage ? ` (${activeDoc.targetLanguage})` : ''}`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                        activeTab === key
                          ? 'border-[#0d5c63] dark:border-[#57c5cc] text-teal-accent'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'chronology' && (
                <div className="overflow-x-auto">
                  {activeDoc.chronology.length === 0 ? (
                    <p className="text-xs text-ink-muted py-6">No chronological dates extracted.</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="neu-table-head text-ink-secondary">
                          <th className="py-2.5 pl-3 pr-4 font-semibold whitespace-nowrap rounded-l-lg">Date</th>
                          <th className="py-2.5 pr-4 font-semibold">Event / Filing</th>
                          <th className="py-2.5 pr-4 font-semibold">Source &amp; Ref</th>
                          <th className="py-2.5 pr-3 font-semibold rounded-r-lg">Legal Significance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)]">
                        {activeDoc.chronology.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[var(--surface-inset)] transition-colors">
                            <td className="py-3 pl-3 pr-4 font-mono tabular-nums font-semibold text-teal-accent whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="py-3 pr-4 text-ink">{row.event}</td>
                            <td className="py-3 pr-4 font-mono text-[11px] text-ink-muted">
                              {row.sourceDoc} {row.pageOrPara ? `(${row.pageOrPara})` : ''}
                            </td>
                            <td className="py-3 pr-3 text-ink-secondary">{row.significance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'matter_timeline' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-ink-muted">
                    Unified chronological timeline across all {documents.length} uploaded document(s) in {activeMatter?.matterCode}:
                  </p>
                  {unifiedTimeline.length === 0 ? (
                    <p className="text-xs text-ink-muted py-6">No timeline events extracted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {unifiedTimeline.map((ev, idx) => (
                        <div key={idx} className="neu-inset rounded-xl p-3 flex flex-wrap items-start justify-between gap-3 text-xs">
                          <div className="flex items-start gap-3">
                            <span className="font-mono font-semibold text-teal-accent whitespace-nowrap">
                              {ev.date}
                            </span>
                            <div>
                              <p className="font-medium text-ink">{ev.event}</p>
                              <p className="text-ink-muted mt-0.5">{ev.significance}</p>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-ink-muted">
                            {ev.docFileName} {ev.pageOrPara ? `· ${ev.pageOrPara}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'entities' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="neu-inset p-4 rounded-xl space-y-2 sm:col-span-2">
                    <p className="font-semibold text-ink inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-accent" />
                      <span>Document Summary &amp; Language</span>
                    </p>
                    <p className="text-ink-secondary leading-relaxed">
                      {activeDoc.entities?.summary || activeDoc.extractedText.slice(0, 320)}
                    </p>
                    <p className="font-mono text-[11px] text-teal-accent">
                      Detected Language: {activeDoc.entities?.detectedLanguage || 'English'}
                    </p>
                  </div>
                  <div className="neu-inset p-4 rounded-xl space-y-1.5">
                    <p className="font-semibold text-ink">Dates Extracted</p>
                    <p className="text-ink-secondary">
                      {activeDoc.entities?.dates?.length ? activeDoc.entities.dates.join(', ') : 'None detected'}
                    </p>
                  </div>
                  <div className="neu-inset p-4 rounded-xl space-y-1.5">
                    <p className="font-semibold text-ink">Monetary Amounts</p>
                    <p className="text-ink-secondary">
                      {activeDoc.entities?.amounts?.length ? activeDoc.entities.amounts.join(', ') : 'None detected'}
                    </p>
                  </div>
                  <div className="neu-inset p-4 rounded-xl space-y-1.5 sm:col-span-2">
                    <p className="font-semibold text-ink">Statutes &amp; Sections Identified</p>
                    <p className="text-ink-secondary font-mono">
                      {activeDoc.entities?.statutes?.length ? activeDoc.entities.statutes.join(' · ') : 'None detected'}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'contradictions' && (
                <div className="space-y-3">
                  {activeDoc.contradictions.length === 0 ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 py-4 font-medium">
                      No factual or monetary contradictions detected against existing matter annexures.
                    </p>
                  ) : (
                    activeDoc.contradictions.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-red-800 dark:text-red-300">{c.topic}</h4>
                          <span className="font-mono uppercase text-[11px] font-semibold text-red-700 dark:text-red-300">
                            {c.severity} severity
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <p className="text-ink">
                            <strong>Statement A:</strong> {c.statementA}
                          </p>
                          <p className="text-ink">
                            <strong>Statement B:</strong> {c.statementB}
                          </p>
                        </div>
                        <p className="text-ink-secondary pt-1">
                          <strong className="text-ink">Litigation Strategy:</strong> {c.recommendation}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'ocr' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      Original file preserved; review or correct extracted text below:
                    </span>
                    {!editingOcr ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOcrDraftText(activeDoc.extractedText);
                          setEditingOcr(true);
                        }}
                        className="neu-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg"
                      >
                        Edit Extracted Text
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingOcr(false)}
                          className="neu-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingCorrection}
                          onClick={handleSaveOcrCorrection}
                          className="neu-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingCorrection ? 'Saving...' : 'Save Correction'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {editingOcr ? (
                    <textarea
                      rows={12}
                      value={ocrDraftText}
                      onChange={(e) => setOcrDraftText(e.target.value)}
                      className="neu-input w-full p-4 text-xs leading-relaxed rounded-xl"
                    />
                  ) : (
                    <div className="neu-inset p-4 rounded-xl text-sm leading-relaxed text-ink whitespace-pre-wrap">
                      {activeDoc.extractedText || 'No extracted text available.'}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'translation' && (
                <div className="neu-inset p-4 rounded-xl text-sm leading-relaxed text-ink whitespace-pre-wrap">
                  {activeDoc.translatedText ||
                    'No translation generated for this file. Re-upload with a target language selected or use Translation Studio.'}
                </div>
              )}
            </>
          ) : (
            <div className="neu-empty rounded-xl py-12 px-6 text-center text-sm text-ink-muted">
              Upload or paste your first document above to inspect OCR text, chronology, entities, contradictions, and translations.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
