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
  // In-flight / recent uploads guard to prevent any disappearing/blinking
  const recentUploadsRef = useRef<Map<string, { doc: DocumentWithProgress; time: number }>>(new Map());

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

  // Fetch from Universal Server API route (/api/documents)
  const fetchUniversalDocuments = useCallback(async () => {
    try {
      const clientDeleted = Array.from(deletedDocIdsRef.current).join(',');
      const url = `/api/documents?roomId=${encodeURIComponent(roomId)}${
        clientDeleted ? `&deletedIds=${encodeURIComponent(clientDeleted)}` : ''
      }`;
      const res = await fetch(url, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();

        // 1. Ingest any deleted IDs reported by the server
        if (Array.isArray(json?.deletedIds)) {
          let hasNewDeleted = false;
          json.deletedIds.forEach((id: string) => {
            if (typeof id === 'string' && id && !deletedDocIdsRef.current.has(id)) {
              deletedDocIdsRef.current.add(id);
              hasNewDeleted = true;
            }
          });
          if (hasNewDeleted && typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `syllabi_deleted_${roomId}`,
                JSON.stringify(Array.from(deletedDocIdsRef.current))
              );
            } catch {}
          }
        }

        if (Array.isArray(json?.documents)) {
          setDocuments((prev) => {
            // Filter out any document that was marked deleted
            const srvDocs: any[] = json.documents.filter(
              (doc: any) => !deletedDocIdsRef.current.has(doc.id)
            );

            // Clean up confirmed uploads from recent uploads map
            const now = Date.now();
            const srvMap = new Map(srvDocs.map((d: any) => [d.id, d]));
            recentUploadsRef.current.forEach((val, docId) => {
              if (srvMap.has(docId) || deletedDocIdsRef.current.has(docId) || now - val.time > 30000) {
                recentUploadsRef.current.delete(docId);
              }
            });

            // 1. Start with server documents (which are verified not deleted)
            const mergedMap = new Map<string, DocumentWithProgress>();
            srvDocs.forEach((srvDoc: any) => {
              mergedMap.set(srvDoc.id, {
                ...srvDoc,
                userProgress: srvDoc.userProgress || { status: 'UNREAD', bookmarks: [] },
                savedContributors: srvDoc.savedContributors || [],
                savedDrafts: srvDoc.savedDrafts || [],
                savedAnnotations: srvDoc.savedAnnotations,
                annotationCount: srvDoc.annotationCount || 0,
              });
            });

            // 2. CRITICAL ANTI-BLINKING / PERSISTENCE PRESERVATION:
            // Any document in prev that was NOT marked deleted must be preserved!
            // An alternate/cold serverless lambda returning [] must NEVER cause an active document to vanish or blink.
            prev.forEach((prevDoc) => {
              if (!deletedDocIdsRef.current.has(prevDoc.id)) {
                if (!mergedMap.has(prevDoc.id)) {
                  mergedMap.set(prevDoc.id, prevDoc);
                }
              }
            });

            // 3. Retain any recent local in-flight uploads that were not deleted
            recentUploadsRef.current.forEach((val, docId) => {
              if (!deletedDocIdsRef.current.has(docId)) {
                if (!mergedMap.has(docId)) {
                  mergedMap.set(docId, val.doc);
                }
              }
            });

            // Sort newest first
            const updated: DocumentWithProgress[] = Array.from(mergedMap.values()).sort((a, b) => {
              const ta = new Date(a.createdAt || 0).getTime();
              const tb = new Date(b.createdAt || 0).getTime();
              return tb - ta;
            });

            // Anti-thrashing equality check: if length and contents haven't changed, retain reference
            const isIdentical =
              prev.length === updated.length &&
              prev.every((p, idx) => {
                const u = updated[idx];
                if (!u || p.id !== u.id) return false;
                if (p.userProgress?.status !== u.userProgress?.status) return false;
                if ((p.userProgress?.bookmarks?.length || 0) !== (u.userProgress?.bookmarks?.length || 0)) return false;
                if ((p.annotationCount || 0) !== (u.annotationCount || 0)) return false;
                if ((p.savedContributors?.length || 0) !== (u.savedContributors?.length || 0)) return false;
                if ((p.savedDrafts?.length || 0) !== (u.savedDrafts?.length || 0)) return false;
                return true;
              });

            if (isIdentical) {
              return prev;
            }

            syncToLocalStorage(updated);

            // If this lambda was cold (returned 0 documents) but client has verified active documents,
            // seed the cold lambda in the background so all future requests to it succeed immediately
            if (json.documents.length === 0 && updated.length > 0) {
              updated.forEach((d) => {
                fetch('/api/documents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    docId: d.id,
                    title: d.title,
                    subject: d.subject,
                    unit: d.unit,
                    syllabusTopic: d.syllabusTopic,
                    totalPages: d.totalPages,
                    roomId,
                    fileUrl: d.fileUrl,
                  }),
                }).catch(() => {});
              });
            }

            return updated;
          });
        }
      }
    } catch (err) {
      console.warn('Could not poll universal documents API:', err);
    }
  }, [roomId, syncToLocalStorage]);

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

    // 2-second real-time polling so all 10+ users see uploaded or deleted documents synchronously
    const pollInterval = setInterval(() => {
      fetchUniversalDocuments();
    }, 2000);

    // BroadcastChannel for instant local cross-tab sync
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
        bc.onmessage = (e) => {
          if (e.data?.type === 'DOCUMENTS_UPDATED') {
            fetchUniversalDocuments();
          }
        };
      }
    } catch {}

    return () => {
      clearInterval(pollInterval);
      if (bc) bc.close();
    };
  }, [roomId, fetchUniversalDocuments]);

  // Supabase Realtime channel setup (when Supabase credentials exist)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsConnected(true);
      return;
    }

    let isMounted = true;

    async function fetchRoomMeta() {
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
      } catch (err) {
        // Room fallback
      }
    }

    fetchRoomMeta();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `room_id=eq.${roomId}` },
        () => {
          fetchUniversalDocuments();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_document_progress' },
        () => {
          fetchUniversalDocuments();
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
  }, [roomId, supabase, isSupabaseConfigured, fetchUniversalDocuments]);

  // Update document status checklist across all devices
  const updateDocumentStatus = useCallback(
    async (documentId: string, status: DocumentStatus) => {
      // 1. Optimistic update
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

      // 2. Broadcast to server universal store so ALL other devices update immediately
      try {
        await fetch('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: documentId, status }),
        });
      } catch (err) {
        console.warn('Universal store status patch warning:', err);
      }

      // 3. Broadcast to other local browser tabs
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
          bc.postMessage({ type: 'DOCUMENTS_UPDATED' });
          bc.close();
        }
      } catch {}

      // 4. Supabase direct DB update if configured
      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
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
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  // Add Bookmark across all devices
  const addBookmark = useCallback(
    async (documentId: string, pageNumber: number, title: string) => {
      const newBm: Bookmark = {
        id: `bm_${Date.now()}`,
        pageNumber,
        title,
        createdAt: new Date().toISOString(),
      };

      let updatedBms: Bookmark[] = [newBm];

      // 1. Optimistic update
      setDocuments((prev) => {
        const next = prev.map((doc) => {
          if (doc.id === documentId) {
            const currentBms = (doc.userProgress?.bookmarks || []).filter(
              (b) => b.pageNumber !== pageNumber
            );
            updatedBms = [...currentBms, newBm];
            return {
              ...doc,
              userProgress: {
                status: doc.userProgress?.status || 'IN_PROGRESS',
                bookmarks: updatedBms,
              },
            };
          }
          return doc;
        });
        syncToLocalStorage(next);
        return next;
      });

      // 2. Broadcast to server universal store so ALL other devices update immediately
      try {
        await fetch('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: documentId, bookmarks: updatedBms }),
        });
      } catch (err) {
        console.warn('Universal store bookmark patch warning:', err);
      }

      // 3. Broadcast to other local browser tabs
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
          bc.postMessage({ type: 'DOCUMENTS_UPDATED' });
          bc.close();
        }
      } catch {}

      // 4. Supabase direct DB update if configured
      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
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
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  // Remove Bookmark across all devices
  const removeBookmark = useCallback(
    async (documentId: string, pageNumber: number) => {
      let updatedBms: Bookmark[] = [];

      // 1. Optimistic update
      setDocuments((prev) => {
        const next = prev.map((doc) => {
          if (doc.id === documentId) {
            updatedBms = (doc.userProgress?.bookmarks || []).filter(
              (b) => b.pageNumber !== pageNumber
            );
            return {
              ...doc,
              userProgress: {
                ...doc.userProgress,
                status: doc.userProgress?.status || 'UNREAD',
                bookmarks: updatedBms,
              },
            };
          }
          return doc;
        });
        syncToLocalStorage(next);
        return next;
      });

      // 2. Broadcast to server universal store
      try {
        await fetch('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: documentId, bookmarks: updatedBms }),
        });
      } catch (err) {
        console.warn('Universal store remove bookmark patch warning:', err);
      }

      // 3. Broadcast to other local browser tabs
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
          bc.postMessage({ type: 'DOCUMENTS_UPDATED' });
          bc.close();
        }
      } catch {}

      // 4. Supabase direct DB update if configured
      if (isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
          await (supabase.from('user_document_progress') as any).upsert({
            document_id: documentId,
            user_id: userId,
            bookmarks: updatedBms as any,
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to sync remove bookmark to Supabase:', err);
        }
      }
    },
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
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

      // 2. Pre-generate unified docId so client cache and server store stay 100% matched
      const clientDocId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 3. Upload to shared universal API route with file/blob
      try {
        const formData = new FormData();
        formData.append('docId', clientDocId);
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

      // 4. Fallback creation if offline or direct
      if (!createdDoc) {
        let fallbackUrl = payload.fileUrl || `/api/documents/${clientDocId}/file`;
        if (bufferToPersist && bufferToPersist.byteLength < 12 * 1024 * 1024) {
          try {
            const bytes = new Uint8Array(bufferToPersist);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.byteLength; i += chunkSize) {
              binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
            }
            fallbackUrl = `data:application/pdf;base64,${btoa(binary)}`;
          } catch {}
        }

        createdDoc = {
          id: clientDocId,
          roomId,
          uploadedBy: 'student-visitor',
          title: payload.title,
          subject: payload.subject,
          unit: payload.unit,
          syllabusTopic: payload.syllabusTopic,
          fileUrl: fallbackUrl,
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

      // Register in recent uploads guard to prevent any disappearing/blinking
      recentUploadsRef.current.set(createdDoc.id, { doc: createdDoc, time: Date.now() });

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

      // Notify other tabs immediately
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
          bc.postMessage({ type: 'DOCUMENTS_UPDATED' });
          bc.close();
        }
      } catch {}

      return createdDoc;
    },
    [roomId, isSupabaseConfigured, supabase, syncToLocalStorage]
  );

  // Permanently delete a document across memory, localStorage, IndexedDB, and server storage
  const deleteDocument = useCallback(
    async (documentId: string) => {
      // 1. Mark in tombstone set to prevent polling revival
      deletedDocIdsRef.current.add(documentId);
      recentUploadsRef.current.delete(documentId);
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
      try {
        await fetch(`/api/documents?id=${encodeURIComponent(documentId)}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.warn('Server delete error:', e);
      }

      // Notify other tabs
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_sync_${roomId}`);
          bc.postMessage({ type: 'DOCUMENTS_UPDATED' });
          bc.close();
        }
      } catch {}

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
    removeBookmark,
    addDocument,
    deleteDocument,
  };
}
