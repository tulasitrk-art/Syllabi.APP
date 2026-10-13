'use client';

import React, { useState, useRef } from 'react';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';
import { STATUS_CONFIG, SUBJECT_METADATA, SyllabusSection } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { savePdfBlob, extractPdfPageCountFromBuffer } from '@/lib/pdfStorage';
import {
  BookOpen,
  Plus,
  Copy,
  Check,
  Users,
  Search,
  FileText,
  Bookmark as BookmarkIcon,
  ArrowRight,
  Upload,
  Radio,
  FileUp,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface RoomDashboardProps {
  roomInfo: StudyRoomSummary;
  documents: DocumentWithProgress[];
  activePresences: UserPresence[];
  isConnected: boolean;
  onStatusChange: (docId: string, status: DocumentStatus) => void;
  onAddDocument: (payload: {
    title: string;
    subject: SubjectCode;
    unit: number;
    syllabusTopic: string;
    totalPages?: number;
    fileUrl?: string;
    file?: File | null;
    buffer?: ArrayBuffer | null;
  }) => Promise<DocumentWithProgress | void>;
  onDeleteDocument?: (docId: string) => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  roomInfo,
  documents,
  activePresences,
  isConnected,
  onStatusChange,
  onAddDocument,
  onDeleteDocument,
}) => {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<SubjectCode | 'ALL'>('ALL');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<number | 'ALL'>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [expandedSyllabusSubject, setExpandedSyllabusSubject] = useState<SubjectCode | null>('AI');

  // Primary Upload Form States (no default topic names, no manual pages prompt)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSubject, setUploadSubject] = useState<SubjectCode>('AI');
  const [uploadUnit, setUploadUnit] = useState<number>(1);
  const [uploadTopic, setUploadTopic] = useState<string>('');
  const [detectedPages, setDetectedPages] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyJoinCode = () => {
    navigator.clipboard.writeText(roomInfo.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle local file selection and auto-detect real page count
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name);
      }

      // Automatically inspect PDF binary to extract total pages without asking user
      try {
        const buffer = await file.arrayBuffer();
        const pages = extractPdfPageCountFromBuffer(buffer);
        if (pages > 0) {
          setDetectedPages(pages);
        }
      } catch (err) {
        console.warn('Could not auto-read PDF pages:', err);
      }
    }
  };

  // Handle subject change in upload form
  const handleSubjectChange = (subj: SubjectCode) => {
    setUploadSubject(subj);
  };

  // Handle unit section selection in upload form
  const handleSectionSelect = (section: SyllabusSection) => {
    setUploadUnit(section.unit);
  };

  // Submit Upload Form
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    setIsSubmitting(true);
    let bufferToStore: ArrayBuffer | null = null;
    let finalPageCount = detectedPages || 1;

    if (uploadedFile) {
      try {
        bufferToStore = await uploadedFile.arrayBuffer();
        const inspected = extractPdfPageCountFromBuffer(bufferToStore);
        if (inspected > 0) {
          finalPageCount = inspected;
        }
      } catch (e) {
        console.warn('Error reading file buffer:', e);
      }
    }

    try {
      await onAddDocument({
        title: uploadTitle.trim().endsWith('.pdf') ? uploadTitle.trim() : `${uploadTitle.trim()}.pdf`,
        subject: uploadSubject,
        unit: Number(uploadUnit),
        syllabusTopic: uploadTopic.trim(),
        totalPages: finalPageCount,
        file: uploadedFile,
        buffer: bufferToStore,
      });

      // Reset form
      setUploadTitle('');
      setUploadTopic('');
      setUploadedFile(null);
      setDetectedPages(1);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (selectedSubjectFilter !== 'ALL' && doc.subject !== selectedSubjectFilter) return false;
    if (selectedUnitFilter !== 'ALL' && doc.unit !== selectedUnitFilter) return false;
    if (selectedStatusFilter !== 'ALL') {
      const docStatus = doc.userProgress?.status || 'UNREAD';
      if (docStatus !== selectedStatusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchTopic = (doc.syllabusTopic || '').toLowerCase().includes(q);
      if (!matchTitle && !matchTopic) return false;
    }
    return true;
  });

  const totalDocs = documents.length;

  return (
    <div className="flex-1 w-full bg-pitch dark:bg-pitch light:bg-[#f7f7f8] text-white dark:text-white light:text-zinc-900 flex flex-col min-h-screen">
      {/* 1. ROOM HEADER */}
      <header className="sticky top-0 z-20 w-full border-b border-white/10 dark:border-white/10 light:border-zinc-200 bg-pitch/80 dark:bg-pitch/80 light:bg-white/80 backdrop-blur-2xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 flex items-center justify-center hover:border-white/40 transition-colors"
              title="Return to Home"
            >
              <BookOpen className="w-5 h-5 text-white dark:text-white light:text-zinc-900" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white dark:text-white light:text-zinc-900">
                  {roomInfo.name}
                </h1>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-interactive dark:bg-interactive light:bg-zinc-200 border border-white/15 dark:border-white/15 light:border-zinc-300 text-[11px] font-mono cursor-pointer hover:border-white/30 transition-colors"
                  onClick={copyJoinCode}
                  title="Click to copy join code"
                >
                  <span className="text-white/50 dark:text-white/50 light:text-zinc-500">CODE:</span>
                  <span className="text-white dark:text-white light:text-zinc-900 font-semibold">{roomInfo.joinCode}</span>
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-white dark:text-white light:text-zinc-900" />
                  ) : (
                    <Copy className="w-3 h-3 text-white/50 dark:text-white/50 light:text-zinc-500" />
                  )}
                </div>
              </div>
              <p className="text-xs text-white/40 dark:text-white/40 light:text-zinc-500 mt-0.5">
                Collaborative Study Ecosystem • {totalDocs} syllabus documents loaded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isConnected ? 'text-white dark:text-white light:text-black animate-pulse' : 'text-white/30'
                }`}
              />
              <span className="text-white/70 dark:text-white/70 light:text-zinc-700 font-mono text-[11px]">
                {isConnected ? 'Realtime Connected' : 'Connecting...'}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 text-xs">
              <Users className="w-3.5 h-3.5 text-white/50 dark:text-white/50 light:text-zinc-500" />
              <span className="text-white/70 dark:text-white/70 light:text-zinc-700 text-xs">
                {activePresences.length} online
              </span>
            </div>

            {/* DARK / LIGHT MODE TOGGLE */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-8">
        {/* PRIMARY HERO: UPLOAD SECTION FIRST */}
        <section className="w-full ios-glass-panel p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-white/20 dark:border-white/20 light:border-zinc-300">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left side: Upload Form */}
            <div className="flex-1 space-y-5">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white flex items-center justify-center font-bold">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white dark:text-white light:text-zinc-900">
                    Upload Syllabus Document
                  </h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Add full PDF syllabus documents. Pages and structure are automatically detected.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* File Dropzone / Selector */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/20 dark:border-white/20 light:border-zinc-300 hover:border-white/50 rounded-2xl p-4 bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-50 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileUp className="w-6 h-6 text-white/40 dark:text-white/40 light:text-zinc-400 group-hover:text-white dark:group-hover:text-white light:group-hover:text-black transition-colors mb-2" />
                  {uploadedFile ? (
                    <div className="text-center">
                      <span className="text-xs font-semibold text-white dark:text-white light:text-zinc-900 block">
                        {uploadedFile.name}
                      </span>
                      <span className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500">
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Auto-detected {detectedPages} page{detectedPages > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-xs font-medium text-white/80 dark:text-white/80 light:text-zinc-700 block">
                        Click to select PDF or drag and drop
                      </span>
                      <span className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500">
                        Supports full PDF syllabi, question papers & lecture slides
                      </span>
                    </div>
                  )}
                </div>

                {/* Title & Subject Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                      Document Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JAVA_Unit_1.pdf"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full bg-pitch dark:bg-pitch light:bg-white border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 light:placeholder-zinc-400 focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                      Subject
                    </label>
                    <select
                      value={uploadSubject}
                      onChange={(e) => handleSubjectChange(e.target.value as SubjectCode)}
                      className="w-full bg-pitch dark:bg-pitch light:bg-white border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 focus:outline-none focus:border-white"
                    >
                      {(['AI', 'ADS', 'DEVC', 'JAVA', 'UHV'] as SubjectCode[]).map((code) => (
                        <option key={code} value={code} className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">
                          {code} — {SUBJECT_METADATA[code].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SYLLABUS SECTION PICKER ALONGSIDE SUBJECT */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white/80 dark:text-white/80 light:text-zinc-700">
                      Select Syllabus Section (Unit 1 to 5)
                    </label>
                    <span className="text-[10px] font-mono text-white/40 dark:text-white/40 light:text-zinc-500">
                      Subject: {SUBJECT_METADATA[uploadSubject].name}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {SUBJECT_METADATA[uploadSubject].sections.map((sec) => {
                      const isSelected = uploadUnit === sec.unit;
                      return (
                        <button
                          key={sec.unit}
                          type="button"
                          onClick={() => handleSectionSelect(sec)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white border-white dark:border-white light:border-black shadow-glow'
                              : 'bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-50 border-white/15 dark:border-white/15 light:border-zinc-300 text-white/70 dark:text-white/70 light:text-zinc-700 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-[10px] font-mono font-bold uppercase">
                              Unit {sec.unit}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-black dark:text-black light:text-white" />}
                          </div>
                          <span
                            className={`text-[11px] font-medium line-clamp-2 leading-tight ${
                              isSelected ? 'text-black dark:text-black light:text-white' : 'text-white/90 dark:text-white/90 light:text-zinc-800'
                            }`}
                          >
                            {sec.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Topic Description (Clean without forced default text) */}
                <div>
                  <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                    Syllabus Topic / Target Concepts (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 1, Graph Algorithms, or leave blank"
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-white border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 light:placeholder-zinc-400 focus:outline-none focus:border-white"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !uploadTitle.trim()}
                    className="px-6 py-2.5 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow flex items-center gap-2 disabled:opacity-40"
                  >
                    <Plus className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{isSubmitting ? 'Syncing to Room...' : 'Upload Syllabus to Room'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right side: Syllabus Sections Explorer Accordion */}
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 dark:border-white/10 light:border-zinc-200 lg:pl-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-white dark:text-white light:text-zinc-900" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white dark:text-white light:text-zinc-900">
                    Syllabus Section Reference
                  </h3>
                </div>
                <p className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500 mb-3">
                  Curated curriculum units mapped to subjects for cohort study.
                </p>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {(['AI', 'ADS', 'DEVC', 'JAVA', 'UHV'] as SubjectCode[]).map((subjCode) => {
                    const subj = SUBJECT_METADATA[subjCode];
                    const isExpanded = expandedSyllabusSubject === subjCode;
                    return (
                      <div
                        key={subjCode}
                        className="rounded-xl border border-white/10 dark:border-white/10 light:border-zinc-200 bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-50 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSyllabusSubject(isExpanded ? null : subjCode)
                          }
                          className="w-full p-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white dark:text-white light:text-zinc-900">
                              {subj.code}
                            </span>
                            <span className="text-xs font-semibold text-white dark:text-white light:text-zinc-900 truncate max-w-[150px]">
                              {subj.name}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-2.5 pt-0 border-t border-white/5 dark:border-white/5 light:border-zinc-200 space-y-1.5 mt-1">
                            {subj.sections.map((sec) => (
                              <div
                                key={sec.unit}
                                className="text-[10px] p-1.5 rounded-lg bg-surface dark:bg-surface light:bg-white border border-white/5 dark:border-white/5 light:border-zinc-200"
                              >
                                <div className="font-semibold text-white/90 dark:text-white/90 light:text-zinc-800">
                                  Unit {sec.unit}: {sec.title}
                                </div>
                                <div className="text-white/40 dark:text-white/40 light:text-zinc-500 mt-0.5 truncate">
                                  {sec.topics.join(' • ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SYLLABUS DIRECTORY & FILTER BAR */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white dark:text-white light:text-zinc-900">
                Syllabus Document Library
              </h2>
              <p className="text-xs text-white/40 dark:text-white/40 light:text-zinc-500">
                {totalDocs === 0
                  ? 'No documents uploaded yet. Add a syllabus PDF using the upload section above.'
                  : `Showing ${filteredDocuments.length} of ${totalDocs} uploaded documents.`}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 dark:text-white/40 light:text-zinc-400" />
              <input
                type="text"
                placeholder="Search by topic, unit or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface dark:bg-surface light:bg-white border border-white/10 dark:border-white/10 light:border-zinc-300 rounded-2xl pl-9 pr-4 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 light:placeholder-zinc-400 focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>

          {/* Subject Filter Pills with Syllabus Names */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedSubjectFilter('ALL')}
              className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedSubjectFilter === 'ALL'
                  ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                  : 'bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
              }`}
            >
              All Subjects ({totalDocs})
            </button>
            {(['AI', 'ADS', 'DEVC', 'JAVA', 'UHV'] as SubjectCode[]).map((subj) => {
              const count = documents.filter((d) => d.subject === subj).length;
              const isSelected = selectedSubjectFilter === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubjectFilter(subj)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                      : 'bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 text-white/60 dark:text-white/60 light:text-zinc-600 hover:text-white'
                  }`}
                >
                  <span className="font-mono font-bold">{subj}</span>
                  <span className="text-white/60 dark:text-white/60 light:text-zinc-600 text-[11px]">
                    {SUBJECT_METADATA[subj].name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? 'bg-black/10 dark:bg-black/10 light:bg-white/20 text-black dark:text-black light:text-white'
                        : 'bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white/60 dark:text-white/60 light:text-zinc-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Unit & Status Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 rounded-2xl p-1 text-xs">
              <button
                onClick={() => setSelectedUnitFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  selectedUnitFilter === 'ALL'
                    ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold'
                    : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                }`}
              >
                All Units
              </button>
              {[1, 2, 3, 4, 5].map((u) => (
                <button
                  key={u}
                  onClick={() => setSelectedUnitFilter(u)}
                  className={`px-3 py-1 rounded-xl transition-all ${
                    selectedUnitFilter === u
                      ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold'
                      : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                  }`}
                >
                  Unit {u}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 rounded-2xl p-1 text-xs">
              {(
                [
                  { key: 'ALL', label: 'All Status' },
                  { key: 'IN_PROGRESS', label: 'In Progress' },
                  { key: 'READ', label: 'Completed' },
                  { key: 'NEEDS_REVISION', label: 'Revision' },
                  { key: 'UNREAD', label: 'Unread' },
                ] as const
              ).map((st) => (
                <button
                  key={st.key}
                  onClick={() => setSelectedStatusFilter(st.key)}
                  className={`px-3 py-1 rounded-xl transition-all ${
                    selectedStatusFilter === st.key
                      ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold'
                      : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 4. DOCUMENTS GRID OR EMPTY STATE */}
        {filteredDocuments.length === 0 ? (
          <div className="ios-glass-card p-12 text-center flex flex-col items-center justify-center my-4">
            <FolderOpen className="w-12 h-12 text-white/20 dark:text-white/20 light:text-zinc-400 mb-3" />
            <h3 className="text-sm font-semibold text-white dark:text-white light:text-zinc-900">
              {totalDocs === 0
                ? 'No syllabus documents in this room yet'
                : 'No documents match the current filters'}
            </h3>
            <p className="text-xs text-white/40 dark:text-white/40 light:text-zinc-500 max-w-sm mt-1">
              {totalDocs === 0
                ? 'Select a PDF in the upload section above to begin collaborative studying.'
                : 'Try adjusting your subject or unit filters to view documents.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocuments.map((doc) => {
              const currentStatus = doc.userProgress?.status || 'UNREAD';
              const statusCfg = STATUS_CONFIG[currentStatus];
              const bookmarksCount = doc.userProgress?.bookmarks?.length || 0;
              const subjMeta = SUBJECT_METADATA[doc.subject];

              return (
                <div
                  key={doc.id}
                  className="ios-glass-card p-6 flex flex-col justify-between group hover:border-white/30 dark:hover:border-white/30 light:hover:border-zinc-400 transition-all duration-200"
                >
                  <div>
                    {/* Top Row: Subject Badge with Subject Name & Unit */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white dark:text-white light:text-zinc-900 border border-white/20 dark:border-white/20 light:border-zinc-300">
                          {doc.subject}
                        </span>
                        <span className="text-[11px] font-mono text-white/60 dark:text-white/60 light:text-zinc-600">
                          Unit {doc.unit}
                        </span>
                      </div>

                      {/* Status Checklist Dropdown */}
                      <select
                        value={currentStatus}
                        onChange={(e) =>
                          onStatusChange(doc.id, e.target.value as DocumentStatus)
                        }
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-xl border bg-pitch dark:bg-pitch light:bg-white cursor-pointer focus:outline-none ${statusCfg.badge}`}
                      >
                        <option value="UNREAD" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">
                          Unread
                        </option>
                        <option value="IN_PROGRESS" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">
                          In Progress
                        </option>
                        <option value="READ" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">
                          Completed
                        </option>
                        <option value="NEEDS_REVISION" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">
                          Needs Revision
                        </option>
                      </select>
                    </div>

                    {/* Subject Full Name Header */}
                    <div className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500 font-medium mb-1">
                      {subjMeta?.name}
                    </div>

                    {/* Document Title */}
                    <h2 className="text-sm font-semibold text-white dark:text-white light:text-zinc-900 tracking-tight group-hover:text-white transition-colors line-clamp-1">
                      {doc.title}
                    </h2>

                    {/* Syllabus Topic */}
                    {doc.syllabusTopic && (
                      <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-600 mt-1 line-clamp-2 leading-relaxed">
                        {doc.syllabusTopic}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row */}
                  <div className="pt-5 mt-5 border-t border-white/10 dark:border-white/10 light:border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500">
                      <span className="font-mono">{doc.totalPages} pages</span>
                      {bookmarksCount > 0 && (
                        <span className="flex items-center gap-1">
                          <BookmarkIcon className="w-3 h-3 text-white/60 dark:text-white/60 light:text-zinc-700" />
                          <span>{bookmarksCount}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {onDeleteDocument && (
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1.5 text-white/30 dark:text-white/30 light:text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-black rounded-lg transition-colors"
                          title="Delete syllabus document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <Link
                        href={`/rooms/${roomInfo.id}/documents/${doc.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-interactive dark:bg-interactive light:bg-zinc-200 hover:bg-white dark:hover:bg-white light:hover:bg-black hover:text-black dark:hover:text-black light:hover:text-white border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl text-xs font-medium text-white dark:text-white light:text-zinc-900 transition-all active:scale-95 shadow-sm"
                      >
                        <span>Study & Annotate</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. FOOTER */}
      <footer className="w-full border-t border-white/10 dark:border-white/10 light:border-zinc-200 py-6 px-6 text-center text-xs text-white/30 dark:text-white/30 light:text-zinc-500 font-mono">
        SYLLABI • COLLABORATIVE MONOCHROME ARCHITECTURE
      </footer>
    </div>
  );
};
