import { NextRequest } from 'next/server';
import { getPdfFromDisk, savePdfToDisk, getDocsIndex } from '@/lib/serverPdfStorage';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  const docId = params.docId;
  if (!docId) {
    return new Response('Document ID missing', { status: 400 });
  }

  // 1. Check local persistent disk first
  let pdfBuffer = getPdfFromDisk(docId);

  // 2. If not on disk, check Universal Store index for direct data URL or public URL
  if (!pdfBuffer) {
    try {
      const docs = getDocsIndex();
      const docMeta = docs.find((d) => d.id === docId);

      if (docMeta?.fileUrl) {
        if (docMeta.fileUrl.startsWith('data:application/pdf;base64,')) {
          const b64 = docMeta.fileUrl.split(',')[1];
          pdfBuffer = Buffer.from(b64, 'base64');
          savePdfToDisk(docId, pdfBuffer);
        } else if (docMeta.fileUrl.startsWith('http')) {
          const resp = await fetch(docMeta.fileUrl);
          if (resp.ok) {
            pdfBuffer = Buffer.from(await resp.arrayBuffer());
            savePdfToDisk(docId, pdfBuffer);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read doc from universal index:', e);
    }
  }

  // 3. If still not found, retrieve from Supabase Storage or Supabase database
  if (!pdfBuffer) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseUrl !== 'https://mock.supabase.co' && supabaseKey) {
      try {
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
          cookies: {
            get() { return ''; },
            set() {},
            remove() {},
          },
        });

        // 3a. Try downloading from Supabase Storage bucket
        const bucketName = process.env.NEXT_PUBLIC_STORAGE_BUCKET_DOCS || 'syllabi-documents';
        try {
          const { data: fileData, error: stErr } = await supabase.storage
            .from(bucketName)
            .download(`${docId}.pdf`);

          if (fileData && !stErr) {
            const ab = await fileData.arrayBuffer();
            pdfBuffer = Buffer.from(ab);
            savePdfToDisk(docId, pdfBuffer);
          }
        } catch {}

        // 3b. Try querying documents table for file_url
        if (!pdfBuffer) {
          const { data: docRow } = await supabase
            .from('documents')
            .select('file_url')
            .eq('id', docId)
            .single();

          if (docRow?.file_url) {
            if (docRow.file_url.startsWith('data:application/pdf;base64,')) {
              const b64 = docRow.file_url.split(',')[1];
              pdfBuffer = Buffer.from(b64, 'base64');
              savePdfToDisk(docId, pdfBuffer);
            } else if (docRow.file_url.startsWith('http')) {
              const resp = await fetch(docRow.file_url);
              if (resp.ok) {
                pdfBuffer = Buffer.from(await resp.arrayBuffer());
                savePdfToDisk(docId, pdfBuffer);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Supabase file retrieval error:', err);
      }
    }
  }

  // 4. If all sources failed, return 404 - never replace user's upload with a dummy syllabus!
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return new Response('Original PDF document file could not be retrieved from storage', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${docId}.pdf"`,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}

