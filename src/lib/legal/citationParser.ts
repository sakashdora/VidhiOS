import {
  STATUTE_CROSSWALK,
  type LegacyCode,
  type NewCode,
  type StatuteMapping,
} from './statuteCrosswalk';
import {
  SUPREME_COURT_CORPUS,
  type JudicialPrecedent,
} from './supremeCourtCorpus';
import type { VerifiedCitation } from '../../types/legal';

export type CitationKind = 'case' | 'statute';

export type CitationVerificationTier =
  | 'verified_corpus'
  | 'statute_crosswalk'
  | 'grounded_source'
  | 'statutory_reference'
  | 'detected_lookup';

export interface CitationExternalLink {
  label: string;
  url: string;
  source: string;
}

export interface DetectedCitation {
  id: string;
  kind: CitationKind;
  matchedText: string;
  canonicalTitle: string;
  citationRef?: string;
  startIndex: number;
  endIndex: number;
  verificationTier: CitationVerificationTier;
  subtitle: string;
  summary: string;
  secondaryNote?: string;
  crosswalkLabel?: string;
  links: CitationExternalLink[];
}

export type ParsedTextSegment =
  | { type: 'text'; text: string }
  | { type: 'citation'; citation: DetectedCitation };

export interface ParsedCitationResult {
  segments: ParsedTextSegment[];
  citations: DetectedCitation[];
  uniqueCases: DetectedCitation[];
  uniqueStatutes: DetectedCitation[];
}

interface GeneralStatuteEntry {
  actAliases: string[];
  canonicalAct: string;
  section?: string;
  title: string;
  summary: string;
  secondaryNote?: string;
  officialUrl: string;
  officialLabel: string;
}

interface SupplementaryCaseEntry {
  caseName: string;
  shortAliases: string[];
  citation: string;
  court: string;
  bench: string;
  year: number;
  ratio: string;
  practicalApplication: string;
  officialUrl?: string;
}

const SUPPLEMENTARY_CASES: SupplementaryCaseEntry[] = [
  {
    caseName: 'Lalit Chaturvedi & Ors. v. State of Uttar Pradesh',
    shortAliases: ['lalit chaturvedi'],
    citation: '2024 SCC OnLine SC 171',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2024,
    ratio:
      'Mere breach of contract or unpaid commercial dues does not constitute cheating or criminal breach of trust; criminal proceedings cannot be misused as a recovery mechanism.',
    practicalApplication:
      'Key authority for quashing commercial FIRs under Sec. 528 BNSS and securing anticipatory bail under Sec. 482 BNSS.',
    officialUrl: 'https://main.sci.gov.in/',
  },
  {
    caseName: 'Perkins Eastman Architects DPC v. HSCC (India) Ltd.',
    shortAliases: ['perkins eastman'],
    citation: '(2020) 20 SCC 760',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2019,
    ratio:
      'A person who has an interest in the outcome of the dispute is ineligible under Section 12(5) of the Arbitration Act not only to act as arbitrator, but also to unilaterally appoint a sole arbitrator.',
    practicalApplication:
      'Foundational precedent striking down one-sided sole-arbitrator appointment clauses in commercial contracts.',
    officialUrl: 'https://main.sci.gov.in/',
  },
  {
    caseName: 'Siddharam Satlingappa Mhetre v. State of Maharashtra',
    shortAliases: ['siddharam satlingappa mhetre'],
    citation: '(2011) 1 SCC 694',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2011,
    ratio:
      'Lays down structured factors for anticipatory bail, emphasizing personal liberty, presumption of innocence, and avoidance of unnecessary custodial humiliation.',
    practicalApplication:
      'Frequently paired with Sushila Aggarwal (2020) in pre-arrest bail pleadings before Sessions and High Courts.',
    officialUrl: 'https://main.sci.gov.in/',
  },
  {
    caseName: 'Kesavananda Bharati v. State of Kerala',
    shortAliases: ['kesavananda bharati'],
    citation: '(1973) 4 SCC 225',
    court: 'Supreme Court of India',
    bench: '13-Judge Constitution Bench',
    year: 1973,
    ratio:
      'Parliament’s amending power under Article 368 cannot alter or destroy the Basic Structure of the Constitution of India.',
    practicalApplication:
      'Benchmark constitutional doctrine governing judicial review of constitutional amendments.',
    officialUrl: 'https://main.sci.gov.in/',
  },
  {
    caseName: 'Maneka Gandhi v. Union of India',
    shortAliases: ['maneka gandhi'],
    citation: '(1978) 1 SCC 248',
    court: 'Supreme Court of India',
    bench: '7-Judge Constitution Bench',
    year: 1978,
    ratio:
      'Procedure established by law under Article 21 must be fair, just, and reasonable—not arbitrary, fanciful, or oppressive—linking Articles 14, 19, and 21 into a golden triangle.',
    practicalApplication:
      'Anchor writ petitions challenging arbitrary executive action or deprivation of personal liberty.',
    officialUrl: 'https://main.sci.gov.in/',
  },
];

const GENERAL_STATUTES: GeneralStatuteEntry[] = [
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '14',
    title: 'Equality before law',
    summary:
      'Guarantees equality before the law and equal protection of the laws within the territory of India, prohibiting arbitrary state action.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '19',
    title: 'Protection of certain rights regarding freedom of speech, trade, etc.',
    summary:
      'Protects six fundamental freedoms of citizens, subject to reasonable restrictions enumerated in clauses (2) to (6).',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '21',
    title: 'Protection of life and personal liberty',
    summary:
      'No person shall be deprived of life or personal liberty except according to a fair, just, and reasonable procedure established by law.',
    secondaryNote: 'Includes right to privacy (Puttaswamy) and speedy fair trial.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '32',
    title: 'Remedies for enforcement of fundamental rights (Supreme Court Writs)',
    summary:
      'Empowers citizens to directly move the Supreme Court of India for writs of habeas corpus, mandamus, prohibition, quo warranto, and certiorari.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '136',
    title: 'Special Leave to Appeal by the Supreme Court (SLP)',
    summary:
      'Confers plenary discretionary jurisdiction on the Supreme Court to grant special leave to appeal from any judgment, decree, or order of any court or tribunal in India.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '226',
    title: 'Power of High Courts to issue writs',
    summary:
      'Authorizes High Courts to issue writs, directions, or orders for enforcement of fundamental rights and for "any other purpose" within their territorial jurisdiction.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['constitution', 'constitution of india'],
    canonicalAct: 'Constitution of India',
    section: '227',
    title: 'Power of superintendence over all courts by the High Court',
    summary:
      'Grants High Courts administrative and judicial superintendence over all subordinate courts and tribunals within their jurisdiction.',
    officialUrl: 'https://www.indiacode.nic.in/',
    officialLabel: 'India Code — Constitution',
  },
  {
    actAliases: ['indian contract act', 'contract act', 'ica'],
    canonicalAct: 'Indian Contract Act, 1872',
    section: '73',
    title: 'Compensation for loss or damage caused by breach of contract',
    summary:
      'Entitles the injured party to direct compensation for losses naturally arising from breach; remote and indirect losses are expressly excluded.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2187',
    officialLabel: 'India Code — Contract Act',
  },
  {
    actAliases: ['indian contract act', 'contract act', 'ica'],
    canonicalAct: 'Indian Contract Act, 1872',
    section: '74',
    title: 'Compensation for breach of contract where penalty stipulated for',
    summary:
      'Caps recovery at reasonable compensation not exceeding the stipulated liquidated damages or penalty amount; actual loss or genuine pre-estimate is tested.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2187',
    officialLabel: 'India Code — Contract Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '8',
    title: 'Power to refer parties to arbitration where there is an arbitration agreement',
    summary:
      'Mandates judicial authorities to refer parties to arbitration unless prima facie no valid arbitration agreement exists.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '11',
    title: 'Appointment of arbitrators',
    summary:
      'Governs court appointment of arbitrators by the High Court or Supreme Court when parties fail to constitute the tribunal.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '12(5)',
    title: 'Ineligibility of arbitrator (Seventh Schedule)',
    summary:
      'Renders any person falling under the Seventh Schedule relationships ineligible to be appointed as an arbitrator unless waived in writing post-dispute.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '21',
    title: 'Commencement of arbitral proceedings',
    summary:
      'Arbitral proceedings commence on the date a request (Notice Invoking Arbitration) for the dispute to be referred to arbitration is received by the respondent.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '34',
    title: 'Application for setting aside arbitral award',
    summary:
      'Permits challenge to a domestic arbitral award on narrow statutory grounds within a strict 3-month (+30 days max) non-extendable limitation window.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration & conciliation act', 'a&c act'],
    canonicalAct: 'Arbitration and Conciliation Act, 1996',
    section: '48',
    title: 'Conditions for enforcement of foreign arbitral awards',
    summary:
      'Sets out exhaustive New York Convention refusal grounds (incapacity, lack of notice, excess of jurisdiction, or narrow public policy of India) for Part II foreign awards.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1978',
    officialLabel: 'India Code — Arbitration Act',
  },
  {
    actAliases: ['ni act', 'negotiable instruments act'],
    canonicalAct: 'Negotiable Instruments Act, 1881',
    section: '138',
    title: 'Dishonour of cheque for insufficiency of funds',
    summary:
      'Criminalizes cheque dishonour subject to statutory presentation, 30-day written demand notice, and 15-day drawer cure window.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    officialLabel: 'India Code — NI Act',
  },
  {
    actAliases: ['limitation act'],
    canonicalAct: 'Limitation Act, 1963',
    section: '5',
    title: 'Extension of prescribed period (Condonation of Delay)',
    summary:
      'Permits courts to admit appeals or applications (excluding suits) after the prescribed limitation period if the applicant shows "sufficient cause".',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/1565',
    officialLabel: 'India Code — Limitation Act',
  },
  {
    actAliases: ['cpc', 'code of civil procedure'],
    canonicalAct: 'Code of Civil Procedure, 1908',
    section: 'Order XIX Rule 3',
    title: 'Matters to which affidavits shall be confined',
    summary:
      'Requires affidavits to confine statements to facts the deponent can prove of personal knowledge, separately identifying grounds of belief in interlocutory applications.',
    officialUrl: 'https://www.indiacode.nic.in/handle/123456789/2191',
    officialLabel: 'India Code — CPC',
  },
  {
    actAliases: ['new york convention'],
    canonicalAct: 'New York Convention, 1958',
    section: 'V(2)(b)',
    title: 'Public Policy Exception to Foreign Award Enforcement',
    summary:
      'Allows refusal of recognition or enforcement of a foreign arbitral award only if enforcement would be contrary to the public policy of the enforcing state.',
    officialUrl: 'https://uncitral.un.org/en/texts/arbitration/conventions/foreign_arbitral_awards',
    officialLabel: 'UNCITRAL — New York Convention',
  },
];

const NEW_CODE_URLS: Record<NewCode, { name: string; url: string }> = {
  BNS: {
    name: 'Bharatiya Nyaya Sanhita, 2023',
    url: 'https://www.indiacode.nic.in/handle/123456789/20062',
  },
  BNSS: {
    name: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    url: 'https://www.indiacode.nic.in/handle/123456789/20099',
  },
  BSA: {
    name: 'Bharatiya Sakshya Adhiniyam, 2023',
    url: 'https://www.indiacode.nic.in/handle/123456789/20063',
  },
};

const LEGACY_CODE_URLS: Record<LegacyCode, { name: string; url: string }> = {
  IPC: {
    name: 'Indian Penal Code, 1860 (Repealed)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2263',
  },
  CrPC: {
    name: 'Code of Criminal Procedure, 1973 (Repealed)',
    url: 'https://www.indiacode.nic.in/handle/123456789/16225',
  },
  IEA: {
    name: 'Indian Evidence Act, 1872 (Repealed)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2188',
  },
};

function sanitizeExternalUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function buildIndianKanoonSearchUrl(query: string): string {
  return `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query.trim())}`;
}

function normalizeSection(sec: string): string {
  return sec.trim().toUpperCase().replace(/\s+/g, '');
}

function stripSubsection(sec: string): string {
  return normalizeSection(sec).replace(/\([^)]*\)/g, '');
}

function normalizeCodeToken(raw: string): LegacyCode | NewCode | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/,?\s*\d{4}$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned === 'ipc' || cleaned === 'i.p.c' || cleaned === 'i.p.c.' || cleaned === 'indian penal code') {
    return 'IPC';
  }
  if (
    cleaned === 'crpc' ||
    cleaned === 'cr.p.c' ||
    cleaned === 'cr.p.c.' ||
    cleaned === 'code of criminal procedure'
  ) {
    return 'CrPC';
  }
  if (
    cleaned === 'iea' ||
    cleaned === 'i.e.a' ||
    cleaned === 'i.e.a.' ||
    cleaned === 'indian evidence act' ||
    cleaned === 'evidence act'
  ) {
    return 'IEA';
  }
  if (cleaned === 'bns' || cleaned === 'bharatiya nyaya sanhita') {
    return 'BNS';
  }
  if (cleaned === 'bnss' || cleaned === 'bharatiya nagarik suraksha sanhita') {
    return 'BNSS';
  }
  if (cleaned === 'bsa' || cleaned === 'bharatiya sakshya adhiniyam') {
    return 'BSA';
  }
  return null;
}

function lookupCrosswalkBidirectional(
  code: LegacyCode | NewCode,
  section: string
): StatuteMapping | undefined {
  const exactKey = normalizeSection(section);
  const baseKey = stripSubsection(section);

  if (code === 'IPC' || code === 'CrPC' || code === 'IEA') {
    return (
      STATUTE_CROSSWALK.find(
        (m) => m.legacyCode === code && normalizeSection(m.legacySection) === exactKey
      ) ??
      STATUTE_CROSSWALK.find(
        (m) => m.legacyCode === code && stripSubsection(m.legacySection) === baseKey
      )
    );
  }

  return (
    STATUTE_CROSSWALK.find(
      (m) => m.newCode === code && normalizeSection(m.newSection) === exactKey
    ) ??
    STATUTE_CROSSWALK.find(
      (m) => m.newCode === code && stripSubsection(m.newSection) === baseKey
    )
  );
}

function normalizeForTokenMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(v|vs|versus|ors|anr|ltd|pvt|state|of|the|and|in|re|m|s|holding|bv|co|dpc|retd|union|india|government|uttar|pradesh|maharashtra|bihar|delhi|nct|haryana|punjab|kerala|himachal|madhya|bengal|tamil|nadu|gujarat|rajasthan|karnataka|supreme|court|high)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function matchGroundedCitation(
  label: string,
  groundedCitations: VerifiedCitation[]
): VerifiedCitation | undefined {
  if (!groundedCitations.length) return undefined;
  const targetTokens = normalizeForTokenMatch(label)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (targetTokens.length === 0) return undefined;

  let best: { item: VerifiedCitation; hits: number } | null = null;
  for (const item of groundedCitations) {
    const titleNorm = normalizeForTokenMatch(item.title);
    const hits = targetTokens.filter((tok) => titleNorm.includes(tok)).length;
    if (hits >= Math.min(2, targetTokens.length)) {
      if (!best || hits > best.hits) {
        best = { item, hits };
      }
    }
  }
  return best?.item;
}

function matchCorpusCase(
  caseText: string
): JudicialPrecedent | SupplementaryCaseEntry | undefined {
  const lower = caseText.toLowerCase();
  const normalizedTarget = normalizeForTokenMatch(caseText);
  const targetTokens = normalizedTarget.split(' ').filter((t) => t.length >= 3);

  for (const supp of SUPPLEMENTARY_CASES) {
    if (supp.shortAliases.some((alias) => lower.includes(alias))) {
      return supp;
    }
  }

  for (const prec of SUPREME_COURT_CORPUS) {
    const normCase = normalizeForTokenMatch(prec.caseName);
    const caseTokens = normCase.split(' ').filter((t) => t.length >= 3);
    if (caseTokens.length === 0) continue;

    // Require strong distinctive token overlap (at least 2 shared tokens, or 1 if case only has 1 distinctive token)
    const overlap = caseTokens.filter((t) => targetTokens.includes(t));
    const minNeeded = Math.min(2, caseTokens.length);
    if (overlap.length >= minNeeded) {
      return prec;
    }
  }

  return undefined;
}

function buildStatuteDetectedCitation(
  matchedText: string,
  startIndex: number,
  endIndex: number,
  rawSection: string,
  rawAct: string,
  groundedCitations: VerifiedCitation[]
): DetectedCitation {
  const code = normalizeCodeToken(rawAct);
  const links: CitationExternalLink[] = [];

  if (code) {
    const mapping = lookupCrosswalkBidirectional(code, rawSection);
    const isNewCode = code === 'BNS' || code === 'BNSS' || code === 'BSA';
    const actMeta = isNewCode ? NEW_CODE_URLS[code] : LEGACY_CODE_URLS[code];

    const grounded = matchGroundedCitation(`${rawAct} ${rawSection}`, groundedCitations);
    const safeGroundedUrl = grounded ? sanitizeExternalUrl(grounded.url) : null;
    if (grounded && safeGroundedUrl) {
      links.push({
        label: 'Grounded Source',
        url: safeGroundedUrl,
        source: grounded.courtOrSource || 'Verified Source',
      });
    }

    links.push({
      label: `India Code (${code})`,
      url: actMeta.url,
      source: actMeta.name,
    });
    links.push({
      label: 'Search Indian Kanoon',
      url: buildIndianKanoonSearchUrl(`Section ${rawSection} ${actMeta.name}`),
      source: 'Indian Kanoon',
    });

    if (mapping) {
      const crosswalkLabel = isNewCode
        ? `Section ${mapping.newSection} ${mapping.newCode} ← formerly Section ${mapping.legacySection} ${mapping.legacyCode}`
        : `Section ${mapping.legacySection} ${mapping.legacyCode} → Section ${mapping.newSection} ${mapping.newCode}`;

      return {
        id: `stat_${startIndex}_${endIndex}`,
        kind: 'statute',
        matchedText,
        canonicalTitle: isNewCode
          ? `Section ${mapping.newSection} ${mapping.newCode}`
          : `Section ${mapping.legacySection} ${mapping.legacyCode}`,
        citationRef: actMeta.name,
        startIndex,
        endIndex,
        verificationTier: 'statute_crosswalk',
        subtitle: mapping.title,
        summary: mapping.keyChangeNote,
        secondaryNote:
          mapping.changeImpact === 'substantive_change'
            ? 'Substantive change under 2023 Criminal Law Reforms — verify updated ingredients/punishment.'
            : mapping.changeImpact === 'expanded_scope'
              ? 'Expanded statutory scope under 2023 Criminal Law Reforms.'
              : 'Substantively retained and renumbered under 2023 Criminal Law Reforms.',
        crosswalkLabel,
        links,
      };
    }

    return {
      id: `stat_${startIndex}_${endIndex}`,
      kind: 'statute',
      matchedText,
      canonicalTitle: `Section ${rawSection} ${code}`,
      citationRef: actMeta.name,
      startIndex,
      endIndex,
      verificationTier: 'statutory_reference',
      subtitle: actMeta.name,
      summary: `Statutory provision under ${actMeta.name}. Open official India Code text or Indian Kanoon commentary to review the full bare act wording.`,
      links,
    };
  }

  // Match general Indian / International statutes (Constitution, Contract Act, Arbitration Act, NI Act, Limitation Act, CPC, NY Convention)
  const actLower = rawAct.toLowerCase().replace(/,?\s*\d{4}$/, '').replace(/\s+/g, ' ').trim();
  const secExact = normalizeSection(rawSection);
  const secBase = stripSubsection(rawSection);

  const generalMatch =
    GENERAL_STATUTES.find(
      (g) =>
        g.actAliases.some((a) => actLower.includes(a)) &&
        g.section &&
        (normalizeSection(g.section) === secExact || stripSubsection(g.section) === secBase)
    ) ??
    GENERAL_STATUTES.find(
      (g) =>
        actLower === 'article' &&
        g.canonicalAct === 'Constitution of India' &&
        g.section &&
        normalizeSection(g.section) === secBase
    );

  const grounded = matchGroundedCitation(matchedText, groundedCitations);
  const safeGroundedUrl = grounded ? sanitizeExternalUrl(grounded.url) : null;
  if (grounded && safeGroundedUrl) {
    links.push({
      label: 'Grounded Source',
      url: safeGroundedUrl,
      source: grounded.courtOrSource || 'Verified Source',
    });
  }

  if (generalMatch) {
    links.push({
      label: generalMatch.officialLabel,
      url: generalMatch.officialUrl,
      source: generalMatch.canonicalAct,
    });
    links.push({
      label: 'Search Indian Kanoon',
      url: buildIndianKanoonSearchUrl(`${matchedText} ${generalMatch.canonicalAct}`),
      source: 'Indian Kanoon',
    });

    const isArticle = generalMatch.canonicalAct === 'Constitution of India' || generalMatch.canonicalAct.includes('Convention');
    const canonicalTitle =
      generalMatch.section?.startsWith('Order')
        ? `${generalMatch.section}, ${generalMatch.canonicalAct}`
        : isArticle
          ? `Article ${generalMatch.section}, ${generalMatch.canonicalAct}`
          : `Section ${generalMatch.section}, ${generalMatch.canonicalAct}`;

    return {
      id: `stat_${startIndex}_${endIndex}`,
      kind: 'statute',
      matchedText,
      canonicalTitle,
      citationRef: generalMatch.canonicalAct,
      startIndex,
      endIndex,
      verificationTier: 'statutory_reference',
      subtitle: generalMatch.title,
      summary: generalMatch.summary,
      secondaryNote: generalMatch.secondaryNote,
      links,
    };
  }

  links.push({
    label: 'India Code Bare Acts',
    url: 'https://www.indiacode.nic.in/',
    source: 'India Code',
  });
  links.push({
    label: 'Search Indian Kanoon',
    url: buildIndianKanoonSearchUrl(matchedText),
    source: 'Indian Kanoon',
  });

  return {
    id: `stat_${startIndex}_${endIndex}`,
    kind: 'statute',
    matchedText,
    canonicalTitle: matchedText.trim(),
    citationRef: rawAct.trim(),
    startIndex,
    endIndex,
    verificationTier: 'detected_lookup',
    subtitle: 'Detected Statutory Provision',
    summary:
      'Detected legislative reference within research text. Consult the official bare act text on India Code before relying in pleadings.',
    links,
  };
}

function buildCaseDetectedCitation(
  matchedText: string,
  startIndex: number,
  endIndex: number,
  extractedCaseName: string,
  extractedReporter: string | undefined,
  groundedCitations: VerifiedCitation[]
): DetectedCitation {
  const corpusMatch = matchCorpusCase(extractedCaseName);
  const groundedMatch = matchGroundedCitation(extractedCaseName, groundedCitations);
  const links: CitationExternalLink[] = [];

  if (groundedMatch) {
    const safeUrl = sanitizeExternalUrl(groundedMatch.url);
    if (safeUrl) {
      links.push({
        label: 'Verified Source',
        url: safeUrl,
        source: groundedMatch.courtOrSource || 'Grounded Source',
      });
    }
  }

  if (corpusMatch) {
    const isIndianSC = corpusMatch.court.toLowerCase().includes('supreme court of india');
    if (isIndianSC && !links.some((l) => l.url.includes('sci.gov.in'))) {
      links.push({
        label: 'Supreme Court',
        url: 'https://main.sci.gov.in/',
        source: 'Official SC Portal',
      });
    }
    links.push({
      label: 'Indian Kanoon',
      url: buildIndianKanoonSearchUrl(`${corpusMatch.caseName} ${corpusMatch.citation}`),
      source: 'Indian Kanoon',
    });

    return {
      id: `case_${startIndex}_${endIndex}`,
      kind: 'case',
      matchedText,
      canonicalTitle: corpusMatch.caseName,
      citationRef: extractedReporter || corpusMatch.citation,
      startIndex,
      endIndex,
      verificationTier: 'verified_corpus',
      subtitle: `${corpusMatch.court} · ${corpusMatch.bench} (${corpusMatch.year})`,
      summary: corpusMatch.ratio,
      secondaryNote: corpusMatch.practicalApplication,
      links,
    };
  }

  links.push({
    label: 'Verify on Indian Kanoon',
    url: buildIndianKanoonSearchUrl(matchedText),
    source: 'Indian Kanoon',
  });
  links.push({
    label: 'Supreme Court eSCR',
    url: 'https://digiscr.sci.gov.in/',
    source: 'Official eSCR',
  });

  return {
    id: `case_${startIndex}_${endIndex}`,
    kind: 'case',
    matchedText,
    canonicalTitle: extractedCaseName.trim(),
    citationRef: extractedReporter,
    startIndex,
    endIndex,
    verificationTier: groundedMatch ? 'grounded_source' : 'detected_lookup',
    subtitle: groundedMatch
      ? groundedMatch.courtOrSource || 'Grounded Case Authority'
      : 'Detected Case Authority',
    summary: groundedMatch
      ? `Cited authority linked to grounded memo source (${groundedMatch.title}). Open the verified source or Indian Kanoon to read the full judgment.`
      : 'Detected judicial decision in research output. Verify exact citation and holding against official law reporters (eSCR / SCC / Indian Kanoon) before citing in court.',
    links,
  };
}

interface RawCandidate {
  startIndex: number;
  endIndex: number;
  priority: number;
  build: () => DetectedCitation;
}

/**
 * Pure, deterministic parser that detects Indian & international legal case names
 * and statutory provisions inside generated research text and enriches each match
 * with real-time summaries, BNS/BNSS/BSA crosswalks, and verified reference links.
 */
export function parseLegalCitations(
  text: string,
  groundedCitations: VerifiedCitation[] = []
): ParsedCitationResult {
  if (!text) {
    return { segments: [], citations: [], uniqueCases: [], uniqueStatutes: [] };
  }

  const candidates: RawCandidate[] = [];

  // 1. Case Name Pattern:
  // Matches "<Party A> v./vs./versus <Party B>" plus optional attached neutral/reporter citation
  // e.g. "Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh (2024 INSC 626)"
  // e.g. "Arnesh Kumar v. State of Bihar (2014) 8 SCC 273"
  // e.g. "Cavendish Square Holding BV v. Talal El Makdessi [2015] UKSC 67"
  const partyToken =
    "(?:(?:M\\/s\\.?|Dr\\.?|Mr\\.?|Ms\\.?|Mst\\.?|Ch\\.?|Justice|State|Union|Collector|Government|Central|In\\s+re|[A-Z][A-Za-z0-9'.&\\/-]*)(?:\\s*(?!\\(\\d{4}\\s+(?:SCC|INSC|AIR)|\\(\\d{4}\\)\\s+\\d+\\s+(?:SCC|SCR|Scale))\\([^()\\n]{1,22}\\))?)";
  const connectorToken =
    "(?:of|the|for|in|and|&|or|at|by|to|on|through|Ors\\.?|Anr\\.?|Ltd\\.?|Pvt\\.?|Inc\\.?|Co\\.?|LLP|BV|DPC|Corp\\.?|Corporation|JV)";
  const partyPhrase = `${partyToken}(?:,?\\s+(?:${partyToken}|${connectorToken})){0,6}`;
  const reporterCitation =
    "(?:,?\\s*(?:\\(\\d{4}\\s+(?:SCC\\s+OnLine\\s+[A-Za-z]{2,6}\\s+\\d+|INSC\\s+\\d+|AIR\\s+[A-Za-z]{2,6}\\s+\\d+)\\)|\\(\\d{4}\\)\\s+\\d+\\s+(?:SCC|SCR|Scale|All\\s+ER|AC|WLR)\\s+\\d+|\\d{4}\\s+(?:Supp\\s+\\(\\d+\\)\\s+SCC|INSC|SCC\\s+OnLine\\s+[A-Za-z]{2,6})\\s+\\d+|AIR\\s+\\d{4}\\s+[A-Za-z]{2,6}\\s+\\d+|\\[\\d{4}\\]\\s+[A-Za-z]{2,6}\\s+\\d+))?";

  const caseRegex = new RegExp(
    `\\b(${partyPhrase})\\s+(v\\.|vs\\.?|versus)\\s+(${partyPhrase})(${reporterCitation})`,
    'g'
  );

  let match: RegExpExecArray | null;
  while ((match = caseRegex.exec(text)) !== null) {
    const fullMatch = match[0].replace(/[.,;:\s]+$/, '');
    const partyA = match[1].trim();
    const partyB = match[3].trim();
    const rawReporter = match[4]?.replace(/^[,\s]+/, '').trim() || undefined;
    const caseNameOnly = `${partyA} ${match[2]} ${partyB}`.replace(/[.,;:\s]+$/, '');

    // Guard against false positives (e.g. overly generic lowercase lead-ins or tiny fragments)
    if (partyA.length < 3 || partyB.length < 3) continue;
    if (/^(Section|Sec|Article|Clause|Rule|Order|Chapter|Part|Note|See|Highlight)$/i.test(partyA.split(/\s+/)[0])) {
      continue;
    }

    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 30,
      build: () =>
        buildCaseDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          caseNameOnly,
          rawReporter,
          groundedCitations
        ),
    });
  }

  // 2. Criminal Code & Major Act Sections (Section-first):
  // e.g. "Section 318(4) BNS", "Sec. 482 BNSS", "u/s 528 BNSS", "Section 420 IPC",
  // "Section 63(4) BSA", "Section 65B of the Indian Evidence Act", "Section 73 Indian Contract Act",
  // "Section 48 Arbitration & Conciliation Act", "Section 138 NI Act", "Section 5 of the Limitation Act"
  const statuteSectionFirstRegex =
    /\b(?:Sections?|Sec\.?|S\.|u\/s)\s+(\d+[A-Za-z]?(?:\(\d+\))?(?:\([a-z]\))?)\s*(?:of\s+(?:the\s+)?)?(BNS|Bharatiya\s+Nyaya\s+Sanhita(?:,?\s*2023)?|BNSS|Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita(?:,?\s*2023)?|BSA|Bharatiya\s+Sakshya\s+Adhiniyam(?:,?\s*2023)?|IPC|I\.P\.C\.?|Indian\s+Penal\s+Code(?:,?\s*1860)?|CrPC|Cr\.P\.C\.?|Code\s+of\s+Criminal\s+Procedure(?:,?\s*1973)?|IEA|I\.E\.A\.?|Indian\s+Evidence\s+Act(?:,?\s*1872)?|Evidence\s+Act(?:,?\s*1872)?|Indian\s+Contract\s+Act(?:,?\s*1872)?|Contract\s+Act(?:,?\s*1872)?|Arbitration\s*(?:&|and)\s*Conciliation\s+Act(?:,?\s*1996)?|Arbitration\s+Act(?:,?\s*1996)?|A&C\s+Act|NI\s+Act|Negotiable\s+Instruments\s+Act(?:,?\s*1881)?|Limitation\s+Act(?:,?\s*1963)?|CGST\s+Act|Companies\s+Act(?:,?\s*2013)?|IBC|Insolvency\s+and\s+Bankruptcy\s+Code(?:,?\s*2016)?|CPC|Code\s+of\s+Civil\s+Procedure(?:,?\s*1908)?)\b/gi;

  while ((match = statuteSectionFirstRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const section = match[1];
    const act = match[2];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 25,
      build: () =>
        buildStatuteDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          section,
          act,
          groundedCitations
        ),
    });
  }

  // 3. Code-first shorthand:
  // e.g. "BNS 318(4)", "IPC 420", "BNSS 482", "CrPC 438", "BSA 63", "IEA 65B"
  const statuteCodeFirstRegex =
    /\b(BNS|BNSS|BSA|IPC|I\.P\.C\.?|CrPC|Cr\.P\.C\.?|IEA|I\.E\.A\.?)\s+(?:Sections?|Sec\.?|S\.)?\s*(\d+[A-Za-z]?(?:\(\d+\))?)\b/gi;

  while ((match = statuteCodeFirstRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const act = match[1];
    const section = match[2];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 20,
      build: () =>
        buildStatuteDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          section,
          act,
          groundedCitations
        ),
    });
  }

  // 4. Constitutional Articles & International Conventions + CPC Orders:
  // e.g. "Article 21", "Article 226 of the Constitution", "Article V(2)(b) New York Convention", "Order XIX Rule 3 CPC"
  const constitutionalArticleRegex =
    /\b(?:Articles?|Art\.?)\s+(\d+[A-Za-z]?(?:\(\d+\))?)(?:\s+of\s+(?:the\s+)?Constitution(?:\s+of\s+India)?)?\b/gi;

  while ((match = constitutionalArticleRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const articleNum = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 22,
      build: () =>
        buildStatuteDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          articleNum,
          'Constitution of India',
          groundedCitations
        ),
    });
  }

  const nyConventionRegex =
    /\bArticle\s+(V(?:\(\d+\))?(?:\([a-z]\))?)\s*(?:of\s+(?:the\s+)?)?New\s+York\s+Convention\b/gi;

  while ((match = nyConventionRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const articleNum = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 24,
      build: () =>
        buildStatuteDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          articleNum,
          'New York Convention',
          groundedCitations
        ),
    });
  }

  const cpcOrderRegex =
    /\bOrder\s+([IVXLC]+)\s+Rule\s+(\d+)\s*(?:of\s+(?:the\s+)?)?(CPC|Code\s+of\s+Civil\s+Procedure)\b/gi;

  while ((match = cpcOrderRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const orderRule = `Order ${match[1].toUpperCase()} Rule ${match[2]}`;
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    candidates.push({
      startIndex,
      endIndex,
      priority: 24,
      build: () =>
        buildStatuteDetectedCitation(
          fullMatch,
          startIndex,
          endIndex,
          orderRule,
          'CPC',
          groundedCitations
        ),
    });
  }

  // Resolve overlaps deterministically: prefer higher priority, then longer span, then earlier index.
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const lenDiff = b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
    if (lenDiff !== 0) return lenDiff;
    return a.startIndex - b.startIndex;
  });

  const accepted: RawCandidate[] = [];
  for (const cand of candidates) {
    const overlaps = accepted.some(
      (existing) => cand.startIndex < existing.endIndex && cand.endIndex > existing.startIndex
    );
    if (!overlaps) {
      accepted.push(cand);
    }
  }

  accepted.sort((a, b) => a.startIndex - b.startIndex);

  const citations: DetectedCitation[] = accepted.map((c) => c.build());
  const segments: ParsedTextSegment[] = [];
  let cursor = 0;

  for (const cit of citations) {
    if (cit.startIndex > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, cit.startIndex) });
    }
    segments.push({ type: 'citation', citation: cit });
    cursor = cit.endIndex;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  const seenCaseKeys = new Set<string>();
  const seenStatuteKeys = new Set<string>();
  const uniqueCases: DetectedCitation[] = [];
  const uniqueStatutes: DetectedCitation[] = [];

  for (const cit of citations) {
    const dedupKey = cit.canonicalTitle.toLowerCase();
    if (cit.kind === 'case') {
      if (!seenCaseKeys.has(dedupKey)) {
        seenCaseKeys.add(dedupKey);
        uniqueCases.push(cit);
      }
    } else {
      if (!seenStatuteKeys.has(dedupKey)) {
        seenStatuteKeys.add(dedupKey);
        uniqueStatutes.push(cit);
      }
    }
  }

  return {
    segments,
    citations,
    uniqueCases,
    uniqueStatutes,
  };
}
