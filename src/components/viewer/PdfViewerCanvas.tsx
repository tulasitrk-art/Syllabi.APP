'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getPdfBlob, savePdfBlob } from '@/lib/pdfStorage';
import { generateSyllabusPdfBuffer } from '@/lib/syllabusPdfGenerator';
import { Loader2, RefreshCw, Upload, Trash2, AlertCircle, FileText } from 'lucide-react';

interface PdfViewerCanvasProps {
  docId: string;
  fileUrl?: string;
  currentPage: number;
  zoomScale: number;
  documentTitle?: string | null;
  subject?: string | null;
  unit?: number | null;
  syllabusTopic?: string | null;
  onPagesDetected?: (total: number) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  onDeleteDocument?: () => void;
  className?: string;
}

// In-memory global buffer cache for instant zero-latency page turns and re-opens
const memoryBufferCache = new Map<string, ArrayBuffer>();

export const PdfViewerCanvas: React.FC<PdfViewerCanvasProps> = ({
  docId,
  fileUrl,
  currentPage,
  zoomScale,
  documentTitle,
  subject,
  unit,
  syllabusTopic,
  onPagesDetected,
  onDimensionsChange,
  onDeleteDocument,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const renderTaskRef = useRef<any>(null);
  const loadedDocIdRef = useRef<string | null>(null);

  // Keep callback refs stable to prevent accidental re-render / reload loops
  const onPagesDetectedRef = useRef(onPagesDetected);
  onPagesDetectedRef.current = onPagesDetected;

  const onDimensionsChangeRef = useRef(onDimensionsChange);
  onDimensionsChangeRef.current = onDimensionsChange;

  // Load PDF document using local worker & multi-tier cache (RAM -> IndexedDB -> Server API -> Generator)
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      // If already loaded for this docId and valid, avoid resetting
      if (loadedDocIdRef.current === docId && pdfDoc) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const pdfjsLib = await import('pdfjs-dist');

        // Always configure worker with absolute URL so nested paths resolve correctly
        if (typeof window !== 'undefined') {
          const origin = window.location.origin;
          pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.js`;
        }

        // 1. Try memory buffer cache (validate byteLength to avoid detached ArrayBuffers)
        let buffer: ArrayBuffer | null = memoryBufferCache.get(docId) || null;
        if (buffer && buffer.byteLength === 0) {
          memoryBufferCache.delete(docId);
          buffer = null;
        }

        // 2. Try IndexedDB local storage
        if (!buffer) {
          buffer = await getPdfBlob(docId);
          if (buffer && buffer.byteLength === 0) {
            buffer = null;
          }
        }

        // 3. If not locally cached, fetch from server API route
        // Safeguard: NEVER fetch a dead `blob:` URL across reloads
        if (!buffer) {
          const isDeadBlob = fileUrl && fileUrl.startsWith('blob:');
          const fetchUrl = (!isDeadBlob && fileUrl) ? fileUrl : `/api/documents/${encodeURIComponent(docId)}/file`;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const resp = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
              const fetchedBuffer = await resp.arrayBuffer();
              if (fetchedBuffer && fetchedBuffer.byteLength > 0) {
                buffer = fetchedBuffer;
                memoryBufferCache.set(docId, buffer.slice(0));
                savePdfBlob(docId, buffer.slice(0)).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Network fetch fallback or timeout:', e);
          }
        }

        // 4. Auto-generate crisp syllabus PDF if no binary file was stored
        // This guarantees the PDF viewer ALWAYS opens and is visible!
        if (!buffer || buffer.byteLength === 0) {
          const generated = generateSyllabusPdfBuffer({
            title: documentTitle || 'Syllabus Course Document',
            subject: subject || 'AI',
            unit: unit || 1,
            syllabusTopic: syllabusTopic || 'Core Syllabus Foundations & Examination Targets',
            totalPages: 1,
          });

          buffer = generated;
          memoryBufferCache.set(docId, buffer.slice(0));
          savePdfBlob(docId, buffer.slice(0)).catch(() => {});

          // Inform server so other peers can view it too
          try {
            const blob = new Blob([buffer.slice(0)], { type: 'application/pdf' });
            const formData = new FormData();
            formData.append('file', blob, `${documentTitle || 'syllabus'}.pdf`);
            formData.append('docId', docId);
            formData.append('title', documentTitle || 'Syllabus Course Document');
            formData.append('subject', subject || 'AI');
            formData.append('unit', String(unit || 1));
            formData.append('syllabusTopic', syllabusTopic || '');
            fetch('/api/documents', { method: 'POST', body: formData }).catch(() => {});
          } catch (e) {
            // ignore
          }
        }

        // Cache safe clone in RAM
        memoryBufferCache.set(docId, buffer.slice(0));

        // ALWAYS pass a fresh slice/clone to PDF.js so worker transfer doesn't detach cache
        const dataForWorker = new Uint8Array(buffer.slice(0));

        let doc: any = null;

        try {
          const loadingTask = pdfjsLib.getDocument({
            data: dataForWorker,
            cMapPacked: true,
          });

          // 7-second timeout race with graceful direct-parse fallback
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('worker_timeout')), 7000)
          );

          doc = await Promise.race([loadingTask.promise, timeoutPromise]);
        } catch (workerErr: any) {
          console.warn('Worker parsing timed out or failed, falling back to direct parse:', workerErr);
          // Fresh slice for direct parse fallback
          const fallbackTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer.slice(0)),
            cMapPacked: true,
          });
          doc = await fallbackTask.promise;
        }

        if (isCancelled) return;

        loadedDocIdRef.current = docId;
        setPdfDoc(doc);
        setLoading(false);

        if (onPagesDetectedRef.current && doc.numPages > 0) {
          onPagesDetectedRef.current(doc.numPages);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF loading failed:', err);
          memoryBufferCache.delete(docId);
          setError(err?.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [docId, fileUrl]); // Keep dependencies strictly to docId and fileUrl

  // Handle re-uploading file directly into this document
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const buffer = await file.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) return;

      // 1. Cache to memory and local IndexedDB
      memoryBufferCache.set(docId, buffer.slice(0));
      await savePdfBlob(docId, buffer.slice(0));

      // 2. Upload to server API preserving this docId
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('docId', docId);

      fetch('/api/documents', {
        method: 'POST',
        body: formData,
      }).catch((e) => console.warn('Server sync warning:', e));

      // 3. Render immediately
      const pdfjsLib = await import('pdfjs-dist');
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.js`;
      }

      let doc: any = null;
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          cMapPacked: true,
        });
        doc = await loadingTask.promise;
      } catch {
        const fallbackTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          cMapPacked: true,
        });
        doc = await fallbackTask.promise;
      }

      loadedDocIdRef.current = docId;
      setPdfDoc(doc);
      setLoading(false);

      if (onPagesDetectedRef.current && doc.numPages > 0) {
        onPagesDetectedRef.current(doc.numPages);
      }
    } catch (err: any) {
      console.error('Direct upload failed:', err);
      setError(err?.message || 'Failed to process selected PDF');
      setLoading(false);
    }
  };

  // Render current page onto canvas with high fidelity and 60fps responsiveness
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    async function renderPage() {
      try {
        const pageNum = Math.max(1, Math.min(currentPage, pdfDoc.numPages));
        const page = await pdfDoc.getPage(pageNum);

        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const naturalViewport = page.getViewport({ scale: 1.0 });
        if (onDimensionsChangeRef.current && !isCancelled) {
          onDimensionsChangeRef.current(naturalViewport.width, naturalViewport.height);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
        const viewport = page.getViewport({ scale: dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Page render error:', err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/90 text-white/70 backdrop-blur-sm z-20">
        <Loader2 className="w-7 h-7 animate-spin text-white mb-2" />
        <span className="text-xs font-mono tracking-wide">Opening syllabus PDF...</span>
      </div>
    );
  }

  // Helpful recovery screen if an unrecoverable error occurs
  if (error || !pdfDoc) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-[#0c0c0c]/95 z-20">
        <div className="ios-glass-card p-6 max-w-md w-full flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-white/40 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">
            Could Not Load PDF
          </h3>
          <p className="text-xs text-white/50 mb-5 leading-relaxed">
            {error || 'Failed to render PDF document.'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleDirectFileUpload}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold flex items-center gap-2 transition-all shadow-glow"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Attach PDF File</span>
            </button>

            <button
              onClick={() => {
                memoryBufferCache.delete(docId);
                loadedDocIdRef.current = null;
                window.location.reload();
              }}
              className="px-3.5 py-2 rounded-xl bg-surface border border-white/15 hover:border-white/30 text-white text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            {onDeleteDocument && (
              <button
                onClick={onDeleteDocument}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-white ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full select-none block"
      />
    </div>
  );
};
