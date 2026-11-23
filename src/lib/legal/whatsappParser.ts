export type WhatsAppIntent =
  | { type: 'hearings' }
  | { type: 'cases' }
  | { type: 'deadlines' }
  | { type: 'bns'; query: string }
  | { type: 'remind'; text: string }
  | { type: 'brief' }
  | { type: 'help' }
  | { type: 'ai_query'; prompt: string };

export function parseWhatsAppCommand(input: string): WhatsAppIntent {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed || lower === '/help' || lower === 'help' || lower === 'commands') {
    return { type: 'help' };
  }

  if (lower.startsWith('/bns')) {
    return { type: 'bns', query: trimmed.slice(4).trim() };
  }

  if (lower.startsWith('/remind')) {
    return { type: 'remind', text: trimmed.slice(7).trim() };
  }

  if (
    lower === '/hearings' ||
    lower === '/next' ||
    lower.startsWith('/next hearings') ||
    /\b(upcoming|next)\s+hearings?\b/i.test(lower)
  ) {
    return { type: 'hearings' };
  }

  if (lower === '/cases' || lower === '/causelist' || /\bcause\s*list\b/i.test(lower)) {
    return { type: 'cases' };
  }

  if (lower === '/deadlines' || lower === '/limitation') {
    return { type: 'deadlines' };
  }

  if (lower === '/brief' || lower === '/summary' || lower === '/matter') {
    return { type: 'brief' };
  }

  return { type: 'ai_query', prompt: trimmed };
}
