'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SchedulerCalendar } from '@/components/calendar/SchedulerCalendar';
import { ExternalTaskList } from '@/components/calendar/ExternalTaskList';
import { TaskEventModal } from '@/components/calendar/TaskEventModal';
import { ShareScheduleModal } from '@/components/calendar/ShareScheduleModal';
import { RecurrencePromptModal } from '@/components/calendar/RecurrencePromptModal';
import styles from '@/styles/glassmorphism.module.css';
import { LogOut, Clock, Menu, HelpCircle, Share2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRecurrencePromptOpen, setIsRecurrencePromptOpen] = useState(false);
  const [pendingDragAction, setPendingDragAction] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [calendarView, setCalendarView] = useState({
    start: new Date(),
    end: new Date(),
    type: 'timeGridWeek'
  });
  const [showHelp, setShowHelp] = useState(false);
  const [calendarApi, setCalendarApi] = useState<any>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const handleCalendarReady = useCallback((api: any) => {
    setCalendarApi(api);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      fetchEvents();
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Disable body scroll specifically for the calendar page
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const fetchEvents = async () => {
    const supabase = createClient();

    // First, get the organizations this user belongs to
    const { data: orgMemberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user?.id);

    const orgIds = orgMemberships?.map(m => m.organization_id) || [];

    let query = supabase.from('tasks_events').select('*, positions(color_code)');

    // Filter by personal ownership, assigned tasks, or organization ownership
    if (orgIds.length > 0) {
      query = query.or(`owner_user_id.eq.${user?.id},assigned_to.eq.${user?.id},owner_organization_id.in.(${orgIds.join(',')})`);
    } else {
      query = query.or(`owner_user_id.eq.${user?.id},assigned_to.eq.${user?.id}`);
    }

    const { data } = await query;
    if (data) {
      const formattedEvents = data.map(task => ({
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
        }
      }));
      setEvents(formattedEvents);
    }
  };

  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    events.forEach(ev => {
      if (ev.backgroundColor) colors.add(ev.backgroundColor);
    });
    return Array.from(colors);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchesSearch = searchTerm === '' ||
        ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.extendedProps?.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesColor = selectedColors.length === 0 ||
        (ev.backgroundColor && selectedColors.includes(ev.backgroundColor));

      const matchesPosition = selectedPositions.length === 0 ||
        (ev.extendedProps?.position_id
          ? selectedPositions.includes(ev.extendedProps.position_id)
          : selectedPositions.includes('unassigned'));

      return matchesSearch && matchesColor && matchesPosition;
    });
  }, [events, searchTerm, selectedColors, selectedPositions]);

  const toggleColor = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev =>
      prev.includes(positionId) ? prev.filter(p => p !== positionId) : [...prev, positionId]
    );
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Calendar Event Handlers
  const handleEventReceive = async (info: any) => {
    const supabase = createClient();
    const positionId = info.event.extendedProps.position_id;

    const startIso = info.event.start ? info.event.start.toISOString() : new Date().toISOString();
    const endIso = info.event.end ? info.event.end.toISOString() : startIso;

    const newTask = {
      title: info.event.title,
      scheduled_start_time: startIso,
      scheduled_end_time: endIso,
      is_all_day: info.event.allDay,
      position_id: positionId || null,
      color_code: info.event.backgroundColor || null,
      owner_user_id: user.id // Default ownership for new tasks
    };

    const { data, error } = await supabase.from('tasks_events').insert([newTask]).select().single();
    if (!error && data) {
      const newEvent = {
        id: data.id,
        title: data.title,
        start: data.scheduled_start_time,
        end: data.scheduled_end_time,
        allDay: data.is_all_day,
        backgroundColor: info.event.backgroundColor,
        borderColor: info.event.borderColor,
        extendedProps: {
          color_code: info.event.extendedProps?.color_code || null,
          actualStart: null,
          actualEnd: null,
          position_id: data.position_id,
          recurrence_group_id: null
        }
      };
      setEvents([...events, newEvent]);
    }
    info.revert(); // Revert original and use DB source of truth
  };

  const handleEventDrop = async (info: any) => {
    const eventObj = events.find(ev => ev.id === info.event.id) || info.event;
    if (eventObj.extendedProps?.recurrence_group_id) {
       info.revert();
       setPendingDragAction({ type: 'drop', info });
       setIsRecurrencePromptOpen(true);
       return;
    }

    const supabase = createClient();
    const startIso = info.event.start.toISOString();
    const endIso = info.event.end ? info.event.end.toISOString() : startIso;

    await supabase.from('tasks_events').update({
      scheduled_start_time: startIso,
      scheduled_end_time: endIso,
      is_all_day: info.event.allDay
    }).eq('id', info.event.id);

    setEvents(events.map(ev =>
      ev.id === info.event.id
        ? { ...ev, start: startIso, end: endIso, allDay: info.event.allDay }
        : ev
    ));
  };

  const handleEventResize = async (info: any) => {
    const eventObj = events.find(ev => ev.id === info.event.id) || info.event;
    if (eventObj.extendedProps?.recurrence_group_id) {
       info.revert();
       setPendingDragAction({ type: 'resize', info });
       setIsRecurrencePromptOpen(true);
       return;
    }

    const supabase = createClient();
    const startIso = info.event.start.toISOString();
    const endIso = info.event.end ? info.event.end.toISOString() : startIso;

    await supabase.from('tasks_events').update({
      scheduled_start_time: startIso,
      scheduled_end_time: endIso,
      is_all_day: info.event.allDay
    }).eq('id', info.event.id);

    setEvents(events.map(ev =>
      ev.id === info.event.id
        ? { ...ev, start: startIso, end: endIso, allDay: info.event.allDay }
        : ev
    ));
  };

  const handleRecurrencePromptConfirm = async (mode: 'single'|'following'|'all') => {
    setIsRecurrencePromptOpen(false);
    if (!pendingDragAction) return;
    
    const { type, info } = pendingDragAction;
    const supabase = createClient();
    
    const startIso = info.event.start.toISOString();
    const endIso = info.event.end ? info.event.end.toISOString() : startIso;
    const eventId = info.event.id;
    const eventObj = events.find(ev => ev.id === eventId);
    
    if (mode === 'single') {
       await supabase.from('tasks_events').update({
         scheduled_start_time: startIso,
         scheduled_end_time: endIso,
         is_all_day: info.event.allDay,
         recurrence_group_id: null
       }).eq('id', eventId);
    } else {
       let query = supabase.from('tasks_events')
         .select('*')
         .eq('recurrence_group_id', eventObj.extendedProps.recurrence_group_id);
       
       if (mode === 'following') {
         query = query.gte('scheduled_start_time', eventObj.start);
       }
       
       const { data: targetEvents } = await query;
       
       const oldStart = new Date(eventObj.start).getTime();
       const newStart = new Date(startIso).getTime();
       const startDelta = newStart - oldStart;
       
       const oldEnd = new Date(eventObj.end || eventObj.start).getTime();
       const newEnd = new Date(endIso).getTime();
       const endDelta = newEnd - oldEnd;

       const updates = targetEvents?.map(ev => ({
          ...ev,
          scheduled_start_time: new Date(new Date(ev.scheduled_start_time).getTime() + startDelta).toISOString(),
          scheduled_end_time: new Date(new Date(ev.scheduled_end_time).getTime() + endDelta).toISOString(),
          is_all_day: info.event.allDay
       })) || [];

       if (updates.length > 0) {
          await supabase.from('tasks_events').upsert(updates);
       }
    }
    
    setPendingDragAction(null);
    fetchEvents();
  };

  const handleEventClick = (info: any) => {
    const eventObj = events.find(e => e.id === info.event.id) || info.event;
    setSelectedEvent(eventObj);
    setIsModalOpen(true);
  };

  const handleDatesSet = (dateInfo: any) => {
    setCalendarView({
      start: dateInfo.start,
      end: dateInfo.end,
      type: dateInfo.view.type
    });
  };

  // Modal Handlers
  const handleModalSave = (payload: { reload?: boolean, updatedEvent?: any }) => {
    if (payload.updatedEvent) {
       setEvents(events.map(ev => ev.id === payload.updatedEvent.id ? payload.updatedEvent : ev));
    }
    if (payload.reload) {
       fetchEvents();
    }
  };

  const handleModalDelete = async (payload: { id: string, mode: 'single'|'following'|'all' }) => {
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

  const handleModalDuplicate = async (eventToDuplicate: any) => {
    const supabase = createClient();

    const newTask = {
      title: `${eventToDuplicate.title} (Copy)`,
      description: eventToDuplicate.extendedProps?.description || null,
      scheduled_start_time: eventToDuplicate.start,
      scheduled_end_time: eventToDuplicate.end,
      is_all_day: eventToDuplicate.allDay || false,
      position_id: eventToDuplicate.extendedProps?.position_id || null,
      color_code: eventToDuplicate.extendedProps?.color_code || null,
      owner_user_id: user?.id,
      assigned_to: eventToDuplicate.extendedProps?.assigned_to || null,
      owner_organization_id: eventToDuplicate.extendedProps?.owner_organization_id || null,
    };

    const { data, error } = await supabase.from('tasks_events').insert([newTask]).select().single();
    if (!error && data) {
      const newEvent = {
        id: data.id,
        title: data.title,
        start: data.scheduled_start_time,
        end: data.scheduled_end_time,
        allDay: data.is_all_day,
        backgroundColor: data.color_code || eventToDuplicate.backgroundColor,
        borderColor: data.color_code || eventToDuplicate.borderColor,
        extendedProps: {
          ...eventToDuplicate.extendedProps,
          actualStart: null,
          actualEnd: null,
          position_id: data.position_id
        }
      };
      setEvents([...events, newEvent]);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)] h-[100dvh] overflow-hidden">
      {/* Sticky Top Section (Header + Mobile Sidebar) */}
      <div className="pt-4 z-50 flex flex-col w-full relative">
        {/* Header Bar */}
        <header className={`${styles.glassCard} mx-4 mb-8 px-4 md:px-6 py-4 flex justify-between items-center`}>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <img src="/logo.png" alt="ChronoDo Logo" className="w-8 h-8 rounded-xl hidden sm:block shadow-lg shadow-blue-500/20" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              ChronoDo
            </h1>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-2"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="hidden md:inline text-sm font-medium">Help</span>
            </button>
            <div className="h-6 w-px bg-[var(--glass-border)] hidden md:block"></div>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3 md:px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-sm font-medium flex items-center gap-2"
              title="Share Schedule"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <Link
              href="/timeclock"
              className="px-3 md:px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Time Clock</span>
            </Link>
            <div className="h-6 w-px bg-[var(--glass-border)]"></div>
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

        {/* Mobile Sidebar Dropdown */}
        <div className={`md:hidden absolute top-full left-0 right-0 transition-all duration-300 ease-in-out origin-top overflow-hidden ${isSidebarOpen ? 'h-[calc(100dvh-120px)] opacity-100' : 'h-0 opacity-0'}`}>
          <div className="w-full h-full px-8 pb-4">
            <aside className={`w-full h-full ${styles.glassCard} overflow-y-auto overscroll-none`}>
              <ExternalTaskList
                events={events}
                filteredEvents={filteredEvents}
                calendarView={calendarView}
                onDragStart={() => setIsSidebarOpen(false)}
                calendarApi={calendarApi}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedColors={selectedColors}
                toggleColor={toggleColor}
                clearColors={() => setSelectedColors([])}
                availableColors={availableColors}
                selectedPositions={selectedPositions}
                togglePosition={togglePosition}
              />
            </aside>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 relative min-h-0">
        {/* Desktop Sidebar */}
        <div
          className={`hidden md:block transition-all duration-300 ease-in-out shrink-0 relative z-40 ${isSidebarOpen ? 'w-[20rem]' : 'w-0'
            }`}
        >
          <aside
            className={`sticky top-[100px] h-[calc(100dvh-120px)] left-4 w-72 ${styles.glassCard} overflow-y-auto overscroll-y-contain origin-left ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[150%]'}`}
            style={{ transition: 'all 300ms ease-in-out' }}
          >
            <ExternalTaskList
              events={events}
              filteredEvents={filteredEvents}
              calendarView={calendarView}
              calendarApi={calendarApi}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedColors={selectedColors}
              toggleColor={toggleColor}
              clearColors={() => setSelectedColors([])}
              availableColors={availableColors}
              selectedPositions={selectedPositions}
              togglePosition={togglePosition}
            />
          </aside>
        </div>

        {/* Calendar View */}
        <main className="flex-1 flex flex-col px-0 md:px-4 pb-0 min-w-0 min-h-0">
          {/* Help Dropdown Section */}
          <div className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${showHelp ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
            <div className={`${styles.glassCard} p-6 relative`}>
              <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                How to Use the Scheduler
              </h3>
              <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 text-sm max-w-3xl">
                <li><strong>Create Tasks:</strong> Drag task roles from the left sidebar onto the calendar to create a new task.</li>
                <li><strong>Edit Tasks:</strong> Click on any task on the calendar to change its title, time, or description.</li>
                <li><strong>Move Tasks:</strong> Drag and drop existing tasks to different days, or use the bottom handle to resize the duration.</li>
                <li><strong>Manage Roles:</strong> Add new positions or custom task types in the sidebar to organize your workflow.</li>
              </ul>
            </div>
          </div>
          <SchedulerCalendar
            events={filteredEvents}
            onEventReceive={handleEventReceive}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEventClick={handleEventClick}
            onDatesSet={handleDatesSet}
            isSidebarOpen={isSidebarOpen}
            onCalendarReady={handleCalendarReady}
          />
        </main>
      </div>

      <TaskEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        onDuplicate={handleModalDuplicate}
      />

      <ShareScheduleModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        events={events}
        user={user}
      />

      <RecurrencePromptModal
        isOpen={isRecurrencePromptOpen}
        onClose={() => {
           setIsRecurrencePromptOpen(false);
           setPendingDragAction(null);
        }}
        onConfirm={handleRecurrencePromptConfirm}
        action={pendingDragAction?.type === 'drop' ? 'move' : 'update' as any}
      />
    </div>
  );
}
