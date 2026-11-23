import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCitationReplacements,
  findExactMapping,
  lookupStatuteMappings,
  scanDraftForLegacyCitations,
} from './statuteCrosswalk';

test('findExactMapping resolves high-frequency IPC, CrPC, and IEA sections', () => {
  assert.equal(findExactMapping('IPC', '302')?.newSection, '103(1)');
  assert.equal(findExactMapping('IPC', '420')?.newSection, '318(4)');
  assert.equal(findExactMapping('IPC', '498A')?.newSection, '85');
  assert.equal(findExactMapping('CrPC', '438')?.newSection, '482');
  assert.equal(findExactMapping('CrPC', '482')?.newSection, '528');
  assert.equal(findExactMapping('IEA', '65B')?.newSection, '63');
});

test('lookupStatuteMappings searches by legacy section, new section, or offence title', () => {
  const cheating = lookupStatuteMappings('cheating 420');
  assert.ok(cheating.some((m) => m.legacySection === '420' && m.newSection === '318(4)'));

  const electronic = lookupStatuteMappings('BSA 63');
  assert.ok(electronic.some((m) => m.legacyCode === 'IEA' && m.legacySection === '65B'));
});

test('scanDraftForLegacyCitations and applyCitationReplacements rewrite legacy statutes cleanly', () => {
  const draft =
    'This petition u/s 438 CrPC seeks anticipatory bail in FIR alleging offences under Section 420 IPC and Section 406 of the Indian Penal Code, supported by a certificate under Section 65B of the Indian Evidence Act.';

  const matches = scanDraftForLegacyCitations(draft);
  assert.equal(matches.length, 4);
  assert.deepEqual(
    matches.map((m) => `${m.legacyCode}:${m.legacySection}`),
    ['CrPC:438', 'IPC:420', 'IPC:406', 'IEA:65B']
  );

  const updated = applyCitationReplacements(draft, matches);
  assert.match(updated, /Section 482 BNSS \(formerly Section 438 CrPC\)/);
  assert.match(updated, /Section 318\(4\) BNS \(formerly Section 420 IPC\)/);
  assert.match(updated, /Section 316\(2\) BNS \(formerly Section 406 IPC\)/);
  assert.match(updated, /Section 63 BSA \(formerly Section 65B IEA\)/);

  // Idempotency: re-scanning the updated text must find 0 unmigrated legacy citations
  const remaining = scanDraftForLegacyCitations(updated);
  assert.equal(remaining.length, 0);
});
