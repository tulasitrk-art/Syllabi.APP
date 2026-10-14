import { NextRequest, NextResponse } from 'next/server';
import {
  ensureStorageReady,
  getNoticesIndex,
  saveNotice,
  deleteNotice,
  likeNotice,
} from '@/lib/serverPdfStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/notices?roomId=...
export async function GET(request: NextRequest) {
  ensureStorageReady();
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get('roomId') || 'room-demo';

  const notices = getNoticesIndex(roomId);
  return NextResponse.json({ notices });
}

// POST /api/notices (Create / Broadcast new notice)
export async function POST(request: NextRequest) {
  ensureStorageReady();
  try {
    const body = await request.json();
    const { title, content, author, category, isPinned, roomId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Notice title and content are required' },
        { status: 400 }
      );
    }

    const newNotice = {
      id: `notice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      content: content.trim(),
      author: (author || 'Anonymous Student').trim(),
      category: category || 'General',
      createdAt: new Date().toISOString(),
      likes: 0,
      isPinned: Boolean(isPinned),
      roomId: roomId || 'room-demo',
    };

    const updated = saveNotice(newNotice);
    return NextResponse.json({ success: true, notice: newNotice, notices: updated });
  } catch (err: any) {
    console.error('Error posting notice:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save notice' },
      { status: 500 }
    );
  }
}

// DELETE /api/notices?id=...
export async function DELETE(request: NextRequest) {
  ensureStorageReady();
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing notice id' }, { status: 400 });
  }

  const updated = deleteNotice(id);
  return NextResponse.json({ success: true, deletedId: id, notices: updated });
}

// PATCH /api/notices?id=...&action=like
export async function PATCH(request: NextRequest) {
  ensureStorageReady();
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const action = searchParams.get('action') || 'like';

  if (!id) {
    return NextResponse.json({ error: 'Missing notice id' }, { status: 400 });
  }

  if (action === 'like') {
    const updated = likeNotice(id);
    return NextResponse.json({ success: true, notices: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
