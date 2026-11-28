import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  FileText,
  Languages,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { stripMarkdownForPlainText } from '../lib/legal/responseFormatter';
import { CitationTextRenderer } from './CitationTextRenderer';
import type {
  AssistantCompletedAction,
  AssistantLanguageMode,
  AssistantMessage,
  DeadlineItem,
  DraftDocument,
  JurisdictionMode,
  Matter,
  WorkspaceSection,
} from '../types/legal';

interface VidhiAssistantModuleProps {
  activeMatter: Matter | null;
  jurisdiction: JurisdictionMode;
  messages: AssistantMessage[];
  onMessageExchanged: (
    userMsg: AssistantMessage,
    assistantMsg: AssistantMessage,
    createdDraft: DraftDocument | null,
    createdDeadline: DeadlineItem | null
  ) => void;
  onHistoryCleared: () => void;
  onNavigate: (section: WorkspaceSection) => void;
  onToast: (msg: string) => void;
}

const LANGUAGE_OPTIONS: Array<{ id: AssistantLanguageMode; label: string }> = [
  { id: 'auto', label: 'Auto (EN / हिंदी)' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी (Hindi)' },
  { id: 'bilingual', label: 'Bilingual (EN + हिंदी)' },
];

const QUICK_TASKS: Array<{
  tag: string;
  title: string;
  prompt: string;
  langHint?: AssistantLanguageMode;
}> = [
  {
    tag: 'हिंदी · BNS Audit',
    title: 'IPC 420 व CrPC 438 के नए सेक्शन',
    prompt: 'धारा 420 IPC, 406 IPC और 438 CrPC के नए BNS/BNSS सेक्शन बताओ',
    langHint: 'hi',
  },
  {
    tag: 'हिंदी · Affidavit + DOCX',
    title: 'Section 63 BSA एफिडेविट तैयार करें',
    prompt: 'मेरे इस केस के लिए Section 63 BSA Electronic Evidence Affidavit बनाओ',
    langHint: 'hi',
  },
  {
    tag: 'हिंदी · Live Case',
    title: 'अगली सुनवाई और लंबित डेडलाइन',
    prompt: 'मेरा केस स्टेटस, अगली सुनवाई की तारीख और लंबित डेडलाइन बताओ',
    langHint: 'hi',
  },
  {
    tag: 'English · Pleading + DOCX',
    title: 'Draft Anticipatory Bail (482 BNSS)',
    prompt: 'Draft an Anticipatory Bail Application under Section 482 BNSS for this matter',
    langHint: 'en',
  },
  {
    tag: 'English · Limitation',
    title: 'Arbitration Sec. 34 Expiry + Save',
    prompt: 'Calculate Arbitration Section 34 limitation from 2026-10-01 and save deadline',
    langHint: 'en',
  },
  {
    tag: 'Bilingual · SC/HC Analysis',
    title: 'Analyze Case with SC Precedents',
    prompt: 'Analyze my active case with verified Supreme Court & High Court precedents',
    langHint: 'bilingual',
  },
];

export function VidhiAssistantModule({
  activeMatter,
  jurisdiction,
  messages,
  onMessageExchanged,
  onHistoryCleared,
  onNavigate,
  onToast,
}: VidhiAssistantModuleProps) {
  const [languageMode, setLanguageMode] = useState<AssistantLanguageMode>('auto');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCopyAssistantReply = async (msg: AssistantMessage) => {
    const cleanText = stripMarkdownForPlainText(msg.content);
    try {
      await navigator.clipboard.writeText(cleanText);
    } catch {
      // Clipboard may be unavailable in restricted contexts; still give feedback
    }
    setCopiedMsgId(msg.id);
    onToast('Copied clean legal response to clipboard.');
    window.setTimeout(() => {
      setCopiedMsgId((curr) => (curr === msg.id ? null : curr));
    }, 1800);
  };

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const sendMessage = async (textToSend: string, langOverride?: AssistantLanguageMode) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    const activeLang = langOverride ?? languageMode;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await api.sendAssistantMessage(
        {
          matterId: activeMatter?.id ?? null,
          message: trimmed,
          languageMode: activeLang,
          jurisdiction,
        },
        controller.signal
      );
      onMessageExchanged(
        res.userMsg,
        res.assistantMsg,
        res.createdDraft,
        res.createdDeadline
      );
      setInput('');
      if (res.createdDraft) {
        onToast(`Draft created & saved: "${res.createdDraft.title}"`);
      } else if (res.createdDeadline) {
        onToast(`Deadline pinned: "${res.createdDeadline.title}"`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onToast('Generation stopped.');
      } else {
        setError(err instanceof Error ? err.message : 'Assistant request failed.');
      }
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleRegenerateLast = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      void sendMessage(lastUserMsg.content);
    }
  };

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const content = messages
      .map((m) => `[${m.createdAt}] ${m.role.toUpperCase()}:\n${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidhios-assistant-${activeMatter?.matterCode || 'session'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported conversation transcript.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleDownloadActionDocx = async (action: AssistantCompletedAction, msgId: string) => {
    if (!action.draftContent) return;
    const key = `${msgId}-${action.recordId ?? action.label}`;
    setExportingKey(key);
    try {
      const file = await api.exportCourtDocx({
        title: action.draftTitle || 'VidhiOS Court Filing',
        courtHeader: activeMatter?.forum,
        matterCode: activeMatter?.matterCode,
        docType: action.docType || 'Court Pleading',
        content: action.draftContent,
      });
      onToast(`Downloaded court-formatted Word file: ${file}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export .DOCX file.');
    } finally {
      setExportingKey(null);
    }
  };

  const handleClear = async () => {
    try {
      await api.clearAssistantHistory();
      onHistoryCleared();
      onToast('Cleared VidhiOS Assistant conversation history.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear chat history.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Control Bar: Grounded Matter Context + Hindi/English Language Selector */}
      <section className="neu-card rounded-2xl px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold text-ink">
              VidhiOS Bilingual Legal Assistant (English / हिंदी)
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#156a53]/12 text-[#115442] dark:text-emerald-300 text-[11px] font-mono font-semibold">
              <ShieldCheck className="w-3 h-3" strokeWidth={2} />
              <span>Zero-Hallucination Grounded</span>
            </span>
          </div>
          <p className="text-xs text-ink-muted truncate">
            Bound strictly to active Matter:{' '}
            <span className="font-semibold text-ink">
              {activeMatter ? `${activeMatter.matterCode} — ${activeMatter.title}` : 'No Matter Selected'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div
            role="group"
            aria-label="Assistant reply language"
            className="neu-tab-bar rounded-xl p-1 flex flex-wrap items-center gap-1"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguageMode(opt.id)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap ${
                  languageMode === opt.id
                    ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportConversation}
                className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear conversation"
                className="neu-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
        >
          {error}
        </div>
      )}

      {/* Main Split: Conversation Thread (8 cols) + Bilingual Action Dock (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 neu-card rounded-3xl p-4 sm:p-6 flex flex-col min-h-[560px] max-h-[74vh]">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
            {messages.length === 0 ? (
              <div className="neu-inset rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#0f5a5f] text-[#faf8f4] flex items-center justify-center shrink-0">
                    <Languages className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-sm font-semibold text-ink">
                      नमस्ते! Welcome to VidhiOS Verified Legal Assistant
                    </h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      Ask in <strong>English</strong>, <strong>हिंदी (Hindi)</strong>, or <strong>Hinglish</strong>. I execute real legal tasks directly on your active Matter — drafting court-ready Affidavits &amp; Judiciary Forms with instant <strong>.DOCX</strong> download, computing exact Limitation Act deadlines, mapping repealed IPC/CrPC/IEA sections to BNS/BNSS/BSA, and citing only verified Supreme Court &amp; High Court precedents.
                    </p>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      आप हिंदी या अंग्रेज़ी में अपना पूरा कानूनी काम यहीं पूरा कर सकते हैं — बिना किसी अनुमान या गलत साइटेशन के।
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-full sm:max-w-[88%] rounded-2xl px-3.5 sm:px-4 py-3.5 space-y-3 ${
                        isUser
                          ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-sm'
                          : 'neu-inset text-ink'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span
                          className={`font-semibold ${
                            isUser ? 'text-[#d4ecee]' : 'text-teal-accent'
                          }`}
                        >
                          {isUser ? 'Client / Counsel' : 'VidhiOS Verified Assistant'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono tabular-nums ${
                              isUser ? 'text-[#cbe6e8]' : 'text-ink-muted'
                            }`}
                          >
                            {msg.languageUsed === 'hi'
                              ? 'हिंदी'
                              : msg.languageUsed === 'bilingual'
                                ? 'EN + हिंदी'
                                : 'EN'}
                          </span>
                          {!isUser && (
                            <button
                              type="button"
                              onClick={() => handleCopyAssistantReply(msg)}
                              aria-label="Copy clean legal response"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#efe9dc]/80 dark:bg-[#222f33] border border-stone-hairline text-[10px] font-medium text-ink-secondary hover:text-ink transition-colors"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-[#156a53] dark:text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {isUser ? (
                        <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-[#faf8f4]">
                          {msg.content}
                        </div>
                      ) : (
                        <CitationTextRenderer
                          markdown={msg.content}
                          density="compact"
                          onCopyCitation={(label) => onToast(`Copied citation: ${label}`)}
                        />
                      )}

                      {/* Completed Real Actions (Download DOCX / Open Draft / View Tracker) */}
                      {!isUser && msg.completedActions.length > 0 && (
                        <div className="pt-2.5 border-t border-stone-hairline space-y-2">
                          {msg.completedActions.map((act, idx) => {
                            const actionKey = `${msg.id}-${act.recordId ?? act.label}`;
                            return (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-[#faf7f0] dark:bg-[#192224] border border-[#156a53]/30 flex flex-wrap items-center justify-between gap-2.5"
                              >
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#115442] dark:text-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                  <span>{act.label}</span>
                                </span>

                                <div className="flex flex-wrap items-center gap-2">
                                  {act.type === 'draft_created' && act.draftContent && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={exportingKey === actionKey}
                                        onClick={() => handleDownloadActionDocx(act, msg.id)}
                                        className="neu-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full whitespace-nowrap disabled:opacity-50"
                                      >
                                        <FileDown className="w-3 h-3" strokeWidth={2} />
                                        <span>
                                          {exportingKey === actionKey
                                            ? 'Building...'
                                            : 'Download Court .DOCX'}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onNavigate('drafting')}
                                        className="neu-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-full whitespace-nowrap"
                                      >
                                        <FileText className="w-3 h-3" strokeWidth={2} />
                                        <span>Open in Drafting</span>
                                      </button>
                                    </>
                                  )}

                                  {act.type === 'deadline_created' && (
                                    <button
                                      type="button"
                                      onClick={() => onNavigate('cases')}
                                      className="neu-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-full whitespace-nowrap"
                                    >
                                      <span>Open Case Tracker</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Verified Sources, Feedback & Suggested Follow-ups */}
                      {!isUser && (
                        <div className="pt-2 border-t border-stone-hairline space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#156a53] dark:text-emerald-300">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                              <span>{msg.confidenceNote}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleRegenerateLast}
                                disabled={sending}
                                title="Regenerate response"
                                className="p-1 rounded text-ink-muted hover:text-ink"
                              >
                                <RotateCw className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFeedbackMap((f) => ({ ...f, [msg.id]: 'up' }));
                                  onToast('Quality feedback recorded.');
                                }}
                                title="Accurate & helpful"
                                className={`p-1 rounded ${feedbackMap[msg.id] === 'up' ? 'text-emerald-600' : 'text-ink-muted hover:text-ink'}`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFeedbackMap((f) => ({ ...f, [msg.id]: 'down' }));
                                  onToast('Issue flagged for quality review.');
                                }}
                                title="Flag inaccuracy / missing verification"
                                className={`p-1 rounded ${feedbackMap[msg.id] === 'down' ? 'text-red-600' : 'text-ink-muted hover:text-ink'}`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {msg.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 rounded-md bg-[#efe9dc] dark:bg-[#222f33] border border-stone-hairline text-[10px] font-mono text-ink-secondary"
                                >
                                  {src.label}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              'List missing facts or documents',
                              'Check BNS/BNSS/BSA sections',
                              'Draft supporting Affidavit',
                            ].map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                disabled={sending}
                                onClick={() => void sendMessage(followUp)}
                                className="px-2 py-0.5 rounded-md border border-stone-hairline text-[10px] font-medium text-teal-accent hover:bg-[var(--surface)] transition-colors"
                              >
                                + {followUp}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-start">
                <div className="neu-inset rounded-2xl px-4 py-3 text-xs text-ink-muted inline-flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-teal-accent animate-spin" />
                  <span>Verifying statutes, Matter records &amp; SC/HC precedents...</span>
                </div>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Composer Form */}
          <form
            onSubmit={handleSubmit}
            className="pt-3 border-t border-stone-hairline flex flex-col sm:flex-row gap-2.5"
          >
            <label htmlFor="vidhi-assistant-input" className="sr-only">
              Ask VidhiOS Assistant in English or Hindi
            </label>
            <input
              id="vidhi-assistant-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                languageMode === 'hi'
                  ? 'हिंदी में पूछें या काम करवाएँ (जैसे: "420 IPC का नया BNS सेक्शन" या "एफिडेविट बनाओ")...'
                  : 'Ask in English, हिंदी, or Hinglish (e.g., "Draft Section 63 BSA affidavit" or "420 IPC ka BNS section")...'
              }
              className="neu-input flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full"
            />
            {sending ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="neu-btn-secondary inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 text-red-700 dark:text-red-400"
              >
                <Square className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="neu-btn-primary inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Send / भेजें</span>
              </button>
            )}
          </form>
        </section>

        {/* Right Dock: One-Click Hindi & English Legal Workflows + Anti-Hallucination Guarantees */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="neu-card rounded-3xl p-5 space-y-3.5">
            <div className="pb-2.5 border-b border-stone-hairline">
              <h3 className="font-display text-sm font-semibold text-ink">
                One-Click Workflows (English &amp; हिंदी)
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Click any task to execute directly on your active Matter.
              </p>
            </div>

            <div className="space-y-2">
              {QUICK_TASKS.map((task) => (
                <button
                  key={task.title}
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    void sendMessage(task.prompt, task.langHint);
                  }}
                  className="w-full text-left neu-inset p-3 rounded-2xl border border-transparent hover:border-[#0f5a5f] transition-all disabled:opacity-50"
                >
                  <p className="font-mono text-[10px] font-semibold text-teal-accent">
                    {task.tag}
                  </p>
                  <p className="text-xs font-semibold text-ink mt-0.5">{task.title}</p>
                  <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">{task.prompt}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="neu-card rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-accent shrink-0" strokeWidth={2} />
              <h3 className="font-display text-sm font-semibold text-ink">
                Zero-Hallucination Safeguards
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-ink-secondary leading-relaxed">
              <li>
                <strong className="text-ink">1. Deterministic Legal Tools First:</strong> Statute mappings (IPC/CrPC/IEA → BNS/BNSS/BSA), Limitation Act math, and active case records run on verified code engines — never guessed.
              </li>
              <li>
                <strong className="text-ink">2. Verified SC/HC Precedent Corpus:</strong> Citations come strictly from verified Supreme Court &amp; High Court authorities with explicit source chips.
              </li>
              <li>
                <strong className="text-ink">3. Real Work Execution:</strong> Drafts Affidavits, Bail Applications, Vakalatnamas &amp; Notices directly into Matter Drafts with instant Court <strong>.DOCX</strong> download.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
