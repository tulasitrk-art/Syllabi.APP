'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';

export function useSupabaseRoom(roomId: string) {
  const supabase = useMemo(() => createClient(), []);
  
  // No default mock PDFs - clean slate ready for student uploads
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [roomInfo, setRoomInfo] = useState<StudyRoomSummary>({
    id: roomId,
    name: 'CS Core — Fall 2026',
    joinCode: 'SYL-8492',
    createdBy: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date().toISOString(),
    memberCount: 1,
    documentCount: 0,
    userRole: 'owner',
  });
  
  const [activePresences, setActivePresences] = useState<UserPresence[]>([
    {
      userId: 'usr-current',
      userName: 'Current Student',
      activePage: 1,
      lastSeen: new Date().toISOString(),
    },
  ]);
  
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Check if live Supabase configuration is present
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://mock.supabase.co'
  );

  // Load local persistent documents if offline / no supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`syllabi_docs_${roomId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDocuments(parsed);
          }
        }
      } catch (e) {
        console.warn('Could not read stored documents:', e);
      }
    }
  }, [roomId]);

  // Sync to local storage
  const syncToLocalStorage = useCallback((docs: DocumentWithProgress[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`syllabi_docs_${roomId}`, JSON.stringify(docs));
      } catch (e) {
        console.warn('Could not save to localStorage:', e);
      }
    }
  }, [roomId]);

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
          syncToLocalStorage(mapped);
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
  }, [roomId, supabase, isSupabaseConfigured, syncToLocalStorage]);

  // Update document status checklist
  const updateDocumentStatus = useCallback(
    async (documentId: string, status: DocumentStatus) => {
      setDocuments((prev) => {
        const next = prev.map((doc) => {
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
        });
        syncToLocalStorage(next);
        return next;
      });

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
    [isSupabaseConfigured, supabase, syncToLocalStorage]
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

      setDocuments((prev) => {
        const next = prev.map((doc) => {
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
        });
        syncToLocalStorage(next);
        return next;
      });

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
    [documents, isSupabaseConfigured, supabase, syncToLocalStorage]
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
        fileUrl: payload.fileUrl || '',
        totalPages: payload.totalPages || 1,
        createdAt: new Date().toISOString(),
        userProgress: {
          status: 'UNREAD',
          bookmarks: [],
        },
        annotationCount: 0,
      };

      setDocuments((prev) => {
        const next = [newDoc, ...prev];
        syncToLocalStorage(next);
        return next;
      });

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
            file_url: payload.fileUrl || '',
            total_pages: payload.totalPages || 1,
          });
        } catch (err) {
          console.error('Failed to insert document:', err);
        }
      }

      return newDoc;
    },
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  // Delete a document
  const deleteDocument = useCallback(
    async (documentId: string) => {
      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== documentId);
        syncToLocalStorage(next);
        return next;
      });

      if (isSupabaseConfigured) {
        try {
          await (supabase.from('documents') as any).delete().eq('id', documentId);
        } catch (err) {
          console.error('Failed to delete document:', err);
        }
      }
    },
    [isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  return {
    roomInfo,
    documents,
    activePresences,
    isConnected,
    updateDocumentStatus,
    addBookmark,
    addDocument,
    deleteDocument,
  };
}
