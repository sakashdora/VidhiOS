import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCourtDocxBuffer, sanitizeDocxFilename } from './docxExporter';

test('generates a valid OOXML .docx ZIP buffer with court formatting', async () => {
  const buf = await buildCourtDocxBuffer({
    title: 'Anticipatory Bail Application u/s 482 BNSS',
    courtHeader: 'IN THE HIGH COURT OF JUDICATURE AT BOMBAY',
    matterCode: 'BOM-HC-2026-482',
    docType: 'Anticipatory Bail Application',
    content: `IN THE HIGH COURT OF JUDICATURE AT BOMBAY

VERSUS

1. That the Applicant invokes Section 482 BNSS, 2023.
2. That the dispute is purely commercial and civil arbitration is pending.

PRAYER
(a) Grant pre-arrest bail in the event of arrest.

VERIFICATION
Verified at Mumbai on this 21st day of November 2026.`,
  });

  assert.ok(Buffer.isBuffer(buf));
  // Valid ZIP/OOXML magic bytes: PK\x03\x04
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);
  assert.equal(buf[2], 0x03);
  assert.equal(buf[3], 0x04);
  assert.ok(buf.length > 3000, `Expected .docx buffer > 3000 bytes, got ${buf.length}`);
});

test('sanitizes .docx filenames against path traversal and unsafe characters', () => {
  assert.equal(
    sanitizeDocxFilename('../../Secret SLP (Art. 136) / Draft#1!'),
    'secret-slp-art-136-draft-1.docx'
  );
  assert.equal(sanitizeDocxFilename('   '), 'legal-document.docx');
});
