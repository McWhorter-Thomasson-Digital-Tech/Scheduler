'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WeeklyTaskList } from '@/components/tasks/WeeklyTaskList';
import { TrackerSection } from '@/components/tasks/TrackerSection';
import { TaskEventModal } from '@/components/calendar/TaskEventModal';
import styles from '@/styles/glassmorphism.module.css';
import { LogOut, ArrowLeft, ChevronLeft, ChevronRight, Calendar, ListTodo, Clock, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, eachDayOfInterval, isSameWeek } from 'date-fns';
import { TrackerItem } from '@/types/database';

export default function TaskListPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday start
  );
  const [events, setEvents] = useState<any[]>([]);
  const [trackerItems, setTrackerItems] = useState<TrackerItem[]>([]);
  const [showReadingTracker, setShowReadingTracker] = useState(true);
  const [showAssignmentTracker, setShowAssignmentTracker] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [weekPickerValue, setWeekPickerValue] = useState('');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const helpBackdropRef = useScrollLock(isHelpModalOpen);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  const isThisWeek = isSameWeek(new Date(), currentWeekStart, { weekStartsOn: 1 });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      fetchEvents();
      fetchTrackerItems();
      fetchPreferences();
    }
  }, [user, loading, router, currentWeekStart]);

  // Sync the date input with the current week
  useEffect(() => {
    setWeekPickerValue(format(currentWeekStart, 'yyyy-MM-dd'));
  }, [currentWeekStart]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const weekStartIso = currentWeekStart.toISOString();
    const weekEndIso = weekEnd.toISOString();

    const { data: orgMemberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    const orgIds = orgMemberships?.map(m => m.organization_id) || [];

    let query = supabase
      .from('tasks_events')
      .select('*, positions(color_code)')
      .lte('scheduled_start_time', weekEndIso)
      .gte('scheduled_end_time', weekStartIso)
      .neq('show_on_task_list', false);

    if (orgIds.length > 0) {
      query = query.or(`owner_user_id.eq.${user.id},assigned_to.eq.${user.id},owner_organization_id.in.(${orgIds.join(',')})`);
    } else {
      query = query.or(`owner_user_id.eq.${user.id},assigned_to.eq.${user.id}`);
    }

    const { data } = await query;
    if (data) {
      const formatted = data.map(task => ({
        id: task.id,
        title: task.title,
        start: task.scheduled_start_time,
        end: task.scheduled_end_time,
        allDay: task.is_all_day,
        backgroundColor: task.color_code || task.positions?.color_code || '#3b82f6',
        borderColor: task.color_code || task.positions?.color_code || '#3b82f6',
        extendedProps: {
          description: task.description,
          color_code: task.color_code,
          location: task.location,
          actualStart: task.actual_start_time,
          actualEnd: task.actual_end_time,
          position_id: task.position_id,
          assigned_to: task.assigned_to,
          owner_organization_id: task.owner_organization_id,
          hide_details_in_share: task.hide_details_in_share,
          recurrence_group_id: task.recurrence_group_id,
          show_on_calendar: task.show_on_calendar,
          show_on_task_list: task.show_on_task_list,
          is_completed: task.is_completed,
          task_list_orders: task.task_list_orders,
        }
      }));
      setEvents(formatted);
    }
  }, [user, currentWeekStart, weekEnd]);

  const fetchTrackerItems = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('tracker_items')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setTrackerItems(data as TrackerItem[]);
  }, [user]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('show_reading_tracker, show_assignment_tracker')
      .eq('id', user.id)
      .single();
    if (data) {
      setShowReadingTracker(data.show_reading_tracker !== false);
      setShowAssignmentTracker(data.show_assignment_tracker !== false);
    }
  }, [user]);

  const updatePreference = async (field: string, value: boolean) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
  };

  const handleToggleReading = (show: boolean) => {
    setShowReadingTracker(show);
    updatePreference('show_reading_tracker', show);
  };

  const handleToggleAssignment = (show: boolean) => {
    setShowAssignmentTracker(show);
    updatePreference('show_assignment_tracker', show);
  };

  const handleTaskClick = (task: any) => {
    setSelectedEvent(task);
    setIsModalOpen(true);
  };

  const handleModalSave = () => {
    fetchEvents();
  };

  const handleModalDelete = async (payload: { id: string; mode: 'single' | 'following' | 'all' }) => {
    const supabase = createClient();
    if (payload.mode === 'single') {
      await supabase.from('tasks_events').delete().eq('id', payload.id);
    } else {
      const targetEvent = events.find(ev => ev.id === payload.id);
      if (targetEvent?.extendedProps?.recurrence_group_id) {
        if (payload.mode === 'all') {
          await supabase.from('tasks_events').delete().eq('recurrence_group_id', targetEvent.extendedProps.recurrence_group_id);
        } else if (payload.mode === 'following') {
          await supabase.from('tasks_events')
            .delete()
            .eq('recurrence_group_id', targetEvent.extendedProps.recurrence_group_id)
            .gte('scheduled_start_time', targetEvent.start);
        }
      } else {
        await supabase.from('tasks_events').delete().eq('id', payload.id);
      }
    }
    fetchEvents();
  };

  const handleWeekPickerChange = (dateStr: string) => {
    setWeekPickerValue(dateStr);
    if (dateStr) {
      const picked = new Date(dateStr + 'T00:00:00');
      setCurrentWeekStart(startOfWeek(picked, { weekStartsOn: 1 }));
    }
  };

  const readingItems = trackerItems.filter(t => t.type === 'reading');
  const assignmentItems = trackerItems.filter(t => t.type === 'assignment');

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex-1 w-full flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)] min-h-[100dvh]">
      {/* Header */}
      <header className={`${styles.glassCard} sticky top-4 mt-4 mx-4 mb-4 px-4 md:px-6 py-4 flex justify-between items-center z-50`}>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-full transition-colors text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <ListTodo className="w-6 h-6 text-purple-400 drop-shadow-md" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            Task List
          </h1>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <Link
            href="/"
            className="px-3 md:px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Calendar</span>
          </Link>
          <Link
            href="/timeclock"
            className="px-3 md:px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Time Clock</span>
          </Link>
          <div className="h-6 w-px bg-[var(--glass-border)] hidden md:block" />
          <div className="text-sm hidden md:block">
            <span className="text-[var(--text-secondary)]">Logged in as </span>
            <span className="font-semibold">{user.full_name || 'User'}</span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-8 max-w-[1400px] w-full mx-auto">
        {/* Week Navigation */}
        <div className={`${styles.glassCard} p-3 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3`} style={{ transform: 'none' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-white"
              title="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isThisWeek
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'hover:bg-white/10 text-[var(--text-secondary)] hover:text-white'
                }`}
            >
              This Week
            </button>
            <button
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-white"
              title="Next week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {format(currentWeekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </h2>
            <input
              type="date"
              value={weekPickerValue}
              onChange={(e) => handleWeekPickerChange(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] cursor-pointer hover:border-white/20 transition-colors focus:outline-none focus:border-purple-500/50"
              title="Jump to a specific week"
            />
          </div>
        </div>

        {/* Weekly Task List */}
        <WeeklyTaskList
          weekDays={weekDays}
          tasks={events}
          onTaskClick={handleTaskClick}
          onTasksChange={fetchEvents}
        />

        {/* Tracker Section */}
        <TrackerSection
          readingItems={readingItems}
          assignmentItems={assignmentItems}
          showReading={showReadingTracker}
          showAssignment={showAssignmentTracker}
          onToggleReading={handleToggleReading}
          onToggleAssignment={handleToggleAssignment}
          onRefresh={fetchTrackerItems}
        />
      </main>

      {/* Task Edit Modal */}
      <TaskEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
      />

      {/* Help Modal */}
      {isHelpModalOpen && (
        <div ref={helpBackdropRef} className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`${styles.glassCard} w-full max-w-md p-6 relative !bg-neutral-950/75`} style={{ transform: 'none' }}>
            <button
              onClick={() => setIsHelpModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              Task List Help
            </h2>
            <div className="space-y-4 text-sm text-[var(--text-secondary)]">
              <p><strong className="text-white">Adding Tasks:</strong> Click the <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">+</kbd> icon on any day to quickly add a task.</p>
              <p><strong className="text-white">Reordering:</strong> Hover over a task and use the grip handle to drag and drop tasks to reorder them or move them between days.</p>
              <p><strong className="text-white">Editing:</strong> Click on a task title to quickly rename it. Click anywhere else on the task to open full details.</p>
              <p><strong className="text-white">Completion:</strong> Click the checkbox to toggle task completion status.</p>
              <p><strong className="text-white">Trackers:</strong> Use the tracker section below to manage your reading and assignments.</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
