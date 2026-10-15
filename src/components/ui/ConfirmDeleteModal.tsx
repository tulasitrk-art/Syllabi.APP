'use client';

import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemTitle?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Delete Permanently?',
  message = 'Are you sure? This will be permanently deleted from this app.',
  itemTitle,
  confirmText = 'Yes, Delete',
  cancelText = 'No, Cancel',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-[#0c0c0e] dark:bg-[#0c0c0e] light:bg-white border border-white/20 dark:border-white/20 light:border-zinc-300 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-white dark:text-white light:text-zinc-900 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Icon */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-white/40 dark:text-white/40 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-black rounded-xl hover:bg-white/10 transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/10">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="flex-1 pr-6">
            <h3 className="text-base font-bold tracking-tight text-white dark:text-white light:text-zinc-900">
              {title}
            </h3>
            <p className="text-xs text-white/70 dark:text-white/70 light:text-zinc-600 mt-1 leading-relaxed">
              {message}
            </p>

            {itemTitle && (
              <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-white/5 dark:bg-white/5 light:bg-zinc-100 border border-white/10 dark:border-white/10 light:border-zinc-200 text-xs font-mono text-white/80 dark:text-white/80 light:text-zinc-800 truncate">
                {itemTitle}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Yes / No */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10 dark:border-white/10 light:border-zinc-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface dark:bg-surface light:bg-zinc-100 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-zinc-200 text-white/80 dark:text-white/80 light:text-zinc-700 border border-white/15 dark:border-white/15 light:border-zinc-300 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
