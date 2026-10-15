/**
 * Pure TypeScript standard PDF 1.4 generator for syllabus documents.
 * Produces crisp, valid PDF buffers with zero external native dependencies.
 */

export interface SyllabusPdfOptions {
  title: string | null;
  subject?: string | null;
  unit?: number | null;
  syllabusTopic?: string | null;
  totalPages?: number | null;
}

function escapePdfText(str: string): string {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function generateSyllabusPdfBuffer(options: SyllabusPdfOptions): ArrayBuffer {
  const title = options.title || 'Syllabus Course Document';
  const subject = options.subject || 'CS';
  const unit = options.unit || 1;
  const topic = options.syllabusTopic || 'Foundations & Examination Targets';
  const totalPages = Math.max(1, Math.min(options.totalPages || 1, 10));

  const cleanTitle = escapePdfText(title);
  const cleanSubj = escapePdfText(subject);
  const cleanUnit = escapePdfText(unit === 6 ? 'Question Papers' : String(unit));
  const cleanTopic = escapePdfText(topic);

  // We build a valid PDF with totalPages pages
  // Dimensions: 595 x 842 points (Standard ISO A4)
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  // Structure:
  // Obj 1: Catalog
  // Obj 2: Pages (Parent)
  // For each page i (1..N):
  //   Obj Page(i)
  //   Obj Contents(i)
  // Followed by Font F1, Font F2
  let currentObjId = 3;

  for (let i = 1; i <= totalPages; i++) {
    pageObjectIds.push(currentObjId++);
    contentObjectIds.push(currentObjId++);
  }

  const fontF1Id = currentObjId++;
  const fontF2Id = currentObjId++;

  const objects: { id: number; content: string }[] = [];

  // Obj 1: Catalog
  objects.push({
    id: 1,
    content: '<< /Type /Catalog /Pages 2 0 R >>',
  });

  // Obj 2: Pages
  const kidsStr = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  objects.push({
    id: 2,
    content: `<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>`,
  });

  // Pages & Content streams
  for (let p = 1; p <= totalPages; p++) {
    const pageId = pageObjectIds[p - 1];
    const contentId = contentObjectIds[p - 1];

    // Page Object
    objects.push({
      id: pageId,
      content: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> >> >>`,
    });

    // Content stream for page p
    const streamCommands: string[] = [
      // Border & Header
      '0.1 0.1 0.1 RG',
      '0.8 w',
      '36 36 523 770 re S',
      '36 742 523 64 re f',
      // Header text
      'BT',
      '/F2 10 Tf',
      '1 1 1 rg',
      '50 782 Td',
      '(SYLLABI ACADEMIC REPOSITORY -- COLLABORATIVE STUDY SUITE) Tj',
      '/F1 9 Tf',
      '0.8 0.8 0.8 rg',
      '0 -16 Td',
      '(DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING -- FALL 2026) Tj',
      'ET',
      // Title & metadata banner
      'BT',
      '/F2 17 Tf',
      '0.08 0.08 0.08 rg',
      `50 702 Td (${cleanTitle}) Tj`,
      '/F1 10.5 Tf',
      '0.3 0.3 0.3 rg',
      `0 -20 Td (SUBJECT: ${cleanSubj}    |    UNIT: ${cleanUnit}    |    TOPIC: ${cleanTopic}) Tj`,
      'ET',
      // Divider
      '0.8 0.8 0.8 RG',
      '0.5 w',
      '50 664 m 545 664 l S',
      // Main Body
      'BT',
      '/F2 12 Tf',
      '0.1 0.1 0.1 rg',
      `50 635 Td (PART ${p}: CURRICULUM FOUNDATIONS & EXAMINATION CHECKPOINTS) Tj`,
      '/F1 10 Tf',
      '0.25 0.25 0.25 rg',
      '0 -22 Td (1. Core Theoretical Architecture & Standard Definitions) Tj',
      '0 -18 Td (2. Mathematical Models, Proof Techniques & Complexity Classes) Tj',
      '0 -18 Td (3. Algorithmic Formulations, Execution Traces & Invariants) Tj',
      '0 -18 Td (4. Architectural Systems Design, Benchmarks & Trade-offs) Tj',
      '0 -18 Td (5. University Examination Target Questions & Key Derivations) Tj',
      '/F2 11 Tf',
      '0.15 0.15 0.15 rg',
      '0 -34 Td (STUDY & ANNOTATION INSTRUCTIONS:) Tj',
      '/F1 9.5 Tf',
      '0.35 0.35 0.35 rg',
      '0 -18 Td (- Use the Pen or Highlighter in the floating dock to mark critical equations.) Tj',
      '0 -16 Td (- Switch to the Shared Layer to collaborate live with your study cohort.) Tj',
      '0 -16 Td (- Click Bookmark to save this page for revision prior to exam sessions.) Tj',
      '0 -16 Td (- Enable Touch Mode or drag with your mouse cursor to pan effortlessly.) Tj',
      'ET',
      // Notes card box in the center
      '0.92 0.92 0.94 rg',
      '50 250 495 140 re f',
      '0.75 0.75 0.78 RG',
      '0.5 w',
      '50 250 495 140 re S',
      'BT',
      '/F2 10 Tf',
      '0.2 0.2 0.2 rg',
      '65 365 Td (COHORT REVISION NOTES & ACTIVE PROBLEMS:) Tj',
      '/F1 9 Tf',
      '0.35 0.35 0.35 rg',
      '0 -18 Td (Write detailed formula notes, asymptotic runtimes, and exam annotations directly here.) Tj',
      '0 -16 Td (High-frequency question patterns for semester midterms are emphasized in this section.) Tj',
      '0 -16 Td (Collaborative annotations are preserved across sessions and synced with peers.) Tj',
      'ET',
      // Footer
      '0.85 0.85 0.85 RG',
      '50 75 m 545 75 l S',
      'BT',
      '/F1 8.5 Tf',
      '0.5 0.5 0.5 rg',
      `50 58 Td (SYLLABI OS -- IMMUTABLE BASE LAYER -- PAGE ${p} OF ${totalPages}) Tj`,
      'ET',
    ];

    const streamBody = streamCommands.join('\n');
    const streamLen = new TextEncoder().encode(streamBody).length;

    objects.push({
      id: contentId,
      content: `<< /Length ${streamLen} >>\nstream\n${streamBody}\nendstream`,
    });
  }

  // Obj: Font F1 (Helvetica)
  objects.push({
    id: fontF1Id,
    content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  });

  // Obj: Font F2 (Helvetica-Bold)
  objects.push({
    id: fontF2Id,
    content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  });

  // Sort by ID
  objects.sort((a, b) => a.id - b.id);

  // Assemble PDF bytes and compute xref table
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    const encoder = new TextEncoder();
    offsets.push(encoder.encode(pdf).length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  const startxref = new TextEncoder().encode(pdf).length;
  const totalObjCount = objects.length + 1;
  pdf += `xref\n0 ${totalObjCount}\n0000000000 65535 f \n`;

  for (let i = 0; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += `trailer\n<< /Size ${totalObjCount} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  const bytes = new TextEncoder().encode(pdf);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
