'use client';

import { useEffect, useRef, useState } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import styles from '@/styles/glassmorphism.module.css';
import { GripVertical, Plus, Edit2, X, Search, Trash2, List, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Position } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInMinutes } from 'date-fns';
import { DateRangePicker } from './DateRangePicker';

interface ExternalTaskListProps {
  events?: any[];
  filteredEvents?: any[];
  calendarView?: { start: Date; end: Date; type: string };
  onDragStart?: () => void;
  calendarApi?: any;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  selectedColors?: string[];
  toggleColor?: (color: string) => void;
  clearColors?: () => void;
  availableColors?: string[];
  selectedPositions?: string[];
  togglePosition?: (positionId: string) => void;
}

export function ExternalTaskList({ 
  events = [], 
  filteredEvents,
  calendarView, 
  onDragStart, 
  calendarApi,
  searchTerm,
  setSearchTerm,
  selectedColors,
  toggleColor,
  clearColors,
  availableColors,
  selectedPositions,
  togglePosition
}: ExternalTaskListProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [showFindResults, setShowFindResults] = useState(false);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [dailyGoal, setDailyGoal] = useState<number | ''>('');
  const [weeklyGoal, setWeeklyGoal] = useState<number | ''>('');
  const [monthlyGoal, setMonthlyGoal] = useState<number | ''>('');

  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState('');

  // Sync viewTitle from calendarApi whenever calendarView changes (triggered by datesSet)
  useEffect(() => {
    if (calendarApi?.view?.title) {
      setViewTitle(calendarApi.view.title);
    }
  }, [calendarApi, calendarView]);

  const navCalendar = (action: 'prev' | 'next' | 'today' | string) => {
    if (!calendarApi) return;
    if (action === 'prev') calendarApi.prev();
    else if (action === 'next') calendarApi.next();
    else if (action === 'today') calendarApi.today();
    else calendarApi.changeView(action);
    setViewTitle(calendarApi.view?.title || '');
  };

  useEffect(() => {
    const fetchPositions = async () => {
      if (!user) return;
      const supabase = createClient();

      const { data: orgMemberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      const orgIds = orgMemberships?.map(m => m.organization_id) || [];

      if (orgIds.length > 0) {
        setUserOrgId(orgIds[0]);
      }

      let query = supabase.from('positions').select('*');

      if (orgIds.length > 0) {
        query = query.or(`owner_user_id.eq.${user.id},owner_organization_id.in.(${orgIds.join(',')})`);
      } else {
        query = query.or(`owner_user_id.eq.${user.id}`);
      }

      const { data } = await query;
      if (data) {
        setPositions(data as Position[]);
      }
    };
    fetchPositions();
  }, [user]);

  useEffect(() => {
    let draggableInstance: Draggable | null = null;

    if (containerRef.current && positions.length > 0) {
      draggableInstance = new Draggable(containerRef.current, {
        itemSelector: '.fc-event-draggable',
        eventData: function (eventEl) {
          const titleEl = eventEl.querySelector('.position-title');
          return {
            title: titleEl ? (titleEl as HTMLElement).innerText : eventEl.innerText,
            duration: eventEl.getAttribute('data-duration') || '02:00',
            color: eventEl.getAttribute('data-color'),
            extendedProps: {
              position_id: eventEl.getAttribute('data-id'),
            },
            create: true, // creates a new event when dropped
          };
        },
        longPressDelay: 300,
        minDistance: 3
      });
    }

    return () => {
      if (draggableInstance) {
        draggableInstance.destroy();
      }
    };
  }, [positions]);

  const handleSavePosition = async () => {
    if (!newTitle.trim() || !user) return;
    const supabase = createClient();

    const positionData = {
      title: newTitle,
      color_code: newColor,
      daily_hours_goal: dailyGoal === '' ? null : dailyGoal,
      weekly_hours_goal: weeklyGoal === '' ? null : weeklyGoal,
      monthly_hours_goal: monthlyGoal === '' ? null : monthlyGoal,
    };

    if (editingId) {
      const { data, error } = await supabase.from('positions')
        .update(positionData)
        .eq('id', editingId)
        .select().single();

      if (data && !error) {
        setPositions(positions.map(p => p.id === editingId ? data as Position : p));
        resetForm();
      }
    } else {
      const { data, error } = await supabase.from('positions').insert({
        ...positionData,
        owner_user_id: userOrgId ? null : user.id,
        owner_organization_id: userOrgId ? userOrgId : null,
      }).select().single();

      if (data && !error) {
        setPositions([...positions, data as Position]);
        resetForm();
      }
    }
  };

  const handleDeletePosition = async (positionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this shift type? Existing tasks with this type will be kept but untyped.')) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('positions').delete().eq('id', positionId);
    if (!error) {
      setPositions(positions.filter(p => p.id !== positionId));
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setNewTitle('');
    setNewColor('#3b82f6');
    setDailyGoal('');
    setWeeklyGoal('');
    setMonthlyGoal('');
  };

  const openEditForm = (position: Position) => {
    setEditingId(position.id);
    setNewTitle(position.title);
    setNewColor(position.color_code || '#3b82f6');
    setDailyGoal(position.daily_hours_goal || '');
    setWeeklyGoal(position.weekly_hours_goal || '');
    setMonthlyGoal(position.monthly_hours_goal || '');
    setIsFormOpen(true);
  };

  const getPositionMetrics = (position: Position) => {
    if (!calendarView) return null;

    // Filter events for this position within the calendar view dates
    const positionEvents = events.filter(e => {
      if (e.extendedProps?.position_id !== position.id) return false;
      const start = new Date(e.start);
      return start >= calendarView.start && start < calendarView.end;
    });

    let scheduledMinutes = 0;
    let trackedMinutes = 0;

    positionEvents.forEach(e => {
      if (e.start && e.end) {
        scheduledMinutes += differenceInMinutes(new Date(e.end), new Date(e.start));
      }
      if (e.extendedProps?.actualStart && e.extendedProps?.actualEnd) {
        trackedMinutes += differenceInMinutes(new Date(e.extendedProps.actualEnd), new Date(e.extendedProps.actualStart));
      }
    });

    const scheduledHours = (scheduledMinutes / 60).toFixed(1);
    const trackedHours = (trackedMinutes / 60).toFixed(1);

    let goal = null;
    let label = '';

    if (calendarView.type === 'timeGridDay' && position.daily_hours_goal) {
      goal = position.daily_hours_goal;
      label = 'Daily Goal';
    } else if (calendarView.type === 'timeGridWeek' && position.weekly_hours_goal) {
      goal = position.weekly_hours_goal;
      label = 'Weekly Goal';
    } else if (calendarView.type === 'dayGridMonth' && position.monthly_hours_goal) {
      goal = position.monthly_hours_goal;
      label = 'Monthly Goal';
    }

    return { scheduledHours, trackedHours, goal, label };
  };

  const handleItemPointerDown = (e: React.PointerEvent) => {
    let timer: NodeJS.Timeout | null = null;

    const startDrag = () => {
      if (onDragStart) onDragStart();
      cleanup();
    };

    const handleMove = () => {
      if (e.pointerType === 'mouse') {
        startDrag();
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };

    if (e.pointerType === 'touch') {
      // Wait for FC's longPressDelay to confirm it's a drag and not a scroll/tap
      timer = setTimeout(startDrag, 350);
    }

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  return (
    <div className={`${styles.glassPanel} p-4 pb-12 min-h-full flex flex-col`}>
      {/* Date Navigation — visible on both mobile and desktop */}
      {calendarApi && (
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Navigate</h2>
          <DateRangePicker
            calendarApi={calendarApi}
            calendarView={calendarView}
            viewTitle={viewTitle}
            onNavigate={navCalendar}
          />
        </div>
      )}

      {setSearchTerm && (
        <div className="mb-5 border-t border-white/10 pt-5">
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Filter Calendar</h2>
          <div className="space-y-4">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute right-3 text-[var(--text-secondary)] pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by title/details..."
                value={searchTerm || ''}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${styles.glassInput} text-sm pr-9 w-full`}
              />
            </div>
            
            {availableColors && availableColors.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-2">Filter by Color:</p>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      onClick={() => toggleColor?.(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        selectedColors?.includes(color) 
                          ? 'border-white scale-110' 
                          : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Filter color ${color}`}
                    />
                  ))}
                  {selectedColors && selectedColors.length > 0 && (
                    <button
                      onClick={clearColors}
                      className="text-xs text-[var(--text-secondary)] hover:text-white ml-2 flex items-center"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {positions && positions.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-[var(--text-secondary)] mb-2">Filter by Shift Type:</p>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {positions.map(pos => (
                    <label key={pos.id} className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={selectedPositions?.includes(pos.id)} 
                        onChange={() => togglePosition?.(pos.id)}
                        className="accent-blue-500 w-4 h-4 rounded bg-white/5 border-white/10 shrink-0"
                      />
                      <span className="truncate group-hover:text-white transition-colors text-[var(--text-secondary)]">{pos.title}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedPositions?.includes('unassigned')} 
                      onChange={() => togglePosition?.('unassigned')}
                      className="accent-blue-500 w-4 h-4 rounded bg-white/5 border-white/10 shrink-0"
                    />
                    <span className="truncate group-hover:text-white transition-colors text-[var(--text-secondary)]">Unassigned / Misc</span>
                  </label>
                </div>
              </div>
            )}

            {filteredEvents && (
              <div className="pt-2 border-t border-white/5 mt-4">
                <button
                  onClick={() => setShowFindResults(!showFindResults)}
                  className="w-full text-xs font-semibold text-[var(--text-secondary)] hover:text-white flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Find All Matching Tasks ({filteredEvents.length})
                  </div>
                  {showFindResults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFindResults && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredEvents.length === 0 ? (
                      <div className="text-xs text-[var(--text-secondary)] text-center py-2">No tasks found</div>
                    ) : (
                      filteredEvents.map((ev: any) => (
                        <button
                          key={ev.id}
                          onClick={() => {
                            if (calendarApi) {
                              calendarApi.gotoDate(ev.start);
                              calendarApi.changeView('timeGridDay');
                              setViewTitle(calendarApi.view?.title || '');
                              if (window.innerWidth < 768 && onDragStart) {
                                onDragStart(); // Use onDragStart prop to close sidebar on mobile
                              }
                            }
                          }}
                          className="w-full text-left text-xs p-2 rounded hover:bg-white/10 transition-colors flex flex-col gap-1 border border-transparent hover:border-white/10"
                        >
                          <div className="font-medium text-white truncate flex items-center gap-2">
                            {ev.backgroundColor && (
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.backgroundColor }} />
                            )}
                            {ev.title}
                          </div>
                          <div className="text-[var(--text-secondary)] truncate">
                            {new Date(ev.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-3 border-t border-white/10 pt-5">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Shift Types</h2>
        <button
          onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)}
          className="p-1 hover:bg-white/10 rounded-full transition-colors text-[var(--text-secondary)]"
        >
          {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-4 opacity-70">Drag onto the calendar to create a shift</p>

      {isFormOpen && (
        <div className={`${styles.glassCard} p-3 mb-4 space-y-3`}>
          <div className="text-sm font-semibold mb-2">{editingId ? 'Edit Position' : 'New Position'}</div>
          <input
            type="text"
            placeholder="Position Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className={`${styles.glassInput} text-sm`}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Daily Hrs"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value === '' ? '' : Number(e.target.value))}
              className={`${styles.glassInput} text-xs`}
            />
            <input
              type="number"
              placeholder="Weekly Hrs"
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value === '' ? '' : Number(e.target.value))}
              className={`${styles.glassInput} text-xs`}
            />
            <input
              type="number"
              placeholder="Monthly Hrs"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value === '' ? '' : Number(e.target.value))}
              className={`${styles.glassInput} text-xs col-span-2`}
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
            />
            <button
              onClick={handleSavePosition}
              className={`${styles.glassButton} ${styles.glassButtonPrimary} text-xs py-1.5 px-3 flex-1`}
            >
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className="space-y-3">
        {/* Default Misc Task */}
        <div
          className={`fc-event-draggable ${styles.glassCard} p-3 flex flex-col cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors group relative`}
          data-duration="02:00"
          data-color="#6b7280"
          data-id=""
          style={{ borderLeft: `4px solid #6b7280` }}
          onPointerDown={handleItemPointerDown}
        >
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center">
              <GripVertical className="text-[var(--text-secondary)] w-5 h-5 mr-3 shrink-0" />
              <div className="position-title font-medium text-gray-300">Quick Add</div>
            </div>
          </div>
        </div>

        {positions.map((position) => {
          const metrics = getPositionMetrics(position);

          return (
            <div
              key={position.id}
              className={`fc-event-draggable ${styles.glassCard} p-3 flex flex-col cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors group relative`}
              data-duration="04:00"
              data-color={position.color_code}
              data-id={position.id}
              style={{ borderLeft: `4px solid ${position.color_code}` }}
              onPointerDown={handleItemPointerDown}
            >
              <div className="flex justify-between items-start w-full">
                <div className="flex items-center">
                  <GripVertical className="text-[var(--text-secondary)] w-5 h-5 mr-3 shrink-0" />
                  <div className="position-title font-medium">{position.title}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditForm(position); }}
                    className="opacity-20 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-[var(--text-secondary)]"
                    title="Edit Shift Type"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeletePosition(position.id, e)}
                    className="opacity-20 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-red-400 hover:text-red-300"
                    title="Delete Shift Type"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 pl-8 flex flex-col gap-1 w-full text-xs text-[var(--text-secondary)]">
                {metrics && (
                  <div className="flex justify-between items-center bg-black/20 p-1.5 rounded border border-[var(--glass-border)]">
                    <span className="font-medium">Sched: {metrics.scheduledHours}h</span>
                    {metrics.goal && (
                      <span className={`${parseFloat(metrics.scheduledHours) > metrics.goal ? 'text-red-400' : 'text-emerald-400'}`}>
                        {metrics.label}: {metrics.goal}h
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {positions.length === 0 && (
          <div className="text-sm text-[var(--text-secondary)] text-center py-4">
            No positions found in database.
          </div>
        )}
      </div>
    </div>
  );
}
