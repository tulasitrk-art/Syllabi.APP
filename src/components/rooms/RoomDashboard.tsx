'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';
import { STATUS_CONFIG, SUBJECT_METADATA } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { extractPdfPageCountFromBuffer } from '@/lib/pdfStorage';
import { NoticeBoard } from '@/components/notice/NoticeBoardModal';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import {
  BookOpen,
  Plus,
  Copy,
  Check,
  Users,
  Search,
  Bookmark as BookmarkIcon,
  ArrowRight,
  Upload,
  Radio,
  FileUp,
  FolderOpen,
  Trash2,
  Sparkles,
  Download,
  X,
  DoorOpen,
  FolderPlus,
  Layers,
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
  isHomePage?: boolean;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  roomInfo,
  documents,
  activePresences,
  isConnected,
  onStatusChange,
  onAddDocument,
  onDeleteDocument,
  isHomePage = false,
}) => {
  const router = useRouter();

  // Filters & Search
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<SubjectCode | 'ALL'>('ALL');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<number | 'ALL'>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; title: string } | null>(null);

  // Upload Form States
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSubject, setUploadSubject] = useState<SubjectCode>('SYLLABUS');
  const [uploadUnit, setUploadUnit] = useState<number>(1);
  const [uploadTopic, setUploadTopic] = useState<string>('');
  const [detectedPages, setDetectedPages] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Room Modal States
  const [roomModalTab, setRoomModalTab] = useState<'join' | 'create'>('join');
  const [roomJoinCode, setRoomJoinCode] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyJoinCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomInfo.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Handle local file selection and auto-detect real page count
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name);
      }

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

      // Reset & close modal
      setUploadTitle('');
      setUploadTopic('');
      setUploadedFile(null);
      setDetectedPages(1);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsUploadModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Room Join/Create
  const handleRoomJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomJoinCode.trim()) return;
    const clean = roomJoinCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    setIsRoomModalOpen(false);
    router.push(`/rooms/room-${clean}`);
  };

  const handleRoomCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const generatedId = `room-${Date.now().toString(36)}`;
    setIsRoomModalOpen(false);
    router.push(`/rooms/${generatedId}`);
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (selectedSubjectFilter !== 'ALL') {
      const docSubj = doc.subject === 'DEVC' ? 'DMGT' : doc.subject;
      if (docSubj !== selectedSubjectFilter) {
        return false;
      }
    }
    if (selectedUnitFilter !== 'ALL' && doc.unit !== selectedUnitFilter) {
      return false;
    }
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
  const allSubjectCodes: SubjectCode[] = ['SYLLABUS', 'AI', 'ADS', 'DMGT', 'JAVA', 'UHV'];

  return (
    <div className="flex-1 w-full bg-pitch dark:bg-pitch light:bg-[#f7f7f8] text-white dark:text-white light:text-zinc-900 flex flex-col min-h-screen selection:bg-white/20">
      {/* 1. TOP HEADER WITH FUNCTIONAL BUTTONS */}
      <header className="sticky top-0 z-30 w-full border-b border-white/10 dark:border-white/10 light:border-zinc-200 bg-pitch/85 dark:bg-pitch/85 light:bg-white/85 backdrop-blur-2xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & App Tag */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              title="Syllabi Home"
            >
              <div className="w-9 h-9 rounded-2xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/20 dark:border-white/20 light:border-zinc-300 flex items-center justify-center shadow-glow group-hover:border-white transition-colors">
                <BookOpen className="w-4 h-4 text-white dark:text-white light:text-zinc-900" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-white dark:text-white light:text-zinc-900">
                    Syllabi
                  </span>
                  <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase px-1.5 py-0.2 rounded border border-white/10">
                    v1.0 OS
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Top Right Functional Buttons: [+ Upload Documents], [Room (Join/Create)], Status & Theme */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Functional Button 1: Upload Documents */}
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shadow-glow"
              title="Upload Syllabus PDF Document"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Upload Documents</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {/* Functional Button 2: Room (Join / Create Room) */}
            <button
              type="button"
              onClick={() => setIsRoomModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface dark:bg-surface light:bg-zinc-100 hover:bg-interactive dark:hover:bg-interactive light:hover:bg-zinc-200 border border-white/15 dark:border-white/15 light:border-zinc-300 text-xs font-medium text-white dark:text-white light:text-zinc-900 transition-all shadow-sm active:scale-95"
              title="Join or Create Study Room"
            >
              <DoorOpen className="w-3.5 h-3.5 text-white/70 dark:text-white/70 light:text-zinc-700" />
              <span className="hidden md:inline">Room</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white/80 dark:text-white/80 light:text-zinc-800">
                {roomInfo.joinCode}
              </span>
            </button>

            {/* Realtime & Online Indicator (hidden on small mobile) */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-300 text-[11px] font-mono text-white/70 dark:text-white/70 light:text-zinc-700">
              <Radio className={`w-3 h-3 ${isConnected ? 'text-white dark:text-white light:text-black animate-pulse' : 'text-white/30'}`} />
              <span>{isConnected ? 'Live' : 'Connecting'}</span>
              <span className="text-white/20">•</span>
              <Users className="w-3 h-3 text-white/50" />
              <span>{activePresences.length} online</span>
            </div>

            {/* Dark/Light Mode Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 2. WELCOME GREETING HERO SECTION */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="p-8 sm:p-10 rounded-3xl ios-glass-panel relative overflow-hidden border border-white/15 dark:border-white/15 light:border-zinc-300 shadow-2xl">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-interactive dark:bg-interactive light:bg-zinc-100 border border-white/15 dark:border-white/15 light:border-zinc-300 mb-4 text-xs text-white/80 dark:text-white/80 light:text-zinc-700 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white dark:text-white light:text-black" />
              <span>Focused study rooms • Zero distraction</span>
            </div>

            {/* Greeting Heading */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white dark:text-white light:text-zinc-900 leading-[1.1]">
              Welcome to Syllabi.
            </h1>

            {/* Description */}
            <p className="mt-3 text-sm sm:text-base text-white/60 dark:text-white/60 light:text-zinc-600 leading-relaxed max-w-2xl">
              Collaborative monochrome study ecosystem. Share, track, and annotate university syllabus
              documents in real time with high-fidelity canvas layers and independent progress checklists.
            </p>

            {/* Current Room Quick Info Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-5 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="text-xs font-mono text-white/50 dark:text-white/50 light:text-zinc-500">
                ACTIVE WORKSPACE:
              </div>

              <div className="text-xs font-bold text-white dark:text-white light:text-zinc-900 bg-white/10 dark:bg-white/10 light:bg-zinc-200 px-3 py-1 rounded-lg border border-white/15">
                {roomInfo.name}
              </div>

              <button
                type="button"
                onClick={copyJoinCode}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-interactive dark:bg-interactive light:bg-zinc-100 hover:bg-white dark:hover:bg-white light:hover:bg-black hover:text-black dark:hover:text-black light:hover:text-white border border-white/15 dark:border-white/15 light:border-zinc-300 text-xs font-mono transition-colors active:scale-95 shadow-sm"
                title="Click to copy join code"
              >
                <span className="text-white/40 group-hover:text-black">JOIN CODE:</span>
                <span className="font-bold">{roomInfo.joinCode}</span>
                {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => setIsRoomModalOpen(true)}
                className="text-xs text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-black underline underline-offset-4 ml-auto"
              >
                Switch or Create Room &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SYLLABUS DOCUMENT LIBRARY OPENLY DISPLAYED */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6">
        <section className="space-y-5">
          {/* HEADER ROW: Title + Notice Board (Animated Robo-Smile Whiteboard) + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white dark:text-white light:text-zinc-900">
                  Syllabus Document Library
                </h2>
                <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500 mt-0.5">
                  Showing {filteredDocuments.length} of {totalDocs} syllabus documents available for cohort study.
                </p>
              </div>

              {/* KEY FEATURE: NOTICE BOARD BUTTON WITH ANIMATED ROBO-SMILE WHITEBOARD */}
              <NoticeBoard roomId={roomInfo.id} />
            </div>

            {/* Search Input */}
            <div className="relative min-w-[280px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 dark:text-white/40 light:text-zinc-400" />
              <input
                type="text"
                placeholder="Search by topic, unit or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface dark:bg-surface light:bg-white border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 light:placeholder-zinc-400 focus:outline-none focus:border-white/40 transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* Subject Filter Pills (Including the new SYLLABUS option) */}
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

            {allSubjectCodes.map((subj) => {
              const count = documents.filter((d) => (d.subject === 'DEVC' ? 'DMGT' : d.subject) === subj).length;
              const isSelected = selectedSubjectFilter === subj;
              const meta = SUBJECT_METADATA[subj];
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
                    {meta?.name || subj}
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
          <div className="ios-glass-card p-14 text-center flex flex-col items-center justify-center my-6">
            <FolderOpen className="w-12 h-12 text-white/20 dark:text-white/20 light:text-zinc-400 mb-3" />
            <h3 className="text-sm font-semibold text-white dark:text-white light:text-zinc-900">
              {totalDocs === 0
                ? 'No syllabus documents in this room yet'
                : 'No documents match the current filters'}
            </h3>
            <p className="text-xs text-white/40 dark:text-white/40 light:text-zinc-500 max-w-sm mt-1 mb-2">
              {totalDocs === 0
                ? 'Use the "Upload Documents" button in the top navigation bar to add syllabus documents.'
                : 'Try adjusting your subject or unit filters to view documents.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocuments.map((doc) => {
              const currentStatus = doc.userProgress?.status || 'UNREAD';
              const statusCfg = STATUS_CONFIG[currentStatus];
              const bookmarksCount = doc.userProgress?.bookmarks?.length || 0;
              const displaySubj = doc.subject === 'DEVC' ? 'DMGT' : doc.subject;
              const subjMeta = SUBJECT_METADATA[displaySubj as SubjectCode] || SUBJECT_METADATA[doc.subject];

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
                          {displaySubj}
                        </span>
                        <span className="text-[11px] font-mono text-white/60 dark:text-white/60 light:text-zinc-600">
                          Unit {doc.unit}
                        </span>
                      </div>

                      {/* Status Checklist Dropdown */}
                      <div className="relative">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            onStatusChange(doc.id, e.target.value as DocumentStatus)
                          }
                          className={`text-[10px] font-mono px-2 py-1 rounded-lg border appearance-none pr-5 cursor-pointer bg-interactive dark:bg-interactive light:bg-zinc-100 ${statusCfg.badge}`}
                        >
                          <option value="UNREAD" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">Unread</option>
                          <option value="IN_PROGRESS" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">In Progress</option>
                          <option value="READ" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">Completed</option>
                          <option value="NEEDS_REVISION" className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black">Needs Revision</option>
                        </select>
                      </div>
                    </div>

                    {/* Subject Full Title */}
                    <div className="text-[11px] font-medium text-white/40 dark:text-white/40 light:text-zinc-500 mb-1">
                      {subjMeta?.name || displaySubj}
                    </div>

                    {/* Document Title */}
                    <h3 className="text-sm font-bold text-white dark:text-white light:text-zinc-900 tracking-tight mb-2 line-clamp-1">
                      {doc.title}
                    </h3>

                    {/* Syllabus Topic Concept */}
                    {doc.syllabusTopic && (
                      <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-600 line-clamp-2 leading-relaxed mb-4">
                        {doc.syllabusTopic}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Row: Metadata & Study & Annotate Action */}
                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
                    <div className="flex items-center gap-3 text-xs text-white/40 dark:text-white/40 light:text-zinc-500 font-mono">
                      <span>{doc.totalPages || 1} pages</span>
                      {bookmarksCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <BookmarkIcon className="w-3 h-3 text-white/60 dark:text-white/60 light:text-zinc-700" />
                          <span>{bookmarksCount}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Download PDF button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const a = document.createElement('a');
                          a.href = doc.fileUrl || `/api/documents/${doc.id}/file`;
                          a.download = doc.title.endsWith('.pdf') ? doc.title : `${doc.title}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="p-1.5 text-white/40 dark:text-white/40 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black rounded-lg hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-zinc-200 transition-colors"
                        title={`Download "${doc.title}"`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteDocument && (
                        <button
                          type="button"
                          onClick={() => setDocToDelete({ id: doc.id, title: doc.title })}
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

      {/* 5. UPLOAD DOCUMENT MODAL (POPS UP FROM TOP-RIGHT FUNCTIONAL BUTTON) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white flex items-center justify-center font-bold shadow-glow">
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    Upload Syllabus Document
                  </h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Add full PDF syllabus documents to this study room.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 text-white/50 dark:text-white/50 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-5">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/20 dark:border-white/20 light:border-zinc-300 hover:border-white/50 rounded-2xl p-5 bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-50 flex flex-col items-center justify-center cursor-pointer transition-colors group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileUp className="w-7 h-7 text-white/40 dark:text-white/40 light:text-zinc-400 group-hover:text-white dark:group-hover:text-white light:group-hover:text-black transition-colors mb-2" />
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
                      Click to choose PDF or drag and drop here
                    </span>
                    <span className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500">
                      Supports course syllabi, question papers, and revision notes
                    </span>
                  </div>
                )}
              </div>

              {/* Title & Subject Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Java_Unit_1_Syllabus.pdf"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                    Subject Category *
                  </label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value as SubjectCode)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 focus:outline-none focus:border-white"
                  >
                    {allSubjectCodes.map((code) => (
                      <option
                        key={code}
                        value={code}
                        className="bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-black"
                      >
                        {code} — {SUBJECT_METADATA[code]?.name || code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit Selector (1 to 5) */}
              <div>
                <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1.5">
                  Curriculum Unit
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((u) => {
                    const isSelected = uploadUnit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUploadUnit(u)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                          isSelected
                            ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white border-white dark:border-white light:border-black shadow-glow'
                            : 'bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-100 border-white/15 dark:border-white/15 light:border-zinc-300 text-white/70 dark:text-white/70 light:text-zinc-700 hover:border-white/30'
                        }`}
                      >
                        Unit {u}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Syllabus Topic (Optional) */}
              <div>
                <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                  Syllabus Topic / Examination Target (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Heuristic Search & Adversarial Algorithms"
                  value={uploadTopic}
                  onChange={(e) => setUploadTopic(e.target.value)}
                  className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs text-white/50 hover:text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !uploadTitle.trim()}
                  className="px-6 py-2.5 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow flex items-center gap-2 disabled:opacity-40"
                >
                  <Plus className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>{isSubmitting ? 'Uploading to Room...' : 'Upload Syllabus to Room'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ROOM MODAL (JOIN ROOM & CREATE ROOM DOCK) */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-surface dark:bg-surface light:bg-zinc-100 border border-white/20 flex items-center justify-center">
                  <DoorOpen className="w-4 h-4 text-white dark:text-white light:text-zinc-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Study Rooms</h2>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Join a peer cohort or create a dedicated study space.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                className="p-2 text-white/50 dark:text-white/50 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Room Pill */}
            <div className="my-4 p-3 rounded-2xl bg-pitch/60 dark:bg-pitch/60 light:bg-zinc-50 border border-white/10 dark:border-white/10 light:border-zinc-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-white/40 dark:text-white/40 light:text-zinc-500 block">CURRENT ROOM</span>
                <span className="text-xs font-bold text-white dark:text-white light:text-zinc-900">{roomInfo.name}</span>
              </div>
              <button
                type="button"
                onClick={copyJoinCode}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-mono transition-colors"
                title="Copy Room Join Code"
              >
                <span>{roomInfo.joinCode}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/60" />}
              </button>
            </div>

            {/* Tabs: Join with Code vs Create Room */}
            <div className="flex bg-pitch/80 dark:bg-pitch/80 light:bg-zinc-100 rounded-2xl p-1 mb-4 border border-white/10 dark:border-white/10 light:border-zinc-200">
              <button
                type="button"
                onClick={() => setRoomModalTab('join')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                  roomModalTab === 'join'
                    ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                    : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                }`}
              >
                Join with Code
              </button>
              <button
                type="button"
                onClick={() => setRoomModalTab('create')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                  roomModalTab === 'create'
                    ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-glow'
                    : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                }`}
              >
                Create New Room
              </button>
            </div>

            {roomModalTab === 'join' ? (
              <form onSubmit={handleRoomJoinSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                    Enter 8-digit Join Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SYL-8492"
                    value={roomJoinCode}
                    onChange={(e) => setRoomJoinCode(e.target.value)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-4 py-3 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white font-mono tracking-wider uppercase text-center"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-glow"
                >
                  <span>Enter Study Room</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRoomCreateSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                    Study Room Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fall 2026 CS Core"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-4 py-3 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white text-center"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-glow"
                >
                  <span>Create & Generate Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRoomModalOpen(false);
                  router.push('/rooms/room-demo');
                }}
                className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black underline transition-colors"
              >
                Or explore the default cohort workspace (SYL-8492)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      <footer className="w-full border-t border-white/10 dark:border-white/10 light:border-zinc-200 py-6 px-6 text-center text-xs text-white/30 dark:text-white/30 light:text-zinc-500 font-mono">
        SYLLABI • COLLABORATIVE MONOCHROME ARCHITECTURE
      </footer>

      {/* UNIVERSAL CONFIRM PERMANENT DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(docToDelete)}
        title="Delete Document Permanently?"
        message="Are you sure? This will be permanently deleted from this app."
        itemTitle={docToDelete?.title}
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={() => {
          if (docToDelete && onDeleteDocument) {
            onDeleteDocument(docToDelete.id);
          }
          setDocToDelete(null);
        }}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
