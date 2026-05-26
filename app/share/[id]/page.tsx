'use client';

import { useEffect, useState, useRef, use, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import styles from '@/styles/glassmorphism.module.css';
import Link from 'next/link';
import { CalendarX, Calendar, Menu, Search, Check, Download, List, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ReadOnlyTaskModal } from '@/components/calendar/ReadOnlyTaskModal';
import { DateRangePicker } from '@/components/calendar/DateRangePicker';

export default function SharedSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { user } = useAuth();

  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [calendarApi, setCalendarApi] = useState<any>(null);
  const [calendarView, setCalendarView] = useState({
    start: new Date(),
    end: new Date(),
    type: 'timeGridWeek'
  });
  const [viewTitle, setViewTitle] = useState('');

  // Import Tasks State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'quick' | 'new_position'>('quick');
  const [newPositionTitle, setNewPositionTitle] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [showFindResults, setShowFindResults] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

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
    if (calendarRef.current) {
      setCalendarApi(calendarRef.current.getApi());
    }
  }, [schedule]);

  useEffect(() => {
    if (calendarApi?.view?.title) {
      setViewTitle(calendarApi.view.title);
    }
  }, [calendarApi, calendarView]);


  useEffect(() => {
    // Disable body scroll specifically for the calendar page
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

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

  const mappedEvents = useMemo(() => {
    if (!schedule?.payload?.events) return [];
    return schedule.payload.events.map((ev: any) => ({
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
    }));
  }, [schedule]);

  const availableColors = useMemo(() => {
    if (!mappedEvents) return [];
    const colors = new Set<string>();
    mappedEvents.forEach((ev: any) => {
      if (ev.backgroundColor) colors.add(ev.backgroundColor);
    });
    return Array.from(colors);
  }, [mappedEvents]);

  const filteredEvents = useMemo(() => {
    if (!mappedEvents) return [];
    return mappedEvents.filter((ev: any) => {
      const matchesSearch = searchTerm === '' ||
        ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.extendedProps.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesColor = selectedColors.length === 0 ||
        (ev.backgroundColor && selectedColors.includes(ev.backgroundColor));

      return matchesSearch && matchesColor;
    });
  }, [mappedEvents, searchTerm, selectedColors]);

  const toggleColor = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  const handleImportTasks = async () => {
    if (!user || filteredEvents.length === 0) return;
    setIsImporting(true);
    setImportSuccess(false);

    try {
      const supabase = createClient();
      let positionId = null;

      if (importMode === 'new_position') {
        const titleToUse = newPositionTitle.trim() || 'Imported Tasks';

        // Find org if needed
        const { data: orgMemberships } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id);

        const userOrgId = orgMemberships && orgMemberships.length > 0 ? orgMemberships[0].organization_id : null;

        const { data: positionData, error: positionError } = await supabase.from('positions').insert({
          title: titleToUse,
          color_code: selectedColors.length === 1 ? selectedColors[0] : '#3b82f6',
          owner_user_id: userOrgId ? null : user.id,
          owner_organization_id: userOrgId ? userOrgId : null,
        }).select().single();

        if (positionData && !positionError) {
          positionId = positionData.id;
        }
      }

      const tasksToInsert = filteredEvents.map((ev: any) => ({
        title: ev.title,
        description: ev.extendedProps.description || null,
        scheduled_start_time: new Date(ev.start).toISOString(),
        scheduled_end_time: new Date(ev.end || ev.start).toISOString(),
        is_all_day: ev.allDay,
        position_id: positionId,
        color_code: ev.backgroundColor || null,
        owner_user_id: user.id
      }));

      const { error } = await supabase.from('tasks_events').insert(tasksToInsert);

      if (!error) {
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to import tasks:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const navCalendar = (action: 'prev' | 'next' | 'today' | string) => {
    const api = calendarRef.current?.getApi() || calendarApi;
    if (!api) return;

    if (action === 'prev') api.prev();
    else if (action === 'next') api.next();
    else if (action === 'today') api.today();
    else api.changeView(action);

    setViewTitle(api.view?.title || '');
    if (!calendarApi) setCalendarApi(api);
  };

  const handleDatesSet = (dateInfo: any) => {
    if (!calendarApi && calendarRef.current) {
      setCalendarApi(calendarRef.current.getApi());
    }
    setCalendarView({
      start: dateInfo.start,
      end: dateInfo.end,
      type: dateInfo.view.type
    });
    setViewTitle(dateInfo.view.title);
  };

  const renderFilterSection = () => {
    return (
      <div className="mt-6 border-t border-white/10 pt-6 shrink-0">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Filter Calendar</h2>

        <div className="space-y-4">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute right-3 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by title/details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${styles.glassInput} text-sm pr-9 w-full`}
            />
          </div>

          {availableColors.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-2">Filter by Color:</p>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => toggleColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${selectedColors.includes(color)
                        ? 'border-white scale-110'
                        : 'border-transparent hover:scale-110'
                      }`}
                    style={{ backgroundColor: color }}
                    title={`Filter color ${color}`}
                  />
                ))}
                {selectedColors.length > 0 && (
                  <button
                    onClick={() => setSelectedColors([])}
                    className="text-xs text-[var(--text-secondary)] hover:text-white ml-2 flex items-center"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/5">
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
                        const api = calendarRef.current?.getApi() || calendarApi;
                        if (api) {
                          api.gotoDate(ev.start);
                          api.changeView('timeGridDay');
                          setViewTitle(api.view?.title || '');
                          if (window.innerWidth < 768) {
                            setIsSidebarOpen(false);
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
        </div>
      </div>
    );
  };

  const renderImportSection = (sectionId: string) => {
    if (!user) return null;

    return (
      <div className="mt-6 border-t border-white/10 pt-6 shrink-0">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Import Tasks</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Import As:</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
              <input
                type="radio"
                name={`importMode-${sectionId}`}
                value="quick"
                checked={importMode === 'quick'}
                onChange={() => setImportMode('quick')}
                className="accent-blue-500 w-4 h-4 shrink-0"
              />
              <span>Quick Add (No Position)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
              <input
                type="radio"
                name={`importMode-${sectionId}`}
                value="new_position"
                checked={importMode === 'new_position'}
                onChange={() => setImportMode('new_position')}
                className="accent-blue-500 w-4 h-4 shrink-0"
              />
              <span>New Position</span>
            </label>

            {importMode === 'new_position' && (
              <input
                type="text"
                placeholder="Position Title (e.g., Shared Tasks)"
                value={newPositionTitle}
                onChange={(e) => setNewPositionTitle(e.target.value)}
                className={`${styles.glassInput} text-sm w-full mt-2`}
              />
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleImportTasks}
              disabled={isImporting || filteredEvents.length === 0}
              className={`${styles.glassButton} ${importSuccess ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : styles.glassButtonPrimary} w-full py-2 flex items-center justify-center gap-2`}
            >
              {importSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Imported!
                </>
              ) : isImporting ? (
                'Importing...'
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import {filteredEvents.length} Task{filteredEvents.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

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

  const { config } = schedule.payload;

  return (
    <div className="flex-1 w-full flex flex-col h-[100dvh] overflow-hidden bg-transparent pb-[env(safe-area-inset-bottom)]">
      {/* Top Section */}
      <div className="pt-4 z-50 flex flex-col w-full relative">
        <header className={`${styles.glassCard} mx-4 mb-4 md:mb-8 px-4 md:px-6 py-4 flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <img src="/ChronoDo%20Logo%20Clear.png" alt="ChronoDo Logo" className="w-8 h-8 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.15)]" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 hidden sm:flex items-center gap-2">
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


        {/* Mobile Sidebar Dropdown */}
        <div className={`md:hidden absolute top-full left-0 right-0 z-40 transition-all duration-300 ease-in-out origin-top overflow-hidden ${isSidebarOpen ? 'h-[calc(100dvh-120px)] opacity-100' : 'h-0 opacity-0'}`}>
          <div className="w-full h-full px-4 pb-4">
            <aside className={`w-full h-full ${styles.glassCard} overflow-y-auto overscroll-none`}>
              <div className={`${styles.glassPanel} p-4 pb-4 min-h-full flex flex-col border-none`}>
                {calendarApi && (
                  <div>
                    <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Navigate</h2>
                    <DateRangePicker
                      calendarApi={calendarApi}
                      calendarView={calendarView}
                      viewTitle={viewTitle}
                      onNavigate={navCalendar}
                    />
                  </div>
                )}
                {renderFilterSection()}
                {renderImportSection('mobile')}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 relative min-h-0">
        {/* Desktop Sidebar */}
        <div
          className={`hidden md:block transition-all duration-300 ease-in-out shrink-0 relative z-40 ${isSidebarOpen ? 'w-[20rem]' : 'w-0'}`}
        >
          <aside
            className={`sticky top-0 h-[calc(100dvh-120px)] left-4 w-72 ${styles.glassCard} overflow-y-auto overscroll-y-contain origin-left ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[150%]'}`}
            style={{ transition: 'all 300ms ease-in-out' }}
          >
            <div className={`${styles.glassPanel} p-4 pb-12 min-h-full flex flex-col border-none`}>
              {calendarApi && (
                <div>
                  <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Navigate</h2>
                  <DateRangePicker
                    calendarApi={calendarApi}
                    calendarView={calendarView}
                    viewTitle={viewTitle}
                    onNavigate={navCalendar}
                  />
                </div>
              )}
              {renderFilterSection()}
              {renderImportSection('desktop')}
            </div>
          </aside>
        </div>

        {/* Calendar View */}
        <main className="flex-1 flex flex-col px-0 md:px-4 pb-0 min-w-0 min-h-0 relative">
          <div className="flex-1 overflow-hidden relative" ref={containerRef}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin]}
              initialView="timeGridWeek"
              initialDate={config.startDate}
              headerToolbar={false}
              datesSet={handleDatesSet}
              slotDuration="00:15:00"
              slotLabelInterval="01:00"
              editable={false}
              droppable={false}
              events={filteredEvents}
              height="100%"
              allDaySlot={false}
              nowIndicator={true}
              eventClassNames="cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-md"
              eventClick={(info) => {
                setSelectedEvent(info.event);
              }}
            />
          </div>
        </main>
      </div>

      <ReadOnlyTaskModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </div>
  );
}
