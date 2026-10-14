import { NextRequest, NextResponse } from 'next/server';
import {
  ensureStorageReady,
  getDocAnnotations,
  saveDocAnnotations,
} from '@/lib/serverPdfStorage';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/documents/[docId]/annotations
export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  ensureStorageReady();
  const docId = params.docId;

  if (!docId) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  // Check Supabase if configured
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

      const { data: annotData } = await supabase
        .from('annotations')
        .select('*')
        .eq('document_id', docId);

      if (annotData && annotData.length > 0) {
        const geometries: Record<number, any> = {};
        annotData.forEach((row: any) => {
          geometries[row.page_number] = row.geometry;
        });

        const record = getDocAnnotations(docId);
        return NextResponse.json({
          ...record,
          geometries: { ...record.geometries, ...geometries },
          source: 'supabase',
        });
      }
    } catch (err) {
      console.warn('Supabase annotations fetch error:', err);
    }
  }

  const record = getDocAnnotations(docId);
  return NextResponse.json(record);
}

// POST /api/documents/[docId]/annotations
export async function POST(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  ensureStorageReady();
  const docId = params.docId;

  if (!docId) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { authorName, geometries, bookmarks, status, avatarColor } = body;

    const savedRecord = saveDocAnnotations(docId, {
      authorName: authorName || 'Anonymous Student',
      geometries: geometries || {},
      bookmarks,
      status,
      avatarColor,
    });

    // If Supabase configured, also push to annotations table
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

        // Insert / upsert each page geometry
        if (geometries) {
          for (const [pageNum, geom] of Object.entries(geometries)) {
            await supabase.from('annotations').upsert({
              document_id: docId,
              user_id: '00000000-0000-0000-0000-000000000000',
              page_number: Number(pageNum),
              geometry: geom as any,
              is_shared: true,
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn('Supabase annotation upsert warning:', err);
      }
    }

    return NextResponse.json({ success: true, record: savedRecord });
  } catch (err: any) {
    console.error('Error saving document annotations:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save annotations' },
      { status: 500 }
    );
  }
}
