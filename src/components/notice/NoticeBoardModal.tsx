'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Pin,
  Heart,
  Trash2,
  Send,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Bell,
  Clock,
  User,
  Check,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  author: string;
  category: 'General' | 'Exam Alert' | 'Urgent' | 'Study Tip';
  createdAt: string;
  likes: number;
  isPinned?: boolean;
}

interface NoticeBoardProps {
  roomId: string;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ roomId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Exam Alert' | 'Urgent' | 'Study Tip'>('General');
  const [isPinned, setIsPinned] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<{ id: string; title: string } | null>(null);

  // Load from shared server API (/api/notices) with real-time polling
  const fetchNotices = async () => {
    try {
      const res = await fetch(`/api/notices?roomId=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.notices)) {
          setNotices(json.notices);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`syllabi_notices_${roomId}`, JSON.stringify(json.notices));
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch notices from server:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`syllabi_notices_${roomId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setNotices(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Initial fetch
    fetchNotices();

    // 2-second real-time polling for online cohort sync
    const interval = setInterval(fetchNotices, 2000);

    // Cross-tab broadcast channel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(`syllabi_notices_${roomId}`);
        bc.onmessage = (e) => {
          if (e.data?.type === 'NOTICES_UPDATED') {
            fetchNotices();
          }
        };
      }
    } catch {}

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [roomId]);

  const notifyBroadcast = () => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(`syllabi_notices_${roomId}`);
        bc.postMessage({ type: 'NOTICES_UPDATED' });
        bc.close();
      }
    } catch {}
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const payload = {
      title: newTitle.trim(),
      content: newContent.trim(),
      author: newAuthor.trim() || 'Anonymous Student',
      category: newCategory,
      isPinned,
      roomId,
    };

    // Optimistic local add
    const tempNotice: NoticeItem = {
      id: `notice_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setNotices((prev) => [tempNotice, ...prev]);

    // Reset form
    setNewTitle('');
    setNewContent('');
    setNewAuthor('');
    setNewCategory('General');
    setIsPinned(false);
    setIsCreating(false);

    // POST to shared server
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.notice) {
          setNotices((prev) => [data.notice, ...prev.filter((n) => n.id !== tempNotice.id)]);
        }
      }
      notifyBroadcast();
    } catch (err) {
      console.warn('Failed to publish notice to server:', err);
    }
  };

  const handleLike = async (id: string) => {
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, likes: n.likes + 1 } : n))
    );

    try {
      await fetch(`/api/notices?id=${encodeURIComponent(id)}&action=like`, {
        method: 'PATCH',
      });
      notifyBroadcast();
    } catch (err) {
      console.warn('Like sync error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));

    try {
      await fetch(`/api/notices?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      notifyBroadcast();
    } catch (err) {
      console.warn('Delete notice error:', err);
    }
  };


  const filteredNotices = notices.filter((n) => {
    if (activeFilter === 'ALL') return true;
    return n.category === activeFilter;
  });

  return (
    <>
      {/* 1. ANIMATED WHITEBOARD WITH ROBO-SMILE BUTTON (BESIDE SYLLABUS DOCUMENT LIBRARY) */}
      <button
        onClick={() => setIsOpen(true)}
        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-interactive via-surface to-interactive dark:from-interactive dark:via-surface dark:to-interactive light:from-white light:via-zinc-50 light:to-white border border-white/20 dark:border-white/20 light:border-zinc-300 hover:border-white/50 shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left"
        title="Open Interactive Notice Board"
      >
        {/* Animated Whiteboard with Robo Smile Graphic */}
        <div className="relative w-10 h-10 rounded-xl bg-pitch dark:bg-pitch light:bg-zinc-100 border border-white/25 dark:border-white/25 light:border-zinc-300 flex flex-col items-center justify-center p-1 shadow-inner overflow-hidden flex-shrink-0 group-hover:border-white transition-colors">
          {/* Top whiteboard clip */}
          <div className="w-4 h-1 bg-white/40 dark:bg-white/40 light:bg-zinc-400 rounded-full mb-0.5" />

          {/* Animated Robot Face with Smile */}
          <div className="flex flex-col items-center justify-center">
            {/* Robot Eyes: glowing and blink on hover */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white light:bg-black shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white light:bg-black shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse" />
            </div>

            {/* Cute Robotic Smile ( [ ^ _ ^ ] / curved mouth ) */}
            <svg
              className="w-4 h-2 text-white dark:text-white light:text-black transition-transform group-hover:scale-110"
              viewBox="0 0 16 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M 2 2 Q 8 8 14 2" />
            </svg>
          </div>

          {/* Micro whiteboard marker bottom shelf */}
          <div className="w-6 h-0.5 bg-white/30 dark:bg-white/30 light:bg-zinc-400 rounded-full mt-0.5" />

          {/* Subtle spark animation */}
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>

        {/* Text Details */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-white dark:text-white light:text-zinc-900 group-hover:text-white">
              Notice Board
            </span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/10 dark:bg-white/10 light:bg-black/10 text-[9px] font-mono text-white/80 dark:text-white/80 light:text-zinc-800 border border-white/15 font-semibold">
              ROBO-BOARD
            </span>
          </div>
          <span className="text-[11px] text-white/50 dark:text-white/50 light:text-zinc-500 line-clamp-1">
            {notices.length} active announcements & notes • Tap to maximize
          </span>
        </div>
      </button>

      {/* 2. MAXIMIZED NOTICE BOARD MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-[#fbfbfd] border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white dark:text-white light:text-zinc-900">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/10 dark:border-white/10 light:border-zinc-200 flex items-center justify-between bg-surface/60 dark:bg-surface/60 light:bg-white/80 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                {/* Robot Mascot in Header */}
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white flex flex-col items-center justify-center p-1.5 shadow-glow">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-black light:bg-white" />
                    <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-black light:bg-white" />
                  </div>
                  <svg
                    className="w-4 h-2 text-black dark:text-black light:text-white"
                    viewBox="0 0 16 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M 2 2 Q 8 8 14 2" />
                  </svg>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight">
                      Room Notice Board
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 dark:bg-white/10 light:bg-zinc-200 text-white/80 dark:text-white/80 light:text-zinc-800 border border-white/15 font-semibold">
                      LIVE BROADCAST
                    </span>
                  </div>
                  <p className="text-xs text-white/50 dark:text-white/50 light:text-zinc-500">
                    Write what you want to tell your cohort or see what peers are saying in real time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(!isCreating)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Cancel Note' : 'Post New Notice'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-white/50 dark:text-white/50 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black rounded-xl hover:bg-white/10 transition-colors"
                  title="Close Notice Board"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-white/10 dark:border-white/10 light:border-zinc-200 flex items-center justify-between gap-2 overflow-x-auto bg-pitch/40">
              <div className="flex items-center gap-1.5">
                {['ALL', 'Exam Alert', 'Urgent', 'Study Tip', 'General'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                      activeFilter === cat
                        ? 'bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white font-semibold shadow-sm'
                        : 'text-white/50 dark:text-white/50 light:text-zinc-600 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Broadcasts' : cat}
                  </button>
                ))}
              </div>

              <span className="text-xs font-mono text-white/40 dark:text-white/40 light:text-zinc-500 hidden sm:inline">
                {filteredNotices.length} notices on board
              </span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Write New Notice Form */}
              {isCreating && (
                <form
                  onSubmit={handleCreateNotice}
                  className="p-5 rounded-2xl bg-surface/90 dark:bg-surface/90 light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 shadow-2xl space-y-4 animate-scale-up"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 dark:border-white/10 light:border-zinc-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-white" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Compose Cohort Announcement
                      </span>
                    </div>
                    <span className="text-[11px] text-white/40 dark:text-white/40 light:text-zinc-500">
                      Visible to all members of this study room
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                        Notice Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Unit 2 Quiz Postponed to Thursday"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                        Category
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e: any) => setNewCategory(e.target.value)}
                        className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-2 text-xs text-white dark:text-white light:text-zinc-900 focus:outline-none focus:border-white"
                      >
                        <option value="General">General</option>
                        <option value="Exam Alert">Exam Alert</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Study Tip">Study Tip</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-white/70 dark:text-white/70 light:text-zinc-600 mb-1">
                      Message / Information to Pass
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Write what you want to tell to someone or question you want to ask..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl p-3 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Your Name (e.g. Rahul)"
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                        className="bg-pitch dark:bg-pitch light:bg-zinc-50 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-xl px-3 py-1.5 text-xs text-white dark:text-white light:text-zinc-900 placeholder-white/30 focus:outline-none focus:border-white w-full sm:w-48"
                      />

                      <label className="flex items-center gap-1.5 text-xs text-white/70 dark:text-white/70 light:text-zinc-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                          className="rounded border-white/20 bg-pitch text-white"
                        />
                        <span>Pin Note</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-white light:bg-black text-black dark:text-black light:text-white text-xs font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-glow"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Broadcast to Board</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Notice Cards Grid */}
              {filteredNotices.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface border border-white/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-white/30" />
                  </div>
                  <h3 className="text-sm font-semibold text-white dark:text-white light:text-zinc-900">
                    The Whiteboard is Clear
                  </h3>
                  <p className="text-xs text-white/40 dark:text-white/40 light:text-zinc-500 max-w-sm mt-1">
                    No active notices matching this filter. Click &quot;Post New Notice&quot; above to pass information to your cohort.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredNotices.map((item) => (
                    <div
                      key={item.id}
                      className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                        item.isPinned
                          ? 'bg-gradient-to-br from-surface to-interactive border-white/30 dark:border-white/30 light:border-zinc-400 shadow-md'
                          : 'bg-pitch/60 dark:bg-pitch/60 light:bg-white border-white/10 dark:border-white/10 light:border-zinc-200 hover:border-white/25'
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                item.category === 'Exam Alert'
                                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                  : item.category === 'Urgent'
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : item.category === 'Study Tip'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-white/10 text-white/80 border border-white/15'
                              }`}
                            >
                              {item.category}
                            </span>

                            {item.isPinned && (
                              <span className="flex items-center gap-1 text-[10px] font-mono text-white/70 border border-white/10 px-1.5 py-0.5 rounded">
                                <Pin className="w-2.5 h-2.5 fill-current" />
                                <span>PINNED</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-white/40 dark:text-white/40 light:text-zinc-500 font-mono">
                              {formatTimeAgo(item.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setNoticeToDelete({ id: item.id, title: item.title })}
                              className="p-1 text-white/20 hover:text-red-400 rounded transition-colors"
                              title="Delete Notice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-bold text-white dark:text-white light:text-zinc-900 mb-1.5 leading-snug">
                          {item.title}
                        </h3>

                        {/* Content */}
                        <p className="text-xs text-white/70 dark:text-white/70 light:text-zinc-600 leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </p>
                      </div>

                      {/* Footer of Card */}
                      <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
                        <div className="flex items-center gap-1.5 text-[11px] text-white/50 dark:text-white/50 light:text-zinc-500">
                          <User className="w-3 h-3 text-white/40" />
                          <span>{item.author}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLike(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-white/70 hover:text-white transition-colors"
                          title="Like / Acknowledge"
                        >
                          <Heart className="w-3 h-3 fill-white/20 text-white" />
                          <span className="font-mono text-[11px]">{item.likes}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3 border-t border-white/10 dark:border-white/10 light:border-zinc-200 text-center text-[10px] text-white/30 dark:text-white/30 light:text-zinc-500 font-mono bg-pitch/60 flex items-center justify-between">
              <span>SYLLABI COHORT ANNOUNCEMENT BOARD</span>
              <span>TAP &quot;POST NEW NOTICE&quot; TO SHARE UPDATES</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PERMANENT DELETE NOTICE MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(noticeToDelete)}
        title="Delete Notice Permanently?"
        message="Are you sure? This will be permanently deleted from this app."
        itemTitle={noticeToDelete?.title}
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={() => {
          if (noticeToDelete) {
            handleDelete(noticeToDelete.id);
          }
          setNoticeToDelete(null);
        }}
        onCancel={() => setNoticeToDelete(null)}
      />
    </>
  );
};
