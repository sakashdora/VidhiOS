import type { JurisdictionMode } from '../../types/legal';

export type JudiciaryFormCategory =
  | 'affidavit'
  | 'supreme_court'
  | 'high_court'
  | 'criminal_bnss'
  | 'civil_commercial';

export interface JudiciaryFormTemplate {
  id: string;
  name: string;
  category: JudiciaryFormCategory;
  courtLevel: string;
  applicableJurisdiction: string;
  statuteBasis: string;
  description: string;
  defaultCourt: string;
  defaultCaseType: string;
  suggestedRelief: string;
  requiredFields: string[];
  supportingInstructions: string;
  version: string;
  reviewDate: string;
  validationRules: string[];
}

export interface JudiciaryFormInput {
  templateId: string;
  courtName: string;
  caseNumber: string;
  petitionerName: string;
  respondentName: string;
  deponentName: string;
  deponentDetails: string; // e.g., S/o / D/o, aged __ years, resident of ___
  factsSummary: string;
  reliefSought: string;
  placeOfFiling: string;
  filingDate: string; // YYYY-MM-DD
  jurisdiction: JurisdictionMode;
}

const BASE_JUDICIARY_FORM_TEMPLATES: Array<
  Omit<
    JudiciaryFormTemplate,
    | 'applicableJurisdiction'
    | 'requiredFields'
    | 'supportingInstructions'
    | 'version'
    | 'reviewDate'
    | 'validationRules'
  >
> = [
  {
    id: 'general_affidavit',
    name: 'Affidavit-in-Support (Order XIX CPC / SC Rules)',
    category: 'affidavit',
    courtLevel: 'Supreme Court / High Court / District Court',
    statuteBasis: 'Order XIX Rule 3 CPC & Supreme Court Rules 2013',
    description:
      'Formal sworn affidavit with strict knowledge-vs-advice verification clause per A.K.K. Nambiar Constitution Bench standards.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY',
    defaultCaseType: 'CRIMINAL APPLICATION NO. ____ OF 2026',
    suggestedRelief: 'Verify facts stated in the accompanying petition/application on oath.',
  },
  {
    id: 'counter_affidavit',
    name: 'Counter Affidavit / Affidavit-in-Reply',
    category: 'affidavit',
    courtLevel: 'Supreme Court / High Court',
    statuteBasis: 'Article 226 / Order XIX CPC / SC Rules Order XXI',
    description:
      'Para-wise reply affidavit with preliminary objections on maintainability, suppression of material facts, and parawise traversal.',
    defaultCourt: 'IN THE HON’BLE SUPREME COURT OF INDIA',
    defaultCaseType: 'SPECIAL LEAVE PETITION (CIVIL) NO. ____ OF 2026',
    suggestedRelief: 'Dismiss the petition in limine with exemplary costs.',
  },
  {
    id: 'rejoinder_affidavit',
    name: 'Rejoinder Affidavit',
    category: 'affidavit',
    courtLevel: 'Supreme Court / High Court',
    statuteBasis: 'Order XIX CPC & High Court Writ Rules',
    description:
      'Rebuttal affidavit answering new factual pleas raised in the Respondent’s Counter Affidavit and reaffirming original prayers.',
    defaultCourt: 'IN THE HIGH COURT OF DELHI AT NEW DELHI',
    defaultCaseType: 'WRIT PETITION (CIVIL) NO. ____ OF 2026',
    suggestedRelief: 'Reject averments in Counter Affidavit and allow the Petition as prayed.',
  },
  {
    id: 'sec_63_bsa_certificate',
    name: 'Section 63 BSA Electronic Evidence Certificate & Affidavit',
    category: 'affidavit',
    courtLevel: 'All Indian Courts & Tribunals',
    statuteBasis: 'Section 63(4) Bharatiya Sakshya Adhiniyam, 2023 (Schedule Part A & B)',
    description:
      'Mandatory electronic evidence affidavit replacing Section 65B IEA, including hash-value declaration and Schedule Part A/B certification.',
    defaultCourt: 'IN THE COURT OF THE HON’BLE SESSIONS / COMMERCIAL JUDGE',
    defaultCaseType: 'COMMERCIAL SUIT / CRIMINAL CASE NO. ____ OF 2026',
    suggestedRelief: 'Admit electronic records (emails, WhatsApp exports, server logs) into evidence.',
  },
  {
    id: 'slp_article_136',
    name: 'Special Leave Petition (SLP — Article 136)',
    category: 'supreme_court',
    courtLevel: 'Supreme Court of India',
    statuteBasis: 'Article 136 of the Constitution of India & Order XXI/XXII SC Rules 2013',
    description:
      'Complete SC Registry format: Synopsis & List of Dates, Questions of Law, Declaration in Form 28, Grounds, Main & Interim Prayers, and Affidavit.',
    defaultCourt: 'IN THE HON’BLE SUPREME COURT OF INDIA\n(CIVIL / CRIMINAL APPELLATE JURISDICTION)',
    defaultCaseType: 'SPECIAL LEAVE PETITION (C/CRL.) NO. ____ OF 2026',
    suggestedRelief: 'Grant Special Leave to Appeal and stay operation of the impugned High Court judgment.',
  },
  {
    id: 'writ_petition_226',
    name: 'Writ Petition (Article 226 / Article 32)',
    category: 'high_court',
    courtLevel: 'High Court / Supreme Court',
    statuteBasis: 'Article 226 / Article 32 of the Constitution of India',
    description:
      'Constitutional Writ of Certiorari / Mandamus with maintainability shield (Radha Krishan Industries), proportionality grounds, and interim stay prayer.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(ORDINARY ORIGINAL CIVIL / WRIT JURISDICTION)',
    defaultCaseType: 'WRIT PETITION NO. ____ OF 2026',
    suggestedRelief: 'Issue a Writ of Certiorari quashing the impugned order and a Writ of Mandamus.',
  },
  {
    id: 'anticipatory_bail_482_bnss',
    name: 'Anticipatory Bail Application (Section 482 BNSS)',
    category: 'criminal_bnss',
    courtLevel: 'High Court / Sessions Court',
    statuteBasis: 'Section 482 Bharatiya Nagarik Suraksha Sanhita, 2023 (formerly Sec. 438 CrPC)',
    description:
      'Pre-arrest bail application invoking Sushila Aggarwal, Arnesh Kumar, and Satender Kumar Antil with undertaking to join investigation.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(CRIMINAL APPELLATE JURISDICTION)',
    defaultCaseType: 'ANTICIPATORY BAIL APPLICATION NO. ____ OF 2026',
    suggestedRelief: 'Direct release of Applicant on pre-arrest bail in the event of arrest in the subject FIR.',
  },
  {
    id: 'quashing_528_bnss',
    name: 'FIR Quashing Petition (Section 528 BNSS)',
    category: 'criminal_bnss',
    courtLevel: 'High Court',
    statuteBasis: 'Section 528 BNSS 2023 (formerly Sec. 482 CrPC) & Article 226',
    description:
      'Inherent jurisdiction quashing petition structured around Bhajan Lal categories and Delhi Race Club (2024) civil-to-criminal bar.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(CRIMINAL WRIT / INHERENT JURISDICTION)',
    defaultCaseType: 'CRIMINAL WRIT PETITION / APPLICATION NO. ____ OF 2026',
    suggestedRelief: 'Quash and set aside the impugned FIR and stay coercive proceedings pending disposal.',
  },
  {
    id: 'vakalatnama',
    name: 'Vakalatnama (Supreme Court / High Court Form)',
    category: 'civil_commercial',
    courtLevel: 'Supreme Court / High Court / Tribunals',
    statuteBasis: 'Order III Rule 4 CPC & Advocates Act 1961 / SC Rules Form 19',
    description:
      'Standard court-filing Vakalatnama authorizing Advocate-on-Record / Counsel to appear, plead, compromise, withdraw, and receive notices.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY',
    defaultCaseType: 'CASE / PETITION NO. ____ OF 2026',
    suggestedRelief: 'Appoint and authorize Counsel to represent the executant in all stages of the matter.',
  },
  {
    id: 'ia_condonation_delay',
    name: 'IA for Condonation of Delay (Section 5 Limitation Act)',
    category: 'supreme_court',
    courtLevel: 'Supreme Court / High Court / Tribunals',
    statuteBasis: 'Section 5 of the Limitation Act, 1963',
    description:
      'Interlocutory Application explaining day-to-day sufficient cause backed by Collector Land Acquisition v. Katiji and sworn Affidavit.',
    defaultCourt: 'IN THE HON’BLE SUPREME COURT OF INDIA',
    defaultCaseType: 'I.A. NO. ____ OF 2026 IN SLP NO. ____ OF 2026',
    suggestedRelief: 'Condone the bonafide delay of ___ days in filing the accompanying Petition/Appeal.',
  },
  {
    id: 'caveat_148a_cpc',
    name: 'Caveat Petition (Section 148A CPC)',
    category: 'civil_commercial',
    courtLevel: 'Supreme Court / High Court / District Court',
    statuteBasis: 'Section 148A Code of Civil Procedure, 1908 (Valid 90 Days)',
    description:
      'Preventive caveat ensuring no ex-parte interim stay or injunction is passed without prior notice and hearing to the Caveator.',
    defaultCourt: 'IN THE HON’BLE SUPREME COURT OF INDIA',
    defaultCaseType: 'CAVEAT APPLICATION NO. ____ OF 2026',
    suggestedRelief: 'Direct that no ex-parte order be passed without prior notice to the Caveator.',
  },
  {
    id: 'legal_notice_138_commercial',
    name: 'Statutory Demand Notice (Sec. 138 NI Act / Commercial)',
    category: 'civil_commercial',
    courtLevel: 'Pre-Litigation / Commercial Court / Magistrate',
    statuteBasis: 'Section 138(b) Negotiable Instruments Act 1881 / Indian Contract Act 1872',
    description:
      'Formal Registered AD / Email Advocate Notice with strict 15-day statutory cure period, interest calculation, and litigation reserve.',
    defaultCourt: 'BY REGISTERED POST A.D. / SPEED POST / EMAIL',
    defaultCaseType: 'STATUTORY LEGAL DEMAND NOTICE',
    suggestedRelief: 'Demand payment of principal dues with contractual interest within 15 days of receipt.',
  },
  {
    id: 'arbitration_sec9_sec11',
    name: 'Arbitration Petition (Sec. 9 Interim Relief / Sec. 11 Appointment)',
    category: 'civil_commercial',
    courtLevel: 'High Court / Commercial Court',
    statuteBasis: 'Sections 9 & 11 of the Arbitration and Conciliation Act, 1996',
    description:
      'Petition for interim asset preservation or independent arbitrator appointment citing CORE (2024 Constitution Bench) and Vidya Drolia.',
    defaultCourt: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(COMMERCIAL DIVISION — ARBITRATION)',
    defaultCaseType: 'COMMERCIAL ARBITRATION PETITION NO. ____ OF 2026',
    suggestedRelief: 'Grant urgent interim security/injunction and appoint an independent sole arbitrator.',
  },
];

const TEMPLATE_METADATA_OVERRIDES: Record<
  string,
  Pick<
    JudiciaryFormTemplate,
    'applicableJurisdiction' | 'requiredFields' | 'supportingInstructions' | 'validationRules'
  >
> = {
  sec_63_bsa_certificate: {
    applicableJurisdiction: 'All Indian Courts & Tribunals (BSA 2023)',
    requiredFields: ['courtName', 'petitionerName', 'respondentName', 'deponentName', 'factsSummary'],
    supportingInstructions:
      'Attach Schedule Part A (Custodian declaration) and Part B (Hash value & expert/device specification) per Section 63(4) BSA 2023.',
    validationRules: [
      'Must specify device/server details and cryptographic hash algorithm (SHA-256).',
      'Verify filing date is post-July 1, 2024 for BSA applicability (note IEA Sec. 65B for prior proceedings).',
    ],
  },
  slp_article_136: {
    applicableJurisdiction: 'Supreme Court of India (Order XXI/XXII SC Rules 2013)',
    requiredFields: ['courtName', 'petitionerName', 'respondentName', 'factsSummary', 'reliefSought'],
    supportingInstructions:
      'Include Synopsis & List of Dates, Questions of Law, Form 28 Declaration, and certified copy of impugned High Court judgment.',
    validationRules: [
      'Verify 90-day Limitation Act Art. 133(c) window (60 days if HC refused certificate).',
      'Cannot omit Declaration in Form 28 regarding prior SLP filings.',
    ],
  },
  anticipatory_bail_482_bnss: {
    applicableJurisdiction: 'High Courts & Sessions Courts in India (BNSS 2023)',
    requiredFields: ['courtName', 'petitionerName', 'respondentName', 'factsSummary'],
    supportingInstructions:
      'Specify FIR No., Police Station, BNS sections invoked, prior Sec. 35 BNSS notice compliance, and undertaking to cooperate.',
    validationRules: [
      'Check state-specific amendments (e.g. U.P. Sec. 438 CrPC / BNSS applicability) before filing.',
      'Ensure repealed IPC/CrPC sections are mapped to BNS/BNSS 2023.',
    ],
  },
  quashing_528_bnss: {
    applicableJurisdiction: 'High Courts of India (Inherent Jurisdiction u/s 528 BNSS)',
    requiredFields: ['courtName', 'petitionerName', 'respondentName', 'factsSummary', 'reliefSought'],
    supportingInstructions:
      'Map grounds explicitly to Ch. Bhajan Lal categories and include copy of impugned FIR/Chargesheet.',
    validationRules: [
      'Only High Courts possess inherent power u/s 528 BNSS; Sessions Courts cannot entertain quashing petitions.',
    ],
  },
};

export const JUDICIARY_FORM_TEMPLATES: JudiciaryFormTemplate[] = BASE_JUDICIARY_FORM_TEMPLATES.map(
  (tpl) => {
    const override = TEMPLATE_METADATA_OVERRIDES[tpl.id];
    return {
      ...tpl,
      applicableJurisdiction: override?.applicableJurisdiction ?? `${tpl.courtLevel} (India)`,
      requiredFields: override?.requiredFields ?? [
        'courtName',
        'petitionerName',
        'respondentName',
        'factsSummary',
      ],
      supportingInstructions:
        override?.supportingInstructions ??
        `Verify local High Court / Registry rules for ${tpl.courtLevel} and attach sworn Order XIX Rule 3 CPC verification.`,
      version: '2026.2',
      reviewDate: '2026-10-01',
      validationRules: override?.validationRules ?? [
        'Ensure cause title, party names, and verification clause are complete prior to filing.',
        'Cross-check all repealed IPC/CrPC/IEA references against BNS/BNSS/BSA 2023.',
      ],
    };
  }
);

export function validateJudiciaryFormInput(input: JudiciaryFormInput): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const tpl = getJudiciaryTemplate(input.templateId);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of tpl.requiredFields) {
    const val = (input as unknown as Record<string, unknown>)[field];
    if (typeof val !== 'string' || !val.trim()) {
      errors.push(`Missing required field "${field}" for ${tpl.name}.`);
    }
  }

  if (
    tpl.id === 'quashing_528_bnss' &&
    input.courtName.toLowerCase().includes('sessions')
  ) {
    warnings.push(
      'Section 528 BNSS inherent quashing petitions lie exclusively before the High Court, not Sessions Court.'
    );
  }
  if (
    tpl.id === 'slp_article_136' &&
    !input.courtName.toLowerCase().includes('supreme')
  ) {
    warnings.push('Article 136 Special Leave Petitions lie exclusively before the Supreme Court of India.');
  }

  return { valid: errors.length === 0, warnings, errors };
}

export function getJudiciaryTemplate(id: string): JudiciaryFormTemplate {
  return (
    JUDICIARY_FORM_TEMPLATES.find((t) => t.id === id) ?? JUDICIARY_FORM_TEMPLATES[0]
  );
}

/**
 * Deterministic court-ready fallback & instant template generator matching
 * Supreme Court Rules 2013 / High Court Registry structure.
 */
export function buildDeterministicJudiciaryForm(input: JudiciaryFormInput): string {
  const tpl = getJudiciaryTemplate(input.templateId);
  const court = (input.courtName || tpl.defaultCourt).trim().toUpperCase();
  const caseNo = (input.caseNumber || tpl.defaultCaseType).trim().toUpperCase();
  const petitioner = input.petitionerName.trim() || '[NAME OF PETITIONER / APPLICANT]';
  const respondent = input.respondentName.trim() || '[NAME OF RESPONDENT / OPPOSITE PARTY]';
  const deponent = input.deponentName.trim() || petitioner;
  const deponentDesc =
    input.deponentDetails.trim() ||
    'aged about ___ years, authorized signatory / resident of [FULL ADDRESS]';
  const place = input.placeOfFiling.trim() || 'Mumbai / New Delhi';
  const dateStr = input.filingDate || new Date().toISOString().slice(0, 10);
  const facts =
    input.factsSummary.trim() ||
    'The Applicant relies upon the chronological factual record annexed herewith and reserves liberty to refer to additional documents at the time of hearing.';
  const relief = input.reliefSought.trim() || tpl.suggestedRelief;

  if (tpl.id === 'vakalatnama') {
    return `${court}

${caseNo}

IN THE MATTER OF:
${petitioner}
... PETITIONER / APPLICANT

VERSUS

${respondent}
... RESPONDENT

VAKALATNAMA
(Under Order III Rule 4 CPC / Supreme Court Rules 2013)

KNOW ALL MEN by these presents that I/We, ${deponent}, ${deponentDesc}, the above-named Petitioner/Applicant/Respondent, do hereby appoint and retain:

[NAME OF ADVOCATE / ADVOCATE-ON-RECORD]
Enrolment No.: [BAR COUNCIL ENROLMENT NO.]
Chamber / Office Address: [CHAMBER ADDRESS]

(hereinafter called "the Advocate(s)") to be my/our Advocate(s) in the above-noted matter and authorize them to:
1. Appear, act, and plead on my/our behalf before this Hon'ble Court and any Appellate/Revisional/Executing forum arising therefrom.
2. Draft, sign, verify, present, and file petitions, plaints, written statements, affidavits, interlocutory applications, memos of appearance, and compromise/withdrawal applications.
3. Apply for and receive certified copies, inspect judicial records, deposit or withdraw monies/court fees, and accept service of processes/notices on my/our behalf.
4. Engage and instruct Senior Counsel or associate advocates as deemed necessary in the interest of the matter.

I/We hereby agree to ratify and confirm all lawful acts done by the said Advocate(s) in pursuance of this authority.

IN WITNESS WHEREOF I/We have set my/our hand to this Vakalatnama at ${place} on this ${dateStr}.

ACCEPTED:                                      EXECUTANT / CLIENT:
_________________________                      _________________________
Advocate / Advocate-on-Record                  (${deponent})
Bar Reg. No.: ___________                      Date: ${dateStr}

IDENTIFIED BY: _________________________`;
  }

  if (tpl.id === 'sec_63_bsa_certificate') {
    return `${court}

${caseNo}

IN THE MATTER OF:
${petitioner}
... PETITIONER / PLAINTIFF

VERSUS

${respondent}
... RESPONDENT / DEFENDANT

CERTIFICATE AND AFFIDAVIT UNDER SECTION 63(4) OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023
(Read with the Schedule — Part A & Part B; replacing Section 65B(4) of the Indian Evidence Act, 1872)

I, ${deponent}, ${deponentDesc}, do hereby solemnly affirm and state on oath as follows:

1. That I am the authorized custodian / lawful controller of the computer resource and electronic communication devices from which the electronic records annexed to the present proceedings have been extracted, and I am fully competent to swear this Certificate-cum-Affidavit under Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023 ("BSA 2023").

2. BRIEF CONTEXT OF ELECTRONIC RECORDS:
${facts}

3. IDENTIFICATION OF ELECTRONIC RECORD & DEVICE PARTICULARS (SCHEDULE — PART A):
   (a) Description of Electronic Output: [Emails / WhatsApp Chat Exports / PDF Statements / Server Logs annexed as Annexure-___]
   (b) Device Make, Model & Serial / IMEI: [SPECIFY DEVICE / SERVER DETAILS]
   (c) Operating System / Application Version: [SPECIFY OS & SOFTWARE]
   (d) Hash Value (SHA-256 / MD5) for Forensic Integrity: [INSERT SHA-256 HASH VALUE]

4. STATUTORY DECLARATIONS UNDER SECTION 63(2) & 63(4) BSA 2023:
   (a) The electronic output was produced by the computer/communication device during the period over which the said device was used regularly to create, store, or process information for the purposes of activities regularly carried on over that period by the person having lawful control over the use of the device.
   (b) During the said period, information of the kind contained in the electronic record was regularly fed into the computer/device in the ordinary course of the said activities.
   (c) Throughout the material part of the said period, the computer/communication device was operating properly, and there was no malfunction affecting the electronic record or accuracy of its contents.
   (d) The information contained in the electronic record reproduces or is derived from such information fed into the computer/device in the ordinary course of activities, without tampering, alteration, or unauthorized deletion.

5. COMPLIANCE WITH SUPREME COURT MANDATE:
This Certificate is submitted strictly in compliance with Section 63(4) BSA 2023 and the ratio of Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, (2020) 7 SCC 1.

PART B — TECHNICAL EXPERT CERTIFICATION (REQUIRED UNDER BSA 2023 SCHEDULE):
I, [NAME OF FORENSIC / IT EXPERT], [QUALIFICATION & DESIGNATION], certify that I have verified the hash value and extraction log of the electronic records identified in Part A above and confirm that the output is a true, unaltered reproduction from the source electronic system.
Signature of Expert: _________________________   Date: ${dateStr}

DEPONENT
(${deponent})

VERIFICATION
Verified at ${place} on this ${dateStr} that the contents of paragraphs 1 to 5 of the above Affidavit and Schedule Part A are true and correct to my personal knowledge and based on official electronic records maintained in the ordinary course, and nothing material has been concealed therefrom.

DEPONENT
Solemnly affirmed before me on ${dateStr} at ${place}.
OATH COMMISSIONER / NOTARY PUBLIC`;
  }

  return `${court}

${caseNo}

IN THE MATTER OF:
${petitioner}
... PETITIONER / APPLICANT

VERSUS

${respondent}
... RESPONDENT / OPPOSITE PARTY

${tpl.name.toUpperCase()}
(${tpl.statuteBasis})

MOST RESPECTFULLY SHOWETH / AFFIDAVIT ON OATH:

1. PARTIES & JURISDICTION
That the Petitioner/Applicant, ${petitioner}, invokes the jurisdiction of this Hon'ble Court under ${tpl.statuteBasis}. The cause of action and impugned proceedings arise within the territorial and subject-matter jurisdiction of this Hon'ble Court.

2. BRIEF FACTUAL MATRIX & CHRONOLOGY
${facts}

3. GROUNDS & STATUTORY SUBMISSIONS
   A. Statutory Compliance: The present claim/defence strictly complies with applicable provisions of the Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), Bharatiya Sakshya Adhiniyam (BSA 2023), and civil/constitutional mandates.
   B. Binding Judicial Precedent: The impugned action/claim is directly governed by settled Supreme Court of India jurisprudence protecting substantive justice, proportionality, and procedural fairness.
   C. Balance of Convenience & Irreparable Harm: Unless the reliefs prayed herein are granted, the Applicant shall suffer grave, irreversible prejudice that cannot be compensated in monetary terms.

4. DECLARATION OF NO OTHER SIMILAR PROCEEDINGS
That the Petitioner/Applicant has not filed any other similar petition or application before this Hon'ble Court or any other Court seeking the identical relief herein.

5. LIMITATION
That the present filing is well within the prescribed period of limitation under the Limitation Act, 1963 and applicable Court Rules.

PRAYER
In view of the facts and circumstances stated above, it is most respectfully prayed that this Hon'ble Court may graciously be pleased to:
(a) ${relief};
(b) Grant ad-interim ex-parte relief in terms of prayer (a) pending final hearing and disposal; and
(c) Pass such other and further orders as this Hon'ble Court may deem fit and proper in the interest of justice.

AND FOR THIS ACT OF KINDNESS, THE PETITIONER/APPLICANT AS IN DUTY BOUND SHALL EVER PRAY.

DRAWN & FILED BY:                              THROUGH:
_________________________                      _________________________
Advocate for Petitioner/Applicant              (${petitioner})
Place: ${place}
Date: ${dateStr}

--------------------------------------------------------------------
SUPPORTING AFFIDAVIT (UNDER ORDER XIX RULE 3 CPC / SC RULES 2013)
--------------------------------------------------------------------

I, ${deponent}, ${deponentDesc}, do hereby solemnly affirm and declare on oath as under:
1. That I am the Petitioner/Applicant / Authorized Signatory in the above-captioned matter and am well conversant with the facts and circumstances of the case from personal knowledge and official records.
2. That the accompanying ${tpl.name} has been drafted under my instructions and the contents thereof have been read over and explained to me.
3. That the factual averments in paragraphs 1 to 5 are true to my personal knowledge and official records, and the legal submissions are believed to be true upon advice of counsel.
4. That the annexures filed herewith are true and faithful copies of their respective originals.

DEPONENT
(${deponent})

VERIFICATION
Verified at ${place} on this ${dateStr} that the contents of paragraphs 1 to 4 of the above Affidavit are true and correct to the best of my knowledge and belief, no part of it is false, and nothing material has been concealed therefrom.

DEPONENT
Identified by: Advocate                        Attested by: Oath Commissioner / Notary`;
}
