'use client';

import { useState, useEffect } from 'react';
import { differenceInMinutes, format, addDays, addWeeks, addMonths, isBefore, differenceInDays } from 'date-fns';
import styles from '@/styles/glassmorphism.module.css';
import { X, Clock, User, Briefcase, Repeat } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { RecurrencePromptModal } from './RecurrencePromptModal';

interface TaskEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any; // The FullCalendar event object or plain object
  onSave: (payload: { reload?: boolean, updatedEvent?: any }) => void;
  onDelete: (payload: { id: string, mode: 'single' | 'following' | 'all' }) => void;
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
  const [hideDetailsInShare, setHideDetailsInShare] = useState(false);

  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [recurrenceWarning, setRecurrenceWarning] = useState<string>('');
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null);

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
      setHideDetailsInShare(event.extendedProps?.hide_details_in_share || false);

      setRecurrenceType('none');
      setRecurrenceEndDate('');
      setIsPromptOpen(false);
      setPendingAction(null);
    }
  }, [event]);

  useEffect(() => {
    if (recurrenceType !== 'none' && recurrenceEndDate && scheduledStart) {
      const start = new Date(scheduledStart);
      const end = new Date(recurrenceEndDate);
      let diff = 0;
      if (recurrenceType === 'daily') diff = differenceInDays(end, start);
      if (recurrenceType === 'weekly') diff = differenceInDays(end, start) / 7;
      if (recurrenceType === 'monthly') diff = differenceInDays(end, start) / 30;

      if (diff > 100) {
        setRecurrenceWarning('Warning: This rule will generate over 100 events, exceeding the limit. Please choose an earlier end date.');
      } else {
        setRecurrenceWarning('');
      }
    } else {
      setRecurrenceWarning('');
    }
  }, [recurrenceType, recurrenceEndDate, scheduledStart]);

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

  const generateRecurrences = (baseTask: any, type: 'daily' | 'weekly' | 'monthly', endDate: Date, maxOccurrences: number = 100) => {
    const generated = [];
    let currentStart = new Date(baseTask.scheduled_start_time);
    let currentEnd = new Date(baseTask.scheduled_end_time);
    const end = endDate;

    for (let i = 1; i < maxOccurrences; i++) {
      if (type === 'daily') {
        currentStart = addDays(currentStart, 1);
        currentEnd = addDays(currentEnd, 1);
      } else if (type === 'weekly') {
        currentStart = addWeeks(currentStart, 1);
        currentEnd = addWeeks(currentEnd, 1);
      } else if (type === 'monthly') {
        currentStart = addMonths(currentStart, 1);
        currentEnd = addMonths(currentEnd, 1);
      }

      if (isBefore(end, currentStart)) {
        break;
      }

      generated.push({
        ...baseTask,
        scheduled_start_time: currentStart.toISOString(),
        scheduled_end_time: currentEnd.toISOString()
      });
    }
    return generated;
  };

  const handleSave = () => {
    if (recurrenceWarning) return;
    const isExisting = !!event.id;
    const hasRecurrenceGroup = !!event.extendedProps?.recurrence_group_id;

    if (isExisting && hasRecurrenceGroup) {
      setPendingAction('save');
      setIsPromptOpen(true);
    } else {
      executeSave('single');
    }
  };

  const executeSave = async (mode: 'single' | 'following' | 'all') => {
    const supabase = createClient();
    const isExisting = !!event.id;
    const hasRecurrenceGroup = !!event.extendedProps?.recurrence_group_id;

    const baseEventData = {
      title,
      description: description || null,
      color_code: colorCode || null,
      scheduled_start_time: scheduledStart || null,
      scheduled_end_time: scheduledEnd || null,
      actual_start_time: actualStart || null,
      actual_end_time: actualEnd || null,
      hide_details_in_share: hideDetailsInShare
    };

    if (isExisting) {
      if (hasRecurrenceGroup) {
        if (mode === 'single') {
          await supabase.from('tasks_events').update({ ...baseEventData, recurrence_group_id: null }).eq('id', event.id);
        } else {
          // following or all
          let query = supabase.from('tasks_events')
            .select('*')
            .eq('recurrence_group_id', event.extendedProps.recurrence_group_id);

          if (mode === 'following') {
            query = query.gte('scheduled_start_time', event.startStr || event.start.toISOString());
          }

          const { data: targetEvents } = await query;

          const oldStart = new Date(event.start).getTime();
          const newStart = new Date(scheduledStart).getTime();
          const startDelta = newStart - oldStart;

          const oldEnd = new Date(event.end || event.start).getTime();
          const newEnd = new Date(scheduledEnd).getTime();
          const endDelta = newEnd - oldEnd;

          const updates = targetEvents?.map(ev => ({
            ...ev,
            title,
            description: description || null,
            color_code: colorCode || null,
            hide_details_in_share: hideDetailsInShare,
            scheduled_start_time: new Date(new Date(ev.scheduled_start_time).getTime() + startDelta).toISOString(),
            scheduled_end_time: new Date(new Date(ev.scheduled_end_time).getTime() + endDelta).toISOString(),
          })) || [];

          if (updates.length > 0) {
            await supabase.from('tasks_events').upsert(updates);
          }
        }
      } else {
        if (recurrenceType !== 'none' && recurrenceEndDate) {
          const groupId = uuidv4();
          await supabase.from('tasks_events').update({ ...baseEventData, recurrence_group_id: groupId }).eq('id', event.id);

          const baseTaskForGeneration = {
            ...baseEventData,
            position_id: event.extendedProps?.position_id || null,
            owner_user_id: user?.id,
            owner_organization_id: event.extendedProps?.owner_organization_id || null,
            assigned_to: event.extendedProps?.assigned_to || null,
            is_all_day: event.allDay || false,
            recurrence_group_id: groupId
          };

          const newEvents = generateRecurrences(baseTaskForGeneration, recurrenceType, new Date(recurrenceEndDate));
          if (newEvents.length > 0) {
            await supabase.from('tasks_events').insert(newEvents);
          }
        } else {
          await supabase.from('tasks_events').update(baseEventData).eq('id', event.id);
        }
      }
    }

    onSave({ reload: true });
    onClose();
  };

  const handleDeleteClick = () => {
    if (event.extendedProps?.recurrence_group_id) {
      setPendingAction('delete');
      setIsPromptOpen(true);
    } else {
      executeDelete('single');
    }
  };

  const executeDelete = (mode: 'single' | 'following' | 'all') => {
    onDelete({ id: event.id, mode });
    onClose();
  };

  const handlePromptConfirm = (mode: 'single' | 'following' | 'all') => {
    setIsPromptOpen(false);
    if (pendingAction === 'save') {
      executeSave(mode);
    } else if (pendingAction === 'delete') {
      executeDelete(mode);
    }
    setPendingAction(null);
  };

  return (
    <div className="fixed w-full h-full top-0 left-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-lg mx-2 sm:mx-4 flex flex-col max-h-[90vh] `}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-xl font-semibold">{event.id ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
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

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="hideDetailsInShare"
                checked={hideDetailsInShare}
                onChange={(e) => setHideDetailsInShare(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20"
                disabled={isEmployee}
              />
              <label htmlFor="hideDetailsInShare" className="text-sm font-medium text-[var(--text-secondary)]">
                Hide details in shared views (show only as Busy)
              </label>
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

          {/* Recurrence Section */}
          {!event.extendedProps?.recurrence_group_id && (
            <div className="pt-4 border-t border-[var(--glass-border)]">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[var(--accent-primary)]">
                <Repeat className="w-4 h-4" /> Recurrence
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Repeat</label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as any)}
                    className={`${styles.glassInput} text-sm cursor-pointer`}
                    disabled={isEmployee}
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {recurrenceType !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Ends On</label>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className={`${styles.glassInput} text-sm`}
                      disabled={isEmployee}
                    />
                  </div>
                )}
              </div>
              {recurrenceWarning && (
                <div className="mt-2 text-xs text-red-400 font-medium bg-red-400/10 p-2 rounded">
                  {recurrenceWarning}
                </div>
              )}
            </div>
          )}
          {event.extendedProps?.recurrence_group_id && (
            <div className="pt-4 border-t border-[var(--glass-border)]">
              <div className="flex items-center gap-2 text-blue-400 bg-blue-400/10 p-3 rounded-lg border border-blue-400/20">
                <Repeat className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">This event is part of a recurring series. Edits and deletions will prompt you for how to apply them.</span>
              </div>
            </div>
          )}


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
                onClick={handleDeleteClick}
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

      <RecurrencePromptModal
        isOpen={isPromptOpen}
        onClose={() => {
          setIsPromptOpen(false);
          setPendingAction(null);
        }}
        onConfirm={handlePromptConfirm}
        action={pendingAction || 'update'}
      />
    </div>
  );
}
