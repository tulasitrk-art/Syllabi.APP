'use client';

import React from 'react';
import { useSupabaseRoom } from '@/hooks/useSupabaseRoom';
import { RoomDashboard } from '@/components/rooms/RoomDashboard';

export default function HomePage() {
  const {
    roomInfo,
    documents,
    activePresences,
    isConnected,
    updateDocumentStatus,
    addDocument,
    deleteDocument,
  } = useSupabaseRoom('room-demo');

  return (
    <RoomDashboard
      roomInfo={roomInfo}
      documents={documents}
      activePresences={activePresences}
      isConnected={isConnected}
      onStatusChange={updateDocumentStatus}
      onAddDocument={addDocument}
      onDeleteDocument={deleteDocument}
      isHomePage={true}
    />
  );
}

