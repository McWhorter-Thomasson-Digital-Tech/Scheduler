'use client';

import { useState, useEffect } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import styles from '@/styles/glassmorphism.module.css';
import { X, Clock, User, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TaskEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any; // The FullCalendar event object or plain object
  onSave: (updatedEvent: any) => void;
  onDelete: (eventId: string) => void;
}

export function TaskEventModal({ isOpen, onClose, event, onSave, onDelete }: TaskEventModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      // Mocking actual times for now if they exist in extendedProps
      setActualStart(event.extendedProps?.actualStart || '');
      setActualEnd(event.extendedProps?.actualEnd || '');
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const scheduledStart = event.startStr || event.start?.toISOString();
  const scheduledEnd = event.endStr || event.end?.toISOString();

  // Variance Calculation
  let varianceMessage = '';
  let varianceColor = 'text-[var(--text-secondary)]';

  if (actualStart && actualEnd && scheduledStart && scheduledEnd) {
    const scheduledMinutes = differenceInMinutes(new Date(scheduledEnd), new Date(scheduledStart));
    const actualMinutes = differenceInMinutes(new Date(actualEnd), new Date(actualStart));
    const variance = actualMinutes - scheduledMinutes;

    if (variance > 0) {
      varianceMessage = `Over scheduled time by ${variance} mins`;
      varianceColor = 'text-red-400';
    } else if (variance < 0) {
      varianceMessage = `Under scheduled time by ${Math.abs(variance)} mins`;
      varianceColor = 'text-green-400';
    } else {
      varianceMessage = 'Exactly on schedule';
      varianceColor = 'text-blue-400';
    }
  }

  const handleSave = () => {
    onSave({
      ...event,
      title,
      extendedProps: {
        ...event.extendedProps,
        actualStart,
        actualEnd
      }
    });
    onClose();
  };

  const isEmployee = user?.role === 'employee';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-lg mx-4 flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-xl font-semibold">{event.id ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.glassInput}
                disabled={isEmployee} // Employees might only be able to track time
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)] flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Scheduled Start
                </label>
                <div className="px-3 py-2 bg-black/20 rounded-md border border-[var(--glass-border)] text-sm">
                  {scheduledStart ? format(new Date(scheduledStart), 'MMM d, h:mm a') : 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)] flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Scheduled End
                </label>
                <div className="px-3 py-2 bg-black/20 rounded-md border border-[var(--glass-border)] text-sm">
                  {scheduledEnd ? format(new Date(scheduledEnd), 'MMM d, h:mm a') : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Time Tracking Section */}
          <div className="pt-4 border-t border-[var(--glass-border)]">
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-[var(--accent-primary)]">Time Tracking</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Actual Start</label>
                <input 
                  type="datetime-local" 
                  value={actualStart ? format(new Date(actualStart), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => setActualStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={styles.glassInput}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Actual End</label>
                <input 
                  type="datetime-local" 
                  value={actualEnd ? format(new Date(actualEnd), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => setActualEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={styles.glassInput}
                />
              </div>
            </div>

            {varianceMessage && (
              <div className={`text-sm font-medium px-3 py-2 bg-black/30 rounded-md border border-[var(--glass-border)] ${varianceColor}`}>
                {varianceMessage}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--glass-border)] flex justify-between">
          {event.id && !isEmployee ? (
            <button 
              onClick={() => { onDelete(event.id); onClose(); }}
              className="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2"
            >
              Delete
            </button>
          ) : <div></div>}
          
          <div className="flex gap-2">
            <button onClick={onClose} className={styles.glassButton}>
              Cancel
            </button>
            <button onClick={handleSave} className={`${styles.glassButton} ${styles.glassButtonPrimary}`}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
