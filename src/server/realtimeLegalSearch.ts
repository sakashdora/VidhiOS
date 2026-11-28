import type { JurisdictionMode, VerifiedCitation } from '../types/legal';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
  SUPREME_COURT_CORPUS,
} from '../lib/legal/supremeCourtCorpus';
import { lookupStatuteMappings } from '../lib/legal/statuteCrosswalk';

export interface LiveLegalAuthority {
  title: string;
  citation?: string;
  court?: string;
  decisionDate?: string;
  relevantParagraphs?: string;
  legalIssue?: string;
  legalPrinciple?: string;
  outcome?: string;
  url: string;
  sourceType: 'live_kanoon' | 'supreme_court_corpus' | 'statute_crosswalk';
  sourceTier: 1 | 2 | 3 | 4 | 5 | 6;
  verificationStatus: 'verified_primary' | 'verified_legislation' | 'licensed_secondary' | 'verification_pending';
  snippet?: string;
}

export interface PrecedentConflictItem {
  topic: string;
  supportingAuthority: string;
  adverseOrDistinguishedAuthority: string;
  courtHierarchyNote: string;
  distinctionSummary: string;
}

export interface LegalSearchFilters {
  court?: string;
  judge?: string;
  statute?: string;
  caseName?: string;
  citation?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RealtimeLegalContext {
  query: string;
  jurisdiction: JurisdictionMode;
  liveAuthorities: LiveLegalAuthority[];
  citations: VerifiedCitation[];
  conflicts: PrecedentConflictItem[];
  statutoryGroundingText: string;
  precedentGroundingText: string;
  fetchLatencyMs: number;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Queries Indian Kanoon public search for candidate links.
 * Results from search snippets are strictly marked `verification_pending` (Tier 6),
 * never treated as verified primary authority until inspected directly.
 */
async function fetchLiveKanoonResults(
  query: string,
  timeoutMs = 3500
): Promise<LiveLegalAuthority[]> {
  const authorities: LiveLegalAuthority[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VidhiOS/2.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!res.ok) return authorities;
    const html = await res.text();

    const titleRegex = /<div class=["']result_title["']>[\s\S]*?<a href=["'](\/doc\/[0-9]+\/)["']>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = titleRegex.exec(html)) !== null && authorities.length < 4) {
      const docPath = match[1];
      const rawTitle = stripHtml(match[2]);

      if (rawTitle && docPath) {
        authorities.push({
          title: rawTitle,
          url: `https://indiankanoon.org${docPath}`,
          court: 'Search Candidate (Verification Pending)',
          sourceType: 'live_kanoon',
          sourceTier: 6,
          verificationStatus: 'verification_pending',
          snippet: `Search snippet candidate: ${rawTitle}. Open official court source or full text to verify.`,
        });
      }
    }
  } catch {
    // Non-fatal: timeout or network block falls back to curated primary corpus
  } finally {
    clearTimeout(timer);
  }

  return authorities;
}

/**
 * Identifies potential doctrinal tensions or distinctions across precedents without
 * falsely assuming an earlier decision is overruled.
 */
export function detectPrecedentConflicts(
  query: string,
  jurisdiction: JurisdictionMode
): PrecedentConflictItem[] {
  const lower = query.toLowerCase();
  const conflicts: PrecedentConflictItem[] = [];

  if (
    jurisdiction === 'india_litigation' &&
    (lower.includes('bail') || lower.includes('482') || lower.includes('438') || lower.includes('arrest'))
  ) {
    conflicts.push({
      topic: 'Anticipatory Bail Duration & Economic Offence Standards',
      supportingAuthority: 'Sushila Aggarwal v. State (NCT of Delhi), (2020) 5 SCC 1 (5-Judge Constitution Bench)',
      adverseOrDistinguishedAuthority: 'Y.S. Jagan Mohan Reddy / Nimmagadda Prasad (economic offence gravity exception)',
      courtHierarchyNote: '5-Judge Constitution Bench in Sushila Aggarwal binds smaller Division Benches on pre-arrest bail duration.',
      distinctionSummary:
        'Economic offences require stricter scrutiny of flight/tampering risk, but Satender Kumar Antil (2022) 10 SCC 51 clarifies they are not an absolute bar to bail where investigation is documentary.',
    });
  }

  if (
    jurisdiction === 'india_litigation' &&
    (lower.includes('420') || lower.includes('406') || lower.includes('318') || lower.includes('quash') || lower.includes('528'))
  ) {
    conflicts.push({
      topic: 'Simultaneous Invocation of Cheating (318 BNS) & Criminal Breach of Trust (316 BNS)',
      supportingAuthority: 'Delhi Race Club (1940) Ltd. v. State of U.P., 2024 INSC 626 (Division Bench)',
      adverseOrDistinguishedAuthority: 'Neeharika Infrastructure Pvt. Ltd. v. State of Maharashtra, (2021) 3 SCC 1 (3-Judge Bench)',
      courtHierarchyNote: '3-Judge Bench in Neeharika cautions against premature quashing of nascent investigations; Delhi Race Club (2024) mandates quashing where civil breach is dressed as mutually exclusive offences.',
      distinctionSummary:
        'Both decisions remain good law in their respective spheres: High Court must test whether FIR allegations disclose ingredients at face value (Bhajan Lal / Delhi Race Club) without conducting a mini-trial (Neeharika).',
    });
  }

  if (
    lower.includes('arbitration') ||
    lower.includes('unilateral') ||
    lower.includes('34') ||
    lower.includes('seat')
  ) {
    conflicts.push({
      topic: 'Unilateral Arbitrator Appointments & Public-Private Contracts',
      supportingAuthority: 'Central Organisation for Railway Electrification (CORE) v. ECI-SPIC-SMO-MCML, 2024 INSC 857 (5-Judge Constitution Bench)',
      adverseOrDistinguishedAuthority: 'Earlier curated-panel view in CORE (2020) 14 SCC 712 (3-Judge Bench)',
      courtHierarchyNote: '2024 5-Judge Constitution Bench prospectively settled that unilateral panels violate Art. 14 equality.',
      distinctionSummary:
        'Apply prospective ruling analysis depending on the date of arbitrator appointment; verify whether Section 12(5) waiver was executed post-dispute.',
    });
  }

  if (lower.includes('63') || lower.includes('65b') || lower.includes('electronic')) {
    conflicts.push({
      topic: 'Mandatory Sec. 63 BSA / 65B IEA Certificate Requirement',
      supportingAuthority: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, (2020) 7 SCC 1 (3-Judge Bench)',
      adverseOrDistinguishedAuthority: 'Shafhi Mohammad v. State of H.P., (2018) 2 SCC 801 (2-Judge Bench — Overruled)',
      courtHierarchyNote: '3-Judge Bench in Arjun Panditrao Khotkar expressly overruled Shafhi Mohammad.',
      distinctionSummary:
        'Certificate under Sec. 63(4) BSA (with Schedule Part A & B) is mandatory for secondary electronic evidence unless the original primary device is produced.',
    });
  }

  return conflicts;
}

export async function fetchRealtimeLegalData(
  query: string,
  jurisdiction: JurisdictionMode,
  matterContext = '',
  filters?: LegalSearchFilters
): Promise<RealtimeLegalContext> {
  const startedAt = Date.now();
  const filterTokens = [
    filters?.court,
    filters?.judge,
    filters?.statute,
    filters?.caseName,
    filters?.citation,
  ]
    .filter(Boolean)
    .join(' ');

  const combinedText = `${query} ${filterTokens} ${matterContext}`.trim();

  // 1. Statute scan for post-July 2024 BNS/BNSS/BSA crosswalk (Tier 3: Official Legislation)
  const matchedStatutes = lookupStatuteMappings(combinedText);
  let statutoryGroundingText = '';
  if (matchedStatutes.length > 0) {
    statutoryGroundingText = `VERIFIED STATUTORY CROSSWALK (BNS 2023 / BNSS 2023 / BSA 2023):\n${matchedStatutes
      .slice(0, 5)
      .map(
        (s) =>
          `- ${s.legacyCode} Sec. ${s.legacySection} -> ${s.newCode} Sec. ${s.newSection} (${s.title}). Note: ${s.keyChangeNote}`
      )
      .join('\n')}`;
  }

  // 2. Curated Supreme Court & High Court corpus with optional filter matching (Tier 1 & 2)
  let curatedPrecedents = retrieveRelevantPrecedents(combinedText, jurisdiction, 5);
  if (filters?.court) {
    const courtLower = filters.court.toLowerCase();
    const filtered = SUPREME_COURT_CORPUS.filter((p) =>
      p.court.toLowerCase().includes(courtLower)
    );
    if (filtered.length > 0) {
      curatedPrecedents = filtered.slice(0, 4);
    }
  }
  const precedentGroundingText = formatPrecedentGroundingBlock(curatedPrecedents);

  // 3. Live Indian Kanoon candidate search (Tier 6: Verification Pending)
  let liveKanoonAuthorities: LiveLegalAuthority[] = [];
  if (
    jurisdiction === 'india_litigation' ||
    combinedText.toLowerCase().includes('india') ||
    combinedText.toLowerCase().includes('act')
  ) {
    const cleanedSearchTerms = `${query} ${filters?.caseName || ''} ${filters?.citation || ''} ${filters?.statute || ''}`
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6)
      .join(' ');

    liveKanoonAuthorities = await fetchLiveKanoonResults(cleanedSearchTerms || query);
  }

  // Build unified authorities ordered strictly by source hierarchy (Tier 1 -> Tier 6)
  const liveAuthorities: LiveLegalAuthority[] = [];

  for (const p of curatedPrecedents) {
    const isSC = p.court.toLowerCase().includes('supreme court');
    liveAuthorities.push({
      title: `${p.caseName}, ${p.citation}`,
      citation: p.citation,
      court: `${p.court} (${p.bench}, ${p.year})`,
      decisionDate: String(p.year),
      legalIssue: p.statutes.join(', '),
      legalPrinciple: p.ratio,
      outcome: p.practicalApplication,
      url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(p.caseName)}`,
      sourceType: 'supreme_court_corpus',
      sourceTier: isSC ? 1 : 2,
      verificationStatus: 'verified_primary',
      snippet: p.ratio,
    });
  }

  for (const s of matchedStatutes.slice(0, 2)) {
    liveAuthorities.push({
      title: `${s.newCode} Section ${s.newSection} — ${s.title} (replacing ${s.legacyCode} ${s.legacySection})`,
      court: 'India Code / Official Legislation (2023 Codes)',
      decisionDate: '2024-07-01',
      legalPrinciple: s.keyChangeNote,
      url: 'https://www.indiacode.nic.in/',
      sourceType: 'statute_crosswalk',
      sourceTier: 3,
      verificationStatus: 'verified_legislation',
      snippet: s.keyChangeNote,
    });
  }

  for (const k of liveKanoonAuthorities) {
    liveAuthorities.push(k);
  }

  const citations: VerifiedCitation[] = liveAuthorities.map((a) => ({
    title: a.title,
    url: a.url,
    courtOrSource: a.court || 'Official Record',
    decisionDate: a.decisionDate,
    citation: a.citation,
    relevantParagraphs: a.relevantParagraphs,
    legalIssue: a.legalIssue,
    legalPrinciple: a.legalPrinciple,
    outcome: a.outcome,
    sourceTier: a.sourceTier,
    verificationStatus: a.verificationStatus,
    status:
      a.verificationStatus === 'verified_primary' || a.verificationStatus === 'verified_legislation'
        ? 'statute'
        : 'caution',
  }));

  const conflicts = detectPrecedentConflicts(combinedText, jurisdiction);

  return {
    query,
    jurisdiction,
    liveAuthorities,
    citations,
    conflicts,
    statutoryGroundingText,
    precedentGroundingText,
    fetchLatencyMs: Date.now() - startedAt,
  };
}
