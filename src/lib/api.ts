import type {
  ActivityLogItem,
  AdminUserSummary,
  AssistantLanguageMode,
  AssistantMessage,
  AuditEventItem,
  CaseAnalysisReport,
  ClientProfile,
  ContractReview,
  CorporateProfileRecord,
  CourtroomSession,
  DeadlineItem,
  DraftDocument,
  EvidenceItemRecord,
  HearingRecord,
  JurisdictionMode,
  LitigationStrategyRecord,
  Matter,
  MatterTask,
  MeetingBrief,
  NotificationItem,
  Organization,
  RedlineClause,
  ResearchMemo,
  SubscriptionRecord,
  SubscriptionTier,
  TrackedCase,
  UserProfile,
  VaultDocument,
  WhatsAppMessage,
  WorkflowRunRecord,
  WorkspaceBundle,
} from '../types/legal';

// Session token held strictly in JS memory (supplemented by HTTP-only cookie + CSRF header)
let memoryToken: string | null = null;
let memoryCsrfToken: string | null = null;

export function setAuthToken(token: string | null, csrfToken?: string | null): void {
  memoryToken = token;
  if (csrfToken !== undefined) {
    memoryCsrfToken = csrfToken;
  }
}

export function getAuthToken(): string | null {
  return memoryToken;
}

function readCsrfCookie(): string {
  if (memoryCsrfToken) return memoryCsrfToken;
  if (typeof document === 'undefined') return '';
  const match = /(?:^|;\s*)vidhios_csrf=([^;]+)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }
  const csrf = readCsrfCookie();
  if (csrf) {
    headers['x-csrf-token'] = csrf;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
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
    apiFetch<{ token: string; csrfToken?: string; user: UserProfile }>('/api/auth/login', {
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
    apiFetch<{ token: string; csrfToken?: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  demoLogin: () =>
    apiFetch<{ token: string; csrfToken?: string; user: UserProfile }>('/api/auth/demo', {
      method: 'POST',
    }),

  logout: () =>
    apiFetch<{ loggedOut: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    apiFetch<{ user: UserProfile; subscription?: SubscriptionRecord }>('/api/auth/me'),

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

  updateMatter: (
    matterId: string,
    payload: Partial<
      Pick<
        Matter,
        | 'title'
        | 'status'
        | 'forum'
        | 'opposingParty'
        | 'clientName'
        | 'summaryFacts'
        | 'cnrNumber'
        | 'caseType'
        | 'assignedAdvocate'
        | 'filingDate'
      >
    >
  ) =>
    apiFetch<Matter>(`/api/matters/${matterId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteMatter: (matterId: string) =>
    apiFetch<{ deleted: boolean }>(`/api/matters/${matterId}`, {
      method: 'DELETE',
    }),

  // Clients, Tasks, Hearings & Notifications
  createClient: (payload: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    address?: string;
    panOrCin?: string;
    notes?: string;
    portalAccessEnabled?: boolean;
  }) =>
    apiFetch<ClientProfile>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createTask: (payload: {
    matterId: string;
    title: string;
    priority: MatterTask['priority'];
    dueDate: string;
    assignedToName?: string;
  }) =>
    apiFetch<MatterTask>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTaskStatus: (taskId: string, status: MatterTask['status']) =>
    apiFetch<MatterTask>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  createHearing: (payload: {
    matterId: string;
    hearingDate: string;
    court: string;
    courtroom?: string;
    bench?: string;
    causeListItem?: string;
    outcome: HearingRecord['outcome'];
    nextHearingDate?: string;
    adjournmentReason?: string;
    notes?: string;
  }) =>
    apiFetch<HearingRecord>('/api/hearings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markNotificationRead: (id: string) =>
    apiFetch<NotificationItem>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  // Research
  runResearch: (payload: {
    matterId: string;
    query: string;
    jurisdiction: JurisdictionMode;
    tier?: 'fast' | 'expert';
    filters?: ResearchMemo['filters'];
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
      filters?: ResearchMemo['filters'];
    },
    callbacks: {
      onStage?: (stage: { stage: string; label: string }) => void;
      onAuthorities?: (data: { authorities: any[]; citations: any[]; conflicts?: any[] }) => void;
      onChunk?: (delta: string) => void;
    },
    abortSignal?: AbortSignal
  ): Promise<ResearchMemo & { conflicts?: any[] }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (memoryToken) {
      headers.Authorization = `Bearer ${memoryToken}`;
    }
    const csrf = readCsrfCookie();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }

    const res = await fetch('/api/ai/research/stream', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
      signal: abortSignal,
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
    let memoResult: (ResearchMemo & { conflicts?: any[] }) | null = null;

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
            callbacks.onAuthorities(parsed as { authorities: any[]; citations: any[]; conflicts?: any[] });
          } else if (currentEvent === 'chunk' && typeof parsed.delta === 'string') {
            callbacks.onChunk?.(parsed.delta);
          } else if (currentEvent === 'complete') {
            memoResult = parsed as unknown as ResearchMemo & { conflicts?: any[] };
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

  updateDraft: (
    draftId: string,
    payload: { title?: string; content?: string; status?: DraftDocument['status'] }
  ) =>
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
    const csrf = readCsrfCookie();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }

    const res = await fetch('/api/ai/judiciary-form/stream', {
      method: 'POST',
      credentials: 'include',
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
    const csrf = readCsrfCookie();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }

    const res = await fetch('/api/export/docx', {
      method: 'POST',
      credentials: 'include',
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

  updateVaultDocument: (
    docId: string,
    payload: Partial<
      Pick<VaultDocument, 'extractedText' | 'translatedText' | 'chronology' | 'processingStatus'>
    >
  ) =>
    apiFetch<VaultDocument>(`/api/vault/${docId}`, {
      method: 'PATCH',
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

  // VidhiOS Bilingual Assistant
  sendAssistantMessage: (
    payload: {
      matterId: string | null;
      message: string;
      languageMode: AssistantLanguageMode;
      jurisdiction: JurisdictionMode;
    },
    abortSignal?: AbortSignal
  ) =>
    apiFetch<{
      userMsg: AssistantMessage;
      assistantMsg: AssistantMessage;
      createdDraft: DraftDocument | null;
      createdDeadline: DeadlineItem | null;
    }>('/api/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: abortSignal,
    }),

  clearAssistantHistory: () =>
    apiFetch<{ cleared: boolean }>('/api/ai/assistant', {
      method: 'DELETE',
    }),

  // Multi-Agent Workflows
  runMultiAgentWorkflow: (payload: {
    matterId?: string | null;
    workflowType:
      | 'full_matter_brief'
      | 'research_verification'
      | 'draft_audit'
      | 'contract_risk_audit'
      | 'compliance_deadline_check';
    goal: string;
    extraContext?: string;
  }) =>
    apiFetch<WorkflowRunRecord>('/api/ai/workflows/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  approveWorkflowRun: (runId: string) =>
    apiFetch<WorkflowRunRecord>(`/api/ai/workflows/${runId}/approve`, {
      method: 'POST',
    }),

  // Translation Studio
  translateLegalText: (payload: {
    sourceText: string;
    sourceLanguage: string;
    targetLanguage: string;
    jurisdiction: JurisdictionMode;
  }) =>
    apiFetch<{
      translatedText: string;
      segments: Array<{ original: string; translated: string }>;
      terminologyNotes: string[];
      qualityWarning: string;
    }>('/api/ai/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Corporate Intelligence
  lookupCorporate: (payload: { query: string; matterId?: string }) =>
    apiFetch<{ profile: CorporateProfileRecord; providerConfigured: boolean }>(
      '/api/corporate/lookup',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Knowledge Graph, Strategy & Evidence
  getKnowledgeGraph: (matterId: string) =>
    apiFetch<{
      graph: {
        nodes: Array<{ id: string; label: string; category: string }>;
        edges: Array<{ from: string; to: string; relation: string }>;
      };
      conflicts: Array<{
        topic: string;
        supportingAuthority: string;
        adverseOrDistinguishedAuthority: string;
        courtHierarchyNote: string;
        distinctionSummary: string;
      }>;
    }>(`/api/intelligence/graph?matterId=${encodeURIComponent(matterId)}`),

  generateStrategy: (matterId: string) =>
    apiFetch<LitigationStrategyRecord>('/api/intelligence/strategy', {
      method: 'POST',
      body: JSON.stringify({ matterId }),
    }),

  addEvidenceItem: (payload: {
    matterId: string;
    exhibitNumber: string;
    title: string;
    sourceDocumentId?: string;
    witnessName?: string;
    admissibilityStatus: EvidenceItemRecord['admissibilityStatus'];
    notes: string;
  }) =>
    apiFetch<EvidenceItemRecord>('/api/intelligence/evidence', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Subscriptions
  upgradeSubscription: (tier: SubscriptionTier) =>
    apiFetch<{ subscription: SubscriptionRecord; billingNote: string }>(
      '/api/subscription/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({ tier }),
      }
    ),

  // Admin User & Governance Management
  getAdminUsers: () => apiFetch<{ users: AdminUserSummary[] }>('/api/admin/users'),

  getAdminOverview: () =>
    apiFetch<{
      organizations: Array<Organization & { membersCount: number; subscription?: SubscriptionRecord }>;
      auditEvents: AuditEventItem[];
      counts: Record<string, number>;
      metrics: Record<string, any>;
      health: Record<string, any>;
    }>('/api/admin/overview'),

  updateOrgSubscription: (orgId: string, tier: SubscriptionTier) =>
    apiFetch<{ subscription: SubscriptionRecord }>(
      `/api/admin/organizations/${orgId}/subscription`,
      {
        method: 'POST',
        body: JSON.stringify({ tier }),
      }
    ),

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
