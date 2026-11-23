import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeterministicJudiciaryForm,
  JUDICIARY_FORM_TEMPLATES,
} from './judiciaryTemplates';

test('ships at least 12 distinct Indian Supreme Court / High Court / BNSS judiciary templates', () => {
  assert.ok(JUDICIARY_FORM_TEMPLATES.length >= 12);
  const ids = new Set(JUDICIARY_FORM_TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, JUDICIARY_FORM_TEMPLATES.length);
});

test('builds court-ready Section 63 BSA certificate with Schedule Part A & Part B and deponent details', () => {
  const output = buildDeterministicJudiciaryForm({
    templateId: 'sec_63_bsa_certificate',
    courtName: 'In the High Court of Judicature at Bombay',
    caseNumber: 'ABA NO. 102 OF 2026',
    petitionerName: 'Arjun Malhotra',
    respondentName: 'State of Maharashtra',
    deponentName: 'Arjun Malhotra',
    deponentDetails: 'aged 41 years, Managing Director, Mumbai',
    factsSummary: 'WhatsApp chat exports and audited bank ledger emails dated 14 March 2025.',
    reliefSought: 'Admit electronic records into evidence.',
    placeOfFiling: 'Mumbai',
    filingDate: '2026-11-21',
    jurisdiction: 'india_litigation',
  });

  assert.ok(output.includes('IN THE HIGH COURT OF JUDICATURE AT BOMBAY'));
  assert.ok(output.includes('SECTION 63(4) OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023'));
  assert.ok(output.includes('PART B — TECHNICAL EXPERT CERTIFICATION'));
  assert.ok(output.includes('Arjun Panditrao Khotkar'));
  assert.ok(output.includes('VERIFICATION'));
});

test('builds standard Vakalatnama with executant and advocate acceptance block', () => {
  const output = buildDeterministicJudiciaryForm({
    templateId: 'vakalatnama',
    courtName: 'In the Hon’ble Supreme Court of India',
    caseNumber: 'SLP (C) NO. 4412 OF 2026',
    petitionerName: 'Apex Energy Infra Pvt. Ltd.',
    respondentName: 'Union of India',
    deponentName: 'Vikram Rao',
    deponentDetails: 'Authorized Representative',
    factsSummary: 'Special Leave Petition against High Court Division Bench judgment.',
    reliefSought: 'Appoint Counsel.',
    placeOfFiling: 'New Delhi',
    filingDate: '2026-11-21',
    jurisdiction: 'india_litigation',
  });

  assert.ok(output.includes('VAKALATNAMA'));
  assert.ok(output.includes('Order III Rule 4 CPC'));
  assert.ok(output.includes('Apex Energy Infra Pvt. Ltd.'));
  assert.ok(output.includes('EXECUTANT / CLIENT'));
});
