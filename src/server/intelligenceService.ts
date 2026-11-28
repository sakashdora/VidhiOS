import type {
  JurisdictionMode,
  LitigationStrategyRecord,
  Matter,
  ResearchMemo,
  VaultDocument,
} from '../types/legal';
import { retrieveRelevantPrecedents } from '../lib/legal/supremeCourtCorpus';
import { scanDraftForLegacyCitations } from '../lib/legal/statuteCrosswalk';
import {
  buildSupremeCourtSystemPrompt,
  callNvidiaChat,
  extractJsonFromText,
  getNvidiaConfig,
} from './nvidiaService';

export const SUPPORTED_TRANSLATION_LANGUAGES = [
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
] as const;

export type SupportedTranslationLanguage = (typeof SUPPORTED_TRANSLATION_LANGUAGES)[number];

export interface KnowledgeGraphData {
  nodes: Array<{
    id: string;
    label: string;
    category: 'matter' | 'party' | 'court' | 'statute' | 'judgment' | 'document';
  }>;
  edges: Array<{
    from: string;
    to: string;
    relation: string;
  }>;
}

export function buildMatterKnowledgeGraph(input: {
  matter: Matter | null;
  memos: ResearchMemo[];
  vaultDocuments: VaultDocument[];
}): KnowledgeGraphData {
  const nodes: KnowledgeGraphData['nodes'] = [];
  const edges: KnowledgeGraphData['edges'] = [];
  const seenIds = new Set<string>();

  const addNode = (
    id: string,
    label: string,
    category: KnowledgeGraphData['nodes'][number]['category']
  ) => {
    if (!id || !label || seenIds.has(id)) return;
    seenIds.add(id);
    nodes.push({ id, label, category });
  };

  if (!input.matter) {
    return { nodes, edges };
  }

  const mId = `matter:${input.matter.id}`;
  addNode(mId, `${input.matter.matterCode}: ${input.matter.title}`, 'matter');

  if (input.matter.clientName) {
    const cId = `party:client:${input.matter.clientName}`;
    addNode(cId, input.matter.clientName, 'party');
    edges.push({ from: mId, to: cId, relation: 'client' });
  }
  if (input.matter.opposingParty) {
    const oId = `party:opp:${input.matter.opposingParty}`;
    addNode(oId, input.matter.opposingParty, 'party');
    edges.push({ from: mId, to: oId, relation: 'opposing_party' });
  }
  if (input.matter.forum) {
    const fId = `court:${input.matter.forum}`;
    addNode(fId, input.matter.forum, 'court');
    edges.push({ from: mId, to: fId, relation: 'pending_before' });
  }

  const legacyMatches = scanDraftForLegacyCitations(input.matter.summaryFacts);
  for (const match of legacyMatches.slice(0, 6)) {
    const sId = `statute:${match.mapping.newCode}-${match.mapping.newSection}`;
    addNode(sId, `${match.mapping.newCode} Sec. ${match.mapping.newSection} (${match.mapping.title})`, 'statute');
    edges.push({ from: mId, to: sId, relation: 'invokes_statute' });
  }

  const precedents = retrieveRelevantPrecedents(
    `${input.matter.title} ${input.matter.summaryFacts}`,
    input.matter.jurisdiction,
    4
  );
  for (const p of precedents) {
    const jId = `judgment:${p.id}`;
    addNode(jId, `${p.caseName} (${p.citation})`, 'judgment');
    edges.push({ from: mId, to: jId, relation: 'governed_by_precedent' });
    for (const st of p.statutes.slice(0, 2)) {
      const stId = `statute:${st}`;
      addNode(stId, st, 'statute');
      edges.push({ from: jId, to: stId, relation: 'interprets' });
    }
  }

  for (const memo of input.memos.slice(0, 4)) {
    for (const cit of memo.citations.slice(0, 3)) {
      const jId = `judgment:${cit.title}`;
      addNode(jId, cit.title, 'judgment');
      edges.push({ from: mId, to: jId, relation: 'researched_authority' });
    }
  }

  for (const doc of input.vaultDocuments.slice(0, 6)) {
    const dId = `doc:${doc.id}`;
    addNode(dId, `${doc.fileName} (${doc.docCategory})`, 'document');
    edges.push({ from: mId, to: dId, relation: 'contains_exhibit' });
  }

  return { nodes, edges };
}

export async function generateLitigationStrategy(input: {
  matter: Matter;
  organizationId: string;
  userId: string;
}): Promise<Omit<LitigationStrategyRecord, 'id' | 'updatedAt'>> {
  const precedents = retrieveRelevantPrecedents(
    `${input.matter.title} ${input.matter.summaryFacts}`,
    input.matter.jurisdiction,
    4
  );
  const legacyFlags = scanDraftForLegacyCitations(input.matter.summaryFacts);

  if (getNvidiaConfig().configured) {
    try {
      const res = await callNvidiaChat({
        systemPrompt: buildSupremeCourtSystemPrompt(
          input.matter.jurisdiction,
          'Prepare a structured Litigation Strategy Board as valid JSON with keys: "caseTheory" (string), "legalIssues" (string[]), "supportingFacts" (string[]), "adverseFacts" (string[]), "supportingPrecedents" (string[]), "weaknesses" (string[]), "evidenceRequirements" (string[]), "crossExamQuestions" (string[]).'
        ),
        userPrompt: `Matter: ${input.matter.title} (${input.matter.matterCode})\nForum: ${input.matter.forum}\nClient: ${input.matter.clientName}\nOpposing: ${input.matter.opposingParty}\nFacts:\n${input.matter.summaryFacts}\n\nVerified Precedents:\n${precedents.map((p) => `- ${p.caseName} (${p.citation}): ${p.ratio}`).join('\n')}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 1800,
      });
      const parsed = extractJsonFromText<Partial<LitigationStrategyRecord>>(res.text);
      return {
        organizationId: input.organizationId,
        matterId: input.matter.id,
        userId: input.userId,
        caseTheory: parsed.caseTheory || 'Primary theory anchored in documentary chronology and statutory compliance.',
        legalIssues: parsed.legalIssues ?? [],
        supportingFacts: parsed.supportingFacts ?? [],
        adverseFacts: parsed.adverseFacts ?? [],
        supportingPrecedents:
          parsed.supportingPrecedents ?? precedents.map((p) => `${p.caseName} (${p.citation})`),
        weaknesses: parsed.weaknesses ?? [],
        evidenceRequirements: parsed.evidenceRequirements ?? [],
        crossExamQuestions: parsed.crossExamQuestions ?? [],
        aiGeneratedDisclaimer:
          'AI-generated strategic analysis. Verify all authorities, factual citations, and procedural strategy independently before court submissions.',
      };
    } catch {
      // Fallback below
    }
  }

  return {
    organizationId: input.organizationId,
    matterId: input.matter.id,
    userId: input.userId,
    caseTheory: `Establish maintainable relief before ${input.matter.forum} on behalf of ${input.matter.clientName} by anchoring documentary records and statutory compliance under current BNS/BNSS/BSA 2023 and commercial statutes.`,
    legalIssues: [
      `Whether ${input.matter.forum} has territorial and subject-matter jurisdiction.`,
      'Whether statutory preconditions (notice, arbitration clause, or preliminary inquiry) were satisfied.',
      ...(legacyFlags.length > 0
        ? [`Transitional application of ${legacyFlags.map((f) => f.mapping.newCode + ' ' + f.mapping.newSection).join(', ')}.`]
        : []),
    ],
    supportingFacts: [
      input.matter.summaryFacts.slice(0, 260) || 'Documentary record filed on docket.',
    ],
    adverseFacts: [
      `Potential counter-allegations raised by ${input.matter.opposingParty || 'Opposing Party'} requiring documentary rebuttal.`,
    ],
    supportingPrecedents: precedents.map((p) => `${p.caseName} (${p.citation}) — ${p.ratio}`),
    weaknesses: [
      'Admissibility of uncertified electronic communications unless accompanied by Sec. 63(4) BSA certificate.',
      'Limitation and delay objections if trigger dates are not proved via certified copies.',
    ],
    evidenceRequirements: [
      'Sworn Order XIX Rule 3 CPC Affidavit distinguishing personal knowledge vs legal advice.',
      'Section 63 BSA Certificate (Schedule Part A & B) for emails/WhatsApp/ledgers.',
      'Paginated List of Dates & Chronology with certified annexures.',
    ],
    crossExamQuestions: [
      'Confirm exact dates of written notices and commercial correspondence prior to criminal/litigation escalation.',
      'Identify the custodian and hash integrity of electronic records relied upon.',
    ],
    aiGeneratedDisclaimer:
      'AI-generated strategic analysis. Verify all authorities, factual citations, and procedural strategy independently before court submissions.',
  };
}

export async function translateLegalContent(input: {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: SupportedTranslationLanguage;
  jurisdiction: JurisdictionMode;
}): Promise<{
  translatedText: string;
  segments: Array<{ original: string; translated: string }>;
  terminologyNotes: string[];
  qualityWarning: string;
}> {
  const paragraphs = input.sourceText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (getNvidiaConfig().configured) {
    try {
      const res = await callNvidiaChat({
        systemPrompt: buildSupremeCourtSystemPrompt(
          input.jurisdiction,
          `You are a certified Indian Legal Translator. Translate accurately from ${input.sourceLanguage} to ${input.targetLanguage}, preserving exact section numbers, case names, monetary figures, dates, and legal terms of art.
Return ONLY valid JSON:
{
  "translatedText": "full translated text",
  "segments": [{"original": "...", "translated": "..."}],
  "terminologyNotes": ["key legal term mappings preserved"]
}`
        ),
        userPrompt: `Target Language: ${input.targetLanguage}\n\nLegal Text:\n${input.sourceText.slice(0, 14000)}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 2600,
      });
      const parsed = extractJsonFromText<{
        translatedText?: string;
        segments?: Array<{ original: string; translated: string }>;
        terminologyNotes?: string[];
      }>(res.text);
      return {
        translatedText: parsed.translatedText || '',
        segments:
          Array.isArray(parsed.segments) && parsed.segments.length > 0
            ? parsed.segments
            : paragraphs.map((p) => ({ original: p, translated: parsed.translatedText || p })),
        terminologyNotes: parsed.terminologyNotes ?? [],
        qualityWarning:
          'Machine-assisted legal translation. Advocate verification is required before filing translated annexures in court.',
      };
    } catch {
      // Fall through to honest unconfigured warning
    }
  }

  return {
    translatedText: input.sourceText,
    segments: paragraphs.map((p) => ({
      original: p,
      translated: `[Translation to ${input.targetLanguage} requires live AI translation key — original text preserved for manual edit]\n${p}`,
    })),
    terminologyNotes: [
      'Original statutory numbers, case titles, and monetary amounts preserved without modification.',
    ],
    qualityWarning:
      'Translation engine unavailable or unconfigured; side-by-side manual correction mode active. Configure NVIDIA_API_KEY for automated translation.',
  };
}
