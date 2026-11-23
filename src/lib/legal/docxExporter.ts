import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';

export interface CourtDocxPayload {
  title: string;
  courtHeader?: string;
  matterCode?: string;
  docType?: string;
  content: string;
  footerNote?: string;
}

const UPPERCASE_HEADING_PATTERN =
  /^(IN THE |VERSUS|VS\.?|IN THE MATTER OF|PRAYER|VERIFICATION|AFFIDAVIT|VAKALATNAMA|SYNOPSIS|LIST OF DATES|GROUNDS|CERTIFICATE|PART [AB]|SUPPORTING AFFIDAVIT|EXECUTIVE|STATUTORY|PRECEDENT|STRATEGIC|RECOMMENDED)/i;

function isAllCapsHeading(line: string): boolean {
  const clean = line.replace(/^[#*\s]+/, '').trim();
  if (clean.length < 3 || clean.length > 130) return false;
  if (UPPERCASE_HEADING_PATTERN.test(clean)) return true;
  const letters = clean.replace(/[^a-zA-Z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function cleanMarkdownMarkers(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function buildCourtDocument(payload: CourtDocxPayload): Document {
  const lines = payload.content.replace(/\r\n/g, '\n').split('\n');
  const paragraphs: Paragraph[] = [];

  // Optional court masthead if content does not already start with "IN THE"
  const trimmedStart = payload.content.trim().toUpperCase();
  if (payload.courtHeader && !trimmedStart.startsWith('IN THE ')) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160, line: 340 },
        children: [
          new TextRun({
            text: payload.courtHeader.toUpperCase(),
            bold: true,
            size: 26, // 13pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  // Document title banner if distinct from first line
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? '';
  if (
    payload.title &&
    !firstNonEmpty.toLowerCase().includes(payload.title.toLowerCase().slice(0, 18))
  ) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 220, line: 340 },
        border: {
          bottom: {
            color: '1A2E30',
            space: 6,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [
          new TextRun({
            text: payload.title.toUpperCase(),
            bold: true,
            size: 24, // 12pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [],
        })
      );
      continue;
    }

    // Horizontal divider line
    if (/^[-_=]{5,}$/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: {
            bottom: {
              color: '666666',
              space: 4,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
          children: [],
        })
      );
      continue;
    }

    const cleaned = cleanMarkdownMarkers(trimmed);

    // Centered VERSUS / Court Header / Title blocks
    if (/^(IN THE |VERSUS$|VS\.?$|VAKALATNAMA$|PRAYER$|VERIFICATION$|AFFIDAVIT$)/i.test(cleaned)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 140, line: 340 },
          children: [
            new TextRun({
              text: cleaned,
              bold: true,
              underline: /^(PRAYER|VERIFICATION|VAKALATNAMA|AFFIDAVIT)$/i.test(cleaned)
                ? {}
                : undefined,
              size: 24,
              font: 'Times New Roman',
            }),
          ],
        })
      );
      continue;
    }

    // Section Headings (Markdown # or All Caps Judicial Headings)
    if (trimmed.startsWith('#') || isAllCapsHeading(trimmed)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 200, after: 120, line: 340 },
          children: [
            new TextRun({
              text: cleaned,
              bold: true,
              size: 24,
              font: 'Times New Roman',
            }),
          ],
        })
      );
      continue;
    }

    // Numbered legal paragraphs (1., 2., (a), (b), A., B.)
    const numberedMatch = /^(\d+\.|\([a-z0-9]+\)|[A-Z]\.|•|-)\s+(.*)$/.exec(cleaned);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 480, hanging: 320 },
          spacing: { after: 140, line: 360 }, // 1.5x Supreme Court / High Court line spacing
          children: [
            new TextRun({
              text: `${numberedMatch[1]} `,
              bold: true,
              size: 24,
              font: 'Times New Roman',
            }),
            new TextRun({
              text: numberedMatch[2],
              size: 24,
              font: 'Times New Roman',
            }),
          ],
        })
      );
      continue;
    }

    // Standard justified legal body paragraph (Times New Roman 12pt, 1.5 spacing)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 360 },
        children: [
          new TextRun({
            text: cleaned,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  const headerLabel = [payload.matterCode, payload.docType || 'LEGAL FILING']
    .filter(Boolean)
    .join('  |  ');

  return new Document({
    creator: 'VidhiOS Legal Chambers',
    title: payload.title,
    description: payload.docType || 'Court-ready legal document',
    sections: [
      {
        properties: {
          page: {
            // Supreme Court & High Court standard margins: 1.5" left binding margin, 1.0" top/right/bottom
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 2160,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerLabel || 'VIDHIOS COURT DRAFT',
                    size: 18,
                    color: '5A6668',
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${payload.footerNote || 'Prepared in VidhiOS Chambers — Verify citations prior to filing'}   |   Page `,
                    size: 18,
                    color: '5A6668',
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '5A6668',
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        },
        children: paragraphs,
      },
    ],
  });
}

export async function buildCourtDocxBuffer(payload: CourtDocxPayload): Promise<Buffer> {
  const doc = buildCourtDocument(payload);
  return Packer.toBuffer(doc);
}

export async function buildCourtDocxBlob(payload: CourtDocxPayload): Promise<Blob> {
  const doc = buildCourtDocument(payload);
  return Packer.toBlob(doc);
}

export function sanitizeDocxFilename(title: string): string {
  const slug = (title || 'legal-document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${slug || 'legal-document'}.docx`;
}
