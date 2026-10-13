'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getPdfBlob, savePdfBlob } from '@/lib/pdfStorage';
import { Loader2, RefreshCw } from 'lucide-react';

interface PdfViewerCanvasProps {
  docId: string;
  fileUrl?: string;
  currentPage: number;
  zoomScale: number;
  onPagesDetected?: (total: number) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  className?: string;
}

// In-memory global buffer cache for instant zero-latency page turns and re-opens
const memoryBufferCache = new Map<string, ArrayBuffer>();
const memoryDocProxyCache = new Map<string, any>();

export const PdfViewerCanvas: React.FC<PdfViewerCanvasProps> = ({
  docId,
  fileUrl,
  currentPage,
  zoomScale,
  onPagesDetected,
  onDimensionsChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document using local worker & multi-tier cache (RAM -> IndexedDB -> Server API)
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      // 0. Check in-memory doc proxy cache first
      if (memoryDocProxyCache.has(docId)) {
        const cachedDoc = memoryDocProxyCache.get(docId);
        if (!isCancelled) {
          setPdfDoc(cachedDoc);
          setLoading(false);
          if (onPagesDetected && cachedDoc.numPages > 0) {
            onPagesDetected(cachedDoc.numPages);
          }
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        const pdfjsLib = await import('pdfjs-dist');

        // Always configure worker to local static asset for instant 0ms startup
        if (typeof window !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        }

        // 1. Try memory buffer cache
        let buffer: ArrayBuffer | null = memoryBufferCache.get(docId) || null;

        // 2. Try IndexedDB local storage
        if (!buffer) {
          buffer = await getPdfBlob(docId);
        }

        // 3. If not locally cached, fetch from server API route
        if (!buffer) {
          const fetchUrl = fileUrl || `/api/documents/${docId}/file`;
          try {
            const resp = await fetch(fetchUrl);
            if (resp.ok) {
              buffer = await resp.arrayBuffer();
              // Cache to memory and IndexedDB for all future instant loads
              if (buffer) {
                memoryBufferCache.set(docId, buffer);
                savePdfBlob(docId, buffer).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Network fetch fallback:', e);
          }
        }

        if (!buffer) {
          if (!isCancelled) {
            setLoading(false);
            setError('PDF document file not yet loaded or processing.');
          }
          return;
        }

        // Cache into RAM
        memoryBufferCache.set(docId, buffer);

        // Load document through PDF.js
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;

        if (isCancelled) return;

        memoryDocProxyCache.set(docId, doc);
        setPdfDoc(doc);
        setLoading(false);

        if (onPagesDetected && doc.numPages > 0) {
          onPagesDetected(doc.numPages);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF loading failed:', err);
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

        // Cancel previous ongoing render task if user switched pages rapidly
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        // Get unscaled natural page dimensions (for aspect ratio matching)
        const naturalViewport = page.getViewport({ scale: 1.0 });
        if (onDimensionsChange && !isCancelled) {
          onDimensionsChange(naturalViewport.width, naturalViewport.height);
        }

        // High resolution crisp rendering (capped at DPR 2 to prevent excessive memory/GPU lag)
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

  if (error || !pdfDoc) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/50 bg-[#0c0c0c]">
        <p className="text-xs font-mono mb-2">{error || 'PDF binary awaiting synchronization'}</p>
        <button
          onClick={() => {
            memoryBufferCache.delete(docId);
            memoryDocProxyCache.delete(docId);
            window.location.reload();
          }}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Document</span>
        </button>
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
