'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Move,
  Minus,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  Pen,
  Eraser,
  Type,
  RotateCcw,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';

interface RoughPageProps {
  isOpen: boolean;
  onClose: () => void;
  activeColor?: string;
}

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export const RoughPageModal: React.FC<RoughPageProps> = ({
  isOpen,
  onClose,
  activeColor = '#000000',
}) => {
  // Window State
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasCustomPos, setHasCustomPos] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Tools & Drawing State
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen');
  const [penColor, setPenColor] = useState<string>(activeColor || '#000000');
  const [textNotes, setTextNotes] = useState<string>('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Delete Confirmation
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync activeColor from parent when it changes and pen is default
  useEffect(() => {
    if (activeColor) {
      setPenColor(activeColor === '#ffffff' ? '#000000' : activeColor);
    }
  }, [activeColor]);

  // Initial position: docked to the right-center on desktop
  useEffect(() => {
    if (isOpen && !hasCustomPos && typeof window !== 'undefined') {
      const defaultWidth = 460;
      const defaultHeight = 560;
      const x = Math.max(20, window.innerWidth - defaultWidth - 40);
      const y = Math.max(90, Math.floor((window.innerHeight - defaultHeight) / 2));
      setPosition({ x, y });
      setHasCustomPos(true);
    }
  }, [isOpen, hasCustomPos]);

  // Redraw canvas strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines on the white rough page (notebook style)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render user strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  // Resize canvas to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    }
  }, [isOpen, isMaximized, isMinimized, redrawCanvas]);

  // Dragging handlers for moving the rough page
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (isMaximized) return; // Cannot drag while maximized
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(10, Math.min(window.innerWidth - 120, dragStartRef.current.startX + dx));
      const newY = Math.max(70, Math.min(window.innerHeight - 100, dragStartRef.current.startY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Canvas drawing handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const strokeColor = tool === 'eraser' ? '#ffffff' : penColor;
    const strokeWidth = tool === 'eraser' ? 18 : 2.5;

    currentStrokeRef.current = {
      color: strokeColor,
      width: strokeWidth,
      points: [{ x, y }],
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({ x, y });

    // Fast incremental draw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const pts = currentStrokeRef.current.points;
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentStrokeRef.current.color;
        ctx.lineWidth = currentStrokeRef.current.width;
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (currentStrokeRef.current) {
      const finalized = currentStrokeRef.current;
      currentStrokeRef.current = null;
      setStrokes((prev) => [...prev, finalized]);
      setRedoStrokes([]);
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStrokes((prev) => [...prev, last]);
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStrokes.length === 0) return;
    const last = redoStrokes[redoStrokes.length - 1];
    setRedoStrokes((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, last]);
  };

  const handleExecuteDelete = () => {
    setStrokes([]);
    setTextNotes('');
    setShowConfirmDelete(false);
    onClose();
  };

  if (!isOpen) return null;

  // 1. MINIMIZED FLOATING BADGE
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-8 z-40 animate-scale-up">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white text-zinc-900 border-2 border-black/80 shadow-2xl font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-glow"
          title="Restore Rough Page"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Rough Page</span>
          <span className="text-[10px] font-mono font-normal text-zinc-500">
            ({strokes.length} strokes)
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      </div>
    );
  }

  // 2. FULL / FLOATING ROUGH PAGE WINDOW
  return (
    <>
      <div
        ref={containerRef}
        style={
          isMaximized
            ? { top: '80px', right: '16px', bottom: '90px', width: '560px' }
            : { top: `${position.y}px`, left: `${position.x}px`, width: '460px', height: '560px' }
        }
        className={`fixed z-40 bg-white text-zinc-900 rounded-3xl border-2 border-zinc-400/80 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-scale-up transition-[width,height,top,left] duration-150 ${
          isDragging ? 'select-none ring-2 ring-black' : ''
        }`}
      >
        {/* DRAGGABLE HEADER */}
        <div
          onMouseDown={handleMouseDownHeader}
          className="h-12 px-4 bg-zinc-100/90 border-b border-zinc-300 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-zinc-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight uppercase text-zinc-800">
                Rough Page
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-600">
                Scratchpad
              </span>
            </div>
          </div>

          {/* Window Control Buttons: Delete, Minimise, Maximise, Close */}
          <div className="flex items-center gap-1">
            {/* Delete Rough Page (Asks confirmation) */}
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-200 transition-colors"
              title="Delete rough page contents"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Minimise */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded-lg hover:bg-zinc-200 transition-colors"
              title="Minimise to floating dock"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Maximise / Restore */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded-lg hover:bg-zinc-200 transition-colors"
              title={isMaximized ? 'Restore size' : 'Maximise window'}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-black rounded-lg hover:bg-zinc-200 transition-colors"
              title="Close rough page"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUB-TOOLBAR: PEN / ERASER / TEXT / COLORS / UNDO */}
        <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Tool switchers */}
          <div className="flex items-center gap-1 bg-zinc-200/80 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                tool === 'pen' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-600 hover:text-black'
              }`}
            >
              <Pen className="w-3 h-3" />
              <span>Draw</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                tool === 'eraser' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-600 hover:text-black'
              }`}
            >
              <Eraser className="w-3 h-3" />
              <span>Eraser</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('text')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                tool === 'text' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-600 hover:text-black'
              }`}
            >
              <Type className="w-3 h-3" />
              <span>Type</span>
            </button>
          </div>

          {/* Color picker for rough work */}
          {tool === 'pen' && (
            <div className="flex items-center gap-1.5">
              {[
                { name: 'Black', val: '#000000' },
                { name: 'Blue', val: '#2563eb' },
                { name: 'Red', val: '#dc2626' },
                { name: 'Green', val: '#16a34a' },
                { name: 'Purple', val: '#9333ea' },
              ].map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => setPenColor(c.val)}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    penColor === c.val ? 'scale-125 border-black ring-1 ring-black' : 'border-black/20 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.val }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* Undo & Redo */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-zinc-600 hover:text-black disabled:opacity-30 disabled:hover:text-zinc-600 font-medium"
              title="Undo last stroke"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-[11px]">Undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStrokes.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-zinc-600 hover:text-black disabled:opacity-30 disabled:hover:text-zinc-600 font-medium"
              title="Redo stroke"
            >
              <RotateCw className="w-3 h-3" />
              <span className="text-[11px]">Redo</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA (WHITE PAGE NOTEBOOK CANVAS + TYPING TEXTAREA) */}
        <div className="relative flex-1 bg-white overflow-hidden cursor-crosshair">
          {/* 1. Freehand Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="absolute inset-0 w-full h-full z-10 touch-none"
          />

          {/* 2. Text Scratchpad Area (when 'Type' tool is selected) */}
          {tool === 'text' && (
            <div className="absolute inset-0 z-20 bg-white/95 p-4 flex flex-col">
              <div className="text-[11px] font-mono text-zinc-400 mb-1 flex items-center justify-between">
                <span>ROUGH TEXT NOTES & FORMULAS</span>
                <span>{textNotes.length} chars</span>
              </div>
              <textarea
                autoFocus
                value={textNotes}
                onChange={(e) => setTextNotes(e.target.value)}
                placeholder="Type your rough calculations, quick formulas, code snippets or lecture notes here..."
                className="w-full flex-1 bg-transparent border-0 resize-none font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* FOOTER STATUS */}
        <div className="h-7 px-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-500 font-mono select-none">
          <span>White Scratchpad Layer</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-zinc-400" />
            <span>Drag header to move</span>
          </span>
        </div>
      </div>

      {/* CONFIRM PERMANENT DELETE DIALOG */}
      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        title="Delete Rough Page?"
        message="Are you sure? This will be permanently deleted from this app."
        itemTitle="All rough calculations, drawings, and notes on this page"
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={handleExecuteDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </>
  );
};
