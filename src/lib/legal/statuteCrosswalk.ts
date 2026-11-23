export type LegacyCode = 'IPC' | 'CrPC' | 'IEA';
export type NewCode = 'BNS' | 'BNSS' | 'BSA';

export interface StatuteMapping {
  legacyCode: LegacyCode;
  legacySection: string;
  newCode: NewCode;
  newSection: string;
  title: string;
  keyChangeNote: string;
  changeImpact: 'substantive_change' | 'renumbered' | 'expanded_scope';
}

export interface DraftCitationMatch {
  id: string;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  legacyCode: LegacyCode;
  legacySection: string;
  replacementText: string;
  mapping: StatuteMapping;
}

export const STATUTE_CROSSWALK: StatuteMapping[] = [
  // IPC 1860 -> BNS 2023
  {
    legacyCode: 'IPC',
    legacySection: '34',
    newCode: 'BNS',
    newSection: '3(5)',
    title: 'Acts done by several persons in furtherance of common intention',
    keyChangeNote: 'Consolidated into General Explanations under Section 3(5) BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '120B',
    newCode: 'BNS',
    newSection: '61(2)',
    title: 'Punishment of criminal conspiracy',
    keyChangeNote: 'Criminal conspiracy definition and punishment unified under Section 61 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '124A',
    newCode: 'BNS',
    newSection: '152',
    title: 'Acts endangering sovereignty, unity and integrity of India',
    keyChangeNote: 'Sedition repealed; replaced by Section 152 BNS with electronic communication and financial means expressly covered.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '141',
    newCode: 'BNS',
    newSection: '189(1)',
    title: 'Unlawful assembly',
    keyChangeNote: 'Retained in substance under Section 189 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '279',
    newCode: 'BNS',
    newSection: '281',
    title: 'Rash driving or riding on a public way',
    keyChangeNote: 'Renumbered to Section 281 BNS; note enhanced hit-and-run framework in Section 106(2).',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '302',
    newCode: 'BNS',
    newSection: '103(1)',
    title: 'Punishment for murder',
    keyChangeNote: 'Section 103(2) introduces a dedicated provision for mob lynching by a group of five or more persons.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'IPC',
    legacySection: '304',
    newCode: 'BNS',
    newSection: '105',
    title: 'Punishment for culpable homicide not amounting to murder',
    keyChangeNote: 'Minimum sentence of 5 years introduced under Part I.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '304A',
    newCode: 'BNS',
    newSection: '106',
    title: 'Causing death by negligence',
    keyChangeNote: 'Enhanced imprisonment up to 5 years (2 years for registered medical practitioners); Sec. 106(2) covers hit-and-run.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '304B',
    newCode: 'BNS',
    newSection: '80',
    title: 'Dowry death',
    keyChangeNote: 'Consolidated under Chapter V (Offences against Woman and Child) as Section 80 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '306',
    newCode: 'BNS',
    newSection: '108',
    title: 'Abetment of suicide',
    keyChangeNote: 'Renumbered as Section 108 BNS; child/insane person abetment under Section 107.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '307',
    newCode: 'BNS',
    newSection: '109',
    title: 'Attempt to murder',
    keyChangeNote: 'Renumbered as Section 109 BNS with life-convict clause in 109(2).',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '323',
    newCode: 'BNS',
    newSection: '115(2)',
    title: 'Punishment for voluntarily causing hurt',
    keyChangeNote: 'Maximum fine increased from ₹1,000 to ₹10,000.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '324',
    newCode: 'BNS',
    newSection: '118(1)',
    title: 'Voluntarily causing hurt by dangerous weapons or means',
    keyChangeNote: 'Fine enhanced up to ₹20,000 under Section 118(1) BNS.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '354',
    newCode: 'BNS',
    newSection: '74',
    title: 'Assault or criminal force to woman with intent to outrage her modesty',
    keyChangeNote: 'Placed in Chapter V as Section 74 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '376',
    newCode: 'BNS',
    newSection: '64',
    title: 'Punishment for rape',
    keyChangeNote: 'Minimum punishment 10 years; see also Section 69 BNS for deceitful promise of marriage.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'IPC',
    legacySection: '379',
    newCode: 'BNS',
    newSection: '303(2)',
    title: 'Punishment for theft',
    keyChangeNote: 'Community service introduced for first-time petty theft under ₹5,000; enhanced penalty for repeat offenders.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '384',
    newCode: 'BNS',
    newSection: '308(2)',
    title: 'Punishment for extortion',
    keyChangeNote: 'Imprisonment enhanced from 3 years to 7 years.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '406',
    newCode: 'BNS',
    newSection: '316(2)',
    title: 'Punishment for criminal breach of trust',
    keyChangeNote: 'Maximum imprisonment increased from 3 years to 5 years.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '409',
    newCode: 'BNS',
    newSection: '316(5)',
    title: 'Criminal breach of trust by public servant, banker, merchant or agent',
    keyChangeNote: 'Unified under Section 316(5) BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '415',
    newCode: 'BNS',
    newSection: '318(1)',
    title: 'Cheating (Definition)',
    keyChangeNote: 'Definition and graded punishments consolidated under Section 318 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '420',
    newCode: 'BNS',
    newSection: '318(4)',
    title: 'Cheating and dishonestly inducing delivery of property',
    keyChangeNote: 'Consolidated under Section 318(4) BNS (up to 7 years imprisonment and fine); check Section 111 for organized economic crime.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'IPC',
    legacySection: '465',
    newCode: 'BNS',
    newSection: '336(2)',
    title: 'Punishment for forgery',
    keyChangeNote: 'Definition and punishments grouped under Section 336 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '467',
    newCode: 'BNS',
    newSection: '338',
    title: 'Forgery of valuable security, will, etc.',
    keyChangeNote: 'Renumbered to Section 338 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '468',
    newCode: 'BNS',
    newSection: '336(3)',
    title: 'Forgery for purpose of cheating',
    keyChangeNote: 'Consolidated as Section 336(3) BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '471',
    newCode: 'BNS',
    newSection: '340(2)',
    title: 'Using as genuine a forged document or electronic record',
    keyChangeNote: 'Explicitly covers electronic records under Section 340(2) BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '498A',
    newCode: 'BNS',
    newSection: '85',
    title: 'Husband or relative of husband of a woman subjecting her to cruelty',
    keyChangeNote: 'Definition of cruelty split into Section 86 BNS; substantive offence under Section 85 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '499',
    newCode: 'BNS',
    newSection: '356(1)',
    title: 'Defamation',
    keyChangeNote: 'Community service added as an alternative punishment in Section 356(2) BNS.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '500',
    newCode: 'BNS',
    newSection: '356(2)',
    title: 'Punishment for defamation',
    keyChangeNote: 'Community service added alongside simple imprisonment up to 2 years or fine.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IPC',
    legacySection: '504',
    newCode: 'BNS',
    newSection: '352',
    title: 'Intentional insult with intent to provoke breach of peace',
    keyChangeNote: 'Renumbered as Section 352 BNS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IPC',
    legacySection: '506',
    newCode: 'BNS',
    newSection: '351(2)',
    title: 'Punishment for criminal intimidation',
    keyChangeNote: 'Consolidated under Section 351(2) & 351(3) BNS.',
    changeImpact: 'renumbered',
  },

  // CrPC 1973 -> BNSS 2023
  {
    legacyCode: 'CrPC',
    legacySection: '41A',
    newCode: 'BNSS',
    newSection: '35(3)',
    title: 'Notice of appearance before police officer',
    keyChangeNote: 'Arnesh Kumar safeguard incorporated into Section 35(3)–(6) BNSS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '125',
    newCode: 'BNSS',
    newSection: '144',
    title: 'Order for maintenance of wives, children and parents',
    keyChangeNote: 'Renumbered as Section 144 BNSS with unchanged substantive principles.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '154',
    newCode: 'BNSS',
    newSection: '173',
    title: 'Information in cognizable cases (FIR / Zero FIR / e-FIR)',
    keyChangeNote: 'Expressly codifies Zero FIR, electronic FIR (signed within 3 days), and preliminary inquiry for 3–7 year offences.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '156(3)',
    newCode: 'BNSS',
    newSection: '175(3)',
    title: 'Magistrate order for police investigation',
    keyChangeNote: 'Requires prior SP application under Sec. 173(4) and affidavit; Magistrate may consider police submissions before ordering.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '161',
    newCode: 'BNSS',
    newSection: '180',
    title: 'Examination of witnesses by police',
    keyChangeNote: 'Permits audio-video electronic recording of witness statements.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '164',
    newCode: 'BNSS',
    newSection: '183',
    title: 'Recording of confessions and statements before Magistrate',
    keyChangeNote: 'Mandatory Magistrate statement in offences carrying 10+ years imprisonment and specified sexual offences.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '167',
    newCode: 'BNSS',
    newSection: '187',
    title: 'Procedure when investigation cannot be completed in 24 hours (Remand / Default Bail)',
    keyChangeNote: 'Police custody (up to 15 days) may now be sought in tranches within the first 40 or 60 days of detention.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '173',
    newCode: 'BNSS',
    newSection: '193',
    title: 'Report of police officer on completion of investigation (Chargesheet)',
    keyChangeNote: 'Electronic forwarding permitted; victim/informant must be updated on progress within 90 days.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '200',
    newCode: 'BNSS',
    newSection: '223',
    title: 'Examination of complainant',
    keyChangeNote: 'Proviso mandates giving the accused an opportunity of being heard before taking cognizance on a private complaint.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '227',
    newCode: 'BNSS',
    newSection: '250',
    title: 'Discharge in Sessions trial',
    keyChangeNote: 'Accused may prefer discharge application within 60 days from committal.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '313',
    newCode: 'BNSS',
    newSection: '351',
    title: 'Power to examine the accused',
    keyChangeNote: 'Renumbered as Section 351 BNSS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '389',
    newCode: 'BNSS',
    newSection: '430',
    title: 'Suspension of sentence pending appeal; release of appellant on bail',
    keyChangeNote: 'Renumbered as Section 430 BNSS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '437',
    newCode: 'BNSS',
    newSection: '480',
    title: 'When bail may be taken in case of non-bailable offence',
    keyChangeNote: 'Renumbered as Section 480 BNSS; see Section 479 BNSS for first-time undertrial release at 1/3rd maximum sentence.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '438',
    newCode: 'BNSS',
    newSection: '482',
    title: 'Direction for grant of bail to person apprehending arrest (Anticipatory Bail)',
    keyChangeNote: 'Streamlined statutory factors; check exclusions for gang rape of minor under Section 482(4) BNSS.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '439',
    newCode: 'BNSS',
    newSection: '483',
    title: 'Special powers of High Court or Court of Session regarding bail',
    keyChangeNote: 'Renumbered as Section 483 BNSS.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'CrPC',
    legacySection: '482',
    newCode: 'BNSS',
    newSection: '528',
    title: 'Saving of inherent powers of High Court (Quashing)',
    keyChangeNote: 'Verbatim preservation of inherent High Court quashing jurisdiction under Section 528 BNSS.',
    changeImpact: 'renumbered',
  },

  // Indian Evidence Act 1872 -> Bharatiya Sakshya Adhiniyam 2023
  {
    legacyCode: 'IEA',
    legacySection: '27',
    newCode: 'BSA',
    newSection: '23(2)',
    title: 'How much of information received from accused may be proved',
    keyChangeNote: 'Consolidated as proviso to Section 23(2) BSA.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IEA',
    legacySection: '32',
    newCode: 'BSA',
    newSection: '26',
    title: 'Cases in which statement of relevant fact by person who is dead or cannot be found is relevant (Dying Declaration)',
    keyChangeNote: 'Renumbered as Section 26 BSA.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IEA',
    legacySection: '45',
    newCode: 'BSA',
    newSection: '39(1)',
    title: 'Opinions of experts',
    keyChangeNote: 'Broadened to expressly include "any other field" and electronic evidence examiners under Section 39(2) BSA.',
    changeImpact: 'expanded_scope',
  },
  {
    legacyCode: 'IEA',
    legacySection: '65B',
    newCode: 'BSA',
    newSection: '63',
    title: 'Admissibility of electronic records',
    keyChangeNote: 'Expanded to semiconductor memory, cloud/server logs, and mandatory statutory Schedule Certificate signed by person in charge AND an expert.',
    changeImpact: 'substantive_change',
  },
  {
    legacyCode: 'IEA',
    legacySection: '101',
    newCode: 'BSA',
    newSection: '104',
    title: 'Burden of proof',
    keyChangeNote: 'Renumbered as Section 104 BSA.',
    changeImpact: 'renumbered',
  },
  {
    legacyCode: 'IEA',
    legacySection: '114',
    newCode: 'BSA',
    newSection: '119',
    title: 'Court may presume existence of certain facts',
    keyChangeNote: 'Renumbered as Section 119 BSA.',
    changeImpact: 'renumbered',
  },
];

const CODE_ALIAS_MAP: Record<string, LegacyCode> = {
  ipc: 'IPC',
  'i.p.c': 'IPC',
  'i.p.c.': 'IPC',
  'indian penal code': 'IPC',
  crpc: 'CrPC',
  'cr.p.c': 'CrPC',
  'cr.p.c.': 'CrPC',
  'code of criminal procedure': 'CrPC',
  iea: 'IEA',
  'i.e.a': 'IEA',
  'i.e.a.': 'IEA',
  'indian evidence act': 'IEA',
  'evidence act': 'IEA',
};

function normalizeSectionKey(section: string): string {
  return section.trim().toUpperCase().replace(/\s+/g, '');
}

export function findExactMapping(legacyCode: LegacyCode, section: string): StatuteMapping | undefined {
  const key = normalizeSectionKey(section);
  return STATUTE_CROSSWALK.find(
    (m) => m.legacyCode === legacyCode && normalizeSectionKey(m.legacySection) === key
  );
}

export function lookupStatuteMappings(query: string): StatuteMapping[] {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return STATUTE_CROSSWALK.slice(0, 12);
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  return STATUTE_CROSSWALK.filter((entry) => {
    const haystack = [
      entry.legacyCode,
      entry.legacySection,
      `${entry.legacyCode} ${entry.legacySection}`,
      entry.newCode,
      entry.newSection,
      `${entry.newCode} ${entry.newSection}`,
      entry.title,
      entry.keyChangeNote,
    ]
      .join(' ')
      .toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}

/**
 * Deterministic scanner that identifies legacy IPC / CrPC / Indian Evidence Act citations
 * inside any legal draft and returns exact character ranges and BNS / BNSS / BSA replacements.
 */
export function scanDraftForLegacyCitations(text: string): DraftCitationMatch[] {
  if (!text) return [];
  const matches: DraftCitationMatch[] = [];
  const seenRanges = new Set<string>();

  // Pattern 1: Section / S. / u/s <num> (of the)? (IPC | CrPC | Cr.P.C. | Indian Penal Code | Indian Evidence Act | Evidence Act | IEA)
  const patternSectionFirst =
    /\b(?:Sections?|Sec\.?|S\.|u\/s)\s+(\d+[A-Za-z]?(?:\(\d+\))?)\s*(?:of\s+(?:the\s+)?)?(IPC|I\.P\.C\.?|Indian\s+Penal\s+Code(?:,?\s*1860)?|CrPC|Cr\.P\.C\.?|Code\s+of\s+Criminal\s+Procedure(?:,?\s*1973)?|IEA|I\.E\.A\.?|Indian\s+Evidence\s+Act(?:,?\s*1872)?|Evidence\s+Act(?:,?\s*1872)?)\b/gi;

  // Pattern 2: (IPC | CrPC | IEA) Section? <num>
  const patternCodeFirst =
    /\b(IPC|I\.P\.C\.?|CrPC|Cr\.P\.C\.?|IEA|I\.E\.A\.?)\s+(?:Sections?|Sec\.?|S\.)?\s*(\d+[A-Za-z]?(?:\(\d+\))?)\b/gi;

  const registerMatch = (
    matchedText: string,
    startIndex: number,
    rawSection: string,
    rawCode: string
  ) => {
    const normalizedCodeKey = rawCode
      .toLowerCase()
      .replace(/,?\s*\d{4}$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const legacyCode = CODE_ALIAS_MAP[normalizedCodeKey];
    if (!legacyCode) return;

    const mapping = findExactMapping(legacyCode, rawSection);
    if (!mapping) return;

    const endIndex = startIndex + matchedText.length;

    // Skip legacy references already preserved as historical parenthetical annotations
    // e.g. "Section 318(4) BNS (formerly Section 420 IPC)"
    const preceding = text.slice(Math.max(0, startIndex - 28), startIndex);
    if (/\(\s*(?:formerly|earlier|erstwhile|corresponding\s+to)\s*$/i.test(preceding)) {
      return;
    }

    const rangeKey = `${startIndex}:${endIndex}`;
    if (seenRanges.has(rangeKey)) return;
    if (matches.some((existing) => startIndex < existing.endIndex && endIndex > existing.startIndex)) {
      return;
    }
    seenRanges.add(rangeKey);

    const replacementText = `Section ${mapping.newSection} ${mapping.newCode} (formerly Section ${mapping.legacySection} ${mapping.legacyCode})`;
    matches.push({
      id: `cit_${startIndex}_${endIndex}`,
      matchedText,
      startIndex,
      endIndex,
      legacyCode,
      legacySection: mapping.legacySection,
      replacementText,
      mapping,
    });
  };

  let m: RegExpExecArray | null;
  while ((m = patternSectionFirst.exec(text)) !== null) {
    registerMatch(m[0], m.index, m[1], m[2]);
  }
  while ((m = patternCodeFirst.exec(text)) !== null) {
    registerMatch(m[0], m.index, m[2], m[1]);
  }

  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Applies selected citation replacements cleanly in descending offset order
 * so earlier offsets never shift.
 */
export function applyCitationReplacements(
  text: string,
  matches: DraftCitationMatch[],
  selectedIds?: string[]
): string {
  const chosen = selectedIds
    ? matches.filter((m) => selectedIds.includes(m.id))
    : matches;

  const sortedDesc = [...chosen].sort((a, b) => b.startIndex - a.startIndex);
  let result = text;
  for (const item of sortedDesc) {
    // Guard against overlapping ranges
    if (
      item.startIndex >= 0 &&
      item.endIndex <= result.length &&
      result.slice(item.startIndex, item.endIndex) === item.matchedText
    ) {
      result =
        result.slice(0, item.startIndex) +
        item.replacementText +
        result.slice(item.endIndex);
    }
  }
  return result;
}
