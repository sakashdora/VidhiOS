export type JurisdictionMode = 'india_litigation' | 'corporate_ma' | 'global_multi';

export type WorkspaceSection =
  | 'overview'
  | 'assistant'
  | 'research'
  | 'cases'
  | 'intelligence'
  | 'drafting'
  | 'forms'
  | 'vault'
  | 'redline'
  | 'courtroom'
  | 'calendar'
  | 'library'
  | 'corporate'
  | 'translation'
  | 'meetings'
  | 'analytics'
  | 'team'
  | 'settings'
  | 'admin';

export type SubscriptionTier = 'FREE' | 'PRO' | 'CHAMBERS' | 'ENTERPRISE';

export type OrganizationRole =
  | 'owner'
  | 'partner'
  | 'advocate'
  | 'paralegal'
  | 'client'
  | 'student'
  | 'admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: SubscriptionTier;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  permissions: string[];
  createdAt: string;
}

export interface ClientProfile {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  panOrCin?: string;
  notes: string;
  portalAccessEnabled: boolean;
  createdAt: string;
}

export interface MatterTask {
  id: string;
  organizationId: string;
  matterId: string;
  userId: string;
  assignedToUserId?: string;
  assignedToName?: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  dueDate: string;
  createdAt: string;
}

export interface HearingRecord {
  id: string;
  organizationId: string;
  matterId: string;
  trackedCaseId?: string;
  userId: string;
  hearingDate: string;
  court: string;
  courtroom: string;
  bench: string;
  causeListItem: string;
  outcome: 'scheduled' | 'heard' | 'adjourned' | 'part_heard' | 'order_reserved' | 'disposed';
  nextHearingDate?: string;
  adjournmentReason?: string;
  notes: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  kind: 'deadline' | 'hearing' | 'ai_task' | 'system' | 'security';
  read: boolean;
  linkSection?: WorkspaceSection;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  organizationId: string;
  userId: string;
  actorName: string;
  matterId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  createdAt: string;
}

export interface AuditEventItem {
  id: string;
  organizationId: string;
  userId: string;
  actorEmail: string;
  eventType: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  status: 'success' | 'denied' | 'error';
  details: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  tier: SubscriptionTier;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  aiQueriesLimit: number;
  aiQueriesUsed: number;
  aiTokensUsed: number;
  storageLimitMb: number;
  storageUsedMb: number;
  maxMatters: number;
  maxSeats: number;
  expiresAt: string;
  updatedAt: string;
}

export interface WorkflowStepLog {
  id: string;
  agentName: string;
  stepTitle: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  inputSummary: string;
  outputSummary: string;
  tokensUsed: number;
  latencyMs: number;
  verificationNotes?: string;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  organizationId: string;
  userId: string;
  matterId: string | null;
  workflowType: string;
  goal: string;
  status: 'running' | 'awaiting_approval' | 'completed' | 'failed';
  requiresHumanApproval: boolean;
  approvedByUserId?: string;
  totalTokens: number;
  totalLatencyMs: number;
  steps: WorkflowStepLog[];
  finalOutput: string;
  createdAt: string;
}

export interface CorporateProfileRecord {
  id: string;
  organizationId: string;
  userId: string;
  matterId?: string;
  cin: string;
  companyName: string;
  roc: string;
  status: string;
  incorporationDate: string;
  authorizedCapital: string;
  paidUpCapital: string;
  registeredAddress: string;
  directors: Array<{ din: string; name: string; designation: string; appointmentDate: string }>;
  charges: Array<{ chargeId: string; holder: string; amount: string; status: string; date: string }>;
  filings: Array<{ form: string; date: string; description: string; status: string }>;
  aiDueDiligenceSummary: string;
  redFlags: string[];
  sourceProvider: string;
  sourceDate: string;
  isMockData: boolean;
  createdAt: string;
}

export interface EvidenceItemRecord {
  id: string;
  organizationId: string;
  matterId: string;
  userId: string;
  exhibitNumber: string;
  title: string;
  sourceDocumentId?: string;
  witnessName?: string;
  admissibilityStatus: 'verified_63_bsa' | 'primary_original' | 'requires_certificate' | 'contested';
  notes: string;
  createdAt: string;
}

export interface LitigationStrategyRecord {
  id: string;
  organizationId: string;
  matterId: string;
  userId: string;
  caseTheory: string;
  legalIssues: string[];
  supportingFacts: string[];
  adverseFacts: string[];
  supportingPrecedents: string[];
  weaknesses: string[];
  evidenceRequirements: string[];
  crossExamQuestions: string[];
  aiGeneratedDisclaimer: string;
  updatedAt: string;
}

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
  organizationId?: string;
  orgRole?: OrganizationRole;
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
  organizationId?: string;
  clientId?: string;
  assignedUserIds?: string[];
  title: string;
  matterCode: string;
  clientName: string;
  opposingParty: string;
  jurisdiction: JurisdictionMode;
  forum: string;
  caseType?: string;
  cnrNumber?: string;
  filingDate?: string;
  assignedAdvocate?: string;
  status: 'active' | 'pending_hearing' | 'in_review' | 'closed';
  summaryFacts: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerifiedCitation {
  title: string;
  url: string;
  courtOrSource?: string;
  decisionDate?: string;
  citation?: string;
  relevantParagraphs?: string;
  legalIssue?: string;
  legalPrinciple?: string;
  outcome?: string;
  sourceTier?: 1 | 2 | 3 | 4 | 5 | 6;
  verificationStatus?: 'verified_primary' | 'verified_legislation' | 'licensed_secondary' | 'verification_pending';
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
  organizationId?: string;
  query: string;
  jurisdiction: JurisdictionMode;
  filters?: {
    court?: string;
    judge?: string;
    statute?: string;
    caseName?: string;
    citation?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  answerMarkdown: string;
  citations: VerifiedCitation[];
  citationIntegrity: CitationIntegritySummary;
  createdAt: string;
}

export interface DraftVersionSnapshot {
  version: number;
  title: string;
  content: string;
  savedAt: string;
  savedBy?: string;
}

export interface DraftDocument {
  id: string;
  matterId: string;
  userId: string;
  organizationId?: string;
  title: string;
  docType: string;
  content: string;
  status?: 'draft' | 'awaiting_review' | 'approved';
  version: number;
  versions?: DraftVersionSnapshot[];
  updatedAt: string;
}

export interface ChronologyEvent {
  date: string;
  event: string;
  sourceDoc: string;
  pageOrPara?: string;
  significance: string;
  userCorrected?: boolean;
}

export interface DocumentEntitySummary {
  parties: string[];
  dates: string[];
  amounts: string[];
  statutes: string[];
  detectedLanguage: string;
  summary: string;
}

export interface ContradictionItem {
  topic: string;
  statementA: string;
  statementB: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export type VaultProcessingStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'review_required'
  | 'completed'
  | 'failed';

export interface VaultDocument {
  id: string;
  matterId: string;
  userId: string;
  organizationId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  docCategory: string;
  processingStatus?: VaultProcessingStatus;
  processingError?: string;
  extractedText: string;
  translatedText: string;
  targetLanguage: string;
  entities?: DocumentEntitySummary;
  chronology: ChronologyEvent[];
  contradictions: ContradictionItem[];
  createdAt: string;
}

export interface RedlineClause {
  id: string;
  clauseRef: string;
  title: string;
  riskCategory?:
    | 'Financial'
    | 'Legal'
    | 'Operational'
    | 'Compliance'
    | 'Confidentiality'
    | 'Intellectual Property'
    | 'Indemnity'
    | 'Termination'
    | 'Liability';
  severity: 'high' | 'medium' | 'low';
  issueSummary: string;
  originalText: string;
  proposedText: string;
  legalRationale: string;
  negotiationNotes?: string;
  decision: 'pending' | 'accepted' | 'rejected';
}

export interface ContractObligation {
  party: string;
  obligation: string;
  dueDateOrTrigger: string;
  category: string;
}

export interface ContractReview {
  id: string;
  matterId: string;
  userId: string;
  organizationId?: string;
  title: string;
  playbook: string;
  sourceText: string;
  summary: string;
  clauses: RedlineClause[];
  requisitions: string[];
  obligations?: ContractObligation[];
  renewalDate?: string;
  terminationNoticeDate?: string;
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
  organization?: Organization;
  organizationMembers?: Array<OrganizationMember & { fullName: string; email: string }>;
  matters: Matter[];
  clients?: ClientProfile[];
  tasks?: MatterTask[];
  hearings?: HearingRecord[];
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
  notifications?: NotificationItem[];
  activityLogs?: ActivityLogItem[];
  subscription?: SubscriptionRecord;
  workflowRuns?: WorkflowRunRecord[];
  corporateProfiles?: CorporateProfileRecord[];
  evidenceItems?: EvidenceItemRecord[];
  litigationStrategies?: LitigationStrategyRecord[];
  storageEngine: 'neon' | 'supabase' | 'local_durable';
  aiEngine?: {
    nvidiaConfigured: boolean;
    geminiConfigured: boolean;
    primaryModel: string;
    fastModel: string;
  };
}
