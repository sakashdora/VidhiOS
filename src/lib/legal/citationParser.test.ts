import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLegalCitations } from './citationParser';
import type { VerifiedCitation } from '../../types/legal';

const SEEDED_MEMO_SAMPLE = `### Executive Conclusion
Indian Supreme Court precedent consistently deprecates converting civil or contractual disputes into criminal prosecutions for cheating (**Section 318(4) BNS**, formerly Section 420 IPC) or criminal breach of trust (**Section 316(2) BNS**, formerly Section 406 IPC) unless dishonest intention existed **at the very inception** of the transaction.

### Controlling Precedents
1. **Lalit Chaturvedi & Ors. v. State of Uttar Pradesh (2024 SCC OnLine SC 171)** — Mere breach of contract or unpaid commercial dues does not constitute cheating or criminal breach of trust.
2. **Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh (2024 INSC 626)** — Clarified that cheating and criminal breach of trust are antithetical.
3. **Arnesh Kumar v. State of Bihar (2014) 8 SCC 273** (now codified in **Section 35(3) BNSS**) — Mandatory written reasons before arrest for offences punishable up to 7 years.`;

test('detects all cases and statutes in the seeded research memo and reconstructs text losslessly', () => {
  const grounded: VerifiedCitation[] = [
    {
      title: 'Delhi Race Club (1940) Ltd. v. State of Uttar Pradesh — Supreme Court of India (2024)',
      url: 'https://main.sci.gov.in/',
      courtOrSource: 'Supreme Court of India',
      status: 'verified_web',
    },
  ];

  const result = parseLegalCitations(SEEDED_MEMO_SAMPLE, grounded);

  const reconstructed = result.segments
    .map((seg) => (seg.type === 'text' ? seg.text : seg.citation.matchedText))
    .join('');
  assert.equal(reconstructed, SEEDED_MEMO_SAMPLE);

  const caseTitles = result.uniqueCases.map((c) => c.canonicalTitle);
  assert.ok(caseTitles.some((t) => t.includes('Lalit Chaturvedi')));
  assert.ok(caseTitles.some((t) => t.includes('Delhi Race Club')));
  assert.ok(caseTitles.some((t) => t.includes('Arnesh Kumar')));

  const statuteTitles = result.uniqueStatutes.map((s) => s.canonicalTitle);
  assert.ok(statuteTitles.includes('Section 318(4) BNS'));
  assert.ok(statuteTitles.includes('Section 420 IPC'));
  assert.ok(statuteTitles.includes('Section 316(2) BNS'));
  assert.ok(statuteTitles.includes('Section 406 IPC'));
  assert.ok(statuteTitles.includes('Section 35(3) BNSS'));

  const delhiRace = result.uniqueCases.find((c) => c.canonicalTitle.includes('Delhi Race Club'));
  assert.ok(delhiRace);
  assert.equal(delhiRace.verificationTier, 'verified_corpus');
  assert.ok(delhiRace.summary.toLowerCase().includes('antithetical'));
  assert.ok(delhiRace.links.some((l) => l.label === 'Verified Source' && l.url === 'https://main.sci.gov.in/'));

  const lalit = result.uniqueCases.find((c) => c.canonicalTitle.includes('Lalit Chaturvedi'));
  assert.ok(lalit);
  assert.equal(lalit.links.some((l) => l.label === 'Verified Source'), false);
});

test('resolves bidirectional BNS/BNSS/BSA and IPC/CrPC/IEA statute crosswalks', () => {
  const text = 'Relief under Section 482 BNSS (earlier u/s 438 CrPC) and electronic certificate under Section 63 BSA / Section 65B IEA.';
  const result = parseLegalCitations(text);

  const bnss482 = result.citations.find((c) => c.matchedText === 'Section 482 BNSS');
  assert.ok(bnss482);
  assert.equal(bnss482.kind, 'statute');
  assert.equal(bnss482.verificationTier, 'statute_crosswalk');
  assert.ok(bnss482.crosswalkLabel?.includes('438 CrPC'));

  const crpc438 = result.citations.find((c) => c.matchedText === 'u/s 438 CrPC');
  assert.ok(crpc438);
  assert.ok(crpc438.crosswalkLabel?.includes('482 BNSS'));

  const bsa63 = result.citations.find((c) => c.matchedText === 'Section 63 BSA');
  assert.ok(bsa63);
  assert.ok(bsa63.subtitle.toLowerCase().includes('electronic records'));
  assert.ok(bsa63.links.some((l) => l.url.includes('indiacode.nic.in')));
});

test('detects constitutional articles, commercial acts, CPC orders, and New York Convention', () => {
  const text =
    'Writ maintainability under Article 226 and Article 21, indemnity cap under Section 73 Indian Contract Act, enforcement under Section 48 Arbitration & Conciliation Act and Article V(2)(b) New York Convention, plus Order XIX Rule 3 CPC verification.';
  const result = parseLegalCitations(text);

  const titles = result.uniqueStatutes.map((s) => s.canonicalTitle);
  assert.ok(titles.includes('Article 226, Constitution of India'));
  assert.ok(titles.includes('Article 21, Constitution of India'));
  assert.ok(titles.includes('Section 73, Indian Contract Act, 1872'));
  assert.ok(titles.includes('Section 48, Arbitration and Conciliation Act, 1996'));
  assert.ok(titles.includes('Article V(2)(b), New York Convention, 1958'));
  assert.ok(titles.includes('Order XIX Rule 3, Code of Civil Procedure, 1908'));
});

test('matches international precedents and safely links unindexed cases without fabricating summaries', () => {
  const text =
    'Compare Cavendish Square Holding BV v. Talal El Makdessi [2015] UKSC 67 with Acme Solar Pvt. Ltd. v. Zenith Energy Corp. (2025 SCC OnLine Del 912).';
  const grounded: VerifiedCitation[] = [
    {
      title: 'Acme Solar Pvt. Ltd. v. Zenith Energy Corp. — Delhi High Court',
      url: 'https://delhihighcourt.nic.in/case/912',
      courtOrSource: 'Delhi High Court',
      status: 'verified_web',
    },
    {
      title: 'Malicious Link Case',
      url: 'javascript:alert(1)',
      courtOrSource: 'Untrusted',
      status: 'caution',
    },
  ];

  const result = parseLegalCitations(text, grounded);
  const cavendish = result.uniqueCases.find((c) => c.canonicalTitle.includes('Cavendish'));
  assert.ok(cavendish);
  assert.equal(cavendish.verificationTier, 'verified_corpus');
  assert.ok(cavendish.subtitle.includes('Supreme Court of the United Kingdom'));

  const acme = result.uniqueCases.find((c) => c.canonicalTitle.includes('Acme Solar'));
  assert.ok(acme);
  assert.equal(acme.verificationTier, 'grounded_source');
  assert.equal(acme.citationRef, '(2025 SCC OnLine Del 912)');
  assert.ok(acme.links.some((l) => l.url === 'https://delhihighcourt.nic.in/case/912'));
  assert.ok(acme.links.every((l) => l.url.startsWith('https://')));
});

test('never produces overlapping spans or false positives on ordinary prose', () => {
  const text = 'Plain commercial summary with no case names or statutory citations at all.';
  const result = parseLegalCitations(text);
  assert.equal(result.citations.length, 0);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].type, 'text');
});
