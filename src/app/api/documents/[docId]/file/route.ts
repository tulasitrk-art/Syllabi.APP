import { NextRequest } from 'next/server';
import { getPdfFromDisk, savePdfToDisk, getDocsIndex } from '@/lib/serverPdfStorage';
import { generateSyllabusPdfBuffer } from '@/lib/syllabusPdfGenerator';

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  const docId = params.docId;
  if (!docId) {
    return new Response('Document ID missing', { status: 400 });
  }

  let pdfBuffer = getPdfFromDisk(docId);

  // If not on disk, auto-generate from doc index metadata so the viewer always opens
  if (!pdfBuffer) {
    const docs = getDocsIndex();
    const docMeta = docs.find((d) => d.id === docId);

    const generatedArrayBuffer = generateSyllabusPdfBuffer({
      title: docMeta?.title || 'Syllabus Course Document',
      subject: docMeta?.subject || 'CS',
      unit: docMeta?.unit || 1,
      syllabusTopic: docMeta?.syllabusTopic || 'Core Syllabus Foundations & Examination Targets',
      totalPages: docMeta?.totalPages || 1,
    });

    const generatedBuf = Buffer.from(generatedArrayBuffer);
    pdfBuffer = generatedBuf;
  }

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${docId}.pdf"`,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

