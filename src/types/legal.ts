export type JurisdictionMode = 'india_litigation' | 'corporate_ma' | 'global_multi';

export type WorkspaceSection =
  | 'overview'
  | 'assistant'
  | 'research'
  | 'drafting'
  | 'courtroom'
  | 'redline'
  | 'vault'
  | 'cases'
  | 'admin';

export type AssistantLanguageMode = 'auto' | 'en' | 'hi' | 'bilingual';

export interface AssistantVerifiedSource {
  label: string;
  reference: string;
  kind: 'statute' | 'precedent' | 'matter_record' | 'limitation_rule' | 'court_template';
}

export interface AssistantCompletedAction {
  type: 'draft_created' | 'deadline_created' | 'statute_audited' | 'limitation_computed';
  label: string;
  recordId?: string;
  draftTitle?: string;
  draftContent?: string;
  docType?: string;
}

export interface AssistantMessage {
  id: string;
  userId: string;
  matterId: string | null;
  role: 'user' | 'assistant';
  content: string;
  languageUsed: 'en' | 'hi' | 'bilingual';
  verificationMode: 'deterministic_verified' | 'grounded_ai_verified';
  confidenceNote: string;
  sources: AssistantVerifiedSource[];
  completedActions: AssistantCompletedAction[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organization: string;
  defaultJurisdiction: JurisdictionMode;
  isAdmin?: boolean;
  createdAt: string;
}

export interface AdminUserSummary extends UserProfile {
  mattersCount: number;
  draftsCount: number;
  vaultCount: number;
}

export interface Matter {
  id: string;
  userId: string;
  title: string;
  matterCode: string;
  clientName: string;
  opposingParty: string;
  jurisdiction: JurisdictionMode;
  forum: string;
  status: 'active' | 'pending_hearing' | 'in_review' | 'closed';
  summaryFacts: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerifiedCitation {
  title: string;
  url: string;
  courtOrSource?: string;
  status: 'verified_web' | 'statute' | 'caution';
}

export interface CitationIntegritySummary {
  verifiedSourceCount: number;
  jurisdictionChecked: string;
  bnsComplianceNote: string;
  confidenceLabel: 'Grounded via Web & Statute' | 'Statutory Analysis Only' | 'Requires Manual Check';
}

export interface ResearchMemo {
  id: string;
  matterId: string;
  userId: string;
  query: string;
  jurisdiction: JurisdictionMode;
  answerMarkdown: string;
  citations: VerifiedCitation[];
  citationIntegrity: CitationIntegritySummary;
  createdAt: string;
}

export interface DraftDocument {
  id: string;
  matterId: string;
  userId: string;
  title: string;
  docType: string;
  content: string;
  version: number;
  updatedAt: string;
}

export interface ChronologyEvent {
  date: string;
  event: string;
  sourceDoc: string;
  significance: string;
}

export interface ContradictionItem {
  topic: string;
  statementA: string;
  statementB: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface VaultDocument {
  id: string;
  matterId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  docCategory: string;
  extractedText: string;
  translatedText: string;
  targetLanguage: string;
  chronology: ChronologyEvent[];
  contradictions: ContradictionItem[];
  createdAt: string;
}

export interface RedlineClause {
  id: string;
  clauseRef: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  issueSummary: string;
  originalText: string;
  proposedText: string;
  legalRationale: string;
  decision: 'pending' | 'accepted' | 'rejected';
}

export interface ContractReview {
  id: string;
  matterId: string;
  userId: string;
  title: string;
  playbook: string;
  sourceText: string;
  summary: string;
  clauses: RedlineClause[];
  requisitions: string[];
  createdAt: string;
}

export interface CourtroomTurn {
  id: string;
  speaker: 'counsel' | 'bench' | 'opposing_counsel';
  message: string;
  weaknessFlag?: string;
  suggestedRebuttal?: string;
  authorities?: string[];
  timestamp: string;
}

export interface CourtroomSession {
  id: string;
  matterId: string;
  userId: string;
  mode: 'bench' | 'opposing_counsel';
  forumContext: string;
  briefExcerpt: string;
  turns: CourtroomTurn[];
  vulnerabilities: string[];
  createdAt: string;
}

export interface TrackedCase {
  id: string;
  matterId: string;
  userId: string;
  caseNumber: string;
  cnrNumber: string;
  court: string;
  courtroom: string;
  bench: string;
  causeListItem: string;
  nextHearingDate: string; // YYYY-MM-DD
  stage: string;
  status: 'listed' | 'in_session' | 'adjourned' | 'disposed';
  notes: string;
  createdAt: string;
}

export interface DeadlineItem {
  id: string;
  matterId: string;
  userId: string;
  title: string;
  statuteArticle: string;
  triggerDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  graceDate?: string; // YYYY-MM-DD
  completed: boolean;
  notes: string;
  createdAt: string;
}

export interface MeetingBrief {
  id: string;
  matterId: string;
  userId: string;
  title: string;
  durationLabel: string;
  transcript: string;
  summary: string;
  keyFacts: string[];
  actionItems: string[];
  statutoryIssues: string[];
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  matterId: string | null;
  userId: string;
  sender: 'user' | 'assistant';
  body: string;
  commandTag: string;
  createdAt: string;
}

export interface CaseStudyReference {
  caseName: string;
  citation: string;
  court: string;
  relevance: string;
  applicationToFacts: string;
}

export interface CaseAnalysisReport {
  id: string;
  matterId: string;
  title: string;
  courtLevel: string;
  engineUsed: string;
  latencyMs: number;
  executiveAssessment: string;
  maintainabilityScore: 'Strong' | 'Moderate' | 'High Risk';
  jurisdictionAndLimitation: string;
  applicableStatutes: string[];
  landmarkCaseStudies: CaseStudyReference[];
  vulnerabilitiesAndCounters: Array<{
    risk: string;
    counterStrategy: string;
  }>;
  recommendedFilings: Array<{
    formId: string;
    title: string;
    rationale: string;
  }>;
  detailedMarkdown: string;
  createdAt: string;
}

export interface WorkspaceBundle {
  user: UserProfile;
  matters: Matter[];
  researchMemos: ResearchMemo[];
  drafts: DraftDocument[];
  vaultDocuments: VaultDocument[];
  contractReviews: ContractReview[];
  courtroomSessions: CourtroomSession[];
  trackedCases: TrackedCase[];
  deadlines: DeadlineItem[];
  meetingBriefs: MeetingBrief[];
  whatsappMessages: WhatsAppMessage[];
  assistantMessages: AssistantMessage[];
  storageEngine: 'neon' | 'supabase' | 'local_durable';
  aiEngine?: {
    nvidiaConfigured: boolean;
    geminiConfigured: boolean;
    primaryModel: string;
    fastModel: string;
  };
}
