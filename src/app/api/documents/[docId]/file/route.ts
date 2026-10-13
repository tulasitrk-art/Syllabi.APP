import { NextRequest } from 'next/server';
import { getPdfFromDisk } from '@/lib/serverPdfStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  const docId = params.docId;
  if (!docId) {
    return new Response('Document ID missing', { status: 400 });
  }

  const pdfBuffer = getPdfFromDisk(docId);

  if (!pdfBuffer) {
    return new Response('PDF binary not found', { status: 404 });
  }

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${docId}.pdf"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
