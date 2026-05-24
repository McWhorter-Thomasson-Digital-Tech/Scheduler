'use client';

import { X, Clock, Calendar as CalendarIcon, FileText } from 'lucide-react';
import styles from '@/styles/glassmorphism.module.css';

interface ReadOnlyTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any; // The FullCalendar event object
}

export function ReadOnlyTaskModal({ isOpen, onClose, event }: ReadOnlyTaskModalProps) {
  if (!isOpen || !event) return null;

  const title = event.title;
  const start = event.start;
  const end = event.end;
  const { description, actualStart, actualEnd } = event.extendedProps || {};
  const colorCode = event.backgroundColor || '#3b82f6';

  const formatDateTime = (date: Date | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed w-full h-full top-0 left-0 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
      <div className={`${styles.glassCard} w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div
          className="p-6 relative flex items-start justify-between border-b border-[var(--glass-border)]"
          style={{
            background: `linear-gradient(180deg, ${colorCode}22 0%, transparent 100%)`
          }}
        >
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: colorCode }} />
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
            {event.allDay && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/80">All Day</span>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0 bg-black/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Scheduled Time */}
          <div className="flex gap-3">
            <div className="mt-0.5 p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Scheduled Time</h3>
              <p className="text-sm font-medium text-white">{formatDateTime(start)}</p>
              {end && start?.getTime() !== end?.getTime() && (
                <p className="text-sm font-medium text-white mt-0.5">to {formatDateTime(end)}</p>
              )}
            </div>
          </div>

          {/* Actual Tracked Time (if available) */}
          {(actualStart || actualEnd) && (
            <div className="flex gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Tracked Time</h3>
                {actualStart ? (
                  <p className="text-sm font-medium text-white">{formatDateTime(actualStart)}</p>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Not started</p>
                )}

                {actualEnd ? (
                  <p className="text-sm font-medium text-white mt-0.5">to {formatDateTime(actualEnd)}</p>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-secondary)] mt-0.5">Not finished</p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="flex gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Description</h3>
                <div className="text-sm text-white whitespace-pre-wrap bg-black/20 p-3 rounded-lg border border-[var(--glass-border)]">
                  {description}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--glass-border)] flex justify-end">
          <button
            onClick={onClose}
            className={`${styles.glassButton} text-sm px-6`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
