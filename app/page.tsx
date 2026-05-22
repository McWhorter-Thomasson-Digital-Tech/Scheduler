'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SchedulerCalendar } from '@/components/calendar/SchedulerCalendar';
import { ExternalTaskList } from '@/components/calendar/ExternalTaskList';
import { TaskEventModal } from '@/components/calendar/TaskEventModal';
import styles from '@/styles/glassmorphism.module.css';
import { LogOut, Clock, Menu } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [calendarView, setCalendarView] = useState({
    start: new Date(),
    end: new Date(),
    type: 'timeGridWeek'
  });

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
        }
      }));
      setEvents(formattedEvents);
    }
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
          position_id: data.position_id
        }
      };
      setEvents([...events, newEvent]);
    }
    info.revert(); // Revert original and use DB source of truth
  };

  const handleEventDrop = async (info: any) => {
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
  const handleModalSave = (updatedEvent: any) => {
    setEvents(events.map(ev => ev.id === updatedEvent.id ? updatedEvent : ev));
    fetchEvents(); // Refresh from DB to ensure sync
  };

  const handleModalDelete = async (eventId: string) => {
    const supabase = createClient();
    await supabase.from('tasks_events').delete().eq('id', eventId);
    setEvents(events.filter(ev => ev.id !== eventId));
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
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Header Bar */}
      <header className={`${styles.glassPanel} px-4 md:px-6 py-3 flex justify-between items-center border-b border-[var(--glass-border)] z-10 relative`}>
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

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ease-in-out shrink-0 absolute md:relative z-20 h-full ${isSidebarOpen ? 'w-[90%] md:w-80' : 'w-0'
            }`}
        >
          <aside className={`absolute inset-y-0 left-0 w-[90vw] md:w-80 border-r border-[var(--glass-border)] shadow-xl bg-[var(--bg-primary)] md:bg-black/20 backdrop-blur-xl overflow-y-auto transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
            <ExternalTaskList
              events={events}
              calendarView={calendarView}
              onDragStart={() => {
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                }
              }}
            />
          </aside>
        </div>

        {/* Calendar View */}
        <main className="flex-1 p-6 overflow-hidden relative">
          <SchedulerCalendar
            events={events}
            onEventReceive={handleEventReceive}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEventClick={handleEventClick}
            onDatesSet={handleDatesSet}
            isSidebarOpen={isSidebarOpen}
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
    </div>
  );
}
