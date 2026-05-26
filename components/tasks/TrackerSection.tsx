'use client';

import { useState } from 'react';
import styles from '@/styles/glassmorphism.module.css';
import { BookOpen, GraduationCap, Plus, ChevronDown, ChevronUp, Eye, EyeOff, Calendar } from 'lucide-react';
import { TrackerItem } from '@/types/database';
import { TrackerItemModal } from './TrackerItemModal';
import { createClient } from '@/lib/supabase/client';
import { format, isPast, isToday, addWeeks, addMonths } from 'date-fns';

interface TrackerSectionProps {
  readingItems: TrackerItem[];
  assignmentItems: TrackerItem[];
  showReading: boolean;
  showAssignment: boolean;
  onToggleReading: (show: boolean) => void;
  onToggleAssignment: (show: boolean) => void;
  onRefresh: () => void;
}

export function TrackerSection({
  readingItems,
  assignmentItems,
  showReading,
  showAssignment,
  onToggleReading,
  onToggleAssignment,
  onRefresh,
}: TrackerSectionProps) {
  const [isReadingExpanded, setIsReadingExpanded] = useState(true);
  const [isAssignmentExpanded, setIsAssignmentExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'reading' | 'assignment'>('reading');
  const [editingItem, setEditingItem] = useState<TrackerItem | null>(null);
  const [dateFilter, setDateFilter] = useState<'1_week' | '2_weeks' | '1_month' | 'due_all_time' | 'all_time'>('2_weeks');

  const getCutoffDate = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    switch (dateFilter) {
      case '1_week': return addWeeks(today, 1);
      case '2_weeks': return addWeeks(today, 2);
      case '1_month': return addMonths(today, 1);
      default: return null;
    }
  };

  const filterItems = (items: TrackerItem[]) => {
    if (dateFilter === 'all_time') return items;
    if (dateFilter === 'due_all_time') return items.filter(i => i.due_date);

    const cutoff = getCutoffDate();
    if (!cutoff) return items;
    return items.filter(item => {
      if (!item.due_date) return false; // Hide items without due dates in specific time ranges
      const dueDate = new Date(item.due_date + 'T00:00:00');
      return dueDate <= cutoff;
    });
  };

  const filteredReading = filterItems(readingItems);
  const filteredAssignment = filterItems(assignmentItems);

  const openModal = (type: 'reading' | 'assignment', item?: TrackerItem) => {
    setModalType(type);
    setEditingItem(item || null);
    setModalOpen(true);
  };

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate + 'T00:00:00');
    const overdue = isPast(date) && !isToday(date);
    const dueToday = isToday(date);

    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        overdue ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
        dueToday ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
        'bg-white/5 text-[var(--text-secondary)] border border-white/10'
      }`}>
        <Calendar className="w-2.5 h-2.5" />
        {overdue ? 'Overdue' : dueToday ? 'Due Today' : format(date, 'MMM d')}
      </span>
    );
  };

  const renderTrackerPanel = (
    type: 'reading' | 'assignment',
    items: TrackerItem[],
    isExpanded: boolean,
    setExpanded: (v: boolean) => void,
    isVisible: boolean,
    onToggleVisibility: (v: boolean) => void,
    icon: React.ReactNode,
    label: string,
    accentColor: string,
  ) => {
    return (
      <div className={`${styles.glassCard} overflow-hidden transition-all duration-200`} style={{ transform: 'none' }}>
        {/* Panel Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/5">
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-white transition-colors"
            style={{ color: accentColor }}
          >
            {icon}
            {label}
            <span className="text-xs font-normal text-[var(--text-secondary)]">({items.length})</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleVisibility(!isVisible)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)]"
              title={isVisible ? 'Hide section' : 'Show section'}
            >
              {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => openModal(type)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-[var(--text-secondary)] hover:text-white"
              title={`Add ${type}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Panel Content */}
        {isExpanded && isVisible && (
          <div className="p-3 space-y-2">
            {items.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)] text-center py-4 opacity-60">
                No {type === 'reading' ? 'reading' : 'assignment'} items yet
              </div>
            ) : (
              items.map(item => {
                const percent = item.total > 0 ? Math.min(100, Math.round((item.progress / item.total) * 100)) : 0;
                const isComplete = percent >= 100;

                return (
                  <button
                    key={item.id}
                    onClick={() => openModal(type, item)}
                    className={`w-full text-left p-2.5 rounded-lg transition-all hover:bg-white/5 border border-transparent hover:border-white/5 ${
                      isComplete ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`text-xs font-medium ${isComplete ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                        {item.title}
                      </span>
                      {getDueDateBadge(item.due_date)}
                    </div>
                    {item.total > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1">
                          <span>{percent}%</span>
                          <span>{item.progress}/{item.total}</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: item.color_code || accentColor,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {item.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">{item.description}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex justify-end mt-4 mb-1">
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className={`${styles.glassInput} text-xs py-1.5 px-3 w-auto bg-black/40`}
        >
          <option value="1_week">Due within 1 Week</option>
          <option value="2_weeks">Due within 2 Weeks</option>
          <option value="1_month">Due within 1 Month</option>
          <option value="due_all_time">Due All Time</option>
          <option value="all_time">All Time (Incl. No Date)</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {renderTrackerPanel(
          'reading',
          filteredReading,
          isReadingExpanded,
          setIsReadingExpanded,
          showReading,
          onToggleReading,
          <BookOpen className="w-4 h-4" />,
          'Reading Tracker',
          '#8b5cf6',
        )}
        {renderTrackerPanel(
          'assignment',
          filteredAssignment,
          isAssignmentExpanded,
          setIsAssignmentExpanded,
          showAssignment,
          onToggleAssignment,
          <GraduationCap className="w-4 h-4" />,
          'Assignment Tracker',
          '#f59e0b',
        )}
      </div>

      <TrackerItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editingItem}
        type={modalType}
        onSave={onRefresh}
      />
    </>
  );
}
