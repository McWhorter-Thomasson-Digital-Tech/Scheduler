'use client';

import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import styles from '@/styles/glassmorphism.module.css';
import { Repeat } from 'lucide-react';

interface SchedulerCalendarProps {
  events: any[];
  onEventDrop: (eventDropInfo: any) => void;
  onEventResize: (eventResizeInfo: any) => void;
  onEventReceive: (eventReceiveInfo: any) => void;
  onEventClick: (eventClickInfo: any) => void;
  onDatesSet?: (dateInfo: any) => void;
  isSidebarOpen?: boolean;
  onCalendarReady?: (api: any) => void;
}

export function SchedulerCalendar({
  events,
  onEventDrop,
  onEventResize,
  onEventReceive,
  onEventClick,
  onDatesSet,
  isSidebarOpen,
  onCalendarReady
}: SchedulerCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ offsetX: 0, offsetY: 0, moveHandler: null as any });
  const [scrollTime, setScrollTime] = useState<string>(() => {
    if (typeof window === 'undefined') return '06:00:00';
    const now = new Date();
    let hour = now.getHours() - 2;
    if (hour < 0) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00:00`;
  });

  useEffect(() => {
    // Force scroll via API on mount to ensure it takes effect
    if (calendarRef.current) {
      // Small timeout to ensure calendar is fully rendered before scrolling
      setTimeout(() => {
        if (calendarRef.current) {
          calendarRef.current.getApi().scrollToTime(scrollTime);
          // Notify parent that the calendar API is ready
          if (onCalendarReady) {
            onCalendarReady(calendarRef.current.getApi());
          }
        }
      }, 50);
    }
  }, [scrollTime, onCalendarReady]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use ResizeObserver to smoothly update FullCalendar size during CSS transitions
    const observer = new ResizeObserver(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().updateSize();
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const handleDragStart = (info: any) => {
    // Only apply custom mirror for Month view (DayGrid)
    if (info.view.type !== 'dayGridMonth') return;

    const rect = info.el.getBoundingClientRect();
    dragState.current.offsetX = info.jsEvent.clientX - rect.left;
    dragState.current.offsetY = info.jsEvent.clientY - rect.top;

    const clone = info.el.cloneNode(true) as HTMLElement;
    clone.id = 'custom-fc-mirror';
    clone.style.position = 'fixed';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '99999';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.opacity = '0.9';
    clone.style.transform = 'scale(1.02)';
    clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
    clone.style.left = `${info.jsEvent.clientX - dragState.current.offsetX}px`;
    clone.style.top = `${info.jsEvent.clientY - dragState.current.offsetY}px`;

    document.body.appendChild(clone);
    document.body.classList.add('custom-fc-dragging');

    dragState.current.moveHandler = (e: MouseEvent) => {
      const mirror = document.getElementById('custom-fc-mirror');
      if (mirror) {
        mirror.style.left = `${e.clientX - dragState.current.offsetX}px`;
        mirror.style.top = `${e.clientY - dragState.current.offsetY}px`;
      }
    };

    document.addEventListener('mousemove', dragState.current.moveHandler);
  };

  const handleDragStop = (info: any) => {
    if (dragState.current.moveHandler) {
      document.removeEventListener('mousemove', dragState.current.moveHandler);
    }
    const clone = document.getElementById('custom-fc-mirror');
    if (clone) clone.remove();
    document.body.classList.remove('custom-fc-dragging');
  };

  const renderEventContent = (eventInfo: any) => {
    if (eventInfo.view.type === 'dayGridMonth' && !eventInfo.event.allDay) {
      return (
        <div className="flex items-center gap-1 overflow-hidden truncate px-1">
          <div 
            className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
            style={{ backgroundColor: eventInfo.backgroundColor || eventInfo.event.backgroundColor || '#3b82f6' }}
          />
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)]">{eventInfo.timeText}</span>
          {eventInfo.event.extendedProps?.recurrence_group_id && (
            <Repeat className="w-3 h-3 flex-shrink-0 opacity-60 text-[var(--text-secondary)]" />
          )}
          <span className="text-[10px] sm:text-xs truncate font-medium text-[var(--text-primary)]">{eventInfo.event.title}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col w-full h-full overflow-hidden p-0.5 sm:p-1">
        {!eventInfo.event.allDay && (
          <div className="text-[10px] sm:text-xs font-semibold opacity-90 leading-tight truncate text-white">
            {eventInfo.timeText}
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] sm:text-sm font-medium leading-tight text-white">
          {eventInfo.event.extendedProps?.recurrence_group_id && (
            <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 opacity-80" />
          )}
          <span className="truncate">{eventInfo.event.title}</span>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`h-full flex flex-col`}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={false}
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        editable={true}
        droppable={true}
        events={events}
        eventContent={renderEventContent}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        eventReceive={onEventReceive}
        eventClick={onEventClick}
        datesSet={onDatesSet}
        eventDragStart={handleDragStart}
        eventDragStop={handleDragStop}
        height="100%"
        scrollTime={scrollTime}
        allDaySlot={false}
        nowIndicator={true}
        eventClassNames="cursor-pointer"
        eventLongPressDelay={100}
        selectLongPressDelay={100}
      />
    </div>
  );
}
