'use client';

import { useState, useEffect } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import styles from '@/styles/glassmorphism.module.css';
import { X, Clock, User, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface TaskEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any; // The FullCalendar event object or plain object
  onSave: (updatedEvent: any) => void;
  onDelete: (eventId: string) => void;
  onDuplicate?: (event: any) => void;
}

export function TaskEventModal({ isOpen, onClose, event, onSave, onDelete, onDuplicate }: TaskEventModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.extendedProps?.description || '');
      const sStart = event.startStr || (event.start instanceof Date ? event.start.toISOString() : event.start);
      const sEnd = event.endStr || (event.end instanceof Date ? event.end.toISOString() : event.end);
      setScheduledStart(sStart || '');
      setScheduledEnd(sEnd || '');
      setActualStart(event.extendedProps?.actualStart || '');
      setActualEnd(event.extendedProps?.actualEnd || '');
      setColorCode(event.extendedProps?.color_code || event.backgroundColor || '#3b82f6');
    }
  }, [event]);

  useEffect(() => {
    const fetchRole = async () => {
      const orgId = event?.extendedProps?.owner_organization_id;
      if (orgId && user?.id) {
        const supabase = createClient();
        const { data } = await supabase
          .from('organization_members')
          .select('roles(name)')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .single();

        // Check if the related role name is 'employee'
        if (data && (data.roles as any)?.name === 'employee') {
          setIsEmployee(true);
        } else {
          setIsEmployee(false);
        }
      } else {
        setIsEmployee(false); // Default to false if not in an org or no user
      }
    };

    if (isOpen) {
      fetchRole();
    }
  }, [event, user, isOpen]);

  if (!isOpen || !event) return null;

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

  const handleSave = async () => {
    const supabase = createClient();

    // Update the database
    if (event.id) {
      await supabase.from('tasks_events').update({
        title,
        description: description || null,
        color_code: colorCode || null,
        scheduled_start_time: scheduledStart || null,
        scheduled_end_time: scheduledEnd || null,
        actual_start_time: actualStart || null,
        actual_end_time: actualEnd || null
      }).eq('id', event.id);
    }

    onSave({
      ...event,
      title,
      start: scheduledStart,
      end: scheduledEnd,
      backgroundColor: colorCode,
      borderColor: colorCode,
      extendedProps: {
        ...event.extendedProps,
        description,
        color_code: colorCode,
        actualStart,
        actualEnd
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-lg mx-2 sm:mx-4 flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-xl font-semibold">{event.id ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${styles.glassInput} ${isEmployee ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isEmployee}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${styles.glassInput} resize-none ${isEmployee ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isEmployee}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Task Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colorCode}
                  onChange={(e) => setColorCode(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                  disabled={isEmployee}
                />
                <span className="text-xs text-[var(--text-secondary)]">
                  Override position color for this task
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)] flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Scheduled Start
                </label>
                <input
                  type={event?.allDay ? "date" : "datetime-local"}
                  value={scheduledStart ? format(new Date(scheduledStart), event?.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setScheduledStart('');
                      return;
                    }
                    if (event?.allDay) {
                      const [y, m, d] = e.target.value.split('-');
                      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
                      setScheduledStart(localDate.toISOString());
                    } else {
                      setScheduledStart(new Date(e.target.value).toISOString());
                    }
                  }}
                  className={`${styles.glassInput} w-full max-w-full min-w-0 text-xs sm:text-sm`}
                  style={{ paddingLeft: '0px', paddingRight: '0px' }}
                  disabled={isEmployee}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)] flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Scheduled End
                </label>
                <input
                  type={event?.allDay ? "date" : "datetime-local"}
                  value={scheduledEnd ? format(new Date(scheduledEnd), event?.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setScheduledEnd('');
                      return;
                    }
                    if (event?.allDay) {
                      const [y, m, d] = e.target.value.split('-');
                      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
                      setScheduledEnd(localDate.toISOString());
                    } else {
                      setScheduledEnd(new Date(e.target.value).toISOString());
                    }
                  }}
                  className={`${styles.glassInput} w-full max-w-full min-w-0 text-xs sm:text-sm`}
                  style={{ paddingLeft: '0px', paddingRight: '0px' }}
                  disabled={isEmployee}
                />
              </div>
            </div>
          </div>

          {/* Time Tracking Section */}
          <div className="pt-4 border-t border-[var(--glass-border)]">
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-[var(--accent-primary)]">Time Tracking</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div className="min-w-0">
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Actual Start</label>
                <input
                  type="datetime-local"
                  value={actualStart ? format(new Date(actualStart), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => setActualStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={`${styles.glassInput} w-full max-w-full min-w-0 text-xs sm:text-sm`}
                  style={{ paddingLeft: '0px', paddingRight: '0px' }}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Actual End</label>
                <input
                  type="datetime-local"
                  value={actualEnd ? format(new Date(actualEnd), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => setActualEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={`${styles.glassInput} w-full max-w-full min-w-0 text-xs sm:text-sm`}
                  style={{ paddingLeft: '0px', paddingRight: '0px' }}
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
          <div className="flex gap-2">
            {event.id && !isEmployee && (
              <button
                onClick={() => { onDelete(event.id); onClose(); }}
                className="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2"
              >
                Delete
              </button>
            )}
            {event.id && !isEmployee && onDuplicate && (
              <button
                onClick={() => { onDuplicate(event); onClose(); }}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium px-4 py-2"
              >
                Duplicate
              </button>
            )}
          </div>

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
