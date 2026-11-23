import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
} from './supremeCourtCorpus';

test('retrieves Sushila Aggarwal / Arnesh Kumar for anticipatory bail BNSS 482 queries', () => {
  const results = retrieveRelevantPrecedents(
    'Anticipatory bail application under Section 482 BNSS and CrPC 438 in economic offence',
    'india_litigation',
    4
  );
  assert.equal(results.length, 4);
  const names = results.map((r) => r.caseName);
  assert.ok(
    names.some((n) => n.includes('Sushila Aggarwal') || n.includes('Arnesh Kumar')),
    `Expected bail authority in ${names.join(', ')}`
  );
});

test('retrieves Arjun Panditrao Khotkar for Section 63 BSA / 65B IEA electronic evidence queries', () => {
  const results = retrieveRelevantPrecedents(
    'Admissibility of WhatsApp chats and Section 63 BSA electronic evidence certificate',
    'india_litigation',
    3
  );
  assert.equal(results[0].caseName, 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal');
});

test('retrieves Delhi Race Club (2024) for 420 IPC / 406 IPC / 318 BNS quashing queries', () => {
  const results = retrieveRelevantPrecedents(
    'Quashing FIR u/s 528 BNSS for cheating 420 IPC and criminal breach of trust 406 IPC in commercial dispute',
    'india_litigation',
    3
  );
  assert.ok(
    results.some((r) => r.caseName.includes('Delhi Race Club')),
    'Expected Delhi Race Club (2024) in top results'
  );
});

test('formats verified precedent grounding block with citations and ratios', () => {
  const results = retrieveRelevantPrecedents('unilateral arbitrator appointment section 11', 'corporate_ma', 2);
  const block = formatPrecedentGroundingBlock(results);
  assert.ok(block.includes('VERIFIED SUPREME COURT'));
  assert.ok(block.includes('Ratio:'));
});
