import crypto from 'node:crypto';
import type {
  ContractReview,
  CourtroomSession,
  DeadlineItem,
  DraftDocument,
  Matter,
  MeetingBrief,
  ResearchMemo,
  TrackedCase,
  VaultDocument,
  WhatsAppMessage,
} from '../types/legal';

export interface SeededWorkspaceData {
  matters: Matter[];
  researchMemos: ResearchMemo[];
  drafts: DraftDocument[];
  vaultDocuments: VaultDocument[];
  contractReviews: ContractReview[];
  courtroomSessions: CourtroomSession[];
  trackedCases: TrackedCase[];
  deadlines: DeadlineItem[];
  meetingBriefs: MeetingBrief[];
  whatsappMessages: WhatsAppMessage[];
}

function isoDaysFromNow(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function buildSeededWorkspace(userId: string): SeededWorkspaceData {
  const now = new Date().toISOString();
  const mLitigationId = crypto.randomUUID();
  const mCorpId = crypto.randomUUID();
  const mGlobalId = crypto.randomUUID();

  const matters: Matter[] = [
    {
      id: mLitigationId,
      userId,
      title: 'State of Maharashtra v. Vikramaditya Kulkarni',
      matterCode: 'BOM-HC-2026-418',
      clientName: 'Vikramaditya Kulkarni (Director, Apex InfraTech)',
      opposingParty: 'State of Maharashtra & EOW Mumbai',
      jurisdiction: 'india_litigation',
      forum: 'High Court of Judicature at Bombay (Criminal Appellate Side)',
      status: 'pending_hearing',
      summaryFacts:
        'Anticipatory bail & quashing matter arising out of commercial JV dispute given criminal colour by complainant. FIR registered on 14 Jan 2026 alleging offences of cheating and criminal breach of trust over ₹4.8 Cr escrow milestone release. Civil arbitration already invoked on 02 Dec 2025 prior to FIR.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: mCorpId,
      userId,
      title: 'Project Horizon — Acquisition & MSA Review (FinGrid Pvt. Ltd.)',
      matterCode: 'MA-DEL-2026-092',
      clientName: 'Kaveri Capital Partners LLP',
      opposingParty: 'FinGrid Payments Technologies Pvt. Ltd.',
      jurisdiction: 'corporate_ma',
      forum: 'Corporate M&A / Commercial Advisory (Mumbai & Bengaluru)',
      status: 'in_review',
      summaryFacts:
        'Series B acquisition due diligence and vendor Master Services Agreement redlining for payment gateway infrastructure. Key exposure areas include uncapped IP indemnity, RBI PA/PG compliance warranties, unilateral termination rights, and arbitration seat alignment.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: mGlobalId,
      userId,
      title: 'Meridian Renewables Pte. Ltd. v. Helios Grid GmbH',
      matterCode: 'SIAC-ARB-2026-114',
      clientName: 'Meridian Renewables Pte. Ltd. (Singapore)',
      opposingParty: 'Helios Grid GmbH (Munich)',
      jurisdiction: 'global_multi',
      forum: 'Singapore International Arbitration Centre (SIAC) — English Governing Law',
      status: 'active',
      summaryFacts:
        'Cross-border solar turbine EPC delay dispute ($14.2M liquidated damages claim) governed by English law with Singapore seat and anticipated Part II foreign award enforcement against Indian subsidiary assets under Section 48 of the Arbitration & Conciliation Act, 1996.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const drafts: DraftDocument[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: 'Anticipatory Bail Application — Bombay High Court',
      docType: 'Anticipatory Bail Application',
      version: 2,
      updatedAt: now,
      content: `IN THE HIGH COURT OF JUDICATURE AT BOMBAY
CRIMINAL APPELLATE JURISDICTION
ANTICIPATORY BAIL APPLICATION NO. ______ OF 2026

IN THE MATTER OF:
Vikramaditya Kulkarni, Director, Apex InfraTech Pvt. Ltd. ... Applicant
VERSUS
The State of Maharashtra (through EOW, Mumbai) ... Respondent

APPLICATION UNDER SECTION 438 CrPC FOR GRANT OF PRE-ARREST BAIL

MOST RESPECTFULLY SHOWETH:

1. That the Applicant is a law-abiding citizen and Director of Apex InfraTech Pvt. Ltd., having deep roots in society, and is apprehending arrest in FIR No. 41/2026 registered at Marine Drive Police Station (transferred to EOW) for alleged offences punishable under Section 420 IPC, Section 406 IPC, and Section 120B of the Indian Penal Code.

2. That the entire dispute is purely commercial and civil in nature arising out of a Joint Venture Agreement dated 12.03.2024. The Applicant had already issued a Notice Invoking Arbitration on 02.12.2025, nearly six weeks prior to the lodging of the impugned FIR under Section 154 CrPC.

3. That the Applicant has complied with every notice issued under Section 41A CrPC and has handed over complete digital ledger records accompanied by a certificate under Section 65B of the Indian Evidence Act.

4. That custodial interrogation is wholly unnecessary as the prosecution case rests entirely on documentary and banking records already seized. The Applicant relies on the settled law laid down by the Hon'ble Supreme Court in Arnesh Kumar v. State of Bihar and Siddharam Satlingappa Mhetre.

PRAYER
It is therefore most humbly prayed that this Hon'ble Court may be pleased to direct that in the event of arrest in FIR No. 41/2026, the Applicant be released on bail on such terms and conditions as this Hon'ble Court deems fit.`,
    },
    {
      id: crypto.randomUUID(),
      matterId: mCorpId,
      userId,
      title: 'Due Diligence Preliminary Requisition Note',
      docType: 'M&A Requisition Memo',
      version: 1,
      updatedAt: now,
      content: `CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED
PROJECT HORIZON: PRELIMINARY LEGAL DUE DILIGENCE REQUISITIONS

1. Regulatory Authorizations: Provide copies of RBI Payment Aggregator authorization letters, periodic CERT-In cybersecurity audit certificates (FY 2024-25 & 2025-26), and data localization compliance attestations.
2. Material Customer Contracts: Disclose all top-10 enterprise MSAs containing uncapped consequential damages, change-of-control termination triggers, or exclusivity covenants.
3. Pending Litigation & Tax Notices: Provide status of GST show-cause notice dated 18.08.2025 and any labour/ESOP disputes.`,
    },
  ];

  const researchMemos: ResearchMemo[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      query: 'Quashing and anticipatory bail when commercial breach is given criminal colour under BNS 318(4) / IPC 420',
      jurisdiction: 'india_litigation',
      answerMarkdown: `### Executive Conclusion
Indian Supreme Court precedent consistently deprecates converting civil or contractual disputes into criminal prosecutions for cheating (**Section 318(4) BNS**, formerly Section 420 IPC) or criminal breach of trust (**Section 316(2) BNS**, formerly Section 406 IPC) unless dishonest intention existed **at the very inception** of the transaction.

### Controlling Precedents
1. **Lalit Chaturvedi & Ors. v. State of Uttar Pradesh (2024 SCC OnLine SC 171)** — Mere breach of contract or unpaid commercial dues does not constitute cheating or criminal breach of trust; criminal proceedings cannot be used as a pressure tactic for recovery.
2. **Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh (2024 INSC 626)** — Clarified that cheating and criminal breach of trust are antithetical and cannot ordinarily co-exist on the same set of facts without distinct ingredients.
3. **Arnesh Kumar v. State of Bihar (2014) 8 SCC 273** (now codified in **Section 35(3) BNSS**) — Mandatory written reasons before arrest for offences punishable up to 7 years.

### Strategic Application to Matter
- Highlight the **02.12.2025 Arbitration Notice** predating the **14.01.2026 FIR** to establish counter-blast mala fides.
- Note that under **Section 316(2) BNS**, criminal breach of trust punishment increased from 3 years to 5 years, still squarely within the 7-year threshold attracting Section 35(3) BNSS safeguards.`,
      citations: [
        {
          title: 'Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh — Supreme Court of India (2024)',
          url: 'https://main.sci.gov.in/',
          courtOrSource: 'Supreme Court of India',
          status: 'verified_web',
        },
        {
          title: 'Bharatiya Nyaya Sanhita, 2023 — Sections 316 & 318',
          url: 'https://www.indiacode.nic.in/',
          courtOrSource: 'India Code (Central Act)',
          status: 'statute',
        },
      ],
      citationIntegrity: {
        verifiedSourceCount: 2,
        jurisdictionChecked: 'Indian Criminal & Supreme Court Jurisprudence',
        bnsComplianceNote: 'Cross-verified against BNS 2023 & BNSS 2023 equivalents.',
        confidenceLabel: 'Grounded via Web & Statute',
      },
      createdAt: now,
    },
  ];

  const vaultDocuments: VaultDocument[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      fileName: 'FIR_41_2026_MarineDrive_OCR.pdf',
      mimeType: 'application/pdf',
      docCategory: 'FIR / Police Record',
      extractedText:
        'First Information Report No. 41/2026 dated 14.01.2026. Informant alleges ₹4.80 Cr paid in March 2024 towards JV project in Thane was diverted. Informant claims no prior dispute existed before January 2026.',
      translatedText:
        'प्रथम सूचना रिपोर्ट संख्या 41/2026 दिनांक 14.01.2026। शिकायतकर्ता का आरोप है कि ठाणे में संयुक्त उद्यम परियोजना के लिए मार्च 2024 में भुगतान किए गए ₹4.80 करोड़ की राशि का दुरुपयोग किया गया।',
      targetLanguage: 'Hindi',
      chronology: [
        {
          date: '2024-03-12',
          event: 'Execution of Joint Venture Agreement between Apex InfraTech and Complainant',
          sourceDoc: 'JV_Agreement_2024.pdf',
          significance: 'Establishes commercial arbitration clause (Clause 19.2) and milestone escrow.',
        },
        {
          date: '2025-12-02',
          event: 'Applicant served Section 21 Notice Invoking Arbitration demanding reconciliation',
          sourceDoc: 'Sec21_Notice_Dec2025.pdf',
          significance: 'Proves prior civil dispute six weeks before criminal complaint.',
        },
        {
          date: '2026-01-14',
          event: 'FIR No. 41/2026 lodged at Marine Drive PS alleging cheating & breach of trust',
          sourceDoc: 'FIR_41_2026_MarineDrive_OCR.pdf',
          significance: 'Trigger date for pre-arrest bail and Section 528 BNSS quashing petition.',
        },
      ],
      contradictions: [
        {
          topic: 'Existence of Prior Commercial Dispute',
          statementA: 'FIR Para 6 states: "No written dispute or notice was exchanged prior to January 2026."',
          statementB: 'Speed Post tracking & Email Annexure C confirm receipt of Applicant’s Arbitration Notice on 03.12.2025.',
          severity: 'high',
          recommendation: 'Highlight material suppression of facts under Bhajan Lal guidelines to seek interim protection and quashing.',
        },
      ],
      createdAt: now,
    },
  ];

  const contractReviews: ContractReview[] = [
    {
      id: crypto.randomUUID(),
      matterId: mCorpId,
      userId,
      title: 'FinGrid Enterprise Master Services Agreement (v3.2 Vendor Draft)',
      playbook: 'Indian Corporate & Arbitration Act Playbook',
      sourceText: `CLAUSE 8.2 INDEMNIFICATION: Customer shall indemnify, defend, and hold harmless Vendor against any and all third-party claims, direct, indirect, incidental, or consequential losses arising out of Customer's use of the Platform without any monetary cap.
CLAUSE 11.1 TERMINATION FOR CONVENIENCE: Vendor may terminate this Agreement at any time upon 7 days written notice without refund of prepaid annual fees.
CLAUSE 14.3 GOVERNING LAW & DISPUTE RESOLUTION: This Agreement shall be governed by the laws of India. Any dispute shall be resolved by a sole arbitrator appointed exclusively by Vendor's Managing Director, with seat in Delhi.`,
      summary:
        'High commercial risk profile: Vendor draft imposes asymmetric uncapped liability on Customer, allows unilateral forfeiture of prepaid fees on 7-day termination, and includes a legally unenforceable unilateral arbitrator appointment clause under Perkins Eastman Architects v. HSCC (India) Ltd.',
      clauses: [
        {
          id: 'cl_indemnity_8_2',
          clauseRef: 'Clause 8.2',
          title: 'Uncapped Asymmetric Indemnification',
          severity: 'high',
          issueSummary: 'Imposes uncapped indemnification including indirect and consequential damages on Customer.',
          originalText:
            "Customer shall indemnify, defend, and hold harmless Vendor against any and all third-party claims, direct, indirect, incidental, or consequential losses arising out of Customer's use of the Platform without any monetary cap.",
          proposedText:
            "Each Party shall indemnify the other solely for direct, finally awarded third-party damages arising from gross negligence, willful misconduct, or third-party IP infringement, excluding indirect or consequential losses, and capped at 100% of fees paid in the preceding twelve (12) months.",
          legalRationale:
            'Under Section 73 of the Indian Contract Act, 1872, remote or indirect damages are generally excluded unless explicitly assumed; uncapped consequential indemnity creates uninsurable M&A balance-sheet exposure.',
          decision: 'pending',
        },
        {
          id: 'cl_arb_14_3',
          clauseRef: 'Clause 14.3',
          title: 'Invalid Unilateral Arbitrator Appointment',
          severity: 'high',
          issueSummary: "Sole arbitrator appointed solely by Vendor's Managing Director is void under Section 12(5) Arbitration Act.",
          originalText:
            "Any dispute shall be resolved by a sole arbitrator appointed exclusively by Vendor's Managing Director, with seat in Delhi.",
          proposedText:
            'Any dispute shall be finally resolved by arbitration under the Arbitration and Conciliation Act, 1996 before a sole arbitrator mutually appointed by both Parties (or failing agreement within 30 days, by the Mumbai Centre for International Arbitration), with seat and venue in Mumbai.',
          legalRationale:
            'Unilateral appointment by an interested party violates Section 12(5) read with Seventh Schedule (Perkins Eastman Architects DPC v. HSCC (India) Ltd., 2019; Central Organisation for Railway Electrification, 2024 Constitution Bench).',
          decision: 'pending',
        },
        {
          id: 'cl_term_11_1',
          clauseRef: 'Clause 11.1',
          title: 'Unilateral 7-Day Termination Without Pro-Rata Refund',
          severity: 'medium',
          issueSummary: 'Allows Vendor to terminate for convenience on 7 days notice while retaining prepaid annual fees.',
          originalText:
            'Vendor may terminate this Agreement at any time upon 7 days written notice without refund of prepaid annual fees.',
          proposedText:
            'Either Party may terminate for convenience upon ninety (90) days prior written notice; if Vendor terminates without cause, Vendor shall refund all prepaid, unearned fees on a pro-rata basis within fifteen (15) business days and provide transition assistance.',
          legalRationale:
            'For critical payment gateway infrastructure, 7 days notice causes operational disruption and unfair forfeiture of consideration.',
          decision: 'pending',
        },
      ],
      requisitions: [
        'Obtain FinGrid Board Resolution & RBI Payment Aggregator authorization certificate.',
        'Confirm whether existing customer MSAs contain unilateral arbitration clauses requiring amendment prior to closing.',
        'Verify cyber insurance policy limit (minimum ₹25 Cr recommended to backstop Vendor IP & data breach indemnity).',
      ],
      createdAt: now,
    },
  ];

  const courtroomSessions: CourtroomSession[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      mode: 'bench',
      forumContext: 'Bombay High Court — Single Judge Criminal Bail Bench',
      briefExcerpt: 'Anticipatory Bail in FIR No. 41/2026 alleging cheating & criminal breach of trust over ₹4.8 Cr JV escrow.',
      vulnerabilities: [
        'Bench may ask why the Applicant did not deposit a security bond or escrow statement showing utilization of the ₹4.8 Cr.',
        'Ensure exact distinction between Section 318(4) BNS and Section 316(2) BNS per Delhi Race Club (2024) is framed succinctly.',
      ],
      turns: [
        {
          id: crypto.randomUUID(),
          speaker: 'bench',
          message:
            'Counsel, the EOW remand note claims ₹4.80 Crore was transferred to a sister entity within 48 hours of milestone release. Why shouldn’t custodial interrogation be permitted to trace the money trail?',
          weaknessFlag: 'Money-trail tracing argument is the prosecution’s strongest point against pre-arrest bail.',
          suggestedRebuttal:
            'My Lord, every single rupee moved strictly through RTGS banking channels to the designated EPC subcontractor named in Schedule III of the JV Agreement. Complete audited bank statements and BSA Section 63 certificates are already tendered to the IO on 22.01.2026; nothing remains to be discovered through custody.',
          authorities: [
            'Lalit Chaturvedi v. State of U.P. (2024 SCC OnLine SC 171)',
            'Arnesh Kumar v. State of Bihar (2014) 8 SCC 273 / Sec. 35(3) BNSS',
          ],
          timestamp: now,
        },
      ],
      createdAt: now,
    },
  ];

  const trackedCases: TrackedCase[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      caseNumber: 'ABA/418/2026',
      cnrNumber: 'MHHC010094822026',
      court: 'Bombay High Court',
      courtroom: 'Court Room 34',
      bench: 'Hon’ble Justice R. K. Deshmukh',
      causeListItem: 'Sr. No. 18 (Urgent Admission)',
      nextHearingDate: isoDaysFromNow(2),
      stage: 'Interim Protection & IO Reply',
      status: 'listed',
      notes: 'Keep Section 21 Arbitration Notice speed-post receipt and BNS/BNSS citation chart ready.',
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      matterId: mGlobalId,
      userId,
      caseNumber: 'ARB/114/2026/SIAC',
      cnrNumber: 'SIAC-2026-114-SG',
      court: 'SIAC Tribunal (Singapore)',
      courtroom: 'Maxwell Chambers Suite 4',
      bench: 'Presiding Arbitrator M. Tan SC',
      causeListItem: 'Procedural Hearing #2',
      nextHearingDate: isoDaysFromNow(9),
      stage: 'Document Production & Redfern Schedule',
      status: 'listed',
      notes: 'Exchange Redfern Schedule objections 72 hours prior to procedural hearing.',
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      matterId: mCorpId,
      userId,
      caseNumber: 'CP(IB)/209/MB/2026',
      cnrNumber: 'NCLTMUM002092026',
      court: 'NCLT Mumbai Bench',
      courtroom: 'Court II',
      bench: 'Hon’ble Member (J) S. Verma',
      causeListItem: 'Sr. No. 42 (Ordinary List)',
      nextHearingDate: isoDaysFromNow(14),
      stage: 'Scheme Merger Compliance Check',
      status: 'in_session',
      notes: 'Track creditor NOC affidavit filing status before closing.',
      createdAt: now,
    },
  ];

  const deadlines: DeadlineItem[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: 'File Rejoinder Affidavit & BSA Sec. 63 Certificate',
      statuteArticle: 'Bombay HC Criminal Appellate Rules',
      triggerDate: isoDaysFromNow(-7),
      dueDate: isoDaysFromNow(1),
      completed: false,
      notes: 'Serve advance copy on APP office before 4:00 PM.',
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      matterId: mGlobalId,
      userId,
      title: 'Potential Section 34 Award Challenge Outer Window',
      statuteArticle: 'Arbitration & Conciliation Act, Sec. 34(3)',
      triggerDate: isoDaysFromNow(-45),
      dueDate: isoDaysFromNow(45),
      graceDate: isoDaysFromNow(75),
      completed: false,
      notes: 'Strict 3 months + 30 days non-extendable statutory window.',
      createdAt: now,
    },
  ];

  const meetingBriefs: MeetingBrief[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: 'Client Consultation — Vikramaditya Kulkarni (Pre-Hearing Strategy)',
      durationLabel: '18:42',
      transcript:
        'Client confirmed all ₹4.8 Cr transfers went to certified EPC subcontractors via RTGS. Client also located the signed WhatsApp confirmation from complainant acknowledging project delay due to municipal clearance.',
      summary:
        'Pre-hearing consultation confirming complete banking trail for escrow utilization and newly surfaced electronic admissions from the complainant negating dishonest intent at inception.',
      keyFacts: [
        'All ₹4.8 Cr milestone disbursements cleared via RTGS to approved EPC subcontractors.',
        'Complainant acknowledged municipal clearance delay via WhatsApp on 11.10.2025.',
        'Applicant appeared before EOW on 19.01.2026 and 28.01.2026 pursuant to notice.',
      ],
      actionItems: [
        'Prepare Section 63 BSA electronic evidence certificate (with forensic expert co-signature) for WhatsApp admissions.',
        'Attach audited RTGS ledger extract as Annexure D to the Rejoinder Affidavit.',
      ],
      statutoryIssues: [
        'Section 63 Bharatiya Sakshya Adhiniyam, 2023 (Electronic Record Certificate)',
        'Section 318(4) BNS vs civil breach of contract threshold',
      ],
      createdAt: now,
    },
  ];

  const whatsappMessages: WhatsAppMessage[] = [
    {
      id: crypto.randomUUID(),
      matterId: mLitigationId,
      userId,
      sender: 'assistant',
      body: 'VidhiOS Command Center synced. Type /hearings, /bns 420, /cases, /deadlines, /remind <task>, or /brief to manage your chambers directly.',
      commandTag: 'system',
      createdAt: now,
    },
  ];

  return {
    matters,
    researchMemos,
    drafts,
    vaultDocuments,
    contractReviews,
    courtroomSessions,
    trackedCases,
    deadlines,
    meetingBriefs,
    whatsappMessages,
  };
}
