'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getPdfBlob } from '@/lib/pdfStorage';
import { Loader2 } from 'lucide-react';

interface PdfViewerCanvasProps {
  docId: string;
  fileUrl?: string;
  currentPage: number;
  zoomScale: number;
  onPagesDetected?: (total: number) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  className?: string;
}

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

  // Load PDF document from IndexedDB or fileUrl
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const pdfjsLib = await import('pdfjs-dist');

        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }

        // 1. Try to fetch ArrayBuffer from native IndexedDB
        let buffer = await getPdfBlob(docId);

        // 2. If not in IndexedDB, fetch from fileUrl if available
        if (!buffer && fileUrl) {
          try {
            const resp = await fetch(fileUrl);
            if (resp.ok) {
              buffer = await resp.arrayBuffer();
            }
          } catch (e) {
            console.warn('Could not fetch fileUrl buffer:', e);
          }
        }

        if (!buffer) {
          setLoading(false);
          return;
        }

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;

        if (isCancelled) return;

        setPdfDoc(doc);
        setLoading(false);

        if (onPagesDetected && doc.numPages > 0) {
          onPagesDetected(doc.numPages);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF rendering failed:', err);
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

  // Render current page onto canvas
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
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Cancel previous ongoing render task if any
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore cancellation
          }
        }

        // Get natural unscaled page dimensions
        const baseViewport = page.getViewport({ scale: 1.0 });

        if (onDimensionsChange && !isCancelled) {
          onDimensionsChange(baseViewport.width, baseViewport.height);
        }

        // High resolution render scale for crisp text without clipping
        const dpr = window.devicePixelRatio || 1;
        const renderScale = 2.0; // Sharp crisp bitmap rendering
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        ctx.save();
        ctx.scale(dpr, dpr);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
        ctx.restore();
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
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/90 text-white/50">
        <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
        <span className="text-xs font-mono">Loading full syllabus PDF...</span>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return null;
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
