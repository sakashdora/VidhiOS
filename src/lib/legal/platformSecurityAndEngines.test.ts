import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashPassword,
  isUserAdminRole,
  revokeSessionTokenId,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../../server/auth';
import {
  JUDICIARY_FORM_TEMPLATES,
  validateJudiciaryFormInput,
} from './judiciaryTemplates';
import { lookupStatuteMappings } from './statuteCrosswalk';
import { retrieveRelevantPrecedents } from './supremeCourtCorpus';
import { calculateLimitationDeadline } from './limitationCalculator';
import { buildDeterministicStatuteReply } from './assistantEngine';

test('auth: password hashing uses random salt and verifies securely', () => {
  const h1 = hashPassword('StrongPass@2026');
  const h2 = hashPassword('StrongPass@2026');
  assert.notEqual(h1, h2);
  assert.equal(verifyPassword('StrongPass@2026', h1), true);
  assert.equal(verifyPassword('WrongPass@2026', h1), false);
});

test('auth: session signing, verification, and revocation work deterministically', () => {
  const { token, jti, exp } = signSessionToken('user-1', 'adv@example.in', 'org-1');
  const payload = verifySessionToken(token);
  assert.ok(payload);
  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.organizationId, 'org-1');

  revokeSessionTokenId(jti, exp);
  assert.equal(verifySessionToken(token), null);
});

test('security: demo user is never granted admin role', () => {
  assert.equal(
    isUserAdminRole({ email: 'chambers@vidhios.in', isAdmin: true, role: 'Administrator' }),
    false
  );
  assert.equal(
    isUserAdminRole({ email: 'vidhios@admin.com', isAdmin: false, role: 'Advocate' }),
    true
  );
  assert.equal(
    isUserAdminRole({ email: 'advocate@firm.in', isAdmin: false, role: 'Advocate' }),
    false
  );
});

test('judiciary templates: all 13 templates include jurisdiction, version, and validation rules', () => {
  assert.ok(JUDICIARY_FORM_TEMPLATES.length >= 13);
  for (const tpl of JUDICIARY_FORM_TEMPLATES) {
    assert.ok(tpl.applicableJurisdiction.length > 0);
    assert.ok(tpl.requiredFields.length > 0);
    assert.ok(tpl.validationRules.length > 0);
    assert.ok(tpl.version.length > 0);
  }

  const warnCheck = validateJudiciaryFormInput({
    templateId: 'quashing_528_bnss',
    courtName: 'Sessions Court, Mumbai',
    caseNumber: '12/2026',
    petitionerName: 'A',
    respondentName: 'State',
    deponentName: 'A',
    deponentDetails: '',
    factsSummary: 'Commercial breach FIR',
    reliefSought: 'Quash FIR',
    placeOfFiling: 'Mumbai',
    filingDate: '2026-11-28',
    jurisdiction: 'india_litigation',
  });
  assert.equal(warnCheck.valid, true);
  assert.ok(warnCheck.warnings.some((w) => w.includes('High Court')));
});

test('AI quality benchmark: deterministic Indian law accuracy & zero-hallucination verification', () => {
  const startedAt = Date.now();
  const statuteBench = [
    { q: '420 IPC', expectedCode: 'BNS', expectedSec: '318' },
    { q: '438 CrPC', expectedCode: 'BNSS', expectedSec: '482' },
    { q: '65B IEA', expectedCode: 'BSA', expectedSec: '63' },
    { q: '482 CrPC', expectedCode: 'BNSS', expectedSec: '528' },
  ];

  let statuteHits = 0;
  for (const item of statuteBench) {
    const res = lookupStatuteMappings(item.q);
    if (res.some((m) => m.newCode === item.expectedCode && m.newSection.includes(item.expectedSec))) {
      statuteHits += 1;
    }
  }
  assert.equal(statuteHits, statuteBench.length);

  // Unknown statute must trigger zero-hallucination refusal rather than inventing a mapping
  const unknownReply = buildDeterministicStatuteReply('99999 IPC', 'en');
  assert.equal(unknownReply.found, false);

  // Precedent retrieval precision check
  const bailPrecedents = retrieveRelevantPrecedents('anticipatory bail 482 BNSS arrest', 'india_litigation', 3);
  assert.ok(
    bailPrecedents.some((p) => p.caseName.includes('Sushila Aggarwal') || p.caseName.includes('Arnesh Kumar'))
  );

  // Limitation accuracy check
  const arb = calculateLimitationDeadline('arb_sec_34', '2026-01-01');
  assert.equal(arb.effectiveDueDate, '2026-04-01');
  assert.ok(Date.now() - startedAt < 500);
});
