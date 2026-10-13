'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getPdfBlob, savePdfBlob, extractPdfPageCountFromBuffer } from '@/lib/pdfStorage';
import { Loader2, RefreshCw, Upload, Trash2, AlertCircle } from 'lucide-react';

interface PdfViewerCanvasProps {
  docId: string;
  fileUrl?: string;
  currentPage: number;
  zoomScale: number;
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
  const [isMissingBinary, setIsMissingBinary] = useState<boolean>(false);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document using local worker & multi-tier cache (RAM -> IndexedDB -> Server API)
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setIsMissingBinary(false);

      try {
        const pdfjsLib = await import('pdfjs-dist');

        // Always configure worker to local static asset for instant 0ms startup
        if (typeof window !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
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
        // CRITICAL: NEVER fetch a dead `blob:` URL across reloads as Chrome will hang indefinitely!
        if (!buffer) {
          const isDeadBlob = fileUrl && fileUrl.startsWith('blob:');
          const fetchUrl = (!isDeadBlob && fileUrl) ? fileUrl : `/api/documents/${encodeURIComponent(docId)}/file`;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const resp = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
              const fetchedBuffer = await resp.arrayBuffer();
              if (fetchedBuffer && fetchedBuffer.byteLength > 0) {
                buffer = fetchedBuffer;
                // Cache pristine copy to memory and IndexedDB
                memoryBufferCache.set(docId, buffer.slice(0));
                savePdfBlob(docId, buffer.slice(0)).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Network fetch fallback or timeout:', e);
          }
        }

        if (!buffer || buffer.byteLength === 0) {
          if (!isCancelled) {
            setLoading(false);
            setIsMissingBinary(true);
            setError('PDF document binary was not saved to storage or session expired.');
          }
          return;
        }

        // Cache safe clone in RAM
        memoryBufferCache.set(docId, buffer.slice(0));

        // ALWAYS pass a fresh slice/clone to PDF.js so worker transfer doesn't detach cache
        const dataForWorker = new Uint8Array(buffer.slice(0));

        const loadingTask = pdfjsLib.getDocument({
          data: dataForWorker,
          cMapPacked: true,
        });

        // 6-second timeout race to guarantee the UI NEVER hangs in an infinite loading state
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF worker parsing timed out. Please click Reload.')), 6000)
        );

        const doc = await Promise.race([loadingTask.promise, timeoutPromise]) as any;

        if (isCancelled) return;

        setPdfDoc(doc);
        setLoading(false);

        if (onPagesDetected && doc.numPages > 0) {
          onPagesDetected(doc.numPages);
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
  }, [docId, fileUrl, onPagesDetected]);

  // Handle re-uploading file directly into this document if binary was lost
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setIsMissingBinary(false);

      const buffer = await file.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) return;

      // 1. Cache to memory and local IndexedDB
      memoryBufferCache.set(docId, buffer.slice(0));
      await savePdfBlob(docId, buffer.slice(0));

      // 2. Upload to server API so other visitors can see it too
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
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }

      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer.slice(0)),
        cMapPacked: true,
      }).promise;

      setPdfDoc(doc);
      setLoading(false);

      if (onPagesDetected && doc.numPages > 0) {
        onPagesDetected(doc.numPages);
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
        if (onDimensionsChange && !isCancelled) {
          onDimensionsChange(naturalViewport.width, naturalViewport.height);
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
  }, [pdfDoc, currentPage, onDimensionsChange]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/90 text-white/70 backdrop-blur-sm">
        <Loader2 className="w-7 h-7 animate-spin text-white mb-2" />
        <span className="text-xs font-mono tracking-wide">Opening syllabus PDF...</span>
      </div>
    );
  }

  // Helpful recovery screen when PDF binary is missing or failed
  if (error || !pdfDoc || isMissingBinary) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-[#0c0c0c]/95">
        <div className="ios-glass-card p-6 max-w-md w-full flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-white/40 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">
            {isMissingBinary ? 'PDF File Missing from Storage' : 'Could Not Load PDF'}
          </h3>
          <p className="text-xs text-white/50 mb-5 leading-relaxed">
            {isMissingBinary
              ? 'This document was registered previously without a stored cloud PDF file. You can attach the PDF now or delete this entry.'
              : error || 'Failed to render PDF document.'}
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
