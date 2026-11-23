import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Languages,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Matter, VaultDocument } from '../types/legal';

interface VaultModuleProps {
  activeMatter: Matter | null;
  documents: VaultDocument[];
  onDocumentAdded: (doc: VaultDocument) => void;
  onToast: (msg: string) => void;
}

const LANGUAGES = [
  'None',
  'Hindi',
  'Marathi',
  'Tamil',
  'Telugu',
  'Gujarati',
  'Bengali',
  'Kannada',
  'Malayalam',
  'English',
  'French',
  'German',
];

export function VaultModule({
  activeMatter,
  documents,
  onDocumentAdded,
  onToast,
}: VaultModuleProps) {
  const [selectedId, setSelectedId] = useState<string>(documents[0]?.id ?? '');
  const activeDoc = documents.find((d) => d.id === selectedId) ?? documents[0] ?? null;

  const [activeTab, setActiveTab] = useState<'chronology' | 'ocr' | 'translation' | 'contradictions'>('chronology');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('text/plain');
  const [docCategory, setDocCategory] = useState('FIR / Police Record');
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [textInput, setTextInput] = useState('');
  const [base64Data, setBase64Data] = useState<string | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onToast(`Processed "${created.fileName}" — extracted ${created.chronology.length} chronology events.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ingestion & Processing Panel */}
      <form onSubmit={handleProcess} className="neu-card rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Document Vault — OCR, Auto-Chronology &amp; Bilingual Translation
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Upload scanned court orders, FIRs, or annexures to run OCR, assemble a List of Dates, flag cross-document contradictions, and translate legally.
          </p>
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
              className="neu-btn-primary w-full py-2.5 px-4 text-xs font-semibold rounded-full disabled:opacity-50 whitespace-nowrap"
            >
              {processing ? 'Running Multimodal AI...' : 'Process & Index Document'}
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
            placeholder="Paste order text, notice content, or vernacular excerpt for instant chronology, contradiction check, and translation..."
            className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-[#9c2f28] dark:text-[#f29b94]">
            {error}
          </p>
        )}
      </form>

      {/* Vault Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 neu-card rounded-2xl p-4 space-y-2.5">
          <h3 className="font-display text-xs font-semibold text-ink-muted">
            Indexed Vault Files ({documents.length})
          </h3>
          {documents.length === 0 ? (
            <div className="neu-empty rounded-xl p-4 text-xs text-ink-muted text-center">
              No documents uploaded for this matter.
            </div>
          ) : (
            documents.map((doc) => {
              const selected = doc.id === activeDoc?.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'bg-[#0f5a5f] dark:bg-[#14777e] border-[#0f5a5f] text-[#faf8f4] shadow-sm'
                      : 'neu-inset border-stone-hairline text-ink hover:border-[#0f5a5f]'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{doc.fileName}</p>
                  <p
                    className={`text-[11px] mt-1 font-mono tabular-nums ${
                      selected ? 'text-[#d4ecee]' : 'text-ink-muted'
                    }`}
                  >
                    {doc.chronology.length} dates · {doc.contradictions.length} conflict(s)
                  </p>
                </button>
              );
            })
          )}
        </aside>

        <section className="lg:col-span-9 neu-card rounded-3xl p-6 space-y-4">
          {activeDoc ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-hairline">
                <div>
                  <p className="text-xs text-teal-accent font-mono">
                    {activeDoc.docCategory} · {activeDoc.mimeType}
                  </p>
                  <h3 className="font-display text-base font-semibold text-ink mt-0.5">
                    {activeDoc.fileName}
                  </h3>
                </div>
                <div className="neu-tab-bar rounded-xl px-1.5 py-1 flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['chronology', `List of Dates (${activeDoc.chronology.length})`, Calendar],
                      ['contradictions', `Contradictions (${activeDoc.contradictions.length})`, AlertTriangle],
                      ['ocr', 'OCR Text', FileText],
                      ['translation', `Translation${activeDoc.targetLanguage ? ` (${activeDoc.targetLanguage})` : ''}`, Languages],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                        activeTab === key
                          ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
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
                          <th className="py-3 pl-3 pr-4 font-semibold whitespace-nowrap rounded-l-xl">Date</th>
                          <th className="py-3 pr-4 font-semibold">Event / Filing</th>
                          <th className="py-3 pr-4 font-semibold">Source Document</th>
                          <th className="py-3 pr-3 font-semibold rounded-r-xl">Legal Significance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ddd5c5] dark:divide-[#263336]">
                        {activeDoc.chronology.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#efe9dc]/60 dark:hover:bg-[#1f2a2d]/60 transition-colors">
                            <td className="py-3.5 pl-3 pr-4 font-mono tabular-nums font-semibold text-teal-accent whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="py-3.5 pr-4 text-ink">{row.event}</td>
                            <td className="py-3.5 pr-4 font-mono text-[11px] text-ink-muted">
                              {row.sourceDoc}
                            </td>
                            <td className="py-3.5 pr-3 text-ink-secondary">{row.significance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'contradictions' && (
                <div className="space-y-3">
                  {activeDoc.contradictions.length === 0 ? (
                    <p className="text-xs text-[#156a53] dark:text-emerald-400 py-4 font-medium">
                      No factual or monetary contradictions detected against existing matter annexures.
                    </p>
                  ) : (
                    activeDoc.contradictions.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-[#b23a32]/30 bg-[#b23a32]/7 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-[#9c2f28] dark:text-[#f29b94]">
                            {c.topic}
                          </h4>
                          <span className="font-mono uppercase text-[11px] font-semibold text-[#9c2f28] dark:text-[#f29b94]">
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
                <div className="neu-inset p-4 rounded-2xl text-sm leading-relaxed text-ink whitespace-pre-wrap">
                  {activeDoc.extractedText || 'No extracted text available.'}
                </div>
              )}

              {activeTab === 'translation' && (
                <div className="neu-inset p-4 rounded-2xl text-sm leading-relaxed text-ink whitespace-pre-wrap">
                  {activeDoc.translatedText ||
                    'No translation generated for this file. Re-upload with a target language selected.'}
                </div>
              )}
            </>
          ) : (
            <div className="neu-empty rounded-2xl py-12 px-6 text-center text-sm text-ink-muted">
              Upload or paste your first document above to inspect OCR text, chronology, contradictions, and legal translations.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
