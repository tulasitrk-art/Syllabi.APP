import fs from 'fs';
import path from 'path';

// Server-side persistent storage paths
const STORAGE_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? '/tmp/syllabi_store'
  : path.join(process.cwd(), '.syllabi_store');
const DOCS_INDEX_FILE = path.join(STORAGE_DIR, 'documents.json');
const NOTICES_INDEX_FILE = path.join(STORAGE_DIR, 'notices.json');
const DELETED_IDS_FILE = path.join(STORAGE_DIR, 'deleted_ids.json');
const PDFS_DIR = path.join(STORAGE_DIR, 'pdfs');
const ANNOTATIONS_DIR = path.join(STORAGE_DIR, 'annotations');

let memoryDocsCache: any[] = [];
let memoryNoticesCache: any[] = [];
let memoryDeletedIds = new Set<string>();
let isInitialized = false;

export function ensureStorageReady() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(PDFS_DIR)) {
      fs.mkdirSync(PDFS_DIR, { recursive: true });
    }
    if (!fs.existsSync(ANNOTATIONS_DIR)) {
      fs.mkdirSync(ANNOTATIONS_DIR, { recursive: true });
    }

    if (!isInitialized) {
      if (fs.existsSync(DOCS_INDEX_FILE)) {
        const data = fs.readFileSync(DOCS_INDEX_FILE, 'utf-8');
        memoryDocsCache = JSON.parse(data);
      } else {
        memoryDocsCache = [];
        fs.writeFileSync(DOCS_INDEX_FILE, JSON.stringify([]));
      }

      if (fs.existsSync(NOTICES_INDEX_FILE)) {
        const data = fs.readFileSync(NOTICES_INDEX_FILE, 'utf-8');
        memoryNoticesCache = JSON.parse(data);
      } else {
        memoryNoticesCache = [];
        fs.writeFileSync(NOTICES_INDEX_FILE, JSON.stringify([]));
      }

      if (fs.existsSync(DELETED_IDS_FILE)) {
        try {
          const data = fs.readFileSync(DELETED_IDS_FILE, 'utf-8');
          const arr = JSON.parse(data);
          if (Array.isArray(arr)) {
            arr.forEach((id: string) => memoryDeletedIds.add(id));
          }
        } catch {}
      } else {
        fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify([]));
      }

      isInitialized = true;
    }
  } catch (err) {
    console.warn('Storage init fallback to memory-only:', err);
    memoryDocsCache = memoryDocsCache || [];
    memoryNoticesCache = memoryNoticesCache || [];
    isInitialized = true;
  }
}

// ----------------- DOCUMENTS -----------------

export function getDocsIndex(): any[] {
  ensureStorageReady();
  try {
    if (fs.existsSync(DOCS_INDEX_FILE)) {
      const data = fs.readFileSync(DOCS_INDEX_FILE, 'utf-8');
      memoryDocsCache = JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read docs index from disk, using memory cache:', err);
  }
  return memoryDocsCache;
}

export function saveDocsIndex(docs: any[]) {
  memoryDocsCache = docs;
  try {
    ensureStorageReady();
    fs.writeFileSync(DOCS_INDEX_FILE, JSON.stringify(docs, null, 2));
  } catch (err) {
    console.warn('Could not persist index to disk:', err);
  }
}

export function savePdfToDisk(docId: string, buffer: Buffer) {
  try {
    ensureStorageReady();
    const filePath = path.join(PDFS_DIR, `${docId}.pdf`);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn('Could not save PDF file to disk:', err);
  }
}

export function getPdfFromDisk(docId: string): Buffer | null {
  try {
    ensureStorageReady();
    const filePath = path.join(PDFS_DIR, `${docId}.pdf`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch (err) {
    console.warn('Could not read PDF file from disk:', err);
  }
  return null;
}

export function getDeletedDocIds(): string[] {
  ensureStorageReady();
  try {
    if (fs.existsSync(DELETED_IDS_FILE)) {
      const data = fs.readFileSync(DELETED_IDS_FILE, 'utf-8');
      const arr = JSON.parse(data);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => memoryDeletedIds.add(id));
      }
    }
  } catch {}
  return Array.from(memoryDeletedIds);
}

export function markDocDeleted(docId: string) {
  ensureStorageReady();
  memoryDeletedIds.add(docId);
  try {
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(Array.from(memoryDeletedIds), null, 2));
  } catch {}
}

export function unmarkDocDeleted(docId: string) {
  ensureStorageReady();
  memoryDeletedIds.delete(docId);
  try {
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(Array.from(memoryDeletedIds), null, 2));
  } catch {}
}

export function updateDocProgress(docId: string, status?: string, bookmarks?: any[]): any[] {
  ensureStorageReady();
  const all = getDocsIndex();
  memoryDocsCache = all.map((d) => {
    if (d.id === docId) {
      return {
        ...d,
        userProgress: {
          status: status || d.userProgress?.status || 'UNREAD',
          bookmarks: bookmarks !== undefined ? bookmarks : (d.userProgress?.bookmarks || []),
        },
      };
    }
    return d;
  });
  saveDocsIndex(memoryDocsCache);
  return memoryDocsCache;
}

export function deleteDocFromDisk(docId: string) {
  try {
    ensureStorageReady();
    // 1. Record in persistent tombstones so all devices know it was deleted
    markDocDeleted(docId);

    // 2. Remove from documents index
    const all = getDocsIndex();
    memoryDocsCache = all.filter((d) => d.id !== docId);
    saveDocsIndex(memoryDocsCache);

    // 3. Remove PDF file from disk
    const filePath = path.join(PDFS_DIR, `${docId}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 4. Remove annotations file from disk
    const annotPath = path.join(ANNOTATIONS_DIR, `${docId}.json`);
    if (fs.existsSync(annotPath)) {
      fs.unlinkSync(annotPath);
    }
  } catch (err) {
    console.warn('Could not delete doc from disk:', err);
  }
}

// ----------------- NOTICES -----------------

export function getNoticesIndex(roomId?: string): any[] {
  ensureStorageReady();
  try {
    if (fs.existsSync(NOTICES_INDEX_FILE)) {
      const data = fs.readFileSync(NOTICES_INDEX_FILE, 'utf-8');
      memoryNoticesCache = JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read notices index from disk:', err);
  }

  if (roomId) {
    return memoryNoticesCache.filter((n) => !n.roomId || n.roomId === roomId);
  }
  return memoryNoticesCache;
}

export function saveNotice(notice: any): any[] {
  ensureStorageReady();
  const all = getNoticesIndex();
  // Filter out any with same ID if updating
  const filtered = all.filter((n) => n.id !== notice.id);
  const updated = [notice, ...filtered];
  memoryNoticesCache = updated;

  try {
    fs.writeFileSync(NOTICES_INDEX_FILE, JSON.stringify(updated, null, 2));
  } catch (err) {
    console.warn('Could not save notice to disk:', err);
  }
  return updated;
}

export function deleteNotice(noticeId: string): any[] {
  ensureStorageReady();
  const all = getNoticesIndex();
  const updated = all.filter((n) => n.id !== noticeId);
  memoryNoticesCache = updated;

  try {
    fs.writeFileSync(NOTICES_INDEX_FILE, JSON.stringify(updated, null, 2));
  } catch (err) {
    console.warn('Could not delete notice from disk:', err);
  }
  return updated;
}

export function likeNotice(noticeId: string): any[] {
  ensureStorageReady();
  const all = getNoticesIndex();
  const updated = all.map((n) => (n.id === noticeId ? { ...n, likes: (n.likes || 0) + 1 } : n));
  memoryNoticesCache = updated;

  try {
    fs.writeFileSync(NOTICES_INDEX_FILE, JSON.stringify(updated, null, 2));
  } catch (err) {
    console.warn('Could not update notice likes on disk:', err);
  }
  return updated;
}

// ----------------- ANNOTATIONS, DRAFTS & CONTRIBUTORS -----------------

export interface SavedDraft {
  id: string;
  authorName: string;
  savedAt: string;
  avatarColor: string;
  geometries: Record<number, any>;
  bookmarks: any[];
  status?: string;
  strokeCount: number;
}

export interface DocAnnotationsRecord {
  docId: string;
  drafts: SavedDraft[];
  activeDraftId?: string;
  geometries: Record<number, any>; // pageNumber -> PageAnnotationGeometry
  contributors: Array<{ name: string; savedAt: string; avatarColor?: string; strokeCount?: number }>;
  bookmarks: any[];
  status?: string;
  updatedAt: string;
}

export function getDocAnnotations(docId: string): DocAnnotationsRecord {
  ensureStorageReady();
  const defaultRecord: DocAnnotationsRecord = {
    docId,
    drafts: [],
    geometries: {},
    contributors: [],
    bookmarks: [],
    updatedAt: new Date().toISOString(),
  };

  try {
    const annotPath = path.join(ANNOTATIONS_DIR, `${docId}.json`);
    if (fs.existsSync(annotPath)) {
      const data = fs.readFileSync(annotPath, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...defaultRecord,
        ...parsed,
        drafts: parsed.drafts || [],
      };
    }
  } catch (err) {
    console.warn(`Could not read annotations for ${docId}:`, err);
  }

  return defaultRecord;
}

export function saveDocAnnotations(
  docId: string,
  payload: {
    authorName: string;
    geometries: Record<number, any>;
    bookmarks?: any[];
    status?: string;
    avatarColor?: string;
  }
): DocAnnotationsRecord {
  ensureStorageReady();
  const existing = getDocAnnotations(docId);

  // Clean author name
  const cleanName = (payload.authorName || 'Anonymous Student').trim();

  // Merge geometries
  const mergedGeometries = {
    ...existing.geometries,
    ...payload.geometries,
  };

  // Calculate stroke count
  let totalStrokes = 0;
  Object.values(mergedGeometries).forEach((geom: any) => {
    if (Array.isArray(geom?.items)) {
      totalStrokes += geom.items.length;
    }
  });

  // Create or update this user's specific saved draft
  const draftId = `draft_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const newDraft: SavedDraft = {
    id: draftId,
    authorName: cleanName,
    savedAt: new Date().toISOString(),
    avatarColor: payload.avatarColor || '#38bdf8',
    geometries: payload.geometries,
    bookmarks: payload.bookmarks !== undefined ? payload.bookmarks : existing.bookmarks,
    status: payload.status || existing.status,
    strokeCount: totalStrokes,
  };

  const existingDrafts = (existing.drafts || []).filter(
    (d) => d.id !== draftId && d.authorName.toLowerCase() !== cleanName.toLowerCase()
  );
  const updatedDrafts = [newDraft, ...existingDrafts];

  // Update contributors list (prepend latest, avoid duplicate name flood)
  const existingContributors = existing.contributors.filter(
    (c) => c.name.toLowerCase() !== cleanName.toLowerCase()
  );
  const newContributor = {
    name: cleanName,
    savedAt: new Date().toISOString(),
    avatarColor: payload.avatarColor || '#38bdf8',
    strokeCount: totalStrokes,
  };
  const updatedContributors = [newContributor, ...existingContributors];

  const updatedRecord: DocAnnotationsRecord = {
    docId,
    drafts: updatedDrafts,
    activeDraftId: draftId,
    geometries: mergedGeometries,
    contributors: updatedContributors,
    bookmarks: payload.bookmarks !== undefined ? payload.bookmarks : existing.bookmarks,
    status: payload.status || existing.status,
    updatedAt: new Date().toISOString(),
  };

  try {
    const annotPath = path.join(ANNOTATIONS_DIR, `${docId}.json`);
    fs.writeFileSync(annotPath, JSON.stringify(updatedRecord, null, 2));

    // Also update document index with contributor info and drafts (keep base doc clean)
    const docs = getDocsIndex();
    const updatedDocs = docs.map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          savedContributors: updatedContributors,
          savedDrafts: updatedDrafts,
          userProgress: {
            status: payload.status || doc.userProgress?.status || 'IN_PROGRESS',
            bookmarks: payload.bookmarks !== undefined ? payload.bookmarks : (doc.userProgress?.bookmarks || []),
          },
          annotationCount: totalStrokes,
        };
      }
      return doc;
    });
    saveDocsIndex(updatedDocs);
  } catch (err) {
    console.warn(`Could not save annotations for ${docId}:`, err);
  }

  return updatedRecord;
}

