import type { JurisdictionMode } from '../../types/legal';

export interface JudicialPrecedent {
  id: string;
  caseName: string;
  citation: string;
  court: string;
  bench: string;
  year: number;
  jurisdiction: JurisdictionMode;
  statutes: string[];
  keywords: string[];
  ratio: string;
  practicalApplication: string;
}

export const SUPREME_COURT_CORPUS: JudicialPrecedent[] = [
  {
    id: 'sc-sushila-aggarwal-2020',
    caseName: 'Sushila Aggarwal & Ors. v. State (NCT of Delhi)',
    citation: '(2020) 5 SCC 1',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 2020,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 482', 'CrPC 438', 'Article 21'],
    keywords: ['anticipatory bail', 'pre-arrest', 'duration', 'conditions', 'liberty', 'bail', '482', '438'],
    ratio:
      'Protection granted under anticipatory bail (formerly Sec. 438 CrPC, now Sec. 482 BNSS) should not invariably be limited to a fixed period and can continue until conclusion of trial unless special circumstances warrant otherwise.',
    practicalApplication:
      'Cite to oppose prosecution attempts to curtail interim pre-arrest protection or insist on automatic surrender after filing of chargesheet.',
  },
  {
    id: 'sc-arnesh-kumar-2014',
    caseName: 'Arnesh Kumar v. State of Bihar',
    citation: '(2014) 8 SCC 273',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2014,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 35', 'CrPC 41A', 'BNSS 482', 'BNS 85', 'IPC 498A'],
    keywords: ['arrest', 'notice', '41a', '35 bnss', 'bail', 'seven years', 'custodial', 'matrimonial', 'commercial'],
    ratio:
      'Police officers must not mechanically arrest in offences punishable with imprisonment up to 7 years; mandatory written notice of appearance (now Sec. 35(3) BNSS) and recorded reasons for necessity of arrest are binding.',
    practicalApplication:
      'Anchor every bail and writ petition challenging arbitrary arrest where offences carry <= 7 years punishment or documentary investigation is complete.',
  },
  {
    id: 'sc-satender-kumar-antil-2022',
    caseName: 'Satender Kumar Antil v. Central Bureau of Investigation',
    citation: '(2022) 10 SCC 51',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2022,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 35', 'BNSS 480', 'BNSS 482', 'BNSS 483', 'Article 21'],
    keywords: ['bail is the rule', 'jail is exception', 'economic offence', 'chargesheet', '41a', 'regular bail', 'anticipatory bail'],
    ratio:
      'Bail is the rule and jail is the exception; non-compliance with Sec. 41/41A CrPC (Sec. 35 BNSS) entitles the accused to bail, and economic offences cannot be treated as a monolithic bar to liberty.',
    practicalApplication:
      'Essential authority for both regular bail (Sec. 483 BNSS) and anticipatory bail (Sec. 482 BNSS) in commercial/economic offences where accused cooperated.',
  },
  {
    id: 'sc-delhi-race-club-2024',
    caseName: 'Delhi Race Club (1940) Ltd. & Ors. v. State of Uttar Pradesh',
    citation: '2024 INSC 626 / (2024) 10 SCC 690',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2024,
    jurisdiction: 'india_litigation',
    statutes: ['BNS 318(4)', 'BNS 316(2)', 'IPC 420', 'IPC 406', 'BNSS 528'],
    keywords: ['cheating', 'criminal breach of trust', '420', '406', '318', '316', 'commercial dispute', 'quashing', 'mutually exclusive'],
    ratio:
      'Cheating (IPC 420 / BNS 318(4)) and Criminal Breach of Trust (IPC 406 / BNS 316(2)) are mutually antithetical and cannot coexist on the same set of facts; commercial payment defaults cannot be dressed up as criminal offences.',
    practicalApplication:
      'Knockout Supreme Court precedent for quashing petitions (Sec. 528 BNSS) and anticipatory bail where FIR mechanically invokes both cheating and breach of trust over a contract dispute.',
  },
  {
    id: 'sc-bhajan-lal-1992',
    caseName: 'State of Haryana & Ors. v. Ch. Bhajan Lal & Ors.',
    citation: '1992 Supp (1) SCC 335',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 1992,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 528', 'CrPC 482', 'Article 226'],
    keywords: ['quashing', 'fir', 'abuse of process', 'malafide', '528 bnss', '482 crpc', 'inherent powers', 'writ'],
    ratio:
      'Establishes the 7 canonical categories where High Courts may exercise inherent power (now Sec. 528 BNSS) or writ jurisdiction (Art. 226) to quash an FIR, including where allegations taken at face value disclose no offence or are manifestly attended with mala fide.',
    practicalApplication:
      'Structure every High Court Quashing Petition and Writ Petition grounds explicitly around Categories 1, 3, 5, and 7 of Bhajan Lal.',
  },
  {
    id: 'sc-arjun-panditrao-2020',
    caseName: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal',
    citation: '(2020) 7 SCC 1',
    court: 'Supreme Court of India',
    bench: '3-Judge Bench',
    year: 2020,
    jurisdiction: 'india_litigation',
    statutes: ['BSA 63', 'IEA 65B', 'BSA 62'],
    keywords: ['electronic evidence', '65b', '63 bsa', 'certificate', 'affidavit', 'whatsapp', 'email', 'cdr', 'secondary evidence'],
    ratio:
      'A mandatory statutory certificate (formerly Sec. 65B(4) IEA, now Sec. 63(4) BSA 2023 with mandatory Schedule Part A & Part B expert certification) is a condition precedent to admissibility of secondary electronic records; primary original device production dispenses with it.',
    practicalApplication:
      'Cite both when filing a compliant Section 63 BSA electronic evidence affidavit and when objecting to uncertified WhatsApp/email printouts filed by the opponent.',
  },
  {
    id: 'sc-lalita-kumari-2014',
    caseName: 'Lalita Kumari v. Government of Uttar Pradesh',
    citation: '(2014) 2 SCC 1',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 2014,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 173', 'CrPC 154'],
    keywords: ['fir', 'preliminary inquiry', 'commercial offence', 'registration', '173 bnss', '154 crpc'],
    ratio:
      'While registration of FIR is mandatory for cognizable offences, commercial disputes, matrimonial disputes, medical negligence, and abnormal delay cases require a Preliminary Inquiry (now codified under Sec. 173(3) BNSS for 3-7 year offences).',
    practicalApplication:
      'Challenge hastily registered FIRs in commercial or delayed disputes where the officer bypassed mandatory Preliminary Inquiry under Sec. 173(3) BNSS.',
  },
  {
    id: 'sc-gurbaksh-sibia-1980',
    caseName: 'Gurbaksh Singh Sibbia v. State of Punjab',
    citation: '(1980) 2 SCC 565',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 1980,
    jurisdiction: 'india_litigation',
    statutes: ['BNSS 482', 'CrPC 438', 'Article 21'],
    keywords: ['anticipatory bail', 'discretion', 'constitutional liberty', '482', '438', 'presumption of innocence'],
    ratio:
      'Judicial discretion in granting anticipatory bail must be exercised liberally in light of Article 21 personal liberty and presumption of innocence; courts should not read artificial restrictions into the statute.',
    practicalApplication:
      'Foundational Constitution Bench authority supporting anticipatory bail in High Courts and Supreme Court SLPs.',
  },
  {
    id: 'sc-puttaswamy-2017',
    caseName: 'Justice K.S. Puttaswamy (Retd.) v. Union of India',
    citation: '(2017) 10 SCC 1',
    court: 'Supreme Court of India',
    bench: '9-Judge Constitution Bench',
    year: 2017,
    jurisdiction: 'india_litigation',
    statutes: ['Article 21', 'Article 14', 'Article 19', 'DPDP Act 2023'],
    keywords: ['privacy', 'proportionality', 'writ', 'fundamental right', 'constitutional', 'surveillance', 'data protection'],
    ratio:
      'Right to privacy is an intrinsic fundamental right under Article 21; any state intrusion must satisfy the four-fold proportionality test: legality, legitimate aim, suitability/necessity, and balancing.',
    practicalApplication:
      'Use in Article 32 / 226 Writ Petitions challenging unconstitutional digital seizure, phone cloning, or disproportionate regulatory action.',
  },
  {
    id: 'sc-collector-land-acquisition-1987',
    caseName: 'Collector, Land Acquisition, Anantnag v. Mst. Katiji',
    citation: '(1987) 2 SCC 107',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 1987,
    jurisdiction: 'india_litigation',
    statutes: ['Limitation Act Sec. 5', 'Article 136'],
    keywords: ['condonation of delay', 'limitation', 'sufficient cause', 'delay', 'affidavit', 'ia', 'slp'],
    ratio:
      'The expression "sufficient cause" under Section 5 of the Limitation Act must receive a liberal, justice-oriented construction so substantial justice prevails over technical considerations when no mala fides or deliberate inaction exist.',
    practicalApplication:
      'Anchor Interlocutory Applications (IA) and supporting affidavits seeking condonation of delay in SLPs, High Court appeals, and revisions.',
  },
  {
    id: 'sc-a-k-k-nambiar-1970',
    caseName: 'A.K.K. Nambiar v. Union of India & Anr.',
    citation: '(1969) 3 SCC 864 / AIR 1970 SC 652',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 1970,
    jurisdiction: 'india_litigation',
    statutes: ['CPC Order XIX Rule 3', 'Supreme Court Rules 2013'],
    keywords: ['affidavit', 'verification', 'personal knowledge', 'information received', 'deponent', 'oath'],
    ratio:
      'Verification of affidavits is not an empty formality; paragraphs must clearly distinguish matters true to personal knowledge from those believed to be true upon legal advice or record inspection, failing which the affidavit loses probative value.',
    practicalApplication:
      'Ensure every drafted affidavit has an ironclad Order XIX Rule 3 CPC verification clause and use it to attack defective opponent counter-affidavits.',
  },
  {
    id: 'sc-core-arbitration-2024',
    caseName: 'Central Organisation for Railway Electrification v. ECI-SPIC-SMO-MCML (JV)',
    citation: '2024 INSC 857',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 2024,
    jurisdiction: 'corporate_ma',
    statutes: ['Arbitration & Conciliation Act Sec. 11', 'Sec. 12(5)', 'Article 14'],
    keywords: ['arbitration', 'unilateral appointment', 'panel', 'independence', 'impartiality', 'section 11', 'contract'],
    ratio:
      'Unilateral appointment of a sole arbitrator or requiring the counterparty to choose from a curated panel prepared by one party violates equal treatment under Section 18 and independence under Section 12(5) of the A&C Act.',
    practicalApplication:
      'Cite in Section 11 petitions, contract redlines, and arbitration objections to invalidate one-sided arbitrator appointment clauses.',
  },
  {
    id: 'sc-fateh-chand-1963',
    caseName: 'Fateh Chand v. Balkishan Dass',
    citation: 'AIR 1963 SC 1405 / (1964) 1 SCR 515',
    court: 'Supreme Court of India',
    bench: '5-Judge Constitution Bench',
    year: 1963,
    jurisdiction: 'corporate_ma',
    statutes: ['Indian Contract Act Sec. 73', 'Indian Contract Act Sec. 74'],
    keywords: ['liquidated damages', 'penalty', 'indemnity', 'damages', 'cap', 'breach', 'commercial contract', 'msa', 'spa'],
    ratio:
      'Under Section 74 of the Indian Contract Act, a stipulated sum in a contract acts as an upper ceiling of reasonable compensation; penalty clauses are unenforceable without proof of actual loss unless genuine pre-estimate is established.',
    practicalApplication:
      'Core Indian commercial authority for redlining uncapped indemnities, liquidated damages, and termination penalties in MSAs, SPAs, and EPC contracts.',
  },
  {
    id: 'sc-vidya-drolia-2021',
    caseName: 'Vidya Drolia & Ors. v. Durga Trading Corporation',
    citation: '(2021) 2 SCC 1',
    court: 'Supreme Court of India',
    bench: '3-Judge Bench',
    year: 2021,
    jurisdiction: 'corporate_ma',
    statutes: ['Arbitration & Conciliation Act Sec. 8', 'Sec. 11'],
    keywords: ['arbitrability', 'four-fold test', 'fraud', 'section 8', 'section 11', 'commercial dispute'],
    ratio:
      'Establishes the four-fold test of non-arbitrability and holds that mere allegations of simple commercial fraud do not oust arbitration; referral courts only conduct a prima facie review under Section 11.',
    practicalApplication:
      'Use to defeat attempts to derail arbitration via parallel civil suits or criminal complaints alleging contractual fraud.',
  },
  {
    id: 'sc-ssangyong-2019',
    caseName: 'Ssangyong Engineering & Construction Co. Ltd. v. NHAI',
    citation: '(2019) 15 SCC 131',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2019,
    jurisdiction: 'global_multi',
    statutes: ['Arbitration & Conciliation Act Sec. 34', 'Sec. 48', 'New York Convention Art. V'],
    keywords: ['arbitral award', 'public policy', 'patent illegality', 'siac', 'enforcement', 'international arbitration', 'section 34', 'section 48'],
    ratio:
      'Narrowly confines "public policy of India" post-2015 Amendment to fundamental policy of Indian law and most basic notions of morality or justice; "patent illegality" does not apply to international commercial arbitration awards.',
    practicalApplication:
      'Key precedent for enforcing SIAC/ICC foreign awards in India under Section 48 or defending domestic awards under Section 34.',
  },
  {
    id: 'uk-cavendish-makdessi-2015',
    caseName: 'Cavendish Square Holding BV v. Talal El Makdessi',
    citation: '[2015] UKSC 67',
    court: 'Supreme Court of the United Kingdom',
    bench: '7-Justice Panel',
    year: 2015,
    jurisdiction: 'global_multi',
    statutes: ['English Common Law', 'Commercial Contracts'],
    keywords: ['liquidated damages', 'penalty', 'legitimate interest', 'epc', 'cross-border', 'siac', 'english law'],
    ratio:
      'A secondary obligation is an unenforceable penalty only if it imposes a detriment out of all proportion to any legitimate interest of the innocent party in enforcement of the primary obligation.',
    practicalApplication:
      'Benchmark international authority in English-law governed cross-border EPC, SaaS, and M&A disputes before SIAC or London tribunals.',
  },
  {
    id: 'sc-dashrath-rupsingh-ni-act',
    caseName: 'Meters and Instruments Pvt. Ltd. v. Kanchan Mehta / Sec. 138 NI Act Jurisprudence',
    citation: '(2018) 1 SCC 560',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2018,
    jurisdiction: 'india_litigation',
    statutes: ['NI Act Sec. 138', 'NI Act Sec. 142', 'BNSS 223'],
    keywords: ['cheque bounce', '138', 'dishonour', 'legal notice', 'negotiable instruments', 'compounding', 'demand notice'],
    ratio:
      'Offence under Section 138 NI Act is primarily a civil wrong with criminal overtones focused on compensatory justice; strict compliance with the 30-day demand notice and 15-day statutory cure period is mandatory.',
    practicalApplication:
      'Guides drafting of Section 138 NI Act statutory legal notices, limitation verification, and compounding applications.',
  },
  {
    id: 'sc-radha-krishan-2021',
    caseName: 'M/s Radha Krishan Industries v. State of Himachal Pradesh',
    citation: '(2021) 6 SCC 771',
    court: 'Supreme Court of India',
    bench: 'Division Bench',
    year: 2021,
    jurisdiction: 'india_litigation',
    statutes: ['Article 226', 'CGST Act Sec. 83'],
    keywords: ['writ petition', 'alternative remedy', 'natural justice', 'high court', '226', 'maintainability', 'tax', 'gst'],
    ratio:
      'Existence of an alternate statutory remedy does not bar High Court writ jurisdiction under Article 226 where fundamental rights are infringed, principles of natural justice are violated, proceedings are wholly without jurisdiction, or vires of legislation is challenged.',
    practicalApplication:
      'Crucial maintainability shield in every High Court Article 226 Writ Petition when State/Respondent objects on alternate remedy.',
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Deterministic real-time precedent retrieval (lightweight RAG) over verified
 * Supreme Court & High Court authorities.
 */
export function retrieveRelevantPrecedents(
  query: string,
  jurisdiction: JurisdictionMode,
  limit = 4
): JudicialPrecedent[] {
  const tokens = tokenize(query);
  const queryLower = query.toLowerCase();

  const scored = SUPREME_COURT_CORPUS.map((item) => {
    let score = item.jurisdiction === jurisdiction ? 3 : 0.5;

    for (const kw of item.keywords) {
      if (queryLower.includes(kw.toLowerCase())) {
        score += 6;
      }
    }
    for (const stat of item.statutes) {
      if (queryLower.includes(stat.toLowerCase())) {
        score += 7;
      }
    }

    const haystack = `${item.caseName} ${item.ratio} ${item.statutes.join(' ')} ${item.keywords.join(' ')}`.toLowerCase();
    for (const t of tokens) {
      if (haystack.includes(t)) {
        score += 1.2;
      }
    }

    // Slight boost for Constitution Benches and recent post-2020 precedents
    if (item.bench.includes('Constitution')) score += 0.8;
    if (item.year >= 2020) score += 0.5;

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((s) => s.item);
}

export function formatPrecedentGroundingBlock(precedents: JudicialPrecedent[]): string {
  if (precedents.length === 0) return '';
  return [
    'VERIFIED SUPREME COURT & HIGH COURT PRECEDENT CORPUS (DO NOT FABRICATE CITATIONS — PRIORITIZE THESE AUTHORITIES WHERE APPLICABLE):',
    ...precedents.map(
      (p, i) =>
        `${i + 1}. ${p.caseName}, ${p.citation} (${p.court}, ${p.bench}, ${p.year}) | Provisions: ${p.statutes.join(', ')}\n   Ratio: ${p.ratio}\n   Strategic Use: ${p.practicalApplication}`
    ),
  ].join('\n');
}
