'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AnnotationTool,
  DocumentWithProgress,
  PageAnnotationGeometry,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus } from '@/types/database';
import { AnnotationCanvas } from '@/components/annotation/AnnotationCanvas';
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
  Layers,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Share2,
  Download,
} from 'lucide-react';
import Link from 'next/link';

interface DocumentViewerProps {
  document: DocumentWithProgress;
  roomId: string;
  onStatusChange?: (status: DocumentStatus) => void;
  onAddBookmark?: (pageNumber: number, title: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document: doc,
  roomId,
  onStatusChange,
  onAddBookmark,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen');
  const [isSharedLayer, setIsSharedLayer] = useState<boolean>(true);
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

  return (
    <div className="flex flex-col h-screen w-full bg-pitch text-white overflow-hidden select-none">
      {/* 1. TOP NAVIGATION & STATUS BAR */}
      <header className="h-16 px-6 border-b border-white/10 bg-surface/80 backdrop-blur-xl flex items-center justify-between z-30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 bg-interactive hover:bg-interactive-hover transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Room Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20 uppercase tracking-wider font-semibold">
                {doc.subject} • Unit {doc.unit}
              </span>
              <h1 className="text-sm font-medium text-white tracking-tight truncate max-w-sm">
                {doc.title}
              </h1>
            </div>
            {doc.syllabusTopic && (
              <span className="text-[11px] text-white/40 truncate max-w-md">
                Topic: {doc.syllabusTopic}
              </span>
            )}
          </div>
        </div>

        {/* STATUS CHECKLIST PILL SELECTOR */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-interactive border border-white/15 rounded-2xl p-1">
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
                      ? 'bg-white text-black font-semibold shadow-glow'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* SHARED VS PRIVATE LAYER TOGGLE */}
          <button
            onClick={() => setIsSharedLayer(!isSharedLayer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border transition-all ${
              isSharedLayer
                ? 'bg-white/10 border-white/30 text-white'
                : 'bg-transparent border-white/10 text-white/40 hover:text-white'
            }`}
            title="Toggle shared peer annotation layer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isSharedLayer ? 'Shared Layer' : 'Private Layer'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. MAIN DOCUMENT CANVAS STAGE */}
      <div className="relative flex-1 w-full bg-pitch flex items-center justify-center overflow-auto p-4 md:p-8">
        {/* DOCUMENT CONTAINER WRAPPER */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
          }}
          className="relative w-full max-w-4xl aspect-[1/1.414] bg-surface rounded-2xl border border-white/15 shadow-ios overflow-hidden"
        >
          {/* BASE DEPTH (z-0): IMMUTABLE DOCUMENT BASE RENDERING */}
          <div className="absolute inset-0 z-0 p-8 md:p-14 flex flex-col justify-between bg-gradient-to-b from-[#0c0c0c] to-[#070707] text-white/90 select-none pointer-events-none">
            {/* Header of syllabus page */}
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
                  PAGE {currentPage} OF {doc.totalPages}
                </div>
              </div>
            </div>

            {/* Simulated High-Res Syllabus Document Body */}
            <div className="my-auto space-y-6 text-xs md:text-sm leading-relaxed text-white/80">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Section {doc.unit}.{currentPage}: {doc.syllabusTopic || 'Core Theoretical Foundations'}
                </h2>
                <p className="text-white/60 leading-normal">
                  This document serves as the canonical syllabus standard. Core theoretical
                  constructs, algorithmic complexities, and design invariants are detailed below
                  for collaborative cohort review.
                </p>
              </div>

              {/* Sample Syllabus Key Equations / Concepts */}
              <div className="p-4 rounded-xl bg-pitch/80 border border-white/10 font-mono text-xs space-y-2">
                <div className="text-white/40 uppercase text-[10px] tracking-wider">
                  Key Invariant & Mathematical Formalism:
                </div>
                <div className="text-white/95">
                  Let f(n) = g(n) + h(n), where h(n) ≤ c(n, a, n&apos;) + h(n&apos;) for consistency.
                </div>
                <div className="text-white/50 text-[11px]">
                  Time Bound: O(b^d) | Space Invariant: O(b • d) using iterative memory depth bounding.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Cohort Learning Objectives
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-white/60 text-xs">
                  <li>Analyze state-space complexity bounds and node expansion graphs.</li>
                  <li>Verify strict monotonicity proofs across all heuristic functions.</li>
                  <li>Annotate common examination edge cases and test questions.</li>
                </ul>
              </div>
            </div>

            {/* Footer of page */}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between text-[10px] text-white/30 font-mono">
              <span>SYLLABI OS • IMMUTABLE BASE LAYER (Z-0)</span>
              <span>RESTRICTED COHORT ACCESS</span>
              <span>VERIFIED SYLLABUS SPECIFICATION</span>
            </div>
          </div>

          {/* DYNAMIC ANNOTATION LAYER (z-10): TRANSPARENT OVERLAY RULE */}
          <div className="absolute inset-0 z-10">
            <AnnotationCanvas
              pageNumber={currentPage}
              initialGeometry={pageGeometries[currentPage]}
              activeTool={activeTool}
              isSharedLayer={isSharedLayer}
              canEdit={true}
              onSave={handleSaveGeometry}
            />
          </div>
        </div>
      </div>

      {/* 3. APPLE-STYLE FLOATING DOCK TOOLBAR (BOTTOM) */}
      <footer className="h-20 px-6 border-t border-white/10 bg-surface/90 backdrop-blur-2xl flex items-center justify-between z-30 flex-shrink-0">
        {/* PAGE NAVIGATION CONTROLS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-interactive border border-white/15 rounded-2xl p-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-xl text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium px-3 text-white/90">
              {currentPage} <span className="text-white/40">/ {doc.totalPages}</span>
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(doc.totalPages, p + 1))}
              disabled={currentPage >= doc.totalPages}
              className="p-1.5 rounded-xl text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60 transition-colors"
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
                  ? 'bg-white text-black font-semibold border-white shadow-glow'
                  : 'bg-interactive border-white/15 text-white/60 hover:text-white'
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5 fill-current" />
              <span className="hidden md:inline">
                {currentBookmark ? 'Bookmarked' : 'Bookmark'}
              </span>
            </button>

            {/* Quick Bookmark naming popover */}
            {bookmarkInputOpen && (
              <form
                onSubmit={handleAddBookmarkSubmit}
                className="absolute left-0 bottom-12 ios-glass-panel p-3 w-64 shadow-2xl z-40 animate-scale-up"
              >
                <div className="text-[11px] font-medium text-white/70 mb-2">
                  Bookmark Page {currentPage}
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Heuristic Proof Formula"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  className="w-full bg-pitch border border-white/20 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white mb-2"
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
                    className="px-2.5 py-1 bg-white text-black text-xs font-semibold rounded-lg hover:bg-white/90"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* PRIMARY ANNOTATION PALETTE (CENTER DOCK) */}
        <div className="flex items-center bg-interactive border border-white/20 rounded-2xl p-1.5 shadow-glow">
          {(
            [
              { tool: 'pen', label: 'Pen', icon: Pen },
              { tool: 'highlighter', label: 'Highlighter', icon: Highlighter },
              { tool: 'eraser', label: 'Eraser', icon: Eraser },
              { tool: 'note', label: 'Note', icon: MessageSquare },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.tool;
            return (
              <button
                key={item.tool}
                onClick={() => setActiveTool(item.tool)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ZOOM & VIEWPORT CONTROLS */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-interactive border border-white/15 rounded-2xl p-1">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.1))}
              className="p-1.5 rounded-xl text-white/60 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-2 text-white/80">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.8, z + 0.1))}
              className="p-1.5 rounded-xl text-white/60 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="p-1.5 rounded-xl text-white/60 hover:text-white transition-colors border-l border-white/10 ml-1"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
