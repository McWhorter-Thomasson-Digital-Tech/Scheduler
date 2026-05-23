'use client';

import { useEffect, useState, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import styles from '@/styles/glassmorphism.module.css';
import Link from 'next/link';
import { CalendarX, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ReadOnlyTaskModal } from '@/components/calendar/ReadOnlyTaskModal';

export default function SharedSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { user } = useAuth();

  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('shared_schedules')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (error || !data) {
          setError('Link expired or not found.');
        } else {
          setSchedule(data);
        }
      } catch (err) {
        setError('Link expired or not found.');
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.id) {
      fetchSchedule();
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().updateSize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [schedule]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-secondary)]">Loading Schedule...</div>;

  if (error || !schedule) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f1016] text-white p-4">
        <div className={`${styles.glassCard} max-w-md w-full p-8 text-center space-y-6`}>
          <CalendarX className="w-16 h-16 mx-auto text-red-400 opacity-80" />
          <h1 className="text-2xl font-bold">Link Expired</h1>
          <p className="text-[var(--text-secondary)]">
            This schedule link has either expired or does not exist.
          </p>
          <Link href="/" className={`${styles.glassButton} ${styles.glassButtonPrimary} inline-block w-full`}>
            Return to App
          </Link>
        </div>
      </div>
    );
  }

  const { config, events } = schedule.payload;

  return (
    <div className="flex-1 w-full flex flex-col h-screen overflow-hidden bg-transparent pb-[env(safe-area-inset-bottom)]">
      <header className={`${styles.glassCard} mx-4 mt-4 px-4 md:px-6 py-4 flex justify-between items-center z-50 shrink-0`}>
        <div className="flex items-center gap-2 md:gap-4">
          <img src="/logo.png" alt="ChronoDo Logo" className="w-8 h-8 rounded-xl hidden sm:block shadow-lg shadow-blue-500/20" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2">
            ChronoDo
          </h1>
          <span className="hidden sm:inline-flex ml-2 px-2 py-1 rounded text-xs font-medium bg-white/5 border border-white/10 text-white/80 items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Shared View
          </span>
        </div>
        <div className="flex items-center">
          {user ? (
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-sm font-medium"
            >
              Go to App
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-sm font-medium"
            >
              Sign Up
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col min-h-0 relative">
        <div className={`flex-1 overflow-hidden p-2 relative`} ref={containerRef}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="timeGridWeek"
            initialDate={config.startDate}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            slotDuration="00:15:00"
            slotLabelInterval="01:00"
            editable={false}
            droppable={false}
            events={events.map((ev: any) => ({
              id: ev.id,
              title: ev.title,
              start: ev.start,
              end: ev.end,
              allDay: ev.allDay,
              backgroundColor: ev.colorCode,
              borderColor: ev.colorCode,
              extendedProps: {
                description: ev.description,
                actualStart: ev.actualStart,
                actualEnd: ev.actualEnd
              }
            }))}
            height="100%"
            allDaySlot={false}
            nowIndicator={true}
            eventClassNames="cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-md"
            eventClick={(info) => {
              setSelectedEvent(info.event);
            }}
            eventContent={(eventInfo) => {
              const { extendedProps } = eventInfo.event;
              return (
                <div className="p-1 text-xs h-full w-full overflow-hidden flex flex-col">
                  <div className="font-semibold truncate">{eventInfo.event.title}</div>
                  {eventInfo.timeText && <div className="opacity-80 text-[10px] truncate">{eventInfo.timeText}</div>}
                  {extendedProps.actualStart && (
                    <div className="mt-1 opacity-75 text-[10px] text-emerald-300 flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      Tracked
                    </div>
                  )}
                  {extendedProps.description && (
                    <div className="mt-1 opacity-70 italic text-[10px] line-clamp-2 leading-tight">
                      {extendedProps.description}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </main>

      <ReadOnlyTaskModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </div>
  );
}
