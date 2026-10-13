// Client-side IndexedDB for robust large PDF document storage and fast retrieval

const DB_NAME = 'syllabi_db';
const STORE_NAME = 'pdf_blobs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdfBlob(docId: string, data: ArrayBuffer | Blob): Promise<void> {
  try {
    const db = await openDB();
    const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(arrayBuffer, docId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save PDF to IndexedDB:', err);
  }
}

export async function getPdfBlob(docId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as ArrayBuffer);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get PDF from IndexedDB:', err);
    return null;
  }
}

export async function deletePdfBlob(docId: string): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(docId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete PDF from IndexedDB:', err);
  }
}

// Fast lightweight page count parser as instant zero-lag fallback
export function extractPdfPageCountFromBuffer(buffer: ArrayBuffer): number {
  try {
    const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    // Look for /Type /Pages /Count N
    const pageMatches = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
    if (pageMatches && pageMatches[1]) {
      const count = parseInt(pageMatches[1], 10);
      if (!isNaN(count) && count > 0) {
        return count;
      }
    }

    // Secondary fallback: count occurrences of /Type /Page (excluding /Pages)
    const pageObjMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageObjMatches && pageObjMatches.length > 0) {
      return pageObjMatches.length;
    }
  } catch (e) {
    console.warn('Quick PDF count parser error:', e);
  }
  return 1;
}
