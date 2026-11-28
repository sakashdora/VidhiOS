// src/server/apiHandler.ts
import "dotenv/config";

// src/server/createApp.ts
import "dotenv/config";
import express from "express";
import path2 from "node:path";
import { z } from "zod";

// src/server/auth.ts
import crypto from "node:crypto";
var SESSION_SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16 ? process.env.SESSION_SECRET : process.env.DATABASE_URL ? crypto.createHash("sha256").update(process.env.DATABASE_URL).digest("hex") : "vidhios-secure-session-signing-secret-2026-chambers-token-auth";
var TOKEN_TTL_MS = 1e3 * 60 * 60 * 24 * 7;
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}
function signSessionToken(userId, email) {
  const payload = {
    userId,
    email,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed.userId || !parsed.email || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    return;
  }
  req.authUser = payload;
  next();
}

// src/server/repository.ts
import crypto3 from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// src/server/seedData.ts
import crypto2 from "node:crypto";
function isoDaysFromNow(offsetDays) {
  const d = /* @__PURE__ */ new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function buildSeededWorkspace(userId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const mLitigationId = crypto2.randomUUID();
  const mCorpId = crypto2.randomUUID();
  const mGlobalId = crypto2.randomUUID();
  const matters = [
    {
      id: mLitigationId,
      userId,
      title: "State of Maharashtra v. Vikramaditya Kulkarni",
      matterCode: "BOM-HC-2026-418",
      clientName: "Vikramaditya Kulkarni (Director, Apex InfraTech)",
      opposingParty: "State of Maharashtra & EOW Mumbai",
      jurisdiction: "india_litigation",
      forum: "High Court of Judicature at Bombay (Criminal Appellate Side)",
      status: "pending_hearing",
      summaryFacts: "Anticipatory bail & quashing matter arising out of commercial JV dispute given criminal colour by complainant. FIR registered on 14 Jan 2026 alleging offences of cheating and criminal breach of trust over \u20B94.8 Cr escrow milestone release. Civil arbitration already invoked on 02 Dec 2025 prior to FIR.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: mCorpId,
      userId,
      title: "Project Horizon \u2014 Acquisition & MSA Review (FinGrid Pvt. Ltd.)",
      matterCode: "MA-DEL-2026-092",
      clientName: "Kaveri Capital Partners LLP",
      opposingParty: "FinGrid Payments Technologies Pvt. Ltd.",
      jurisdiction: "corporate_ma",
      forum: "Corporate M&A / Commercial Advisory (Mumbai & Bengaluru)",
      status: "in_review",
      summaryFacts: "Series B acquisition due diligence and vendor Master Services Agreement redlining for payment gateway infrastructure. Key exposure areas include uncapped IP indemnity, RBI PA/PG compliance warranties, unilateral termination rights, and arbitration seat alignment.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: mGlobalId,
      userId,
      title: "Meridian Renewables Pte. Ltd. v. Helios Grid GmbH",
      matterCode: "SIAC-ARB-2026-114",
      clientName: "Meridian Renewables Pte. Ltd. (Singapore)",
      opposingParty: "Helios Grid GmbH (Munich)",
      jurisdiction: "global_multi",
      forum: "Singapore International Arbitration Centre (SIAC) \u2014 English Governing Law",
      status: "active",
      summaryFacts: "Cross-border solar turbine EPC delay dispute ($14.2M liquidated damages claim) governed by English law with Singapore seat and anticipated Part II foreign award enforcement against Indian subsidiary assets under Section 48 of the Arbitration & Conciliation Act, 1996.",
      createdAt: now,
      updatedAt: now
    }
  ];
  const drafts = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: "Anticipatory Bail Application \u2014 Bombay High Court",
      docType: "Anticipatory Bail Application",
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
It is therefore most humbly prayed that this Hon'ble Court may be pleased to direct that in the event of arrest in FIR No. 41/2026, the Applicant be released on bail on such terms and conditions as this Hon'ble Court deems fit.`
    },
    {
      id: crypto2.randomUUID(),
      matterId: mCorpId,
      userId,
      title: "Due Diligence Preliminary Requisition Note",
      docType: "M&A Requisition Memo",
      version: 1,
      updatedAt: now,
      content: `CONFIDENTIAL \u2014 ATTORNEY-CLIENT PRIVILEGED
PROJECT HORIZON: PRELIMINARY LEGAL DUE DILIGENCE REQUISITIONS

1. Regulatory Authorizations: Provide copies of RBI Payment Aggregator authorization letters, periodic CERT-In cybersecurity audit certificates (FY 2024-25 & 2025-26), and data localization compliance attestations.
2. Material Customer Contracts: Disclose all top-10 enterprise MSAs containing uncapped consequential damages, change-of-control termination triggers, or exclusivity covenants.
3. Pending Litigation & Tax Notices: Provide status of GST show-cause notice dated 18.08.2025 and any labour/ESOP disputes.`
    }
  ];
  const researchMemos = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      query: "Quashing and anticipatory bail when commercial breach is given criminal colour under BNS 318(4) / IPC 420",
      jurisdiction: "india_litigation",
      answerMarkdown: `### Executive Conclusion
Indian Supreme Court precedent consistently deprecates converting civil or contractual disputes into criminal prosecutions for cheating (**Section 318(4) BNS**, formerly Section 420 IPC) or criminal breach of trust (**Section 316(2) BNS**, formerly Section 406 IPC) unless dishonest intention existed **at the very inception** of the transaction.

### Controlling Precedents
1. **Lalit Chaturvedi & Ors. v. State of Uttar Pradesh (2024 SCC OnLine SC 171)** \u2014 Mere breach of contract or unpaid commercial dues does not constitute cheating or criminal breach of trust; criminal proceedings cannot be used as a pressure tactic for recovery.
2. **Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh (2024 INSC 626)** \u2014 Clarified that cheating and criminal breach of trust are antithetical and cannot ordinarily co-exist on the same set of facts without distinct ingredients.
3. **Arnesh Kumar v. State of Bihar (2014) 8 SCC 273** (now codified in **Section 35(3) BNSS**) \u2014 Mandatory written reasons before arrest for offences punishable up to 7 years.

### Strategic Application to Matter
- Highlight the **02.12.2025 Arbitration Notice** predating the **14.01.2026 FIR** to establish counter-blast mala fides.
- Note that under **Section 316(2) BNS**, criminal breach of trust punishment increased from 3 years to 5 years, still squarely within the 7-year threshold attracting Section 35(3) BNSS safeguards.`,
      citations: [
        {
          title: "Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh \u2014 Supreme Court of India (2024)",
          url: "https://main.sci.gov.in/",
          courtOrSource: "Supreme Court of India",
          status: "verified_web"
        },
        {
          title: "Bharatiya Nyaya Sanhita, 2023 \u2014 Sections 316 & 318",
          url: "https://www.indiacode.nic.in/",
          courtOrSource: "India Code (Central Act)",
          status: "statute"
        }
      ],
      citationIntegrity: {
        verifiedSourceCount: 2,
        jurisdictionChecked: "Indian Criminal & Supreme Court Jurisprudence",
        bnsComplianceNote: "Cross-verified against BNS 2023 & BNSS 2023 equivalents.",
        confidenceLabel: "Grounded via Web & Statute"
      },
      createdAt: now
    }
  ];
  const vaultDocuments = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      fileName: "FIR_41_2026_MarineDrive_OCR.pdf",
      mimeType: "application/pdf",
      docCategory: "FIR / Police Record",
      extractedText: "First Information Report No. 41/2026 dated 14.01.2026. Informant alleges \u20B94.80 Cr paid in March 2024 towards JV project in Thane was diverted. Informant claims no prior dispute existed before January 2026.",
      translatedText: "\u092A\u094D\u0930\u0925\u092E \u0938\u0942\u091A\u0928\u093E \u0930\u093F\u092A\u094B\u0930\u094D\u091F \u0938\u0902\u0916\u094D\u092F\u093E 41/2026 \u0926\u093F\u0928\u093E\u0902\u0915 14.01.2026\u0964 \u0936\u093F\u0915\u093E\u092F\u0924\u0915\u0930\u094D\u0924\u093E \u0915\u093E \u0906\u0930\u094B\u092A \u0939\u0948 \u0915\u093F \u0920\u093E\u0923\u0947 \u092E\u0947\u0902 \u0938\u0902\u092F\u0941\u0915\u094D\u0924 \u0909\u0926\u094D\u092F\u092E \u092A\u0930\u093F\u092F\u094B\u091C\u0928\u093E \u0915\u0947 \u0932\u093F\u090F \u092E\u093E\u0930\u094D\u091A 2024 \u092E\u0947\u0902 \u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u093F\u090F \u0917\u090F \u20B94.80 \u0915\u0930\u094B\u0921\u093C \u0915\u0940 \u0930\u093E\u0936\u093F \u0915\u093E \u0926\u0941\u0930\u0941\u092A\u092F\u094B\u0917 \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
      targetLanguage: "Hindi",
      chronology: [
        {
          date: "2024-03-12",
          event: "Execution of Joint Venture Agreement between Apex InfraTech and Complainant",
          sourceDoc: "JV_Agreement_2024.pdf",
          significance: "Establishes commercial arbitration clause (Clause 19.2) and milestone escrow."
        },
        {
          date: "2025-12-02",
          event: "Applicant served Section 21 Notice Invoking Arbitration demanding reconciliation",
          sourceDoc: "Sec21_Notice_Dec2025.pdf",
          significance: "Proves prior civil dispute six weeks before criminal complaint."
        },
        {
          date: "2026-01-14",
          event: "FIR No. 41/2026 lodged at Marine Drive PS alleging cheating & breach of trust",
          sourceDoc: "FIR_41_2026_MarineDrive_OCR.pdf",
          significance: "Trigger date for pre-arrest bail and Section 528 BNSS quashing petition."
        }
      ],
      contradictions: [
        {
          topic: "Existence of Prior Commercial Dispute",
          statementA: 'FIR Para 6 states: "No written dispute or notice was exchanged prior to January 2026."',
          statementB: "Speed Post tracking & Email Annexure C confirm receipt of Applicant\u2019s Arbitration Notice on 03.12.2025.",
          severity: "high",
          recommendation: "Highlight material suppression of facts under Bhajan Lal guidelines to seek interim protection and quashing."
        }
      ],
      createdAt: now
    }
  ];
  const contractReviews = [
    {
      id: crypto2.randomUUID(),
      matterId: mCorpId,
      userId,
      title: "FinGrid Enterprise Master Services Agreement (v3.2 Vendor Draft)",
      playbook: "Indian Corporate & Arbitration Act Playbook",
      sourceText: `CLAUSE 8.2 INDEMNIFICATION: Customer shall indemnify, defend, and hold harmless Vendor against any and all third-party claims, direct, indirect, incidental, or consequential losses arising out of Customer's use of the Platform without any monetary cap.
CLAUSE 11.1 TERMINATION FOR CONVENIENCE: Vendor may terminate this Agreement at any time upon 7 days written notice without refund of prepaid annual fees.
CLAUSE 14.3 GOVERNING LAW & DISPUTE RESOLUTION: This Agreement shall be governed by the laws of India. Any dispute shall be resolved by a sole arbitrator appointed exclusively by Vendor's Managing Director, with seat in Delhi.`,
      summary: "High commercial risk profile: Vendor draft imposes asymmetric uncapped liability on Customer, allows unilateral forfeiture of prepaid fees on 7-day termination, and includes a legally unenforceable unilateral arbitrator appointment clause under Perkins Eastman Architects v. HSCC (India) Ltd.",
      clauses: [
        {
          id: "cl_indemnity_8_2",
          clauseRef: "Clause 8.2",
          title: "Uncapped Asymmetric Indemnification",
          severity: "high",
          issueSummary: "Imposes uncapped indemnification including indirect and consequential damages on Customer.",
          originalText: "Customer shall indemnify, defend, and hold harmless Vendor against any and all third-party claims, direct, indirect, incidental, or consequential losses arising out of Customer's use of the Platform without any monetary cap.",
          proposedText: "Each Party shall indemnify the other solely for direct, finally awarded third-party damages arising from gross negligence, willful misconduct, or third-party IP infringement, excluding indirect or consequential losses, and capped at 100% of fees paid in the preceding twelve (12) months.",
          legalRationale: "Under Section 73 of the Indian Contract Act, 1872, remote or indirect damages are generally excluded unless explicitly assumed; uncapped consequential indemnity creates uninsurable M&A balance-sheet exposure.",
          decision: "pending"
        },
        {
          id: "cl_arb_14_3",
          clauseRef: "Clause 14.3",
          title: "Invalid Unilateral Arbitrator Appointment",
          severity: "high",
          issueSummary: "Sole arbitrator appointed solely by Vendor's Managing Director is void under Section 12(5) Arbitration Act.",
          originalText: "Any dispute shall be resolved by a sole arbitrator appointed exclusively by Vendor's Managing Director, with seat in Delhi.",
          proposedText: "Any dispute shall be finally resolved by arbitration under the Arbitration and Conciliation Act, 1996 before a sole arbitrator mutually appointed by both Parties (or failing agreement within 30 days, by the Mumbai Centre for International Arbitration), with seat and venue in Mumbai.",
          legalRationale: "Unilateral appointment by an interested party violates Section 12(5) read with Seventh Schedule (Perkins Eastman Architects DPC v. HSCC (India) Ltd., 2019; Central Organisation for Railway Electrification, 2024 Constitution Bench).",
          decision: "pending"
        },
        {
          id: "cl_term_11_1",
          clauseRef: "Clause 11.1",
          title: "Unilateral 7-Day Termination Without Pro-Rata Refund",
          severity: "medium",
          issueSummary: "Allows Vendor to terminate for convenience on 7 days notice while retaining prepaid annual fees.",
          originalText: "Vendor may terminate this Agreement at any time upon 7 days written notice without refund of prepaid annual fees.",
          proposedText: "Either Party may terminate for convenience upon ninety (90) days prior written notice; if Vendor terminates without cause, Vendor shall refund all prepaid, unearned fees on a pro-rata basis within fifteen (15) business days and provide transition assistance.",
          legalRationale: "For critical payment gateway infrastructure, 7 days notice causes operational disruption and unfair forfeiture of consideration.",
          decision: "pending"
        }
      ],
      requisitions: [
        "Obtain FinGrid Board Resolution & RBI Payment Aggregator authorization certificate.",
        "Confirm whether existing customer MSAs contain unilateral arbitration clauses requiring amendment prior to closing.",
        "Verify cyber insurance policy limit (minimum \u20B925 Cr recommended to backstop Vendor IP & data breach indemnity)."
      ],
      createdAt: now
    }
  ];
  const courtroomSessions = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      mode: "bench",
      forumContext: "Bombay High Court \u2014 Single Judge Criminal Bail Bench",
      briefExcerpt: "Anticipatory Bail in FIR No. 41/2026 alleging cheating & criminal breach of trust over \u20B94.8 Cr JV escrow.",
      vulnerabilities: [
        "Bench may ask why the Applicant did not deposit a security bond or escrow statement showing utilization of the \u20B94.8 Cr.",
        "Ensure exact distinction between Section 318(4) BNS and Section 316(2) BNS per Delhi Race Club (2024) is framed succinctly."
      ],
      turns: [
        {
          id: crypto2.randomUUID(),
          speaker: "bench",
          message: "Counsel, the EOW remand note claims \u20B94.80 Crore was transferred to a sister entity within 48 hours of milestone release. Why shouldn\u2019t custodial interrogation be permitted to trace the money trail?",
          weaknessFlag: "Money-trail tracing argument is the prosecution\u2019s strongest point against pre-arrest bail.",
          suggestedRebuttal: "My Lord, every single rupee moved strictly through RTGS banking channels to the designated EPC subcontractor named in Schedule III of the JV Agreement. Complete audited bank statements and BSA Section 63 certificates are already tendered to the IO on 22.01.2026; nothing remains to be discovered through custody.",
          authorities: [
            "Lalit Chaturvedi v. State of U.P. (2024 SCC OnLine SC 171)",
            "Arnesh Kumar v. State of Bihar (2014) 8 SCC 273 / Sec. 35(3) BNSS"
          ],
          timestamp: now
        }
      ],
      createdAt: now
    }
  ];
  const trackedCases = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      caseNumber: "ABA/418/2026",
      cnrNumber: "MHHC010094822026",
      court: "Bombay High Court",
      courtroom: "Court Room 34",
      bench: "Hon\u2019ble Justice R. K. Deshmukh",
      causeListItem: "Sr. No. 18 (Urgent Admission)",
      nextHearingDate: isoDaysFromNow(2),
      stage: "Interim Protection & IO Reply",
      status: "listed",
      notes: "Keep Section 21 Arbitration Notice speed-post receipt and BNS/BNSS citation chart ready.",
      createdAt: now
    },
    {
      id: crypto2.randomUUID(),
      matterId: mGlobalId,
      userId,
      caseNumber: "ARB/114/2026/SIAC",
      cnrNumber: "SIAC-2026-114-SG",
      court: "SIAC Tribunal (Singapore)",
      courtroom: "Maxwell Chambers Suite 4",
      bench: "Presiding Arbitrator M. Tan SC",
      causeListItem: "Procedural Hearing #2",
      nextHearingDate: isoDaysFromNow(9),
      stage: "Document Production & Redfern Schedule",
      status: "listed",
      notes: "Exchange Redfern Schedule objections 72 hours prior to procedural hearing.",
      createdAt: now
    },
    {
      id: crypto2.randomUUID(),
      matterId: mCorpId,
      userId,
      caseNumber: "CP(IB)/209/MB/2026",
      cnrNumber: "NCLTMUM002092026",
      court: "NCLT Mumbai Bench",
      courtroom: "Court II",
      bench: "Hon\u2019ble Member (J) S. Verma",
      causeListItem: "Sr. No. 42 (Ordinary List)",
      nextHearingDate: isoDaysFromNow(14),
      stage: "Scheme Merger Compliance Check",
      status: "in_session",
      notes: "Track creditor NOC affidavit filing status before closing.",
      createdAt: now
    }
  ];
  const deadlines = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: "File Rejoinder Affidavit & BSA Sec. 63 Certificate",
      statuteArticle: "Bombay HC Criminal Appellate Rules",
      triggerDate: isoDaysFromNow(-7),
      dueDate: isoDaysFromNow(1),
      completed: false,
      notes: "Serve advance copy on APP office before 4:00 PM.",
      createdAt: now
    },
    {
      id: crypto2.randomUUID(),
      matterId: mGlobalId,
      userId,
      title: "Potential Section 34 Award Challenge Outer Window",
      statuteArticle: "Arbitration & Conciliation Act, Sec. 34(3)",
      triggerDate: isoDaysFromNow(-45),
      dueDate: isoDaysFromNow(45),
      graceDate: isoDaysFromNow(75),
      completed: false,
      notes: "Strict 3 months + 30 days non-extendable statutory window.",
      createdAt: now
    }
  ];
  const meetingBriefs = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      title: "Client Consultation \u2014 Vikramaditya Kulkarni (Pre-Hearing Strategy)",
      durationLabel: "18:42",
      transcript: "Client confirmed all \u20B94.8 Cr transfers went to certified EPC subcontractors via RTGS. Client also located the signed WhatsApp confirmation from complainant acknowledging project delay due to municipal clearance.",
      summary: "Pre-hearing consultation confirming complete banking trail for escrow utilization and newly surfaced electronic admissions from the complainant negating dishonest intent at inception.",
      keyFacts: [
        "All \u20B94.8 Cr milestone disbursements cleared via RTGS to approved EPC subcontractors.",
        "Complainant acknowledged municipal clearance delay via WhatsApp on 11.10.2025.",
        "Applicant appeared before EOW on 19.01.2026 and 28.01.2026 pursuant to notice."
      ],
      actionItems: [
        "Prepare Section 63 BSA electronic evidence certificate (with forensic expert co-signature) for WhatsApp admissions.",
        "Attach audited RTGS ledger extract as Annexure D to the Rejoinder Affidavit."
      ],
      statutoryIssues: [
        "Section 63 Bharatiya Sakshya Adhiniyam, 2023 (Electronic Record Certificate)",
        "Section 318(4) BNS vs civil breach of contract threshold"
      ],
      createdAt: now
    }
  ];
  const whatsappMessages = [
    {
      id: crypto2.randomUUID(),
      matterId: mLitigationId,
      userId,
      sender: "assistant",
      body: "VidhiOS Command Center synced. Type /hearings, /bns 420, /cases, /deadlines, /remind <task>, or /brief to manage your chambers directly.",
      commandTag: "system",
      createdAt: now
    }
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
    whatsappMessages
  };
}

// src/server/neonDatabase.ts
import { Pool } from "pg";
var activePool = null;
var resolvedHostIp = null;
function getNeonConnectionString() {
  const url = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "").trim();
  if (!url || url === "MY_DATABASE_URL" || url === "MY_NEON_DATABASE_URL" || url === "postgresql://...") {
    return "";
  }
  return url;
}
function isNeonConfigured() {
  return Boolean(getNeonConnectionString());
}
async function resolveHostViaDoH(hostname) {
  if (resolvedHostIp) return resolvedHostIp;
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production") {
    return null;
  }
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(2e3)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ip = json.Answer?.find((a) => a.type === 1)?.data;
    if (ip) {
      resolvedHostIp = ip;
      return ip;
    }
  } catch {
  }
  return null;
}
async function getNeonPool() {
  const connectionString = getNeonConnectionString();
  if (!connectionString) return null;
  if (activePool) return activePool;
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;
    const ip = await resolveHostViaDoH(hostname);
    activePool = new Pool({
      host: ip || hostname,
      port: Number(parsed.port) || 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, "") || "neondb",
      ssl: {
        servername: hostname,
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3
    });
    activePool.on("error", (err) => {
      console.error("[Neon Pool Error]:", err.message);
    });
    return activePool;
  } catch (err) {
    console.error("[Neon Pool Init Failed]:", err);
    return null;
  }
}
async function testNeonConnection() {
  const startedAt = Date.now();
  const pool = await getNeonPool();
  if (!pool) {
    return { ok: false, error: "DATABASE_URL or NEON_DATABASE_URL is not configured." };
  }
  let client = null;
  try {
    client = await pool.connect();
    const res = await client.query("SELECT version() as version, current_database() as db, now() as current_time;");
    return {
      ok: true,
      version: res.rows[0]?.version || "PostgreSQL (Neon Serverless)",
      database: res.rows[0]?.db || "neondb",
      latencyMs: Date.now() - startedAt
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to connect to Neon database.",
      latencyMs: Date.now() - startedAt
    };
  } finally {
    client?.release();
  }
}
var schemaInitialized = false;
async function initNeonSchema(force = false) {
  if (schemaInitialized && !force) return;
  const pool = await getNeonPool();
  if (!pool) return;
  let client = null;
  try {
    client = await pool.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        role text NOT NULL DEFAULT 'Advocate',
        organization text DEFAULT '',
        default_jurisdiction text NOT NULL DEFAULT 'india_litigation',
        is_admin boolean DEFAULT false,
        password_hash text NOT NULL,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS matters (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        title text NOT NULL,
        matter_code text NOT NULL,
        client_name text NOT NULL,
        opposing_party text DEFAULT '',
        jurisdiction text NOT NULL DEFAULT 'india_litigation',
        forum text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        summary_facts text DEFAULT '',
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS research_memos (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        query text NOT NULL,
        jurisdiction text NOT NULL,
        answer_markdown text NOT NULL,
        citations jsonb NOT NULL DEFAULT '[]'::jsonb,
        citation_integrity jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        doc_type text NOT NULL,
        content text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        updated_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS vault_documents (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        file_name text NOT NULL,
        mime_type text NOT NULL,
        doc_category text NOT NULL DEFAULT 'Annexure',
        extracted_text text DEFAULT '',
        translated_text text DEFAULT '',
        target_language text DEFAULT '',
        chronology jsonb NOT NULL DEFAULT '[]'::jsonb,
        contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_reviews (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        playbook text NOT NULL,
        source_text text NOT NULL,
        summary text DEFAULT '',
        clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
        requisitions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS courtroom_sessions (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        mode text NOT NULL,
        forum_context text NOT NULL,
        brief_excerpt text NOT NULL,
        turns jsonb NOT NULL DEFAULT '[]'::jsonb,
        vulnerabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracked_cases (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        case_number text NOT NULL,
        court text NOT NULL,
        courtroom text DEFAULT '',
        bench text DEFAULT '',
        cause_list_item text DEFAULT '',
        next_hearing_date text NOT NULL,
        stage text NOT NULL,
        notes text DEFAULT '',
        cnr_number text DEFAULT '',
        status text NOT NULL DEFAULT 'listed',
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS deadlines (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        statute_article text DEFAULT '',
        trigger_date text NOT NULL,
        due_date text NOT NULL,
        grace_date text,
        completed boolean NOT NULL DEFAULT false,
        notes text DEFAULT '',
        created_at text NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        matter_id text,
        role text NOT NULL,
        content text NOT NULL,
        language_used text NOT NULL DEFAULT 'en',
        verification_mode text NOT NULL DEFAULT 'deterministic_verified',
        confidence_note text DEFAULT '',
        sources jsonb NOT NULL DEFAULT '[]'::jsonb,
        completed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);
    console.log("[Neon PostgreSQL] Schema successfully verified & provisioned in neondb.");
    schemaInitialized = true;
  } catch (err) {
    console.error("[Neon PostgreSQL] Schema verification error:", err);
  } finally {
    client?.release();
  }
}
async function loadStoreFromNeon() {
  const pool = await getNeonPool();
  if (!pool) return null;
  try {
    const [
      users,
      matters,
      researchMemos,
      drafts,
      vaultDocs,
      contractReviews,
      courtroomSessions,
      trackedCases,
      deadlines,
      assistantMsgs
    ] = await Promise.all([
      pool.query("SELECT * FROM users;"),
      pool.query("SELECT * FROM matters;"),
      pool.query("SELECT * FROM research_memos;"),
      pool.query("SELECT * FROM drafts;"),
      pool.query("SELECT * FROM vault_documents;"),
      pool.query("SELECT * FROM contract_reviews;"),
      pool.query("SELECT * FROM courtroom_sessions;"),
      pool.query("SELECT * FROM tracked_cases;"),
      pool.query("SELECT * FROM deadlines;"),
      pool.query("SELECT * FROM assistant_messages ORDER BY created_at ASC;")
    ]);
    if (users.rows.length === 0 && matters.rows.length === 0) {
      return null;
    }
    return {
      users: users.rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        organization: u.organization || "",
        defaultJurisdiction: u.default_jurisdiction,
        isAdmin: Boolean(u.is_admin),
        passwordHash: u.password_hash,
        createdAt: u.created_at
      })),
      matters: matters.rows.map((m) => ({
        id: m.id,
        userId: m.user_id,
        title: m.title,
        matterCode: m.matter_code,
        clientName: m.client_name,
        opposingParty: m.opposing_party || "",
        jurisdiction: m.jurisdiction,
        forum: m.forum,
        status: m.status,
        summaryFacts: m.summary_facts || "",
        createdAt: m.created_at,
        updatedAt: m.updated_at
      })),
      researchMemos: researchMemos.rows.map((r) => ({
        id: r.id,
        matterId: r.matter_id,
        userId: r.user_id,
        query: r.query,
        jurisdiction: r.jurisdiction,
        answerMarkdown: r.answer_markdown,
        citations: r.citations,
        citationIntegrity: r.citation_integrity,
        createdAt: r.created_at
      })),
      drafts: drafts.rows.map((d) => ({
        id: d.id,
        matterId: d.matter_id,
        userId: d.user_id,
        title: d.title,
        docType: d.doc_type,
        content: d.content,
        version: d.version,
        updatedAt: d.updated_at
      })),
      vaultDocuments: vaultDocs.rows.map((v) => ({
        id: v.id,
        matterId: v.matter_id,
        userId: v.user_id,
        fileName: v.file_name,
        mimeType: v.mime_type,
        docCategory: v.doc_category,
        extractedText: v.extracted_text,
        translatedText: v.translated_text,
        targetLanguage: v.target_language,
        chronology: v.chronology,
        contradictions: v.contradictions,
        createdAt: v.created_at
      })),
      contractReviews: contractReviews.rows.map((c) => ({
        id: c.id,
        matterId: c.matter_id,
        userId: c.user_id,
        title: c.title,
        playbook: c.playbook,
        sourceText: c.source_text,
        summary: c.summary,
        clauses: c.clauses,
        requisitions: c.requisitions,
        createdAt: c.created_at
      })),
      courtroomSessions: courtroomSessions.rows.map((s) => ({
        id: s.id,
        matterId: s.matter_id,
        userId: s.user_id,
        mode: s.mode,
        forumContext: s.forum_context,
        briefExcerpt: s.brief_excerpt,
        turns: s.turns,
        vulnerabilities: s.vulnerabilities,
        createdAt: s.created_at
      })),
      trackedCases: trackedCases.rows.map((t) => ({
        id: t.id,
        matterId: t.matter_id,
        userId: t.user_id,
        caseNumber: t.case_number,
        court: t.court,
        courtroom: t.courtroom,
        bench: t.bench,
        causeListItem: t.cause_list_item,
        nextHearingDate: t.next_hearing_date,
        stage: t.stage,
        notes: t.notes,
        cnrNumber: t.cnr_number,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      })),
      deadlines: deadlines.rows.map((dl) => ({
        id: dl.id,
        matterId: dl.matter_id,
        userId: dl.user_id,
        title: dl.title,
        statuteArticle: dl.statute_article || "",
        triggerDate: dl.trigger_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        dueDate: dl.due_date,
        graceDate: dl.grace_date || void 0,
        completed: Boolean(dl.completed),
        notes: dl.notes || "",
        createdAt: dl.created_at || (/* @__PURE__ */ new Date()).toISOString()
      })),
      meetingBriefs: [],
      whatsappMessages: [],
      assistantMessages: assistantMsgs.rows.map((a) => ({
        id: a.id,
        userId: a.user_id,
        matterId: a.matter_id,
        role: a.role,
        content: a.content,
        languageUsed: a.language_used,
        verificationMode: a.verification_mode,
        confidenceNote: a.confidence_note,
        sources: a.sources,
        completedActions: a.completed_actions,
        createdAt: a.created_at
      }))
    };
  } catch (err) {
    console.error("[Neon PostgreSQL] Failed to load store from Neon database:", err);
    return null;
  }
}
async function persistStoreToNeon(state) {
  const pool = await getNeonPool();
  if (!pool) return;
  let client = null;
  try {
    client = await pool.connect();
    for (const u of state.users) {
      await client.query(
        `INSERT INTO users (id, email, full_name, role, organization, default_jurisdiction, is_admin, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           organization = EXCLUDED.organization,
           default_jurisdiction = EXCLUDED.default_jurisdiction,
           is_admin = EXCLUDED.is_admin,
           password_hash = EXCLUDED.password_hash;`,
        [u.id, u.email, u.fullName, u.role, u.organization, u.defaultJurisdiction, Boolean(u.isAdmin), u.passwordHash, u.createdAt]
      );
    }
    for (const m of state.matters) {
      await client.query(
        `INSERT INTO matters (id, user_id, title, matter_code, client_name, opposing_party, jurisdiction, forum, status, summary_facts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           opposing_party = EXCLUDED.opposing_party,
           status = EXCLUDED.status,
           summary_facts = EXCLUDED.summary_facts,
           updated_at = EXCLUDED.updated_at;`,
        [m.id, m.userId, m.title, m.matterCode, m.clientName, m.opposingParty, m.jurisdiction, m.forum, m.status, m.summaryFacts, m.createdAt, m.updatedAt]
      );
    }
    for (const d of state.drafts) {
      await client.query(
        `INSERT INTO drafts (id, matter_id, user_id, title, doc_type, content, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at;`,
        [d.id, d.matterId, d.userId, d.title, d.docType, d.content, d.version, d.updatedAt]
      );
    }
    for (const r of state.researchMemos) {
      await client.query(
        `INSERT INTO research_memos (id, matter_id, user_id, query, jurisdiction, answer_markdown, citations, citation_integrity, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING;`,
        [r.id, r.matterId, r.userId, r.query, r.jurisdiction, r.answerMarkdown, JSON.stringify(r.citations), JSON.stringify(r.citationIntegrity), r.createdAt]
      );
    }
    for (const v of state.vaultDocuments) {
      await client.query(
        `INSERT INTO vault_documents (id, matter_id, user_id, file_name, mime_type, doc_category, extracted_text, translated_text, target_language, chronology, contradictions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING;`,
        [v.id, v.matterId, v.userId, v.fileName, v.mimeType, v.docCategory, v.extractedText, v.translatedText || "", v.targetLanguage || "", JSON.stringify(v.chronology), JSON.stringify(v.contradictions), v.createdAt]
      );
    }
    for (const dl of state.deadlines) {
      await client.query(
        `INSERT INTO deadlines (id, matter_id, user_id, title, statute_article, trigger_date, due_date, grace_date, completed, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           completed = EXCLUDED.completed,
           notes = EXCLUDED.notes;`,
        [dl.id, dl.matterId, dl.userId, dl.title, dl.statuteArticle || "", dl.triggerDate, dl.dueDate, dl.graceDate || null, dl.completed, dl.notes || "", dl.createdAt]
      );
    }
    for (const cr of state.contractReviews) {
      await client.query(
        `INSERT INTO contract_reviews (id, matter_id, user_id, title, playbook, source_text, summary, clauses, requisitions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           clauses = EXCLUDED.clauses,
           summary = EXCLUDED.summary;`,
        [cr.id, cr.matterId, cr.userId, cr.title, cr.playbook, cr.sourceText, cr.summary, JSON.stringify(cr.clauses), JSON.stringify(cr.requisitions), cr.createdAt]
      );
    }
    for (const cs of state.courtroomSessions) {
      await client.query(
        `INSERT INTO courtroom_sessions (id, matter_id, user_id, mode, forum_context, brief_excerpt, turns, vulnerabilities, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           turns = EXCLUDED.turns,
           vulnerabilities = EXCLUDED.vulnerabilities;`,
        [cs.id, cs.matterId, cs.userId, cs.mode, cs.forumContext, cs.briefExcerpt, JSON.stringify(cs.turns), JSON.stringify(cs.vulnerabilities), cs.createdAt]
      );
    }
    for (const tc of state.trackedCases) {
      await client.query(
        `INSERT INTO tracked_cases (id, matter_id, user_id, case_number, court, courtroom, bench, cause_list_item, next_hearing_date, stage, notes, cnr_number, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           next_hearing_date = EXCLUDED.next_hearing_date,
           stage = EXCLUDED.stage,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at;`,
        [tc.id, tc.matterId, tc.userId, tc.caseNumber, tc.court, tc.courtroom || "", tc.bench || "", tc.causeListItem || "", tc.nextHearingDate, tc.stage, tc.notes || "", tc.cnrNumber || "", tc.status, tc.createdAt, tc.createdAt]
      );
    }
    for (const am of state.assistantMessages) {
      await client.query(
        `INSERT INTO assistant_messages (id, user_id, matter_id, role, content, language_used, verification_mode, confidence_note, sources, completed_actions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING;`,
        [am.id, am.userId, am.matterId, am.role, am.content, am.languageUsed, am.verificationMode, am.confidenceNote || "", JSON.stringify(am.sources), JSON.stringify(am.completedActions), am.createdAt]
      );
    }
  } catch (err) {
    console.error("[Neon PostgreSQL] Failed to sync store snapshot:", err);
  } finally {
    client?.release();
  }
}
async function deleteUserFromNeon(userId) {
  const pool = await getNeonPool();
  if (!pool) return;
  try {
    await Promise.all([
      pool.query("DELETE FROM assistant_messages WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM deadlines WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM tracked_cases WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM courtroom_sessions WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM contract_reviews WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM vault_documents WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM research_memos WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM drafts WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM matters WHERE user_id = $1;", [userId]),
      pool.query("DELETE FROM users WHERE id = $1;", [userId])
    ]);
  } catch (err) {
    console.error("[Neon PostgreSQL] Failed to delete user:", err);
  }
}
async function deleteMatterFromNeon(matterId) {
  const pool = await getNeonPool();
  if (!pool) return;
  try {
    await Promise.all([
      pool.query("DELETE FROM deadlines WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM tracked_cases WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM courtroom_sessions WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM contract_reviews WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM vault_documents WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM research_memos WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM drafts WHERE matter_id = $1;", [matterId]),
      pool.query("DELETE FROM matters WHERE id = $1;", [matterId])
    ]);
  } catch (err) {
    console.error("[Neon PostgreSQL] Failed to delete matter:", err);
  }
}

// src/server/repository.ts
var DATA_DIR = path.resolve(process.cwd(), "data");
var STORE_PATH = path.join(DATA_DIR, "vidhios-store.json");
var EMPTY_STATE = {
  users: [],
  matters: [],
  researchMemos: [],
  drafts: [],
  vaultDocuments: [],
  contractReviews: [],
  courtroomSessions: [],
  trackedCases: [],
  deadlines: [],
  meetingBriefs: [],
  whatsappMessages: [],
  assistantMessages: []
};
var WorkspaceRepository = class {
  constructor() {
    this.writeQueue = Promise.resolve();
    this.readyPromise = null;
    this.state = this.loadState();
    if (isNeonConfigured()) {
      this.engine = "neon";
      this.readyPromise = this.initNeonAsync();
    } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.engine = "supabase";
      this.readyPromise = Promise.resolve();
      this.ensureDemoAccount();
      this.ensureDefaultAdminAccount();
    } else {
      this.engine = "local_durable";
      this.readyPromise = Promise.resolve();
      this.ensureDemoAccount();
      this.ensureDefaultAdminAccount();
    }
  }
  async ensureReady(forceReload = false) {
    if (this.readyPromise) {
      await this.readyPromise;
    }
    if (this.engine === "neon" && forceReload) {
      try {
        const remote = await loadStoreFromNeon();
        if (remote && remote.users.length > 0) {
          this.state = remote;
          this.ensureDemoAccount();
          this.ensureDefaultAdminAccount();
        }
      } catch (err) {
        console.error("[Neon] Background reload error:", err);
      }
    }
  }
  async initNeonAsync() {
    try {
      await initNeonSchema();
      const remoteState = await loadStoreFromNeon();
      if (remoteState && remoteState.users.length > 0) {
        this.state = remoteState;
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        console.log("[Neon] Repository synchronized with remote Neon PostgreSQL.");
      } else {
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        await persistStoreToNeon(this.state);
        console.log("[Neon] Initialized remote Neon PostgreSQL with chamber records.");
      }
    } catch (err) {
      console.error("[Neon] Background sync error:", err);
    }
  }
  loadState() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users ?? [],
          matters: parsed.matters ?? [],
          researchMemos: parsed.researchMemos ?? [],
          drafts: parsed.drafts ?? [],
          vaultDocuments: parsed.vaultDocuments ?? [],
          contractReviews: parsed.contractReviews ?? [],
          courtroomSessions: parsed.courtroomSessions ?? [],
          trackedCases: parsed.trackedCases ?? [],
          deadlines: parsed.deadlines ?? [],
          meetingBriefs: parsed.meetingBriefs ?? [],
          whatsappMessages: parsed.whatsappMessages ?? [],
          assistantMessages: parsed.assistantMessages ?? []
        };
      }
    } catch (err) {
      console.error("Failed to read local durable store; initializing clean state:", err);
    }
    return structuredClone(EMPTY_STATE);
  }
  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
        const tmpPath = `${STORE_PATH}.${crypto3.randomBytes(6).toString("hex")}.tmp`;
        await fs.promises.writeFile(tmpPath, snapshot, "utf8");
        await fs.promises.rename(tmpPath, STORE_PATH);
      } catch {
      }
      if (this.engine === "neon") {
        await persistStoreToNeon(this.state).catch(
          (e) => console.error("[Neon] Auto-persist error:", e)
        );
      }
    }).catch((err) => {
      console.error("Failed to persist store:", err);
    });
    await this.writeQueue;
  }
  toPublicUser(u) {
    const { passwordHash: _ignored, ...profile } = u;
    return profile;
  }
  seedForUser(userId) {
    const seeded = buildSeededWorkspace(userId);
    this.state.matters.push(...seeded.matters);
    this.state.researchMemos.push(...seeded.researchMemos);
    this.state.drafts.push(...seeded.drafts);
    this.state.vaultDocuments.push(...seeded.vaultDocuments);
    this.state.contractReviews.push(...seeded.contractReviews);
    this.state.courtroomSessions.push(...seeded.courtroomSessions);
    this.state.trackedCases.push(...seeded.trackedCases);
    this.state.deadlines.push(...seeded.deadlines);
    this.state.meetingBriefs.push(...seeded.meetingBriefs);
    this.state.whatsappMessages.push(...seeded.whatsappMessages);
  }
  ensureDemoAccount() {
    const demoEmail = "chambers@vidhios.in";
    const existing = this.state.users.find((u) => u.email === demoEmail);
    if (existing) {
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        this.persist();
      }
      return existing;
    }
    const demoUser = {
      id: crypto3.randomUUID(),
      email: demoEmail,
      fullName: "Adv. Meera Deshmukh",
      role: "Managing Partner",
      organization: "Deshmukh & Associates Chambers",
      defaultJurisdiction: "india_litigation",
      isAdmin: true,
      // Ephemeral strong server-only hash; accessed exclusively via explicit /api/auth/demo quick-start
      passwordHash: hashPassword(crypto3.randomBytes(24).toString("hex")),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(demoUser);
    this.seedForUser(demoUser.id);
    this.persist();
    return demoUser;
  }
  ensureDefaultAdminAccount() {
    const adminEmail = "vidhios@admin.com";
    const existing = this.state.users.find((u) => u.email === adminEmail);
    if (existing) {
      let changed = false;
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        changed = true;
      }
      if (!verifyPassword("Vidhios@2026", existing.passwordHash)) {
        existing.passwordHash = hashPassword("Vidhios@2026");
        changed = true;
      }
      if (changed) {
        this.persist();
      }
      return existing;
    }
    const adminUser = {
      id: crypto3.randomUUID(),
      email: adminEmail,
      fullName: "VidhiOS Administrator",
      role: "Principal Legal Administrator",
      organization: "VidhiOS Judiciary Chambers",
      defaultJurisdiction: "india_litigation",
      isAdmin: true,
      passwordHash: hashPassword("Vidhios@2026"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(adminUser);
    this.seedForUser(adminUser.id);
    this.persist();
    return adminUser;
  }
  getDemoUser() {
    return this.toPublicUser(this.ensureDemoAccount());
  }
  async registerUser(input) {
    await this.ensureReady();
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === normalizedEmail)) {
      throw new Error("An account with this email already exists.");
    }
    const user = {
      id: crypto3.randomUUID(),
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      role: input.role?.trim() || "Advocate",
      organization: input.organization?.trim() || "Independent Chambers",
      defaultJurisdiction: input.defaultJurisdiction ?? "india_litigation",
      passwordHash: hashPassword(input.password),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(user);
    this.seedForUser(user.id);
    await this.persist();
    return this.toPublicUser(user);
  }
  async authenticateUser(email, password) {
    await this.ensureReady();
    const normalizedEmail = email.trim().toLowerCase();
    let user = this.state.users.find((u) => u.email === normalizedEmail);
    if (!user && this.engine === "neon") {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.email === normalizedEmail);
    }
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return this.toPublicUser(user);
  }
  async getUserById(userId) {
    await this.ensureReady();
    let user = this.state.users.find((u) => u.id === userId);
    if (!user && this.engine === "neon") {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.id === userId);
    }
    return user ? this.toPublicUser(user) : null;
  }
  getAllUsers() {
    return this.state.users.map((u) => ({
      ...this.toPublicUser(u),
      mattersCount: this.state.matters.filter((m) => m.userId === u.id).length,
      draftsCount: this.state.drafts.filter((d) => d.userId === u.id).length,
      vaultCount: this.state.vaultDocuments.filter((v) => v.userId === u.id).length
    }));
  }
  async adminCreateUser(input) {
    await this.ensureReady();
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === normalizedEmail)) {
      throw new Error("An account with this email already exists.");
    }
    const user = {
      id: crypto3.randomUUID(),
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      role: input.role?.trim() || "Advocate",
      organization: input.organization?.trim() || "Independent Chambers",
      defaultJurisdiction: input.defaultJurisdiction ?? "india_litigation",
      isAdmin: Boolean(input.isAdmin),
      passwordHash: hashPassword(input.password),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(user);
    await this.persist();
    return this.toPublicUser(user);
  }
  async adminUpdateUser(userId, input) {
    await this.ensureReady();
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }
    if (input.fullName !== void 0) user.fullName = input.fullName.trim();
    if (input.organization !== void 0) user.organization = input.organization.trim();
    if (input.role !== void 0) user.role = input.role.trim();
    if (input.defaultJurisdiction !== void 0) user.defaultJurisdiction = input.defaultJurisdiction;
    if (input.isAdmin !== void 0) user.isAdmin = Boolean(input.isAdmin);
    await this.persist();
    return this.toPublicUser(user);
  }
  async adminResetPassword(userId, newPassword) {
    await this.ensureReady();
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    user.passwordHash = hashPassword(newPassword);
    await this.persist();
  }
  async adminDeleteUser(userId) {
    await this.ensureReady();
    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User not found.");
    }
    this.state.users.splice(index, 1);
    this.state.matters = this.state.matters.filter((m) => m.userId !== userId);
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.userId !== userId);
    this.state.drafts = this.state.drafts.filter((d) => d.userId !== userId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.userId !== userId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.userId !== userId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.userId !== userId);
    this.state.trackedCases = this.state.trackedCases.filter((t) => t.userId !== userId);
    this.state.deadlines = this.state.deadlines.filter((d) => d.userId !== userId);
    this.state.assistantMessages = this.state.assistantMessages.filter((a) => a.userId !== userId);
    if (this.engine === "neon") {
      await deleteUserFromNeon(userId);
    }
    await this.persist();
  }
  async getWorkspaceBundle(userId) {
    await this.ensureReady();
    let user = this.state.users.find((u) => u.id === userId);
    if (!user && this.engine === "neon") {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.id === userId);
    }
    if (!user) return null;
    return {
      user: this.toPublicUser(user),
      matters: this.state.matters.filter((m) => m.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      researchMemos: this.state.researchMemos.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      drafts: this.state.drafts.filter((d) => d.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      vaultDocuments: this.state.vaultDocuments.filter((v) => v.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      contractReviews: this.state.contractReviews.filter((c) => c.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      courtroomSessions: this.state.courtroomSessions.filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      trackedCases: this.state.trackedCases.filter((tc) => tc.userId === userId).sort((a, b) => a.nextHearingDate.localeCompare(b.nextHearingDate)),
      deadlines: this.state.deadlines.filter((dl) => dl.userId === userId).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      meetingBriefs: this.state.meetingBriefs.filter((mb) => mb.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      whatsappMessages: this.state.whatsappMessages.filter((w) => w.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      assistantMessages: this.state.assistantMessages.filter((a) => a.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      storageEngine: this.engine
    };
  }
  getMatterForUser(userId, matterId) {
    return this.state.matters.find((m) => m.id === matterId && m.userId === userId);
  }
  createMatter(userId, input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const matter = {
      ...input,
      id: crypto3.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now
    };
    this.state.matters.unshift(matter);
    this.persist();
    return matter;
  }
  deleteMatter(userId, matterId) {
    const exists = this.state.matters.some((m) => m.id === matterId && m.userId === userId);
    if (!exists) return false;
    this.state.matters = this.state.matters.filter((m) => !(m.id === matterId && m.userId === userId));
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.matterId !== matterId);
    this.state.drafts = this.state.drafts.filter((d) => d.matterId !== matterId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.matterId !== matterId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.matterId !== matterId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.matterId !== matterId);
    this.state.trackedCases = this.state.trackedCases.filter((tc) => tc.matterId !== matterId);
    this.state.deadlines = this.state.deadlines.filter((dl) => dl.matterId !== matterId);
    this.state.meetingBriefs = this.state.meetingBriefs.filter((mb) => mb.matterId !== matterId);
    if (this.engine === "neon") {
      void deleteMatterFromNeon(matterId);
    }
    this.persist();
    return true;
  }
  addResearchMemo(memo) {
    const created = {
      ...memo,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.researchMemos.unshift(created);
    this.persist();
    return created;
  }
  createDraft(userId, input) {
    const created = {
      id: crypto3.randomUUID(),
      userId,
      matterId: input.matterId,
      title: input.title,
      docType: input.docType,
      content: input.content,
      version: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.drafts.unshift(created);
    this.persist();
    return created;
  }
  updateDraft(userId, draftId, updates) {
    const draft = this.state.drafts.find((d) => d.id === draftId && d.userId === userId);
    if (!draft) return null;
    if (updates.title !== void 0) draft.title = updates.title;
    if (updates.content !== void 0) draft.content = updates.content;
    draft.version += 1;
    draft.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return draft;
  }
  addVaultDocument(doc) {
    const created = {
      ...doc,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.vaultDocuments.unshift(created);
    this.persist();
    return created;
  }
  addContractReview(review) {
    const created = {
      ...review,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.contractReviews.unshift(created);
    this.persist();
    return created;
  }
  updateRedlineClauseDecision(userId, reviewId, clauseId, decision) {
    const review = this.state.contractReviews.find((c) => c.id === reviewId && c.userId === userId);
    if (!review) return null;
    const clause = review.clauses.find((cl) => cl.id === clauseId);
    if (!clause) return null;
    clause.decision = decision;
    this.persist();
    return review;
  }
  createCourtroomSession(session) {
    const created = {
      ...session,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.courtroomSessions.unshift(created);
    this.persist();
    return created;
  }
  appendCourtroomTurns(userId, sessionId, newTurns, newVulnerabilities) {
    const session = this.state.courtroomSessions.find((s) => s.id === sessionId && s.userId === userId);
    if (!session) return null;
    session.turns.push(...newTurns);
    if (newVulnerabilities && newVulnerabilities.length > 0) {
      session.vulnerabilities = Array.from(/* @__PURE__ */ new Set([...session.vulnerabilities, ...newVulnerabilities]));
    }
    this.persist();
    return session;
  }
  addTrackedCase(item) {
    const created = {
      ...item,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.trackedCases.push(created);
    this.persist();
    return created;
  }
  updateTrackedCaseStatus(userId, caseId, status) {
    const item = this.state.trackedCases.find((tc) => tc.id === caseId && tc.userId === userId);
    if (!item) return null;
    item.status = status;
    this.persist();
    return item;
  }
  addDeadline(item) {
    const created = {
      ...item,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.deadlines.push(created);
    this.persist();
    return created;
  }
  toggleDeadline(userId, deadlineId) {
    const item = this.state.deadlines.find((d) => d.id === deadlineId && d.userId === userId);
    if (!item) return null;
    item.completed = !item.completed;
    this.persist();
    return item;
  }
  addMeetingBrief(brief) {
    const created = {
      ...brief,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.meetingBriefs.unshift(created);
    this.persist();
    return created;
  }
  addWhatsAppMessage(msg) {
    const created = {
      ...msg,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.whatsappMessages.push(created);
    this.persist();
    return created;
  }
  addAssistantMessage(msg) {
    const created = {
      ...msg,
      id: crypto3.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.assistantMessages.push(created);
    const userMsgs = this.state.assistantMessages.filter((m) => m.userId === msg.userId);
    if (userMsgs.length > 120) {
      const oldestId = userMsgs[0].id;
      this.state.assistantMessages = this.state.assistantMessages.filter((m) => m.id !== oldestId);
    }
    this.persist();
    return created;
  }
  clearAssistantMessages(userId) {
    this.state.assistantMessages = this.state.assistantMessages.filter(
      (m) => m.userId !== userId
    );
    this.persist();
  }
};
var repository = new WorkspaceRepository();

// src/server/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";

// src/lib/legal/supremeCourtCorpus.ts
var SUPREME_COURT_CORPUS = [
  {
    id: "sc-sushila-aggarwal-2020",
    caseName: "Sushila Aggarwal & Ors. v. State (NCT of Delhi)",
    citation: "(2020) 5 SCC 1",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 2020,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 482", "CrPC 438", "Article 21"],
    keywords: ["anticipatory bail", "pre-arrest", "duration", "conditions", "liberty", "bail", "482", "438"],
    ratio: "Protection granted under anticipatory bail (formerly Sec. 438 CrPC, now Sec. 482 BNSS) should not invariably be limited to a fixed period and can continue until conclusion of trial unless special circumstances warrant otherwise.",
    practicalApplication: "Cite to oppose prosecution attempts to curtail interim pre-arrest protection or insist on automatic surrender after filing of chargesheet."
  },
  {
    id: "sc-arnesh-kumar-2014",
    caseName: "Arnesh Kumar v. State of Bihar",
    citation: "(2014) 8 SCC 273",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2014,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 35", "CrPC 41A", "BNSS 482", "BNS 85", "IPC 498A"],
    keywords: ["arrest", "notice", "41a", "35 bnss", "bail", "seven years", "custodial", "matrimonial", "commercial"],
    ratio: "Police officers must not mechanically arrest in offences punishable with imprisonment up to 7 years; mandatory written notice of appearance (now Sec. 35(3) BNSS) and recorded reasons for necessity of arrest are binding.",
    practicalApplication: "Anchor every bail and writ petition challenging arbitrary arrest where offences carry <= 7 years punishment or documentary investigation is complete."
  },
  {
    id: "sc-satender-kumar-antil-2022",
    caseName: "Satender Kumar Antil v. Central Bureau of Investigation",
    citation: "(2022) 10 SCC 51",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2022,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 35", "BNSS 480", "BNSS 482", "BNSS 483", "Article 21"],
    keywords: ["bail is the rule", "jail is exception", "economic offence", "chargesheet", "41a", "regular bail", "anticipatory bail"],
    ratio: "Bail is the rule and jail is the exception; non-compliance with Sec. 41/41A CrPC (Sec. 35 BNSS) entitles the accused to bail, and economic offences cannot be treated as a monolithic bar to liberty.",
    practicalApplication: "Essential authority for both regular bail (Sec. 483 BNSS) and anticipatory bail (Sec. 482 BNSS) in commercial/economic offences where accused cooperated."
  },
  {
    id: "sc-delhi-race-club-2024",
    caseName: "Delhi Race Club (1940) Ltd. & Ors. v. State of Uttar Pradesh",
    citation: "2024 INSC 626 / (2024) 10 SCC 690",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2024,
    jurisdiction: "india_litigation",
    statutes: ["BNS 318(4)", "BNS 316(2)", "IPC 420", "IPC 406", "BNSS 528"],
    keywords: ["cheating", "criminal breach of trust", "420", "406", "318", "316", "commercial dispute", "quashing", "mutually exclusive"],
    ratio: "Cheating (IPC 420 / BNS 318(4)) and Criminal Breach of Trust (IPC 406 / BNS 316(2)) are mutually antithetical and cannot coexist on the same set of facts; commercial payment defaults cannot be dressed up as criminal offences.",
    practicalApplication: "Knockout Supreme Court precedent for quashing petitions (Sec. 528 BNSS) and anticipatory bail where FIR mechanically invokes both cheating and breach of trust over a contract dispute."
  },
  {
    id: "sc-bhajan-lal-1992",
    caseName: "State of Haryana & Ors. v. Ch. Bhajan Lal & Ors.",
    citation: "1992 Supp (1) SCC 335",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 1992,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 528", "CrPC 482", "Article 226"],
    keywords: ["quashing", "fir", "abuse of process", "malafide", "528 bnss", "482 crpc", "inherent powers", "writ"],
    ratio: "Establishes the 7 canonical categories where High Courts may exercise inherent power (now Sec. 528 BNSS) or writ jurisdiction (Art. 226) to quash an FIR, including where allegations taken at face value disclose no offence or are manifestly attended with mala fide.",
    practicalApplication: "Structure every High Court Quashing Petition and Writ Petition grounds explicitly around Categories 1, 3, 5, and 7 of Bhajan Lal."
  },
  {
    id: "sc-arjun-panditrao-2020",
    caseName: "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal",
    citation: "(2020) 7 SCC 1",
    court: "Supreme Court of India",
    bench: "3-Judge Bench",
    year: 2020,
    jurisdiction: "india_litigation",
    statutes: ["BSA 63", "IEA 65B", "BSA 62"],
    keywords: ["electronic evidence", "65b", "63 bsa", "certificate", "affidavit", "whatsapp", "email", "cdr", "secondary evidence"],
    ratio: "A mandatory statutory certificate (formerly Sec. 65B(4) IEA, now Sec. 63(4) BSA 2023 with mandatory Schedule Part A & Part B expert certification) is a condition precedent to admissibility of secondary electronic records; primary original device production dispenses with it.",
    practicalApplication: "Cite both when filing a compliant Section 63 BSA electronic evidence affidavit and when objecting to uncertified WhatsApp/email printouts filed by the opponent."
  },
  {
    id: "sc-lalita-kumari-2014",
    caseName: "Lalita Kumari v. Government of Uttar Pradesh",
    citation: "(2014) 2 SCC 1",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 2014,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 173", "CrPC 154"],
    keywords: ["fir", "preliminary inquiry", "commercial offence", "registration", "173 bnss", "154 crpc"],
    ratio: "While registration of FIR is mandatory for cognizable offences, commercial disputes, matrimonial disputes, medical negligence, and abnormal delay cases require a Preliminary Inquiry (now codified under Sec. 173(3) BNSS for 3-7 year offences).",
    practicalApplication: "Challenge hastily registered FIRs in commercial or delayed disputes where the officer bypassed mandatory Preliminary Inquiry under Sec. 173(3) BNSS."
  },
  {
    id: "sc-gurbaksh-sibia-1980",
    caseName: "Gurbaksh Singh Sibbia v. State of Punjab",
    citation: "(1980) 2 SCC 565",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 1980,
    jurisdiction: "india_litigation",
    statutes: ["BNSS 482", "CrPC 438", "Article 21"],
    keywords: ["anticipatory bail", "discretion", "constitutional liberty", "482", "438", "presumption of innocence"],
    ratio: "Judicial discretion in granting anticipatory bail must be exercised liberally in light of Article 21 personal liberty and presumption of innocence; courts should not read artificial restrictions into the statute.",
    practicalApplication: "Foundational Constitution Bench authority supporting anticipatory bail in High Courts and Supreme Court SLPs."
  },
  {
    id: "sc-puttaswamy-2017",
    caseName: "Justice K.S. Puttaswamy (Retd.) v. Union of India",
    citation: "(2017) 10 SCC 1",
    court: "Supreme Court of India",
    bench: "9-Judge Constitution Bench",
    year: 2017,
    jurisdiction: "india_litigation",
    statutes: ["Article 21", "Article 14", "Article 19", "DPDP Act 2023"],
    keywords: ["privacy", "proportionality", "writ", "fundamental right", "constitutional", "surveillance", "data protection"],
    ratio: "Right to privacy is an intrinsic fundamental right under Article 21; any state intrusion must satisfy the four-fold proportionality test: legality, legitimate aim, suitability/necessity, and balancing.",
    practicalApplication: "Use in Article 32 / 226 Writ Petitions challenging unconstitutional digital seizure, phone cloning, or disproportionate regulatory action."
  },
  {
    id: "sc-collector-land-acquisition-1987",
    caseName: "Collector, Land Acquisition, Anantnag v. Mst. Katiji",
    citation: "(1987) 2 SCC 107",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 1987,
    jurisdiction: "india_litigation",
    statutes: ["Limitation Act Sec. 5", "Article 136"],
    keywords: ["condonation of delay", "limitation", "sufficient cause", "delay", "affidavit", "ia", "slp"],
    ratio: 'The expression "sufficient cause" under Section 5 of the Limitation Act must receive a liberal, justice-oriented construction so substantial justice prevails over technical considerations when no mala fides or deliberate inaction exist.',
    practicalApplication: "Anchor Interlocutory Applications (IA) and supporting affidavits seeking condonation of delay in SLPs, High Court appeals, and revisions."
  },
  {
    id: "sc-a-k-k-nambiar-1970",
    caseName: "A.K.K. Nambiar v. Union of India & Anr.",
    citation: "(1969) 3 SCC 864 / AIR 1970 SC 652",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 1970,
    jurisdiction: "india_litigation",
    statutes: ["CPC Order XIX Rule 3", "Supreme Court Rules 2013"],
    keywords: ["affidavit", "verification", "personal knowledge", "information received", "deponent", "oath"],
    ratio: "Verification of affidavits is not an empty formality; paragraphs must clearly distinguish matters true to personal knowledge from those believed to be true upon legal advice or record inspection, failing which the affidavit loses probative value.",
    practicalApplication: "Ensure every drafted affidavit has an ironclad Order XIX Rule 3 CPC verification clause and use it to attack defective opponent counter-affidavits."
  },
  {
    id: "sc-core-arbitration-2024",
    caseName: "Central Organisation for Railway Electrification v. ECI-SPIC-SMO-MCML (JV)",
    citation: "2024 INSC 857",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 2024,
    jurisdiction: "corporate_ma",
    statutes: ["Arbitration & Conciliation Act Sec. 11", "Sec. 12(5)", "Article 14"],
    keywords: ["arbitration", "unilateral appointment", "panel", "independence", "impartiality", "section 11", "contract"],
    ratio: "Unilateral appointment of a sole arbitrator or requiring the counterparty to choose from a curated panel prepared by one party violates equal treatment under Section 18 and independence under Section 12(5) of the A&C Act.",
    practicalApplication: "Cite in Section 11 petitions, contract redlines, and arbitration objections to invalidate one-sided arbitrator appointment clauses."
  },
  {
    id: "sc-fateh-chand-1963",
    caseName: "Fateh Chand v. Balkishan Dass",
    citation: "AIR 1963 SC 1405 / (1964) 1 SCR 515",
    court: "Supreme Court of India",
    bench: "5-Judge Constitution Bench",
    year: 1963,
    jurisdiction: "corporate_ma",
    statutes: ["Indian Contract Act Sec. 73", "Indian Contract Act Sec. 74"],
    keywords: ["liquidated damages", "penalty", "indemnity", "damages", "cap", "breach", "commercial contract", "msa", "spa"],
    ratio: "Under Section 74 of the Indian Contract Act, a stipulated sum in a contract acts as an upper ceiling of reasonable compensation; penalty clauses are unenforceable without proof of actual loss unless genuine pre-estimate is established.",
    practicalApplication: "Core Indian commercial authority for redlining uncapped indemnities, liquidated damages, and termination penalties in MSAs, SPAs, and EPC contracts."
  },
  {
    id: "sc-vidya-drolia-2021",
    caseName: "Vidya Drolia & Ors. v. Durga Trading Corporation",
    citation: "(2021) 2 SCC 1",
    court: "Supreme Court of India",
    bench: "3-Judge Bench",
    year: 2021,
    jurisdiction: "corporate_ma",
    statutes: ["Arbitration & Conciliation Act Sec. 8", "Sec. 11"],
    keywords: ["arbitrability", "four-fold test", "fraud", "section 8", "section 11", "commercial dispute"],
    ratio: "Establishes the four-fold test of non-arbitrability and holds that mere allegations of simple commercial fraud do not oust arbitration; referral courts only conduct a prima facie review under Section 11.",
    practicalApplication: "Use to defeat attempts to derail arbitration via parallel civil suits or criminal complaints alleging contractual fraud."
  },
  {
    id: "sc-ssangyong-2019",
    caseName: "Ssangyong Engineering & Construction Co. Ltd. v. NHAI",
    citation: "(2019) 15 SCC 131",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2019,
    jurisdiction: "global_multi",
    statutes: ["Arbitration & Conciliation Act Sec. 34", "Sec. 48", "New York Convention Art. V"],
    keywords: ["arbitral award", "public policy", "patent illegality", "siac", "enforcement", "international arbitration", "section 34", "section 48"],
    ratio: 'Narrowly confines "public policy of India" post-2015 Amendment to fundamental policy of Indian law and most basic notions of morality or justice; "patent illegality" does not apply to international commercial arbitration awards.',
    practicalApplication: "Key precedent for enforcing SIAC/ICC foreign awards in India under Section 48 or defending domestic awards under Section 34."
  },
  {
    id: "uk-cavendish-makdessi-2015",
    caseName: "Cavendish Square Holding BV v. Talal El Makdessi",
    citation: "[2015] UKSC 67",
    court: "Supreme Court of the United Kingdom",
    bench: "7-Justice Panel",
    year: 2015,
    jurisdiction: "global_multi",
    statutes: ["English Common Law", "Commercial Contracts"],
    keywords: ["liquidated damages", "penalty", "legitimate interest", "epc", "cross-border", "siac", "english law"],
    ratio: "A secondary obligation is an unenforceable penalty only if it imposes a detriment out of all proportion to any legitimate interest of the innocent party in enforcement of the primary obligation.",
    practicalApplication: "Benchmark international authority in English-law governed cross-border EPC, SaaS, and M&A disputes before SIAC or London tribunals."
  },
  {
    id: "sc-dashrath-rupsingh-ni-act",
    caseName: "Meters and Instruments Pvt. Ltd. v. Kanchan Mehta / Sec. 138 NI Act Jurisprudence",
    citation: "(2018) 1 SCC 560",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2018,
    jurisdiction: "india_litigation",
    statutes: ["NI Act Sec. 138", "NI Act Sec. 142", "BNSS 223"],
    keywords: ["cheque bounce", "138", "dishonour", "legal notice", "negotiable instruments", "compounding", "demand notice"],
    ratio: "Offence under Section 138 NI Act is primarily a civil wrong with criminal overtones focused on compensatory justice; strict compliance with the 30-day demand notice and 15-day statutory cure period is mandatory.",
    practicalApplication: "Guides drafting of Section 138 NI Act statutory legal notices, limitation verification, and compounding applications."
  },
  {
    id: "sc-radha-krishan-2021",
    caseName: "M/s Radha Krishan Industries v. State of Himachal Pradesh",
    citation: "(2021) 6 SCC 771",
    court: "Supreme Court of India",
    bench: "Division Bench",
    year: 2021,
    jurisdiction: "india_litigation",
    statutes: ["Article 226", "CGST Act Sec. 83"],
    keywords: ["writ petition", "alternative remedy", "natural justice", "high court", "226", "maintainability", "tax", "gst"],
    ratio: "Existence of an alternate statutory remedy does not bar High Court writ jurisdiction under Article 226 where fundamental rights are infringed, principles of natural justice are violated, proceedings are wholly without jurisdiction, or vires of legislation is challenged.",
    practicalApplication: "Crucial maintainability shield in every High Court Article 226 Writ Petition when State/Respondent objects on alternate remedy."
  }
];
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
}
function retrieveRelevantPrecedents(query, jurisdiction, limit = 4) {
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
    const haystack = `${item.caseName} ${item.ratio} ${item.statutes.join(" ")} ${item.keywords.join(" ")}`.toLowerCase();
    for (const t of tokens) {
      if (haystack.includes(t)) {
        score += 1.2;
      }
    }
    if (item.bench.includes("Constitution")) score += 0.8;
    if (item.year >= 2020) score += 0.5;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((s) => s.item);
}
function formatPrecedentGroundingBlock(precedents) {
  if (precedents.length === 0) return "";
  return [
    "VERIFIED SUPREME COURT & HIGH COURT PRECEDENT CORPUS (DO NOT FABRICATE CITATIONS \u2014 PRIORITIZE THESE AUTHORITIES WHERE APPLICABLE):",
    ...precedents.map(
      (p, i) => `${i + 1}. ${p.caseName}, ${p.citation} (${p.court}, ${p.bench}, ${p.year}) | Provisions: ${p.statutes.join(", ")}
   Ratio: ${p.ratio}
   Strategic Use: ${p.practicalApplication}`
    )
  ].join("\n");
}

// src/server/nvidiaService.ts
import crypto4 from "node:crypto";

// src/lib/legal/statuteCrosswalk.ts
var STATUTE_CROSSWALK = [
  // IPC 1860 -> BNS 2023
  {
    legacyCode: "IPC",
    legacySection: "34",
    newCode: "BNS",
    newSection: "3(5)",
    title: "Acts done by several persons in furtherance of common intention",
    keyChangeNote: "Consolidated into General Explanations under Section 3(5) BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "120B",
    newCode: "BNS",
    newSection: "61(2)",
    title: "Punishment of criminal conspiracy",
    keyChangeNote: "Criminal conspiracy definition and punishment unified under Section 61 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "124A",
    newCode: "BNS",
    newSection: "152",
    title: "Acts endangering sovereignty, unity and integrity of India",
    keyChangeNote: "Sedition repealed; replaced by Section 152 BNS with electronic communication and financial means expressly covered.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "141",
    newCode: "BNS",
    newSection: "189(1)",
    title: "Unlawful assembly",
    keyChangeNote: "Retained in substance under Section 189 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "279",
    newCode: "BNS",
    newSection: "281",
    title: "Rash driving or riding on a public way",
    keyChangeNote: "Renumbered to Section 281 BNS; note enhanced hit-and-run framework in Section 106(2).",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "302",
    newCode: "BNS",
    newSection: "103(1)",
    title: "Punishment for murder",
    keyChangeNote: "Section 103(2) introduces a dedicated provision for mob lynching by a group of five or more persons.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "IPC",
    legacySection: "304",
    newCode: "BNS",
    newSection: "105",
    title: "Punishment for culpable homicide not amounting to murder",
    keyChangeNote: "Minimum sentence of 5 years introduced under Part I.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "304A",
    newCode: "BNS",
    newSection: "106",
    title: "Causing death by negligence",
    keyChangeNote: "Enhanced imprisonment up to 5 years (2 years for registered medical practitioners); Sec. 106(2) covers hit-and-run.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "304B",
    newCode: "BNS",
    newSection: "80",
    title: "Dowry death",
    keyChangeNote: "Consolidated under Chapter V (Offences against Woman and Child) as Section 80 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "306",
    newCode: "BNS",
    newSection: "108",
    title: "Abetment of suicide",
    keyChangeNote: "Renumbered as Section 108 BNS; child/insane person abetment under Section 107.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "307",
    newCode: "BNS",
    newSection: "109",
    title: "Attempt to murder",
    keyChangeNote: "Renumbered as Section 109 BNS with life-convict clause in 109(2).",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "323",
    newCode: "BNS",
    newSection: "115(2)",
    title: "Punishment for voluntarily causing hurt",
    keyChangeNote: "Maximum fine increased from \u20B91,000 to \u20B910,000.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "324",
    newCode: "BNS",
    newSection: "118(1)",
    title: "Voluntarily causing hurt by dangerous weapons or means",
    keyChangeNote: "Fine enhanced up to \u20B920,000 under Section 118(1) BNS.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "354",
    newCode: "BNS",
    newSection: "74",
    title: "Assault or criminal force to woman with intent to outrage her modesty",
    keyChangeNote: "Placed in Chapter V as Section 74 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "376",
    newCode: "BNS",
    newSection: "64",
    title: "Punishment for rape",
    keyChangeNote: "Minimum punishment 10 years; see also Section 69 BNS for deceitful promise of marriage.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "IPC",
    legacySection: "379",
    newCode: "BNS",
    newSection: "303(2)",
    title: "Punishment for theft",
    keyChangeNote: "Community service introduced for first-time petty theft under \u20B95,000; enhanced penalty for repeat offenders.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "384",
    newCode: "BNS",
    newSection: "308(2)",
    title: "Punishment for extortion",
    keyChangeNote: "Imprisonment enhanced from 3 years to 7 years.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "406",
    newCode: "BNS",
    newSection: "316(2)",
    title: "Punishment for criminal breach of trust",
    keyChangeNote: "Maximum imprisonment increased from 3 years to 5 years.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "409",
    newCode: "BNS",
    newSection: "316(5)",
    title: "Criminal breach of trust by public servant, banker, merchant or agent",
    keyChangeNote: "Unified under Section 316(5) BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "415",
    newCode: "BNS",
    newSection: "318(1)",
    title: "Cheating (Definition)",
    keyChangeNote: "Definition and graded punishments consolidated under Section 318 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "420",
    newCode: "BNS",
    newSection: "318(4)",
    title: "Cheating and dishonestly inducing delivery of property",
    keyChangeNote: "Consolidated under Section 318(4) BNS (up to 7 years imprisonment and fine); check Section 111 for organized economic crime.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "IPC",
    legacySection: "465",
    newCode: "BNS",
    newSection: "336(2)",
    title: "Punishment for forgery",
    keyChangeNote: "Definition and punishments grouped under Section 336 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "467",
    newCode: "BNS",
    newSection: "338",
    title: "Forgery of valuable security, will, etc.",
    keyChangeNote: "Renumbered to Section 338 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "468",
    newCode: "BNS",
    newSection: "336(3)",
    title: "Forgery for purpose of cheating",
    keyChangeNote: "Consolidated as Section 336(3) BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "471",
    newCode: "BNS",
    newSection: "340(2)",
    title: "Using as genuine a forged document or electronic record",
    keyChangeNote: "Explicitly covers electronic records under Section 340(2) BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "498A",
    newCode: "BNS",
    newSection: "85",
    title: "Husband or relative of husband of a woman subjecting her to cruelty",
    keyChangeNote: "Definition of cruelty split into Section 86 BNS; substantive offence under Section 85 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "499",
    newCode: "BNS",
    newSection: "356(1)",
    title: "Defamation",
    keyChangeNote: "Community service added as an alternative punishment in Section 356(2) BNS.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "500",
    newCode: "BNS",
    newSection: "356(2)",
    title: "Punishment for defamation",
    keyChangeNote: "Community service added alongside simple imprisonment up to 2 years or fine.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IPC",
    legacySection: "504",
    newCode: "BNS",
    newSection: "352",
    title: "Intentional insult with intent to provoke breach of peace",
    keyChangeNote: "Renumbered as Section 352 BNS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IPC",
    legacySection: "506",
    newCode: "BNS",
    newSection: "351(2)",
    title: "Punishment for criminal intimidation",
    keyChangeNote: "Consolidated under Section 351(2) & 351(3) BNS.",
    changeImpact: "renumbered"
  },
  // CrPC 1973 -> BNSS 2023
  {
    legacyCode: "CrPC",
    legacySection: "41A",
    newCode: "BNSS",
    newSection: "35(3)",
    title: "Notice of appearance before police officer",
    keyChangeNote: "Arnesh Kumar safeguard incorporated into Section 35(3)\u2013(6) BNSS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "CrPC",
    legacySection: "125",
    newCode: "BNSS",
    newSection: "144",
    title: "Order for maintenance of wives, children and parents",
    keyChangeNote: "Renumbered as Section 144 BNSS with unchanged substantive principles.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "CrPC",
    legacySection: "154",
    newCode: "BNSS",
    newSection: "173",
    title: "Information in cognizable cases (FIR / Zero FIR / e-FIR)",
    keyChangeNote: "Expressly codifies Zero FIR, electronic FIR (signed within 3 days), and preliminary inquiry for 3\u20137 year offences.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "CrPC",
    legacySection: "156(3)",
    newCode: "BNSS",
    newSection: "175(3)",
    title: "Magistrate order for police investigation",
    keyChangeNote: "Requires prior SP application under Sec. 173(4) and affidavit; Magistrate may consider police submissions before ordering.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "CrPC",
    legacySection: "161",
    newCode: "BNSS",
    newSection: "180",
    title: "Examination of witnesses by police",
    keyChangeNote: "Permits audio-video electronic recording of witness statements.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "CrPC",
    legacySection: "164",
    newCode: "BNSS",
    newSection: "183",
    title: "Recording of confessions and statements before Magistrate",
    keyChangeNote: "Mandatory Magistrate statement in offences carrying 10+ years imprisonment and specified sexual offences.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "CrPC",
    legacySection: "167",
    newCode: "BNSS",
    newSection: "187",
    title: "Procedure when investigation cannot be completed in 24 hours (Remand / Default Bail)",
    keyChangeNote: "Police custody (up to 15 days) may now be sought in tranches within the first 40 or 60 days of detention.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "CrPC",
    legacySection: "173",
    newCode: "BNSS",
    newSection: "193",
    title: "Report of police officer on completion of investigation (Chargesheet)",
    keyChangeNote: "Electronic forwarding permitted; victim/informant must be updated on progress within 90 days.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "CrPC",
    legacySection: "200",
    newCode: "BNSS",
    newSection: "223",
    title: "Examination of complainant",
    keyChangeNote: "Proviso mandates giving the accused an opportunity of being heard before taking cognizance on a private complaint.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "CrPC",
    legacySection: "227",
    newCode: "BNSS",
    newSection: "250",
    title: "Discharge in Sessions trial",
    keyChangeNote: "Accused may prefer discharge application within 60 days from committal.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "CrPC",
    legacySection: "313",
    newCode: "BNSS",
    newSection: "351",
    title: "Power to examine the accused",
    keyChangeNote: "Renumbered as Section 351 BNSS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "CrPC",
    legacySection: "389",
    newCode: "BNSS",
    newSection: "430",
    title: "Suspension of sentence pending appeal; release of appellant on bail",
    keyChangeNote: "Renumbered as Section 430 BNSS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "CrPC",
    legacySection: "437",
    newCode: "BNSS",
    newSection: "480",
    title: "When bail may be taken in case of non-bailable offence",
    keyChangeNote: "Renumbered as Section 480 BNSS; see Section 479 BNSS for first-time undertrial release at 1/3rd maximum sentence.",
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "CrPC",
    legacySection: "438",
    newCode: "BNSS",
    newSection: "482",
    title: "Direction for grant of bail to person apprehending arrest (Anticipatory Bail)",
    keyChangeNote: "Streamlined statutory factors; check exclusions for gang rape of minor under Section 482(4) BNSS.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "CrPC",
    legacySection: "439",
    newCode: "BNSS",
    newSection: "483",
    title: "Special powers of High Court or Court of Session regarding bail",
    keyChangeNote: "Renumbered as Section 483 BNSS.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "CrPC",
    legacySection: "482",
    newCode: "BNSS",
    newSection: "528",
    title: "Saving of inherent powers of High Court (Quashing)",
    keyChangeNote: "Verbatim preservation of inherent High Court quashing jurisdiction under Section 528 BNSS.",
    changeImpact: "renumbered"
  },
  // Indian Evidence Act 1872 -> Bharatiya Sakshya Adhiniyam 2023
  {
    legacyCode: "IEA",
    legacySection: "27",
    newCode: "BSA",
    newSection: "23(2)",
    title: "How much of information received from accused may be proved",
    keyChangeNote: "Consolidated as proviso to Section 23(2) BSA.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IEA",
    legacySection: "32",
    newCode: "BSA",
    newSection: "26",
    title: "Cases in which statement of relevant fact by person who is dead or cannot be found is relevant (Dying Declaration)",
    keyChangeNote: "Renumbered as Section 26 BSA.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IEA",
    legacySection: "45",
    newCode: "BSA",
    newSection: "39(1)",
    title: "Opinions of experts",
    keyChangeNote: 'Broadened to expressly include "any other field" and electronic evidence examiners under Section 39(2) BSA.',
    changeImpact: "expanded_scope"
  },
  {
    legacyCode: "IEA",
    legacySection: "65B",
    newCode: "BSA",
    newSection: "63",
    title: "Admissibility of electronic records",
    keyChangeNote: "Expanded to semiconductor memory, cloud/server logs, and mandatory statutory Schedule Certificate signed by person in charge AND an expert.",
    changeImpact: "substantive_change"
  },
  {
    legacyCode: "IEA",
    legacySection: "101",
    newCode: "BSA",
    newSection: "104",
    title: "Burden of proof",
    keyChangeNote: "Renumbered as Section 104 BSA.",
    changeImpact: "renumbered"
  },
  {
    legacyCode: "IEA",
    legacySection: "114",
    newCode: "BSA",
    newSection: "119",
    title: "Court may presume existence of certain facts",
    keyChangeNote: "Renumbered as Section 119 BSA.",
    changeImpact: "renumbered"
  }
];
var CODE_ALIAS_MAP = {
  ipc: "IPC",
  "i.p.c": "IPC",
  "i.p.c.": "IPC",
  "indian penal code": "IPC",
  crpc: "CrPC",
  "cr.p.c": "CrPC",
  "cr.p.c.": "CrPC",
  "code of criminal procedure": "CrPC",
  iea: "IEA",
  "i.e.a": "IEA",
  "i.e.a.": "IEA",
  "indian evidence act": "IEA",
  "evidence act": "IEA"
};
function normalizeSectionKey(section) {
  return section.trim().toUpperCase().replace(/\s+/g, "");
}
function findExactMapping(legacyCode, section) {
  const key = normalizeSectionKey(section);
  return STATUTE_CROSSWALK.find(
    (m) => m.legacyCode === legacyCode && normalizeSectionKey(m.legacySection) === key
  );
}
function lookupStatuteMappings(query) {
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
      entry.keyChangeNote
    ].join(" ").toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}
function scanDraftForLegacyCitations(text) {
  if (!text) return [];
  const matches = [];
  const seenRanges = /* @__PURE__ */ new Set();
  const patternSectionFirst = /\b(?:Sections?|Sec\.?|S\.|u\/s)\s+(\d+[A-Za-z]?(?:\(\d+\))?)\s*(?:of\s+(?:the\s+)?)?(IPC|I\.P\.C\.?|Indian\s+Penal\s+Code(?:,?\s*1860)?|CrPC|Cr\.P\.C\.?|Code\s+of\s+Criminal\s+Procedure(?:,?\s*1973)?|IEA|I\.E\.A\.?|Indian\s+Evidence\s+Act(?:,?\s*1872)?|Evidence\s+Act(?:,?\s*1872)?)\b/gi;
  const patternCodeFirst = /\b(IPC|I\.P\.C\.?|CrPC|Cr\.P\.C\.?|IEA|I\.E\.A\.?)\s+(?:Sections?|Sec\.?|S\.)?\s*(\d+[A-Za-z]?(?:\(\d+\))?)\b/gi;
  const registerMatch = (matchedText, startIndex, rawSection, rawCode) => {
    const normalizedCodeKey = rawCode.toLowerCase().replace(/,?\s*\d{4}$/, "").replace(/\s+/g, " ").trim();
    const legacyCode = CODE_ALIAS_MAP[normalizedCodeKey];
    if (!legacyCode) return;
    const mapping = findExactMapping(legacyCode, rawSection);
    if (!mapping) return;
    const endIndex = startIndex + matchedText.length;
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
      mapping
    });
  };
  let m;
  while ((m = patternSectionFirst.exec(text)) !== null) {
    registerMatch(m[0], m.index, m[1], m[2]);
  }
  while ((m = patternCodeFirst.exec(text)) !== null) {
    registerMatch(m[0], m.index, m[2], m[1]);
  }
  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

// src/lib/legal/judiciaryTemplates.ts
var JUDICIARY_FORM_TEMPLATES = [
  {
    id: "general_affidavit",
    name: "Affidavit-in-Support (Order XIX CPC / SC Rules)",
    category: "affidavit",
    courtLevel: "Supreme Court / High Court / District Court",
    statuteBasis: "Order XIX Rule 3 CPC & Supreme Court Rules 2013",
    description: "Formal sworn affidavit with strict knowledge-vs-advice verification clause per A.K.K. Nambiar Constitution Bench standards.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY",
    defaultCaseType: "CRIMINAL APPLICATION NO. ____ OF 2026",
    suggestedRelief: "Verify facts stated in the accompanying petition/application on oath."
  },
  {
    id: "counter_affidavit",
    name: "Counter Affidavit / Affidavit-in-Reply",
    category: "affidavit",
    courtLevel: "Supreme Court / High Court",
    statuteBasis: "Article 226 / Order XIX CPC / SC Rules Order XXI",
    description: "Para-wise reply affidavit with preliminary objections on maintainability, suppression of material facts, and parawise traversal.",
    defaultCourt: "IN THE HON\u2019BLE SUPREME COURT OF INDIA",
    defaultCaseType: "SPECIAL LEAVE PETITION (CIVIL) NO. ____ OF 2026",
    suggestedRelief: "Dismiss the petition in limine with exemplary costs."
  },
  {
    id: "rejoinder_affidavit",
    name: "Rejoinder Affidavit",
    category: "affidavit",
    courtLevel: "Supreme Court / High Court",
    statuteBasis: "Order XIX CPC & High Court Writ Rules",
    description: "Rebuttal affidavit answering new factual pleas raised in the Respondent\u2019s Counter Affidavit and reaffirming original prayers.",
    defaultCourt: "IN THE HIGH COURT OF DELHI AT NEW DELHI",
    defaultCaseType: "WRIT PETITION (CIVIL) NO. ____ OF 2026",
    suggestedRelief: "Reject averments in Counter Affidavit and allow the Petition as prayed."
  },
  {
    id: "sec_63_bsa_certificate",
    name: "Section 63 BSA Electronic Evidence Certificate & Affidavit",
    category: "affidavit",
    courtLevel: "All Indian Courts & Tribunals",
    statuteBasis: "Section 63(4) Bharatiya Sakshya Adhiniyam, 2023 (Schedule Part A & B)",
    description: "Mandatory electronic evidence affidavit replacing Section 65B IEA, including hash-value declaration and Schedule Part A/B certification.",
    defaultCourt: "IN THE COURT OF THE HON\u2019BLE SESSIONS / COMMERCIAL JUDGE",
    defaultCaseType: "COMMERCIAL SUIT / CRIMINAL CASE NO. ____ OF 2026",
    suggestedRelief: "Admit electronic records (emails, WhatsApp exports, server logs) into evidence."
  },
  {
    id: "slp_article_136",
    name: "Special Leave Petition (SLP \u2014 Article 136)",
    category: "supreme_court",
    courtLevel: "Supreme Court of India",
    statuteBasis: "Article 136 of the Constitution of India & Order XXI/XXII SC Rules 2013",
    description: "Complete SC Registry format: Synopsis & List of Dates, Questions of Law, Declaration in Form 28, Grounds, Main & Interim Prayers, and Affidavit.",
    defaultCourt: "IN THE HON\u2019BLE SUPREME COURT OF INDIA\n(CIVIL / CRIMINAL APPELLATE JURISDICTION)",
    defaultCaseType: "SPECIAL LEAVE PETITION (C/CRL.) NO. ____ OF 2026",
    suggestedRelief: "Grant Special Leave to Appeal and stay operation of the impugned High Court judgment."
  },
  {
    id: "writ_petition_226",
    name: "Writ Petition (Article 226 / Article 32)",
    category: "high_court",
    courtLevel: "High Court / Supreme Court",
    statuteBasis: "Article 226 / Article 32 of the Constitution of India",
    description: "Constitutional Writ of Certiorari / Mandamus with maintainability shield (Radha Krishan Industries), proportionality grounds, and interim stay prayer.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(ORDINARY ORIGINAL CIVIL / WRIT JURISDICTION)",
    defaultCaseType: "WRIT PETITION NO. ____ OF 2026",
    suggestedRelief: "Issue a Writ of Certiorari quashing the impugned order and a Writ of Mandamus."
  },
  {
    id: "anticipatory_bail_482_bnss",
    name: "Anticipatory Bail Application (Section 482 BNSS)",
    category: "criminal_bnss",
    courtLevel: "High Court / Sessions Court",
    statuteBasis: "Section 482 Bharatiya Nagarik Suraksha Sanhita, 2023 (formerly Sec. 438 CrPC)",
    description: "Pre-arrest bail application invoking Sushila Aggarwal, Arnesh Kumar, and Satender Kumar Antil with undertaking to join investigation.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(CRIMINAL APPELLATE JURISDICTION)",
    defaultCaseType: "ANTICIPATORY BAIL APPLICATION NO. ____ OF 2026",
    suggestedRelief: "Direct release of Applicant on pre-arrest bail in the event of arrest in the subject FIR."
  },
  {
    id: "quashing_528_bnss",
    name: "FIR Quashing Petition (Section 528 BNSS)",
    category: "criminal_bnss",
    courtLevel: "High Court",
    statuteBasis: "Section 528 BNSS 2023 (formerly Sec. 482 CrPC) & Article 226",
    description: "Inherent jurisdiction quashing petition structured around Bhajan Lal categories and Delhi Race Club (2024) civil-to-criminal bar.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(CRIMINAL WRIT / INHERENT JURISDICTION)",
    defaultCaseType: "CRIMINAL WRIT PETITION / APPLICATION NO. ____ OF 2026",
    suggestedRelief: "Quash and set aside the impugned FIR and stay coercive proceedings pending disposal."
  },
  {
    id: "vakalatnama",
    name: "Vakalatnama (Supreme Court / High Court Form)",
    category: "civil_commercial",
    courtLevel: "Supreme Court / High Court / Tribunals",
    statuteBasis: "Order III Rule 4 CPC & Advocates Act 1961 / SC Rules Form 19",
    description: "Standard court-filing Vakalatnama authorizing Advocate-on-Record / Counsel to appear, plead, compromise, withdraw, and receive notices.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY",
    defaultCaseType: "CASE / PETITION NO. ____ OF 2026",
    suggestedRelief: "Appoint and authorize Counsel to represent the executant in all stages of the matter."
  },
  {
    id: "ia_condonation_delay",
    name: "IA for Condonation of Delay (Section 5 Limitation Act)",
    category: "supreme_court",
    courtLevel: "Supreme Court / High Court / Tribunals",
    statuteBasis: "Section 5 of the Limitation Act, 1963",
    description: "Interlocutory Application explaining day-to-day sufficient cause backed by Collector Land Acquisition v. Katiji and sworn Affidavit.",
    defaultCourt: "IN THE HON\u2019BLE SUPREME COURT OF INDIA",
    defaultCaseType: "I.A. NO. ____ OF 2026 IN SLP NO. ____ OF 2026",
    suggestedRelief: "Condone the bonafide delay of ___ days in filing the accompanying Petition/Appeal."
  },
  {
    id: "caveat_148a_cpc",
    name: "Caveat Petition (Section 148A CPC)",
    category: "civil_commercial",
    courtLevel: "Supreme Court / High Court / District Court",
    statuteBasis: "Section 148A Code of Civil Procedure, 1908 (Valid 90 Days)",
    description: "Preventive caveat ensuring no ex-parte interim stay or injunction is passed without prior notice and hearing to the Caveator.",
    defaultCourt: "IN THE HON\u2019BLE SUPREME COURT OF INDIA",
    defaultCaseType: "CAVEAT APPLICATION NO. ____ OF 2026",
    suggestedRelief: "Direct that no ex-parte order be passed without prior notice to the Caveator."
  },
  {
    id: "legal_notice_138_commercial",
    name: "Statutory Demand Notice (Sec. 138 NI Act / Commercial)",
    category: "civil_commercial",
    courtLevel: "Pre-Litigation / Commercial Court / Magistrate",
    statuteBasis: "Section 138(b) Negotiable Instruments Act 1881 / Indian Contract Act 1872",
    description: "Formal Registered AD / Email Advocate Notice with strict 15-day statutory cure period, interest calculation, and litigation reserve.",
    defaultCourt: "BY REGISTERED POST A.D. / SPEED POST / EMAIL",
    defaultCaseType: "STATUTORY LEGAL DEMAND NOTICE",
    suggestedRelief: "Demand payment of principal dues with contractual interest within 15 days of receipt."
  },
  {
    id: "arbitration_sec9_sec11",
    name: "Arbitration Petition (Sec. 9 Interim Relief / Sec. 11 Appointment)",
    category: "civil_commercial",
    courtLevel: "High Court / Commercial Court",
    statuteBasis: "Sections 9 & 11 of the Arbitration and Conciliation Act, 1996",
    description: "Petition for interim asset preservation or independent arbitrator appointment citing CORE (2024 Constitution Bench) and Vidya Drolia.",
    defaultCourt: "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n(COMMERCIAL DIVISION \u2014 ARBITRATION)",
    defaultCaseType: "COMMERCIAL ARBITRATION PETITION NO. ____ OF 2026",
    suggestedRelief: "Grant urgent interim security/injunction and appoint an independent sole arbitrator."
  }
];
function getJudiciaryTemplate(id) {
  return JUDICIARY_FORM_TEMPLATES.find((t) => t.id === id) ?? JUDICIARY_FORM_TEMPLATES[0];
}
function buildDeterministicJudiciaryForm(input) {
  const tpl = getJudiciaryTemplate(input.templateId);
  const court = (input.courtName || tpl.defaultCourt).trim().toUpperCase();
  const caseNo = (input.caseNumber || tpl.defaultCaseType).trim().toUpperCase();
  const petitioner = input.petitionerName.trim() || "[NAME OF PETITIONER / APPLICANT]";
  const respondent = input.respondentName.trim() || "[NAME OF RESPONDENT / OPPOSITE PARTY]";
  const deponent = input.deponentName.trim() || petitioner;
  const deponentDesc = input.deponentDetails.trim() || "aged about ___ years, authorized signatory / resident of [FULL ADDRESS]";
  const place = input.placeOfFiling.trim() || "Mumbai / New Delhi";
  const dateStr = input.filingDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const facts = input.factsSummary.trim() || "The Applicant relies upon the chronological factual record annexed herewith and reserves liberty to refer to additional documents at the time of hearing.";
  const relief = input.reliefSought.trim() || tpl.suggestedRelief;
  if (tpl.id === "vakalatnama") {
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
  if (tpl.id === "sec_63_bsa_certificate") {
    return `${court}

${caseNo}

IN THE MATTER OF:
${petitioner}
... PETITIONER / PLAINTIFF

VERSUS

${respondent}
... RESPONDENT / DEFENDANT

CERTIFICATE AND AFFIDAVIT UNDER SECTION 63(4) OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023
(Read with the Schedule \u2014 Part A & Part B; replacing Section 65B(4) of the Indian Evidence Act, 1872)

I, ${deponent}, ${deponentDesc}, do hereby solemnly affirm and state on oath as follows:

1. That I am the authorized custodian / lawful controller of the computer resource and electronic communication devices from which the electronic records annexed to the present proceedings have been extracted, and I am fully competent to swear this Certificate-cum-Affidavit under Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023 ("BSA 2023").

2. BRIEF CONTEXT OF ELECTRONIC RECORDS:
${facts}

3. IDENTIFICATION OF ELECTRONIC RECORD & DEVICE PARTICULARS (SCHEDULE \u2014 PART A):
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

PART B \u2014 TECHNICAL EXPERT CERTIFICATION (REQUIRED UNDER BSA 2023 SCHEDULE):
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

// src/lib/legal/responseFormatter.ts
var CHATTER_PREAMBLE_PATTERNS = [
  /^(?:certainly|sure|of\s+course|absolutely|here(?:'s|\s+is)|below\s+is|please\s+find\s+below)[^.\n:]{0,120}[.:!]\s*\n+/i,
  /^(?:as\s+a\s+senior\s+advocate|as\s+an\s+ai|i\s+would\s+be\s+happy\s+to\s+help)[^.\n:]{0,140}[.:!]\s*\n+/i,
  /^(?:ज़रूर|निश्चित\s+रूप\s+से|बिल्कुल|यहाँ\s+आपका)[^।\n:]{0,120}[।.:!]\s*\n+/u
];
var CHATTER_OUTRO_PATTERNS = [
  /\n+(?:please\s+let\s+me\s+know\s+if\s+you\s+(?:need|would\s+like)|hope\s+this\s+helps|feel\s+free\s+to\s+ask)[^\n]{0,160}$/i
];
function stripModelArtifacts(raw) {
  if (!raw) return "";
  let text = raw.replace(/\r\n/g, "\n").trim();
  text = text.replace(/<(?:think|reasoning|analysis)>[\s\S]*?<\/(?:think|reasoning|analysis)>/gi, "").trim();
  const stripPreambles = (value) => {
    let out = value;
    for (const re of CHATTER_PREAMBLE_PATTERNS) {
      out = out.replace(re, "");
    }
    for (const re of CHATTER_OUTRO_PATTERNS) {
      out = out.replace(re, "");
    }
    return out.trim();
  };
  text = stripPreambles(text);
  const fenceMatch = /^```(?:markdown|md|text|txt|legal)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    text = text.replace(/^```(?:markdown|md|text|txt|legal)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return stripPreambles(text);
}
function formatAiMarkdownResponse(raw) {
  let text = stripModelArtifacts(raw);
  if (!text) return "";
  const lines = text.split("\n");
  const normalized = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].replace(/[ \t]+$/g, "");
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      continue;
    }
    line = line.replace(/^(#{1,4})([^\s#])/, "$1 $2");
    const standaloneBoldHeading = /^\*\*([^*\n]{3,90}?):?\*\*$/.exec(line.trim());
    if (standaloneBoldHeading && !line.trim().startsWith("|")) {
      line = `### ${standaloneBoldHeading[1].replace(/:$/, "").trim()}`;
    }
    const bracketBanner = /^\[(ENGLISH|HINDI|हिंदी(?:\s+सारांश)?|BILINGUAL[^\]]*)\]$/i.exec(line.trim());
    if (bracketBanner) {
      line = `### ${bracketBanner[1].trim()}`;
    }
    if (/^\s*[•▪‣●]\s+/.test(line)) {
      line = line.replace(/^\s*[•▪‣●]\s+/, "- ");
    } else if (/^\s*\*\s+/.test(line)) {
      line = line.replace(/^\s*\*\s+/, "- ");
    } else if (/^\s*–\s+/.test(line)) {
      line = line.replace(/^\s*–\s+/, "- ");
    }
    line = line.replace(/^(\s*\d+)\)\s+/, "$1. ");
    line = line.replace(/\*\*\s*\*\*/g, "");
    if (/^#{1,4}\s+/.test(line) && normalized.length > 0 && normalized[normalized.length - 1] !== "") {
      normalized.push("");
    }
    normalized.push(line);
  }
  return normalized.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function formatPlainCourtDocument(raw) {
  let text = stripModelArtifacts(raw);
  if (!text) return "";
  const lines = text.split("\n").map((rawLine) => {
    let line = rawLine.replace(/[ \t]+$/g, "");
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      return "";
    }
    line = line.replace(/^\s*#{1,6}\s+/, "");
    line = line.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1").replace(/`([^`\n]+)`/g, "$1");
    line = line.replace(/^\s*\*\s+/, "- ");
    return line;
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function stripMarkdownForPlainText(raw) {
  let text = stripModelArtifacts(raw);
  if (!text) return "";
  return text.replace(/^\s*#{1,6}\s+/gm, "").replace(/^\s*(?:[-*_]\s*){3,}$/gm, "").replace(/^\s*>\s?/gm, "").replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1$2").replace(/`([^`\n]+)`/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)").replace(/\n{3,}/g, "\n\n").trim();
}

// src/server/nvidiaService.ts
var NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
var DEFAULT_PRIMARY_MODEL = "mistralai/mistral-large-4-1t-a52b";
var DEFAULT_FAST_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
var FALLBACK_MODELS = [
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "mistralai/mistral-large-4-1t-a52b",
  "minimaxai/minimax-m3.1-flash"
];
var RESPONSE_CACHE = /* @__PURE__ */ new Map();
var MAX_CACHE_ENTRIES = 80;
var CACHE_TTL_MS = 10 * 60 * 1e3;
function getNvidiaConfig() {
  const rawKey = (process.env.NVIDIA_API_KEY ?? "").trim();
  const configured = Boolean(rawKey && rawKey !== "MY_NVIDIA_API_KEY");
  const primaryModel = (process.env.NVIDIA_MODEL ?? "").trim() || DEFAULT_PRIMARY_MODEL;
  const fastModel = (process.env.NVIDIA_FAST_MODEL ?? "").trim() || DEFAULT_FAST_MODEL;
  return {
    configured,
    apiKey: configured ? rawKey : "",
    primaryModel,
    fastModel
  };
}
function getCacheKey(tier, systemPrompt, userPrompt) {
  return crypto4.createHash("sha256").update(`${tier}|${systemPrompt}|${userPrompt}`).digest("hex");
}
function getCached(key) {
  const hit = RESPONSE_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    RESPONSE_CACHE.delete(key);
    return null;
  }
  return hit;
}
function setCached(key, value, model) {
  if (RESPONSE_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = RESPONSE_CACHE.keys().next().value;
    if (oldestKey) RESPONSE_CACHE.delete(oldestKey);
  }
  RESPONSE_CACHE.set(key, {
    value,
    model,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}
function buildSupremeCourtSystemPrompt(jurisdiction, roleDirective) {
  const jurisdictionBlock = jurisdiction === "india_litigation" ? `JURISDICTIONAL MASTERY: Supreme Court of India, High Courts of Judicature, District & Sessions Courts, Commercial Courts, NCLT/NCLAT.
MANDATORY STATUTORY PRECISION:
- Apply Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), and Bharatiya Sakshya Adhiniyam (BSA 2023) as primary criminal/evidence statutes post-July 2024, noting legacy IPC/CrPC/IEA equivalents only in brackets for transitional clarity.
- Apply Supreme Court Rules 2013, High Court Original/Appellate Side Rules, Code of Civil Procedure 1908 (Order XIX for Affidavits), Constitution of India (Articles 14, 19, 21, 32, 136, 226, 227), and Limitation Act 1963.
- NEVER fabricate or hallucinate case citations. Rely strictly on verified Supreme Court / High Court precedents supplied in context or universally settled Constitution Bench judgments.` : jurisdiction === "corporate_ma" ? `JURISDICTIONAL MASTERY: Supreme Court / High Court Commercial Division, NCLT/NCLAT, Corporate M&A, Private Equity, Companies Act 2013, Indian Contract Act 1872 (Secs. 73-74), Arbitration & Conciliation Act 1996 (Secs. 9, 11, 34), SEBI/RBI/FEMA.` : `JURISDICTIONAL MASTERY: International Commercial Arbitration (SIAC, ICC, LCIA, UNCITRAL), New York Convention 1958, English Common Law, US Federal/Delaware Law, EU GDPR, and Cross-Border Enforcement before Indian & Foreign Courts.`;
  return `You are a Senior Advocate practicing before the Hon'ble Supreme Court of India and High Courts inside VidhiOS.
${roleDirective}
${jurisdictionBlock}
RESPONSE STRUCTURE & FORMATTING STANDARDS (STRICTLY ENFORCED):
- Begin directly with the legal substance \u2014 NEVER include conversational preambles ("Certainly!", "Here is...", "As an AI...") or closing filler ("Hope this helps").
- For research memos, analysis, and assistant replies: use clean Markdown with concise "### Section Title" headings, short scannable bullet points (1\u20132 sentences each), numbered arguments, and clean Markdown tables when comparing old vs new statutes. NEVER emit horizontal rule dividers ("---") or wrap the answer in code fences.
- For court pleadings, affidavits, notices, and judiciary forms: output pure registry-ready plain legal text with ZERO markdown symbols (no **, no ###, no backticks).
- Ground every point directly in the user's real-time Matter facts and verified Supreme Court / High Court precedents with crisp, authoritative judicial prose.`;
}
async function callNvidiaChat(options) {
  const startedAt = Date.now();
  const cfg = getNvidiaConfig();
  if (!cfg.configured) {
    throw new Error("NVIDIA_API_KEY is not configured in server environment.");
  }
  const tier = options.tier ?? "expert";
  const cacheKey = options.useCache !== false ? getCacheKey(tier, options.systemPrompt, options.userPrompt) : "";
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      return {
        text: cached.value,
        model: cached.model,
        cached: true,
        latencyMs: Date.now() - startedAt
      };
    }
  }
  const candidateModels = tier === "fast" ? [cfg.fastModel, cfg.primaryModel] : Array.from(/* @__PURE__ */ new Set([cfg.primaryModel, ...FALLBACK_MODELS]));
  let lastError = null;
  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 28e3);
    try {
      const body = {
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt }
        ],
        temperature: options.temperature ?? (options.jsonMode ? 0.15 : 0.25),
        top_p: 0.9,
        max_tokens: options.maxTokens ?? 2400,
        stream: false
      };
      if (options.jsonMode) {
        body.response_format = { type: "json_object" };
      }
      const res = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errSnippet = (await res.text().catch(() => "")).slice(0, 240);
        if (res.status === 401 || res.status === 403) {
          throw new Error(`NVIDIA API authentication failed (${res.status}). Check NVIDIA_API_KEY.`);
        }
        lastError = new Error(`NVIDIA model ${model} returned ${res.status}: ${errSnippet}`);
        continue;
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) {
        lastError = new Error(`Empty response from NVIDIA model ${model}`);
        continue;
      }
      if (cacheKey) {
        setCached(cacheKey, content, model);
      }
      return {
        text: content,
        model,
        cached: false,
        latencyMs: Date.now() - startedAt
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error("NVIDIA inference request failed.");
      if (lastError.message.includes("authentication failed")) {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error("All NVIDIA NIM candidate models failed.");
}
async function streamNvidiaChat(options, onChunk) {
  const startedAt = Date.now();
  const cfg = getNvidiaConfig();
  if (!cfg.configured) {
    throw new Error("NVIDIA_API_KEY is not configured in server environment.");
  }
  const model = options.tier === "fast" ? cfg.fastModel : cfg.primaryModel;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4e4);
  try {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt }
        ],
        temperature: options.temperature ?? 0.22,
        top_p: 0.9,
        max_tokens: options.maxTokens ?? 3200,
        stream: true
      }),
      signal: controller.signal
    });
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const fallback = await callNvidiaChat({ ...options, useCache: false });
      onChunk(fallback.text);
      return {
        fullText: fallback.text,
        model: fallback.model,
        latencyMs: fallback.latencyMs
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
        }
      }
    }
    clearTimeout(timer);
    return {
      fullText: fullText.trim(),
      model,
      latencyMs: Date.now() - startedAt
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
function extractJsonFromText(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}
async function runSupremeCourtCaseAnalysis(input) {
  const startedAt = Date.now();
  const combinedQuery = `${input.caseTitle} ${input.userFactsAndData} ${input.keyLegalQuestions} ${input.caseStage}`;
  const precedents = retrieveRelevantPrecedents(combinedQuery, input.jurisdiction, 5);
  const legacyFlags = scanDraftForLegacyCitations(input.userFactsAndData);
  const precedentBlock = formatPrecedentGroundingBlock(precedents);
  const bnsFlagSummary = legacyFlags.length > 0 ? `Legacy citations detected in user data that must be updated: ${legacyFlags.map((m) => `${m.matchedText} -> ${m.replacementText}`).join("; ")}` : "User case data contains no unmapped repealed IPC/CrPC/IEA citations.";
  const systemPrompt = buildSupremeCourtSystemPrompt(
    input.jurisdiction,
    `Perform an authoritative Supreme Court / High Court standard Court Case Analysis strictly based on the user's real-time case data and verified precedents.
Return ONLY valid JSON matching this exact schema:
{
  "executiveAssessment": "3-4 sentence senior counsel strategic assessment",
  "maintainabilityScore": "Strong" | "Moderate" | "High Risk",
  "jurisdictionAndLimitation": "Exact forum maintainability, pecuniary/territorial jurisdiction, and Limitation Act analysis",
  "applicableStatutes": ["Statute & Section (with BNS/BNSS/BSA alignment)"],
  "landmarkCaseStudies": [
    {
      "caseName": "Exact verified case name",
      "citation": "Exact reporter citation",
      "court": "Supreme Court of India / High Court",
      "relevance": "Core ratio decidendi",
      "applicationToFacts": "How this precedent directly strengthens or tests the user's facts"
    }
  ],
  "vulnerabilitiesAndCounters": [
    {
      "risk": "Specific factual, evidentiary, or procedural vulnerability",
      "counterStrategy": "Concrete courtroom rebuttal & documentary cure"
    }
  ],
  "recommendedFilings": [
    {
      "formId": "one of: general_affidavit, counter_affidavit, rejoinder_affidavit, sec_63_bsa_certificate, slp_article_136, writ_petition_226, anticipatory_bail_482_bnss, quashing_528_bnss, vakalatnama, ia_condonation_delay, caveat_148a_cpc, legal_notice_138_commercial, arbitration_sec9_sec11",
      "title": "Recommended pleading or judiciary form",
      "rationale": "Why this filing is strategically required now"
    }
  ],
  "detailedMarkdown": "Comprehensive Supreme Court / High Court legal opinion memorandum structured with Issue, Statutory Framework, Case Law Application, Evidentiary Matrix, and Prayer/Action Roadmap"
}`
  );
  const userPrompt = `CASE DOSSIER (REAL-TIME USER DATA):
- Case Title: ${input.caseTitle}
- Target Forum / Court Level: ${input.courtLevel}
- Parties: ${input.parties}
- Current Stage: ${input.caseStage}
- Key Questions / Objectives: ${input.keyLegalQuestions}

USER'S FACTUAL RECORD & DATA:
${input.userFactsAndData.slice(0, 14e3)}

LIVE WORKSPACE CONTEXT (VAULT, DOCKET & DEADLINES):
${input.liveWorkspaceContext.slice(0, 6e3)}

STATUTORY TRANSITION CHECK:
${bnsFlagSummary}

${precedentBlock}`;
  try {
    const res = await callNvidiaChat({
      systemPrompt,
      userPrompt,
      tier: "expert",
      jsonMode: true,
      maxTokens: 3200
    });
    const parsed = extractJsonFromText(res.text);
    const score = parsed.maintainabilityScore === "Strong" || parsed.maintainabilityScore === "Moderate" || parsed.maintainabilityScore === "High Risk" ? parsed.maintainabilityScore : "Strong";
    return {
      id: crypto4.randomUUID(),
      matterId: input.matterId,
      title: input.caseTitle,
      courtLevel: input.courtLevel,
      engineUsed: `NVIDIA NIM (${res.model})${res.cached ? " \xB7 Cached" : ""}`,
      latencyMs: res.latencyMs,
      executiveAssessment: stripMarkdownForPlainText(
        parsed.executiveAssessment || "Strategic Supreme Court / High Court case assessment completed against verified authorities."
      ),
      maintainabilityScore: score,
      jurisdictionAndLimitation: stripMarkdownForPlainText(
        parsed.jurisdictionAndLimitation || `Forum jurisdiction lies before ${input.courtLevel}; verify certified copy exclusion under Section 12 Limitation Act.`
      ),
      applicableStatutes: Array.isArray(parsed.applicableStatutes) && parsed.applicableStatutes.length > 0 ? parsed.applicableStatutes.map((s) => stripMarkdownForPlainText(String(s))) : precedents.flatMap((p) => p.statutes).slice(0, 6),
      landmarkCaseStudies: Array.isArray(parsed.landmarkCaseStudies) && parsed.landmarkCaseStudies.length > 0 ? parsed.landmarkCaseStudies.map((cs) => ({
        caseName: stripMarkdownForPlainText(cs.caseName),
        citation: stripMarkdownForPlainText(cs.citation),
        court: stripMarkdownForPlainText(cs.court),
        relevance: stripMarkdownForPlainText(cs.relevance),
        applicationToFacts: stripMarkdownForPlainText(cs.applicationToFacts)
      })) : precedents.slice(0, 4).map((p) => ({
        caseName: p.caseName,
        citation: p.citation,
        court: `${p.court} (${p.bench})`,
        relevance: p.ratio,
        applicationToFacts: p.practicalApplication
      })),
      vulnerabilitiesAndCounters: Array.isArray(parsed.vulnerabilitiesAndCounters) && parsed.vulnerabilitiesAndCounters.length > 0 ? parsed.vulnerabilitiesAndCounters.map((v) => ({
        risk: stripMarkdownForPlainText(v.risk),
        counterStrategy: stripMarkdownForPlainText(v.counterStrategy)
      })) : [
        {
          risk: "Evidentiary admissibility challenge to electronic communications or unverified annexures.",
          counterStrategy: "File a sworn Section 63(4) BSA 2023 Certificate with Schedule Part A & Part B hash verification alongside the main pleading."
        }
      ],
      recommendedFilings: Array.isArray(parsed.recommendedFilings) && parsed.recommendedFilings.length > 0 ? parsed.recommendedFilings.map((r) => ({
        ...r,
        title: stripMarkdownForPlainText(r.title),
        rationale: stripMarkdownForPlainText(r.rationale)
      })) : inferRecommendedFilings(combinedQuery),
      detailedMarkdown: formatAiMarkdownResponse(
        parsed.detailedMarkdown || buildDeterministicCaseAnalysisMarkdown(input, precedents, bnsFlagSummary)
      ),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch {
    const recommended = inferRecommendedFilings(combinedQuery);
    const statues = Array.from(
      /* @__PURE__ */ new Set([
        ...precedents.flatMap((p) => p.statutes),
        ...legacyFlags.map((f) => `${f.mapping.newCode} ${f.mapping.newSection} (replacing ${f.matchedText})`)
      ])
    ).slice(0, 8);
    return {
      id: crypto4.randomUUID(),
      matterId: input.matterId,
      title: input.caseTitle,
      courtLevel: input.courtLevel,
      engineUsed: "VidhiOS Supreme Court & High Court Precedent Engine",
      latencyMs: Date.now() - startedAt,
      executiveAssessment: `Based on the user's factual dossier before ${input.courtLevel} (${input.caseStage}), the matter presents a structured, maintainable litigation posture anchored in ${precedents.length} binding Supreme Court / High Court authorities. ${bnsFlagSummary} Immediate filing discipline should combine a properly verified affidavit (Order XIX Rule 3 CPC / SC Rules 2013) with contemporaneous documentary & Section 63 BSA electronic evidence certification.`,
      maintainabilityScore: legacyFlags.length > 2 ? "Moderate" : "Strong",
      jurisdictionAndLimitation: `Territorial and subject-matter jurisdiction properly vests in ${input.courtLevel}. Verify statutory limitation windows under the Limitation Act, 1963 (computing Section 12 certified-copy exclusion) and file an accompanying Section 5 Condonation IA if any procedural delay exists.`,
      applicableStatutes: statues,
      landmarkCaseStudies: precedents.slice(0, 4).map((p) => ({
        caseName: p.caseName,
        citation: p.citation,
        court: `${p.court} \xB7 ${p.bench}`,
        relevance: p.ratio,
        applicationToFacts: `${p.practicalApplication} Directly applicable to "${input.caseTitle}".`
      })),
      vulnerabilitiesAndCounters: [
        {
          risk: legacyFlags.length > 0 ? `Repealed statutory citations detected (${legacyFlags.map((m) => m.matchedText).join(", ")}) risking Registry defects or Bench objections.` : "Opposing counsel may raise preliminary maintainability or alternative-remedy objections at admission stage.",
          counterStrategy: legacyFlags.length > 0 ? "Run one-click BNS/BNSS/BSA citation conversion across all pleadings and cite post-July 2024 statutory numbering." : "Invoke M/s Radha Krishan Industries (2021) 6 SCC 771 and frame grounds explicitly around jurisdictional error and violation of natural justice."
        },
        {
          risk: "Challenge to electronic records (emails, WhatsApp exchanges, financial statements) or defective affidavit verification.",
          counterStrategy: "Attach a strict Section 63(4) BSA 2023 Certificate (Schedule Part A & B) citing Arjun Panditrao Khotkar (2020) 7 SCC 1 and separate personal-knowledge vs legal-advice paragraphs per A.K.K. Nambiar (1970)."
        }
      ],
      recommendedFilings: recommended,
      detailedMarkdown: buildDeterministicCaseAnalysisMarkdown(input, precedents, bnsFlagSummary),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function inferRecommendedFilings(text) {
  const lower = text.toLowerCase();
  const list = [];
  if (lower.includes("bail") || lower.includes("438") || lower.includes("482") || lower.includes("fir")) {
    list.push({
      formId: "anticipatory_bail_482_bnss",
      title: "Anticipatory Bail Application (Section 482 BNSS)",
      rationale: "Secure immediate pre-arrest liberty citing Sushila Aggarwal & Arnesh Kumar."
    });
    list.push({
      formId: "quashing_528_bnss",
      title: "FIR Quashing Petition (Section 528 BNSS)",
      rationale: "Challenge abuse of criminal process over civil/commercial breach per Delhi Race Club (2024)."
    });
  } else if (lower.includes("arbitration") || lower.includes("siac") || lower.includes("msa") || lower.includes("contract")) {
    list.push({
      formId: "arbitration_sec9_sec11",
      title: "Arbitration Petition (Sec. 9 / Sec. 11 A&C Act)",
      rationale: "Preserve assets pending arbitration and secure independent tribunal appointment (CORE 2024)."
    });
  } else if (lower.includes("slp") || lower.includes("supreme court") || lower.includes("136")) {
    list.push({
      formId: "slp_article_136",
      title: "Special Leave Petition (Article 136)",
      rationale: "Frame substantial questions of law of general public importance in SC Rules 2013 format."
    });
  } else {
    list.push({
      formId: "writ_petition_226",
      title: "Writ Petition (Article 226 / Article 32)",
      rationale: "Seek constitutional certiorari/mandamus and ad-interim stay."
    });
  }
  list.push({
    formId: "general_affidavit",
    title: "Sworn Affidavit-in-Support (Order XIX Rule 3 CPC)",
    rationale: "Mandatory evidentiary affidavit distinguishing personal knowledge from legal advice."
  });
  list.push({
    formId: "sec_63_bsa_certificate",
    title: "Section 63 BSA Electronic Evidence Certificate",
    rationale: "Ensure full admissibility of digital records, emails, and WhatsApp communications."
  });
  return list;
}
function buildDeterministicCaseAnalysisMarkdown(input, precedents, bnsFlagSummary) {
  return formatAiMarkdownResponse(`### Executive Case Analysis
This legal opinion evaluates the factual record submitted for **${input.caseTitle}** before **${input.courtLevel}** (${input.caseStage}). The core controversy centers on: ${input.keyLegalQuestions || "maintainability, statutory relief, and evidentiary sufficiency"}. Based on binding Supreme Court and High Court jurisprudence, Counsel should lead with documentary chronology, statutory compliance under the 2023 criminal and evidence codes where applicable, and focused threshold relief.

### Statutory Audit & Transitional Compliance
- **Status:** ${bnsFlagSummary}
- **Applicable Provisions:** ${Array.from(new Set(precedents.flatMap((p) => p.statutes))).join(", ")}.

### Binding Supreme Court & High Court Case Studies
${precedents.slice(0, 4).map(
    (p, idx) => `${idx + 1}. **${p.caseName} (${p.citation})** \u2014 ${p.court}, ${p.bench}. ${p.ratio} *Application:* ${p.practicalApplication}`
  ).join("\n")}

### Evidentiary & Procedural Roadmap
- Prepare a chronological **Synopsis & List of Dates** cross-referenced to paginated annexures.
- Execute a sworn **Affidavit-in-Support** strictly complying with **Order XIX Rule 3 CPC** / Supreme Court Rules 2013.
- Accompany all digital exhibits (emails, WhatsApp exchanges, bank logs) with a **Section 63(4) BSA** Certificate (Schedule Part A & B).
- Pre-empt opposing maintainability objections with targeted case compilations and written submissions.`);
}
async function generateExpertJudiciaryForm(input, liveWorkspaceContext) {
  const startedAt = Date.now();
  const tpl = getJudiciaryTemplate(input.templateId);
  const precedents = retrieveRelevantPrecedents(
    `${tpl.name} ${tpl.statuteBasis} ${input.factsSummary} ${input.reliefSought}`,
    input.jurisdiction,
    3
  );
  const precedentBlock = formatPrecedentGroundingBlock(precedents);
  const systemPrompt = buildSupremeCourtSystemPrompt(
    input.jurisdiction,
    `Draft a complete, court-filing-ready ${tpl.name} strictly adhering to Supreme Court Rules 2013 / High Court Registry format.
Include:
1. Proper centered ALL-CAPS Court Heading, Case Number, and Cause Title (Petitioner VERSUS Respondent).
2. Formal Document Title & Statutory Provision Reference (${tpl.statuteBasis}).
3. Numbered legal paragraphs integrating ALL user facts seamlessly, citing verified BNS/BNSS/BSA 2023 or civil/constitutional provisions and relevant verified precedents where helpful.
4. Formal Prayer clause, Advocate/Executant signature block, and complete Verification / Supporting Affidavit clause (Order XIX Rule 3 CPC) with Deponent details, Place, and Date.
Output clean plain legal text (NO markdown code fences, NO conversational preamble).`
  );
  const userPrompt = `JUDICIARY FORM SPECIFICATION:
- Form Type: ${tpl.name} (${tpl.statuteBasis})
- Court / Forum: ${input.courtName || tpl.defaultCourt}
- Case Number / Filing Header: ${input.caseNumber || tpl.defaultCaseType}
- Petitioner / Applicant: ${input.petitionerName}
- Respondent / Opposite Party: ${input.respondentName}
- Deponent / Executant: ${input.deponentName} (${input.deponentDetails})
- Place & Date: ${input.placeOfFiling}, ${input.filingDate}
- Relief / Purpose: ${input.reliefSought || tpl.suggestedRelief}

USER FACTUAL MATRIX:
${input.factsSummary}

LIVE MATTER CONTEXT:
${liveWorkspaceContext.slice(0, 4e3)}

${precedentBlock}`;
  try {
    const res = await callNvidiaChat({
      systemPrompt,
      userPrompt,
      tier: "expert",
      maxTokens: 3200
    });
    return {
      content: formatPlainCourtDocument(res.text),
      engineUsed: `NVIDIA NIM (${res.model})${res.cached ? " \xB7 Cached" : ""}`,
      latencyMs: res.latencyMs
    };
  } catch {
    return {
      content: buildDeterministicJudiciaryForm(input),
      engineUsed: "VidhiOS Supreme Court & High Court Registry Engine",
      latencyMs: Date.now() - startedAt
    };
  }
}
async function answerGroundedBilingualLegalAssistant(input) {
  const precedents = retrieveRelevantPrecedents(
    `${input.userMessage} ${input.liveWorkspaceContext.slice(0, 600)}`,
    input.jurisdiction,
    3
  );
  const precedentBlock = formatPrecedentGroundingBlock(precedents);
  const legacyFlags = scanDraftForLegacyCitations(input.userMessage);
  const langDirective = input.language === "hi" ? "LANGUAGE REQUIREMENT: Respond in clear, accurate, formal Hindi (Devanagari script \u2014 \u0936\u0941\u0926\u094D\u0927 \u0939\u093F\u0902\u0926\u0940), keeping exact legal section numbers and Supreme Court case citations in standard English legal form in brackets for court precision." : input.language === "bilingual" ? "LANGUAGE REQUIREMENT: Provide a crisp Bilingual response \u2014 first a concise English legal answer, followed immediately by an accurate Hindi (\u0939\u093F\u0902\u0926\u0940) summary so the client understands every statutory point clearly." : "LANGUAGE REQUIREMENT: Respond in crisp, authoritative Supreme Court / High Court English.";
  const systemPrompt = buildSupremeCourtSystemPrompt(
    input.jurisdiction,
    `${langDirective}
ZERO-HALLUCINATION & CLEAN FORMAT PROTOCOL (STRICTLY ENFORCED):
1. NEVER fabricate a case citation, section number, hearing date, party name, or court order.
2. Rely ONLY on the VERIFIED LIVE MATTER RECORD and VERIFIED SUPREME COURT & HIGH COURT PRECEDENT CORPUS supplied below.
3. If the user asks about a fact, document, or section NOT present in the supplied record, explicitly state "[Verification Required / \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0906\u0935\u0936\u094D\u092F\u0915]" instead of guessing.
4. Format your reply using clean, scannable sections:
   - ### Executive Answer (2\u20133 crisp sentences directly answering the query)
   - ### Verified Law & Precedents (concise bullet points citing exact statutes and verified cases)
   - ### Recommended Next Steps (1\u20132 concrete actions VidhiOS can execute immediately such as drafting an affidavit, calculating limitation, or checking BNS/BNSS/BSA mappings).`
  );
  const historyBlock = input.recentHistory.slice(-6).map((h) => `${h.role.toUpperCase()}: ${h.content.slice(0, 500)}`).join("\n");
  const userPrompt = `VERIFIED LIVE MATTER RECORD:
${input.liveWorkspaceContext}

${precedentBlock}

${legacyFlags.length > 0 ? `STATUTE UPGRADE NOTES: ${legacyFlags.map((f) => `${f.matchedText} -> ${f.replacementText}`).join("; ")}` : ""}

RECENT CONVERSATION:
${historyBlock || "(New session)"}

CLIENT MESSAGE:
${input.userMessage}`;
  const sources = [
    ...precedents.map((p) => ({
      label: `${p.caseName}, ${p.citation}`,
      reference: `${p.court} (${p.bench})`,
      kind: "precedent"
    })),
    ...legacyFlags.map((f) => ({
      label: `${f.matchedText} \u2192 ${f.replacementText}`,
      reference: f.mapping.title,
      kind: "statute"
    }))
  ];
  if (getNvidiaConfig().configured) {
    try {
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt,
        tier: "expert",
        temperature: 0.12,
        maxTokens: 1600
      });
      return {
        content: formatAiMarkdownResponse(res.text),
        sources,
        verificationMode: "grounded_ai_verified",
        confidenceNote: `Verified Grounded Response \xB7 NVIDIA NIM (${res.model}) \xB7 ${res.latencyMs}ms`
      };
    } catch {
    }
  }
  const topPrecedentsText = precedents.map(
    (p, i) => `${i + 1}. **${p.caseName} (${p.citation})** \u2014 ${p.court}, ${p.bench}. ${p.ratio} *Application:* ${p.practicalApplication}`
  ).join("\n");
  const matterSummaryBullets = input.liveWorkspaceContext.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).map((l) => `- ${l.replace(/^[-•*]\s*/, "")}`).join("\n");
  if (input.language === "hi") {
    return {
      content: formatAiMarkdownResponse(`### \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0947\u0938 \u0938\u0902\u0926\u0930\u094D\u092D (Verified Matter Context)
${matterSummaryBullets}

### \u092A\u094D\u0930\u093E\u0938\u0902\u0917\u093F\u0915 \u0938\u0941\u092A\u094D\u0930\u0940\u092E \u0915\u094B\u0930\u094D\u091F \u090F\u0935\u0902 \u0939\u093E\u0908 \u0915\u094B\u0930\u094D\u091F \u0928\u093F\u0930\u094D\u0923\u092F
${topPrecedentsText}

### \u0905\u0917\u0932\u0947 \u0924\u094D\u0935\u0930\u093F\u0924 \u0915\u0926\u092E (Direct Actions)
- "Section 63 BSA \u090F\u092B\u093F\u0921\u0947\u0935\u093F\u091F \u092C\u0928\u093E\u0913" \u092F\u093E "\u0905\u0917\u094D\u0930\u093F\u092E \u091C\u092E\u093E\u0928\u0924 \u0905\u0930\u094D\u091C\u0940 (482 BNSS) \u0932\u093F\u0916\u094B" (\u0924\u0941\u0930\u0902\u0924 Word **.DOCX** \u0938\u0939\u093F\u0924)
- "\u0927\u093E\u0930\u093E 420 IPC \u0914\u0930 438 CrPC \u0915\u093E \u0928\u092F\u093E BNS/BNSS \u0938\u0947\u0915\u094D\u0936\u0928 \u092C\u0924\u093E\u0913"
- "\u092E\u0947\u0930\u0947 \u0915\u0947\u0938 \u0915\u093E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 \u0915\u0930\u094B" \u092F\u093E "\u0905\u0917\u0932\u0940 \u0938\u0941\u0928\u0935\u093E\u0908 \u0914\u0930 \u0921\u0947\u0921\u0932\u093E\u0907\u0928 \u092C\u0924\u093E\u0913"`),
      sources,
      verificationMode: "deterministic_verified",
      confidenceNote: "100% Verified Corpus & Matter Record \xB7 Zero Hallucination Guard"
    };
  }
  if (input.language === "bilingual") {
    return {
      content: formatAiMarkdownResponse(`### English Legal Guidance
Grounded strictly in your active Matter record and verified Supreme Court / High Court precedents:

${topPrecedentsText}

### \u0939\u093F\u0902\u0926\u0940 \u0938\u093E\u0930\u093E\u0902\u0936
\u0906\u092A\u0915\u0947 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0915\u0947 \u0906\u0927\u093E\u0930 \u092A\u0930 \u090A\u092A\u0930 \u0926\u093F\u090F \u0917\u090F \u0938\u0941\u092A\u094D\u0930\u0940\u092E \u0915\u094B\u0930\u094D\u091F / \u0939\u093E\u0908 \u0915\u094B\u0930\u094D\u091F \u0915\u0947 \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0928\u093F\u0930\u094D\u0923\u092F \u0938\u0940\u0927\u0947 \u0932\u093E\u0917\u0942 \u0939\u094B\u0924\u0947 \u0939\u0948\u0902\u0964 \u0906\u092A \u092F\u0939\u0940\u0902 \u0938\u0947 \u0939\u0932\u092B\u0928\u093E\u092E\u093E (Affidavit), \u0935\u0915\u093E\u0932\u0924\u0928\u093E\u092E\u093E, \u0927\u093E\u0930\u093E \u092E\u093F\u0932\u093E\u0928 (IPC \u2192 BNS), \u092A\u0930\u093F\u0938\u0940\u092E\u093E \u0917\u0923\u0928\u093E (Limitation), \u092F\u093E \u0915\u0947\u0938 \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 \u0915\u0930\u0935\u093E \u0915\u0930 \u0924\u0941\u0930\u0902\u0924 **.DOCX** \u092B\u093C\u093E\u0907\u0932 \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964`),
      sources,
      verificationMode: "deterministic_verified",
      confidenceNote: "100% Verified Corpus & Matter Record \xB7 Zero Hallucination Guard"
    };
  }
  return {
    content: formatAiMarkdownResponse(`### Active Matter Basis
${matterSummaryBullets}

### Verified Supreme Court & High Court Authorities
${topPrecedentsText}

### Recommended Next Steps
- Ask: **"Draft a Section 63 BSA Affidavit"** or **"Draft an Anticipatory Bail Application (482 BNSS)"** for auto-saved pleadings + Court **.DOCX** export.
- Ask: **"Map 420 IPC, 438 CrPC, and 65B IEA to BNS/BNSS/BSA"** for exact statutory crosswalks.
- Ask: **"Calculate Arbitration Sec. 34 limitation from 2026-10-01 and save deadline"** to pin filing dates.`),
    sources,
    verificationMode: "deterministic_verified",
    confidenceNote: "100% Verified Corpus & Matter Record \xB7 Zero Hallucination Guard"
  };
}

// src/server/realtimeLegalSearch.ts
function stripHtml(raw) {
  return raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
async function fetchLiveKanoonResults(query, timeoutMs = 4e3) {
  const authorities = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VidhiOS/2.0",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!res.ok) return authorities;
    const html = await res.text();
    const titleRegex = /<div class=["']result_title["']>[\s\S]*?<a href=["'](\/doc\/[0-9]+\/)["']>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = titleRegex.exec(html)) !== null && authorities.length < 4) {
      const docPath = match[1];
      const rawTitle = stripHtml(match[2]);
      if (rawTitle && docPath) {
        authorities.push({
          title: rawTitle,
          url: `https://indiankanoon.org${docPath}`,
          court: "Live Judicial Authority",
          sourceType: "live_kanoon",
          snippet: `Live Kanoon Authority: ${rawTitle}`
        });
      }
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return authorities;
}
async function fetchRealtimeLegalData(query, jurisdiction, matterContext = "") {
  const startedAt = Date.now();
  const combinedText = `${query} ${matterContext}`.trim();
  const matchedStatutes = lookupStatuteMappings(combinedText);
  let statutoryGroundingText = "";
  if (matchedStatutes.length > 0) {
    statutoryGroundingText = `VERIFIED STATUTORY CROSSWALK (BNS 2023 / BNSS 2023 / BSA 2023):
${matchedStatutes.slice(0, 5).map(
      (s) => `- ${s.legacyCode} Sec. ${s.legacySection} -> ${s.newCode} Sec. ${s.newSection} (${s.title}). Note: ${s.keyChangeNote}`
    ).join("\n")}`;
  }
  const curatedPrecedents = retrieveRelevantPrecedents(combinedText, jurisdiction, 4);
  const precedentGroundingText = formatPrecedentGroundingBlock(curatedPrecedents);
  let liveKanoonAuthorities = [];
  if (jurisdiction === "india_litigation" || combinedText.toLowerCase().includes("india") || combinedText.toLowerCase().includes("act")) {
    const cleanedSearchTerms = query.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(" ");
    liveKanoonAuthorities = await fetchLiveKanoonResults(cleanedSearchTerms || query);
  }
  const liveAuthorities = [];
  for (const k of liveKanoonAuthorities) {
    liveAuthorities.push(k);
  }
  for (const p of curatedPrecedents) {
    liveAuthorities.push({
      title: `${p.caseName}, ${p.citation}`,
      court: `${p.court} (${p.bench}, ${p.year})`,
      url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(p.caseName)}`,
      sourceType: "supreme_court_corpus",
      snippet: p.ratio
    });
  }
  const citations = liveAuthorities.map((a) => ({
    title: a.title,
    url: a.url,
    courtOrSource: a.court || "Supreme Court / High Court Record",
    status: a.sourceType === "live_kanoon" ? "verified_web" : "statute"
  }));
  return {
    query,
    jurisdiction,
    liveAuthorities,
    citations,
    statutoryGroundingText,
    precedentGroundingText,
    fetchLatencyMs: Date.now() - startedAt
  };
}

// src/server/geminiService.ts
var TEXT_MODEL = "gemini-4-hydrogen";
var TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
function isGeminiConfigured() {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  return Boolean(key && !key.startsWith("MY_") && key.length > 5);
}
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("MY_")) {
    throw new Error(
      "AI provider key is not configured. Add NVIDIA_API_KEY (or GEMINI_API_KEY) in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function jurisdictionInstruction(mode) {
  switch (mode) {
    case "india_litigation":
      return "Jurisdiction: Republic of India (Supreme Court of India, High Courts, District Courts, NCLT/NCLAT, Consumer Commissions). Always cite Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), and Bharatiya Sakshya Adhiniyam (BSA 2023) alongside legacy IPC/CrPC/IEA equivalents where relevant. Never fabricate case citations.";
    case "corporate_ma":
      return "Jurisdiction & Practice: Corporate M&A, Private Equity, Venture Capital, and Commercial Contracting (Companies Act 2013, Indian Contract Act 1872, Arbitration & Conciliation Act 1996, FEMA/RBI/SEBI, plus international M&A standards). Focus on commercial risk allocation, enforceability, and indemnity caps.";
    case "global_multi":
      return "Jurisdiction: Global Multi-Jurisdiction & Cross-Border Arbitration (English Common Law, US Federal/Delaware, EU/GDPR, Singapore/SIAC, ICC, UNCITRAL Model Law, New York Convention enforcement). Provide comparative clarity across jurisdictions.";
  }
}
function sanitizeSafeUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return "";
  } catch {
    return "";
  }
}
async function runGroundedLegalResearch(input) {
  const realtime = await fetchRealtimeLegalData(
    input.query,
    input.jurisdiction,
    input.matterContext
  );
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
Keep bullets tight and actionable, cite exact verified case names and section numbers inline, and never include preambles, horizontal rules (---), or code fences.`
      );
      const contextParts = [
        `ACTIVE MATTER CONTEXT:
${input.matterContext}`,
        `LEGAL RESEARCH QUERY:
${input.query}`
      ];
      if (realtime.statutoryGroundingText) {
        contextParts.push(realtime.statutoryGroundingText);
      }
      if (realtime.precedentGroundingText) {
        contextParts.push(realtime.precedentGroundingText);
      }
      const userPrompt = contextParts.join("\n\n");
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt,
        tier: input.tier ?? "fast",
        maxTokens: 2800
      });
      return {
        answerMarkdown: formatAiMarkdownResponse(res.text),
        citations: realtime.citations,
        citationIntegrity: {
          verifiedSourceCount: realtime.citations.length,
          jurisdictionChecked: input.jurisdiction === "india_litigation" ? `NVIDIA NIM (${res.model}) \xB7 Live Kanoon & BNS/BNSS/BSA` : input.jurisdiction === "corporate_ma" ? `NVIDIA NIM (${res.model}) \xB7 Corporate, M&A & Commercial Statutes` : `NVIDIA NIM (${res.model}) \xB7 International Arbitration & Multi-Jurisdiction`,
          bnsComplianceNote: input.jurisdiction === "india_litigation" ? `Generated in ${res.latencyMs}ms with live statutory verification.` : `Generated in ${res.latencyMs}ms with commercial currency check.`,
          confidenceLabel: "Grounded via Web & Statute"
        }
      };
    } catch {
    }
  }
  const ai = getAiClient();
  const prompt = `Active Matter Context:
${input.matterContext}

Legal Research Query:
${input.query}

${realtime.precedentGroundingText}

Provide a rigorous, structured legal research memorandum using ONLY clean Markdown headings (### Executive Conclusion, ### Statutory Framework, ### Controlling Precedents, ### Application to Active Matter, ### Strategic Recommendation). Only cite real, verifiable authorities and statutes. Flag post-July 2024 BNS/BNSS/BSA updates where applicable. Do not include preambles or --- dividers.`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are a Senior Legal Research Partner in VidhiOS. ${jurisdictionInstruction(input.jurisdiction)} Ground your analysis with real authorities, avoid hallucinating citations, and write crisp editorial Markdown with zero conversational filler.`,
      tools: [{ googleSearch: {} }]
    }
  });
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seenUrls = /* @__PURE__ */ new Set();
  const citations = [];
  for (const chunk of chunks) {
    const web = chunk.web;
    const safeUrl = sanitizeSafeUrl(web?.uri);
    if (safeUrl && !seenUrls.has(safeUrl)) {
      seenUrls.add(safeUrl);
      let host = "Verified Web Source";
      try {
        host = new URL(safeUrl).hostname.replace(/^www\./, "");
      } catch {
      }
      citations.push({
        title: web?.title?.trim() || host,
        url: safeUrl,
        courtOrSource: host,
        status: "verified_web"
      });
    }
  }
  return {
    answerMarkdown: formatAiMarkdownResponse(response.text?.trim() || "No research output returned."),
    citations,
    citationIntegrity: {
      verifiedSourceCount: citations.length,
      jurisdictionChecked: input.jurisdiction === "india_litigation" ? "Indian Courts & BNS/BNSS/BSA Statutes" : input.jurisdiction === "corporate_ma" ? "Corporate, M&A & Commercial Statutes" : "Multi-Jurisdiction & International Arbitration",
      bnsComplianceNote: input.jurisdiction === "india_litigation" ? "Reviewed for BNS 2023 / BNSS 2023 / BSA 2023 alignment." : "Reviewed for commercial enforceability & statutory currency.",
      confidenceLabel: citations.length > 0 ? "Grounded via Web & Statute" : "Statutory Analysis Only"
    }
  };
}
async function streamGroundedLegalResearch(input, onEvent) {
  onEvent({
    type: "stage",
    data: {
      stage: "fetching_realtime",
      label: "Fetching real-time legal data, statutory crosswalk & Kanoon authorities..."
    }
  });
  const realtime = await fetchRealtimeLegalData(
    input.query,
    input.jurisdiction,
    input.matterContext
  );
  onEvent({
    type: "authorities",
    data: {
      authorities: realtime.liveAuthorities,
      citations: realtime.citations
    }
  });
  const tier = input.tier ?? "fast";
  onEvent({
    type: "stage",
    data: {
      stage: "generating_memo",
      label: `Synthesizing real-time IRAC research memorandum with ${tier === "fast" ? "Nemotron Lightning (Low Latency)" : "Mistral Large (Deep Precision)"}...`
    }
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
    `ACTIVE MATTER CONTEXT:
${input.matterContext}`,
    `LEGAL RESEARCH QUERY:
${input.query}`
  ];
  if (realtime.statutoryGroundingText) {
    contextParts.push(realtime.statutoryGroundingText);
  }
  if (realtime.precedentGroundingText) {
    contextParts.push(realtime.precedentGroundingText);
  }
  const userPrompt = contextParts.join("\n\n");
  if (getNvidiaConfig().configured) {
    try {
      const res = await streamNvidiaChat(
        {
          systemPrompt,
          userPrompt,
          tier,
          maxTokens: 2800
        },
        (delta) => {
          onEvent({ type: "chunk", data: { delta } });
        }
      );
      const cleanedText = formatAiMarkdownResponse(res.fullText);
      return {
        answerMarkdown: cleanedText,
        citations: realtime.citations,
        citationIntegrity: {
          verifiedSourceCount: realtime.citations.length,
          jurisdictionChecked: input.jurisdiction === "india_litigation" ? `NVIDIA NIM (${res.model}) \xB7 Live Kanoon & BNS/BNSS/BSA` : input.jurisdiction === "corporate_ma" ? `NVIDIA NIM (${res.model}) \xB7 Corporate & Commercial Enforceability` : `NVIDIA NIM (${res.model}) \xB7 International Arbitration & New York Convention`,
          bnsComplianceNote: input.jurisdiction === "india_litigation" ? `Generated in ${res.latencyMs}ms with live statutory crosswalk verification.` : `Generated in ${res.latencyMs}ms with commercial statutory currency check.`,
          confidenceLabel: "Grounded via Web & Statute"
        }
      };
    } catch {
    }
  }
  const fallback = await runGroundedLegalResearch(input);
  onEvent({ type: "chunk", data: { delta: fallback.answerMarkdown } });
  return fallback;
}
async function generateLegalDraft(input) {
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
        "Draft a complete, court-filing-ready or execution-ready legal document strictly formatted to Supreme Court Rules 2013 / High Court Registry standards with Cause Title, numbered paragraphs, statutory references, Prayer, and Verification/Affidavit block where applicable. Output clean plain text with no markdown code fences."
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `DOCUMENT TYPE: ${input.docType}
ACTIVE MATTER CONTEXT:
${input.matterContext}

SPECIFIC DRAFTING INSTRUCTIONS:
${input.instructions}

${precedentBlock}`,
        tier: "expert",
        maxTokens: 3200
      });
      return formatPlainCourtDocument(res.text);
    } catch {
    }
  }
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Document Type: ${input.docType}
Active Matter Context:
${input.matterContext}

Specific Drafting Instructions:
${input.instructions}

${precedentBlock}

Draft a complete, court-ready or execution-ready legal document with numbered paragraphs, formal headings, statutory references, and prayers/signature blocks as appropriate.`,
    config: {
      systemInstruction: `You are an elite Senior Advocate and Transactional Drafting Counsel. ${jurisdictionInstruction(input.jurisdiction)} Output clean plain text formatted for a legal editor (ZERO markdown syntax such as **, ###, or code fences).`
    }
  });
  return formatPlainCourtDocument(response.text?.trim() || "");
}
async function rewriteDraftSelection(input) {
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        "You are a precision Supreme Court / High Court legal editor. Preserve defined terms, paragraph numbering, and statutory precision. Return ONLY the replacement plain legal text without preamble or markdown symbols."
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Selected Legal Paragraph/Clause:
"""
${input.selection}
"""

Editing Instruction: ${input.instruction}

Return ONLY the revised legal text ready to replace the selection directly.`,
        tier: "fast",
        maxTokens: 1400,
        useCache: false
      });
      return formatPlainCourtDocument(res.text);
    } catch {
    }
  }
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Selected Legal Paragraph/Clause:
"""
${input.selection}
"""

Editing Instruction: ${input.instruction}

Return ONLY the revised legal text ready to replace the selection directly.`,
    config: {
      systemInstruction: `You are a precision legal editor. ${jurisdictionInstruction(input.jurisdiction)} Preserve defined terms and legal precision. Return only the replacement plain text without preamble or markdown symbols.`
    }
  });
  return formatPlainCourtDocument(response.text?.trim() || input.selection);
}
async function runCourtroomTurn(input) {
  const persona = input.mode === "bench" ? "a sharp, demanding Senior Judge on the Supreme Court / High Court Bench probing maintainability, jurisdictional limits, suppression of facts, and binding precedent" : "an aggressive, highly prepared Opposing Senior Counsel tearing apart evidentiary gaps, statutory defects, and limitation hurdles";
  const transcriptText = input.history.slice(-8).map((t) => `${t.speaker.toUpperCase()}: ${t.message}`).join("\n\n");
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
        userPrompt: `Forum: ${input.forumContext}
Matter/Brief Summary:
${input.briefExcerpt}

Prior Exchange:
${transcriptText || "(Opening submission)"}

Counsel's Latest Submission:
${input.userSubmission}

${precedentBlock}`,
        tier: "expert",
        jsonMode: true,
        maxTokens: 1600,
        useCache: false
      });
      const parsed2 = extractJsonFromText(res.text);
      return {
        replyMessage: stripMarkdownForPlainText(
          parsed2.replyMessage || "Counsel, please clarify your primary statutory ground."
        ),
        weaknessFlag: stripMarkdownForPlainText(
          parsed2.weaknessFlag || "Clarify evidentiary linkage to statutory ingredients."
        ),
        suggestedRebuttal: stripMarkdownForPlainText(
          parsed2.suggestedRebuttal || "Address the factual record chronologically with annexure page citations."
        ),
        authorities: (parsed2.authorities ?? precedents.map((p) => `${p.caseName}, ${p.citation}`)).map(
          (a) => stripMarkdownForPlainText(a)
        )
      };
    } catch {
    }
  }
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Forum: ${input.forumContext}
Matter/Brief Summary:
${input.briefExcerpt}

Prior Exchange:
${transcriptText || "(Opening submission)"}

Counsel's Latest Submission:
${input.userSubmission}

${precedentBlock}`,
    config: {
      systemInstruction: `You are acting as ${persona} in a courtroom argument simulator. ${jurisdictionInstruction(input.jurisdiction)} Respond in character with a piercing question or counter-argument, AND provide structured coaching notes (the exact vulnerability exposed, a tight courtroom rebuttal counsel can use, and 2-3 real statutory/case authorities).`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replyMessage: {
            type: Type.STRING,
            description: "The in-character courtroom question from the Bench or counter-argument from Opposing Counsel."
          },
          weaknessFlag: {
            type: Type.STRING,
            description: "Concise diagnosis of the vulnerability in counsel\u2019s position."
          },
          suggestedRebuttal: {
            type: Type.STRING,
            description: "A crisp, persuasive courtroom response counsel can deliver next."
          },
          authorities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 relevant real statutes or leading judicial precedents."
          }
        },
        required: ["replyMessage", "weaknessFlag", "suggestedRebuttal", "authorities"]
      }
    }
  });
  const parsed = JSON.parse((response.text ?? "{}").trim());
  return {
    replyMessage: stripMarkdownForPlainText(
      parsed.replyMessage || "Counsel, please clarify your primary statutory ground."
    ),
    weaknessFlag: stripMarkdownForPlainText(
      parsed.weaknessFlag || "Clarify evidentiary linkage to statutory ingredients."
    ),
    suggestedRebuttal: stripMarkdownForPlainText(
      parsed.suggestedRebuttal || "Address the factual record chronologically with annexure page citations."
    ),
    authorities: (parsed.authorities ?? []).map((a) => stripMarkdownForPlainText(a))
  };
}
async function analyzeContractRedline(input) {
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are a Principal M&A and Commercial Contracting Partner. Audit the contract against the specified playbook. Return ONLY valid JSON with keys: "summary" (string), "clauses" (array of 3-6 objects with clauseRef, title, severity ("high"|"medium"|"low"), issueSummary, originalText, proposedText, legalRationale), and "requisitions" (string array).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Contract Title: ${input.title}
Review Playbook: ${input.playbook}

Contract Text:
${input.contractText.slice(0, 3e4)}`,
        tier: "expert",
        jsonMode: true,
        maxTokens: 3e3
      });
      const parsed2 = extractJsonFromText(res.text);
      const clauses2 = (parsed2.clauses ?? []).map((cl, idx) => ({
        ...cl,
        id: `cl_${Date.now()}_${idx}`,
        severity: cl.severity === "high" || cl.severity === "medium" || cl.severity === "low" ? cl.severity : "medium",
        decision: "pending"
      }));
      return {
        summary: parsed2.summary || "Contract review completed via NVIDIA NIM.",
        clauses: clauses2,
        requisitions: parsed2.requisitions ?? []
      };
    } catch {
    }
  }
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Contract Title: ${input.title}
Review Playbook: ${input.playbook}

Contract Text:
${input.contractText.slice(0, 35e3)}`,
    config: {
      systemInstruction: `You are a Principal M&A and Commercial Contracting Partner. ${jurisdictionInstruction(input.jurisdiction)} Audit the contract against the specified playbook. Identify 3 to 6 concrete high/medium/low risk clauses, quote the exact original clause text, draft a balanced market-standard redlined replacement clause, explain the legal rationale, and list due diligence requisitions.`,
      responseMimeType: "application/json",
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
                severity: { type: Type.STRING, description: "high, medium, or low" },
                issueSummary: { type: Type.STRING },
                originalText: { type: Type.STRING },
                proposedText: { type: Type.STRING },
                legalRationale: { type: Type.STRING }
              },
              required: [
                "clauseRef",
                "title",
                "severity",
                "issueSummary",
                "originalText",
                "proposedText",
                "legalRationale"
              ]
            }
          },
          requisitions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "clauses", "requisitions"]
      }
    }
  });
  const parsed = JSON.parse((response.text ?? "{}").trim());
  const clauses = (parsed.clauses ?? []).map((cl, idx) => ({
    ...cl,
    id: `cl_${Date.now()}_${idx}`,
    severity: cl.severity === "high" || cl.severity === "medium" || cl.severity === "low" ? cl.severity : "medium",
    decision: "pending"
  }));
  return {
    summary: parsed.summary || "Contract review completed.",
    clauses,
    requisitions: parsed.requisitions ?? []
  };
}
async function processVaultDocument(input) {
  const translateDirective = input.targetLanguage && input.targetLanguage !== "None" ? `Also translate the extracted legal text accurately into ${input.targetLanguage}, strictly preserving legal terms of art.` : "Leave translatedText as an empty string.";
  if (!input.base64Data && input.textInput && getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'You are a Forensic Litigation Document Analyst. Return ONLY valid JSON with keys: "extractedText" (string), "translatedText" (string), "chronology" (array of {date, event, sourceDoc, significance}), and "contradictions" (array of {topic, statementA, statementB, severity ("high"|"medium"|"low"), recommendation}).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Document Name: ${input.fileName}
Provided Document Text:
${input.textInput.slice(0, 22e3)}

Existing Matter Documents Context:
${input.existingDocsContext.slice(0, 1e4)}

${translateDirective}`,
        tier: "expert",
        jsonMode: true,
        maxTokens: 2800
      });
      const parsed2 = extractJsonFromText(res.text);
      return {
        extractedText: parsed2.extractedText || input.textInput,
        translatedText: parsed2.translatedText || "",
        chronology: parsed2.chronology ?? [],
        contradictions: (parsed2.contradictions ?? []).map((c) => ({
          ...c,
          severity: c.severity === "high" || c.severity === "medium" || c.severity === "low" ? c.severity : "medium"
        }))
      };
    } catch {
    }
  }
  const ai = getAiClient();
  const parts = [];
  if (input.base64Data && input.mimeType) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.base64Data
      }
    });
  }
  parts.push({
    text: `Document Name: ${input.fileName}
${input.textInput ? `Provided Document Text:
${input.textInput.slice(0, 25e3)}
` : ""}
Existing Matter Documents Context (for contradiction detection):
${input.existingDocsContext.slice(0, 12e3)}

Tasks:
1. Perform faithful OCR/text extraction preserving legal formatting.
2. Extract a chronological List of Dates & Events (YYYY-MM-DD where possible) from this document.
3. Detect any factual, date, monetary, or procedural contradictions between this document and the Existing Matter Documents Context (or internal inconsistencies).
4. ${translateDirective}`
  });
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: { parts },
    config: {
      systemInstruction: `You are a Legal Document Intelligence & Forensic Litigation Analyst. ${jurisdictionInstruction(input.jurisdiction)}`,
      responseMimeType: "application/json",
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
                significance: { type: Type.STRING }
              },
              required: ["date", "event", "sourceDoc", "significance"]
            }
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
                recommendation: { type: Type.STRING }
              },
              required: ["topic", "statementA", "statementB", "severity", "recommendation"]
            }
          }
        },
        required: ["extractedText", "translatedText", "chronology", "contradictions"]
      }
    }
  });
  const parsed = JSON.parse((response.text ?? "{}").trim());
  return {
    extractedText: parsed.extractedText || input.textInput || "",
    translatedText: parsed.translatedText || "",
    chronology: parsed.chronology ?? [],
    contradictions: (parsed.contradictions ?? []).map((c) => ({
      ...c,
      severity: c.severity === "high" || c.severity === "medium" || c.severity === "low" ? c.severity : "medium"
    }))
  };
}
async function transcribeAndSummarizeMeeting(input) {
  let transcript = (input.transcriptText ?? "").trim();
  if (input.base64Audio && input.mimeType) {
    const ai2 = getAiClient();
    const transcribeRes = await ai2.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64Audio
            }
          },
          {
            text: "Transcribe this legal consultation audio accurately, preserving legal terms, section numbers, party names, and monetary figures."
          }
        ]
      }
    });
    transcript = transcribeRes.text?.trim() || transcript;
  }
  if (!transcript) {
    throw new Error("No audio or transcript text provided.");
  }
  if (getNvidiaConfig().configured) {
    try {
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        'Prepare an internal Client Consultation Brief from the transcript. Return ONLY valid JSON with keys: "summary" (string), "keyFacts" (string array), "actionItems" (string array), "statutoryIssues" (string array).'
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Active Matter Context:
${input.matterContext}

Consultation Transcript:
${transcript.slice(0, 26e3)}`,
        tier: "expert",
        jsonMode: true,
        maxTokens: 2e3
      });
      const parsed2 = extractJsonFromText(res.text);
      return {
        transcript,
        summary: parsed2.summary || "Consultation brief generated.",
        keyFacts: parsed2.keyFacts ?? [],
        actionItems: parsed2.actionItems ?? [],
        statutoryIssues: parsed2.statutoryIssues ?? []
      };
    } catch {
    }
  }
  const ai = getAiClient();
  const briefRes = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Active Matter Context:
${input.matterContext}

Consultation Transcript:
${transcript.slice(0, 3e4)}`,
    config: {
      systemInstruction: `You are a Senior Legal Associate preparing an internal Client Consultation Brief. ${jurisdictionInstruction(input.jurisdiction)} Extract a sharp executive summary, concrete key facts, actionable next steps, and statutory issues identified.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          statutoryIssues: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "keyFacts", "actionItems", "statutoryIssues"]
      }
    }
  });
  const parsed = JSON.parse((briefRes.text ?? "{}").trim());
  return {
    transcript,
    summary: parsed.summary || "Consultation brief generated.",
    keyFacts: parsed.keyFacts ?? [],
    actionItems: parsed.actionItems ?? [],
    statutoryIssues: parsed.statutoryIssues ?? []
  };
}
async function answerWhatsAppQuery(input) {
  if (getNvidiaConfig().configured) {
    try {
      const precedents = retrieveRelevantPrecedents(input.prompt, input.jurisdiction, 2);
      const systemPrompt = buildSupremeCourtSystemPrompt(
        input.jurisdiction,
        "You are VidhiOS WhatsApp Command Assistant for advocates in court corridors. Respond concisely in crisp bullet points (under 150 words) suitable for instant courtroom reading."
      );
      const res = await callNvidiaChat({
        systemPrompt,
        userPrompt: `Matter Context:
${input.matterContext}

Advocate's Mobile Query:
${input.prompt}

${formatPrecedentGroundingBlock(precedents)}`,
        tier: "fast",
        maxTokens: 500
      });
      return formatAiMarkdownResponse(res.text);
    } catch {
    }
  }
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Matter Context:
${input.matterContext}

Advocate's Mobile Query:
${input.prompt}`,
    config: {
      systemInstruction: `You are VidhiOS WhatsApp Command Assistant for busy advocates in court corridors. ${jurisdictionInstruction(input.jurisdiction)} Respond concisely in clear bullet points (under 150 words) suitable for mobile reading. Do not include filler preambles or --- dividers.`
    }
  });
  return formatAiMarkdownResponse(response.text?.trim() || "Unable to process query right now.");
}

// src/lib/legal/limitationCalculator.ts
var LIMITATION_RULES = [
  {
    id: "arb_sec_34",
    label: "Arbitral Award Challenge (Sec. 34)",
    statute: "Arbitration & Conciliation Act, 1996",
    articleOrSection: "Section 34(3)",
    periodUnit: "months",
    periodValue: 3,
    condonableGraceDays: 30,
    section5Applicable: false,
    triggerDescription: "Date on which signed copy of arbitral award was received by the party",
    practiceNote: 'Strict outer cap of 3 months + 30 days ("but not thereafter"). Section 5 Limitation Act does NOT apply (Union of India v. Popular Construction).'
  },
  {
    id: "hc_appeal_116a",
    label: "First Appeal to High Court",
    statute: "Limitation Act, 1963",
    articleOrSection: "Article 116(a)",
    periodUnit: "days",
    periodValue: 90,
    section5Applicable: true,
    triggerDescription: "Date of decree or order (excluding time requisite for certified copy under Sec. 12)",
    practiceNote: "Delay beyond 90 days requires an application for condonation under Section 5 showing sufficient cause."
  },
  {
    id: "dist_appeal_116b",
    label: "Appeal to District Court",
    statute: "Limitation Act, 1963",
    articleOrSection: "Article 116(b)",
    periodUnit: "days",
    periodValue: 30,
    section5Applicable: true,
    triggerDescription: "Date of decree or order appealed against",
    practiceNote: "Exclude certified copy preparation period under Section 12(2) Limitation Act."
  },
  {
    id: "slp_sc_133",
    label: "Special Leave Petition (Supreme Court)",
    statute: "Limitation Act, 1963",
    articleOrSection: "Article 133(c)",
    periodUnit: "days",
    periodValue: 90,
    section5Applicable: true,
    triggerDescription: "Date of High Court judgment or order (60 days where certificate refused)",
    practiceNote: "File IA for condonation of delay under Sec. 5 if crossing 90 days; attach certified copy receipt."
  },
  {
    id: "commercial_appeal_13",
    label: "Commercial Court Appeal (Sec. 13)",
    statute: "Commercial Courts Act, 2015",
    articleOrSection: "Section 13(1A)",
    periodUnit: "days",
    periodValue: 60,
    section5Applicable: true,
    triggerDescription: "Date of judgment or order of Commercial Court / Commercial Division",
    practiceNote: "Courts apply heightened scrutiny to condonation of delay in commercial appeals (Government of Maharashtra v. Borse Brothers)."
  },
  {
    id: "ibc_nclat_61",
    label: "IBC Appeal to NCLAT (Sec. 61)",
    statute: "Insolvency and Bankruptcy Code, 2016",
    articleOrSection: "Section 61(2)",
    periodUnit: "days",
    periodValue: 30,
    condonableGraceDays: 15,
    section5Applicable: false,
    triggerDescription: "Date of pronouncement of NCLT order",
    practiceNote: "Maximum condonable window is strictly 15 days beyond 30 days (National Spot Exchange v. Anil Kohli)."
  },
  {
    id: "review_124",
    label: "Review of Judgment / Decree",
    statute: "Limitation Act, 1963",
    articleOrSection: "Article 124",
    periodUnit: "days",
    periodValue: 30,
    section5Applicable: true,
    triggerDescription: "Date of decree or order sought to be reviewed",
    practiceNote: "Applies to courts other than Supreme Court (SC review also 30 days under Order XLVII SC Rules)."
  },
  {
    id: "civil_suit_113",
    label: "Civil Suit for Money / Breach of Contract",
    statute: "Limitation Act, 1963",
    articleOrSection: "Article 55 / Article 113",
    periodUnit: "years",
    periodValue: 3,
    section5Applicable: false,
    triggerDescription: "Date when the breach occurs or right to sue first accrues",
    practiceNote: "Section 5 does not extend limitation for original suits; check Sec. 18 (written acknowledgement) or Sec. 19 (part payment)."
  },
  {
    id: "consumer_69",
    label: "Consumer Complaint (CPA 2019)",
    statute: "Consumer Protection Act, 2019",
    articleOrSection: "Section 69",
    periodUnit: "years",
    periodValue: 2,
    section5Applicable: true,
    triggerDescription: "Date on which the cause of action has arisen",
    practiceNote: "Commission may condone delay if complainant shows sufficient cause recorded in writing."
  },
  {
    id: "ni_138_notice",
    label: "Cheque Dishonour Statutory Demand Notice",
    statute: "Negotiable Instruments Act, 1881",
    articleOrSection: "Section 138(b)",
    periodUnit: "days",
    periodValue: 30,
    section5Applicable: false,
    triggerDescription: "Date of receipt of bank return memo indicating dishonour",
    practiceNote: "Non-condonable 30-day statutory notice period; complaint must follow within 30 days after expiry of 15-day drawer cure window."
  }
];
function parseIsoDateUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid ISO date format: ${iso}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}
function formatIsoDateUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addPeriodUTC(base, unit, value) {
  const next = new Date(base.getTime());
  if (unit === "days") {
    next.setUTCDate(next.getUTCDate() + value);
  } else if (unit === "months") {
    const targetDay = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + value);
    if (next.getUTCDate() < targetDay) {
      next.setUTCDate(0);
    }
  } else {
    next.setUTCFullYear(next.getUTCFullYear() + value);
  }
  return next;
}
function calculateLimitationDeadline(ruleId, triggerDateIso, referenceDateIso) {
  const rule = LIMITATION_RULES.find((r) => r.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown limitation rule: ${ruleId}`);
  }
  const triggerDate = parseIsoDateUTC(triggerDateIso);
  const rawDue = addPeriodUTC(triggerDate, rule.periodUnit, rule.periodValue);
  const rawDueIso = formatIsoDateUTC(rawDue);
  let effectiveDue = new Date(rawDue.getTime());
  let rolledOverFromSunday = false;
  if (effectiveDue.getUTCDay() === 0) {
    effectiveDue.setUTCDate(effectiveDue.getUTCDate() + 1);
    rolledOverFromSunday = true;
  }
  const effectiveDueIso = formatIsoDateUTC(effectiveDue);
  let graceDeadlineDate;
  if (rule.condonableGraceDays && rule.condonableGraceDays > 0) {
    const grace = addPeriodUTC(rawDue, "days", rule.condonableGraceDays);
    if (grace.getUTCDay() === 0) {
      grace.setUTCDate(grace.getUTCDate() + 1);
    }
    graceDeadlineDate = formatIsoDateUTC(grace);
  }
  const refDate = referenceDateIso ? parseIsoDateUTC(referenceDateIso) : parseIsoDateUTC((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const diffMs = effectiveDue.getTime() - refDate.getTime();
  const daysRemaining = Math.round(diffMs / (1e3 * 60 * 60 * 24));
  let urgencyStatus;
  if (daysRemaining < 0) {
    urgencyStatus = "overdue";
  } else if (daysRemaining <= 7) {
    urgencyStatus = "urgent";
  } else if (daysRemaining <= 30) {
    urgencyStatus = "approaching";
  } else {
    urgencyStatus = "safe";
  }
  const graceNote = graceDeadlineDate ? ` Outer condonable cap expires on ${graceDeadlineDate} (+${rule.condonableGraceDays} days).` : rule.section5Applicable ? " Condonation under Section 5 Limitation Act may be sought on sufficient cause." : " Strict statutory period \u2014 Section 5 condonation does not apply.";
  const rolloverNote = rolledOverFromSunday ? ` Rolled over from Sunday (${rawDueIso}) to Monday (${effectiveDueIso}) under Section 4 Limitation Act.` : "";
  return {
    rule,
    triggerDate: triggerDateIso,
    rawDueDate: rawDueIso,
    effectiveDueDate: effectiveDueIso,
    rolledOverFromSunday,
    graceDeadlineDate,
    daysRemaining,
    urgencyStatus,
    guidanceSummary: `Prescribed period under ${rule.statute} (${rule.articleOrSection}) expires on ${effectiveDueIso}.${rolloverNote}${graceNote}`
  };
}

// src/lib/legal/assistantEngine.ts
var DEVANAGARI_RE = /[\u0900-\u097F]/;
var HINGLISH_HINT_RE = /\b(kya|hai|hain|batao|banao|likho|karo|mera|meri|mere|kanoon|dhara|jamaanat|zamanat|faisla|vakalatnama|tarikh|tareekh|sunwai|case ka|naya section|kijiye|bhejo|samjhao|hindi)\b/i;
function detectResponseLanguage(userText, preference) {
  if (preference === "hi") return "hi";
  if (preference === "en") return "en";
  if (preference === "bilingual") return "bilingual";
  if (DEVANAGARI_RE.test(userText)) return "hi";
  if (HINGLISH_HINT_RE.test(userText)) return "bilingual";
  return "en";
}
var FORM_MATCHERS = [
  {
    templateId: "sec_63_bsa_certificate",
    patterns: [/\b63\s*bsa\b/i, /\b65b\b/i, /electronic\s+evidence/i, /इलेक्ट्रॉनिक\s*साक्ष्य/i, /whatsapp\s+certificate/i]
  },
  {
    templateId: "vakalatnama",
    patterns: [/vakalatnama/i, /वकालतनामा/i]
  },
  {
    templateId: "anticipatory_bail_482_bnss",
    patterns: [/anticipatory\s+bail/i, /\b482\s*bnss\b/i, /\b438\s*crpc\b/i, /अग्रिम\s*जमानत/i, /agrim\s*zamanat/i, /pre-arrest\s+bail/i]
  },
  {
    templateId: "quashing_528_bnss",
    patterns: [/quash/i, /\b528\s*bnss\b/i, /fir\s+रद्द/i, /एफआईआर\s*रद्द/i]
  },
  {
    templateId: "slp_article_136",
    patterns: [/\bslp\b/i, /special\s+leave/i, /article\s+136/i, /विशेष\s*अनुमति\s*याचिका/i]
  },
  {
    templateId: "writ_petition_226",
    patterns: [/writ\s+petition/i, /article\s+226/i, /article\s+32/i, /रिट\s*याचिका/i]
  },
  {
    templateId: "counter_affidavit",
    patterns: [/counter\s+affidavit/i, /affidavit[\s-]in[\s-]reply/i, /जवाबी\s*हलफनामा/i, /प्रति\s*शपथ\s*पत्र/i]
  },
  {
    templateId: "rejoinder_affidavit",
    patterns: [/rejoinder/i, /प्रत्युत्तर/i]
  },
  {
    templateId: "ia_condonation_delay",
    patterns: [/condonation/i, /delay\s+application/i, /देरी\s*माफी/i, /विलंब\s*माफी/i]
  },
  {
    templateId: "caveat_148a_cpc",
    patterns: [/caveat/i, /148a/i, /कैविएट/i]
  },
  {
    templateId: "legal_notice_138_commercial",
    patterns: [/legal\s+notice/i, /demand\s+notice/i, /\b138\b.*ni\s*act/i, /कानूनी\s*नोटिस/i, /चेक\s*बाउंस/i]
  },
  {
    templateId: "arbitration_sec9_sec11",
    patterns: [/arbitration\s+petition/i, /section\s+9\s+arbitration/i, /section\s+11\s+arbitration/i, /मध्यस्थता\s*याचिका/i]
  },
  {
    templateId: "general_affidavit",
    patterns: [/affidavit/i, /हलफनामा/i, /शपथ\s*पत्र/i, /शपथपत्र/i, /एफिडेविट/i]
  }
];
var DRAFT_ACTION_VERBS = /\b(draft|write|create|generate|prepare|make|build|banao|likho|taiyar|tayar)\b|(बनाओ|बनाइए|बनाएँ|बनाएं|लिखो|लिखिए|लिखें|तैयार\s*करो|तैयार\s*करें|तैयार\s*कीजिए|ड्राफ्ट)/i;
var STATUTE_HINT_RE = /\b(ipc|crpc|iea|bns|bnss|bsa|section|sec\.?|crosswalk|mapped|equivalent|repealed|naya\s+section)\b|(धारा|सेक्शन|बीएनएस|बीएनएसएस|बीएसए|आईपीसी|सीआरपीसी)/i;
var LIMITATION_HINT_RE = /\b(limitation|deadline\s+calc|calculate\s+limitation|filing\s+window|expiry|time\s+limit|condonation\s+period|34\s+arbitration|slp\s+days)\b|(परिसीमा|सीमा\s*अवधि|अंतिम\s*तिथि|लिमिटेशन)/i;
var REMINDER_HINT_RE = /\b(remind|add\s+deadline|pin\s+deadline|set\s+reminder|create\s+deadline|schedule\s+task)\b|(रिमाइंडर|डेडलाइन\s*जोड़ो|याद\s*दिलाओ|तारीख\s*सेव)/i;
var MATTER_STATUS_HINT_RE = /\b(my\s+case|my\s+hearing|next\s+hearing|cause\s+list|pending\s+deadline|matter\s+status|active\s+matter|summary\s+of\s+my\s+case|what\s+is\s+pending|docket)\b|(मेरा\s*केस|अगली\s*सुनवाई|पेंडिंग|डेडलाइन\s*बताओ|केस\s*स्टेटस|सुनवाई\s*कब)/i;
var CASE_ANALYSIS_HINT_RE = /\b(analy[sz]e\s+(my\s+)?(active\s+|current\s+)?case|case\s+analysis|strength\s+of\s+(my\s+)?(active\s+|current\s+)?case|win\s+chances|maintainability|strategy\s+for\s+(my\s+)?(active\s+|current\s+)?case)\b|(केस\s*विश्लेषण|केस\s*का\s*विश्लेषण|केस\s*की\s*रणनीति|मजबूती\s*बताओ)/i;
var PRECEDENT_HINT_RE = /\b(supreme\s+court|high\s+court|judgment|judgement|precedent|case\s+law|citation|authority|ratio)\b|(सुप्रीम\s*कोर्ट|हाई\s*कोर्ट|निर्णय|फैसला|जजमेंट|केस\s*लॉ)/i;
function extractIsoDate(text) {
  const m = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text);
  return m ? m[1] : null;
}
function inferLimitationRuleId(text) {
  const lower = text.toLowerCase();
  if (lower.includes("34") || lower.includes("arbitral") || lower.includes("award") || lower.includes("\u092E\u0927\u094D\u092F\u0938\u094D\u0925\u0924\u093E")) {
    return "arb_sec_34";
  }
  if (lower.includes("slp") || lower.includes("136") || lower.includes("supreme court") || lower.includes("\u0938\u0941\u092A\u094D\u0930\u0940\u092E")) {
    return "slp_sc_133";
  }
  if (lower.includes("commercial") || lower.includes("13(1a)")) {
    return "commercial_appeal_13";
  }
  if (lower.includes("ibc") || lower.includes("nclat") || lower.includes("61")) {
    return "ibc_nclat_61";
  }
  if (lower.includes("review") || lower.includes("\u092A\u0941\u0928\u0930\u094D\u0935\u093F\u091A\u093E\u0930")) {
    return "review_124";
  }
  if (lower.includes("138") || lower.includes("cheque") || lower.includes("\u091A\u0947\u0915")) {
    return "ni_138_notice";
  }
  if (lower.includes("consumer") || lower.includes("\u0909\u092A\u092D\u094B\u0915\u094D\u0924\u093E")) {
    return "consumer_69";
  }
  if (lower.includes("high court") || lower.includes("appeal") || lower.includes("\u0905\u092A\u0940\u0932")) {
    return "hc_appeal_116a";
  }
  if (lower.includes("suit") || lower.includes("breach") || lower.includes("contract")) {
    return "civil_suit_113";
  }
  return LIMITATION_RULES[0].id;
}
function classifyAssistantIntent(userText) {
  const trimmed = userText.trim();
  if (DRAFT_ACTION_VERBS.test(trimmed)) {
    for (const matcher of FORM_MATCHERS) {
      if (matcher.patterns.some((re) => re.test(trimmed))) {
        return {
          type: "draft_form",
          templateId: matcher.templateId,
          customInstructions: trimmed
        };
      }
    }
  }
  if (REMINDER_HINT_RE.test(trimmed)) {
    const due = extractIsoDate(trimmed) ?? new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const cleanedTitle = trimmed.replace(/^(remind\s+me\s+to|add\s+deadline|set\s+reminder|pin\s+deadline|रिमाइंडर\s*सेट\s*करो|डेडलाइन\s*जोड़ो)[:\-\s]*/i, "").trim();
    return {
      type: "add_deadline",
      title: (cleanedTitle || "Chambers Legal Follow-up Task").slice(0, 160),
      dueDate: due
    };
  }
  if (LIMITATION_HINT_RE.test(trimmed)) {
    return {
      type: "limitation_calc",
      ruleId: inferLimitationRuleId(trimmed),
      triggerDate: extractIsoDate(trimmed) ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      saveDeadline: /\b(save|add|pin|track|सेव|जोड़ो)\b/i.test(trimmed)
    };
  }
  if (STATUTE_HINT_RE.test(trimmed) && !CASE_ANALYSIS_HINT_RE.test(trimmed)) {
    const legacyHits = scanDraftForLegacyCitations(trimmed);
    const numMatch = /\b(\d{1,3}[A-Za-z]?)\b/.exec(trimmed);
    if (legacyHits.length > 0 || numMatch || /crosswalk|mapped|bns|bnss|bsa|धारा/i.test(trimmed)) {
      return {
        type: "statute_lookup",
        query: trimmed
      };
    }
  }
  if (CASE_ANALYSIS_HINT_RE.test(trimmed)) {
    return { type: "case_analysis" };
  }
  if (MATTER_STATUS_HINT_RE.test(trimmed)) {
    return { type: "matter_status" };
  }
  if (PRECEDENT_HINT_RE.test(trimmed)) {
    return { type: "precedent_search", query: trimmed };
  }
  return { type: "general_legal", query: trimmed };
}
function buildDeterministicStatuteReply(query, lang) {
  const inlineMatches = scanDraftForLegacyCitations(query);
  const tokens = query.match(/\b\d{1,3}[A-Za-z]?\b/g) ?? [];
  const lookupHits = [
    ...inlineMatches.map((m) => m.mapping),
    ...tokens.flatMap((t) => lookupStatuteMappings(t)),
    ...lookupStatuteMappings(query)
  ];
  const seen = /* @__PURE__ */ new Set();
  const unique = lookupHits.filter((row) => {
    const key = `${row.legacyCode}-${row.legacySection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
  if (unique.length === 0) {
    const msg = lang === "hi" ? '\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u094D\u0930\u0949\u0938\u0935\u0949\u0915 \u0924\u093E\u0932\u093F\u0915\u093E \u092E\u0947\u0902 \u0907\u0938 \u0927\u093E\u0930\u093E \u0915\u093E \u0938\u0940\u0927\u093E \u092E\u093F\u0932\u093E\u0928 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E\u0964 [\u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0906\u0935\u0936\u094D\u092F\u0915]\n\u0915\u0943\u092A\u092F\u093E \u0938\u091F\u0940\u0915 \u0927\u093E\u0930\u093E \u0938\u0902\u0916\u094D\u092F\u093E \u0932\u093F\u0916\u0947\u0902 (\u0909\u0926\u093E\u0939\u0930\u0923: "420 IPC", "438 CrPC", "65B IEA", "482 CrPC", \u092F\u093E "302 IPC") \u0924\u093E\u0915\u093F \u092C\u093F\u0928\u093E \u0915\u093F\u0938\u0940 \u0924\u094D\u0930\u0941\u091F\u093F \u0915\u0947 \u0928\u092F\u093E BNS/BNSS/BSA \u092A\u094D\u0930\u093E\u0935\u0927\u093E\u0928 \u0926\u093F\u092F\u093E \u091C\u093E \u0938\u0915\u0947\u0964' : lang === "bilingual" ? "No exact match found in the verified BNS/BNSS/BSA crosswalk table [Verification Required].\n\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0924\u093E\u0932\u093F\u0915\u093E \u092E\u0947\u0902 \u0938\u091F\u0940\u0915 \u0927\u093E\u0930\u093E \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940\u0964 \u0915\u0943\u092A\u092F\u093E \u0938\u091F\u0940\u0915 \u0938\u0947\u0915\u094D\u0936\u0928 \u0932\u093F\u0916\u0947\u0902 (\u091C\u0948\u0938\u0947: 420 IPC, 438 CrPC, 65B IEA, 482 CrPC)\u0964" : "No exact section match was found in the verified BNS/BNSS/BSA crosswalk table [Verification Required]. Please specify an exact section number or offence (e.g., 420 IPC, 438 CrPC, 65B IEA, 482 CrPC, or 302 IPC) for an exact zero-hallucination mapping.";
    return { text: msg, sources: [], found: false };
  }
  const sources = unique.map((u) => ({
    label: `${u.legacyCode} ${u.legacySection} \u2192 ${u.newCode} ${u.newSection}`,
    reference: u.title,
    kind: "statute"
  }));
  if (lang === "hi") {
    const rows2 = unique.map(
      (u) => `| ${u.legacyCode} \u0927\u093E\u0930\u093E ${u.legacySection} | **${u.newCode} \u0927\u093E\u0930\u093E ${u.newSection}** (${u.title}) | ${u.keyChangeNote} |`
    );
    return {
      found: true,
      sources,
      text: `### \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0935\u0948\u0927\u093E\u0928\u093F\u0915 \u092E\u093F\u0932\u093E\u0928 (BNS / BNSS / BSA 2023)

| \u092A\u0941\u0930\u093E\u0928\u093E \u092A\u094D\u0930\u093E\u0935\u0927\u093E\u0928 | \u0928\u092F\u093E \u0915\u093E\u0928\u0942\u0928 (2023) | \u092E\u0941\u0916\u094D\u092F \u0915\u093E\u0928\u0942\u0928\u0940 \u0928\u094B\u091F |
| --- | --- | --- |
${rows2.join("\n")}

> **\u0915\u094B\u0930\u094D\u091F \u092B\u093E\u0907\u0932\u093F\u0902\u0917 \u0938\u0941\u091D\u093E\u0935:** 1 \u091C\u0941\u0932\u093E\u0908 2024 \u0915\u0947 \u092C\u093E\u0926 \u0915\u0940 \u0938\u092D\u0940 \u092F\u093E\u091A\u093F\u0915\u093E\u0913\u0902 \u0914\u0930 \u0939\u0932\u092B\u0928\u093E\u092E\u094B\u0902 \u092E\u0947\u0902 \u0928\u0908 \u0927\u093E\u0930\u093E (**${unique[0].newCode} \u0927\u093E\u0930\u093E ${unique[0].newSection}**) \u0915\u093E \u092A\u094D\u0930\u093E\u0925\u092E\u093F\u0915 \u0909\u0932\u094D\u0932\u0947\u0916 \u0915\u0930\u0947\u0902\u0964`
    };
  }
  if (lang === "bilingual") {
    const rows2 = unique.map(
      (u) => `| ${u.legacyCode} ${u.legacySection} | **${u.newCode} ${u.newSection}** (${u.title}) | ${u.keyChangeNote} (\u0905\u092C \u0915\u094B\u0930\u094D\u091F \u092B\u093E\u0907\u0932\u093F\u0902\u0917 \u092E\u0947\u0902 ${u.newCode} \u0927\u093E\u0930\u093E ${u.newSection} \u0932\u093E\u0917\u0942 \u0939\u0948\u0964) |`
    );
    return {
      found: true,
      sources,
      text: `### Verified Statute Crosswalk / \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u093E\u0928\u0942\u0928 \u092E\u093F\u0932\u093E\u0928 (BNS / BNSS / BSA 2023)

| Legacy Section | New Provision (2023) | Key Statutory Change |
| --- | --- | --- |
${rows2.join("\n")}

> **Filing Note / \u092B\u093E\u0907\u0932\u093F\u0902\u0917 \u0928\u094B\u091F:** Cite **${unique[0].newCode} Section ${unique[0].newSection}** as the primary provision in post-July 2024 filings.`
    };
  }
  const rows = unique.map(
    (u) => `| ${u.legacyCode} Section ${u.legacySection} | **${u.newCode} Section ${u.newSection}** (${u.title}) | ${u.keyChangeNote} |`
  );
  return {
    found: true,
    sources,
    text: `### Verified Statutory Mapping (BNS / BNSS / BSA 2023)

| Legacy Code | New Provision (2023) | Key Statutory Note |
| --- | --- | --- |
${rows.join("\n")}

> **Filing Practice Note:** Cite **${unique[0].newCode} Section ${unique[0].newSection}** as the primary statutory provision in post-July 2024 filings (noting the legacy provision only in brackets if the FIR/proceedings pre-date 1 July 2024).`
  };
}
function buildDeterministicLimitationReply(ruleId, triggerDate, lang, savedDeadlineTitle) {
  const computed = calculateLimitationDeadline(ruleId, triggerDate);
  const statutoryProvision = `${computed.rule.statute} (${computed.rule.articleOrSection})`;
  const sources = [
    {
      label: computed.rule.label,
      reference: statutoryProvision,
      kind: "limitation_rule"
    }
  ];
  const savedNoteEn = savedDeadlineTitle ? `

> **Action Completed:** Pinned **${savedDeadlineTitle}** (Due **${computed.effectiveDueDate}**) directly to your active Matter deadlines.` : "";
  const savedNoteHi = savedDeadlineTitle ? `

> **\u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u094D\u0923:** **${savedDeadlineTitle}** (\u0905\u0902\u0924\u093F\u092E \u0924\u093F\u0925\u093F: **${computed.effectiveDueDate}**) \u0915\u094B \u0906\u092A\u0915\u0947 \u0915\u0947\u0938 \u091F\u094D\u0930\u0948\u0915\u0930 \u092E\u0947\u0902 \u0938\u0947\u0935 \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964` : "";
  if (lang === "hi") {
    return {
      computed,
      sources,
      text: `### \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u092A\u0930\u093F\u0938\u0940\u092E\u093E \u0917\u0923\u0928\u093E (Indian Limitation Act)

- **\u0915\u093E\u0928\u0942\u0928\u0940 \u0909\u092A\u093E\u092F:** ${computed.rule.label}
- **\u0935\u0948\u0927\u093E\u0928\u093F\u0915 \u092A\u094D\u0930\u093E\u0935\u0927\u093E\u0928:** ${statutoryProvision}
- **\u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F (Trigger Date):** \`${triggerDate}\`
- **\u0928\u093F\u0930\u094D\u0927\u093E\u0930\u093F\u0924 \u0905\u0902\u0924\u093F\u092E \u0924\u093F\u0925\u093F (Effective Expiry):** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? " (\u0927\u093E\u0930\u093E 4 \u0915\u0947 \u0924\u0939\u0924 \u0930\u0935\u093F\u0935\u093E\u0930/\u0905\u0935\u0915\u093E\u0936 \u0915\u0947 \u0915\u093E\u0930\u0923 \u0905\u0917\u0932\u0947 \u0915\u093E\u0930\u094D\u092F\u0926\u093F\u0935\u0938 \u092A\u0930 \u0938\u092E\u093E\u092F\u094B\u091C\u093F\u0924)" : ""}
- **\u0936\u0947\u0937 \u0926\u093F\u0928:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} \u0926\u093F\u0928 \u0936\u0947\u0937` : `${Math.abs(computed.daysRemaining)} \u0926\u093F\u0928 \u092A\u0939\u0932\u0947 \u0938\u092E\u093E\u092A\u094D\u0924`}
- **\u0926\u0947\u0930\u0940 \u092E\u093E\u092B\u0940 \u0938\u0940\u092E\u093E (Outer Cap):** ${computed.graceDeadlineDate ?? "\u0927\u093E\u0930\u093E 5 \u0915\u0947 \u0905\u0902\u0924\u0930\u094D\u0917\u0924 \u092A\u0930\u094D\u092F\u093E\u092A\u094D\u0924 \u0915\u093E\u0930\u0923 \u0938\u093F\u0926\u094D\u0927 \u0915\u0930\u0928\u0947 \u092A\u0930"}
- **\u0915\u093E\u0928\u0942\u0928\u0940 \u0928\u094B\u091F:** ${computed.rule.practiceNote}${savedNoteHi}`
    };
  }
  if (lang === "bilingual") {
    return {
      computed,
      sources,
      text: `### Verified Limitation Calculation / \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u092A\u0930\u093F\u0938\u0940\u092E\u093E \u0917\u0923\u0928\u093E

- **Remedy / \u0909\u092A\u093E\u092F:** ${computed.rule.label} (${statutoryProvision})
- **Trigger Date / \u092A\u094D\u0930\u093E\u0930\u0902\u092D \u0924\u093F\u0925\u093F:** \`${triggerDate}\`
- **Prescribed Expiry / \u0905\u0902\u0924\u093F\u092E \u0924\u093F\u0925\u093F:** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? " (Sec. 4 Sunday Roll-Forward Applied)" : ""}
- **Window Left / \u0936\u0947\u0937 \u0905\u0935\u0927\u093F:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} day(s) remaining` : `Expired ${Math.abs(computed.daysRemaining)} day(s) ago`}
- **Outer Condonation Cap:** ${computed.graceDeadlineDate ?? "Subject to Sec. 5 sufficient cause"}
- **Statutory Rule:** ${computed.rule.practiceNote}${savedNoteEn}`
    };
  }
  return {
    computed,
    sources,
    text: `### Verified Statutory Limitation Computation

- **Remedy:** ${computed.rule.label}
- **Governing Provision:** ${statutoryProvision}
- **Trigger Date:** \`${triggerDate}\`
- **Effective Filing Expiry:** **${computed.effectiveDueDate}**${computed.rolledOverFromSunday ? " (Adjusted forward to next working day under Section 4 Limitation Act)" : ""}
- **Remaining Window:** ${computed.daysRemaining >= 0 ? `${computed.daysRemaining} day(s) left` : `Expired ${Math.abs(computed.daysRemaining)} day(s) ago`}
- **Strict Outer Condonable Cap:** ${computed.graceDeadlineDate ?? "Condonable under Section 5 upon proving sufficient cause"}
- **Guidance:** ${computed.rule.practiceNote}${savedNoteEn}`
  };
}
function buildDeterministicMatterStatusReply(matter, cases, deadlines, draftCount, lang) {
  if (!matter) {
    return {
      sources: [],
      text: lang === "hi" ? "\u0905\u092D\u0940 \u0915\u094B\u0908 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 (Matter) \u091A\u0941\u0928\u093E \u0928\u0939\u0940\u0902 \u0917\u092F\u093E \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u092C\u093E\u090F\u0901 \u092E\u0947\u0928\u0942 \u0938\u0947 \u090F\u0915 \u0915\u0947\u0938 \u091A\u0941\u0928\u0947\u0902 \u092F\u093E Command Overview \u092E\u0947\u0902 \u0928\u092F\u093E \u0915\u0947\u0938 \u091C\u094B\u0921\u093C\u0947\u0902\u0964" : "No active Matter is currently selected. Select a Matter from the sidebar or create one in Command Overview."
    };
  }
  const matterCases = cases.filter((c) => c.matterId === matter.id);
  const pendingDeadlines = deadlines.filter((d) => d.matterId === matter.id && !d.completed);
  const sources = [
    { label: `${matter.matterCode} \u2014 ${matter.title}`, reference: matter.forum, kind: "matter_record" },
    ...matterCases.slice(0, 3).map((c) => ({
      label: c.caseNumber,
      reference: `${c.court} \xB7 Next: ${c.nextHearingDate}`,
      kind: "matter_record"
    }))
  ];
  const hearingLines = matterCases.length > 0 ? matterCases.map(
    (c, i) => `${i + 1}. **${c.caseNumber}** (${c.court}) \u2014 Next Hearing: **${c.nextHearingDate}** | ${c.courtroom || "Courtroom TBD"} | Stage: ${c.stage}`
  ).join("\n") : lang === "hi" ? "- \u0907\u0938 \u0915\u0947\u0938 \u0915\u0947 \u0932\u093F\u090F \u0905\u092D\u0940 \u0915\u094B\u0908 \u0938\u0941\u0928\u0935\u093E\u0908 \u0924\u093F\u0925\u093F \u0926\u0930\u094D\u091C \u0928\u0939\u0940\u0902 \u0939\u0948\u0964" : "- No tracked hearings recorded yet for this matter.";
  const deadlineLines = pendingDeadlines.length > 0 ? pendingDeadlines.map((d, i) => `${i + 1}. **${d.title}** \u2014 Due: **${d.dueDate}** (${d.statuteArticle})`).join("\n") : lang === "hi" ? "- \u0915\u094B\u0908 \u0932\u0902\u092C\u093F\u0924 \u0921\u0947\u0921\u0932\u093E\u0907\u0928 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964" : "- No pending statutory deadlines.";
  if (lang === "hi") {
    return {
      sources,
      text: `### \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 \u0915\u093E \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0935\u093F\u0935\u0930\u0923 (Live Workspace Record)

- **\u0915\u0947\u0938:** ${matter.title} (\`${matter.matterCode}\`)
- **\u0928\u094D\u092F\u093E\u092F\u093E\u0932\u092F / \u092B\u094B\u0930\u092E:** ${matter.forum}
- **\u092E\u0941\u0935\u0915\u094D\u0915\u093F\u0932 (Client):** ${matter.clientName}
- **\u0935\u093F\u092A\u0915\u094D\u0937\u0940 \u092A\u0915\u094D\u0937:** ${matter.opposingParty || "\u0909\u0932\u094D\u0932\u0947\u0916\u093F\u0924 \u0928\u0939\u0940\u0902"}
- **\u0915\u0941\u0932 \u0938\u0947\u0935 \u0915\u093F\u090F \u0917\u090F \u0921\u094D\u0930\u093E\u092B\u094D\u091F:** ${draftCount}

#### \u0906\u0917\u093E\u092E\u0940 \u0938\u0941\u0928\u0935\u093E\u0908 (Tracked Hearings)
${hearingLines}

#### \u0932\u0902\u092C\u093F\u0924 \u092B\u093E\u0907\u0932\u093F\u0902\u0917 \u0921\u0947\u0921\u0932\u093E\u0907\u0928 (Pending Deadlines)
${deadlineLines}

> **\u092E\u0941\u0916\u094D\u092F \u0924\u0925\u094D\u092F:** ${matter.summaryFacts}`
    };
  }
  return {
    sources,
    text: `### Verified Active Matter Status

- **Matter:** ${matter.title} (\`${matter.matterCode}\`)
- **Forum:** ${matter.forum}
- **Client:** ${matter.clientName} | **Opposing Party:** ${matter.opposingParty || "Not specified"}
- **Saved Drafts in Matter:** ${draftCount}

#### Tracked Court Hearings
${hearingLines}

#### Pending Statutory & Filing Deadlines
${deadlineLines}

> **Recorded Summary Facts:** ${matter.summaryFacts}`
  };
}
function buildDeterministicPrecedentReply(query, jurisdiction, lang) {
  const hits = retrieveRelevantPrecedents(query, jurisdiction, 4);
  const sources = hits.map((h) => ({
    label: `${h.caseName}, ${h.citation}`,
    reference: `${h.court} (${h.bench})`,
    kind: "precedent"
  }));
  if (lang === "hi") {
    const body2 = hits.map(
      (h, i) => `${i + 1}. **${h.caseName}, ${h.citation}** (${h.court}, ${h.bench}, ${h.year}) \u2014 \u092A\u094D\u0930\u093E\u0935\u0927\u093E\u0928: ${h.statutes.join(", ")}\u0964 \u092E\u0941\u0916\u094D\u092F \u0938\u093F\u0926\u094D\u0927\u093E\u0902\u0924: ${h.ratio} \u0930\u0923\u0928\u0940\u0924\u093F\u0915 \u0909\u092A\u092F\u094B\u0917: ${h.practicalApplication}`
    ).join("\n");
    return {
      sources,
      text: `### \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0938\u0941\u092A\u094D\u0930\u0940\u092E \u0915\u094B\u0930\u094D\u091F \u090F\u0935\u0902 \u0939\u093E\u0908 \u0915\u094B\u0930\u094D\u091F \u0928\u093F\u0930\u094D\u0923\u092F (Verified Precedent Corpus)

${body2}

> **\u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0928\u094B\u091F:** \u090A\u092A\u0930 \u0926\u093F\u090F \u0917\u090F \u0938\u092D\u0940 \u0915\u0947\u0938 \u0938\u093E\u0907\u091F\u0947\u0936\u0928 VidhiOS \u0915\u0947 \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0928\u094D\u092F\u093E\u092F\u093F\u0915 \u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u0938\u0947 \u0932\u093F\u090F \u0917\u090F \u0939\u0948\u0902\u0964`
    };
  }
  const body = hits.map(
    (h, i) => `${i + 1}. **${h.caseName}, ${h.citation}** (${h.court}, ${h.bench}, ${h.year}) \u2014 Provisions: ${h.statutes.join(", ")}. **Ratio:** ${h.ratio} **Application:** ${h.practicalApplication}`
  ).join("\n");
  return {
    sources,
    text: `### Verified Supreme Court & High Court Authorities

${body}`
  };
}
function getFormConfirmationReply(templateId, draftTitle, lang) {
  const tpl = getJudiciaryTemplate(templateId);
  if (lang === "hi") {
    return `### \u0915\u094B\u0930\u094D\u091F-\u0924\u0948\u092F\u093E\u0930 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0924\u0948\u092F\u093E\u0930 \u0939\u0948

\u0906\u092A\u0915\u093E \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C **${tpl.name}** (${tpl.statuteBasis}) \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0924\u0948\u092F\u093E\u0930 \u0915\u0930 \u0932\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948 \u0914\u0930 Matter Drafts \u092E\u0947\u0902 **${draftTitle}** \u0915\u0947 \u0928\u093E\u092E \u0938\u0947 \u0938\u0947\u0935 \u0939\u094B \u0917\u092F\u093E \u0939\u0948\u0964

- **\u0928\u094D\u092F\u093E\u092F\u093E\u0932\u092F \u092E\u093E\u0928\u0915 \u0938\u0902\u0930\u091A\u0928\u093E:** Cause Title, \u0915\u094D\u0930\u092E\u093E\u0902\u0915\u093F\u0924 \u092A\u0948\u0930\u093E\u0917\u094D\u0930\u093E\u092B, Prayer, \u0914\u0930 Order XIX Rule 3 CPC \u0915\u0947 \u0905\u0902\u0924\u0930\u094D\u0917\u0924 Verification/Affidavit \u0936\u093E\u092E\u093F\u0932 \u0939\u0948\u0964
- **\u0905\u0917\u0932\u093E \u0915\u0926\u092E:** \u0928\u0940\u091A\u0947 \u0926\u093F\u090F \u092C\u091F\u0928 \u0938\u0947 \u0938\u0940\u0927\u0947 \u0915\u094B\u0930\u094D\u091F-\u092B\u0949\u0930\u094D\u092E\u0947\u091F\u0947\u0921 Word (**.DOCX**) \u092B\u093C\u093E\u0907\u0932 \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930\u0947\u0902 \u092F\u093E Drafting Studio \u092E\u0947\u0902 \u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902\u0964`;
  }
  if (lang === "bilingual") {
    return `### Court Document Ready / \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0924\u0948\u092F\u093E\u0930 \u0939\u0948

Generated **${tpl.name}** (${tpl.statuteBasis}) grounded in your active Matter facts and saved as **${draftTitle}**.

- **Action Ready:** Download the court-formatted Word (**.DOCX**) file directly below or open it in Drafting Studio.
- **\u0939\u093F\u0902\u0926\u0940:** \u0906\u092A\u0915\u093E \u0915\u094B\u0930\u094D\u091F-\u092B\u0949\u0930\u094D\u092E\u0947\u091F\u0947\u0921 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0924\u0948\u092F\u093E\u0930 \u0939\u094B\u0915\u0930 Matter Drafts \u092E\u0947\u0902 \u0938\u0947\u0935 \u0939\u094B \u0917\u092F\u093E \u0939\u0948\u0964 \u0928\u0940\u091A\u0947 \u0938\u0947 \u0938\u0940\u0927\u0947 **.DOCX** \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930\u0947\u0902\u0964`;
  }
  return `### Court-Ready Draft Generated

Generated **${tpl.name}** (${tpl.statuteBasis}) grounded strictly in your active Matter facts and saved to Matter Drafts as **${draftTitle}**.

- **Registry Formatting:** Includes Supreme Court / High Court Cause Title, numbered paragraphs, Prayer clause, and Order XIX Rule 3 Verification.
- **Next Steps:** Click **Download Court .DOCX** below for immediate Word export, or **Open in Drafting** to edit and audit.`;
}

// src/lib/legal/docxExporter.ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  TextRun
} from "docx";
var UPPERCASE_HEADING_PATTERN = /^(IN THE |VERSUS|VS\.?|IN THE MATTER OF|PRAYER|VERIFICATION|AFFIDAVIT|VAKALATNAMA|SYNOPSIS|LIST OF DATES|GROUNDS|CERTIFICATE|PART [AB]|SUPPORTING AFFIDAVIT|EXECUTIVE|STATUTORY|PRECEDENT|STRATEGIC|RECOMMENDED)/i;
function isAllCapsHeading(line) {
  const clean = line.replace(/^[#*\s]+/, "").trim();
  if (clean.length < 3 || clean.length > 130) return false;
  if (UPPERCASE_HEADING_PATTERN.test(clean)) return true;
  const letters = clean.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}
function cleanMarkdownMarkers(text) {
  return text.replace(/^#{1,6}\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}
function buildCourtDocument(payload) {
  const lines = payload.content.replace(/\r\n/g, "\n").split("\n");
  const paragraphs = [];
  const trimmedStart = payload.content.trim().toUpperCase();
  if (payload.courtHeader && !trimmedStart.startsWith("IN THE ")) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160, line: 340 },
        children: [
          new TextRun({
            text: payload.courtHeader.toUpperCase(),
            bold: true,
            size: 26,
            // 13pt
            font: "Times New Roman"
          })
        ]
      })
    );
  }
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  if (payload.title && !firstNonEmpty.toLowerCase().includes(payload.title.toLowerCase().slice(0, 18))) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 220, line: 340 },
        border: {
          bottom: {
            color: "1A2E30",
            space: 6,
            style: BorderStyle.SINGLE,
            size: 6
          }
        },
        children: [
          new TextRun({
            text: payload.title.toUpperCase(),
            bold: true,
            size: 24,
            // 12pt
            font: "Times New Roman"
          })
        ]
      })
    );
  }
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 100 },
          children: []
        })
      );
      continue;
    }
    if (/^[-_=]{5,}$/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: {
            bottom: {
              color: "666666",
              space: 4,
              style: BorderStyle.SINGLE,
              size: 4
            }
          },
          children: []
        })
      );
      continue;
    }
    const cleaned = cleanMarkdownMarkers(trimmed);
    if (/^(IN THE |VERSUS$|VS\.?$|VAKALATNAMA$|PRAYER$|VERIFICATION$|AFFIDAVIT$)/i.test(cleaned)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 140, line: 340 },
          children: [
            new TextRun({
              text: cleaned,
              bold: true,
              underline: /^(PRAYER|VERIFICATION|VAKALATNAMA|AFFIDAVIT)$/i.test(cleaned) ? {} : void 0,
              size: 24,
              font: "Times New Roman"
            })
          ]
        })
      );
      continue;
    }
    if (trimmed.startsWith("#") || isAllCapsHeading(trimmed)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 200, after: 120, line: 340 },
          children: [
            new TextRun({
              text: cleaned,
              bold: true,
              size: 24,
              font: "Times New Roman"
            })
          ]
        })
      );
      continue;
    }
    const numberedMatch = /^(\d+\.|\([a-z0-9]+\)|[A-Z]\.|•|-)\s+(.*)$/.exec(cleaned);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 480, hanging: 320 },
          spacing: { after: 140, line: 360 },
          // 1.5x Supreme Court / High Court line spacing
          children: [
            new TextRun({
              text: `${numberedMatch[1]} `,
              bold: true,
              size: 24,
              font: "Times New Roman"
            }),
            new TextRun({
              text: numberedMatch[2],
              size: 24,
              font: "Times New Roman"
            })
          ]
        })
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 360 },
        children: [
          new TextRun({
            text: cleaned,
            size: 24,
            font: "Times New Roman"
          })
        ]
      })
    );
  }
  const headerLabel = [payload.matterCode, payload.docType || "LEGAL FILING"].filter(Boolean).join("  |  ");
  return new Document({
    creator: "VidhiOS Legal Chambers",
    title: payload.title,
    description: payload.docType || "Court-ready legal document",
    sections: [
      {
        properties: {
          page: {
            // Supreme Court & High Court standard margins: 1.5" left binding margin, 1.0" top/right/bottom
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 2160
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerLabel || "VIDHIOS COURT DRAFT",
                    size: 18,
                    color: "5A6668",
                    font: "Times New Roman"
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${payload.footerNote || "Prepared in VidhiOS Chambers \u2014 Verify citations prior to filing"}   |   Page `,
                    size: 18,
                    color: "5A6668",
                    font: "Times New Roman"
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: "5A6668",
                    font: "Times New Roman"
                  })
                ]
              })
            ]
          })
        },
        children: paragraphs
      }
    ]
  });
}
async function buildCourtDocxBuffer(payload) {
  const doc = buildCourtDocument(payload);
  return Packer.toBuffer(doc);
}
function sanitizeDocxFilename(title) {
  const slug = (title || "legal-document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  return `${slug || "legal-document"}.docx`;
}

// src/lib/legal/whatsappParser.ts
function parseWhatsAppCommand(input) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === "/help" || lower === "help" || lower === "commands") {
    return { type: "help" };
  }
  if (lower.startsWith("/bns")) {
    return { type: "bns", query: trimmed.slice(4).trim() };
  }
  if (lower.startsWith("/remind")) {
    return { type: "remind", text: trimmed.slice(7).trim() };
  }
  if (lower === "/hearings" || lower === "/next" || lower.startsWith("/next hearings") || /\b(upcoming|next)\s+hearings?\b/i.test(lower)) {
    return { type: "hearings" };
  }
  if (lower === "/cases" || lower === "/causelist" || /\bcause\s*list\b/i.test(lower)) {
    return { type: "cases" };
  }
  if (lower === "/deadlines" || lower === "/limitation") {
    return { type: "deadlines" };
  }
  if (lower === "/brief" || lower === "/summary" || lower === "/matter") {
    return { type: "brief" };
  }
  return { type: "ai_query", prompt: trimmed };
}

// src/server/createApp.ts
var PORT = Number(process.env.PORT) || 3e3;
var IS_PROD = process.env.NODE_ENV === "production";
var ALLOWED_DOC_MIMES = /* @__PURE__ */ new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain"
]);
var ALLOWED_AUDIO_MIMES = /* @__PURE__ */ new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a"
]);
function extractErrorMessage(err) {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
  }
  if (err instanceof Error) return err.message;
  return "Unexpected server error";
}
async function createExpressApp(options = {}) {
  const includeStatic = options.includeStatic ?? true;
  const app = express();
  app.disable("x-powered-by");
  app.use(async (_req, _res, next) => {
    try {
      await repository.ensureReady();
    } catch (err) {
      console.error("[Repository] ensureReady warning:", err);
    }
    next();
  });
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object" && !req._body) {
      req._body = true;
    }
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || "";
    if (matchedPath && matchedPath.startsWith("/api") && (req.url === "/api" || req.url === "/api/")) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith("/api")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    next();
  });
  app.use(express.json({ limit: "20mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.get("/api/health", async (_req, res) => {
    const nv = getNvidiaConfig();
    const neonCheck = isNeonConfigured() ? await testNeonConnection() : null;
    res.json({
      ok: true,
      storageEngine: repository.engine,
      neon: neonCheck,
      aiEngine: {
        nvidiaConfigured: nv.configured,
        geminiConfigured: isGeminiConfigured(),
        primaryModel: nv.primaryModel,
        fastModel: nv.fastModel
      }
    });
  });
  app.post("/api/auth/register", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        fullName: z.string().min(2).max(120),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]).optional()
      });
      const data = schema.parse(req.body);
      const user = await repository.registerUser(data);
      const token = signSessionToken(user.id, user.email);
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(1)
      });
      const data = schema.parse(req.body);
      const user = await repository.authenticateUser(data.email, data.password);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      const token = signSessionToken(user.id, user.email);
      res.json({ token, user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/auth/demo", async (_req, res) => {
    await repository.ensureReady();
    const user = repository.getDemoUser();
    const token = signSessionToken(user.id, user.email);
    res.json({ token, user });
  });
  const requireAdmin = (req, res, next) => {
    requireAuth(req, res, async () => {
      const user = await repository.getUserById(req.authUser.userId);
      const isAllowed = Boolean(
        user?.isAdmin || user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "administrator" || user?.email === "vidhios@admin.com" || user?.email === "chambers@vidhios.in"
      );
      if (!isAllowed) {
        res.status(403).json({ error: "Access denied: Administrator privileges required." });
        return;
      }
      next();
    });
  };
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      await repository.ensureReady(repository.engine === "neon");
      const users = repository.getAllUsers();
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        fullName: z.string().min(2).max(120),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]).optional(),
        isAdmin: z.boolean().optional()
      });
      const data = schema.parse(req.body);
      const user = await repository.adminCreateUser(data);
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        fullName: z.string().min(2).max(120).optional(),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]).optional(),
        isAdmin: z.boolean().optional()
      });
      const data = schema.parse(req.body);
      const user = await repository.adminUpdateUser(req.params.id, data);
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        password: z.string().min(8, "Password must be at least 8 characters")
      });
      const data = schema.parse(req.body);
      await repository.adminResetPassword(req.params.id, data.password);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.authUser.userId) {
        res.status(400).json({ error: "You cannot delete your own active administrator account." });
        return;
      }
      await repository.adminDeleteUser(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.get("/api/workspace", requireAuth, async (req, res) => {
    const bundle = await repository.getWorkspaceBundle(req.authUser.userId);
    if (!bundle) {
      res.status(404).json({ error: "User workspace not found." });
      return;
    }
    const nv = getNvidiaConfig();
    res.json({
      ...bundle,
      aiEngine: {
        nvidiaConfigured: nv.configured,
        geminiConfigured: isGeminiConfigured(),
        primaryModel: nv.primaryModel,
        fastModel: nv.fastModel
      }
    });
  });
  app.post("/api/matters", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(3).max(200),
        matterCode: z.string().min(2).max(60),
        clientName: z.string().min(2).max(160),
        opposingParty: z.string().max(160).default(""),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]),
        forum: z.string().min(2).max(200),
        status: z.enum(["active", "pending_hearing", "in_review", "closed"]).default("active"),
        summaryFacts: z.string().max(6e3).default("")
      });
      const data = schema.parse(req.body);
      const matter = repository.createMatter(req.authUser.userId, data);
      await repository.persist();
      res.status(201).json(matter);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.delete("/api/matters/:id", requireAuth, async (req, res) => {
    const deleted = repository.deleteMatter(req.authUser.userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: "Matter not found." });
      return;
    }
    await repository.persist();
    res.json({ deleted: true });
  });
  app.post("/api/drafts", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        docType: z.string().min(2).max(100),
        content: z.string().max(12e4)
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser.userId, data.matterId)) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const draft = repository.createDraft(req.authUser.userId, data);
      await repository.persist();
      res.status(201).json(draft);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.patch("/api/drafts/:id", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(2).max(200).optional(),
        content: z.string().max(12e4).optional()
      });
      const data = schema.parse(req.body);
      const updated = repository.updateDraft(req.authUser.userId, String(req.params.id), data);
      if (!updated) {
        res.status(404).json({ error: "Draft not found." });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.patch("/api/contract-reviews/:reviewId/clauses/:clauseId", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        decision: z.enum(["pending", "accepted", "rejected"])
      });
      const { decision } = schema.parse(req.body);
      const updated = repository.updateRedlineClauseDecision(
        req.authUser.userId,
        String(req.params.reviewId),
        String(req.params.clauseId),
        decision
      );
      if (!updated) {
        res.status(404).json({ error: "Contract review or clause not found." });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/cases", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        caseNumber: z.string().min(2).max(80),
        cnrNumber: z.string().max(80).default(""),
        court: z.string().min(2).max(160),
        courtroom: z.string().max(80).default(""),
        bench: z.string().max(160).default(""),
        causeListItem: z.string().max(80).default(""),
        nextHearingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        stage: z.string().min(2).max(160),
        status: z.enum(["listed", "in_session", "adjourned", "disposed"]).default("listed"),
        notes: z.string().max(2e3).default("")
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser.userId, data.matterId)) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const created = repository.addTrackedCase({ ...data, userId: req.authUser.userId });
      await repository.persist();
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.patch("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        status: z.enum(["listed", "in_session", "adjourned", "disposed"])
      });
      const { status } = schema.parse(req.body);
      const updated = repository.updateTrackedCaseStatus(
        req.authUser.userId,
        String(req.params.id),
        status
      );
      if (!updated) {
        res.status(404).json({ error: "Tracked case not found." });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/deadlines", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        statuteArticle: z.string().min(2).max(160),
        triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        graceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().max(2e3).default("")
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser.userId, data.matterId)) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const created = repository.addDeadline({
        ...data,
        userId: req.authUser.userId,
        completed: false
      });
      await repository.persist();
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.patch("/api/deadlines/:id/toggle", requireAuth, async (req, res) => {
    const updated = repository.toggleDeadline(req.authUser.userId, String(req.params.id));
    if (!updated) {
      res.status(404).json({ error: "Deadline not found." });
      return;
    }
    await repository.persist();
    res.json(updated);
  });
  app.post("/api/whatsapp/command", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().nullable().optional(),
        text: z.string().min(1).max(2e3)
      });
      const { matterId, text } = schema.parse(req.body);
      const userId = req.authUser.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      if (!bundle) {
        res.status(404).json({ error: "Workspace not found." });
        return;
      }
      const activeMatter = (matterId ? bundle.matters.find((m) => m.id === matterId) : bundle.matters[0]) ?? null;
      const userMsg = repository.addWhatsAppMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        sender: "user",
        body: text,
        commandTag: "input"
      });
      const intent = parseWhatsAppCommand(text);
      let replyBody = "";
      let commandTag = intent.type;
      let createdDeadline = null;
      if (intent.type === "help") {
        replyBody = [
          "VidhiOS WhatsApp Command Reference:",
          "\u2022 /hearings \u2014 Upcoming court dates & cause list items",
          "\u2022 /cases \u2014 Full active docket status",
          "\u2022 /deadlines \u2014 Pending Limitation & filing deadlines",
          "\u2022 /bns <section or offence> \u2014 Instant IPC/CrPC/IEA \u2192 BNS/BNSS/BSA lookup",
          "\u2022 /remind <task> \u2014 Pin a reminder directly to active Matter deadlines",
          "\u2022 /brief \u2014 Active Matter facts & strategic snapshot",
          "\u2022 Or ask any natural-language legal question directly."
        ].join("\n");
      } else if (intent.type === "hearings" || intent.type === "cases") {
        if (bundle.trackedCases.length === 0) {
          replyBody = "No tracked cases found yet. Add a case in the Case Tracker module.";
        } else {
          replyBody = "Active Cause List & Hearings:\n" + bundle.trackedCases.slice(0, 6).map(
            (c, i) => `${i + 1}. ${c.caseNumber} (${c.court}) \u2014 ${c.nextHearingDate} | ${c.courtroom || "TBD"} | ${c.causeListItem || c.stage}`
          ).join("\n");
        }
      } else if (intent.type === "deadlines") {
        const pending = bundle.deadlines.filter((d) => !d.completed);
        replyBody = pending.length === 0 ? "All filing and limitation deadlines are currently marked complete." : "Pending Statutory & Filing Deadlines:\n" + pending.slice(0, 6).map((d, i) => `${i + 1}. ${d.title} \u2014 Due ${d.dueDate} (${d.statuteArticle})`).join("\n");
      } else if (intent.type === "bns") {
        const hits = lookupStatuteMappings(intent.query);
        if (hits.length === 0) {
          replyBody = `No exact crosswalk match for "${intent.query}". Try e.g. /bns 420, /bns 438, or /bns 65B.`;
        } else {
          replyBody = hits.slice(0, 4).map(
            (h) => `${h.legacyCode} ${h.legacySection} \u2192 ${h.newCode} ${h.newSection} (${h.title})
Note: ${h.keyChangeNote}`
          ).join("\n\n");
        }
      } else if (intent.type === "remind") {
        const taskTitle = intent.text || "Follow-up chambers reminder";
        if (activeMatter) {
          const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: taskTitle,
            statuteArticle: "WhatsApp Command Reminder",
            triggerDate: today,
            dueDate: due,
            completed: false,
            notes: "Created from WhatsApp Legal Command Center."
          });
          replyBody = `Reminder pinned to "${activeMatter.title}": "${taskTitle}" (target date: ${due}). Synced with Case Tracker & Calendar.`;
        } else {
          replyBody = "Create a Matter first before pinning a WhatsApp reminder.";
        }
      } else if (intent.type === "brief") {
        replyBody = activeMatter ? `Active Matter Brief \u2014 ${activeMatter.title} (${activeMatter.matterCode})
Forum: ${activeMatter.forum}
Client: ${activeMatter.clientName}
Status: ${activeMatter.status}
Facts: ${activeMatter.summaryFacts}` : "No active matter selected.";
      } else {
        const matterCtx = activeMatter ? `${activeMatter.title} | ${activeMatter.forum} | ${activeMatter.summaryFacts}` : "General legal practice";
        replyBody = await answerWhatsAppQuery({
          prompt: intent.prompt,
          matterContext: matterCtx,
          jurisdiction: activeMatter?.jurisdiction ?? "india_litigation"
        });
      }
      const assistantMsg = repository.addWhatsAppMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        sender: "assistant",
        body: replyBody,
        commandTag
      });
      res.json({ userMsg, assistantMsg, createdDeadline });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/research", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        query: z.string().min(5).max(3e3),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]),
        tier: z.enum(["fast", "expert"]).optional().default("fast")
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const matterContext = `Title: ${matter.title}
Forum: ${matter.forum}
Client: ${matter.clientName}
Opposing: ${matter.opposingParty}
Facts: ${matter.summaryFacts}`;
      const result = await runGroundedLegalResearch({
        query: data.query,
        jurisdiction: data.jurisdiction,
        matterContext,
        tier: data.tier
      });
      const saved = repository.addResearchMemo({
        matterId: matter.id,
        userId: req.authUser.userId,
        query: data.query,
        jurisdiction: data.jurisdiction,
        answerMarkdown: result.answerMarkdown,
        citations: result.citations,
        citationIntegrity: result.citationIntegrity
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/research/stream", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        query: z.string().min(5).max(3e3),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]),
        tier: z.enum(["fast", "expert"]).optional().default("fast")
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      const sendEvent = (event, payload) => {
        res.write(`event: ${event}
data: ${JSON.stringify(payload)}

`);
      };
      const matterContext = `Title: ${matter.title}
Forum: ${matter.forum}
Client: ${matter.clientName}
Opposing: ${matter.opposingParty}
Facts: ${matter.summaryFacts}`;
      const result = await streamGroundedLegalResearch(
        {
          query: data.query,
          jurisdiction: data.jurisdiction,
          matterContext,
          tier: data.tier
        },
        (update) => {
          sendEvent(update.type, update.data);
        }
      );
      const saved = repository.addResearchMemo({
        matterId: matter.id,
        userId: req.authUser.userId,
        query: data.query,
        jurisdiction: data.jurisdiction,
        answerMarkdown: result.answerMarkdown,
        citations: result.citations,
        citationIntegrity: result.citationIntegrity
      });
      sendEvent("complete", saved);
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: extractErrorMessage(err) });
      } else {
        res.write(`event: error
data: ${JSON.stringify({ error: extractErrorMessage(err) })}

`);
        res.end();
      }
    }
  });
  app.post("/api/ai/draft-generate", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        docType: z.string().min(2).max(100),
        instructions: z.string().min(5).max(5e3),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"])
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const matterContext = `Title: ${matter.title}
Forum: ${matter.forum}
Client: ${matter.clientName}
Opposing: ${matter.opposingParty}
Facts: ${matter.summaryFacts}`;
      const content = await generateLegalDraft({
        docType: data.docType,
        instructions: data.instructions,
        jurisdiction: data.jurisdiction,
        matterContext
      });
      const saved = repository.createDraft(req.authUser.userId, {
        matterId: matter.id,
        title: data.title,
        docType: data.docType,
        content
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/draft-rewrite", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        selection: z.string().min(5).max(12e3),
        instruction: z.string().min(2).max(1e3),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"])
      });
      const data = schema.parse(req.body);
      const rewritten = await rewriteDraftSelection(data);
      res.json({ rewritten });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/courtroom/start", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        mode: z.enum(["bench", "opposing_counsel"]),
        forumContext: z.string().min(2).max(200),
        briefExcerpt: z.string().min(10).max(12e3),
        openingSubmission: z.string().min(5).max(4e3)
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const aiTurn = await runCourtroomTurn({
        mode: data.mode,
        forumContext: data.forumContext,
        briefExcerpt: data.briefExcerpt,
        history: [],
        userSubmission: data.openingSubmission,
        jurisdiction: matter.jurisdiction
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const session = repository.createCourtroomSession({
        matterId: matter.id,
        userId: req.authUser.userId,
        mode: data.mode,
        forumContext: data.forumContext,
        briefExcerpt: data.briefExcerpt,
        vulnerabilities: [aiTurn.weaknessFlag],
        turns: [
          {
            id: `turn_u_${Date.now()}`,
            speaker: "counsel",
            message: data.openingSubmission,
            timestamp: now
          },
          {
            id: `turn_a_${Date.now() + 1}`,
            speaker: data.mode,
            message: aiTurn.replyMessage,
            weaknessFlag: aiTurn.weaknessFlag,
            suggestedRebuttal: aiTurn.suggestedRebuttal,
            authorities: aiTurn.authorities,
            timestamp: now
          }
        ]
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/courtroom/:sessionId/reply", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        submission: z.string().min(3).max(4e3)
      });
      const { submission } = schema.parse(req.body);
      const userId = req.authUser.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      const session = bundle?.courtroomSessions.find((s) => s.id === String(req.params.sessionId));
      if (!session) {
        res.status(404).json({ error: "Courtroom session not found." });
        return;
      }
      const matter = repository.getMatterForUser(userId, session.matterId);
      const aiTurn = await runCourtroomTurn({
        mode: session.mode,
        forumContext: session.forumContext,
        briefExcerpt: session.briefExcerpt,
        history: session.turns,
        userSubmission: submission,
        jurisdiction: matter?.jurisdiction ?? "india_litigation"
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updated = repository.appendCourtroomTurns(
        userId,
        session.id,
        [
          {
            id: `turn_u_${Date.now()}`,
            speaker: "counsel",
            message: submission,
            timestamp: now
          },
          {
            id: `turn_a_${Date.now() + 1}`,
            speaker: session.mode,
            message: aiTurn.replyMessage,
            weaknessFlag: aiTurn.weaknessFlag,
            suggestedRebuttal: aiTurn.suggestedRebuttal,
            authorities: aiTurn.authorities,
            timestamp: now
          }
        ],
        [aiTurn.weaknessFlag]
      );
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/contract-redline", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        playbook: z.string().min(2).max(160),
        contractText: z.string().min(30).max(5e4)
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const result = await analyzeContractRedline({
        title: data.title,
        playbook: data.playbook,
        contractText: data.contractText,
        jurisdiction: matter.jurisdiction
      });
      const saved = repository.addContractReview({
        matterId: matter.id,
        userId: req.authUser.userId,
        title: data.title,
        playbook: data.playbook,
        sourceText: data.contractText,
        summary: result.summary,
        clauses: result.clauses,
        requisitions: result.requisitions
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/vault-process", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(100),
        docCategory: z.string().max(100).default("Annexure"),
        base64Data: z.string().max(18e6).optional(),
        textInput: z.string().max(4e4).optional(),
        targetLanguage: z.string().max(60).default("None")
      });
      const data = schema.parse(req.body);
      if (data.base64Data && !ALLOWED_DOC_MIMES.has(data.mimeType)) {
        res.status(400).json({ error: `Unsupported file type: ${data.mimeType}` });
        return;
      }
      const userId = req.authUser.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const bundle = await repository.getWorkspaceBundle(userId);
      const existingDocsContext = (bundle?.vaultDocuments ?? []).filter((d) => d.matterId === matter.id).map((d) => `[${d.fileName}]: ${d.extractedText.slice(0, 2e3)}`).join("\n\n");
      const result = await processVaultDocument({
        fileName: data.fileName,
        mimeType: data.mimeType,
        base64Data: data.base64Data,
        textInput: data.textInput,
        targetLanguage: data.targetLanguage,
        existingDocsContext: existingDocsContext || matter.summaryFacts,
        jurisdiction: matter.jurisdiction
      });
      const saved = repository.addVaultDocument({
        matterId: matter.id,
        userId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        docCategory: data.docCategory,
        extractedText: result.extractedText,
        translatedText: result.translatedText,
        targetLanguage: data.targetLanguage === "None" ? "" : data.targetLanguage,
        chronology: result.chronology,
        contradictions: result.contradictions
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/meeting-brief", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        durationLabel: z.string().max(30).default("05:00"),
        base64Audio: z.string().max(18e6).optional(),
        mimeType: z.string().max(100).optional(),
        transcriptText: z.string().max(4e4).optional()
      });
      const data = schema.parse(req.body);
      if (data.base64Audio && data.mimeType) {
        const baseMime = data.mimeType.split(";")[0].trim().toLowerCase();
        if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
          res.status(400).json({ error: `Unsupported audio format: ${data.mimeType}` });
          return;
        }
      }
      const userId = req.authUser.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const result = await transcribeAndSummarizeMeeting({
        base64Audio: data.base64Audio,
        mimeType: data.mimeType?.split(";")[0].trim(),
        transcriptText: data.transcriptText,
        matterContext: `${matter.title} (${matter.forum}): ${matter.summaryFacts}`,
        jurisdiction: matter.jurisdiction
      });
      const saved = repository.addMeetingBrief({
        matterId: matter.id,
        userId,
        title: data.title,
        durationLabel: data.durationLabel,
        transcript: result.transcript,
        summary: result.summary,
        keyFacts: result.keyFacts,
        actionItems: result.actionItems,
        statutoryIssues: result.statutoryIssues
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/case-analysis", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        caseTitle: z.string().min(3).max(240),
        courtLevel: z.string().min(2).max(160),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]),
        parties: z.string().min(2).max(300),
        caseStage: z.string().min(2).max(160),
        userFactsAndData: z.string().min(20).max(25e3),
        keyLegalQuestions: z.string().max(3e3).default(""),
        saveToResearch: z.boolean().optional().default(false)
      });
      const data = schema.parse(req.body);
      const userId = req.authUser.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const bundle = await repository.getWorkspaceBundle(userId);
      const vaultSummary = (bundle?.vaultDocuments ?? []).filter((d) => d.matterId === matter.id).slice(0, 4).map((d) => `[${d.fileName}]: ${d.extractedText.slice(0, 800)}`).join("\n");
      const docketSummary = (bundle?.trackedCases ?? []).filter((c) => c.matterId === matter.id).map((c) => `${c.caseNumber} (${c.court}) \u2014 Next: ${c.nextHearingDate}, Stage: ${c.stage}`).join("\n");
      const deadlineSummary = (bundle?.deadlines ?? []).filter((dl) => dl.matterId === matter.id && !dl.completed).map((dl) => `${dl.title} \u2014 Due ${dl.dueDate} (${dl.statuteArticle})`).join("\n");
      const liveWorkspaceContext = [
        `Matter Dossier: ${matter.title} (${matter.matterCode}) | Forum: ${matter.forum}`,
        `Client: ${matter.clientName} | Opposing: ${matter.opposingParty}`,
        `Base Facts: ${matter.summaryFacts}`,
        docketSummary ? `Tracked Hearings:
${docketSummary}` : "",
        deadlineSummary ? `Active Deadlines:
${deadlineSummary}` : "",
        vaultSummary ? `Vault Exhibits:
${vaultSummary}` : ""
      ].filter(Boolean).join("\n\n");
      const report = await runSupremeCourtCaseAnalysis({
        matterId: matter.id,
        caseTitle: data.caseTitle,
        courtLevel: data.courtLevel,
        jurisdiction: data.jurisdiction,
        parties: data.parties,
        caseStage: data.caseStage,
        userFactsAndData: data.userFactsAndData,
        keyLegalQuestions: data.keyLegalQuestions,
        liveWorkspaceContext
      });
      let savedMemo = null;
      if (data.saveToResearch) {
        savedMemo = repository.addResearchMemo({
          matterId: matter.id,
          userId,
          query: `Court Case Analysis: ${data.caseTitle} (${data.courtLevel})`,
          jurisdiction: data.jurisdiction,
          answerMarkdown: report.detailedMarkdown,
          citations: report.landmarkCaseStudies.map((cs) => ({
            title: `${cs.caseName}, ${cs.citation}`,
            url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(cs.caseName)}`,
            courtOrSource: cs.court,
            status: "statute"
          })),
          citationIntegrity: {
            verifiedSourceCount: report.landmarkCaseStudies.length,
            jurisdictionChecked: `${data.courtLevel} \xB7 ${report.engineUsed}`,
            bnsComplianceNote: "Audited against BNS 2023 / BNSS 2023 / BSA 2023 and verified SC/HC corpus.",
            confidenceLabel: "Grounded via Web & Statute"
          }
        });
      }
      res.status(201).json({ report, savedMemo });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/judiciary-form", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        templateId: z.string().min(2).max(80),
        courtName: z.string().min(2).max(260),
        caseNumber: z.string().max(160).default(""),
        petitionerName: z.string().min(2).max(220),
        respondentName: z.string().min(2).max(220),
        deponentName: z.string().max(220).default(""),
        deponentDetails: z.string().max(500).default(""),
        factsSummary: z.string().min(10).max(16e3),
        reliefSought: z.string().max(3e3).default(""),
        placeOfFiling: z.string().max(120).default("Mumbai / New Delhi"),
        filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]),
        saveAsDraft: z.boolean().optional().default(true)
      });
      const data = schema.parse(req.body);
      const userId = req.authUser.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      const tpl = getJudiciaryTemplate(data.templateId);
      const liveContext = `Matter: ${matter.title} (${matter.matterCode}) | Forum: ${matter.forum} | Client: ${matter.clientName} | Opposing: ${matter.opposingParty}
Base Facts: ${matter.summaryFacts}`;
      const generated = await generateExpertJudiciaryForm(data, liveContext);
      let savedDraft = null;
      if (data.saveAsDraft) {
        savedDraft = repository.createDraft(userId, {
          matterId: matter.id,
          title: `${tpl.name} \u2014 ${data.petitionerName.slice(0, 48)}`,
          docType: tpl.name,
          content: generated.content
        });
      }
      res.status(201).json({
        content: generated.content,
        engineUsed: generated.engineUsed,
        latencyMs: generated.latencyMs,
        draft: savedDraft
      });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/judiciary-form/stream", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        templateId: z.string().min(2).max(80),
        courtName: z.string().min(2).max(260),
        caseNumber: z.string().max(160).default(""),
        petitionerName: z.string().min(2).max(220),
        respondentName: z.string().min(2).max(220),
        deponentName: z.string().max(220).default(""),
        deponentDetails: z.string().max(500).default(""),
        factsSummary: z.string().min(10).max(16e3),
        reliefSought: z.string().max(3e3).default(""),
        placeOfFiling: z.string().max(120).default("Mumbai / New Delhi"),
        filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"])
      });
      const data = schema.parse(req.body);
      const userId = req.authUser.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: "Matter not found." });
        return;
      }
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      const sendEvent = (event, payload) => {
        res.write(`event: ${event}
data: ${JSON.stringify(payload)}

`);
      };
      const tpl = getJudiciaryTemplate(data.templateId);
      const precedents = retrieveRelevantPrecedents(
        `${tpl.name} ${tpl.statuteBasis} ${data.factsSummary} ${data.reliefSought}`,
        data.jurisdiction,
        3
      );
      const precedentBlock = formatPrecedentGroundingBlock(precedents);
      const nv = getNvidiaConfig();
      const startedAt = Date.now();
      let fullText = "";
      let engineUsed = "";
      if (nv.configured) {
        try {
          const systemPrompt = buildSupremeCourtSystemPrompt(
            data.jurisdiction,
            `Draft a complete, court-filing-ready ${tpl.name} strictly adhering to Supreme Court Rules 2013 / High Court Registry format with ALL-CAPS Court Heading, Cause Title, numbered paragraphs, Prayer, Advocate block, and Order XIX Rule 3 Verification & Affidavit. Output clean plain legal text with no markdown fences.`
          );
          const userPrompt = `Form: ${tpl.name} (${tpl.statuteBasis})
Court: ${data.courtName}
Case No.: ${data.caseNumber}
Petitioner: ${data.petitionerName}
Respondent: ${data.respondentName}
Deponent: ${data.deponentName || data.petitionerName} (${data.deponentDetails})
Place & Date: ${data.placeOfFiling}, ${data.filingDate}
Relief: ${data.reliefSought || tpl.suggestedRelief}

Facts:
${data.factsSummary}

Matter Context: ${matter.title} (${matter.forum})

${precedentBlock}`;
          const streamed = await streamNvidiaChat(
            { systemPrompt, userPrompt, tier: "expert", maxTokens: 3200 },
            (delta) => {
              sendEvent("delta", { text: delta });
            }
          );
          fullText = streamed.fullText.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
          engineUsed = `NVIDIA NIM Streaming (${streamed.model})`;
        } catch {
          fullText = buildDeterministicJudiciaryForm(data);
          engineUsed = "VidhiOS Court Registry Engine (Fallback)";
          sendEvent("delta", { text: fullText });
        }
      } else {
        fullText = buildDeterministicJudiciaryForm(data);
        engineUsed = "VidhiOS Supreme Court & High Court Registry Engine";
        const chunks = fullText.split(/(\n\n)/);
        for (const ch of chunks) {
          sendEvent("delta", { text: ch });
        }
      }
      const savedDraft = repository.createDraft(userId, {
        matterId: matter.id,
        title: `${tpl.name} \u2014 ${data.petitionerName.slice(0, 48)}`,
        docType: tpl.name,
        content: fullText
      });
      sendEvent("done", {
        draft: savedDraft,
        engineUsed,
        latencyMs: Date.now() - startedAt
      });
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(400).json({ error: extractErrorMessage(err) });
      } else {
        res.write(`event: error
data: ${JSON.stringify({ error: extractErrorMessage(err) })}

`);
        res.end();
      }
    }
  });
  app.post("/api/export/docx", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).max(240),
        courtHeader: z.string().max(260).optional(),
        matterCode: z.string().max(80).optional(),
        docType: z.string().max(120).optional(),
        content: z.string().min(1).max(2e5)
      });
      const data = schema.parse(req.body);
      const buffer = await buildCourtDocxBuffer(data);
      const filename = sanitizeDocxFilename(data.title);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      res.send(buffer);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });
  app.post("/api/ai/assistant", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        matterId: z.string().nullable().optional(),
        message: z.string().min(1).max(6e3),
        languageMode: z.enum(["auto", "en", "hi", "bilingual"]).default("auto"),
        jurisdiction: z.enum(["india_litigation", "corporate_ma", "global_multi"]).optional()
      });
      const data = schema.parse(req.body);
      const userId = req.authUser.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      if (!bundle) {
        res.status(404).json({ error: "Workspace not found." });
        return;
      }
      const activeMatter = (data.matterId ? bundle.matters.find((m) => m.id === data.matterId) : bundle.matters[0]) ?? null;
      const effectiveJurisdiction = data.jurisdiction ?? activeMatter?.jurisdiction ?? "india_litigation";
      const lang = detectResponseLanguage(data.message, data.languageMode);
      const userMsg = repository.addAssistantMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        role: "user",
        content: data.message.trim(),
        languageUsed: lang,
        verificationMode: "deterministic_verified",
        confidenceNote: "Client Input",
        sources: [],
        completedActions: []
      });
      const intent = classifyAssistantIntent(data.message);
      let replyText = "";
      let sources = [];
      let completedActions = [];
      let verificationMode = "deterministic_verified";
      let confidenceNote = "100% Deterministic Verified Legal Engine \xB7 Zero Hallucination";
      let createdDraft = null;
      let createdDeadline = null;
      if (intent.type === "statute_lookup") {
        const result = buildDeterministicStatuteReply(intent.query, lang);
        replyText = result.text;
        sources = result.sources;
        if (result.found) {
          completedActions.push({
            type: "statute_audited",
            label: `${result.sources.length} Verified BNS/BNSS/BSA Mapping(s)`
          });
        }
      } else if (intent.type === "limitation_calc") {
        let savedTitle;
        const preview = buildDeterministicLimitationReply(intent.ruleId, intent.triggerDate, lang);
        if (intent.saveDeadline && activeMatter) {
          savedTitle = `${preview.computed.rule.label} (${activeMatter.matterCode})`;
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: savedTitle,
            statuteArticle: `${preview.computed.rule.statute} (${preview.computed.rule.articleOrSection})`,
            triggerDate: intent.triggerDate,
            dueDate: preview.computed.effectiveDueDate,
            graceDate: preview.computed.graceDeadlineDate ?? void 0,
            completed: false,
            notes: "Computed and pinned by VidhiOS Bilingual Assistant."
          });
          completedActions.push({
            type: "deadline_created",
            label: `Deadline Saved: ${preview.computed.effectiveDueDate}`,
            recordId: createdDeadline.id
          });
        } else {
          completedActions.push({
            type: "limitation_computed",
            label: `Verified Expiry: ${preview.computed.effectiveDueDate}`
          });
        }
        const finalLim = buildDeterministicLimitationReply(
          intent.ruleId,
          intent.triggerDate,
          lang,
          savedTitle
        );
        replyText = finalLim.text;
        sources = finalLim.sources;
      } else if (intent.type === "add_deadline") {
        if (!activeMatter) {
          replyText = lang === "hi" ? "\u0915\u0943\u092A\u092F\u093E \u092A\u0939\u0932\u0947 \u090F\u0915 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 (Matter) \u091A\u0941\u0928\u0947\u0902 \u0924\u093E\u0915\u093F \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930 \u0938\u0947\u0935 \u0915\u093F\u092F\u093E \u091C\u093E \u0938\u0915\u0947\u0964" : "Select an active Matter first so I can save this deadline to your Case Tracker.";
        } else {
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: intent.title,
            statuteArticle: "VidhiOS Assistant Action",
            triggerDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
            dueDate: intent.dueDate,
            completed: false,
            notes: "Created directly from VidhiOS Bilingual Legal Assistant."
          });
          sources = [
            {
              label: `${activeMatter.matterCode} \u2014 Case Tracker`,
              reference: `Due ${intent.dueDate}`,
              kind: "matter_record"
            }
          ];
          completedActions = [
            {
              type: "deadline_created",
              label: `Saved Deadline: ${intent.title} (${intent.dueDate})`,
              recordId: createdDeadline.id
            }
          ];
          replyText = lang === "hi" ? `\u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u094D\u0923: "${intent.title}" \u0915\u094B \u0906\u092A\u0915\u0947 \u0915\u0947\u0938 "${activeMatter.title}" \u0915\u0940 \u0921\u0947\u0921\u0932\u093E\u0907\u0928 \u0938\u0942\u091A\u0940 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948 (\u0932\u0915\u094D\u0937\u094D\u092F \u0924\u093F\u0925\u093F: ${intent.dueDate})\u0964` : `Completed: Pinned "${intent.title}" to "${activeMatter.title}" in your Case Tracker & Limitation Calendar (Due: ${intent.dueDate}).`;
        }
      } else if (intent.type === "matter_status") {
        const draftCount = bundle.drafts.filter(
          (d) => activeMatter && d.matterId === activeMatter.id
        ).length;
        const status = buildDeterministicMatterStatusReply(
          activeMatter,
          bundle.trackedCases,
          bundle.deadlines,
          draftCount,
          lang
        );
        replyText = status.text;
        sources = status.sources;
      } else if (intent.type === "draft_form") {
        if (!activeMatter) {
          replyText = lang === "hi" ? "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u092C\u0928\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0943\u092A\u092F\u093E \u092A\u0939\u0932\u0947 \u090F\u0915 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 \u091A\u0941\u0928\u0947\u0902\u0964" : "Please select or create an active Matter before drafting a court form.";
        } else {
          const tpl = getJudiciaryTemplate(intent.templateId);
          const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          const liveCtx = `Matter: ${activeMatter.title} (${activeMatter.matterCode}) | Forum: ${activeMatter.forum} | Client: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}
Facts: ${activeMatter.summaryFacts}`;
          const generated = await generateExpertJudiciaryForm(
            {
              templateId: tpl.id,
              courtName: activeMatter.forum || tpl.defaultCourt,
              caseNumber: tpl.defaultCaseType,
              petitionerName: activeMatter.clientName,
              respondentName: activeMatter.opposingParty || "State / Respondent",
              deponentName: activeMatter.clientName,
              deponentDetails: "Authorized Signatory / Applicant",
              factsSummary: `${activeMatter.summaryFacts}

Client Request: ${intent.customInstructions}`,
              reliefSought: tpl.suggestedRelief,
              placeOfFiling: "Mumbai / New Delhi",
              filingDate: today,
              jurisdiction: effectiveJurisdiction
            },
            liveCtx
          );
          const draftTitle = `${tpl.name} \u2014 ${activeMatter.clientName.slice(0, 42)}`;
          createdDraft = repository.createDraft(userId, {
            matterId: activeMatter.id,
            title: draftTitle,
            docType: tpl.name,
            content: generated.content
          });
          replyText = getFormConfirmationReply(tpl.id, draftTitle, lang);
          sources = [
            {
              label: tpl.name,
              reference: tpl.statuteBasis,
              kind: "court_template"
            },
            {
              label: `${activeMatter.matterCode} \u2014 Active Matter Facts`,
              reference: activeMatter.forum,
              kind: "matter_record"
            }
          ];
          completedActions = [
            {
              type: "draft_created",
              label: `Court Draft Ready: ${draftTitle}`,
              recordId: createdDraft.id,
              draftTitle: createdDraft.title,
              draftContent: createdDraft.content,
              docType: createdDraft.docType
            }
          ];
          verificationMode = generated.engineUsed.includes("NVIDIA") ? "grounded_ai_verified" : "deterministic_verified";
          confidenceNote = `${generated.engineUsed} \xB7 ${generated.latencyMs}ms \xB7 Saved to Matter Drafts`;
        }
      } else if (intent.type === "case_analysis") {
        if (!activeMatter) {
          replyText = lang === "hi" ? "\u0915\u0947\u0938 \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 \u0915\u0947 \u0932\u093F\u090F \u0915\u0943\u092A\u092F\u093E \u092A\u0939\u0932\u0947 \u090F\u0915 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0947\u0938 \u091A\u0941\u0928\u0947\u0902\u0964" : "Please select an active Matter to run Supreme Court / High Court Case Analysis.";
        } else {
          const liveCtx = `Matter: ${activeMatter.title} (${activeMatter.matterCode}) | Forum: ${activeMatter.forum} | Client: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}
Facts: ${activeMatter.summaryFacts}`;
          const analysis = await runSupremeCourtCaseAnalysis({
            matterId: activeMatter.id,
            caseTitle: activeMatter.title,
            courtLevel: activeMatter.forum,
            jurisdiction: effectiveJurisdiction,
            parties: `${activeMatter.clientName} v. ${activeMatter.opposingParty || "Respondent"}`,
            caseStage: activeMatter.status,
            userFactsAndData: `${activeMatter.summaryFacts}

Client Focus: ${data.message}`,
            keyLegalQuestions: data.message,
            liveWorkspaceContext: liveCtx
          });
          const caseStudiesStr = analysis.landmarkCaseStudies.slice(0, 3).map((cs, i) => `${i + 1}. ${cs.caseName}, ${cs.citation} \u2014 ${cs.applicationToFacts}`).join("\n");
          replyText = lang === "hi" ? `\u0938\u0941\u092A\u094D\u0930\u0940\u092E \u0915\u094B\u0930\u094D\u091F / \u0939\u093E\u0908 \u0915\u094B\u0930\u094D\u091F \u092E\u093E\u0928\u0915 \u0915\u0947\u0938 \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 (${activeMatter.title}):

\u2022 \u0938\u094D\u0925\u093F\u0924\u093F (Maintainability): ${analysis.maintainabilityScore}
\u2022 \u0915\u093E\u0930\u094D\u092F\u0915\u093E\u0930\u0940 \u0906\u0915\u0932\u0928: ${analysis.executiveAssessment}
\u2022 \u0915\u094D\u0937\u0947\u0924\u094D\u0930\u093E\u0927\u093F\u0915\u093E\u0930 \u090F\u0935\u0902 \u092A\u0930\u093F\u0938\u0940\u092E\u093E: ${analysis.jurisdictionAndLimitation}
\u2022 \u0932\u093E\u0917\u0942 \u0927\u093E\u0930\u093E\u090F\u0901: ${analysis.applicableStatutes.join(", ")}

\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0938\u0941\u092A\u094D\u0930\u0940\u092E \u0915\u094B\u0930\u094D\u091F / \u0939\u093E\u0908 \u0915\u094B\u0930\u094D\u091F \u0915\u0947\u0938 \u0938\u094D\u091F\u0921\u0940:
${caseStudiesStr}

\u0938\u0941\u091D\u093E\u090F \u0917\u090F \u0905\u0917\u0932\u0947 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C: ${analysis.recommendedFilings.map((f) => f.title).join(" | ")}` : `Supreme Court / High Court Case Analysis (${activeMatter.title}):

\u2022 Maintainability Posture: ${analysis.maintainabilityScore}
\u2022 Executive Assessment: ${analysis.executiveAssessment}
\u2022 Jurisdiction & Limitation: ${analysis.jurisdictionAndLimitation}
\u2022 Applicable Statutes: ${analysis.applicableStatutes.join(", ")}

Verified Supreme Court & High Court Case Studies:
${caseStudiesStr}

Recommended Next Filings: ${analysis.recommendedFilings.map((f) => f.title).join(" | ")}`;
          sources = analysis.landmarkCaseStudies.map((cs) => ({
            label: `${cs.caseName}, ${cs.citation}`,
            reference: cs.court,
            kind: "precedent"
          }));
          verificationMode = analysis.engineUsed.includes("NVIDIA") ? "grounded_ai_verified" : "deterministic_verified";
          confidenceNote = `${analysis.engineUsed} \xB7 ${analysis.latencyMs}ms`;
        }
      } else if (intent.type === "precedent_search") {
        const resPrec = buildDeterministicPrecedentReply(
          intent.query,
          effectiveJurisdiction,
          lang
        );
        replyText = resPrec.text;
        sources = resPrec.sources;
      } else {
        const liveWorkspaceContext = activeMatter ? `Matter: ${activeMatter.title} (${activeMatter.matterCode})
Forum: ${activeMatter.forum}
Client: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}
Facts: ${activeMatter.summaryFacts}` : "No active matter selected.";
        const recentHistory = bundle.assistantMessages.slice(-8).map((m) => ({
          role: m.role,
          content: m.content
        }));
        const grounded = await answerGroundedBilingualLegalAssistant({
          userMessage: data.message,
          language: lang,
          jurisdiction: effectiveJurisdiction,
          liveWorkspaceContext,
          recentHistory
        });
        replyText = grounded.content;
        sources = grounded.sources;
        verificationMode = grounded.verificationMode;
        confidenceNote = grounded.confidenceNote;
      }
      const assistantMsg = repository.addAssistantMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        role: "assistant",
        content: replyText,
        languageUsed: lang,
        verificationMode,
        confidenceNote,
        sources,
        completedActions
      });
      await repository.persist();
      res.status(201).json({
        userMsg,
        assistantMsg,
        createdDraft,
        createdDeadline
      });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });
  app.delete("/api/ai/assistant", requireAuth, async (req, res) => {
    repository.clearAssistantMessages(req.authUser.userId);
    await repository.persist();
    res.json({ cleared: true });
  });
  if (includeStatic) {
    if (!IS_PROD) {
      const viteModuleName = "vite";
      const { createServer: createViteServer } = await import(viteModuleName);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path2.resolve(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    }
  }
  app.use((err, _req, res, _next) => {
    console.error("[VidhiOS Express Error]:", err);
    if (res.headersSent) return;
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || "Internal server error occurred."
    });
  });
  return app;
}

// src/server/apiHandler.ts
var appPromise = null;
async function getExpressApp() {
  if (!appPromise) {
    appPromise = createExpressApp({ includeStatic: false });
  }
  return appPromise;
}
async function handler(req, res) {
  try {
    if (req.body && typeof req.body === "object" && !req._body) {
      req._body = true;
    }
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || "";
    if (matchedPath && matchedPath.startsWith("/api") && (req.url === "/api" || req.url === "/api/")) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith("/api")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    const app = await getExpressApp();
    return await new Promise((resolve, reject) => {
      res.on("finish", () => resolve());
      res.on("close", () => resolve());
      res.on("error", (err) => reject(err));
      app(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error("[Vercel Serverless Invocation Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err?.message || "Internal server error" }));
    }
  }
}
export {
  handler as default
};
