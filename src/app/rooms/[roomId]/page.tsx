'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSupabaseRoom } from '@/hooks/useSupabaseRoom';
import { RoomDashboard } from '@/components/rooms/RoomDashboard';

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === 'string' ? params.roomId : 'room-demo';

  const {
    roomInfo,
    documents,
    activePresences,
    isConnected,
    updateDocumentStatus,
    addDocument,
    deleteDocument,
  } = useSupabaseRoom(roomId);

  return (
    <RoomDashboard
      roomInfo={roomInfo}
      documents={documents}
      activePresences={activePresences}
      isConnected={isConnected}
      onStatusChange={updateDocumentStatus}
      onAddDocument={addDocument}
      onDeleteDocument={deleteDocument}
    />
  );
}
