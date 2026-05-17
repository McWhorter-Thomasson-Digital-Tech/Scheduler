'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SchedulerCalendar } from '@/components/calendar/SchedulerCalendar';
import { ExternalTaskList } from '@/components/calendar/ExternalTaskList';
import { TaskEventModal } from '@/components/calendar/TaskEventModal';
import styles from '@/styles/glassmorphism.module.css';
import { LogOut } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Calendar Event Handlers
  const handleEventReceive = (info: any) => {
    const newEvent = {
      id: uuidv4(),
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      backgroundColor: info.event.backgroundColor,
      borderColor: info.event.borderColor,
      extendedProps: {
        actualStart: null,
        actualEnd: null,
      }
    };
    setEvents([...events, newEvent]);
    info.revert(); // Let React state drive the render
  };

  const handleEventDrop = (info: any) => {
    setEvents(events.map(ev => 
      ev.id === info.event.id 
        ? { ...ev, start: info.event.startStr, end: info.event.endStr } 
        : ev
    ));
  };

  const handleEventResize = (info: any) => {
    setEvents(events.map(ev => 
      ev.id === info.event.id 
        ? { ...ev, start: info.event.startStr, end: info.event.endStr } 
        : ev
    ));
  };

  const handleEventClick = (info: any) => {
    const eventObj = events.find(e => e.id === info.event.id) || info.event;
    setSelectedEvent(eventObj);
    setIsModalOpen(true);
  };

  // Modal Handlers
  const handleModalSave = (updatedEvent: any) => {
    setEvents(events.map(ev => ev.id === updatedEvent.id ? updatedEvent : ev));
  };

  const handleModalDelete = (eventId: string) => {
    setEvents(events.filter(ev => ev.id !== eventId));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Header Bar */}
      <header className={`${styles.glassPanel} px-6 py-3 flex justify-between items-center border-b border-[var(--glass-border)] z-10 relative`}>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-blue-500/20"></div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Scheduler
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-[var(--text-secondary)]">Logged in as </span>
            <span className="font-semibold">{user.full_name}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs uppercase tracking-wider border border-blue-500/30">
              {user.role}
            </span>
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
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-r border-[var(--glass-border)] shadow-xl z-10 relative bg-black/20 backdrop-blur-xl">
          <ExternalTaskList />
        </aside>

        {/* Calendar View */}
        <main className="flex-1 p-6 overflow-hidden relative">
          <SchedulerCalendar 
            events={events}
            onEventReceive={handleEventReceive}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEventClick={handleEventClick}
          />
        </main>
      </div>

      <TaskEventModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
      />
    </div>
  );
}
