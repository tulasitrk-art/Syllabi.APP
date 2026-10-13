'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Users,
  Compass,
  CheckCircle2,
  FileText,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/ThemeProvider';

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/rooms/room-${joinCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    const generatedId = `room-${Date.now().toString(36)}`;
    router.push(`/rooms/${generatedId}`);
  };

  return (
    <div className="min-h-screen bg-pitch text-white flex flex-col justify-between selection:bg-white/20">
      {/* 1. TOP HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-surface border border-white/20 flex items-center justify-center shadow-glow">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Syllabi
          </span>
          <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase px-2 py-0.5 rounded-full border border-white/10 ml-2">
            v1.0 OS
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/rooms/room-demo"
            className="px-4 py-2 bg-surface dark:bg-surface light:bg-zinc-100 hover:bg-interactive dark:hover:bg-interactive light:hover:bg-zinc-200 border border-white/15 dark:border-white/15 light:border-zinc-300 rounded-2xl text-xs font-medium text-white dark:text-white light:text-zinc-900 transition-all shadow-sm"
          >
            Launch Demo Room
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center my-auto">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-white/15 mb-6 text-xs text-white/70 shadow-sm animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>Focused study rooms, zero distraction.</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-2xl leading-[1.1]">
          The Monochrome Study Ecosystem.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-white/50 max-w-xl leading-relaxed">
          Share, track, and annotate syllabus documents in real time. Built with the pure iOS
          dark-mode aesthetic, non-destructive vector layers, and independent status checklists.
        </p>

        {/* 3. INTERACTIVE ROOM ACCESS DOCK */}
        <div className="w-full max-w-md mt-10 p-2 ios-glass-panel shadow-2xl">
          <div className="flex bg-pitch/80 rounded-2xl p-1 mb-3 border border-white/10">
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                !isCreating
                  ? 'bg-white text-black font-semibold shadow-glow'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Join with Code
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                isCreating
                  ? 'bg-white text-black font-semibold shadow-glow'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Create New Room
            </button>
          </div>

          {!isCreating ? (
            <form onSubmit={handleJoin} className="space-y-3 p-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter 8-digit join code (e.g. SYL-8492)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full bg-pitch border border-white/15 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white font-mono tracking-wider uppercase text-center"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-white text-black text-xs font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-glow"
              >
                <span>Enter Study Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3 p-2">
              <div>
                <input
                  type="text"
                  placeholder="Study Room Name (e.g. Fall 2026 CS Core)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-pitch border border-white/15 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white text-center"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-white text-black text-xs font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-glow"
              >
                <span>Create & Generate Code</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="pt-2 text-center">
            <Link
              href="/rooms/room-demo"
              className="text-[11px] text-white/40 hover:text-white transition-colors underline"
            >
              Or explore the default cohort workspace (SYL-8492)
            </Link>
          </div>
        </div>

        {/* 4. ARCHITECTURAL INVARIANTS SHOWCASE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-16 text-left">
          <div className="ios-glass-card p-5">
            <div className="w-8 h-8 rounded-xl bg-interactive border border-white/15 flex items-center justify-center mb-3">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
              Transparent Layer Rule
            </h2>
            <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
              Original PDFs remain immutable at z-0. Stylus strokes, highlights, and notes exist on
              a non-destructive normalized vector coordinate overlay at z-10.
            </p>
          </div>

          <div className="ios-glass-card p-5">
            <div className="w-8 h-8 rounded-xl bg-interactive border border-white/15 flex items-center justify-center mb-3">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
              Syllabus Categorization
            </h2>
            <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
              Every document maps to Subject codes (DEVC, ADS, AI, UHV, JAVA), specific Units (1-5),
              and syllabus topic concepts with instant peer sync.
            </p>
          </div>

          <div className="ios-glass-card p-5">
            <div className="w-8 h-8 rounded-xl bg-interactive border border-white/15 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
              Independent Status Tracks
            </h2>
            <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
              Per-student checklists: Unread, In Progress, Read, and Needs Revision with persistent
              bookmarks for high-yield exam preparation.
            </p>
          </div>
        </div>
      </main>

      {/* 5. MINIMALIST FOOTER */}
      <footer className="w-full border-t border-white/10 py-6 px-6 text-center text-xs text-white/30 font-mono">
        SYLLABI • PURE MONOCHROME ARCHITECTURE • POWERED BY NEXT.JS & SUPABASE
      </footer>
    </div>
  );
}
