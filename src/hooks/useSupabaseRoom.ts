'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';
import { savePdfBlob, deletePdfBlob } from '@/lib/pdfStorage';
import { generateSyllabusPdfBuffer } from '@/lib/syllabusPdfGenerator';

export function useSupabaseRoom(roomId: string) {
  const supabase = useMemo(() => createClient(), []);

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

  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Set of permanently deleted document IDs to prevent background polling resurrection
  const deletedDocIdsRef = useRef<Set<string>>(new Set());

  // Check if live Supabase configuration is present
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://mock.supabase.co'
  );

  // Sync documents array to local storage for instant offline read
  const syncToLocalStorage = useCallback((docs: DocumentWithProgress[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`syllabi_docs_${roomId}`, JSON.stringify(docs));
      } catch (e) {
        console.warn('Could not save to localStorage:', e);
      }
    }
  }, [roomId]);

  // Merge helper: combines server and local documents without duplicates and filters out deleted
  const mergeDocuments = useCallback(
    (existing: DocumentWithProgress[], incoming: DocumentWithProgress[]) => {
      const map = new Map<string, DocumentWithProgress>();
      // Put incoming first, skipping permanently deleted
      incoming.forEach((doc) => {
        if (!deletedDocIdsRef.current.has(doc.id)) {
          map.set(doc.id, doc);
        }
      });
      // Overlay with existing
      existing.forEach((doc) => {
        if (!deletedDocIdsRef.current.has(doc.id)) {
          if (map.has(doc.id)) {
            const inc = map.get(doc.id)!;
            map.set(doc.id, {
              ...inc,
              userProgress: doc.userProgress || inc.userProgress,
            });
          } else {
            map.set(doc.id, doc);
          }
        }
      });
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    []
  );

  // Fetch from Universal Server API route (/api/documents)
  const fetchUniversalDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?roomId=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.documents)) {
          setDocuments((prev) => {
            const merged = mergeDocuments(prev, json.documents);
            syncToLocalStorage(merged);
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('Could not poll universal documents API:', err);
    }
  }, [roomId, mergeDocuments, syncToLocalStorage]);

  // Initial load: 1. Deleted IDs -> 2. LocalStorage -> 3. Universal API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Load tombstone deleted IDs
        const storedDeleted = localStorage.getItem(`syllabi_deleted_${roomId}`);
        if (storedDeleted) {
          const parsed = JSON.parse(storedDeleted);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => deletedDocIdsRef.current.add(id));
          }
        }

        // Instant load from local storage
        const stored = localStorage.getItem(`syllabi_docs_${roomId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((d: any) => !deletedDocIdsRef.current.has(d.id));
            setDocuments(filtered);
          }
        }
      } catch (e) {
        console.warn('Local storage read error:', e);
      }
    }

    // Fetch from shared server API
    fetchUniversalDocuments();

    // Periodic background polling
    const pollInterval = setInterval(() => {
      fetchUniversalDocuments();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [roomId, fetchUniversalDocuments]);

  // Supabase Realtime channel setup (when Supabase credentials exist)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsConnected(true);
      return;
    }

    let isMounted = true;

    async function fetchRoomData() {
      try {
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

        const { data: docsData } = await (supabase
          .from('documents')
          .select(`*, user_document_progress(*)`)
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

          setDocuments((prev) => {
            const merged = mergeDocuments(prev, mapped);
            syncToLocalStorage(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Supabase fetch fallback:', err);
      }
    }

    fetchRoomData();

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
  }, [roomId, supabase, isSupabaseConfigured, mergeDocuments, syncToLocalStorage]);

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

  // Upload or register a new document to shared server & local store
  const addDocument = useCallback(
    async (payload: {
      title: string;
      subject: SubjectCode;
      unit: number;
      syllabusTopic: string;
      totalPages?: number;
      fileUrl?: string;
      file?: File | null;
      buffer?: ArrayBuffer | null;
    }): Promise<DocumentWithProgress> => {
      let createdDoc: DocumentWithProgress | null = null;

      // 1. Resolve or generate valid PDF buffer
      let bufferToPersist: ArrayBuffer | null = payload.buffer ? payload.buffer.slice(0) : null;
      if (!bufferToPersist && payload.file) {
        try {
          bufferToPersist = await payload.file.arrayBuffer();
        } catch {
          // ignore
        }
      }
      if (!bufferToPersist || bufferToPersist.byteLength === 0) {
        bufferToPersist = generateSyllabusPdfBuffer({
          title: payload.title,
          subject: payload.subject,
          unit: payload.unit,
          syllabusTopic: payload.syllabusTopic,
          totalPages: payload.totalPages || 1,
        });
      }

      // 2. Upload to shared universal API route with file/blob
      try {
        const formData = new FormData();
        if (payload.file) {
          formData.append('file', payload.file);
        } else if (bufferToPersist) {
          const pdfBlob = new Blob([bufferToPersist.slice(0)], { type: 'application/pdf' });
          formData.append('file', pdfBlob, payload.title.endsWith('.pdf') ? payload.title : `${payload.title}.pdf`);
        }
        formData.append('title', payload.title);
        formData.append('subject', payload.subject);
        formData.append('unit', String(payload.unit));
        formData.append('syllabusTopic', payload.syllabusTopic);
        formData.append('totalPages', String(payload.totalPages || 1));
        formData.append('roomId', roomId);

        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.document) {
            createdDoc = data.document;
          }
        }
      } catch (err) {
        console.warn('Universal upload API warning:', err);
      }

      // 3. Fallback creation if offline or direct
      if (!createdDoc) {
        const docId = `doc_${Date.now()}`;
        createdDoc = {
          id: docId,
          roomId,
          uploadedBy: 'current-user',
          title: payload.title,
          subject: payload.subject,
          unit: payload.unit,
          syllabusTopic: payload.syllabusTopic,
          fileUrl: payload.fileUrl || `/api/documents/${docId}/file`,
          totalPages: payload.totalPages || 1,
          createdAt: new Date().toISOString(),
          userProgress: {
            status: 'UNREAD',
            bookmarks: [],
          },
          annotationCount: 0,
        };
      }

      // 4. Immediately cache binary in local IndexedDB for instant 0ms uploader experience
      if (bufferToPersist && createdDoc) {
        await savePdfBlob(createdDoc.id, bufferToPersist.slice(0));
      }

      // Remove from tombstone set if re-uploaded
      deletedDocIdsRef.current.delete(createdDoc.id);

      // 4. Update local state & storage
      setDocuments((prev) => {
        const next = [createdDoc!, ...prev.filter((d) => d.id !== createdDoc!.id)];
        syncToLocalStorage(next);
        return next;
      });

      // 5. Supabase direct DB insert if configured
      if (isSupabaseConfigured && createdDoc) {
        try {
          await (supabase.from('documents') as any).insert({
            id: createdDoc.id,
            room_id: roomId,
            uploaded_by: '00000000-0000-0000-0000-000000000000',
            title: createdDoc.title,
            subject: createdDoc.subject,
            unit: createdDoc.unit,
            syllabus_topic: createdDoc.syllabusTopic,
            file_url: createdDoc.fileUrl || '',
            total_pages: createdDoc.totalPages || 1,
          });
        } catch (err) {
          console.warn('Supabase DB insert fallback:', err);
        }
      }

      return createdDoc;
    },
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  // Permanently delete a document across memory, localStorage, IndexedDB, and server storage
  const deleteDocument = useCallback(
    async (documentId: string) => {
      // 1. Mark in tombstone set to prevent polling revival
      deletedDocIdsRef.current.add(documentId);
      if (typeof window !== 'undefined') {
        try {
          const currentDeleted = JSON.parse(
            localStorage.getItem(`syllabi_deleted_${roomId}`) || '[]'
          );
          localStorage.setItem(
            `syllabi_deleted_${roomId}`,
            JSON.stringify(Array.from(new Set([...currentDeleted, documentId])))
          );
        } catch {
          // ignore
        }
      }

      // 2. Remove immediately from local state & storage
      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== documentId);
        syncToLocalStorage(next);
        return next;
      });

      // 3. Permanently remove from client IndexedDB
      deletePdfBlob(documentId).catch(() => {});

      // 4. Permanently remove from server storage API
      fetch(`/api/documents?id=${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      }).catch((e) => console.warn('Server delete error:', e));

      // 5. Delete from Supabase if configured
      if (isSupabaseConfigured) {
        try {
          await (supabase.from('documents') as any).delete().eq('id', documentId);
        } catch (err) {
          console.error('Failed to delete document from Supabase:', err);
        }
      }
    },
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
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
