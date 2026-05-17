'use client';

import { useEffect, useRef } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import styles from '@/styles/glassmorphism.module.css';
import { GripVertical } from 'lucide-react';

interface ExternalTask {
  id: string;
  title: string;
  duration: string; // e.g., '02:00'
  color: string;
}

const DEFAULT_TASKS: ExternalTask[] = [
  { id: 't1', title: 'Morning Shift', duration: '04:00', color: '#3b82f6' },
  { id: 't2', title: 'Afternoon Shift', duration: '04:00', color: '#8b5cf6' },
  { id: 't3', title: 'Inventory Check', duration: '01:30', color: '#10b981' },
  { id: 't4', title: 'Team Meeting', duration: '01:00', color: '#f59e0b' },
];

export function ExternalTaskList() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      new Draggable(containerRef.current, {
        itemSelector: '.fc-event-draggable',
        eventData: function(eventEl) {
          return {
            title: eventEl.innerText,
            duration: eventEl.getAttribute('data-duration'),
            color: eventEl.getAttribute('data-color'),
            create: true, // creates a new event when dropped
          };
        }
      });
    }
  }, []);

  return (
    <div className={`${styles.glassPanel} p-4 h-full flex flex-col`}>
      <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Tasks & Shifts</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Drag tasks onto the calendar</p>
      
      <div ref={containerRef} className="space-y-3">
        {DEFAULT_TASKS.map((task) => (
          <div
            key={task.id}
            className={`fc-event-draggable ${styles.glassCard} p-3 flex items-center cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors`}
            data-duration={task.duration}
            data-color={task.color}
            style={{ borderLeft: `4px solid ${task.color}` }}
          >
            <GripVertical className="text-[var(--text-secondary)] w-5 h-5 mr-3" />
            <div>
              <div className="font-medium">{task.title}</div>
              <div className="text-xs text-[var(--text-secondary)]">{task.duration} duration</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
