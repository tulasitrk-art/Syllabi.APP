'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AnnotationItem,
  AnnotationTool,
  NormalizedPoint,
  PageAnnotationGeometry,
  StrokePath,
  TextNote,
} from '@/types/syllabi';
import { MessageSquare, X, Check } from 'lucide-react';

interface AnnotationCanvasProps {
  pageNumber: number;
  initialGeometry?: PageAnnotationGeometry | null;
  activeTool: AnnotationTool;
  strokeColor?: string;
  strokeWidth?: number; // relative normalized scale
  isSharedLayer?: boolean;
  canEdit?: boolean;
  onSave?: (geometry: PageAnnotationGeometry) => void;
  className?: string;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  pageNumber,
  initialGeometry,
  activeTool,
  strokeColor = '#ffffff',
  strokeWidth = 0.003,
  isSharedLayer = true,
  canEdit = true,
  onSave,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<NormalizedPoint[]>([]);

  const [items, setItems] = useState<AnnotationItem[]>(
    initialGeometry?.items || []
  );
  const [activeNoteModal, setActiveNoteModal] = useState<{
    x: number;
    y: number;
    text: string;
    noteId?: string;
  } | null>(null);

  // Sync external geometry updates
  useEffect(() => {
    if (initialGeometry?.items) {
      setItems(initialGeometry.items);
    }
  }, [initialGeometry]);

  // Convert client pointer coordinate to normalized float [0.0, 1.0]
  const getNormalizedPoint = useCallback((clientX: number, clientY: number): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
    };
  }, []);

  // Redraw canvas on resize, items update, or device pixel ratio change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Match display size with internal bitmap
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Render strokes and highlights
    items.forEach((item) => {
      if (item.type === 'stroke') {
        if (!item.points || item.points.length < 2) return;

        ctx.save();
        ctx.beginPath();

        if (item.tool === 'highlighter') {
          ctx.strokeStyle = item.color || 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = Math.max(14, (item.width || 0.018) * rect.width);
          ctx.lineCap = 'square';
          ctx.lineJoin = 'miter';
          ctx.globalCompositeOperation = 'screen';
        } else {
          ctx.strokeStyle = item.color || '#ffffff';
          ctx.lineWidth = Math.max(2, (item.width || 0.003) * rect.width);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'source-over';
        }

        const startX = item.points[0].x * rect.width;
        const startY = item.points[0].y * rect.height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < item.points.length; i++) {
          const ptX = item.points[i].x * rect.width;
          const ptY = item.points[i].y * rect.height;
          ctx.lineTo(ptX, ptY);
        }

        ctx.stroke();
        ctx.restore();
      }
    });

    ctx.restore();
  }, [items]);

  useEffect(() => {
    redraw();
    const handleResize = () => redraw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      isDrawingRef.current = true;
      currentPointsRef.current = [pt];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (activeTool === 'eraser') {
      eraseAtPoint(pt);
    } else if (activeTool === 'note') {
      setActiveNoteModal({
        x: pt.x,
        y: pt.y,
        text: '',
      });
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (isDrawingRef.current && (activeTool === 'pen' || activeTool === 'highlighter')) {
      currentPointsRef.current.push(pt);

      // Live incremental line draw for ultra-low latency
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const pts = currentPointsRef.current;
          if (pts.length >= 2) {
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.beginPath();
            if (activeTool === 'highlighter') {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
              ctx.lineWidth = Math.max(14, 0.018 * rect.width);
              ctx.lineCap = 'square';
              ctx.globalCompositeOperation = 'screen';
            } else {
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = Math.max(2, strokeWidth * rect.width);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalCompositeOperation = 'source-over';
            }
            const prev = pts[pts.length - 2];
            ctx.moveTo(prev.x * rect.width, prev.y * rect.height);
            ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    } else if (e.buttons === 1 && activeTool === 'eraser') {
      eraseAtPoint(pt);
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // In case pointer capture was not held
    }

    if (currentPointsRef.current.length > 1) {
      const newStroke: StrokePath = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'stroke',
        tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
        points: [...currentPointsRef.current],
        color: activeTool === 'highlighter' ? 'rgba(255, 255, 255, 0.28)' : strokeColor,
        width: activeTool === 'highlighter' ? 0.018 : strokeWidth,
        opacity: activeTool === 'highlighter' ? 0.3 : 1.0,
      };

      const updated = [...items, newStroke];
      setItems(updated);
      saveChanges(updated);
    }
    currentPointsRef.current = [];
  };

  // Erase items within normalized radius
  const eraseAtPoint = (pt: NormalizedPoint) => {
    const eraseRadius = 0.025; // 2.5% of page dimension
    const updated = items.filter((item) => {
      if (item.type === 'stroke') {
        return !item.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < eraseRadius
        );
      }
      if (item.type === 'note') {
        return Math.hypot(item.x - pt.x, item.y - pt.y) >= eraseRadius;
      }
      return true;
    });

    if (updated.length !== items.length) {
      setItems(updated);
      saveChanges(updated);
    }
  };

  // Persist updated geometry
  const saveChanges = (updatedItems: AnnotationItem[]) => {
    const payload: PageAnnotationGeometry = {
      items: updatedItems,
      version: 1,
    };
    if (onSave) {
      onSave(payload);
    }
  };

  // Add or update note
  const submitNote = (text: string) => {
    if (!activeNoteModal || !text.trim()) {
      setActiveNoteModal(null);
      return;
    }

    let updated: AnnotationItem[];
    if (activeNoteModal.noteId) {
      updated = items.map((it) =>
        it.id === activeNoteModal.noteId && it.type === 'note'
          ? { ...it, text: text.trim() }
          : it
      );
    } else {
      const newNote: TextNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'note',
        x: activeNoteModal.x,
        y: activeNoteModal.y,
        text: text.trim(),
        color: '#ffffff',
        createdAt: new Date().toISOString(),
      };
      updated = [...items, newNote];
    }

    setItems(updated);
    saveChanges(updated);
    setActiveNoteModal(null);
  };

  const getCursorClass = () => {
    switch (activeTool) {
      case 'pen':
      case 'highlighter':
        return 'cursor-crosshair';
      case 'eraser':
        return 'cursor-cell';
      case 'note':
        return 'cursor-text';
      default:
        return 'cursor-default';
    }
  };

  const notes = items.filter((it): it is TextNote => it.type === 'note');

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none touch-none ${className}`}
    >
      {/* HTML5 Vector Canvas for crisp scalable strokes (z-10 layer) */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 w-full h-full ${getCursorClass()}`}
        style={{ touchAction: 'none' }}
      />

      {/* Floating Monochrome Sticky Note Pins */}
      {notes.map((note) => (
        <div
          key={note.id}
          style={{
            left: `${note.x * 100}%`,
            top: `${note.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
          className="absolute z-20 group"
        >
          <button
            onClick={() =>
              setActiveNoteModal({
                x: note.x,
                y: note.y,
                text: note.text,
                noteId: note.id,
              })
            }
            className="w-7 h-7 rounded-full bg-surface border border-white/30 flex items-center justify-center shadow-glow transition-all hover:scale-110 hover:border-white active:scale-95"
            title="View study note"
          >
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Hover preview callout */}
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-30">
            <div className="ios-glass-card px-3 py-1.5 max-w-xs text-xs text-white/90 whitespace-pre-wrap shadow-xl">
              {note.text}
            </div>
          </div>
        </div>
      ))}

      {/* Note Creation / Edit Modal */}
      {activeNoteModal && (
        <div
          style={{
            left: `${Math.min(0.75, Math.max(0.1, activeNoteModal.x)) * 100}%`,
            top: `${Math.min(0.75, Math.max(0.1, activeNoteModal.y)) * 100}%`,
          }}
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 w-72 animate-scale-up"
        >
          <div className="ios-glass-panel p-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                {activeNoteModal.noteId ? 'Edit Study Note' : 'Add Note (Page ' + pageNumber + ')'}
              </span>
              <button
                onClick={() => setActiveNoteModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              autoFocus
              defaultValue={activeNoteModal.text}
              placeholder="Record formula, exam hint, or unit annotation..."
              className="w-full h-20 bg-pitch/70 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30"
              id="note-textarea"
            />
            <div className="flex items-center justify-between mt-2.5 pt-1">
              {activeNoteModal.noteId && (
                <button
                  type="button"
                  onClick={() => {
                    const filtered = items.filter(
                      (it) => it.id !== activeNoteModal.noteId
                    );
                    setItems(filtered);
                    saveChanges(filtered);
                    setActiveNoteModal(null);
                  }}
                  className="text-[11px] text-white/40 hover:text-white underline"
                >
                  Delete
                </button>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setActiveNoteModal(null)}
                  className="px-2.5 py-1 text-xs text-white/50 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = (
                      document.getElementById('note-textarea') as HTMLTextAreaElement
                    )?.value;
                    submitNote(val || '');
                  }}
                  className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-lg hover:bg-white/90 active:scale-95 transition-all flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
