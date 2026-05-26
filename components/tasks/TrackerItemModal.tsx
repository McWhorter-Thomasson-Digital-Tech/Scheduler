'use client';

import { useState, useEffect, useRef } from 'react';
import styles from '@/styles/glassmorphism.module.css';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrackerItem } from '@/types/database';
import { useScrollLock } from '@/hooks/useScrollLock';

interface TrackerItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TrackerItem | null;
  type: 'reading' | 'assignment';
  onSave: () => void;
}

export function TrackerItemModal({ isOpen, onClose, item, type, onSave }: TrackerItemModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | ''>(0);
  const [total, setTotal] = useState<number | ''>(0);
  const [dueDate, setDueDate] = useState('');
  const [colorCode, setColorCode] = useState('#3b82f6');

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setProgress(item.progress);
      setTotal(item.total);
      setDueDate(item.due_date || '');
      setColorCode(item.color_code || '#3b82f6');
    } else {
      setTitle('');
      setDescription('');
      setProgress(0);
      setTotal(0);
      setDueDate('');
      setColorCode(type === 'reading' ? '#8b5cf6' : '#f59e0b');
    }
  }, [item, type, isOpen]);

  const backdropRef = useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    const supabase = createClient();

    const payload = {
      type,
      title: title.trim(),
      description: description || null,
      progress: progress === '' ? 0 : progress,
      total: total === '' ? 0 : total,
      due_date: dueDate || null,
      color_code: colorCode,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (item) {
      await supabase.from('tracker_items').update(payload).eq('id', item.id);
    } else {
      await supabase.from('tracker_items').insert(payload);
    }

    onSave();
    onClose();
  };

  const handleDelete = async () => {
    if (!item) return;
    const supabase = createClient();
    await supabase.from('tracker_items').delete().eq('id', item.id);
    onSave();
    onClose();
  };

  const numProgress = progress === '' ? 0 : progress;
  const numTotal = total === '' ? 0 : total;
  const progressPercent = numTotal > 0 ? Math.min(100, Math.round((numProgress / numTotal) * 100)) : 0;

  return (
    <div ref={backdropRef} className="fixed w-full h-full top-0 left-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-md mx-4 flex flex-col max-h-[90vh] !bg-neutral-950/75`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-lg font-semibold">
            {item ? 'Edit' : 'New'} {type === 'reading' ? 'Reading' : 'Assignment'} Item
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${styles.glassInput}`}
              placeholder={type === 'reading' ? 'e.g. Chapter 5' : 'e.g. Problem Set 3'}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${styles.glassInput} resize-none`}
              placeholder="Optional notes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                Progress
              </label>
              <input
                type="number"
                min={0}
                value={progress}
                onChange={(e) => setProgress(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className={`${styles.glassInput}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                Total
              </label>
              <input
                type="number"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className={`${styles.glassInput}`}
              />
            </div>
          </div>

          {/* Progress Preview */}
          {numTotal > 0 && (
            <div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>{progressPercent}% complete</span>
                <span>{numProgress} / {numTotal}</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: colorCode,
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${styles.glassInput} text-sm`}
              />
            </div>
            <div>
              <label className="ml-8 block text-sm font-medium mb-1 text-[var(--text-secondary)]">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorCode}
                  onChange={(e) => setColorCode(e.target.value)}
                  className="ml-8 w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--glass-border)] flex justify-between">
          <div>
            {item && (
              <button
                onClick={handleDelete}
                className="text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={styles.glassButton}>
              Cancel
            </button>
            <button onClick={handleSave} className={`${styles.glassButton} ${styles.glassButtonPrimary}`}>
              {item ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
