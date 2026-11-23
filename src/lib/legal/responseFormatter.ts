/**
 * Deterministic AI Response Formatter & Sanitizer for VidhiOS.
 * Cleans raw LLM output (NVIDIA NIM, Gemini, or deterministic templates) into
 * crisp, publication-grade legal markdown or pure Supreme Court / High Court plain text.
 */

const CHATTER_PREAMBLE_PATTERNS: RegExp[] = [
  /^(?:certainly|sure|of\s+course|absolutely|here(?:'s|\s+is)|below\s+is|please\s+find\s+below)[^.\n:]{0,120}[.:!]\s*\n+/i,
  /^(?:as\s+a\s+senior\s+advocate|as\s+an\s+ai|i\s+would\s+be\s+happy\s+to\s+help)[^.\n:]{0,140}[.:!]\s*\n+/i,
  /^(?:ज़रूर|निश्चित\s+रूप\s+से|बिल्कुल|यहाँ\s+आपका)[^।\n:]{0,120}[।.:!]\s*\n+/u,
];

const CHATTER_OUTRO_PATTERNS: RegExp[] = [
  /\n+(?:please\s+let\s+me\s+know\s+if\s+you\s+(?:need|would\s+like)|hope\s+this\s+helps|feel\s+free\s+to\s+ask)[^\n]{0,160}$/i,
];

/**
 * Strips model reasoning scratchpads (<think>...</think>), outer code fences,
 * and chatty AI preambles/outros.
 */
function stripModelArtifacts(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n').trim();

  // Remove <think>...</think> or <reasoning>...</reasoning> blocks emitted by reasoning models
  text = text
    .replace(/<(?:think|reasoning|analysis)>[\s\S]*?<\/(?:think|reasoning|analysis)>/gi, '')
    .trim();

  const stripPreambles = (value: string): string => {
    let out = value;
    for (const re of CHATTER_PREAMBLE_PATTERNS) {
      out = out.replace(re, '');
    }
    for (const re of CHATTER_OUTRO_PATTERNS) {
      out = out.replace(re, '');
    }
    return out.trim();
  };

  text = stripPreambles(text);

  // Unwrap outer markdown/text code fences if the response was wrapped
  const fenceMatch = /^```(?:markdown|md|text|txt|legal)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    text = text
      .replace(/^```(?:markdown|md|text|txt|legal)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  return stripPreambles(text);
}

/**
 * Normalizes AI-generated legal analysis, research memos, and bilingual chat replies
 * into clean, consistent Markdown ready for structured rendering.
 */
export function formatAiMarkdownResponse(raw: string): string {
  let text = stripModelArtifacts(raw);
  if (!text) return '';

  const lines = text.split('\n');
  const normalized: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].replace(/[ \t]+$/g, '');

    // Remove visual noise horizontal dividers (---, ***, ___) that clutter chat & memos
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      continue;
    }

    // Normalize missing space after markdown heading hashes: "###Executive" -> "### Executive"
    line = line.replace(/^(#{1,4})([^\s#])/, '$1 $2');

    // Convert standalone bold section headers like "**Executive Conclusion:**" or "**1. Statutory Basis**"
    // into crisp ### headings when not inside a table or list
    const standaloneBoldHeading = /^\*\*([^*\n]{3,90}?):?\*\*$/.exec(line.trim());
    if (standaloneBoldHeading && !line.trim().startsWith('|')) {
      line = `### ${standaloneBoldHeading[1].replace(/:$/, '').trim()}`;
    }

    // Convert bracketed language banners like "[ENGLISH]" or "[हिंदी सारांश]" into clean headings
    const bracketBanner = /^\[(ENGLISH|HINDI|हिंदी(?:\s+सारांश)?|BILINGUAL[^\]]*)\]$/i.exec(line.trim());
    if (bracketBanner) {
      line = `### ${bracketBanner[1].trim()}`;
    }

    // Normalize bullet variants ("• ", "▪ ", "– ", "* ") at line start to clean "- "
    // (avoiding bold "*bold*" or "**bold**" at start of line)
    if (/^\s*[•▪‣●]\s+/.test(line)) {
      line = line.replace(/^\s*[•▪‣●]\s+/, '- ');
    } else if (/^\s*\*\s+/.test(line)) {
      line = line.replace(/^\s*\*\s+/, '- ');
    } else if (/^\s*–\s+/.test(line)) {
      line = line.replace(/^\s*–\s+/, '- ');
    }

    // Normalize numbered list spacing ("1) Foo" -> "1. Foo")
    line = line.replace(/^(\s*\d+)\)\s+/, '$1. ');

    // Remove stray empty bold markers "** **"
    line = line.replace(/\*\*\s*\*\*/g, '');

    // Ensure breathing room before a heading if previous line wasn't blank
    if (/^#{1,4}\s+/.test(line) && normalized.length > 0 && normalized[normalized.length - 1] !== '') {
      normalized.push('');
    }

    normalized.push(line);
  }

  return normalized
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Formats AI-generated court pleadings, affidavits, notices, and judiciary forms into
 * pristine Supreme Court / High Court registry plain text with zero markdown artifacts.
 */
export function formatPlainCourtDocument(raw: string): string {
  let text = stripModelArtifacts(raw);
  if (!text) return '';

  const lines = text.split('\n').map((rawLine) => {
    let line = rawLine.replace(/[ \t]+$/g, '');

    // Remove horizontal rules
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      return '';
    }

    // Strip markdown heading markers ("### PRAYER" -> "PRAYER")
    line = line.replace(/^\s*#{1,6}\s+/, '');

    // Strip bold/italic/code markdown wrappers while keeping the legal text intact
    line = line
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1');

    // Convert markdown bullet "* " to clean indented "(•)" or "- "
    line = line.replace(/^\s*\*\s+/, '- ');

    return line;
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Cleans narrative JSON fields (e.g. executiveAssessment, courtroom replies, summaries)
 * and plain-text clipboard copies by stripping stray markdown syntax and collapsing spacing.
 */
export function stripMarkdownForPlainText(raw: string): string {
  let text = stripModelArtifacts(raw);
  if (!text) return '';

  return text
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
