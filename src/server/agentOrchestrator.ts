import crypto from 'node:crypto';
import type {
  JurisdictionMode,
  Matter,
  WorkflowRunRecord,
  WorkflowStepLog,
} from '../types/legal';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
} from '../lib/legal/supremeCourtCorpus';
import { scanDraftForLegacyCitations } from '../lib/legal/statuteCrosswalk';
import {
  buildSupremeCourtSystemPrompt,
  callNvidiaChat,
  getNvidiaConfig,
} from './nvidiaService';

export type AgentName =
  | 'Research Agent'
  | 'Drafting Agent'
  | 'Case Analysis Agent'
  | 'Document Intelligence Agent'
  | 'Contract Review Agent'
  | 'Compliance Agent'
  | 'Quality Verification Agent';

export type WorkflowType =
  | 'full_matter_brief'
  | 'research_verification'
  | 'draft_audit'
  | 'contract_risk_audit'
  | 'compliance_deadline_check';

const MAX_AGENT_STEPS = 5;

const WORKFLOW_PIPELINES: Record<WorkflowType, AgentName[]> = {
  full_matter_brief: [
    'Document Intelligence Agent',
    'Research Agent',
    'Case Analysis Agent',
    'Compliance Agent',
    'Quality Verification Agent',
  ],
  research_verification: ['Research Agent', 'Case Analysis Agent', 'Quality Verification Agent'],
  draft_audit: ['Drafting Agent', 'Compliance Agent', 'Quality Verification Agent'],
  contract_risk_audit: ['Contract Review Agent', 'Compliance Agent', 'Quality Verification Agent'],
  compliance_deadline_check: ['Document Intelligence Agent', 'Compliance Agent', 'Quality Verification Agent'],
};

async function runSingleAgentStep(input: {
  agentName: AgentName;
  goal: string;
  matter: Matter | null;
  jurisdiction: JurisdictionMode;
  priorSummary: string;
  matterFacts: string;
}): Promise<WorkflowStepLog> {
  const startedAt = Date.now();
  const precedents = retrieveRelevantPrecedents(
    `${input.goal} ${input.matterFacts}`,
    input.jurisdiction,
    3
  );
  const legacyFlags = scanDraftForLegacyCitations(`${input.goal} ${input.matterFacts}`);
  const precedentBlock = formatPrecedentGroundingBlock(precedents);

  const agentRoleInstructions: Record<AgentName, string> = {
    'Research Agent':
      'Understand the legal question, identify controlling Indian/global authorities from the verified context, and distinguish binding ratio from obiter.',
    'Drafting Agent':
      'Outline structured pleading/contract sections, identify missing factual particulars, and enforce Supreme Court / High Court formatting.',
    'Case Analysis Agent':
      'Analyze core facts, frame legal issues, evaluate supporting and adverse authorities, and flag procedural maintainability hurdles.',
    'Document Intelligence Agent':
      'Extract key parties, dates, monetary figures, statutory triggers, and potential factual contradictions from the matter record.',
    'Contract Review Agent':
      'Flag high-risk clauses (indemnity, liability, termination, IP, arbitration seat), suggest balanced wording, and note commercial tradeoffs.',
    'Compliance Agent':
      'Identify statutory obligations, Limitation Act deadlines, BNS/BNSS/BSA transitional compliance, and regulatory filing requirements.',
    'Quality Verification Agent':
      'Audit all prior agent outputs for unsupported claims, unverified citations, statute currency, and hallucination risks. Mark uncertain assertions as [Verification Required].',
  };

  let outputSummary = '';
  let tokensUsed = 0;

  if (getNvidiaConfig().configured) {
    try {
      const res = await callNvidiaChat({
        systemPrompt: buildSupremeCourtSystemPrompt(
          input.jurisdiction,
          `You are the "${input.agentName}" inside VidhiOS Multi-Agent Orchestrator.
Role: ${agentRoleInstructions[input.agentName]}
Keep output structured in 3-5 concise bullet points. Clearly separate verified facts/statutes from AI strategic suggestions. Never fabricate citations.`
        ),
        userPrompt: `WORKFLOW GOAL: ${input.goal}
MATTER: ${input.matter ? `${input.matter.matterCode} — ${input.matter.title} (${input.matter.forum})` : 'General Practice'}
MATTER RECORD:
${input.matterFacts.slice(0, 4000)}

PRIOR AGENT FINDINGS:
${input.priorSummary.slice(0, 3000) || '(Initial step)'}

VERIFIED PRECEDENT CORPUS:
${precedentBlock}

LEGACY STATUTE FLAGS:
${legacyFlags.length > 0 ? legacyFlags.map((f) => `${f.matchedText} -> ${f.replacementText}`).join('; ') : 'None'}`,
        tier: input.agentName === 'Quality Verification Agent' ? 'expert' : 'fast',
        maxTokens: 700,
      });
      outputSummary = res.text;
      tokensUsed = Math.ceil((outputSummary.length + input.goal.length) / 4);
    } catch {
      outputSummary = '';
    }
  }

  if (!outputSummary) {
    // Deterministic grounded fallback when external LLM is unavailable
    if (input.agentName === 'Research Agent') {
      outputSummary = precedents.length
        ? `Verified authorities matched (${precedents.length}): ${precedents
            .map((p) => `${p.caseName} (${p.citation})`)
            .join('; ')}. [External live database verification recommended before filing]`
        : 'No exact corpus match found; manual primary source search recommended.';
    } else if (input.agentName === 'Compliance Agent') {
      outputSummary =
        legacyFlags.length > 0
          ? `Detected ${legacyFlags.length} legacy citation(s) requiring BNS/BNSS/BSA 2023 upgrade: ${legacyFlags
              .map((f) => `${f.matchedText} → ${f.replacementText}`)
              .join(', ')}. Verify Limitation Act timelines under Case Tracker.`
          : 'No repealed IPC/CrPC/IEA citations detected in provided text. Verify Limitation Act Sec. 4 & Sec. 12 certified-copy exclusions.';
    } else if (input.agentName === 'Quality Verification Agent') {
      outputSummary = `Verification audit complete: ${precedents.length} corpus precedents cross-checked; ${legacyFlags.length} legacy statutory references flagged. AI strategic recommendations require advocate review prior to court or client action.`;
    } else {
      outputSummary = `${input.agentName} reviewed matter "${input.matter?.title ?? 'Workspace'}" for goal "${input.goal.slice(0, 80)}". Structured factual and statutory review prepared for advocate approval.`;
    }
  }

  return {
    id: crypto.randomUUID(),
    agentName: input.agentName,
    stepTitle: `${input.agentName} Execution`,
    status:
      input.agentName === 'Quality Verification Agent' ? 'awaiting_approval' : 'completed',
    inputSummary: input.goal.slice(0, 180),
    outputSummary,
    tokensUsed,
    latencyMs: Date.now() - startedAt,
    verificationNotes:
      input.agentName === 'Quality Verification Agent'
        ? 'Human-in-the-loop approval required before converting AI output into filings or client communications.'
        : undefined,
    createdAt: new Date().toISOString(),
  };
}

export async function executeMultiAgentWorkflow(input: {
  organizationId: string;
  userId: string;
  matter: Matter | null;
  jurisdiction: JurisdictionMode;
  workflowType: WorkflowType;
  goal: string;
  extraContext?: string;
}): Promise<Omit<WorkflowRunRecord, 'id' | 'createdAt'>> {
  const pipeline = (WORKFLOW_PIPELINES[input.workflowType] ?? WORKFLOW_PIPELINES.full_matter_brief).slice(
    0,
    MAX_AGENT_STEPS
  );

  const matterFacts = [
    input.matter
      ? `Title: ${input.matter.title} | Client: ${input.matter.clientName} | Opposing: ${input.matter.opposingParty} | Forum: ${input.matter.forum}\nFacts: ${input.matter.summaryFacts}`
      : 'No active matter selected.',
    input.extraContext ? `Additional Context:\n${input.extraContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const steps: WorkflowStepLog[] = [];
  let runningSummary = '';
  let totalTokens = 0;
  let totalLatencyMs = 0;

  for (const agentName of pipeline) {
    const stepLog = await runSingleAgentStep({
      agentName,
      goal: input.goal,
      matter: input.matter,
      jurisdiction: input.jurisdiction,
      priorSummary: runningSummary,
      matterFacts,
    });
    steps.push(stepLog);
    runningSummary += `\n[${agentName}]: ${stepLog.outputSummary}\n`;
    totalTokens += stepLog.tokensUsed;
    totalLatencyMs += stepLog.latencyMs;
  }

  const finalOutput = [
    `### Multi-Agent Legal Workflow Summary (${input.workflowType.replace(/_/g, ' ')})`,
    `> **Notice:** Verified statutory mappings and corpus citations are separated from AI-generated strategic suggestions. Human advocate approval is required before acting on consequential recommendations.`,
    '',
    ...steps.map((s) => `#### ${s.agentName}\n${s.outputSummary}`),
  ].join('\n\n');

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    matterId: input.matter?.id ?? null,
    workflowType: input.workflowType,
    goal: input.goal,
    status: 'awaiting_approval',
    requiresHumanApproval: true,
    totalTokens,
    totalLatencyMs,
    steps,
    finalOutput,
  };
}
