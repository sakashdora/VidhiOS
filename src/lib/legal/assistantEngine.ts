import type {
  AssistantLanguageMode,
  AssistantVerifiedSource,
  DeadlineItem,
  JurisdictionMode,
  Matter,
  TrackedCase,
} from '../../types/legal';
import {
  lookupStatuteMappings,
  scanDraftForLegacyCitations,
} from './statuteCrosswalk';
import {
  LIMITATION_RULES,
  calculateLimitationDeadline,
} from './limitationCalculator';
import { retrieveRelevantPrecedents } from './supremeCourtCorpus';
import { getJudiciaryTemplate } from './judiciaryTemplates';

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const HINGLISH_HINT_RE =
  /\b(kya|hai|hain|batao|banao|likho|karo|mera|meri|mere|kanoon|dhara|jamaanat|zamanat|faisla|vakalatnama|tarikh|tareekh|sunwai|case ka|naya section|kijiye|bhejo|samjhao|hindi)\b/i;

export function detectResponseLanguage(
  userText: string,
  preference: AssistantLanguageMode
): 'en' | 'hi' | 'bilingual' {
  if (preference === 'hi') return 'hi';
  if (preference === 'en') return 'en';
  if (preference === 'bilingual') return 'bilingual';
  if (DEVANAGARI_RE.test(userText)) return 'hi';
  if (HINGLISH_HINT_RE.test(userText)) return 'bilingual';
  return 'en';
}

export type AssistantIntent =
  | { type: 'statute_lookup'; query: string }
  | { type: 'limitation_calc'; ruleId: string; triggerDate: string; saveDeadline: boolean }
  | { type: 'draft_form'; templateId: string; customInstructions: string }
  | { type: 'add_deadline'; title: string; dueDate: string }
  | { type: 'matter_status' }
  | { type: 'case_analysis' }
  | { type: 'precedent_search'; query: string }
  | { type: 'general_legal'; query: string };

const FORM_MATCHERS: Array<{ templateId: string; patterns: RegExp[] }> = [
  {
    templateId: 'sec_63_bsa_certificate',
    patterns: [/\b63\s*bsa\b/i, /\b65b\b/i, /electronic\s+evidence/i, /इलेक्ट्रॉनिक\s*साक्ष्य/i, /whatsapp\s+certificate/i],
  },
  {
    templateId: 'vakalatnama',
    patterns: [/vakalatnama/i, /वकालतनामा/i],
  },
  {
    templateId: 'anticipatory_bail_482_bnss',
    patterns: [/anticipatory\s+bail/i, /\b482\s*bnss\b/i, /\b438\s*crpc\b/i, /अग्रिम\s*जमानत/i, /agrim\s*zamanat/i, /pre-arrest\s+bail/i],
  },
  {
    templateId: 'quashing_528_bnss',
    patterns: [/quash/i, /\b528\s*bnss\b/i, /fir\s+रद्द/i, /एफआईआर\s*रद्द/i],
  },
  {
    templateId: 'slp_article_136',
    patterns: [/\bslp\b/i, /special\s+leave/i, /article\s+136/i, /विशेष\s*अनुमति\s*याचिका/i],
  },
  {
    templateId: 'writ_petition_226',
    patterns: [/writ\s+petition/i, /article\s+226/i, /article\s+32/i, /रिट\s*याचिका/i],
  },
  {
    templateId: 'counter_affidavit',
    patterns: [/counter\s+affidavit/i, /affidavit[\s-]in[\s-]reply/i, /जवाबी\s*हलफनामा/i, /प्रति\s*शपथ\s*पत्र/i],
  },
  {
    templateId: 'rejoinder_affidavit',
    patterns: [/rejoinder/i, /प्रत्युत्तर/i],
  },
  {
    templateId: 'ia_condonation_delay',
    patterns: [/condonation/i, /delay\s+application/i, /देरी\s*माफी/i, /विलंब\s*माफी/i],
  },
  {
    templateId: 'caveat_148a_cpc',
    patterns: [/caveat/i, /148a/i, /कैविएट/i],
  },
  {
    templateId: 'legal_notice_138_commercial',
    patterns: [/legal\s+notice/i, /demand\s+notice/i, /\b138\b.*ni\s*act/i, /कानूनी\s*नोटिस/i, /चेक\s*बाउंस/i],
  },
  {
    templateId: 'arbitration_sec9_sec11',
    patterns: [/arbitration\s+petition/i, /section\s+9\s+arbitration/i, /section\s+11\s+arbitration/i, /मध्यस्थता\s*याचिका/i],
  },
  {
    templateId: 'general_affidavit',
    patterns: [/affidavit/i, /हलफनामा/i, /शपथ\s*पत्र/i, /शपथपत्र/i, /एफिडेविट/i],
  },
];

const DRAFT_ACTION_VERBS =
  /\b(draft|write|create|generate|prepare|make|build|banao|likho|taiyar|tayar)\b|(बनाओ|बनाइए|बनाएँ|बनाएं|लिखो|लिखिए|लिखें|तैयार\s*करो|तैयार\s*करें|तैयार\s*कीजिए|ड्राफ्ट)/i;

const STATUTE_HINT_RE =
  /\b(ipc|crpc|iea|bns|bnss|bsa|section|sec\.?|crosswalk|mapped|equivalent|repealed|naya\s+section)\b|(धारा|सेक्शन|बीएनएस|बीएनएसएस|बीएसए|आईपीसी|सीआरपीसी)/i;

const LIMITATION_HINT_RE =
  /\b(limitation|deadline\s+calc|calculate\s+limitation|filing\s+window|expiry|time\s+limit|condonation\s+period|34\s+arbitration|slp\s+days)\b|(परिसीमा|सीमा\s*अवधि|अंतिम\s*तिथि|लिमिटेशन)/i;

const REMINDER_HINT_RE =
  /\b(remind|add\s+deadline|pin\s+deadline|set\s+reminder|create\s+deadline|schedule\s+task)\b|(रिमाइंडर|डेडलाइन\s*जोड़ो|याद\s*दिलाओ|तारीख\s*सेव)/i;

const MATTER_STATUS_HINT_RE =
  /\b(my\s+case|my\s+hearing|next\s+hearing|cause\s+list|pending\s+deadline|matter\s+status|active\s+matter|summary\s+of\s+my\s+case|what\s+is\s+pending|docket)\b|(मेरा\s*केस|अगली\s*सुनवाई|पेंडिंग|डेडलाइन\s*बताओ|केस\s*स्टेटस|सुनवाई\s*कब)/i;

const CASE_ANALYSIS_HINT_RE =
  /\b(analy[sz]e\s+(my\s+)?(active\s+|current\s+)?case|case\s+analysis|strength\s+of\s+(my\s+)?(active\s+|current\s+)?case|win\s+chances|maintainability|strategy\s+for\s+(my\s+)?(active\s+|current\s+)?case)\b|(केस\s*विश्लेषण|केस\s*का\s*विश्लेषण|केस\s*की\s*रणनीति|मजबूती\s*बताओ)/i;

const PRECEDENT_HINT_RE =
  /\b(supreme\s+court|high\s+court|judgment|judgement|precedent|case\s+law|citation|authority|ratio)\b|(सुप्रीम\s*कोर्ट|हाई\s*कोर्ट|निर्णय|फैसला|जजमेंट|केस\s*लॉ)/i;

function extractIsoDate(text: string): string | null {
  const m = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text);
  return m ? m[1] : null;
}

function inferLimitationRuleId(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('34') || lower.includes('arbitral') || lower.includes('award') || lower.includes('मध्यस्थता')) {
    return 'arb_sec_34';
  }
  if (lower.includes('slp') || lower.includes('136') || lower.includes('supreme court') || lower.includes('सुप्रीम')) {
    return 'slp_sc_133';
  }
  if (lower.includes('commercial') || lower.includes('13(1a)')) {
    return 'commercial_appeal_13';
  }
  if (lower.includes('ibc') || lower.includes('nclat') || lower.includes('61')) {
    return 'ibc_nclat_61';
  }
  if (lower.includes('review') || lower.includes('पुनर्विचार')) {
    return 'review_124';
  }
  if (lower.includes('138') || lower.includes('cheque') || lower.includes('चेक')) {
    return 'ni_138_notice';
  }
  if (lower.includes('consumer') || lower.includes('उपभोक्ता')) {
    return 'consumer_69';
  }
  if (lower.includes('high court') || lower.includes('appeal') || lower.includes('अपील')) {
    return 'hc_appeal_116a';
  }
  if (lower.includes('suit') || lower.includes('breach') || lower.includes('contract')) {
    return 'civil_suit_113';
  }
  return LIMITATION_RULES[0].id;
}

export function classifyAssistantIntent(userText: string): AssistantIntent {
  const trimmed = userText.trim();

  // 1. Explicit Draft / Affidavit / Judiciary Form Generation Intent
  if (DRAFT_ACTION_VERBS.test(trimmed)) {
    for (const matcher of FORM_MATCHERS) {
      if (matcher.patterns.some((re) => re.test(trimmed))) {
        return {
          type: 'draft_form',
          templateId: matcher.templateId,
          customInstructions: trimmed,
        };
      }
    }
  }

  // 2. Explicit Add Deadline / Reminder Action
  if (REMINDER_HINT_RE.test(trimmed)) {
    const due =
      extractIsoDate(trimmed) ??
      new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const cleanedTitle = trimmed
      .replace(/^(remind\s+me\s+to|add\s+deadline|set\s+reminder|pin\s+deadline|रिमाइंडर\s*सेट\s*करो|डेडलाइन\s*जोड़ो)[:\-\s]*/i, '')
      .trim();
    return {
      type: 'add_deadline',
      title: (cleanedTitle || 'Chambers Legal Follow-up Task').slice(0, 160),
      dueDate: due,
    };
  }

  // 3. Limitation Calculator Intent
  if (LIMITATION_HINT_RE.test(trimmed)) {
    return {
      type: 'limitation_calc',
      ruleId: inferLimitationRuleId(trimmed),
      triggerDate: extractIsoDate(trimmed) ?? new Date().toISOString().slice(0, 10),
      saveDeadline: /\b(save|add|pin|track|सेव|जोड़ो)\b/i.test(trimmed),
    };
  }

  // 4. Statute / BNS / BNSS / BSA Crosswalk Intent
  if (STATUTE_HINT_RE.test(trimmed) && !CASE_ANALYSIS_HINT_RE.test(trimmed)) {
    const legacyHits = scanDraftForLegacyCitations(trimmed);
    const numMatch = /\b(\d{1,3}[A-Za-z]?)\b/.exec(trimmed);
    if (legacyHits.length > 0 || numMatch || /crosswalk|mapped|bns|bnss|bsa|धारा/i.test(trimmed)) {
      return {
        type: 'statute_lookup',
        query: trimmed,
      };
    }
  }

  // 5. Case Analysis Intent
  if (CASE_ANALYSIS_HINT_RE.test(trimmed)) {
    return { type: 'case_analysis' };
  }

  // 6. Live Matter Status / Hearings / Deadlines Inspector
  if (MATTER_STATUS_HINT_RE.test(trimmed)) {
    return { type: 'matter_status' };
  }

  // 7. Verified Supreme Court / High Court Precedent Lookup
  if (PRECEDENT_HINT_RE.test(trimmed)) {
    return { type: 'precedent_search', query: trimmed };
  }

  return { type: 'general_legal', query: trimmed };
}

/**
 * Deterministic zero-hallucination builder for BNS/BNSS/BSA crosswalk responses
 * in English, Hindi (Devanagari), or Bilingual format.
 */
export function buildDeterministicStatuteReply(
  query: string,
  lang: 'en' | 'hi' | 'bilingual'
): { text: string; sources: AssistantVerifiedSource[]; found: boolean } {
  const inlineMatches = scanDraftForLegacyCitations(query);
  const tokens = query.match(/\b\d{1,3}[A-Za-z]?\b/g) ?? [];
  const lookupHits = [
    ...inlineMatches.map((m) => m.mapping),
    ...tokens.flatMap((t) => lookupStatuteMappings(t)),
    ...lookupStatuteMappings(query),
  ];

  // Deduplicate by legacyCode + legacySection
  const seen = new Set<string>();
  const unique = lookupHits.filter((row) => {
    const key = `${row.legacyCode}-${row.legacySection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  if (unique.length === 0) {
    const msg =
      lang === 'hi'
        ? 'सत्यापित क्रॉसवॉक तालिका में इस धारा का सीधा मिलान नहीं मिला। [सत्यापन आवश्यक]\nकृपया सटीक धारा संख्या लिखें (उदाहरण: "420 IPC", "438 CrPC", "65B IEA", "482 CrPC", या "302 IPC") ताकि बिना किसी त्रुटि के नया BNS/BNSS/BSA प्रावधान दिया जा सके।'
        : lang === 'bilingual'
          ? 'No exact match found in the verified BNS/BNSS/BSA crosswalk table [Verification Required].\nसत्यापित तालिका में सटीक धारा नहीं मिली। कृपया सटीक सेक्शन लिखें (जैसे: 420 IPC, 438 CrPC, 65B IEA, 482 CrPC)।'
          : 'No exact section match was found in the verified BNS/BNSS/BSA crosswalk table [Verification Required]. Please specify an exact section number or offence (e.g., 420 IPC, 438 CrPC, 65B IEA, 482 CrPC, or 302 IPC) for an exact zero-hallucination mapping.';
    return { text: msg, sources: [], found: false };
  }

  const sources: AssistantVerifiedSource[] = unique.map((u) => ({
    label: `${u.legacyCode} ${u.legacySection} → ${u.newCode} ${u.newSection}`,
    reference: u.title,
    kind: 'statute',
  }));

  if (lang === 'hi') {
    const rows = unique.map(
      (u) =>
        `| ${u.legacyCode} धारा ${u.legacySection} | **${u.newCode} धारा ${u.newSection}** (${u.title}) | ${u.keyChangeNote} |`
    );
    return {
      found: true,
      sources,
      text: `### सत्यापित वैधानिक मिलान (BNS / BNSS / BSA 2023)

| पुराना प्रावधान | नया कानून (2023) | मुख्य कानूनी नोट |
| --- | --- | --- |
${rows.join('\n')}

> **कोर्ट फाइलिंग सुझाव:** 1 जुलाई 2024 के बाद की सभी याचिकाओं और हलफनामों में नई धारा (**${unique[0].newCode} धारा ${unique[0].newSection}**) का प्राथमिक उल्लेख करें।`,
    };
  }

  if (lang === 'bilingual') {
    const rows = unique.map(
      (u) =>
        `| ${u.legacyCode} ${u.legacySection} | **${u.newCode} ${u.newSection}** (${u.title}) | ${u.keyChangeNote} (अब कोर्ट फाइलिंग में ${u.newCode} धारा ${u.newSection} लागू है।) |`
    );
    return {
      found: true,
      sources,
      text: `### Verified Statute Crosswalk / सत्यापित कानून मिलान (BNS / BNSS / BSA 2023)

| Legacy Section | New Provision (2023) | Key Statutory Change |
| --- | --- | --- |
${rows.join('\n')}

> **Filing Note / फाइलिंग नोट:** Cite **${unique[0].newCode} Section ${unique[0].newSection}** as the primary provision in post-July 2024 filings.`,
    };
  }

  const rows = unique.map(
    (u) =>
      `| ${u.legacyCode} Section ${u.legacySection} | **${u.newCode} Section ${u.newSection}** (${u.title}) | ${u.keyChangeNote} |`
  );
  return {
    found: true,
    sources,
    text: `### Verified Statutory Mapping (BNS / BNSS / BSA 2023)

| Legacy Code | New Provision (2023) | Key Statutory Note |
| --- | --- | --- |
${rows.join('\n')}

> **Filing Practice Note:** Cite **${unique[0].newCode} Section ${unique[0].newSection}** as the primary statutory provision in post-July 2024 filings (noting the legacy provision only in brackets if the FIR/proceedings pre-date 1 July 2024).`,
  };
}

/**
 * Deterministic Limitation Act computation reply in English, Hindi, or Bilingual.
 */
export function buildDeterministicLimitationReply(
  ruleId: string,
  triggerDate: string,
  lang: 'en' | 'hi' | 'bilingual',
  savedDeadlineTitle?: string
): {
  text: string;
  sources: AssistantVerifiedSource[];
  computed: ReturnType<typeof calculateLimitationDeadline>;
} {
  const computed = calculateLimitationDeadline(ruleId, triggerDate);
  const statutoryProvision = `${computed.rule.statute} (${computed.rule.articleOrSection})`;
  const sources: AssistantVerifiedSource[] = [
    {
      label: computed.rule.label,
      reference: statutoryProvision,
      kind: 'limitation_rule',
    },
  ];

  const savedNoteEn = savedDeadlineTitle
    ? `\n\n> **Action Completed:** Pinned **${savedDeadlineTitle}** (Due **${computed.effectiveDueDate}**) directly to your active Matter deadlines.`
    : '';
  const savedNoteHi = savedDeadlineTitle
    ? `\n\n> **कार्य पूर्ण:** **${savedDeadlineTitle}** (अंतिम तिथि: **${computed.effectiveDueDate}**) को आपके केस ट्रैकर में सेव कर दिया गया है।`
    : '';

  if (lang === 'hi') {
    return {
      computed,
      sources,
      text: `### सत्यापित परिसीमा गणना (Indian Limitation Act)

- **कानूनी उपाय:** ${computed.rule.label}
- **वैधानिक प्रावधान:** ${statutoryProvision}
- **प्रारंभ तिथि (Trigger Date):** \`${triggerDate}\`
- **निर्धारित अंतिम तिथि (Effective Expiry):** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? ' (धारा 4 के तहत रविवार/अवकाश के कारण अगले कार्यदिवस पर समायोजित)' : ''}
- **शेष दिन:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} दिन शेष` : `${Math.abs(computed.daysRemaining)} दिन पहले समाप्त`}
- **देरी माफी सीमा (Outer Cap):** ${computed.graceDeadlineDate ?? 'धारा 5 के अंतर्गत पर्याप्त कारण सिद्ध करने पर'}
- **कानूनी नोट:** ${computed.rule.practiceNote}${savedNoteHi}`,
    };
  }

  if (lang === 'bilingual') {
    return {
      computed,
      sources,
      text: `### Verified Limitation Calculation / सत्यापित परिसीमा गणना

- **Remedy / उपाय:** ${computed.rule.label} (${statutoryProvision})
- **Trigger Date / प्रारंभ तिथि:** \`${triggerDate}\`
- **Prescribed Expiry / अंतिम तिथि:** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? ' (Sec. 4 Sunday Roll-Forward Applied)' : ''}
- **Window Left / शेष अवधि:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} day(s) remaining` : `Expired ${Math.abs(computed.daysRemaining)} day(s) ago`}
- **Outer Condonation Cap:** ${computed.graceDeadlineDate ?? 'Subject to Sec. 5 sufficient cause'}
- **Statutory Rule:** ${computed.rule.practiceNote}${savedNoteEn}`,
    };
  }

  return {
    computed,
    sources,
    text: `### Verified Statutory Limitation Computation

- **Remedy:** ${computed.rule.label}
- **Governing Provision:** ${statutoryProvision}
- **Trigger Date:** \`${triggerDate}\`
- **Effective Filing Expiry:** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? ' (Adjusted forward to next working day under Section 4 Limitation Act)' : ''}
- **Remaining Window:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} day(s) left` : `Expired ${Math.abs(computed.daysRemaining)} day(s) ago`}
- **Strict Outer Condonable Cap:** ${computed.graceDeadlineDate ?? 'Condonable under Section 5 upon proving sufficient cause'}
- **Guidance:** ${computed.rule.practiceNote}${savedNoteEn}`,
  };
}

/**
 * Deterministic Live Matter / Hearings / Deadlines readout strictly from persisted DB records.
 */
export function buildDeterministicMatterStatusReply(
  matter: Matter | null,
  cases: TrackedCase[],
  deadlines: DeadlineItem[],
  draftCount: number,
  lang: 'en' | 'hi' | 'bilingual'
): { text: string; sources: AssistantVerifiedSource[] } {
  if (!matter) {
    return {
      sources: [],
      text:
        lang === 'hi'
          ? 'अभी कोई सक्रिय केस (Matter) चुना नहीं गया है। कृपया बाएँ मेनू से एक केस चुनें या Command Overview में नया केस जोड़ें।'
          : 'No active Matter is currently selected. Select a Matter from the sidebar or create one in Command Overview.',
    };
  }

  const matterCases = cases.filter((c) => c.matterId === matter.id);
  const pendingDeadlines = deadlines.filter((d) => d.matterId === matter.id && !d.completed);

  const sources: AssistantVerifiedSource[] = [
    { label: `${matter.matterCode} — ${matter.title}`, reference: matter.forum, kind: 'matter_record' },
    ...matterCases.slice(0, 3).map((c) => ({
      label: c.caseNumber,
      reference: `${c.court} · Next: ${c.nextHearingDate}`,
      kind: 'matter_record' as const,
    })),
  ];

  const hearingLines =
    matterCases.length > 0
      ? matterCases
          .map(
            (c, i) =>
              `${i + 1}. **${c.caseNumber}** (${c.court}) — Next Hearing: **${c.nextHearingDate}** | ${c.courtroom || 'Courtroom TBD'} | Stage: ${c.stage}`
          )
          .join('\n')
      : lang === 'hi'
        ? '- इस केस के लिए अभी कोई सुनवाई तिथि दर्ज नहीं है।'
        : '- No tracked hearings recorded yet for this matter.';

  const deadlineLines =
    pendingDeadlines.length > 0
      ? pendingDeadlines
          .map((d, i) => `${i + 1}. **${d.title}** — Due: **${d.dueDate}** (${d.statuteArticle})`)
          .join('\n')
      : lang === 'hi'
        ? '- कोई लंबित डेडलाइन नहीं है।'
        : '- No pending statutory deadlines.';

  if (lang === 'hi') {
    return {
      sources,
      text: `### सक्रिय केस का सत्यापित विवरण (Live Workspace Record)

- **केस:** ${matter.title} (\`${matter.matterCode}\`)
- **न्यायालय / फोरम:** ${matter.forum}
- **मुवक्किल (Client):** ${matter.clientName}
- **विपक्षी पक्ष:** ${matter.opposingParty || 'उल्लेखित नहीं'}
- **कुल सेव किए गए ड्राफ्ट:** ${draftCount}

#### आगामी सुनवाई (Tracked Hearings)
${hearingLines}

#### लंबित फाइलिंग डेडलाइन (Pending Deadlines)
${deadlineLines}

> **मुख्य तथ्य:** ${matter.summaryFacts}`,
    };
  }

  return {
    sources,
    text: `### Verified Active Matter Status

- **Matter:** ${matter.title} (\`${matter.matterCode}\`)
- **Forum:** ${matter.forum}
- **Client:** ${matter.clientName} | **Opposing Party:** ${matter.opposingParty || 'Not specified'}
- **Saved Drafts in Matter:** ${draftCount}

#### Tracked Court Hearings
${hearingLines}

#### Pending Statutory & Filing Deadlines
${deadlineLines}

> **Recorded Summary Facts:** ${matter.summaryFacts}`,
  };
}

/**
 * Deterministic Verified Supreme Court / High Court Precedent Response.
 */
export function buildDeterministicPrecedentReply(
  query: string,
  jurisdiction: JurisdictionMode,
  lang: 'en' | 'hi' | 'bilingual'
): { text: string; sources: AssistantVerifiedSource[] } {
  const hits = retrieveRelevantPrecedents(query, jurisdiction, 4);
  const sources: AssistantVerifiedSource[] = hits.map((h) => ({
    label: `${h.caseName}, ${h.citation}`,
    reference: `${h.court} (${h.bench})`,
    kind: 'precedent',
  }));

  if (lang === 'hi') {
    const body = hits
      .map(
        (h, i) =>
          `${i + 1}. **${h.caseName}, ${h.citation}** (${h.court}, ${h.bench}, ${h.year}) — प्रावधान: ${h.statutes.join(', ')}। मुख्य सिद्धांत: ${h.ratio} रणनीतिक उपयोग: ${h.practicalApplication}`
      )
      .join('\n');
    return {
      sources,
      text: `### सत्यापित सुप्रीम कोर्ट एवं हाई कोर्ट निर्णय (Verified Precedent Corpus)

${body}

> **सत्यापन नोट:** ऊपर दिए गए सभी केस साइटेशन VidhiOS के सत्यापित न्यायिक डेटाबेस से लिए गए हैं।`,
    };
  }

  const body = hits
    .map(
      (h, i) =>
        `${i + 1}. **${h.caseName}, ${h.citation}** (${h.court}, ${h.bench}, ${h.year}) — Provisions: ${h.statutes.join(', ')}. **Ratio:** ${h.ratio} **Application:** ${h.practicalApplication}`
    )
    .join('\n');

  return {
    sources,
    text: `### Verified Supreme Court & High Court Authorities

${body}`,
  };
}

export function getFormConfirmationReply(
  templateId: string,
  draftTitle: string,
  lang: 'en' | 'hi' | 'bilingual'
): string {
  const tpl = getJudiciaryTemplate(templateId);
  if (lang === 'hi') {
    return `### कोर्ट-तैयार दस्तावेज़ तैयार है

आपका दस्तावेज़ **${tpl.name}** (${tpl.statuteBasis}) सफलतापूर्वक तैयार कर लिया गया है और Matter Drafts में **${draftTitle}** के नाम से सेव हो गया है।

- **न्यायालय मानक संरचना:** Cause Title, क्रमांकित पैराग्राफ, Prayer, और Order XIX Rule 3 CPC के अंतर्गत Verification/Affidavit शामिल है।
- **अगला कदम:** नीचे दिए बटन से सीधे कोर्ट-फॉर्मेटेड Word (**.DOCX**) फ़ाइल डाउनलोड करें या Drafting Studio में संपादित करें।`;
  }
  if (lang === 'bilingual') {
    return `### Court Document Ready / दस्तावेज़ तैयार है

Generated **${tpl.name}** (${tpl.statuteBasis}) grounded in your active Matter facts and saved as **${draftTitle}**.

- **Action Ready:** Download the court-formatted Word (**.DOCX**) file directly below or open it in Drafting Studio.
- **हिंदी:** आपका कोर्ट-फॉर्मेटेड दस्तावेज़ तैयार होकर Matter Drafts में सेव हो गया है। नीचे से सीधे **.DOCX** डाउनलोड करें।`;
  }
  return `### Court-Ready Draft Generated

Generated **${tpl.name}** (${tpl.statuteBasis}) grounded strictly in your active Matter facts and saved to Matter Drafts as **${draftTitle}**.

- **Registry Formatting:** Includes Supreme Court / High Court Cause Title, numbered paragraphs, Prayer clause, and Order XIX Rule 3 Verification.
- **Next Steps:** Click **Download Court .DOCX** below for immediate Word export, or **Open in Drafting** to edit and audit.`;
}
