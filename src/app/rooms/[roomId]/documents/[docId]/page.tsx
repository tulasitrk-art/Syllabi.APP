'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSupabaseRoom } from '@/hooks/useSupabaseRoom';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function DocumentStudioPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === 'string' ? params.roomId : 'room-demo';
  const docId = typeof params?.docId === 'string' ? params.docId : '';

  const {
    documents,
    updateDocumentStatus,
    addBookmark,
  } = useSupabaseRoom(roomId);

  const doc = documents.find((d) => d.id === docId);

  if (!doc) {
    return (
      <div className="min-h-screen bg-pitch text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="ios-glass-card p-8 max-w-md w-full flex flex-col items-center">
          <FileQuestion className="w-12 h-12 text-white/30 mb-4" />
          <h2 className="text-base font-bold text-white">Document Not Found</h2>
          <p className="text-xs text-white/40 mt-1 mb-6">
            The requested syllabus document ID &quot;{docId}&quot; could not be retrieved from room
            records.
          </p>
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-xl hover:bg-white/90 transition-all shadow-glow"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Room Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DocumentViewer
      document={doc}
      roomId={roomId}
      onStatusChange={(status) => updateDocumentStatus(doc.id, status)}
      onAddBookmark={(page, title) => addBookmark(doc.id, page, title)}
    />
  );
}
