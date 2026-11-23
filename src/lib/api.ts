import type {
  AdminUserSummary,
  AssistantLanguageMode,
  AssistantMessage,
  CaseAnalysisReport,
  ContractReview,
  CourtroomSession,
  DeadlineItem,
  DraftDocument,
  JurisdictionMode,
  Matter,
  MeetingBrief,
  RedlineClause,
  ResearchMemo,
  TrackedCase,
  UserProfile,
  VaultDocument,
  WhatsAppMessage,
  WorkspaceBundle,
} from '../types/legal';

// Session token held strictly in JS memory (never localStorage or sessionStorage)
let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    role?: string;
    defaultJurisdiction?: JurisdictionMode;
  }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  demoLogin: () =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/demo', {
      method: 'POST',
    }),

  // Workspace
  getWorkspace: () => apiFetch<WorkspaceBundle>('/api/workspace'),

  // Matters
  createMatter: (payload: {
    title: string;
    matterCode: string;
    clientName: string;
    opposingParty: string;
    jurisdiction: JurisdictionMode;
    forum: string;
    status: Matter['status'];
    summaryFacts: string;
  }) =>
    apiFetch<Matter>('/api/matters', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMatter: (matterId: string) =>
    apiFetch<{ deleted: boolean }>(`/api/matters/${matterId}`, {
      method: 'DELETE',
    }),

  // Research
  runResearch: (payload: {
    matterId: string;
    query: string;
    jurisdiction: JurisdictionMode;
    tier?: 'fast' | 'expert';
  }) =>
    apiFetch<ResearchMemo>('/api/ai/research', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  streamResearch: async (
    payload: {
      matterId: string;
      query: string;
      jurisdiction: JurisdictionMode;
      tier?: 'fast' | 'expert';
    },
    callbacks: {
      onStage?: (stage: { stage: string; label: string }) => void;
      onAuthorities?: (data: { authorities: any[]; citations: any[] }) => void;
      onChunk?: (delta: string) => void;
    }
  ): Promise<ResearchMemo> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (memoryToken) {
      headers.Authorization = `Bearer ${memoryToken}`;
    }

    const res = await fetch('/api/ai/research/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Research streaming failed with status ${res.status}`);
    }

    if (!res.body) {
      throw new Error('Streaming response body unavailable.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';
    let memoResult: ResearchMemo | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;
          const parsed = JSON.parse(dataStr) as Record<string, any>;
          if (currentEvent === 'stage' && callbacks.onStage) {
            callbacks.onStage(parsed as { stage: string; label: string });
          } else if (currentEvent === 'authorities' && callbacks.onAuthorities) {
            callbacks.onAuthorities(parsed as { authorities: any[]; citations: any[] });
          } else if (currentEvent === 'chunk' && typeof parsed.delta === 'string') {
            callbacks.onChunk?.(parsed.delta);
          } else if (currentEvent === 'complete') {
            memoResult = parsed as unknown as ResearchMemo;
          } else if (currentEvent === 'error') {
            throw new Error(
              typeof parsed.error === 'string' ? parsed.error : 'Research streaming failed.'
            );
          }
        }
      }
    }

    if (!memoResult) {
      throw new Error('Research stream terminated without returning final memorandum.');
    }
    return memoResult;
  },

  // Drafting
  createDraft: (payload: {
    matterId: string;
    title: string;
    docType: string;
    content: string;
  }) =>
    apiFetch<DraftDocument>('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateDraft: (draftId: string, payload: { title?: string; content?: string }) =>
    apiFetch<DraftDocument>(`/api/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  generateDraft: (payload: {
    matterId: string;
    title: string;
    docType: string;
    instructions: string;
    jurisdiction: JurisdictionMode;
  }) =>
    apiFetch<DraftDocument>('/api/ai/draft-generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rewriteSelection: (payload: {
    selection: string;
    instruction: string;
    jurisdiction: JurisdictionMode;
  }) =>
    apiFetch<{ rewritten: string }>('/api/ai/draft-rewrite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Supreme Court / High Court Case Analysis
  runCaseAnalysis: (payload: {
    matterId: string;
    caseTitle: string;
    courtLevel: string;
    jurisdiction: JurisdictionMode;
    parties: string;
    caseStage: string;
    userFactsAndData: string;
    keyLegalQuestions: string;
    saveToResearch?: boolean;
  }) =>
    apiFetch<{ report: CaseAnalysisReport; savedMemo: ResearchMemo | null }>(
      '/api/ai/case-analysis',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Real-time SSE Streaming Affidavit & Judiciary Form Generator
  streamJudiciaryForm: async (
    payload: {
      matterId: string;
      templateId: string;
      courtName: string;
      caseNumber: string;
      petitionerName: string;
      respondentName: string;
      deponentName: string;
      deponentDetails: string;
      factsSummary: string;
      reliefSought: string;
      placeOfFiling: string;
      filingDate: string;
      jurisdiction: JurisdictionMode;
    },
    onDelta: (chunk: string) => void
  ): Promise<{ draft: DraftDocument; engineUsed: string; latencyMs: number }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (memoryToken) {
      headers.Authorization = `Bearer ${memoryToken}`;
    }

    const res = await fetch('/api/ai/judiciary-form/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody?.error === 'string'
          ? errBody.error
          : `Streaming form generation failed (${res.status})`
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';
    let doneResult: { draft: DraftDocument; engineUsed: string; latencyMs: number } | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;
          const parsed = JSON.parse(dataStr) as Record<string, unknown>;
          if (currentEvent === 'delta' && typeof parsed.text === 'string') {
            onDelta(parsed.text);
          } else if (currentEvent === 'done') {
            doneResult = parsed as unknown as {
              draft: DraftDocument;
              engineUsed: string;
              latencyMs: number;
            };
          } else if (currentEvent === 'error') {
            throw new Error(
              typeof parsed.error === 'string' ? parsed.error : 'Form streaming failed.'
            );
          }
        }
      }
    }

    if (!doneResult) {
      throw new Error('Form stream ended before completion.');
    }
    return doneResult;
  },

  // Court-Formatted Microsoft Word (.DOCX) Export
  exportCourtDocx: async (payload: {
    title: string;
    courtHeader?: string;
    matterCode?: string;
    docType?: string;
    content: string;
  }): Promise<string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (memoryToken) {
      headers.Authorization = `Bearer ${memoryToken}`;
    }

    const res = await fetch('/api/export/docx', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody?.error === 'string' ? errBody.error : 'DOCX export failed.'
      );
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename =
      match?.[1] ||
      `${(payload.title || 'legal-document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  },

  // Courtroom Simulator
  startCourtroomSession: (payload: {
    matterId: string;
    mode: 'bench' | 'opposing_counsel';
    forumContext: string;
    briefExcerpt: string;
    openingSubmission: string;
  }) =>
    apiFetch<CourtroomSession>('/api/ai/courtroom/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  replyCourtroomSession: (sessionId: string, submission: string) =>
    apiFetch<CourtroomSession>(`/api/ai/courtroom/${sessionId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ submission }),
    }),

  // Contract Redline & Due Diligence
  runContractRedline: (payload: {
    matterId: string;
    title: string;
    playbook: string;
    contractText: string;
  }) =>
    apiFetch<ContractReview>('/api/ai/contract-redline', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  decideRedlineClause: (
    reviewId: string,
    clauseId: string,
    decision: RedlineClause['decision']
  ) =>
    apiFetch<ContractReview>(
      `/api/contract-reviews/${reviewId}/clauses/${clauseId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      }
    ),

  // Document Vault
  processVaultDocument: (payload: {
    matterId: string;
    fileName: string;
    mimeType: string;
    docCategory: string;
    base64Data?: string;
    textInput?: string;
    targetLanguage: string;
  }) =>
    apiFetch<VaultDocument>('/api/ai/vault-process', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Cases & Deadlines
  addTrackedCase: (payload: {
    matterId: string;
    caseNumber: string;
    cnrNumber: string;
    court: string;
    courtroom: string;
    bench: string;
    causeListItem: string;
    nextHearingDate: string;
    stage: string;
    status: TrackedCase['status'];
    notes: string;
  }) =>
    apiFetch<TrackedCase>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCaseStatus: (caseId: string, status: TrackedCase['status']) =>
    apiFetch<TrackedCase>(`/api/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  addDeadline: (payload: {
    matterId: string;
    title: string;
    statuteArticle: string;
    triggerDate: string;
    dueDate: string;
    graceDate?: string;
    notes: string;
  }) =>
    apiFetch<DeadlineItem>('/api/deadlines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleDeadline: (deadlineId: string) =>
    apiFetch<DeadlineItem>(`/api/deadlines/${deadlineId}/toggle`, {
      method: 'PATCH',
    }),

  // WhatsApp & Meetings
  sendWhatsAppCommand: (matterId: string | null, text: string) =>
    apiFetch<{
      userMsg: WhatsAppMessage;
      assistantMsg: WhatsAppMessage;
      createdDeadline: DeadlineItem | null;
    }>('/api/whatsapp/command', {
      method: 'POST',
      body: JSON.stringify({ matterId, text }),
    }),

  createMeetingBrief: (payload: {
    matterId: string;
    title: string;
    durationLabel: string;
    base64Audio?: string;
    mimeType?: string;
    transcriptText?: string;
  }) =>
    apiFetch<MeetingBrief>('/api/ai/meeting-brief', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // VidhiOS Bilingual (Hindi / English) Zero-Hallucination Assistant
  sendAssistantMessage: (payload: {
    matterId: string | null;
    message: string;
    languageMode: AssistantLanguageMode;
    jurisdiction: JurisdictionMode;
  }) =>
    apiFetch<{
      userMsg: AssistantMessage;
      assistantMsg: AssistantMessage;
      createdDraft: DraftDocument | null;
      createdDeadline: DeadlineItem | null;
    }>('/api/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  clearAssistantHistory: () =>
    apiFetch<{ cleared: boolean }>('/api/ai/assistant', {
      method: 'DELETE',
    }),

  // Admin User Management
  getAdminUsers: () => apiFetch<{ users: AdminUserSummary[] }>('/api/admin/users'),

  createAdminUser: (payload: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    role?: string;
    defaultJurisdiction?: JurisdictionMode;
    isAdmin?: boolean;
  }) =>
    apiFetch<{ user: UserProfile }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminUser: (
    userId: string,
    payload: {
      fullName?: string;
      organization?: string;
      role?: string;
      defaultJurisdiction?: JurisdictionMode;
      isAdmin?: boolean;
    }
  ) =>
    apiFetch<{ user: UserProfile }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  resetUserPassword: (userId: string, password: string) =>
    apiFetch<{ success: boolean }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  deleteAdminUser: (userId: string) =>
    apiFetch<{ success: boolean }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),
};
