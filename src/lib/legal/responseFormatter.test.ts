import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAiMarkdownResponse,
  formatPlainCourtDocument,
  stripMarkdownForPlainText,
} from './responseFormatter';

test('formatAiMarkdownResponse strips <think> tags, code fences, preambles, and horizontal dividers', () => {
  const messy = `<think>Internal reasoning about Section 482 BNSS</think>
\`\`\`markdown
Certainly! Here is a detailed legal analysis of your matter:

---
###Executive Conclusion
* Anticipatory bail lies under **Section 482 BNSS**.
• Verify **Arnesh Kumar v. State of Bihar (2014) 8 SCC 273**.


**Key Next Steps:**
1) File sworn affidavit
2) Attach Section 63 BSA certificate

Hope this helps! Let me know if you need anything else.
\`\`\``;

  const cleaned = formatAiMarkdownResponse(messy);

  assert.equal(cleaned.includes('<think>'), false);
  assert.equal(cleaned.includes('```'), false);
  assert.equal(cleaned.includes('Certainly!'), false);
  assert.equal(cleaned.includes('Hope this helps'), false);
  assert.equal(cleaned.includes('---'), false);
  assert.ok(cleaned.includes('### Executive Conclusion'));
  assert.ok(cleaned.includes('- Anticipatory bail lies under **Section 482 BNSS**.'));
  assert.ok(cleaned.includes('- Verify **Arnesh Kumar v. State of Bihar (2014) 8 SCC 273**.'));
  assert.ok(cleaned.includes('### Key Next Steps'));
  assert.ok(cleaned.includes('1. File sworn affidavit'));
});

test('formatAiMarkdownResponse preserves markdown tables and Devanagari Hindi cleanly', () => {
  const bilingual = `[हिंदी सारांश]
| पुरानी धारा | नई धारा | प्रभाव |
| --- | --- | --- |
| IPC 420 | BNS 318(4) | धोखाधड़ी |

• तुरंत **.DOCX** डाउनलोड करें।`;

  const cleaned = formatAiMarkdownResponse(bilingual);
  assert.ok(cleaned.includes('### हिंदी सारांश'));
  assert.ok(cleaned.includes('| पुरानी धारा | नई धारा | प्रभाव |'));
  assert.ok(cleaned.includes('| IPC 420 | BNS 318(4) | धोखाधड़ी |'));
  assert.ok(cleaned.includes('- तुरंत **.DOCX** डाउनलोड करें।'));
});

test('formatPlainCourtDocument removes all markdown syntax from court filings and affidavits', () => {
  const rawDraft = `Sure, here is the requested affidavit:
\`\`\`
### IN THE HIGH COURT OF JUDICATURE AT BOMBAY
**AFFIDAVIT IN SUPPORT**
---
1. That the Deponent relies on **Section 63 BSA** and \`Order XIX Rule 3 CPC\`.
* Annexures A to D are true copies.
\`\`\``;

  const cleanDraft = formatPlainCourtDocument(rawDraft);
  assert.equal(cleanDraft.includes('###'), false);
  assert.equal(cleanDraft.includes('**'), false);
  assert.equal(cleanDraft.includes('`'), false);
  assert.equal(cleanDraft.includes('---'), false);
  assert.equal(cleanDraft.includes('Sure, here is'), false);
  assert.ok(cleanDraft.startsWith('IN THE HIGH COURT OF JUDICATURE AT BOMBAY'));
  assert.ok(cleanDraft.includes('1. That the Deponent relies on Section 63 BSA and Order XIX Rule 3 CPC.'));
  assert.ok(cleanDraft.includes('- Annexures A to D are true copies.'));
});

test('stripMarkdownForPlainText cleans narrative fields without losing content', () => {
  const messyField = '**Executive Assessment:** Strong posture under *Section 528 BNSS* per [Delhi Race Club](https://main.sci.gov.in/).';
  const plain = stripMarkdownForPlainText(messyField);
  assert.equal(
    plain,
    'Executive Assessment: Strong posture under Section 528 BNSS per Delhi Race Club (https://main.sci.gov.in/).'
  );
});
