import type { JurisdictionMode, VerifiedCitation } from '../types/legal';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
} from '../lib/legal/supremeCourtCorpus';
import { lookupStatuteMappings } from '../lib/legal/statuteCrosswalk';

export interface LiveLegalAuthority {
  title: string;
  citation?: string;
  court?: string;
  url: string;
  sourceType: 'live_kanoon' | 'supreme_court_corpus' | 'statute_crosswalk';
  snippet?: string;
}

export interface RealtimeLegalContext {
  query: string;
  jurisdiction: JurisdictionMode;
  liveAuthorities: LiveLegalAuthority[];
  citations: VerifiedCitation[];
  statutoryGroundingText: string;
  precedentGroundingText: string;
  fetchLatencyMs: number;
}

/**
 * Strips HTML tags and excessive whitespace from scrapings.
 */
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
 * Performs a fast, non-blocking real-time search on Indian Kanoon for the latest
 * judgments, orders, and judicial interpretations.
 */
async function fetchLiveKanoonResults(
  query: string,
  timeoutMs = 4000
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

    // Match result blocks: result_title links and headline summaries
    const titleRegex = /<div class=["']result_title["']>[\s\S]*?<a href=["'](\/doc\/[0-9]+\/)["']>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = titleRegex.exec(html)) !== null && authorities.length < 4) {
      const docPath = match[1];
      const rawTitle = stripHtml(match[2]);

      if (rawTitle && docPath) {
        authorities.push({
          title: rawTitle,
          url: `https://indiankanoon.org${docPath}`,
          court: 'Live Judicial Authority',
          sourceType: 'live_kanoon',
          snippet: `Live Kanoon Authority: ${rawTitle}`,
        });
      }
    }
  } catch {
    // Non-fatal: timeout or network block simply falls back to curated corpus
  } finally {
    clearTimeout(timer);
  }

  return authorities;
}

/**
 * Gathers multi-layer real-time data:
 * 1. Live Indian Kanoon case search
 * 2. Statutory BNS/BNSS/BSA Crosswalk & Legal Currency Scan
 * 3. Verified Supreme Court & High Court Precedents with Ratios
 */
export async function fetchRealtimeLegalData(
  query: string,
  jurisdiction: JurisdictionMode,
  matterContext = ''
): Promise<RealtimeLegalContext> {
  const startedAt = Date.now();
  const combinedText = `${query} ${matterContext}`.trim();

  // 1. Statute scan for post-July 2024 BNS/BNSS/BSA crosswalk
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

  // 2. High-precision curated Supreme Court & High Court corpus
  const curatedPrecedents = retrieveRelevantPrecedents(combinedText, jurisdiction, 4);
  const precedentGroundingText = formatPrecedentGroundingBlock(curatedPrecedents);

  // 3. Live Indian Kanoon Web Grounding (for Indian litigation or arbitration queries)
  let liveKanoonAuthorities: LiveLegalAuthority[] = [];
  if (jurisdiction === 'india_litigation' || combinedText.toLowerCase().includes('india') || combinedText.toLowerCase().includes('act')) {
    // Extract key legal search tokens from query for Kanoon query optimization
    const cleanedSearchTerms = query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6)
      .join(' ');

    liveKanoonAuthorities = await fetchLiveKanoonResults(cleanedSearchTerms || query);
  }

  // Build unified authorities list
  const liveAuthorities: LiveLegalAuthority[] = [];

  // Add Kanoon live records
  for (const k of liveKanoonAuthorities) {
    liveAuthorities.push(k);
  }

  // Add curated precedents
  for (const p of curatedPrecedents) {
    liveAuthorities.push({
      title: `${p.caseName}, ${p.citation}`,
      court: `${p.court} (${p.bench}, ${p.year})`,
      url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(p.caseName)}`,
      sourceType: 'supreme_court_corpus',
      snippet: p.ratio,
    });
  }

  // Map to verified citations format
  const citations: VerifiedCitation[] = liveAuthorities.map((a) => ({
    title: a.title,
    url: a.url,
    courtOrSource: a.court || 'Supreme Court / High Court Record',
    status: a.sourceType === 'live_kanoon' ? 'verified_web' : 'statute',
  }));

  return {
    query,
    jurisdiction,
    liveAuthorities,
    citations,
    statutoryGroundingText,
    precedentGroundingText,
    fetchLatencyMs: Date.now() - startedAt,
  };
}
