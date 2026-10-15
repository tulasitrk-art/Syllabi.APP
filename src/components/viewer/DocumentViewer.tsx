'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AnnotationTool,
  DocumentWithProgress,
  PageAnnotationGeometry,
  Bookmark,
  DocumentContributor,
  SavedDraft,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';
import { AnnotationCanvas } from '@/components/annotation/AnnotationCanvas';
import { PdfViewerCanvas } from '@/components/viewer/PdfViewerCanvas';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { STATUS_CONFIG, SUBJECT_METADATA, formatTimeAgo } from '@/lib/utils';
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
  Trash2,
  Save,
  User,
  Sparkles,
  X,
  Eye,
  RotateCcw,
  Download,
  FileEdit,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPdfBlob } from '@/lib/pdfStorage';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { RoughPageModal } from '@/components/viewer/RoughPageModal';

interface DocumentViewerProps {
  document: DocumentWithProgress;
  roomId: string;
  onStatusChange?: (status: DocumentStatus) => void;
  onAddBookmark?: (pageNumber: number, title: string) => void;
  onRemoveBookmark?: (pageNumber: number) => void;
  onDeleteDocument?: () => void;
}

const PALETTE_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
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
  onRemoveBookmark,
  onDeleteDocument,
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

  // Universal Saved Contributors, Drafts & Real-time Save State
  const [contributors, setContributors] = useState<DocumentContributor[]>(
    doc.savedContributors || []
  );
  const [drafts, setDrafts] = useState<SavedDraft[]>(doc.savedDrafts || []);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [selectedDraftToLoad, setSelectedDraftToLoad] = useState<SavedDraft | null>(null);
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState<boolean>(false);
  const [showContributorsModal, setShowContributorsModal] = useState<boolean>(false);
  const [inputAuthorName, setInputAuthorName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Rough Page and Delete Confirmation states
  const [isRoughPageOpen, setIsRoughPageOpen] = useState<boolean>(false);
  const [showConfirmDeleteDoc, setShowConfirmDeleteDoc] = useState<boolean>(false);
  const [bookmarkToDelete, setBookmarkToDelete] = useState<number | null>(null);

  const router = useRouter();

  const handleBackToLibrary = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(roomId === 'room-demo' ? '/' : `/rooms/${roomId}`);
    }
  }, [router, roomId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !showSaveNameModal &&
        !showDraftModal &&
        !showContributorsModal &&
        !bookmarkInputOpen
      ) {
        handleBackToLibrary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSaveNameModal, showDraftModal, showContributorsModal, bookmarkInputOpen, handleBackToLibrary]);

  const handleDownloadPdf = async () => {
    try {
      let buffer: ArrayBuffer | null = await getPdfBlob(doc.id);
      if (!buffer || buffer.byteLength === 0) {
        if (doc.fileUrl && doc.fileUrl.startsWith('data:application/pdf;base64,')) {
          const b64 = doc.fileUrl.split(',')[1];
          const binaryStr = atob(b64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          buffer = bytes.buffer;
        } else {
          const fetchUrl = doc.fileUrl && !doc.fileUrl.startsWith('blob:')
            ? doc.fileUrl
            : `/api/documents/${encodeURIComponent(doc.id)}/file`;
          const resp = await fetch(fetchUrl);
          if (resp.ok) {
            buffer = await resp.arrayBuffer();
          }
        }
      }

      if (buffer && buffer.byteLength > 0) {
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.title.endsWith('.pdf') ? doc.title : `${doc.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn('Download error:', e);
    }

    // Direct fallback
    const a = document.createElement('a');
    a.href = doc.fileUrl || `/api/documents/${encodeURIComponent(doc.id)}/file`;
    a.download = doc.title.endsWith('.pdf') ? doc.title : `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Load annotations and drafts from shared server API
  const fetchDocAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/annotations`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.drafts)) {
          setDrafts(data.drafts);
        }
        if (Array.isArray(data?.contributors)) {
          setContributors(data.contributors);
        }
        // ONLY sync page markings if the user explicitly drafted this saved version
        if (activeDraftId && Array.isArray(data?.drafts)) {
          const activeDraft = data.drafts.find((d: any) => d.id === activeDraftId);
          if (activeDraft?.geometries) {
            setPageGeometries(activeDraft.geometries);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load annotations:', err);
    }
  }, [doc.id, activeDraftId]);

  useEffect(() => {
    fetchDocAnnotations();

    // Polling every 6s so changes saved by peers appear smoothly without thrashing
    const interval = setInterval(fetchDocAnnotations, 6000);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(`syllabi_annot_${doc.id}`);
        bc.onmessage = (e) => {
          if (e.data?.type === 'ANNOTATIONS_UPDATED') {
            fetchDocAnnotations();
          }
        };
      }
    } catch {}

    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('syllabi_author_name');
      if (savedName) setInputAuthorName(savedName);
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [doc.id, fetchDocAnnotations]);

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAuthorName.trim()) return;
    const author = inputAuthorName.trim();
    setIsSaving(true);
    setShowSaveNameModal(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('syllabi_author_name', author);
    }

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: author,
          geometries: pageGeometries,
          bookmarks,
          status,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.record) {
          if (Array.isArray(json.record.contributors)) {
            setContributors(json.record.contributors);
          }
          if (Array.isArray(json.record.drafts)) {
            setDrafts(json.record.drafts);
          }
          if (json.record.activeDraftId) {
            setActiveDraftId(json.record.activeDraftId);
          }
        }
      }

      // Broadcast to other tabs/users
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`syllabi_annot_${doc.id}`);
          bc.postMessage({ type: 'ANNOTATIONS_UPDATED' });
          bc.close();
        }
      } catch {}

      setSaveSuccessMessage(`Saved under your name (${author})! All cohort peers can now draft & view your edited PDF.`);
      setTimeout(() => setSaveSuccessMessage(null), 4500);
    } catch (err) {
      console.warn('Error saving annotations:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDraftPrompt = (draft: SavedDraft) => {
    setSelectedDraftToLoad(draft);
    setShowDraftModal(true);
  };

  const handleApplyDraft = (draft: SavedDraft) => {
    setPageGeometries(draft.geometries || {});
    if (Array.isArray(draft.bookmarks)) {
      setBookmarks(draft.bookmarks);
    }
    if (draft.status) {
      setStatus(draft.status);
    }
    setActiveDraftId(draft.id);
    setShowDraftModal(false);
    setSaveSuccessMessage(`Drafted & displaying ${draft.authorName}'s edited PDF!`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const handleResetToCleanOriginal = () => {
    setPageGeometries({});
    setActiveDraftId(null);
    setShowDraftModal(false);
    setSaveSuccessMessage('Switched to clean original PDF without annotations.');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };


  const displaySubject = doc.subject === 'DEVC' ? 'DMGT' : doc.subject;
  const subjectInfo =
    (SUBJECT_METADATA as Record<string, any>)[displaySubject] ||
    (SUBJECT_METADATA as Record<string, any>)[doc.subject] || {
      name: displaySubject,
      description: '',
    };

  // Auto-fit page height on initial dimension load with equality check to prevent re-render loops
  const handleDimensionsChange = useCallback((width: number, height: number) => {
    setPageDimensions((prev) => {
      if (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) {
        return prev;
      }
      return { width, height };
    });
  }, []);

  // Stable callback for page detection
  const handlePagesDetected = useCallback((detected: number) => {
    setTotalPages((prev) => (detected > 0 && detected !== prev ? detected : prev));
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

  const handleRemoveBookmark = (pageNumber: number) => {
    setBookmarks((prev) => prev.filter((b) => b.pageNumber !== pageNumber));
    onRemoveBookmark?.(pageNumber);
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
          <button
            type="button"
            onClick={handleBackToLibrary}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shadow-glow"
            title="Return back to Syllabus Document Library (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Back to Library</span>
          </button>

          <Link
            href="/"
            className="hidden sm:flex items-center gap-1 text-[11px] text-white/50 dark:text-white/50 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            title="Go to Home"
          >
            <span>Home</span>
          </Link>

          <div className="h-4 w-px bg-white/10 dark:bg-white/10 light:bg-zinc-300" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white dark:text-white light:text-zinc-900 border border-white/20 dark:border-white/20 light:border-zinc-300 uppercase tracking-wider font-semibold">
                {displaySubject} • Unit {doc.unit}
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

          {/* DOWNLOAD ORIGINAL PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border border-white/15 dark:border-white/15 light:border-zinc-300 bg-interactive dark:bg-interactive light:bg-zinc-100 hover:bg-white dark:hover:bg-white light:hover:bg-black hover:text-black dark:hover:text-black light:hover:text-white text-white/80 dark:text-white/80 light:text-zinc-700 transition-all active:scale-95 shadow-sm"
            title={`Download "${doc.title}" PDF`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* PERMANENT DELETE BUTTON */}
          {onDeleteDocument && (
            <button
              type="button"
              onClick={() => setShowConfirmDeleteDoc(true)}
              className="p-1.5 text-white/40 hover:text-red-400 rounded-xl hover:bg-white/5 border border-transparent hover:border-red-500/30 transition-colors"
              title="Permanently delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

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
          onMouseDown={handleStageMouseDown}
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
              documentTitle={doc.title}
              subject={displaySubject}
              unit={doc.unit}
              syllabusTopic={doc.syllabusTopic}
              onDimensionsChange={handleDimensionsChange}
              onDeleteDocument={onDeleteDocument}
              onPagesDetected={handlePagesDetected}
            />
          </div>

          {/* VISIBLE BOOKMARK SYMBOL ON PAGE (When user bookmarked this page) */}
          {currentBookmark && (
            <div className="absolute -top-3 right-6 sm:right-10 z-20 pointer-events-auto flex flex-col items-center group">
              <div
                className="relative bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-b-xl shadow-2xl border-t-2 border-amber-300 flex items-center gap-2 select-none"
                title={`Bookmarked page ${currentPage}: "${currentBookmark.title}". Click X to remove.`}
              >
                <BookmarkIcon className="w-4 h-4 fill-black text-black stroke-[2.5]" />
                <span
                  onClick={() => setBookmarkInputOpen(true)}
                  className="text-xs font-black tracking-tight uppercase max-w-[140px] truncate cursor-pointer hover:underline"
                >
                  {currentBookmark.title}
                </span>
                <span className="text-[10px] font-mono font-bold bg-black/20 px-1.5 py-0.5 rounded">
                  p.{currentPage}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBookmarkToDelete(currentPage);
                  }}
                  className="p-1 rounded-full hover:bg-black/25 active:scale-90 transition-all text-black"
                  title="Remove bookmark from this page"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
              {/* Decorative ribbon swallowtail notch */}
              <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[8px] border-t-amber-600 -mt-[1px]" />
            </div>
          )}

          {/* DYNAMIC ANNOTATION LAYER (z-10): TRANSPARENT OVERLAY RULE */}
          <div className={`absolute inset-0 z-10 ${
            activeTool === 'select' || (isTouchMode && activeTool !== 'pen' && activeTool !== 'highlighter')
              ? 'pointer-events-none'
              : 'pointer-events-auto'
          }`}>
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
                  handleRemoveBookmark(currentPage);
                } else {
                  setBookmarkInputOpen(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border transition-all ${
                currentBookmark
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold'
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
                <div className="flex items-center justify-between gap-1.5">
                  {currentBookmark ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBookmarkToDelete(currentPage);
                        setBookmarkInputOpen(false);
                      }}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  ) : <div />}
                  <div className="flex gap-1.5">
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

            {/* Rough Page Tool Button (White Scratchpad Aside) */}
            <button
              onClick={() => setIsRoughPageOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isRoughPageOpen
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-md ring-1 ring-white/50'
                  : 'text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
              title="Rough Page / Scratchpad (Open white scribble page aside with move, delete, minimise and maximise features)"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rough Page</span>
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
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                      col.value === '#000000'
                        ? 'border-2 border-white/60 shadow-sm'
                        : 'border border-white/20'
                    }`}
                    style={{ backgroundColor: col.value }}
                    title={col.name}
                  >
                    {activeColor === col.value && (
                      <Check className={`w-3 h-3 stroke-[3] ${col.value === '#000000' ? 'text-white' : 'text-black'}`} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SAVE OPTION BUTTON */}
          <button
            type="button"
            onClick={() => setShowSaveNameModal(true)}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shadow-glow disabled:opacity-50"
            title="Save pen strokes, highlights, notes & bookmarks under your name"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* STATIC CIRCULAR LOGO & SAVED USER NAME (NO ANIMATIONS) */}
          {drafts.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto max-w-[280px] sm:max-w-md py-0.5 no-scrollbar">
              {drafts.slice(0, 3).map((d) => {
                const isActive = activeDraftId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleOpenDraftPrompt(d)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all text-xs font-semibold select-none flex-shrink-0 ${
                      isActive
                        ? 'bg-white text-black border-white'
                        : 'bg-interactive dark:bg-interactive light:bg-zinc-100 border-white/20 dark:border-white/20 light:border-zinc-300 text-white dark:text-white light:text-zinc-900 hover:border-white/40'
                    }`}
                    title={`Saved by ${d.authorName}. Click to draft and view their edited PDF.`}
                  >
                    {/* Circular Logo (Static, no animations) */}
                    <div className="w-5 h-5 rounded-full bg-black/80 dark:bg-black text-white flex items-center justify-center text-[9px] font-bold font-mono uppercase flex-shrink-0">
                      {d.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    {/* Saved Name */}
                    <span className="truncate max-w-[100px]">
                      {d.authorName}
                    </span>
                  </button>
                );
              })}

              {drafts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowContributorsModal(true)}
                  className="px-2 py-1 text-[11px] font-mono rounded-xl bg-white/10 hover:bg-white/20 text-white/70"
                >
                  +{drafts.length - 3} more
                </button>
              )}
            </div>
          ) : (
            contributors.length > 0 && (
              <div
                onClick={() => {
                  const fallbackDraft: SavedDraft = {
                    id: 'draft_default',
                    authorName: contributors[0].name,
                    savedAt: contributors[0].savedAt,
                    geometries: pageGeometries,
                    bookmarks,
                    status,
                    strokeCount: contributors[0].strokeCount || 0,
                  };
                  handleOpenDraftPrompt(fallbackDraft);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/20 dark:border-white/20 light:border-zinc-300 hover:border-white/40 cursor-pointer transition-all text-xs font-semibold select-none flex-shrink-0"
                title={`Saved by ${contributors[0].name}. Click to draft and view their edited PDF.`}
              >
                {/* Circular Logo (Static, no animations) */}
                <div className="w-5 h-5 rounded-full bg-black/80 dark:bg-black text-white flex items-center justify-center text-[9px] font-bold font-mono uppercase flex-shrink-0">
                  {contributors[0].name.slice(0, 2).toUpperCase()}
                </div>
                {/* Saved Name */}
                <span className="truncate max-w-[100px] text-white dark:text-white light:text-zinc-900">
                  {contributors[0].name}
                </span>
              </div>
            )
          )}
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

      {/* 4. SAVE NAME INPUT MODAL (POPUP TO ASK USER NAME) */}
      {showSaveNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white flex items-center justify-center font-bold shadow-glow">
                  <Save className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Save Annotations</h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Publish your edits & bookmarks to everyone viewing this PDF.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveNameModal(false)}
                className="p-2 text-white/50 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-white/80 dark:text-white/80 light:text-zinc-700 mb-1.5">
                  Enter Your Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 dark:text-white/40 light:text-zinc-400" />
                  <input
                    autoFocus
                    type="text"
                    required
                    placeholder="e.g. Rahul, Sneha, Alex"
                    value={inputAuthorName}
                    onChange={(e) => setInputAuthorName(e.target.value)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white"
                  />
                </div>
                <p className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500 mt-1.5 leading-relaxed">
                  Your name will be displayed in the round animated badge beside the document toolbar so other cohort members know who marked these study notes.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowSaveNameModal(false)}
                  className="px-4 py-2 text-xs text-white/50 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inputAuthorName.trim() || isSaving}
                  className="px-5 py-2.5 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow flex items-center gap-2 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save & Broadcast'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. LOAD / DRAFT EDITED PDF MODAL */}
      {showDraftModal && selectedDraftToLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-emerald-400 p-[2px] flex items-center justify-center shadow-glow">
                  <div className="w-full h-full rounded-2xl bg-black flex items-center justify-center text-xs font-bold text-white uppercase font-mono">
                    {selectedDraftToLoad.authorName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    Draft by {selectedDraftToLoad.authorName}
                  </h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Saved {formatTimeAgo(selectedDraftToLoad.savedAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="p-2 text-white/50 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-white/80 dark:text-white/80 light:text-zinc-700 leading-relaxed">
                <strong className="text-white dark:text-white light:text-zinc-900">{selectedDraftToLoad.authorName}</strong> edited this PDF with annotations, pen strokes, highlights, and bookmarks. Would you like to draft and view their version?
              </p>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-surface/70 dark:bg-surface/70 light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 dark:text-white/40 light:text-zinc-500 block">
                    Annotations & Marks
                  </span>
                  <span className="font-semibold text-white dark:text-white light:text-zinc-900">
                    {selectedDraftToLoad.strokeCount || 0} items
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 dark:text-white/40 light:text-zinc-500 block">
                    Page Bookmarks
                  </span>
                  <span className="font-semibold text-white dark:text-white light:text-zinc-900">
                    {selectedDraftToLoad.bookmarks?.length || 0} pages
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 dark:border-white/10 light:border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetToCleanOriginal}
                className="w-full sm:w-auto px-3 py-2 text-xs text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                title="Revert to clean untouched PDF"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>View Clean Original</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="px-3.5 py-2 text-xs text-white/50 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDraft(selectedDraftToLoad)}
                  className="px-4 py-2 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Draft & View This Version</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CONTRIBUTORS HISTORY MODAL */}
      {showContributorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-emerald-400 p-[1.5px] flex items-center justify-center shadow-glow">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-xs font-bold text-white uppercase font-mono">
                    {contributors[0]?.name?.slice(0, 2).toUpperCase() || 'SB'}
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">PDF Contributors</h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Cohort peers who saved annotations on this document.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContributorsModal(false)}
                className="p-2 text-white/50 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2.5 max-h-64 overflow-y-auto">
              {contributors.map((contrib, idx) => {
                const matchingDraft = drafts.find(
                  (d) => d.authorName.toLowerCase() === contrib.name.toLowerCase()
                );
                return (
                  <div
                    key={`${contrib.name}_${idx}`}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface/70 dark:bg-surface/70 light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-400 to-emerald-400 p-[1.5px] flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono">
                          {contrib.name.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white dark:text-white light:text-zinc-900">
                          {contrib.name}
                        </div>
                        <div className="text-[10px] font-mono text-white/40 dark:text-white/40 light:text-zinc-500">
                          {formatTimeAgo(contrib.savedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {contrib.strokeCount !== undefined && contrib.strokeCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white/70 dark:text-white/70 light:text-zinc-700">
                          {contrib.strokeCount} marks
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowContributorsModal(false);
                          if (matchingDraft) {
                            handleOpenDraftPrompt(matchingDraft);
                          } else {
                            const fallback: SavedDraft = {
                              id: `draft_${contrib.name.toLowerCase()}`,
                              authorName: contrib.name,
                              savedAt: contrib.savedAt,
                              geometries: pageGeometries,
                              bookmarks,
                              status,
                              strokeCount: contrib.strokeCount || 0,
                            };
                            handleOpenDraftPrompt(fallback);
                          }
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white text-white hover:text-black rounded-lg text-[11px] font-semibold transition-all"
                      >
                        Draft
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 dark:border-white/10 light:border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContributorsModal(false)}
                className="px-4 py-2 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOAST SUCCESS NOTIFICATION */}
      {saveSuccessMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-white/20 animate-scale-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 7. ROUGH PAGE SCRATCHPAD / WHITE PAPER ASIDE */}
      <RoughPageModal
        isOpen={isRoughPageOpen}
        onClose={() => setIsRoughPageOpen(false)}
        activeColor={activeColor}
      />

      {/* 8. CONFIRM PERMANENT DELETE DOCUMENT MODAL */}
      <ConfirmDeleteModal
        isOpen={showConfirmDeleteDoc}
        title="Delete Document Permanently?"
        message="Are you sure? This will be permanently deleted from this app."
        itemTitle={doc.title}
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={() => {
          setShowConfirmDeleteDoc(false);
          onDeleteDocument?.();
        }}
        onCancel={() => setShowConfirmDeleteDoc(false)}
      />

      {/* 9. CONFIRM PERMANENT DELETE BOOKMARK MODAL */}
      <ConfirmDeleteModal
        isOpen={bookmarkToDelete !== null}
        title="Delete Bookmark Permanently?"
        message="Are you sure? This will be permanently deleted from this app."
        itemTitle={
          bookmarkToDelete !== null
            ? `Bookmark on Page ${bookmarkToDelete}: "${
                bookmarks.find((b) => b.pageNumber === bookmarkToDelete)?.title || 'Bookmark'
              }"`
            : undefined
        }
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={() => {
          if (bookmarkToDelete !== null) {
            handleRemoveBookmark(bookmarkToDelete);
          }
          setBookmarkToDelete(null);
        }}
        onCancel={() => setBookmarkToDelete(null)}
      />

    </div>
  );
};
