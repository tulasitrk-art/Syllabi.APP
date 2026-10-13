'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AnnotationTool,
  DocumentWithProgress,
  PageAnnotationGeometry,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus } from '@/types/database';
import { AnnotationCanvas } from '@/components/annotation/AnnotationCanvas';
import { PdfViewerCanvas } from '@/components/viewer/PdfViewerCanvas';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { STATUS_CONFIG, SUBJECT_METADATA } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pen,
  Highlighter,
  Eraser,
  MessageSquare,
  Bookmark as BookmarkIcon,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Share2,
  MousePointer,
  Touchpad,
  Palette,
  Check,
  Minimize2,
  Move,
} from 'lucide-react';
import Link from 'next/link';

interface DocumentViewerProps {
  document: DocumentWithProgress;
  roomId: string;
  onStatusChange?: (status: DocumentStatus) => void;
  onAddBookmark?: (pageNumber: number, title: string) => void;
}

const PALETTE_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Yellow', value: '#fde047' },
  { name: 'Cyan', value: '#38bdf8' },
  { name: 'Emerald', value: '#4ade80' },
  { name: 'Coral', value: '#f87171' },
  { name: 'Purple', value: '#c084fc' },
];

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document: doc,
  roomId,
  onStatusChange,
  onAddBookmark,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(doc.totalPages || 1);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#fde047');
  const [isTouchMode, setIsTouchMode] = useState<boolean>(false);
  const [isSharedLayer, setIsSharedLayer] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Mouse pan / move states
  const stageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragPosRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const [status, setStatus] = useState<DocumentStatus>(
    doc.userProgress?.status || 'IN_PROGRESS'
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(
    doc.userProgress?.bookmarks || []
  );
  const [pageGeometries, setPageGeometries] = useState<Record<number, PageAnnotationGeometry>>({});
  const [bookmarkInputOpen, setBookmarkInputOpen] = useState<boolean>(false);
  const [bookmarkTitle, setBookmarkTitle] = useState<string>('');

  const subjectInfo = SUBJECT_METADATA[doc.subject] || {
    name: doc.subject,
    description: '',
  };

  // Auto-fit page height on initial dimension load
  const handleDimensionsChange = useCallback((width: number, height: number) => {
    setPageDimensions({ width, height });
  }, []);

  // Fit Page: Scale so the entire page is 100% visible vertically without clipping
  const handleFitPage = () => {
    if (!stageRef.current || !pageDimensions) {
      setZoomScale(1.0);
      return;
    }
    const availableHeight = stageRef.current.clientHeight - 48; // padding
    const fitScale = Math.min(1.5, Math.max(0.4, availableHeight / pageDimensions.height));
    setZoomScale(Number(fitScale.toFixed(2)));
  };

  // Fit Width: Scale to match reading width
  const handleFitWidth = () => {
    if (!stageRef.current || !pageDimensions) {
      setZoomScale(1.0);
      return;
    }
    const availableWidth = stageRef.current.clientWidth - 48; // padding
    const fitScale = Math.min(2.0, Math.max(0.5, availableWidth / pageDimensions.width));
    setZoomScale(Number(fitScale.toFixed(2)));
  };

  // Mouse drag panning logic
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || isTouchMode) {
      setIsDragging(true);
      dragPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: stageRef.current ? stageRef.current.scrollLeft : 0,
        scrollTop: stageRef.current ? stageRef.current.scrollTop : 0,
      };
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && stageRef.current) {
      const dx = e.clientX - dragPosRef.current.x;
      const dy = e.clientY - dragPosRef.current.y;
      stageRef.current.scrollLeft = dragPosRef.current.scrollLeft - dx;
      stageRef.current.scrollTop = dragPosRef.current.scrollTop - dy;
    }
  };

  const handleStageMouseUp = () => {
    setIsDragging(false);
  };

  const handleStatusSelect = (newStatus: DocumentStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  const handleAddBookmarkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmarkTitle.trim()) return;
    const title = bookmarkTitle.trim();
    const newBm: Bookmark = {
      id: `bm_${Date.now()}`,
      pageNumber: currentPage,
      title,
      createdAt: new Date().toISOString(),
    };
    setBookmarks((prev) => [...prev, newBm]);
    onAddBookmark?.(currentPage, title);
    setBookmarkTitle('');
    setBookmarkInputOpen(false);
  };

  const handleSaveGeometry = (geometry: PageAnnotationGeometry) => {
    setPageGeometries((prev) => ({
      ...prev,
      [currentPage]: geometry,
    }));
  };

  const currentBookmark = bookmarks.find((b) => b.pageNumber === currentPage);

  // Calculate dynamic display dimensions based on real PDF page aspect ratio
  const naturalWidth = pageDimensions?.width || 800;
  const naturalHeight = pageDimensions?.height || 1130;
  const displayWidth = Math.round(naturalWidth * zoomScale);
  const displayHeight = Math.round(naturalHeight * zoomScale);

  const isMoveMode = activeTool === 'select' || isTouchMode;

  return (
    <div className="flex flex-col h-screen w-full bg-pitch dark:bg-pitch light:bg-[#f7f7f8] text-white dark:text-white light:text-zinc-900 overflow-hidden select-none">
      {/* 1. TOP NAVIGATION & STATUS BAR */}
      <header className="h-16 px-6 border-b border-white/10 dark:border-white/10 light:border-zinc-200 bg-surface/80 dark:bg-surface/80 light:bg-white/80 backdrop-blur-xl flex items-center justify-between z-30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-1.5 text-xs text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-black px-3 py-1.5 rounded-xl border border-white/10 dark:border-white/10 light:border-zinc-300 bg-interactive dark:bg-interactive light:bg-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Room Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-white/10 dark:bg-white/10 light:bg-zinc-300" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white dark:text-white light:text-zinc-900 border border-white/20 dark:border-white/20 light:border-zinc-300 uppercase tracking-wider font-semibold">
                {doc.subject} • Unit {doc.unit}
              </span>
              <h1 className="text-sm font-medium text-white dark:text-white light:text-zinc-900 tracking-tight truncate max-w-sm">
                {doc.title}
              </h1>
            </div>
            {doc.syllabusTopic && (
              <span className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500 truncate max-w-md">
                {doc.syllabusTopic}
              </span>
            )}
          </div>
        </div>

        {/* STATUS CHECKLIST & CONTROLS */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl p-1">
            {(
              [
                { key: 'UNREAD', label: 'Unread', icon: HelpCircle },
                { key: 'IN_PROGRESS', label: 'In Progress', icon: Clock },
                { key: 'READ', label: 'Read', icon: CheckCircle2 },
                { key: 'NEEDS_REVISION', label: 'Revision', icon: AlertCircle },
              ] as const
            ).map((st) => {
              const Icon = st.icon;
              const isSelected = status === st.key;
              return (
                <button
                  key={st.key}
                  onClick={() => handleStatusSelect(st.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-xl transition-all duration-200 ${
                    isSelected
                      ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                      : 'text-white/50 dark:text-white/50 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* SHARED VS PRIVATE LAYER TOGGLE */}
          <button
            onClick={() => setIsSharedLayer(!isSharedLayer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border transition-all ${
              isSharedLayer
                ? 'bg-white/10 dark:bg-white/10 light:bg-black/10 border-white/30 text-white dark:text-white light:text-black'
                : 'bg-transparent border-white/10 dark:border-white/10 light:border-zinc-300 text-white/40 dark:text-white/40 light:text-zinc-500'
            }`}
            title="Toggle shared peer annotation layer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {isSharedLayer ? 'Shared Layer' : 'Private'}
            </span>
          </button>

          {/* THEME TOGGLE */}
          <ThemeToggle />
        </div>
      </header>

      {/* 2. MAIN DOCUMENT STAGE (Smooth Frictionless Scrolling & Mouse Pan) */}
      <div
        ref={stageRef}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
        className={`relative flex-1 w-full bg-pitch dark:bg-pitch light:bg-[#f0f0f2] overflow-auto p-4 md:p-8 flex items-start justify-center ${
          isMoveMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        {/* DOCUMENT CONTAINER (Exact Real Page Dimensions — Never Cropped) */}
        <div
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            minWidth: `${displayWidth}px`,
            minHeight: `${displayHeight}px`,
            aspectRatio: `${naturalWidth} / ${naturalHeight}`,
          }}
          className="relative bg-white dark:bg-[#0a0a0a] rounded-xl border border-white/15 dark:border-white/15 light:border-zinc-300 shadow-ios my-auto transition-all duration-75 flex-shrink-0"
        >
          {/* BASE DEPTH (z-0): REAL HIGH-RES PDF VIEWER CANVAS */}
          <div className="absolute inset-0 z-0 overflow-hidden select-none">
            <PdfViewerCanvas
              docId={doc.id}
              fileUrl={doc.fileUrl}
              currentPage={currentPage}
              zoomScale={zoomScale}
              onDimensionsChange={handleDimensionsChange}
              onPagesDetected={(detected) => {
                if (detected > 0 && detected !== totalPages) {
                  setTotalPages(detected);
                }
              }}
            />

            {/* Structured fallback if PDF binary is absent */}
            {!doc.fileUrl && (
              <div className="w-full h-full p-8 md:p-14 flex flex-col justify-between bg-gradient-to-b from-[#0c0c0c] to-[#070707] text-white/90">
                <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-mono tracking-widest text-white/40 uppercase">
                      DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
                    </div>
                    <div className="text-lg font-bold tracking-tight text-white mt-1">
                      {subjectInfo.name} ({doc.subject})
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-white/50 border border-white/10 px-2 py-0.5 rounded">
                      UNIT {doc.unit}
                    </span>
                    <div className="text-[10px] text-white/30 mt-1 font-mono">
                      PAGE {currentPage} OF {totalPages}
                    </div>
                  </div>
                </div>

                <div className="my-auto space-y-4 text-center">
                  <h2 className="text-base font-semibold text-white">
                    {doc.title} — Page {currentPage}
                  </h2>
                  <p className="text-xs text-white/50 max-w-md mx-auto">
                    {doc.syllabusTopic || 'Core Syllabus Foundations & Examination Targets'}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-3 text-[10px] text-white/30 font-mono text-center">
                  SYLLABI OS • IMMUTABLE BASE LAYER (Z-0)
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC ANNOTATION LAYER (z-10): TRANSPARENT OVERLAY RULE */}
          <div className="absolute inset-0 z-10 pointer-events-auto">
            <AnnotationCanvas
              pageNumber={currentPage}
              initialGeometry={pageGeometries[currentPage]}
              activeTool={activeTool}
              strokeColor={activeColor}
              isSharedLayer={isSharedLayer}
              canEdit={true}
              isTouchMode={isTouchMode}
              onSave={handleSaveGeometry}
            />
          </div>
        </div>
      </div>

      {/* 3. APPLE-STYLE FLOATING DOCK TOOLBAR (BOTTOM) */}
      <footer className="h-20 px-6 border-t border-white/10 dark:border-white/10 light:border-zinc-200 bg-surface/90 dark:bg-surface/90 light:bg-white/90 backdrop-blur-2xl flex items-center justify-between z-30 flex-shrink-0">
        {/* PAGE NAVIGATION & BOOKMARKS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl p-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-xl text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium px-3 text-white/90 dark:text-white/90 light:text-zinc-900">
              {currentPage} <span className="text-white/40 dark:text-white/40 light:text-zinc-400">/ {totalPages}</span>
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-xl text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* QUICK BOOKMARK TOGGLE */}
          <div className="relative">
            <button
              onClick={() => {
                if (currentBookmark) {
                  setBookmarks((prev) => prev.filter((b) => b.id !== currentBookmark.id));
                } else {
                  setBookmarkInputOpen(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border transition-all ${
                currentBookmark
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                  : 'bg-interactive dark:bg-interactive light:bg-zinc-100 border-white/15 dark:border-white/15 light:border-zinc-300 text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
              <span className="hidden md:inline">
                {currentBookmark ? 'Bookmarked' : 'Bookmark'}
              </span>
            </button>

            {/* Bookmark naming popover */}
            {bookmarkInputOpen && (
              <form
                onSubmit={handleAddBookmarkSubmit}
                className="absolute left-0 bottom-12 ios-glass-panel p-3 w-64 shadow-2xl z-40 animate-scale-up"
              >
                <div className="text-[11px] font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-2">
                  Bookmark Page {currentPage}
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Important Exam Topic"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  className="w-full bg-pitch dark:bg-pitch light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-xl px-2.5 py-1.5 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white mb-2"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBookmarkInputOpen(false)}
                    className="px-2 py-1 text-xs text-white/50 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-semibold rounded-lg hover:bg-white/90"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* PRIMARY ANNOTATION DOCK WITH TOOLS, COLORS & TOUCH/MOUSE MODE */}
        <div className="flex items-center gap-2">
          {/* TOOL SELECTOR */}
          <div className="flex items-center bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-2xl p-1.5 shadow-glow">
            {/* Free Mouse Cursor / Move Tool */}
            <button
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTool === 'select'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Free Mouse Cursor / Move Tool (Click & drag to move page)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cursor</span>
            </button>

            {/* Pen Tool */}
            <button
              onClick={() => setActiveTool('pen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTool === 'pen'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Pen Tool"
            >
              <Pen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pen</span>
            </button>

            {/* Highlighter Tool */}
            <button
              onClick={() => setActiveTool('highlighter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTool === 'highlighter'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Highlighter Tool"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Highlighter</span>
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => setActiveTool('eraser')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTool === 'eraser'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Eraser Tool"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eraser</span>
            </button>

            {/* Note Tool */}
            <button
              onClick={() => setActiveTool('note')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTool === 'note'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Sticky Note Tool"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Note</span>
            </button>
          </div>

          {/* COLOR PICKER POPUP */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-2xl bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/20 dark:border-white/20 light:border-zinc-300 hover:border-white/40 transition-colors"
              title="Choose Pen / Highlighter Color"
            >
              <span
                className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                style={{ backgroundColor: activeColor }}
              />
              <Palette className="w-3.5 h-3.5 text-white/60 dark:text-white/60 light:text-zinc-600" />
            </button>

            {showColorPicker && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-12 ios-glass-panel p-2 shadow-2xl flex items-center gap-1.5 z-40 animate-scale-up">
                {PALETTE_COLORS.map((col) => (
                  <button
                    key={col.value}
                    onClick={() => {
                      setActiveColor(col.value);
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: col.value }}
                    title={col.name}
                  >
                    {activeColor === col.value && (
                      <Check className="w-3 h-3 text-black stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TOUCH MODE / MOUSE PAN TOGGLE */}
          <button
            onClick={() => setIsTouchMode(!isTouchMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-medium transition-all ${
              isTouchMode
                ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                : 'bg-interactive dark:bg-interactive light:bg-zinc-100 border-white/15 dark:border-white/15 light:border-zinc-300 text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
            }`}
            title="Toggle Touch Mode (In Touch Mode, drag with mouse cursor to move page smoothly)"
          >
            <Touchpad className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">
              {isTouchMode ? 'Touch Mode (Move with Mouse)' : 'Touch Mode'}
            </span>
          </button>
        </div>

        {/* VIEWPORT CONTROLS: FIT PAGE / FIT WIDTH / ZOOM */}
        <div className="flex items-center gap-2">
          {/* Fit Page & Fit Width buttons */}
          <div className="hidden xl:flex items-center bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl p-1 text-xs">
            <button
              onClick={handleFitPage}
              className="px-2.5 py-1 rounded-xl text-white/70 dark:text-white/70 light:text-zinc-700 hover:text-white hover:bg-white/5 transition-colors"
              title="Fit Full Page Vertically"
            >
              Fit Page
            </button>
            <button
              onClick={handleFitWidth}
              className="px-2.5 py-1 rounded-xl text-white/70 dark:text-white/70 light:text-zinc-700 hover:text-white hover:bg-white/5 transition-colors"
              title="Fit Full Page Width"
            >
              Fit Width
            </button>
          </div>

          <div className="flex items-center bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl p-1">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 rounded-xl text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-2 text-white/80 dark:text-white/80 light:text-zinc-800">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 rounded-xl text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="p-1.5 rounded-xl text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white transition-colors border-l border-white/10 dark:border-white/10 light:border-zinc-300 ml-1"
              title="Reset Zoom (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
