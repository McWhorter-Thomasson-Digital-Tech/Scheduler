'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import styles from '@/styles/glassmorphism.module.css';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DateRangePickerProps {
  calendarApi: any;
  calendarView?: { start: Date; end: Date; type: string };
  viewTitle: string;
  onNavigate: (action: string) => void;
}

export function DateRangePicker({
  calendarApi,
  calendarView,
  viewTitle,
  onNavigate,
}: DateRangePickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // The month shown in the mini-calendar (independent of the main calendar)
  const [pickerMonth, setPickerMonth] = useState(() => {
    if (calendarView?.start) return new Date(calendarView.start);
    return new Date();
  });

  // Current date the main calendar is focused on
  const currentDate = useMemo(() => {
    if (calendarApi?.getDate) return calendarApi.getDate();
    if (calendarView?.start) return new Date(calendarView.start);
    return new Date();
  }, [calendarApi, calendarView]);

  // Build the days grid for the mini-calendar
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(pickerMonth);
    const monthEnd = endOfMonth(pickerMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [pickerMonth]);

  // Check if a day falls within the currently visible calendar range
  const isInActiveRange = (day: Date) => {
    if (!calendarView) return false;
    return day >= calendarView.start && day < calendarView.end;
  };

  const handleDateClick = (day: Date) => {
    if (!calendarApi) return;
    calendarApi.gotoDate(day);
    setIsPickerOpen(false);
  };

  const viewButtons = [
    { key: 'dayGridMonth', label: 'Month' },
    { key: 'timeGridWeek', label: 'Week' },
    { key: 'timeGridDay', label: 'Day' },
  ];

  return (
    <div className="space-y-3">
      {/* Current Date Title — tappable to toggle mini-calendar */}
      <button
        onClick={() => setIsPickerOpen(!isPickerOpen)}
        className={`${styles.glassCard} w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition-colors`}
        style={{ transform: 'none' }} // override glassCard hover lift
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {viewTitle}
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${
            isPickerOpen ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Mini Calendar Picker */}
      {isPickerOpen && (
        <div className={`${styles.glassCard} p-3 space-y-3`} style={{ transform: 'none' }}>
          {/* Mini-cal month header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPickerMonth(subMonths(pickerMonth, 1))}
              className="p-1 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {format(pickerMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setPickerMonth(addMonths(pickerMonth, 1))}
              className="p-1 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-[var(--text-secondary)] py-1"
              >
                {d}
              </div>
            ))}

            {/* Day cells */}
            {calendarDays.map((day, idx) => {
              const inMonth = isSameMonth(day, pickerMonth);
              const today = isToday(day);
              const inRange = isInActiveRange(day);
              const selected = isSameDay(day, currentDate);

              return (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  className={`
                    text-[11px] py-1 rounded transition-colors
                    ${!inMonth ? 'text-white/20' : 'text-[var(--text-secondary)] hover:bg-white/10'}
                    ${inRange && inMonth ? 'bg-blue-500/10 text-blue-300' : ''}
                    ${selected ? 'bg-blue-500/30 text-white font-bold ring-1 ring-blue-400/50' : ''}
                    ${today && !selected ? 'text-blue-400 font-bold' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 pt-1 border-t border-[var(--glass-border)]">
            <button
              onClick={() => { onNavigate('today'); setIsPickerOpen(false); }}
              className="flex-1 text-[10px] py-1.5 rounded bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-colors font-medium"
            >
              Today
            </button>
            <button
              onClick={() => { onNavigate('timeGridWeek'); setIsPickerOpen(false); }}
              className="flex-1 text-[10px] py-1.5 rounded bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 border border-[var(--glass-border)] transition-colors font-medium"
            >
              This Week
            </button>
            <button
              onClick={() => { onNavigate('dayGridMonth'); setIsPickerOpen(false); }}
              className="flex-1 text-[10px] py-1.5 rounded bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 border border-[var(--glass-border)] transition-colors font-medium"
            >
              This Month
            </button>
          </div>
        </div>
      )}

      {/* Prev / Next Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate('prev')}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)]"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onNavigate('next')}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)]"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        {/* View Switcher */}
        <div className="flex gap-1">
          {viewButtons.map((v) => (
            <button
              key={v.key}
              onClick={() => onNavigate(v.key)}
              className={`text-[11px] py-1 px-2.5 rounded transition-colors ${
                calendarView?.type === v.key
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-[var(--text-secondary)] hover:bg-white/10 border border-transparent'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
