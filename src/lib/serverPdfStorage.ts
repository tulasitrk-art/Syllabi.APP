import fs from 'fs';
import path from 'path';

// Server-side persistent storage paths
const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/syllabi_store' : path.join(process.cwd(), '.syllabi_store');
const DOCS_INDEX_FILE = path.join(STORAGE_DIR, 'documents.json');
const PDFS_DIR = path.join(STORAGE_DIR, 'pdfs');

let memoryDocsCache: any[] = [];
let isInitialized = false;

export function ensureStorageReady() {
  if (isInitialized) return;
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(PDFS_DIR)) {
      fs.mkdirSync(PDFS_DIR, { recursive: true });
    }
    if (fs.existsSync(DOCS_INDEX_FILE)) {
      const data = fs.readFileSync(DOCS_INDEX_FILE, 'utf-8');
      memoryDocsCache = JSON.parse(data);
    } else {
      memoryDocsCache = [];
      fs.writeFileSync(DOCS_INDEX_FILE, JSON.stringify([]));
    }
    isInitialized = true;
  } catch (err) {
    console.warn('Storage init fallback to memory-only:', err);
    memoryDocsCache = memoryDocsCache || [];
    isInitialized = true;
  }
}

export function getDocsIndex(): any[] {
  ensureStorageReady();
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

export function deleteDocFromDisk(docId: string) {
  try {
    ensureStorageReady();
    // 1. Remove from documents index
    memoryDocsCache = memoryDocsCache.filter((d) => d.id !== docId);
    fs.writeFileSync(DOCS_INDEX_FILE, JSON.stringify(memoryDocsCache, null, 2));

    // 2. Remove PDF file from disk
    const filePath = path.join(PDFS_DIR, `${docId}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Could not delete doc from disk:', err);
  }
}
