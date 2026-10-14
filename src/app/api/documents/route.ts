import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  ensureStorageReady,
  getDocsIndex,
  saveDocsIndex,
  savePdfToDisk,
  deleteDocFromDisk,
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
          return NextResponse.json({ documents: mapped, source: 'supabase' }, {
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
      { documents: sorted, source: 'universal_store' },
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

    savePdfToDisk(docId, pdfBuffer);

    const fileUrl = `/api/documents/${docId}/file`;

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

    // 2. If Supabase is configured, sync to Supabase database too
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

        await supabase.from('documents').insert({
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
    }

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

  return NextResponse.json({ success: true, deletedId: docId });
}
