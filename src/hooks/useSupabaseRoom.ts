'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
  PageAnnotationGeometry,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';

// Initial Mock Seed for Zero-Config Out-of-the-Box Local Execution
const DEFAULT_DEMO_DOCUMENTS: DocumentWithProgress[] = [
  {
    id: 'doc-ai-u1',
    roomId: 'room-demo',
    uploadedBy: 'user-lead',
    title: 'AI_Unit_1_Heuristic_Search_A_Star.pdf',
    subject: 'AI',
    unit: 1,
    syllabusTopic: 'A* Search, IDA*, Admissibility & Monotonicity',
    fileUrl: '/samples/ai-unit-1.pdf',
    totalPages: 8,
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    userProgress: {
      status: 'IN_PROGRESS',
      bookmarks: [
        { id: 'bm-1', pageNumber: 3, title: 'Admissible Heuristics Proof', createdAt: new Date().toISOString() },
        { id: 'bm-2', pageNumber: 7, title: 'IDA* Space Complexity Bounds', createdAt: new Date().toISOString() }
      ],
    },
    annotationCount: 14,
  },
  {
    id: 'doc-ads-u2',
    roomId: 'room-demo',
    uploadedBy: 'user-lead',
    title: 'ADS_Unit_2_Red_Black_Trees_B_Trees.pdf',
    subject: 'ADS',
    unit: 2,
    syllabusTopic: 'Red-Black Tree Rotations & 2-3-4 B-Tree Invariants',
    fileUrl: '/samples/ads-unit-2.pdf',
    totalPages: 12,
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    userProgress: {
      status: 'READ',
      bookmarks: [
        { id: 'bm-3', pageNumber: 4, title: 'Case 3 Double Rotation Matrix', createdAt: new Date().toISOString() }
      ],
    },
    annotationCount: 22,
  },
  {
    id: 'doc-devc-u3',
    roomId: 'room-demo',
    uploadedBy: 'user-architect',
    title: 'DEVC_Unit_3_Kubernetes_Pod_Networking.pdf',
    subject: 'DEVC',
    unit: 3,
    syllabusTopic: 'CNI Plugins, Calico vs Flannel, Ingress Controllers',
    fileUrl: '/samples/devc-unit-3.pdf',
    totalPages: 16,
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    userProgress: {
      status: 'NEEDS_REVISION',
      bookmarks: [],
    },
    annotationCount: 9,
  },
  {
    id: 'doc-java-u4',
    roomId: 'room-demo',
    uploadedBy: 'user-architect',
    title: 'JAVA_Unit_4_JVM_JMM_Virtual_Threads.pdf',
    subject: 'JAVA',
    unit: 4,
    syllabusTopic: 'Project Loom, Virtual Threads, Happens-Before Order',
    fileUrl: '/samples/java-unit-4.pdf',
    totalPages: 20,
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    userProgress: {
      status: 'UNREAD',
      bookmarks: [],
    },
    annotationCount: 5,
  },
  {
    id: 'doc-uhv-u1',
    roomId: 'room-demo',
    uploadedBy: 'user-peer',
    title: 'UHV_Unit_1_Self_Exploration_Harmony.pdf',
    subject: 'UHV',
    unit: 1,
    syllabusTopic: 'Harmony in the Human Being & Natural Acceptance',
    fileUrl: '/samples/uhv-unit-1.pdf',
    totalPages: 6,
    createdAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    userProgress: {
      status: 'READ',
      bookmarks: [],
    },
    annotationCount: 3,
  },
];

export function useSupabaseRoom(roomId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [documents, setDocuments] = useState<DocumentWithProgress[]>(DEFAULT_DEMO_DOCUMENTS);
  const [roomInfo, setRoomInfo] = useState<StudyRoomSummary>({
    id: roomId,
    name: 'CS Core — Fall 2026',
    joinCode: 'SYL-8492',
    createdBy: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date().toISOString(),
    memberCount: 4,
    documentCount: DEFAULT_DEMO_DOCUMENTS.length,
    userRole: 'owner',
  });
  const [activePresences, setActivePresences] = useState<UserPresence[]>([
    {
      userId: 'usr-1',
      userName: 'Lead Architect',
      activeDocId: 'doc-ai-u1',
      activePage: 3,
      lastSeen: new Date().toISOString(),
    },
    {
      userId: 'usr-2',
      userName: 'Rhea (Peer)',
      activeDocId: 'doc-ads-u2',
      activePage: 4,
      lastSeen: new Date().toISOString(),
    },
  ]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Check if live Supabase configuration is present
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://mock.supabase.co'
  );

  // Initial fetch and Realtime channel setup
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsConnected(true);
      return;
    }

    let isMounted = true;

    async function fetchRoomData() {
      try {
        // Fetch Room metadata
        const { data: roomData } = await (supabase
          .from('study_rooms')
          .select('*')
          .eq('id', roomId)
          .single() as any);

        if (roomData && isMounted) {
          setRoomInfo((prev) => ({
            ...prev,
            id: roomData.id,
            name: roomData.name,
            joinCode: roomData.join_code,
            createdBy: roomData.created_by,
            createdAt: roomData.created_at,
          }));
        }

        // Fetch Documents
        const { data: docsData } = await (supabase
          .from('documents')
          .select(`
            *,
            user_document_progress(*)
          `)
          .eq('room_id', roomId)
          .order('created_at', { ascending: false }) as any);

        if (docsData && isMounted) {
          const mapped: DocumentWithProgress[] = docsData.map((d: any) => {
            const prog = d.user_document_progress?.[0];
            return {
              id: d.id,
              roomId: d.room_id,
              uploadedBy: d.uploaded_by,
              title: d.title,
              subject: d.subject as SubjectCode,
              unit: d.unit,
              syllabusTopic: d.syllabus_topic,
              fileUrl: d.file_url,
              totalPages: d.total_pages,
              createdAt: d.created_at,
              userProgress: prog
                ? {
                    status: prog.status as DocumentStatus,
                    bookmarks: prog.bookmarks || [],
                  }
                : undefined,
            };
          });
          setDocuments(mapped);
        }
      } catch (err) {
        console.warn('Supabase fetch fallback:', err);
      }
    }

    fetchRoomData();

    // Subscribe to Realtime Postgres Changes
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `room_id=eq.${roomId}` },
        () => {
          fetchRoomData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_document_progress' },
        () => {
          fetchRoomData();
        }
      )
      .subscribe((status) => {
        if (isMounted) {
          setIsConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, isSupabaseConfigured]);

  // Update document status checklist
  const updateDocumentStatus = useCallback(
    async (documentId: string, status: DocumentStatus) => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id === documentId) {
            return {
              ...doc,
              userProgress: {
                status,
                bookmarks: doc.userProgress?.bookmarks || [],
              },
            };
          }
          return doc;
        })
      );

      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (!userId) return;

          await (supabase.from('user_document_progress') as any).upsert({
            document_id: documentId,
            user_id: userId,
            status,
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Error updating progress status:', err);
        }
      }
    },
    [isSupabaseConfigured, supabase]
  );

  // Add Bookmark
  const addBookmark = useCallback(
    async (documentId: string, pageNumber: number, title: string) => {
      const newBm: Bookmark = {
        id: `bm_${Date.now()}`,
        pageNumber,
        title,
        createdAt: new Date().toISOString(),
      };

      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id === documentId) {
            const currentBms = doc.userProgress?.bookmarks || [];
            return {
              ...doc,
              userProgress: {
                status: doc.userProgress?.status || 'IN_PROGRESS',
                bookmarks: [...currentBms, newBm],
              },
            };
          }
          return doc;
        })
      );

      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (!userId) return;

          const targetDoc = documents.find((d) => d.id === documentId);
          const updatedBms = [...(targetDoc?.userProgress?.bookmarks || []), newBm];

          await (supabase.from('user_document_progress') as any).upsert({
            document_id: documentId,
            user_id: userId,
            bookmarks: updatedBms as any,
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to sync bookmark:', err);
        }
      }
    },
    [documents, isSupabaseConfigured, supabase]
  );

  // Upload or register a new document
  const addDocument = useCallback(
    async (payload: {
      title: string;
      subject: SubjectCode;
      unit: number;
      syllabusTopic: string;
      totalPages?: number;
      fileUrl?: string;
    }) => {
      const newDoc: DocumentWithProgress = {
        id: `doc_${Date.now()}`,
        roomId,
        uploadedBy: 'current-user',
        title: payload.title,
        subject: payload.subject,
        unit: payload.unit,
        syllabusTopic: payload.syllabusTopic,
        fileUrl: payload.fileUrl || '/samples/default-syllabus.pdf',
        totalPages: payload.totalPages || 10,
        createdAt: new Date().toISOString(),
        userProgress: {
          status: 'UNREAD',
          bookmarks: [],
        },
        annotationCount: 0,
      };

      setDocuments((prev) => [newDoc, ...prev]);

      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          await (supabase.from('documents') as any).insert({
            room_id: roomId,
            uploaded_by: userData?.user?.id || '00000000-0000-0000-0000-000000000000',
            title: payload.title,
            subject: payload.subject,
            unit: payload.unit,
            syllabus_topic: payload.syllabusTopic,
            file_url: payload.fileUrl || '/samples/default-syllabus.pdf',
            total_pages: payload.totalPages || 10,
          });
        } catch (err) {
          console.error('Failed to insert document:', err);
        }
      }
    },
    [roomId, isSupabaseConfigured, supabase]
  );

  return {
    roomInfo,
    documents,
    activePresences,
    isConnected,
    updateDocumentStatus,
    addBookmark,
    addDocument,
  };
}
