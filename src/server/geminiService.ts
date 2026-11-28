import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChronologyEvent,
  CitationIntegritySummary,
  ContradictionItem,
  CourtroomTurn,
  JurisdictionMode,
  RedlineClause,
  VerifiedCitation,
} from '../types/legal';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
} from '../lib/legal/supremeCourtCorpus';
import {
  buildSupremeCourtSystemPrompt,
  callNvidiaChat,
  extractJsonFromText,
  getNvidiaConfig,
  streamNvidiaChat,
} from './nvidiaService';
import {
  fetchRealtimeLegalData,
  type LegalSearchFilters,
  type PrecedentConflictItem,
} from './realtimeLegalSearch';
import {
  formatAiMarkdownResponse,
  formatPlainCourtDocument,
  stripMarkdownForPlainText,
} from '../lib/legal/responseFormatter';

const TEXT_MODEL = 'gemini-4-hydrogen';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

export function isGeminiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY ?? '').trim();
  return Boolean(key && !key.startsWith('MY_') && key.length > 5);
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('MY_')) {
    throw new Error(
      'AI provider key is not configured. Add NVIDIA_API_KEY (or GEMINI_API_KEY) in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function jurisdictionInstruction(mode: JurisdictionMode): string {
  switch (mode) {
    case 'india_litigation':
      return 'Jurisdiction: Republic of India (Supreme Court of India, High Courts, District Courts, NCLT/NCLAT, Consumer Commissions). Always cite Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), and Bharatiya Sakshya Adhiniyam (BSA 2023) alongside legacy IPC/CrPC/IEA equivalents where relevant. Never fabricate case citations.';
    case 'corporate_ma':
      return 'Jurisdiction & Practice: Corporate M&A, Private Equity, Venture Capital, and Commercial Contracting (Companies Act 2013, Indian Contract Act 1872, Arbitration & Conciliation Act 1996, FEMA/RBI/SEBI, plus international M&A standards). Focus on commercial risk allocation, enforceability, and indemnity caps.';
    case 'global_multi':
      return 'Jurisdiction: Global Multi-Jurisdiction & Cross-Border Arbitration (English Common Law, US Federal/Delaware, EU/GDPR, Singapore/SIAC, ICC, UNCITRAL Model Law, New York Convention enforcement). Provide comparative clarity across jurisdictions.';
  }
}

function sanitizeSafeUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export async function runGroundedLegalResearch(input: {
  query: string;
  jurisdiction: JurisdictionMode;
  matterContext: string;
  tier?: 'fast' | 'expert';
  filters?: LegalSearchFilters;
}): Promise<{
  answerMarkdown: string;
  citations: VerifiedCitation[];
  conflicts: PrecedentConflictItem[];
  citationIntegrity: CitationIntegritySummary;
}> {
  const realtime = await fetchRealtimeLegalData(
    input.query,
    input.jurisdiction,
    input.matterContext,
    input.filters
  );

  // Primary high-speed path: NVIDIA NIM with Supreme Court / High Court precedent grounding
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        `Prepare a crisp, publication-grade IRAC Supreme Court / High Court Legal Research Memorandum using ONLY these clean Markdown headings:
### Executive Conclusion
### Statutory Framework & BNS/BNSS/BSA Alignment
### Controlling Precedents
### Application to Active Matter
### Strategic Recommendation & Counter-Arguments
Keep bullets tight and actionable, cite exact verified case names and section numbers inline, distinguish primary verified authorities from unverified search leads, and never include preambles, horizontal rules (---), or code fences.`
      );
      const contextParts = [
        `ACTIVE MATTER CONTEXT:\n${input.matterContext}`,
        `LEGAL RESEARCH QUERY:\n${input.query}`,
      ];
      if (realtime.statutoryGroundingText) {
        contextParts.push(realtime.statutoryGroundingText);
      }
      if (realtime.precedentGroundingText) {
        contextParts.push(realtime.precedentGroundingText);
      }
      const userPrompt = contextParts.join('\n\n');
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt,
        tier: input.tier ?? 'fast',
        maxTokens: 2800,
      });

      return {
        answerMarkdown: formatAiMarkdownResponse(res.text),
        citations: realtime.citations,
        conflicts: realtime.conflicts,
        citationIntegrity: {
          verifiedSourceCount: realtime.citations.filter(
            (c) => c.verificationStatus !== 'verification_pending'
          ).length,
          jurisdictionChecked:
            input.jurisdiction === 'india_litigation'
              ? `NVIDIA NIM (${res.model}) · Source Hierarchy & BNS/BNSS/BSA`
              : input.jurisdiction === 'corporate_ma'
                ? `NVIDIA NIM (${res.model}) · Corporate, M&A & Commercial Statutes`
                : `NVIDIA NIM (${res.model}) · International Arbitration & Multi-Jurisdiction`,
          bnsComplianceNote:
            input.jurisdiction === 'india_litigation'
              ? `Generated in ${res.latencyMs}ms with primary-source hierarchy check.`
              : `Generated in ${res.latencyMs}ms with commercial currency check.`,
          confidenceLabel: 'Grounded via Web & Statute',
        },
      };
    } catch {
      // Fall through to Gemini if configured
    }
  }

  // Deterministic fallback if neither NVIDIA nor Gemini key is configured
  if (!isGeminiConfigured()) {
    const fallbackMd = [
      '### Executive Conclusion',
      `Research query analysed against VidhiOS verified Supreme Court / High Court corpus and statutory crosswalk (${realtime.citations.length} source(s) matched). Live AI synthesis requires NVIDIA_API_KEY or GEMINI_API_KEY.`,
      '',
      '### Statutory Framework & BNS/BNSS/BSA Alignment',
      realtime.statutoryGroundingText || 'No specific legacy IPC/CrPC/IEA section detected in query.',
      '',
      '### Controlling Precedents',
      realtime.precedentGroundingText || 'No exact corpus match; inspect primary court databases.',
    ].join('\n');

    return {
      answerMarkdown: formatAiMarkdownResponse(fallbackMd),
      citations: realtime.citations,
      conflicts: realtime.conflicts,
      citationIntegrity: {
        verifiedSourceCount: realtime.citations.filter(
          (c) => c.verificationStatus !== 'verification_pending'
        ).length,
        jurisdictionChecked: 'VidhiOS Deterministic Corpus & Statute Crosswalk',
        bnsComplianceNote: 'Verified against local statutory crosswalk & SC/HC corpus.',
        confidenceLabel: 'Statutory Analysis Only',
      },
    };
  }

  const ai = getAiClient();
  const prompt = `Active Matter Context:\n${input.matterContext}\n\nLegal Research Query:\n${input.query}\n\n${realtime.precedentGroundingText}\n\nProvide a rigorous, structured legal research memorandum using ONLY clean Markdown headings (### Executive Conclusion, ### Statutory Framework, ### Controlling Precedents, ### Application to Active Matter, ### Strategic Recommendation). Only cite real, verifiable authorities and statutes. Flag post-July 2024 BNS/BNSS/BSA updates where applicable. Do not include preambles or --- dividers.`;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are a Senior Legal Research Partner in VidhiOS. ${jurisdictionInstruction(input.jurisdiction)} Ground your analysis with real authorities, avoid hallucinating citations, and write crisp editorial Markdown with zero conversational filler.`,
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seenUrls = new Set<string>();
  const citations: VerifiedCitation[] = [...realtime.citations];

  for (const chunk of chunks) {
    const web = chunk.web;
    const safeUrl = sanitizeSafeUrl(web?.uri);
    if (safeUrl && !seenUrls.has(safeUrl)) {
      seenUrls.add(safeUrl);
      let host = 'Verified Web Source';
      try {
        host = new URL(safeUrl).hostname.replace(/^www\./, '');
      } catch {
        // fallback label
      }
      citations.push({
        title: web?.title?.trim() || host,
        url: safeUrl,
        courtOrSource: host,
        sourceTier: 5,
        verificationStatus: 'verification_pending',
        status: 'verified_web',
      });
    }
  }

  return {
    answerMarkdown: formatAiMarkdownResponse(response.text?.trim() || 'No research output returned.'),
    citations,
    conflicts: realtime.conflicts,
    citationIntegrity: {
      verifiedSourceCount: citations.filter((c) => c.verificationStatus !== 'verification_pending').length,
      jurisdictionChecked:
        input.jurisdiction === 'india_litigation'
          ? 'Indian Courts & BNS/BNSS/BSA Statutes'
          : input.jurisdiction === 'corporate_ma'
            ? 'Corporate, M&A & Commercial Statutes'
            : 'Multi-Jurisdiction & International Arbitration',
      bnsComplianceNote:
        input.jurisdiction === 'india_litigation'
          ? 'Reviewed for BNS 2023 / BNSS 2023 / BSA 2023 alignment.'
          : 'Reviewed for commercial enforceability & statutory currency.',
      confidenceLabel:
        citations.length > 0 ? 'Grounded via Web & Statute' : 'Statutory Analysis Only',
    },
  };
}

export async function streamGroundedLegalResearch(
  input: {
    query: string;
    jurisdiction: JurisdictionMode;
    matterContext: string;
    tier?: 'fast' | 'expert';
    filters?: LegalSearchFilters;
  },
  onEvent: (event: {
    type: 'stage' | 'authorities' | 'chunk';
    data: any;
  }) => void
): Promise<{
  answerMarkdown: string;
  citations: VerifiedCitation[];
  conflicts: PrecedentConflictItem[];
  citationIntegrity: CitationIntegritySummary;
}> {
  onEvent({
    type: 'stage',
    data: {
      stage: 'fetching_realtime',
      label: 'Planning query, checking statutory crosswalk & primary court hierarchy...',
    },
  });

  const realtime = await fetchRealtimeLegalData(
    input.query,
    input.jurisdiction,
    input.matterContext,
    input.filters
  );

  onEvent({
    type: 'authorities',
    data: {
      authorities: realtime.liveAuthorities,
      citations: realtime.citations,
      conflicts: realtime.conflicts,
    },
  });

  const tier = input.tier ?? 'fast';
  onEvent({
    type: 'stage',
    data: {
      stage: 'generating_memo',
      label: `Synthesizing real-time IRAC research memorandum with ${
        tier === 'fast' ? 'Nemotron Lightning (Low Latency)' : 'Mistral Large (Deep Precision)'
      }...`,
    },
  });

  const systemPrompt = buildSupremeCourtSystemPrompt(
    input.jurisdiction,
    `Prepare a crisp, publication-grade IRAC Supreme Court / High Court Legal Research Memorandum using ONLY these clean Markdown headings:
### Executive Conclusion
### Statutory Framework & BNS/BNSS/BSA Alignment
### Controlling Precedents
### Application to Active Matter
### Strategic Recommendation & Counter-Arguments
Keep bullets tight and actionable, cite exact verified case names and section numbers inline, and never include preambles, horizontal rules (---), or code fences.`
  );

  const contextParts = [
    `ACTIVE MATTER CONTEXT:\n${input.matterContext}`,
    `LEGAL RESEARCH QUERY:\n${input.query}`,
  ];
  if (realtime.statutoryGroundingText) {
    contextParts.push(realtime.statutoryGroundingText);
  }
  if (realtime.precedentGroundingText) {
    contextParts.push(realtime.precedentGroundingText);
  }

  const userPrompt = contextParts.join('\n\n');

  if (getNvidiaConfig().configured) {
    try {
      const res = await streamNvidiaChat(
        {
          systemPrompt,
          userPrompt,
          tier,
          maxTokens: 2800,
        },
        (delta) => {
          onEvent({ type: 'chunk', data: { delta } });
        }
      );

      const cleanedText = formatAiMarkdownResponse(res.fullText);

      return {
        answerMarkdown: cleanedText,
        citations: realtime.citations,
        conflicts: realtime.conflicts,
        citationIntegrity: {
          verifiedSourceCount: realtime.citations.filter(
            (c) => c.verificationStatus !== 'verification_pending'
          ).length,
          jurisdictionChecked:
            input.jurisdiction === 'india_litigation'
              ? `NVIDIA NIM (${res.model}) · Source Hierarchy & BNS/BNSS/BSA`
              : input.jurisdiction === 'corporate_ma'
                ? `NVIDIA NIM (${res.model}) · Corporate & Commercial Enforceability`
                : `NVIDIA NIM (${res.model}) · International Arbitration & New York Convention`,
          bnsComplianceNote:
            input.jurisdiction === 'india_litigation'
              ? `Generated in ${res.latencyMs}ms with live statutory crosswalk verification.`
              : `Generated in ${res.latencyMs}ms with commercial statutory currency check.`,
          confidenceLabel: 'Grounded via Web & Statute',
        },
      };
    } catch {
      // Fall through to non-streaming fallback
    }
  }

  const fallback = await runGroundedLegalResearch(input);
  onEvent({ type: 'chunk', data: { delta: fallback.answerMarkdown } });
  return fallback;
}

export async function generateLegalDraft(input: {
  docType: string;
  instructions: string;
  jurisdiction: JurisdictionMode;
  matterContext: string;
}): Promise<string> {
  const precedents = retrieveRelevantPrecedents(
    `${input.docType} ${input.instructions} ${input.matterContext}`,
    input.jurisdiction,
    3
  );
  const precedentBlock = formatPrecedentGroundingBlock(precedents);

  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'Draft a complete, court-filing-ready or execution-ready legal document strictly formatted to Supreme Court Rules 2013 / High Court Registry standards with Cause Title, numbered paragraphs, statutory references, Prayer, and Verification/Affidavit block where applicable. Output clean plain text with no markdown code fences.'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `DOCUMENT TYPE: ${input.docType}\nACTIVE MATTER CONTEXT:\n${input.matterContext}\n\nSPECIFIC DRAFTING INSTRUCTIONS:\n${input.instructions}\n\n${precedentBlock}`,
        tier: 'expert',
        maxTokens: 3200,
      });
      return formatPlainCourtDocument(res.text);
    } catch {
      // Fallback to Gemini
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Document Type: ${input.docType}\nActive Matter Context:\n${input.matterContext}\n\nSpecific Drafting Instructions:\n${input.instructions}\n\n${precedentBlock}\n\nDraft a complete, court-ready or execution-ready legal document with numbered paragraphs, formal headings, statutory references, and prayers/signature blocks as appropriate.`,
    config: {
      systemInstruction: `You are an elite Senior Advocate and Transactional Drafting Counsel. ${jurisdictionInstruction(input.jurisdiction)} Output clean plain text formatted for a legal editor (ZERO markdown syntax such as **, ###, or code fences).`,
    },
  });
  return formatPlainCourtDocument(response.text?.trim() || '');
}

export async function rewriteDraftSelection(input: {
  selection: string;
  instruction: string;
  jurisdiction: JurisdictionMode;
}): Promise<string> {
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are a precision Supreme Court / High Court legal editor. Preserve defined terms, paragraph numbering, and statutory precision. Return ONLY the replacement plain legal text without preamble or markdown symbols.'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Selected Legal Paragraph/Clause:\n"""\n${input.selection}\n"""\n\nEditing Instruction: ${input.instruction}\n\nReturn ONLY the revised legal text ready to replace the selection directly.`,
        tier: 'fast',
        maxTokens: 1400,
        useCache: false,
      });
      return formatPlainCourtDocument(res.text);
    } catch {
      // Fallback to Gemini
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Selected Legal Paragraph/Clause:\n"""\n${input.selection}\n"""\n\nEditing Instruction: ${input.instruction}\n\nReturn ONLY the revised legal text ready to replace the selection directly.`,
    config: {
      systemInstruction: `You are a precision legal editor. ${jurisdictionInstruction(input.jurisdiction)} Preserve defined terms and legal precision. Return only the replacement plain text without preamble or markdown symbols.`,
    },
  });
  return formatPlainCourtDocument(response.text?.trim() || input.selection);
}

export async function runCourtroomTurn(input: {
  mode: 'bench' | 'opposing_counsel';
  forumContext: string;
  briefExcerpt: string;
  history: CourtroomTurn[];
  userSubmission: string;
  jurisdiction: JurisdictionMode;
}): Promise<{
  replyMessage: string;
  weaknessFlag: string;
  suggestedRebuttal: string;
  authorities: string[];
}> {
  const persona =
    input.mode === 'bench'
      ? 'a sharp, demanding Senior Judge on the Supreme Court / High Court Bench probing maintainability, jurisdictional limits, suppression of facts, and binding precedent'
      : 'an aggressive, highly prepared Opposing Senior Counsel tearing apart evidentiary gaps, statutory defects, and limitation hurdles';

  const transcriptText = input.history
    .slice(-8)
    .map((t) => `${t.speaker.toUpperCase()}: ${t.message}`)
    .join('\n\n');

  const precedents = retrieveRelevantPrecedents(
    `${input.briefExcerpt} ${input.userSubmission}`,
    input.jurisdiction,
    3
  );
  const precedentBlock = formatPrecedentGroundingBlock(precedents);

  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        `Act as ${persona} in a courtroom argument simulator. Respond in character AND return coaching notes strictly as valid JSON with keys: "replyMessage" (string), "weaknessFlag" (string), "suggestedRebuttal" (string), "authorities" (array of 2-3 verified case/statute strings).`
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Forum: ${input.forumContext}\nMatter/Brief Summary:\n${input.briefExcerpt}\n\nPrior Exchange:\n${transcriptText || '(Opening submission)'}\n\nCounsel's Latest Submission:\n${input.userSubmission}\n\n${precedentBlock}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 1600,
        useCache: false,
      });
      const parsed = extractJsonFromText<{
        replyMessage?: string;
        weaknessFlag?: string;
        suggestedRebuttal?: string;
        authorities?: string[];
      }>(res.text);
      return {
        replyMessage: stripMarkdownForPlainText(
          parsed.replyMessage || 'Counsel, please clarify your primary statutory ground.'
        ),
        weaknessFlag: stripMarkdownForPlainText(
          parsed.weaknessFlag || 'Clarify evidentiary linkage to statutory ingredients.'
        ),
        suggestedRebuttal: stripMarkdownForPlainText(
          parsed.suggestedRebuttal ||
            'Address the factual record chronologically with annexure page citations.'
        ),
        authorities: (parsed.authorities ?? precedents.map((p) => `${p.caseName}, ${p.citation}`)).map(
          (a) => stripMarkdownForPlainText(a)
        ),
      };
    } catch {
      // Fall through to Gemini
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Forum: ${input.forumContext}\nMatter/Brief Summary:\n${input.briefExcerpt}\n\nPrior Exchange:\n${transcriptText || '(Opening submission)'}\n\nCounsel's Latest Submission:\n${input.userSubmission}\n\n${precedentBlock}`,
    config: {
      systemInstruction: `You are acting as ${persona} in a courtroom argument simulator. ${jurisdictionInstruction(input.jurisdiction)} Respond in character with a piercing question or counter-argument, AND provide structured coaching notes (the exact vulnerability exposed, a tight courtroom rebuttal counsel can use, and 2-3 real statutory/case authorities).`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replyMessage: {
            type: Type.STRING,
            description: 'The in-character courtroom question from the Bench or counter-argument from Opposing Counsel.',
          },
          weaknessFlag: {
            type: Type.STRING,
            description: 'Concise diagnosis of the vulnerability in counsel’s position.',
          },
          suggestedRebuttal: {
            type: Type.STRING,
            description: 'A crisp, persuasive courtroom response counsel can deliver next.',
          },
          authorities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-3 relevant real statutes or leading judicial precedents.',
          },
        },
        required: ['replyMessage', 'weaknessFlag', 'suggestedRebuttal', 'authorities'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    replyMessage?: string;
    weaknessFlag?: string;
    suggestedRebuttal?: string;
    authorities?: string[];
  };

  return {
    replyMessage: stripMarkdownForPlainText(
      parsed.replyMessage || 'Counsel, please clarify your primary statutory ground.'
    ),
    weaknessFlag: stripMarkdownForPlainText(
      parsed.weaknessFlag || 'Clarify evidentiary linkage to statutory ingredients.'
    ),
    suggestedRebuttal: stripMarkdownForPlainText(
      parsed.suggestedRebuttal ||
        'Address the factual record chronologically with annexure page citations.'
    ),
    authorities: (parsed.authorities ?? []).map((a) => stripMarkdownForPlainText(a)),
  };
}

export async function analyzeContractRedline(input: {
  title: string;
  playbook: string;
  contractText: string;
  jurisdiction: JurisdictionMode;
}): Promise<{
  summary: string;
  clauses: RedlineClause[];
  requisitions: string[];
}> {
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are a Principal M&A and Commercial Contracting Partner. Audit the contract against the specified playbook. Return ONLY valid JSON with keys: "summary" (string), "clauses" (array of 3-6 objects with clauseRef, title, severity ("high"|"medium"|"low"), issueSummary, originalText, proposedText, legalRationale), and "requisitions" (string array).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Contract Title: ${input.title}\nReview Playbook: ${input.playbook}\n\nContract Text:\n${input.contractText.slice(0, 30000)}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 3000,
      });
      const parsed = extractJsonFromText<{
        summary?: string;
        clauses?: Array<Omit<RedlineClause, 'id' | 'decision'>>;
        requisitions?: string[];
      }>(res.text);
      const clauses: RedlineClause[] = (parsed.clauses ?? []).map((cl, idx) => ({
        ...cl,
        id: `cl_${Date.now()}_${idx}`,
        severity:
          cl.severity === 'high' || cl.severity === 'medium' || cl.severity === 'low'
            ? cl.severity
            : 'medium',
        decision: 'pending',
      }));
      return {
        summary: parsed.summary || 'Contract review completed via NVIDIA NIM.',
        clauses,
        requisitions: parsed.requisitions ?? [],
      };
    } catch {
      // Fallback to Gemini
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Contract Title: ${input.title}\nReview Playbook: ${input.playbook}\n\nContract Text:\n${input.contractText.slice(0, 35000)}`,
    config: {
      systemInstruction: `You are a Principal M&A and Commercial Contracting Partner. ${jurisdictionInstruction(input.jurisdiction)} Audit the contract against the specified playbook. Identify 3 to 6 concrete high/medium/low risk clauses, quote the exact original clause text, draft a balanced market-standard redlined replacement clause, explain the legal rationale, and list due diligence requisitions.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          clauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clauseRef: { type: Type.STRING },
                title: { type: Type.STRING },
                severity: { type: Type.STRING, description: 'high, medium, or low' },
                issueSummary: { type: Type.STRING },
                originalText: { type: Type.STRING },
                proposedText: { type: Type.STRING },
                legalRationale: { type: Type.STRING },
              },
              required: [
                'clauseRef',
                'title',
                'severity',
                'issueSummary',
                'originalText',
                'proposedText',
                'legalRationale',
              ],
            },
          },
          requisitions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['summary', 'clauses', 'requisitions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    summary?: string;
    clauses?: Array<Omit<RedlineClause, 'id' | 'decision'>>;
    requisitions?: string[];
  };

  const clauses: RedlineClause[] = (parsed.clauses ?? []).map((cl, idx) => ({
    ...cl,
    id: `cl_${Date.now()}_${idx}`,
    severity:
      cl.severity === 'high' || cl.severity === 'medium' || cl.severity === 'low'
        ? cl.severity
        : 'medium',
    decision: 'pending',
  }));

  return {
    summary: parsed.summary || 'Contract review completed.',
    clauses,
    requisitions: parsed.requisitions ?? [],
  };
}

function extractDeterministicEntities(text: string, fileName: string) {
  const dateMatches = Array.from(
    new Set(
      text.match(
        /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/gi
      ) ?? []
    )
  ).slice(0, 12);
  const amountMatches = Array.from(
    new Set(
      text.match(/(?:₹|Rs\.?|INR|USD|\$)\s?[\d,.]+(?:\s?(?:Cr|Crore|Lakhs?|Million|M|Bn))?/gi) ?? []
    )
  ).slice(0, 10);
  const statuteMatches = Array.from(
    new Set(
      text.match(
        /\b(?:Section|Sec\.?|Article|Art\.?)\s+\d+[A-Za-z()]*\s*(?:of\s+)?(?:BNS|BNSS|BSA|IPC|CrPC|IEA|CPC|Constitution|Arbitration\s+Act|Contract\s+Act|NI\s+Act)?/gi
      ) ?? []
    )
  ).slice(0, 12);
  const detectedLanguage = /[\u0900-\u097F]/.test(text) ? 'Hindi / Devanagari' : 'English';
  const chronology: ChronologyEvent[] = dateMatches.slice(0, 6).map((d) => ({
    date: d,
    event: `Referenced event on ${d} in ${fileName}`,
    sourceDoc: fileName,
    pageOrPara: 'Extracted text',
    significance: 'Verify exact factual context against original document.',
  }));
  return {
    entities: {
      parties: [] as string[],
      dates: dateMatches,
      amounts: amountMatches,
      statutes: statuteMatches,
      detectedLanguage,
      summary: text.slice(0, 280).trim() + (text.length > 280 ? '...' : ''),
    },
    chronology,
  };
}

export async function processVaultDocument(input: {
  fileName: string;
  mimeType: string;
  base64Data?: string;
  textInput?: string;
  targetLanguage?: string;
  existingDocsContext: string;
  jurisdiction: JurisdictionMode;
}): Promise<{
  extractedText: string;
  translatedText: string;
  entities: {
    parties: string[];
    dates: string[];
    amounts: string[];
    statutes: string[];
    detectedLanguage: string;
    summary: string;
  };
  chronology: ChronologyEvent[];
  contradictions: ContradictionItem[];
}> {
  const translateDirective =
    input.targetLanguage && input.targetLanguage !== 'None'
      ? `Also translate the extracted legal text accurately into ${input.targetLanguage}, strictly preserving legal terms of art.`
      : 'Leave translatedText as an empty string.';

  // Text-based Vault processing can run fast on NVIDIA NIM directly
  if (!input.base64Data && input.textInput && getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are a Forensic Litigation Document Analyst. Return ONLY valid JSON with keys: "extractedText" (string), "translatedText" (string), "entities" ({parties: string[], dates: string[], amounts: string[], statutes: string[], detectedLanguage: string, summary: string}), "chronology" (array of {date, event, sourceDoc, pageOrPara, significance}), and "contradictions" (array of {topic, statementA, statementB, severity ("high"|"medium"|"low"), recommendation}).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Document Name: ${input.fileName}\nProvided Document Text:\n${input.textInput.slice(0, 22000)}\n\nExisting Matter Documents Context:\n${input.existingDocsContext.slice(0, 10000)}\n\n${translateDirective}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 2800,
      });
      const parsed = extractJsonFromText<{
        extractedText?: string;
        translatedText?: string;
        entities?: {
          parties?: string[];
          dates?: string[];
          amounts?: string[];
          statutes?: string[];
          detectedLanguage?: string;
          summary?: string;
        };
        chronology?: ChronologyEvent[];
        contradictions?: ContradictionItem[];
      }>(res.text);
      const det = extractDeterministicEntities(parsed.extractedText || input.textInput, input.fileName);
      return {
        extractedText: parsed.extractedText || input.textInput,
        translatedText: parsed.translatedText || '',
        entities: {
          parties: parsed.entities?.parties ?? det.entities.parties,
          dates: parsed.entities?.dates ?? det.entities.dates,
          amounts: parsed.entities?.amounts ?? det.entities.amounts,
          statutes: parsed.entities?.statutes ?? det.entities.statutes,
          detectedLanguage: parsed.entities?.detectedLanguage ?? det.entities.detectedLanguage,
          summary: parsed.entities?.summary ?? det.entities.summary,
        },
        chronology: parsed.chronology ?? det.chronology,
        contradictions: (parsed.contradictions ?? []).map((c) => ({
          ...c,
          severity:
            c.severity === 'high' || c.severity === 'medium' || c.severity === 'low'
              ? c.severity
              : 'medium',
        })),
      };
    } catch {
      // Fallback to Gemini or deterministic
    }
  }

  if (!isGeminiConfigured() && input.textInput) {
    const det = extractDeterministicEntities(input.textInput, input.fileName);
    return {
      extractedText: input.textInput,
      translatedText: '',
      entities: det.entities,
      chronology: det.chronology,
      contradictions: [],
    };
  }

  const ai = getAiClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (input.base64Data && input.mimeType) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.base64Data,
      },
    });
  }

  parts.push({
    text: `Document Name: ${input.fileName}\n${input.textInput ? `Provided Document Text:\n${input.textInput.slice(0, 25000)}\n` : ''}\nExisting Matter Documents Context (for contradiction detection):\n${input.existingDocsContext.slice(0, 12000)}\n\nTasks:\n1. Perform faithful OCR/text extraction preserving legal formatting.\n2. Extract a chronological List of Dates & Events (YYYY-MM-DD where possible) with page/paragraph reference.\n3. Detect any factual, date, monetary, or procedural contradictions between this document and the Existing Matter Documents Context (or internal inconsistencies).\n4. ${translateDirective}`,
  });

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: { parts },
    config: {
      systemInstruction: `You are a Legal Document Intelligence & Forensic Litigation Analyst. ${jurisdictionInstruction(input.jurisdiction)}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extractedText: { type: Type.STRING },
          translatedText: { type: Type.STRING },
          chronology: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                event: { type: Type.STRING },
                sourceDoc: { type: Type.STRING },
                significance: { type: Type.STRING },
              },
              required: ['date', 'event', 'sourceDoc', 'significance'],
            },
          },
          contradictions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                statementA: { type: Type.STRING },
                statementB: { type: Type.STRING },
                severity: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
              required: ['topic', 'statementA', 'statementB', 'severity', 'recommendation'],
            },
          },
        },
        required: ['extractedText', 'translatedText', 'chronology', 'contradictions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    extractedText?: string;
    translatedText?: string;
    chronology?: ChronologyEvent[];
    contradictions?: ContradictionItem[];
  };

  const extracted = parsed.extractedText || input.textInput || '';
  const det = extractDeterministicEntities(extracted, input.fileName);

  return {
    extractedText: extracted,
    translatedText: parsed.translatedText || '',
    entities: det.entities,
    chronology: parsed.chronology ?? det.chronology,
    contradictions: (parsed.contradictions ?? []).map((c) => ({
      ...c,
      severity:
        c.severity === 'high' || c.severity === 'medium' || c.severity === 'low'
          ? c.severity
          : 'medium',
    })),
  };
}

export async function transcribeAndSummarizeMeeting(input: {
  base64Audio?: string;
  mimeType?: string;
  transcriptText?: string;
  matterContext: string;
  jurisdiction: JurisdictionMode;
}): Promise<{
  transcript: string;
  summary: string;
  keyFacts: string[];
  actionItems: string[];
  statutoryIssues: string[];
}> {
  let transcript = (input.transcriptText ?? '').trim();

  if (input.base64Audio && input.mimeType) {
    const ai = getAiClient();
    const transcribeRes = await ai.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64Audio,
            },
          },
          {
            text: 'Transcribe this legal consultation audio accurately, preserving legal terms, section numbers, party names, and monetary figures.',
          },
        ],
      },
    });
    transcript = transcribeRes.text?.trim() || transcript;
  }

  if (!transcript) {
    throw new Error('No audio or transcript text provided.');
  }

  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'Prepare an internal Client Consultation Brief from the transcript. Return ONLY valid JSON with keys: "summary" (string), "keyFacts" (string array), "actionItems" (string array), "statutoryIssues" (string array).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Active Matter Context:\n${input.matterContext}\n\nConsultation Transcript:\n${transcript.slice(0, 26000)}`,
        tier: 'expert',
        jsonMode: true,
        maxTokens: 2000,
      });
      const parsed = extractJsonFromText<{
        summary?: string;
        keyFacts?: string[];
        actionItems?: string[];
        statutoryIssues?: string[];
      }>(res.text);
      return {
        transcript,
        summary: parsed.summary || 'Consultation brief generated.',
        keyFacts: parsed.keyFacts ?? [],
        actionItems: parsed.actionItems ?? [],
        statutoryIssues: parsed.statutoryIssues ?? [],
      };
    } catch {
      // Fallback to Gemini
    }
  }

  const ai = getAiClient();
  const briefRes = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Active Matter Context:\n${input.matterContext}\n\nConsultation Transcript:\n${transcript.slice(0, 30000)}`,
    config: {
      systemInstruction: `You are a Senior Legal Associate preparing an internal Client Consultation Brief. ${jurisdictionInstruction(input.jurisdiction)} Extract a sharp executive summary, concrete key facts, actionable next steps, and statutory issues identified.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          statutoryIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['summary', 'keyFacts', 'actionItems', 'statutoryIssues'],
      },
    },
  });

  const parsed = JSON.parse((briefRes.text ?? '{}').trim()) as {
    summary?: string;
    keyFacts?: string[];
    actionItems?: string[];
    statutoryIssues?: string[];
  };

  return {
    transcript,
    summary: parsed.summary || 'Consultation brief generated.',
    keyFacts: parsed.keyFacts ?? [],
    actionItems: parsed.actionItems ?? [],
    statutoryIssues: parsed.statutoryIssues ?? [],
  };
}

export async function answerWhatsAppQuery(input: {
  prompt: string;
  matterContext: string;
  jurisdiction: JurisdictionMode;
}): Promise<string> {
  if (getNvidiaConfig().configured) {
    try {
      const precedents = retrieveRelevantPrecedents(input.prompt, input.jurisdiction, 2);
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are VidhiOS WhatsApp Command Assistant for advocates in court corridors. Respond concisely in crisp bullet points (under 150 words) suitable for instant courtroom reading.'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Matter Context:\n${input.matterContext}\n\nAdvocate's Mobile Query:\n${input.prompt}\n\n${formatPrecedentGroundingBlock(precedents)}`,
        tier: 'fast',
        maxTokens: 500,
      });
      return formatAiMarkdownResponse(res.text);
    } catch {
      // Fallback to Gemini
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Matter Context:\n${input.matterContext}\n\nAdvocate's Mobile Query:\n${input.prompt}`,
    config: {
      systemInstruction: `You are VidhiOS WhatsApp Command Assistant for busy advocates in court corridors. ${jurisdictionInstruction(input.jurisdiction)} Respond concisely in clear bullet points (under 150 words) suitable for mobile reading. Do not include filler preambles or --- dividers.`,
    },
  });
  return formatAiMarkdownResponse(response.text?.trim() || 'Unable to process query right now.');
}
