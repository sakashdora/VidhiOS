import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  parseLegalCitations,
  type DetectedCitation,
  type ParsedCitationResult,
} from '../lib/legal/citationParser';
import { formatAiMarkdownResponse } from '../lib/legal/responseFormatter';
import type { VerifiedCitation } from '../types/legal';

interface CitationTextRendererProps {
  markdown: string;
  groundedCitations?: VerifiedCitation[];
  highlightCitations?: boolean;
  density?: 'default' | 'compact';
  onCopyCitation?: (label: string) => void;
  onParsedChange?: (summary: {
    total: number;
    cases: DetectedCitation[];
    statutes: DetectedCitation[];
  }) => void;
}

interface ActiveTooltipState {
  citation: DetectedCitation;
  anchorRect: DOMRect;
  pinned: boolean;
}

const TIER_META: Record<
  DetectedCitation['verificationTier'],
  { label: string; className: string }
> = {
  verified_corpus: {
    label: 'Verified Precedent',
    className:
      'text-[#156a53] dark:text-emerald-400 bg-[#156a53]/10 dark:bg-emerald-500/15',
  },
  statute_crosswalk: {
    label: 'BNS / BNSS / BSA Crosswalk',
    className:
      'text-[#8a5210] dark:text-amber-300 bg-[#b86b14]/12 dark:bg-amber-500/15',
  },
  grounded_source: {
    label: 'Grounded Source',
    className:
      'text-[#0c4d52] dark:text-[#6fd3da] bg-[#0f5a5f]/12 dark:bg-[#14777e]/20',
  },
  statutory_reference: {
    label: 'Statutory Reference',
    className:
      'text-[#8a5210] dark:text-amber-300 bg-[#b86b14]/12 dark:bg-amber-500/15',
  },
  detected_lookup: {
    label: 'Verify Official Text',
    className:
      'text-ink-muted bg-[#e8e1d3] dark:bg-[#263336]',
  },
};

interface InlineRun {
  kind: 'text' | 'bold' | 'italic' | 'code' | 'verification';
  text: string;
}

function parseInlineRuns(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const regex =
    /\*\*([^*\n]+)\*\*|`([^`\n]+)`|(\[(?:Verification Required[^\]]*|सत्यापन आवश्यक[^\]]*)\])|\*([^*\s][^*\n]*?)\*/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > cursor) {
      runs.push({ kind: 'text', text: line.slice(cursor, match.index) });
    }
    if (match[1] !== undefined) {
      runs.push({ kind: 'bold', text: match[1] });
    } else if (match[2] !== undefined) {
      runs.push({ kind: 'code', text: match[2] });
    } else if (match[3] !== undefined) {
      runs.push({ kind: 'verification', text: match[3] });
    } else if (match[4] !== undefined) {
      runs.push({ kind: 'italic', text: match[4] });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    runs.push({ kind: 'text', text: line.slice(cursor) });
  }

  return runs;
}

interface MarkdownBlock {
  type: 'heading' | 'ordered_list' | 'unordered_list' | 'blockquote' | 'table' | 'paragraph';
  items: string[];
  level?: number;
  orderedNumbers?: number[];
  headers?: string[];
  rows?: string[][];
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
}

function isTableHeaderStart(lines: string[], idx: number): boolean {
  if (idx + 1 >= lines.length) return false;
  const current = lines[idx].trim();
  const next = lines[idx + 1].trim();
  return current.includes('|') && isTableSeparatorLine(next);
}

function parseSimpleMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown Table (header + separator + body rows)
    if (isTableHeaderStart(lines, i)) {
      const headers = splitTableRow(lines[i]);
      i += 2; // Skip header & separator
      const rows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        lines[i].includes('|') &&
        !isTableSeparatorLine(lines[i])
      ) {
        const cols = splitTableRow(lines[i]);
        while (cols.length < headers.length) cols.push('');
        rows.push(cols.slice(0, headers.length));
        i += 1;
      }
      blocks.push({ type: 'table', items: [], headers, rows });
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        items: [headingMatch[2].trim()],
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', items: [quoteLines.join(' ')] });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      const orderedNumbers: number[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const m = /^(\d+)\.\s+(.*)$/.exec(lines[i].trim());
        if (m) {
          orderedNumbers.push(Number.parseInt(m[1], 10));
          items.push(m[2]);
        }
        i += 1;
      }
      blocks.push({ type: 'ordered_list', items, orderedNumbers });
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'unordered_list', items });
      continue;
    }

    const paraLines: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isTableHeaderStart(lines, i) &&
      !/^#{1,4}\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^[A-Z][A-Za-z0-9\s/&()-]{1,28}:\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', items: [paraLines.join(' ')] });
  }

  return blocks;
}

export function CitationTextRenderer({
  markdown,
  groundedCitations = [],
  highlightCitations = true,
  density = 'default',
  onCopyCitation,
  onParsedChange,
}: CitationTextRendererProps) {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltipState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tooltipCardRef = useRef<HTMLDivElement | null>(null);

  const normalizedMarkdown = useMemo(
    () => formatAiMarkdownResponse(markdown),
    [markdown]
  );

  // Run full-document citation parse once per memo for accurate summary counts & deduplication
  const fullParsed: ParsedCitationResult = useMemo(
    () => parseLegalCitations(normalizedMarkdown, groundedCitations),
    [normalizedMarkdown, groundedCitations]
  );

  useEffect(() => {
    onParsedChange?.({
      total: fullParsed.citations.length,
      cases: fullParsed.uniqueCases,
      statutes: fullParsed.uniqueStatutes,
    });
  }, [fullParsed, onParsedChange]);

  const blocks = useMemo(
    () => parseSimpleMarkdownBlocks(normalizedMarkdown),
    [normalizedMarkdown]
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setActiveTooltip((prev) => (prev && !prev.pinned ? null : prev));
    }, 170);
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  // Dismiss on Escape, scroll, or outside click
  useEffect(() => {
    if (!activeTooltip) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltip(null);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        tooltipCardRef.current &&
        target &&
        !tooltipCardRef.current.contains(target) &&
        !(target instanceof HTMLElement && target.closest('[data-citation-trigger="true"]'))
      ) {
        setActiveTooltip(null);
      }
    };

    const handleScrollOrResize = () => {
      setActiveTooltip(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeTooltip]);

  const openTooltipForElement = useCallback(
    (citation: DetectedCitation, el: HTMLElement, pinned: boolean) => {
      clearCloseTimer();
      const rect = el.getBoundingClientRect();
      setActiveTooltip((prev) => {
        if (pinned && prev?.pinned && prev.citation.id === citation.id) {
          return null;
        }
        return {
          citation,
          anchorRect: rect,
          pinned: pinned || Boolean(prev?.pinned && prev.citation.id === citation.id),
        };
      });
    },
    [clearCloseTimer]
  );

  const handleCopy = async (citation: DetectedCitation) => {
    const label = citation.citationRef
      ? `${citation.canonicalTitle} (${citation.citationRef})`
      : citation.canonicalTitle;
    try {
      await navigator.clipboard.writeText(label);
    } catch {
      // Clipboard may be restricted in headless contexts; still provide visual feedback
    }
    setCopiedId(citation.id);
    onCopyCitation?.(label);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === citation.id ? null : curr));
    }, 1800);
  };

  const renderAnnotatedText = (rawText: string, keyPrefix: string): React.ReactNode => {
    const inlineRuns = parseInlineRuns(rawText);

    return inlineRuns.map((run, runIdx) => {
      if (run.kind === 'code') {
        return (
          <code
            key={`${keyPrefix}-r${runIdx}`}
            className="px-1.5 py-0.5 rounded bg-[#e8e1d3]/80 dark:bg-[#1a2427] font-mono text-[0.9em] text-ink"
          >
            {run.text}
          </code>
        );
      }

      if (run.kind === 'verification') {
        return (
          <span
            key={`${keyPrefix}-r${runIdx}`}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-[#b86b14]/15 dark:bg-amber-500/20 text-[#8a5210] dark:text-amber-300 font-mono text-[10px] font-semibold align-baseline"
          >
            {run.text}
          </span>
        );
      }

      const wrapRun = (content: React.ReactNode) => {
        if (run.kind === 'bold') {
          return (
            <strong key={`${keyPrefix}-r${runIdx}`} className="font-semibold text-ink">
              {content}
            </strong>
          );
        }
        if (run.kind === 'italic') {
          return (
            <em key={`${keyPrefix}-r${runIdx}`} className="italic text-ink">
              {content}
            </em>
          );
        }
        return <React.Fragment key={`${keyPrefix}-r${runIdx}`}>{content}</React.Fragment>;
      };

      if (!highlightCitations) {
        return wrapRun(run.text);
      }

      const parsed = parseLegalCitations(run.text, groundedCitations);
      const renderedSegments = parsed.segments.map((seg, segIdx) => {
        if (seg.type === 'text') {
          return (
            <React.Fragment key={`${keyPrefix}-r${runIdx}-s${segIdx}`}>
              {seg.text}
            </React.Fragment>
          );
        }

        const cit = seg.citation;
        const uniqueCit: DetectedCitation = {
          ...cit,
          id: `${keyPrefix}_${runIdx}_${segIdx}_${cit.id}`,
        };
        const isActive = activeTooltip?.citation.id === uniqueCit.id;
        const isCase = uniqueCit.kind === 'case';
        const primaryUrl = uniqueCit.links[0]?.url ?? 'https://www.indiacode.nic.in/';

        return (
          <a
            key={uniqueCit.id}
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-citation-trigger="true"
            data-citation-kind={uniqueCit.kind}
            data-citation-title={uniqueCit.canonicalTitle}
            aria-label={`${isCase ? 'Case authority' : 'Statutory provision'}: ${uniqueCit.matchedText}. Hover or click for summary and links.`}
            aria-expanded={isActive}
            aria-describedby={isActive ? 'vidhios-citation-tooltip' : undefined}
            onMouseEnter={(e) => openTooltipForElement(uniqueCit, e.currentTarget, false)}
            onMouseLeave={scheduleClose}
            onFocus={(e) => openTooltipForElement(uniqueCit, e.currentTarget, false)}
            onBlur={scheduleClose}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              e.stopPropagation();
              openTooltipForElement(uniqueCit, e.currentTarget, true);
            }}
            className={`inline rounded-[4px] px-0.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f5a5f] ${
              isCase
                ? isActive
                  ? 'bg-[#dfeceb] dark:bg-[#132e31] text-[#0c4d52] dark:text-[#6fd3da] underline decoration-[#0f5a5f] dark:decoration-[#57c5cc] underline-offset-[3px]'
                  : 'text-[#0c4d52] dark:text-[#6fd3da] underline decoration-dotted decoration-[#0f5a5f]/75 dark:decoration-[#57c5cc]/75 underline-offset-[3px] hover:bg-[#dfeceb]/80 dark:hover:bg-[#132e31]/80'
                : isActive
                  ? 'bg-[#f5e7cf] dark:bg-[#332611] text-[#8a5210] dark:text-[#f0bc63] underline decoration-[#b86b14] dark:decoration-[#e0a64b] underline-offset-[3px]'
                  : 'text-[#8a5210] dark:text-[#eab354] underline decoration-dashed decoration-[#b86b14]/75 dark:decoration-[#e0a64b]/75 underline-offset-[3px] hover:bg-[#f5e7cf]/75 dark:hover:bg-[#332611]/75'
            }`}
          >
            {uniqueCit.matchedText}
          </a>
        );
      });

      return wrapRun(renderedSegments);
    });
  };

  // Compute safe viewport-clamped position for the floating tooltip card
  const tooltipStyle = useMemo<React.CSSProperties | null>(() => {
    if (!activeTooltip || typeof window === 'undefined') return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const width = Math.min(380, vw - margin * 2);
    const estimatedHeight = 250;

    const { anchorRect } = activeTooltip;
    const preferredLeft = anchorRect.left + anchorRect.width / 2 - width / 2;
    const clampedLeft = Math.max(margin, Math.min(preferredLeft, vw - width - margin));

    const spaceBelow = vh - anchorRect.bottom;
    const placeAbove = spaceBelow < estimatedHeight && anchorRect.top > estimatedHeight * 0.7;

    if (placeAbove) {
      return {
        position: 'fixed',
        left: `${Math.round(clampedLeft)}px`,
        bottom: `${Math.round(vh - anchorRect.top + 8)}px`,
        width: `${Math.round(width)}px`,
        zIndex: 70,
      };
    }

    return {
      position: 'fixed',
      left: `${Math.round(clampedLeft)}px`,
      top: `${Math.round(anchorRect.bottom + 8)}px`,
      width: `${Math.round(width)}px`,
      zIndex: 70,
    };
  }, [activeTooltip]);

  const isCompact = density === 'compact';

  return (
    <>
      <div
        className={
          isCompact
            ? 'space-y-2.5 text-xs sm:text-[13px] leading-relaxed text-ink-secondary'
            : 'space-y-3.5 text-sm leading-relaxed text-ink-secondary'
        }
      >
        {blocks.map((block, bIdx) => {
          if (block.type === 'heading') {
            const isSub = (block.level ?? 3) >= 4;
            return (
              <h4
                key={`b-${bIdx}`}
                className={
                  isSub
                    ? `font-mono ${isCompact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wider font-semibold text-teal-accent pt-1.5 first:pt-0`
                    : `font-display ${isCompact ? 'text-[13px] sm:text-sm' : 'text-[15px]'} font-semibold text-ink pt-2 first:pt-0 border-b border-stone-hairline/70 pb-1`
                }
              >
                {renderAnnotatedText(block.items[0], `h-${bIdx}`)}
              </h4>
            );
          }

          if (block.type === 'table' && block.headers && block.rows) {
            return (
              <div
                key={`b-${bIdx}`}
                className="overflow-x-auto rounded-xl border border-stone-hairline bg-[#faf7f0]/80 dark:bg-[#101617]/80"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="neu-table-head">
                    <tr>
                      {block.headers.map((header, hIdx) => (
                        <th
                          key={`th-${bIdx}-${hIdx}`}
                          className={`${
                            isCompact ? 'px-2.5 py-2 text-[10px]' : 'px-3 py-2.5 text-[11px]'
                          } font-mono font-semibold text-ink uppercase tracking-wider border-b border-stone-hairline whitespace-nowrap`}
                        >
                          {renderAnnotatedText(header, `th-${bIdx}-${hIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-hairline/70">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={`tr-${bIdx}-${rIdx}`}
                        className="hover:bg-[#efe9dc]/45 dark:hover:bg-[#192326]/60 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={`td-${bIdx}-${rIdx}-${cIdx}`}
                            className={`${
                              isCompact ? 'px-2.5 py-2 text-[11px] sm:text-xs' : 'px-3 py-2.5 text-xs'
                            } align-top text-ink-secondary leading-snug`}
                          >
                            {renderAnnotatedText(cell, `td-${bIdx}-${rIdx}-${cIdx}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          if (block.type === 'blockquote') {
            return (
              <blockquote
                key={`b-${bIdx}`}
                className={`border-l-2 border-[#0f5a5f] dark:border-[#57c5cc] bg-[#0f5a5f]/[0.05] dark:bg-[#14777e]/[0.12] rounded-r-xl ${
                  isCompact ? 'px-3 py-2 text-[11px] sm:text-xs' : 'px-3.5 py-2.5 text-xs sm:text-[13px]'
                } leading-relaxed text-ink-secondary`}
              >
                {renderAnnotatedText(block.items[0], `bq-${bIdx}`)}
              </blockquote>
            );
          }

          if (block.type === 'ordered_list') {
            return (
              <ol key={`b-${bIdx}`} className={isCompact ? 'space-y-1.5 pl-0.5' : 'space-y-2.5 pl-1'}>
                {block.items.map((item, idx) => (
                  <li key={`ol-${bIdx}-${idx}`} className="flex items-start gap-2">
                    <span className="font-mono text-[11px] font-semibold text-teal-accent tabular-nums mt-0.5 shrink-0">
                      {block.orderedNumbers?.[idx] ?? idx + 1}.
                    </span>
                    <span className="flex-1 min-w-0">
                      {renderAnnotatedText(item, `ol-${bIdx}-${idx}`)}
                    </span>
                  </li>
                ))}
              </ol>
            );
          }

          if (block.type === 'unordered_list') {
            return (
              <ul key={`b-${bIdx}`} className={isCompact ? 'space-y-1.5 pl-0.5' : 'space-y-2 pl-1'}>
                {block.items.map((item, idx) => (
                  <li key={`ul-${bIdx}-${idx}`} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[#0f5a5f] dark:bg-[#57c5cc] mt-[7px] shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      {renderAnnotatedText(item, `ul-${bIdx}-${idx}`)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={`b-${bIdx}`} className="leading-relaxed">
              {renderAnnotatedText(block.items[0], `p-${bIdx}`)}
            </p>
          );
        })}
      </div>

      {/* Viewport-Safe Portal Tooltip for Hovered / Focused / Tapped Legal Citation */}
      {activeTooltip &&
        tooltipStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipCardRef}
            id="vidhios-citation-tooltip"
            role="tooltip"
            data-testid="citation-tooltip"
            style={tooltipStyle}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            className="neu-modal rounded-2xl p-4 text-left text-xs text-ink border border-[#cfc5b2] dark:border-[#324347]"
          >
            {/* Header Strip */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-ink-secondary">
                  {activeTooltip.citation.kind === 'case' ? (
                    <Scale className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-[#b86b14] dark:text-[#eab354]" strokeWidth={2} />
                  )}
                  <span>
                    {activeTooltip.citation.kind === 'case' ? 'Case Law' : 'Statute'}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[10px] ${
                    TIER_META[activeTooltip.citation.verificationTier].className
                  }`}
                >
                  <ShieldCheck className="w-3 h-3 shrink-0" strokeWidth={2} />
                  <span>{TIER_META[activeTooltip.citation.verificationTier].label}</span>
                </span>
              </div>

              <button
                type="button"
                aria-label="Close citation preview"
                onClick={() => setActiveTooltip(null)}
                className="p-1 -m-1 rounded-lg text-ink-muted hover:text-ink transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Canonical Title & Reporter / Act Reference */}
            <div className="mt-2.5">
              <h5 className="font-display text-[13px] font-semibold text-ink leading-snug">
                {activeTooltip.citation.canonicalTitle}
              </h5>
              {activeTooltip.citation.citationRef && (
                <p className="mt-0.5 font-mono text-[11px] text-teal-accent">
                  {activeTooltip.citation.citationRef}
                </p>
              )}
              <p className="mt-1 text-[11px] font-medium text-ink-muted">
                {activeTooltip.citation.subtitle}
              </p>
            </div>

            {/* Bidirectional BNS/BNSS/BSA Crosswalk Callout */}
            {activeTooltip.citation.crosswalkLabel && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-[#e8e1d3]/80 dark:bg-[#101617] border border-stone-hairline font-mono text-[11px] text-ink">
                {activeTooltip.citation.crosswalkLabel}
              </div>
            )}

            {/* Brief Real-Time Summary / Ratio Decidendi */}
            <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
              {activeTooltip.citation.summary}
            </p>

            {activeTooltip.citation.secondaryNote && (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted border-l-2 border-[#0f5a5f]/40 dark:border-[#57c5cc]/40 pl-2.5">
                {activeTooltip.citation.secondaryNote}
              </p>
            )}

            {/* Action Links & Copy Citation */}
            <div className="mt-3 pt-2.5 border-t border-stone-hairline flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                {activeTooltip.citation.links.slice(0, 2).map((link) => (
                  <a
                    key={link.url + link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-accent hover:underline"
                  >
                    <span>{link.label}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleCopy(activeTooltip.citation)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-ink-secondary hover:text-ink bg-[#e8e1d3]/70 dark:bg-[#151d1f] transition-colors"
              >
                {copiedId === activeTooltip.citation.id ? (
                  <>
                    <Check className="w-3 h-3 text-[#156a53] dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
