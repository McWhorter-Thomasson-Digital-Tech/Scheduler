'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from '@/styles/glassmorphism.module.css';
import { GripVertical, Plus, Check, Clock } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WeeklyTaskListProps {
  weekDays: Date[];
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTasksChange: () => void;
}

export function WeeklyTaskList({ weekDays, tasks, onTaskClick, onTasksChange }: WeeklyTaskListProps) {
  const { user } = useAuth();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addingForDay, setAddingForDay] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTaskOriginalDay, setDraggedTaskOriginalDay] = useState<Date | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [localTasks, setLocalTasks] = useState<any[]>(tasks);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local tasks in sync with prop updates
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const getTasksForDay = useCallback((day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return localTasks
      .filter(t => {
        const start = new Date(t.start);
        start.setHours(0, 0, 0, 0);
        
        if (t.allDay) {
          // All-day task: end date in DB/FC is exclusive (midnight of day after last day)
          const end = t.end ? new Date(t.end) : new Date(start);
          end.setHours(0, 0, 0, 0);
          return day >= start && day < end;
        } else {
          // Timed task: start and end are inclusive (overlaps with the day)
          const end = t.end ? new Date(t.end) : new Date(start);
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);
          return start <= dayEnd && end >= dayStart;
        }
      })
      .sort((a: any, b: any) => {
        const orderA = a.extendedProps?.task_list_orders?.[dayStr] ?? 0;
        const orderB = b.extendedProps?.task_list_orders?.[dayStr] ?? 0;
        return orderA - orderB;
      });
  }, [localTasks]);

  const handleToggleComplete = async (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    const newCompleted = !task.extendedProps?.is_completed;

    // Optimistic UI update
    const newTasks = localTasks.map(t =>
      t.id === task.id ? { ...t, extendedProps: { ...t.extendedProps, is_completed: newCompleted } } : t
    );
    setLocalTasks(newTasks);

    await supabase.from('tasks_events').update({ is_completed: newCompleted }).eq('id', task.id);
    onTasksChange();
  };

  const handleTitleSave = async (task: any) => {
    if (editTitle.trim() !== '' && editTitle.trim() !== task.title) {
      // Optimistic update
      const newTasks = localTasks.map(t =>
        t.id === task.id ? { ...t, title: editTitle.trim() } : t
      );
      setLocalTasks(newTasks);

      const supabase = createClient();
      await supabase.from('tasks_events').update({ title: editTitle.trim() }).eq('id', task.id);
      onTasksChange();
    }
    setEditingTaskId(null);
  };

  const handleAddTask = async (day: Date) => {
    if (!newTaskTitle.trim() || !user) return;
    const supabase = createClient();

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(0, 0, 0, 0);

    const dayStr = format(day, 'yyyy-MM-dd');
    const existingTasks = getTasksForDay(day);
    const maxOrder = existingTasks.reduce((max: number, t: any) => Math.max(max, t.extendedProps?.task_list_orders?.[dayStr] ?? 0), 0);

    const { error } = await supabase.from('tasks_events').insert({
      title: newTaskTitle.trim(),
      scheduled_start_time: dayStart.toISOString(),
      scheduled_end_time: dayEnd.toISOString(),
      is_all_day: true,
      show_on_calendar: true,
      show_on_task_list: true,
      task_list_orders: { [dayStr]: maxOrder + 1 },
      is_completed: false,
      owner_user_id: user.id,
    });

    if (!error) {
      setNewTaskTitle('');
      setAddingForDay(null);
      onTasksChange();
    }
  };

  const handleStartAdd = (dayKey: string) => {
    setAddingForDay(dayKey);
    setNewTaskTitle('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, taskId: string, day: Date) => {
    setDraggedTaskId(taskId);
    setDraggedTaskOriginalDay(day);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedTaskId(null);
    setDraggedTaskOriginalDay(null);
    setDragOverDay(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, dayKey: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayKey);
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, day: Date, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTasks = getTasksForDay(day);
    const draggedTask = localTasks.find((t: any) => t.id === taskId);
    if (!draggedTask) return;

    const shiftDeltaMs = draggedTaskOriginalDay ? day.getTime() - draggedTaskOriginalDay.getTime() : 0;
    const isSameDayDrop = shiftDeltaMs === 0;

    let newStart = draggedTask.start;
    let newEnd = draggedTask.end;

    let newTaskListOrders = { ...(draggedTask.extendedProps?.task_list_orders || {}) };

    if (!isSameDayDrop) {
      const dayOffset = Math.round(shiftDeltaMs / (1000 * 60 * 60 * 24));
      
      const originalStart = new Date(draggedTask.start);
      originalStart.setDate(originalStart.getDate() + dayOffset);
      newStart = originalStart.toISOString();

      if (draggedTask.end) {
        const originalEnd = new Date(draggedTask.end);
        originalEnd.setDate(originalEnd.getDate() + dayOffset);
        newEnd = originalEnd.toISOString();
      } else {
        newEnd = newStart;
      }

      // Shift the keys in task_list_orders by the day offset
      const oldOrders = draggedTask.extendedProps?.task_list_orders || {};
      newTaskListOrders = {};
      Object.keys(oldOrders).forEach(oldDateStr => {
        const d = new Date(oldDateStr + 'T00:00:00');
        d.setDate(d.getDate() + dayOffset);
        const newDateStr = format(d, 'yyyy-MM-dd');
        newTaskListOrders[newDateStr] = oldOrders[oldDateStr];
      });
    }

    const otherTasks = dayTasks.filter((t: any) => t.id !== taskId);

    let adjustedDropIndex = dropIndex;
    if (isSameDayDrop) {
      const draggedOriginalIndex = dayTasks.findIndex((t: any) => t.id === taskId);
      if (draggedOriginalIndex !== -1 && draggedOriginalIndex < dropIndex) {
        adjustedDropIndex = dropIndex - 1;
      }
    }
    
    // Ensure the updated dragged task has the correct drop index for the target day
    newTaskListOrders[dayStr] = adjustedDropIndex;

    const updatedDraggedTask = {
      ...draggedTask,
      start: newStart,
      end: newEnd,
      extendedProps: {
        ...draggedTask.extendedProps,
        task_list_orders: newTaskListOrders
      }
    };

    const reordered = [...otherTasks];
    reordered.splice(adjustedDropIndex, 0, updatedDraggedTask);

    const finalizedDayTasks = reordered.map((t: any, idx: number) => {
      const orders = t.id === taskId ? newTaskListOrders : { ...(t.extendedProps?.task_list_orders || {}) };
      // Assign consecutive orders based on the reordered array
      return {
        ...t,
        extendedProps: {
          ...t.extendedProps,
          task_list_orders: {
            ...orders,
            [dayStr]: idx
          }
        }
      };
    });

    // Optimistically update the local tasks array without duplication
    const finalizedIds = new Set(finalizedDayTasks.map((t: any) => t.id));
    const newLocalTasks = localTasks
      .filter(t => !finalizedIds.has(t.id))
      .concat(finalizedDayTasks);

    setLocalTasks(newLocalTasks);
    setDraggedTaskId(null);
    setDragOverDay(null);
    setDragOverIndex(null);

    // Filter to only tasks that actually changed order
    const updates = finalizedDayTasks
      .filter((t: any) => {
        const oldTask = dayTasks.find((old: any) => old.id === t.id);
        const oldOrder = oldTask?.extendedProps?.task_list_orders?.[dayStr];
        const newOrder = t.extendedProps.task_list_orders[dayStr];
        return oldOrder !== newOrder || t.id === taskId;
      })
      .map((t: any) => ({
        id: t.id,
        order: t.extendedProps.task_list_orders[dayStr]
      }));

    const supabase = createClient();
    
    // Single query to update all orders
    if (updates.length > 0) {
      await supabase.rpc('bulk_update_task_orders', { updates, target_day: dayStr });
    }

    // Only update time and shifted orders if moved to a different day
    if (!isSameDayDrop) {
      await supabase.from('tasks_events').update({
        scheduled_start_time: newStart,
        scheduled_end_time: newEnd,
        task_list_orders: newTaskListOrders
      }).eq('id', taskId);
    } else {
      // If same day drop, but we still need to update the order if it changed
      // Note: The bulk update already handles the orders for the target day.
      // But we should ensure the dragged task's task_list_orders JSONB is fully updated
      // just in case we need to persist any other changes.
      await supabase.from('tasks_events').update({
        task_list_orders: newTaskListOrders
      }).eq('id', taskId);
    }

    onTasksChange();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {weekDays.map((day) => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayTasks = getTasksForDay(day);
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={dayKey}
            className={`${styles.glassCard} p-3 flex flex-col min-h-[140px] transition-all duration-200 ${isToday ? 'ring-1 ring-blue-500/40' : ''
              } ${dragOverDay === dayKey ? 'ring-1 ring-purple-400/50 bg-purple-500/5' : ''}`}
            style={{ transform: 'none' }} // Prevent glassCard hover transform
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverDay !== dayKey) {
                setDragOverDay(dayKey);
                setDragOverIndex(dayTasks.length);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const idx = (dragOverDay === dayKey && dragOverIndex !== null) ? dragOverIndex : dayTasks.length;
              handleDrop(e, day, idx);
            }}
          >
            {/* Day Header */}
            <div className={`flex items-center justify-between mb-2 pb-2 border-b border-white/5`}>
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-[var(--text-secondary)]'
                  }`}>
                  {format(day, 'EEE')}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                  {format(day, 'd')}
                </div>
              </div>
              <button
                onClick={() => handleStartAdd(dayKey)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-[var(--text-secondary)] hover:text-white"
                title="Add task"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Task List */}
            <div className="flex-1 space-y-1 flex flex-col relative">
              {dayTasks.map((task: any, idx: number) => {
                const isCompleted = task.extendedProps?.is_completed;
                const isAllDay = task.allDay;
                const isDragging = draggedTaskId === task.id;

                return (
                  <div key={task.id}>
                    {/* Drop indicator line */}
                    {dragOverDay === dayKey && dragOverIndex === idx && (
                      <div className="h-0.5 bg-purple-400 rounded-full mx-1 mb-1 animate-pulse" />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id, day)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const isBottomHalf = y > rect.height / 2;
                        const dropTargetIdx = isBottomHalf ? idx + 1 : idx;
                        
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverDay(dayKey);
                        setDragOverIndex(dropTargetIdx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const isBottomHalf = y > rect.height / 2;
                        const dropTargetIdx = isBottomHalf ? idx + 1 : idx;
                        handleDrop(e, day, dropTargetIdx);
                      }}
                      onClick={() => onTaskClick(task)}
                      className={`group flex items-start gap-1.5 p-1.5 rounded-lg cursor-pointer transition-all duration-150
                        hover:bg-white/5
                        ${isDragging ? 'opacity-30' : 'opacity-100'}
                        ${isCompleted ? 'opacity-60' : ''}
                      `}
                    >
                      {/* Drag handle */}
                      <GripVertical className="w-3.5 h-3.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-60 transition-opacity mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />

                      {/* Checkbox */}
                      <button
                        onClick={(e) => handleToggleComplete(task, e)}
                        className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-all
                          ${isCompleted
                            ? 'bg-emerald-500/30 border-emerald-500/60 text-emerald-300'
                            : 'border-white/20 hover:border-white/40 text-transparent hover:text-white/20'
                          }
                        `}
                      >
                        <Check className="w-3 h-3" />
                      </button>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleTitleSave(task)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTitleSave(task);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-black/20 border border-white/20 rounded px-1 -ml-1 text-xs text-white focus:outline-none w-full"
                          />
                        ) : (
                          <div 
                            className={`text-xs font-medium leading-tight truncate ${isCompleted ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTaskId(task.id);
                              setEditTitle(task.title);
                            }}
                            title="Click to edit title"
                          >
                            {task.title}
                          </div>
                        )}
                        {!isAllDay && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(task.start), 'h:mm a')}
                          </div>
                        )}
                      </div>

                      {/* Color dot */}
                      {task.backgroundColor && (
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: task.backgroundColor }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Drop indicator at end of list */}
              {dragOverDay === dayKey && dragOverIndex === dayTasks.length && (
                <div className="h-0.5 bg-purple-400 rounded-full mx-1 mt-1 animate-pulse" />
              )}

              {/* Inline Add */}
              {addingForDay === dayKey && (
                <div className="mt-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask(day);
                      if (e.key === 'Escape') setAddingForDay(null);
                    }}
                    onBlur={() => {
                      if (newTaskTitle.trim()) handleAddTask(day);
                      else setAddingForDay(null);
                    }}
                    placeholder="New task..."
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              )}

              {/* Empty state overlay (only visual) */}
              {dayTasks.length === 0 && addingForDay !== dayKey && (
                <div className="text-[10px] text-[var(--text-secondary)] text-center py-3 opacity-50 pointer-events-none absolute w-full left-0 top-1/2 -translate-y-1/2">
                  No tasks
                </div>
              )}

              {/* Filler space to catch drops at the bottom */}
              <div 
                className="flex-1"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDay(dayKey);
                  setDragOverIndex(dayTasks.length);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDrop(e, day, dayTasks.length);
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
