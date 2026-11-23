import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeterministicLimitationReply,
  buildDeterministicMatterStatusReply,
  buildDeterministicPrecedentReply,
  buildDeterministicStatuteReply,
  classifyAssistantIntent,
  detectResponseLanguage,
  getFormConfirmationReply,
} from './assistantEngine';
import type { DeadlineItem, Matter, TrackedCase } from '../../types/legal';

test('detectResponseLanguage respects explicit overrides and detects Devanagari Hindi / Hinglish / English', () => {
  assert.equal(detectResponseLanguage('Hello there', 'hi'), 'hi');
  assert.equal(detectResponseLanguage('नमस्ते वकील साहब', 'en'), 'en');
  assert.equal(detectResponseLanguage('Anything', 'bilingual'), 'bilingual');

  assert.equal(detectResponseLanguage('धारा 420 IPC का नया सेक्शन क्या है?', 'auto'), 'hi');
  assert.equal(detectResponseLanguage('420 IPC ka naya section batao', 'auto'), 'bilingual');
  assert.equal(detectResponseLanguage('Draft an Anticipatory Bail Application under 482 BNSS', 'auto'), 'en');
});

test('classifyAssistantIntent accurately routes Hindi and English legal tasks', () => {
  const bsaHindi = classifyAssistantIntent('मेरे इस केस के लिए Section 63 BSA एफिडेविट तैयार करें');
  assert.equal(bsaHindi.type, 'draft_form');
  if (bsaHindi.type === 'draft_form') {
    assert.equal(bsaHindi.templateId, 'sec_63_bsa_certificate');
  }

  const vakalatHindi = classifyAssistantIntent('वकालतनामा बनाओ');
  assert.equal(vakalatHindi.type, 'draft_form');
  if (vakalatHindi.type === 'draft_form') {
    assert.equal(vakalatHindi.templateId, 'vakalatnama');
  }

  const bailEn = classifyAssistantIntent('Draft an Anticipatory Bail Application under Section 482 BNSS');
  assert.equal(bailEn.type, 'draft_form');
  if (bailEn.type === 'draft_form') {
    assert.equal(bailEn.templateId, 'anticipatory_bail_482_bnss');
  }

  const statuteHi = classifyAssistantIntent('धारा 420 IPC और 438 CrPC के नए BNS सेक्शन बताओ');
  assert.equal(statuteHi.type, 'statute_lookup');

  const limEn = classifyAssistantIntent('Calculate Arbitration Section 34 limitation from 2026-10-01 and save deadline');
  assert.equal(limEn.type, 'limitation_calc');
  if (limEn.type === 'limitation_calc') {
    assert.equal(limEn.ruleId, 'arb_sec_34');
    assert.equal(limEn.triggerDate, '2026-10-01');
    assert.equal(limEn.saveDeadline, true);
  }

  const rem = classifyAssistantIntent('Add deadline File Rejoinder Affidavit by 2026-11-15');
  assert.equal(rem.type, 'add_deadline');
  if (rem.type === 'add_deadline') {
    assert.equal(rem.dueDate, '2026-11-15');
  }

  assert.equal(classifyAssistantIntent('मेरा केस स्टेटस और अगली सुनवाई बताओ').type, 'matter_status');
  assert.equal(classifyAssistantIntent('Analyze my active case with verified precedents').type, 'case_analysis');
});

test('buildDeterministicStatuteReply returns exact verified BNS/BNSS mappings and refuses unknown sections without hallucinating', () => {
  const hiReply = buildDeterministicStatuteReply('धारा 420 IPC और 438 CrPC', 'hi');
  assert.equal(hiReply.found, true);
  assert.match(hiReply.text, /BNS धारा 318\(4\)/);
  assert.match(hiReply.text, /BNSS धारा 482/);
  assert.ok(hiReply.sources.some((s) => s.label.includes('IPC 420 → BNS 318(4)')));

  const unknownHi = buildDeterministicStatuteReply('IPC 999999', 'hi');
  assert.equal(unknownHi.found, false);
  assert.match(unknownHi.text, /\[सत्यापन आवश्यक\]/);

  const unknownEn = buildDeterministicStatuteReply('IPC 999999', 'en');
  assert.equal(unknownEn.found, false);
  assert.match(unknownEn.text, /\[Verification Required\]/);
});

test('buildDeterministicLimitationReply computes exact Arbitration Sec. 34 dates in Hindi and English', () => {
  const en = buildDeterministicLimitationReply('arb_sec_34', '2026-10-01', 'en', 'Arbitration Sec. 34 Filing');
  assert.equal(en.computed.effectiveDueDate, '2027-01-01');
  assert.match(en.text, /2027-01-01/);
  assert.match(en.text, /Action Completed/);

  const hi = buildDeterministicLimitationReply('arb_sec_34', '2026-10-01', 'hi', 'मध्यस्थता धारा 34');
  assert.equal(hi.computed.effectiveDueDate, '2027-01-01');
  assert.match(hi.text, /सत्यापित परिसीमा गणना/);
  assert.match(hi.text, /कार्य पूर्ण/);
});

test('buildDeterministicMatterStatusReply, precedent lookup, and form confirmation stay strictly grounded', () => {
  const sampleMatter: Matter = {
    id: 'm1',
    userId: 'u1',
    matterCode: 'DHC-2026-01',
    title: 'Sharma Infra v. Metro Corp',
    forum: 'Delhi High Court',
    clientName: 'Sharma Infra Pvt. Ltd.',
    opposingParty: 'Metro Corp Ltd.',
    jurisdiction: 'india_litigation',
    status: 'active',
    summaryFacts: 'Commercial dispute over EPC milestone payment.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const sampleCases: TrackedCase[] = [
    {
      id: 'c1',
      userId: 'u1',
      matterId: 'm1',
      cnrNumber: 'DLHC010012342026',
      caseNumber: 'OMP (COMM) 44/2026',
      court: 'Delhi High Court',
      bench: 'Hon. Commercial Bench',
      nextHearingDate: '2026-11-30',
      courtroom: 'Court No. 12',
      causeListItem: 'Item 14',
      stage: 'Final Arguments',
      status: 'listed',
      notes: 'Ready for arguments.',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const sampleDeadlines: DeadlineItem[] = [
    {
      id: 'd1',
      userId: 'u1',
      matterId: 'm1',
      title: 'File Rejoinder Affidavit',
      triggerDate: '2026-10-01',
      dueDate: '2026-11-15',
      statuteArticle: 'Commercial Courts Act',
      completed: false,
      notes: 'Draft verified.',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const statusHi = buildDeterministicMatterStatusReply(sampleMatter, sampleCases, sampleDeadlines, 2, 'hi');
  assert.match(statusHi.text, /Sharma Infra v\. Metro Corp/);
  assert.match(statusHi.text, /OMP \(COMM\) 44\/2026/);
  assert.match(statusHi.text, /File Rejoinder Affidavit/);

  const prec = buildDeterministicPrecedentReply('anticipatory bail 482 bnss', 'india_litigation', 'en');
  assert.ok(prec.sources.length > 0);
  assert.match(prec.text, /Verified Supreme Court & High Court Authorities/);

  const conf = getFormConfirmationReply('sec_63_bsa_certificate', 'BSA Certificate — DHC-2026-01', 'hi');
  assert.match(conf, /\.DOCX/);
});
