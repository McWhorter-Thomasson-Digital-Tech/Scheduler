'use client';

import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import styles from '@/styles/glassmorphism.module.css';

interface SchedulerCalendarProps {
  events: any[];
  onEventDrop: (eventDropInfo: any) => void;
  onEventResize: (eventResizeInfo: any) => void;
  onEventReceive: (eventReceiveInfo: any) => void;
  onEventClick: (eventClickInfo: any) => void;
}

export function SchedulerCalendar({
  events,
  onEventDrop,
  onEventResize,
  onEventReceive,
  onEventClick
}: SchedulerCalendarProps) {
  return (
    <div className={`${styles.glassCard} p-4 h-full flex flex-col`}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        slotDuration="00:15:00" // Granular 15-min zooming
        slotLabelInterval="01:00"
        editable={true} // Internal dragging and resizing
        droppable={true} // External dragging
        events={events}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        eventReceive={onEventReceive}
        eventClick={onEventClick}
        height="100%"
        allDaySlot={false}
        nowIndicator={true}
        eventClassNames="cursor-pointer"
      />
    </div>
  );
}
