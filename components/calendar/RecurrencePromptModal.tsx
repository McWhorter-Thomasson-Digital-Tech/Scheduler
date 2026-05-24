'use client';

import { X } from 'lucide-react';
import styles from '@/styles/glassmorphism.module.css';

interface RecurrencePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'single' | 'following' | 'all') => void;
  action: 'update' | 'delete';
}

export function RecurrencePromptModal({ isOpen, onClose, onConfirm, action }: RecurrencePromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed w-full h-full top-0 left-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-sm mx-4 flex flex-col`}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-lg font-semibold text-white">Recurring Event</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-[var(--text-secondary)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 text-sm text-[var(--text-secondary)]">
          <p className="mb-4">
            You are trying to {action} a recurring event. How would you like to apply this change?
          </p>
          <div className="space-y-3">
            <button
              onClick={() => onConfirm('single')}
              className={`${styles.glassButton} w-full text-left justify-start py-2.5`}
            >
              <span className="font-medium text-white block mb-0.5">This event only</span>
              <span className="text-xs opacity-70">Other events in the series will not be affected.</span>
            </button>
            <button
              onClick={() => onConfirm('following')}
              className={`${styles.glassButton} w-full text-left justify-start py-2.5`}
            >
              <span className="font-medium text-white block mb-0.5">This and following events</span>
              <span className="text-xs opacity-70">Changes apply to this event and all future events.</span>
            </button>
            <button
              onClick={() => onConfirm('all')}
              className={`${styles.glassButton} w-full text-left justify-start py-2.5`}
            >
              <span className="font-medium text-white block mb-0.5">All events</span>
              <span className="text-xs opacity-70">Changes apply to every event in this recurring series.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
