import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  ensureStorageReady,
  getDocsIndex,
  saveDocsIndex,
  savePdfToDisk,
  deleteDocFromDisk,
  getDeletedDocIds,
  markDocDeleted,
  updateDocProgress,
} from '@/lib/serverPdfStorage';
import { generateSyllabusPdfBuffer } from '@/lib/syllabusPdfGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/documents?roomId=...
export async function GET(request: NextRequest) {
  try {
    ensureStorageReady();
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId') || 'room-demo';
    const clientDeleted = searchParams.get('deletedIds');
    if (clientDeleted) {
      clientDeleted.split(',').forEach((id) => {
        const clean = id.trim();
        if (clean) markDocDeleted(clean);
      });
    }

    // 1. If Supabase is configured, attempt fetch from Supabase first
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

        const { data, error } = await supabase
          .from('documents')
          .select(`*, user_document_progress(*)`)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            roomId: d.room_id,
            uploadedBy: d.uploaded_by,
            title: d.title,
            subject: d.subject,
            unit: d.unit,
            syllabusTopic: d.syllabus_topic,
            fileUrl: d.file_url,
            totalPages: d.total_pages,
            createdAt: d.created_at,
            userProgress: d.user_document_progress?.[0]
              ? {
                  status: d.user_document_progress[0].status,
                  bookmarks: d.user_document_progress[0].bookmarks || [],
                }
              : undefined,
          }));
          return NextResponse.json({
            documents: mapped,
            deletedIds: getDeletedDocIds(),
            source: 'supabase',
          }, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          });
        }
      } catch (err) {
        console.warn('Supabase documents fetch failed, using universal store:', err);
      }
    }

    // 2. Return from Universal Server Store (accessible to every visitor across devices, supporting 30+ documents)
    const allDocs = getDocsIndex();
    const sorted = [...allDocs].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json(
      {
        documents: sorted,
        deletedIds: getDeletedDocIds(),
        source: 'universal_store',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/documents:', err);
    // Even if an unexpected error occurs, return an empty array instead of 500 error
    return NextResponse.json({ documents: [], error: err?.message || 'Server error' }, { status: 200 });
  }
}

// POST /api/documents (Multipart / JSON Upload)
export async function POST(request: NextRequest) {
  ensureStorageReady();

  try {
    const contentType = request.headers.get('content-type') || '';
    let docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let title = '';
    let subject = 'AI';
    let unit = 1;
    let syllabusTopic = '';
    let totalPages = 1;
    let roomId = 'room-demo';
    let pdfBuffer: Buffer | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const passedDocId = formData.get('docId') as string;
      if (passedDocId && passedDocId.trim()) {
        docId = passedDocId.trim();
      }
      const file = formData.get('file') as File | null;
      title = (formData.get('title') as string) || '';
      subject = (formData.get('subject') as string) || 'AI';
      unit = Number(formData.get('unit')) || 1;
      syllabusTopic = (formData.get('syllabusTopic') as string) || '';
      totalPages = Number(formData.get('totalPages')) || 1;
      roomId = (formData.get('roomId') as string) || 'room-demo';

      if (file) {
        const bytes = await file.arrayBuffer();
        pdfBuffer = Buffer.from(bytes);
        if (!title) {
          title = file.name;
        }
      }
    } else {
      const json = await request.json();
      if (json.docId && typeof json.docId === 'string') {
        docId = json.docId.trim();
      }
      title = json.title || '';
      subject = json.subject || 'AI';
      unit = Number(json.unit) || 1;
      syllabusTopic = json.syllabusTopic || '';
      totalPages = Number(json.totalPages) || 1;
      roomId = json.roomId || 'room-demo';
      if (json.pdfBase64) {
        pdfBuffer = Buffer.from(json.pdfBase64, 'base64');
      }
    }

    if (!title) {
      title = 'Syllabus_Document.pdf';
    }
    if (!title.toLowerCase().endsWith('.pdf')) {
      title = `${title}.pdf`;
    }

    // Save PDF file binary - if no binary was uploaded, auto-generate standard syllabus PDF
    if (!pdfBuffer || pdfBuffer.length === 0) {
      const generated = generateSyllabusPdfBuffer({
        title,
        subject,
        unit,
        syllabusTopic,
        totalPages,
      });
      pdfBuffer = Buffer.from(generated);
    }

    // Accurately detect page count from real PDF binary
    if (pdfBuffer && pdfBuffer.length > 0) {
      try {
        const text = pdfBuffer.toString('latin1');
        const pageMatches = text.match(/\/Type\s*\/Page\b/g);
        if (pageMatches && pageMatches.length > 0) {
          totalPages = Math.max(totalPages, pageMatches.length);
        }
      } catch {}
    }

    savePdfToDisk(docId, pdfBuffer);

    const pdfBase64 = pdfBuffer ? pdfBuffer.toString('base64') : '';
    const pdfDataUrl = pdfBase64 && pdfBuffer.length < 15 * 1024 * 1024
      ? `data:application/pdf;base64,${pdfBase64}`
      : '';

    let fileUrl = `/api/documents/${docId}/file`;

    // 1. If Supabase is configured, upload the actual PDF to Supabase Storage bucket
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

        const bucketName = process.env.NEXT_PUBLIC_STORAGE_BUCKET_DOCS || 'syllabi-documents';
        let storageSuccess = false;

        try {
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(`${docId}.pdf`, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(`${docId}.pdf`);

            if (publicUrlData?.publicUrl) {
              fileUrl = publicUrlData.publicUrl;
              storageSuccess = true;
            }
          } else {
            console.warn('Supabase storage upload error:', uploadError.message);
          }
        } catch (stErr) {
          console.warn('Supabase storage upload attempt error:', stErr);
        }

        // If storage upload didn't yield a public URL, store the PDF data URL directly so every device gets the real PDF!
        if (!storageSuccess && pdfDataUrl) {
          fileUrl = pdfDataUrl;
        }

        await supabase.from('documents').upsert({
          id: docId,
          room_id: roomId,
          uploaded_by: '00000000-0000-0000-0000-000000000000',
          title,
          subject,
          unit,
          syllabus_topic: syllabusTopic,
          file_url: fileUrl,
          total_pages: totalPages,
        });
      } catch (err) {
        console.warn('Supabase DB sync skipped/failed:', err);
      }
    } else {
      // If Supabase is not configured, attach the data URL so cross-device lambdas have the real file
      if (pdfDataUrl) {
        fileUrl = pdfDataUrl;
      }
    }

    const newDoc = {
      id: docId,
      roomId,
      uploadedBy: 'student-visitor',
      title,
      subject,
      unit,
      syllabusTopic,
      fileUrl,
      totalPages,
      createdAt: new Date().toISOString(),
      userProgress: {
        status: 'UNREAD',
        bookmarks: [],
      },
      annotationCount: 0,
    };

    // 1. Persist to universal server store
    const allDocs = getDocsIndex();
    const updated = [newDoc, ...allDocs.filter((d) => d.id !== docId)];
    saveDocsIndex(updated);

    return NextResponse.json({ success: true, document: newDoc });
  } catch (err: any) {
    console.error('Failed to create document:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process document upload' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents?id=...
export async function DELETE(request: NextRequest) {
  ensureStorageReady();
  const searchParams = request.nextUrl.searchParams;
  let docId = searchParams.get('id');

  if (!docId) {
    try {
      const body = await request.json();
      docId = body?.id;
    } catch {
      // ignore
    }
  }

  if (!docId) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  // 1. Permanently delete from universal server store and disk
  deleteDocFromDisk(docId);

  // 2. If Supabase is configured, delete from Supabase database
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

      await supabase.from('documents').delete().eq('id', docId);
    } catch (err) {
      console.warn('Supabase DB delete warning:', err);
    }
  }

  return NextResponse.json({
    success: true,
    deletedId: docId,
    deletedIds: getDeletedDocIds(),
  });
}

// PATCH /api/documents (Universal sync for status, bookmarks, progress across all devices)
export async function PATCH(request: NextRequest) {
  ensureStorageReady();
  try {
    const body = await request.json();
    const { id, status, bookmarks } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const updated = updateDocProgress(id, status, bookmarks);

    // Also update Supabase if configured
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

        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (status) updatePayload.status = status;
        if (bookmarks !== undefined) updatePayload.bookmarks = bookmarks;

        await (supabase.from('user_document_progress') as any).upsert({
          document_id: id,
          user_id: '00000000-0000-0000-0000-000000000000',
          ...updatePayload,
        });
      } catch (err) {
        console.warn('Supabase DB patch warning:', err);
      }
    }

    return NextResponse.json({
      success: true,
      documents: updated,
      deletedIds: getDeletedDocIds(),
    });
  } catch (err: any) {
    console.error('Failed to patch document:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update document' },
      { status: 500 }
    );
  }
}
