import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsAppCommand } from './whatsappParser';

test('parses explicit slash commands accurately', () => {
  assert.deepEqual(parseWhatsAppCommand('/bns 420'), { type: 'bns', query: '420' });
  assert.deepEqual(parseWhatsAppCommand('/remind File affidavit by Monday'), {
    type: 'remind',
    text: 'File affidavit by Monday',
  });
  assert.deepEqual(parseWhatsAppCommand('/hearings'), { type: 'hearings' });
  assert.deepEqual(parseWhatsAppCommand('/cases'), { type: 'cases' });
  assert.deepEqual(parseWhatsAppCommand('/deadlines'), { type: 'deadlines' });
  assert.deepEqual(parseWhatsAppCommand('/brief'), { type: 'brief' });
  assert.deepEqual(parseWhatsAppCommand('/help'), { type: 'help' });
});

test('routes natural language queries appropriately', () => {
  assert.deepEqual(parseWhatsAppCommand('Show my next hearings'), { type: 'hearings' });
  assert.deepEqual(parseWhatsAppCommand('What is the limitation for Sec 34 arbitration?'), {
    type: 'ai_query',
    prompt: 'What is the limitation for Sec 34 arbitration?',
  });
});
