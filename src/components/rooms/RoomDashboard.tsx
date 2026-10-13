'use client';

import React, { useState } from 'react';
import {
  DocumentWithProgress,
  StudyRoomSummary,
  UserPresence,
  Bookmark,
} from '@/types/syllabi';
import { DocumentStatus, SubjectCode } from '@/types/database';
import { STATUS_CONFIG, SUBJECT_METADATA } from '@/lib/utils';
import {
  BookOpen,
  Plus,
  Copy,
  Check,
  Users,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Bookmark as BookmarkIcon,
  MessageSquare,
  ArrowRight,
  Upload,
  X,
  Wifi,
  Radio,
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
  }) => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  roomInfo,
  documents,
  activePresences,
  isConnected,
  onStatusChange,
  onAddDocument,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode | 'ALL'>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Form states for Upload Modal
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSubject, setNewSubject] = useState<SubjectCode>('AI');
  const [newUnit, setNewUnit] = useState<number>(1);
  const [newTopic, setNewTopic] = useState<string>('');
  const [newPages, setNewPages] = useState<number>(10);

  const copyJoinCode = () => {
    navigator.clipboard.writeText(roomInfo.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddDocument({
      title: newTitle.trim().endsWith('.pdf') ? newTitle.trim() : `${newTitle.trim()}.pdf`,
      subject: newSubject,
      unit: Number(newUnit),
      syllabusTopic: newTopic.trim(),
      totalPages: Number(newPages) || 1,
    });

    setNewTitle('');
    setNewTopic('');
    setIsUploadOpen(false);
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (selectedSubject !== 'ALL' && doc.subject !== selectedSubject) return false;
    if (selectedUnit !== 'ALL' && doc.unit !== selectedUnit) return false;
    if (selectedStatus !== 'ALL') {
      const docStatus = doc.userProgress?.status || 'UNREAD';
      if (docStatus !== selectedStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchTopic = (doc.syllabusTopic || '').toLowerCase().includes(q);
      if (!matchTitle && !matchTopic) return false;
    }
    return true;
  });

  // Calculate metrics
  const totalDocs = documents.length;
  const completedDocs = documents.filter((d) => d.userProgress?.status === 'READ').length;
  const inProgressDocs = documents.filter((d) => d.userProgress?.status === 'IN_PROGRESS').length;
  const revisionDocs = documents.filter((d) => d.userProgress?.status === 'NEEDS_REVISION').length;
  const completionPercentage = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  return (
    <div className="flex-1 w-full bg-pitch text-white flex flex-col min-h-screen">
      {/* 1. ROOM HEADER (Frosted Apple Glass Banner) */}
      <header className="sticky top-0 z-20 w-full border-b border-white/10 bg-pitch/80 backdrop-blur-2xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-surface border border-white/15 flex items-center justify-center hover:border-white/40 transition-colors"
              title="Return to Study Rooms"
            >
              <BookOpen className="w-5 h-5 text-white" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  {roomInfo.name}
                </h1>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-interactive border border-white/15 text-[11px] font-mono cursor-pointer hover:border-white/30 transition-colors"
                  onClick={copyJoinCode}
                  title="Click to copy join code"
                >
                  <span className="text-white/50">CODE:</span>
                  <span className="text-white font-semibold">{roomInfo.joinCode}</span>
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <Copy className="w-3 h-3 text-white/50" />
                  )}
                </div>
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                Collaborative Monochrome Syllabus Space • {totalDocs} syllabus units registered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime Status Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface border border-white/10 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isConnected ? 'text-white animate-pulse' : 'text-white/30'
                }`}
              />
              <span className="text-white/70 font-mono text-[11px]">
                {isConnected ? 'Realtime Synced' : 'Connecting...'}
              </span>
            </div>

            {/* Active Cohort Members Presence */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-surface border border-white/10 text-xs">
              <Users className="w-3.5 h-3.5 text-white/50" />
              <div className="flex -space-x-1.5 overflow-hidden">
                {activePresences.map((pres) => (
                  <div
                    key={pres.userId}
                    className="inline-block h-5 w-5 rounded-full ring-2 ring-pitch bg-interactive text-[10px] font-mono text-center leading-5 text-white border border-white/20 font-bold"
                    title={`${pres.userName} (Active on ${pres.activeDocId})`}
                  >
                    {pres.userName[0]}
                  </div>
                ))}
              </div>
              <span className="text-white/50 text-xs pl-1">
                {activePresences.length} active
              </span>
            </div>

            {/* Upload Document Action */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-xs font-semibold rounded-2xl hover:bg-white/90 active:scale-95 transition-all shadow-glow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Syllabus</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN COHORT DASHBOARD BODY */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-8">
        {/* ROOM PROGRESS & OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ios-glass-card p-5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Cohort Syllabus Completion
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">
                {completionPercentage}%
              </span>
              <span className="text-xs text-white/40">
                ({completedDocs}/{totalDocs} documents read)
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-500 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="ios-glass-card p-5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              In Progress
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">
                {inProgressDocs}
              </span>
              <span className="text-xs text-white/40">active modules</span>
            </div>
            <div className="mt-3 text-[11px] text-white/40 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/60" />
              <span>Synchronized across devices</span>
            </div>
          </div>

          <div className="ios-glass-card p-5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Revision Needed
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">
                {revisionDocs}
              </span>
              <span className="text-xs text-white/40">marked for re-study</span>
            </div>
            <div className="mt-3 text-[11px] text-white/40 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-white/60" />
              <span>Exam questions & proofs</span>
            </div>
          </div>

          <div className="ios-glass-card p-5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Study Rooms
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">5</span>
              <span className="text-xs text-white/40">Core subjects</span>
            </div>
            <div className="mt-3 text-[11px] text-white/40">
              DEVC • ADS • AI • UHV • JAVA
            </div>
          </div>
        </div>

        {/* 3. FILTER BAR: SUBJECTS & UNITS & STATUS */}
        <div className="space-y-4">
          {/* SUBJECT TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedSubject('ALL')}
              className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedSubject === 'ALL'
                  ? 'bg-white text-black font-semibold shadow-glow'
                  : 'bg-surface border border-white/10 text-white/60 hover:text-white hover:bg-interactive'
              }`}
            >
              All Subjects ({totalDocs})
            </button>
            {(['AI', 'ADS', 'DEVC', 'JAVA', 'UHV'] as SubjectCode[]).map((subj) => {
              const count = documents.filter((d) => d.subject === subj).length;
              const isSelected = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white text-black font-semibold shadow-glow'
                      : 'bg-surface border border-white/10 text-white/60 hover:text-white hover:bg-interactive'
                  }`}
                >
                  <span>{subj}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? 'bg-black/10 text-black' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* UNIT & STATUS BAR & SEARCH */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Unit Filters */}
              <div className="flex items-center bg-surface border border-white/10 rounded-2xl p-1 text-xs">
                <button
                  onClick={() => setSelectedUnit('ALL')}
                  className={`px-3 py-1 rounded-xl transition-all ${
                    selectedUnit === 'ALL'
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  All Units
                </button>
                {[1, 2, 3, 4, 5].map((u) => (
                  <button
                    key={u}
                    onClick={() => setSelectedUnit(u)}
                    className={`px-3 py-1 rounded-xl transition-all ${
                      selectedUnit === u
                        ? 'bg-white text-black font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Unit {u}
                  </button>
                ))}
              </div>

              {/* Status Checklist Filter */}
              <div className="flex items-center bg-surface border border-white/10 rounded-2xl p-1 text-xs">
                {(
                  [
                    { key: 'ALL', label: 'All Status' },
                    { key: 'IN_PROGRESS', label: 'In Progress' },
                    { key: 'READ', label: 'Read' },
                    { key: 'NEEDS_REVISION', label: 'Revision' },
                    { key: 'UNREAD', label: 'Unread' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setSelectedStatus(st.key)}
                    className={`px-3 py-1 rounded-xl transition-all ${
                      selectedStatus === st.key
                        ? 'bg-white text-black font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search topic or document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 4. DOCUMENT GRID */}
        {filteredDocuments.length === 0 ? (
          <div className="ios-glass-card p-12 text-center flex flex-col items-center justify-center my-6">
            <FileText className="w-10 h-10 text-white/20 mb-3" />
            <h3 className="text-sm font-semibold text-white">No documents matched</h3>
            <p className="text-xs text-white/40 max-w-sm mt-1">
              Adjust your subject, unit, or status filters, or upload a new syllabus document for
              this study room.
            </p>
            <button
              onClick={() => {
                setSelectedSubject('ALL');
                setSelectedUnit('ALL');
                setSelectedStatus('ALL');
                setSearchQuery('');
              }}
              className="mt-4 px-3.5 py-1.5 text-xs text-white/80 border border-white/15 rounded-xl hover:border-white/40 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocuments.map((doc) => {
              const currentStatus = doc.userProgress?.status || 'UNREAD';
              const statusCfg = STATUS_CONFIG[currentStatus];
              const bookmarksCount = doc.userProgress?.bookmarks?.length || 0;

              return (
                <div
                  key={doc.id}
                  className="ios-glass-card p-6 flex flex-col justify-between group hover:border-white/30 transition-all duration-200"
                >
                  <div>
                    {/* Top row: Subject, Unit, Status Pill */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/20">
                          {doc.subject}
                        </span>
                        <span className="text-[11px] font-mono text-white/60">
                          Unit {doc.unit}
                        </span>
                      </div>

                      {/* Document Status Selector */}
                      <select
                        value={currentStatus}
                        onChange={(e) =>
                          onStatusChange(doc.id, e.target.value as DocumentStatus)
                        }
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-xl border bg-pitch cursor-pointer focus:outline-none ${statusCfg.badge}`}
                      >
                        <option value="UNREAD" className="bg-black text-white">
                          Unread
                        </option>
                        <option value="IN_PROGRESS" className="bg-black text-white">
                          In Progress
                        </option>
                        <option value="READ" className="bg-black text-white">
                          Completed
                        </option>
                        <option value="NEEDS_REVISION" className="bg-black text-white">
                          Needs Revision
                        </option>
                      </select>
                    </div>

                    {/* Document Title */}
                    <h2 className="text-sm font-semibold text-white tracking-tight group-hover:text-white transition-colors line-clamp-1">
                      {doc.title}
                    </h2>

                    {/* Syllabus Topic description */}
                    {doc.syllabusTopic && (
                      <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
                        {doc.syllabusTopic}
                      </p>
                    )}
                  </div>

                  {/* Bottom metrics and Action */}
                  <div className="pt-5 mt-5 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-white/40">
                      <span className="font-mono">{doc.totalPages} pages</span>
                      {bookmarksCount > 0 && (
                        <span className="flex items-center gap-1">
                          <BookmarkIcon className="w-3 h-3 text-white/60" />
                          <span>{bookmarksCount}</span>
                        </span>
                      )}
                      {doc.annotationCount !== undefined && doc.annotationCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-white/60" />
                          <span>{doc.annotationCount}</span>
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/rooms/${roomInfo.id}/documents/${doc.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-interactive hover:bg-white hover:text-black border border-white/15 rounded-xl text-xs font-medium text-white transition-all active:scale-95 shadow-sm"
                    >
                      <span>Study & Annotate</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. UPLOAD SYLLABUS MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pitch/80 backdrop-blur-xl animate-fade-in">
          <div className="ios-glass-panel w-full max-w-lg p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold text-white">Upload Syllabus Document</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Document Filename
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI_Unit_3_Adversarial_Search_Minimax.pdf"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-pitch border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Subject Code
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value as SubjectCode)}
                    className="w-full bg-pitch border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                  >
                    <option value="AI">AI — Artificial Intelligence</option>
                    <option value="ADS">ADS — Adv. Data Structures</option>
                    <option value="DEVC">DEVC — Dev & Cloud</option>
                    <option value="JAVA">JAVA — Enterprise Java</option>
                    <option value="UHV">UHV — Human Values</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Unit Number
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(Number(e.target.value))}
                    className="w-full bg-pitch border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                  >
                    {[1, 2, 3, 4, 5].map((u) => (
                      <option key={u} value={u}>
                        Unit {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Syllabus Topic & Concepts
                </label>
                <textarea
                  placeholder="e.g. Minimax, Alpha-Beta Pruning, Game Trees, Evaluation Functions"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  rows={2}
                  className="w-full bg-pitch border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Total Document Pages
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={newPages}
                  onChange={(e) => setNewPages(Number(e.target.value))}
                  className="w-full bg-pitch border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-3.5 py-2 text-xs text-white/50 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow"
                >
                  Save & Publish to Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
