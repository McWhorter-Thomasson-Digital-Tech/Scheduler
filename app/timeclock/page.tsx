'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import styles from '@/styles/glassmorphism.module.css';
import { Clock, Play, Square, AlertCircle, ArrowLeft, RotateCcw, HelpCircle } from 'lucide-react';
import { format, differenceInSeconds, startOfDay, endOfDay, isToday } from 'date-fns';
import { TaskEvent } from '@/types/database';
import Link from 'next/link';

export default function TimeClockPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [activeTask, setActiveTask] = useState<TaskEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [fetching, setFetching] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Live clock and timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (activeTask && activeTask.actual_start_time) {
        setElapsedSeconds(differenceInSeconds(now, new Date(activeTask.actual_start_time)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTask]);

  // Auth check & data fetching
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchTasks();
    }
  }, [user, loading, router]);

  const fetchTasks = async () => {
    setFetching(true);
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    // Fetch user's tasks scheduled for today
    const { data: todayData, error: todayError } = await supabase
      .from('tasks_events')
      .select('*')
      .or(`assigned_to.eq.${user?.id},owner_user_id.eq.${user?.id}`)
      .gte('scheduled_start_time', todayStart)
      .lte('scheduled_start_time', todayEnd)
      .order('scheduled_start_time', { ascending: true });

    // Fetch any currently active tasks regardless of scheduled date
    const { data: activeData, error: activeError } = await supabase
      .from('tasks_events')
      .select('*')
      .or(`assigned_to.eq.${user?.id},owner_user_id.eq.${user?.id}`)
      .not('actual_start_time', 'is', null)
      .is('actual_end_time', null);

    if (todayError || activeError) {
      console.error('Error fetching tasks:', todayError || activeError);
      setFetching(false);
      return;
    }

    let fetchedTasks = (todayData || []) as TaskEvent[];
    const activeTasks = (activeData || []) as TaskEvent[];

    // Merge active tasks avoiding duplicates
    activeTasks.forEach(active => {
      if (!fetchedTasks.find(t => t.id === active.id)) {
        fetchedTasks.push(active);
      }
    });

    setTasks(fetchedTasks);

    // Find active task
    const active = fetchedTasks.find(t => t.actual_start_time && !t.actual_end_time);
    if (active) {
      setActiveTask(active);
    } else {
      setActiveTask(null);
    }

    setFetching(false);
  };

  const handleClockIn = async (task: TaskEvent) => {
    setErrorMsg('');
    if (activeTask) {
      setErrorMsg('You are already clocked into a task. Please clock out first.');
      return;
    }

    const now = new Date().toISOString();

    // Optimistic UI update
    const updatedTask = { ...task, actual_start_time: now };
    setActiveTask(updatedTask);
    setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));

    const { error } = await supabase
      .from('tasks_events')
      .update({ actual_start_time: now })
      .eq('id', task.id);

    if (error) {
      console.error('Error clocking in:', error);
      setErrorMsg('Failed to clock in to task.');
      // Revert optimistic update
      fetchTasks();
    }
  };

  const handleClockOut = async () => {
    if (!activeTask) return;
    setErrorMsg('');

    const now = new Date().toISOString();

    // Optimistic update
    const updatedTask = { ...activeTask, actual_end_time: now };
    setActiveTask(null);
    setTasks(tasks.map(t => t.id === activeTask.id ? updatedTask : t));

    const { error } = await supabase
      .from('tasks_events')
      .update({ actual_end_time: now })
      .eq('id', activeTask.id);

    if (error) {
      console.error('Error clocking out:', error);
      setErrorMsg('Failed to clock out of task.');
      fetchTasks();
    }
  };

  const handleResetTask = async (task: TaskEvent) => {
    setErrorMsg('');

    // Optimistic update
    const updatedTask = { ...task, actual_start_time: null, actual_end_time: null };
    if (activeTask?.id === task.id) {
      setActiveTask(null);
    }
    setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));

    const { error } = await supabase
      .from('tasks_events')
      .update({ actual_start_time: null, actual_end_time: null })
      .eq('id', task.id);

    if (error) {
      console.error('Error resetting task:', error);
      setErrorMsg('Failed to reset task.');
      fetchTasks();
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const formatElapsed = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter tasks to those not yet completed and scheduled for today
  const availableTasks = tasks.filter(t => !t.actual_end_time && t.id !== activeTask?.id && isToday(new Date(t.scheduled_start_time)));
  const completedTasks = tasks.filter(t => t.actual_start_time && t.actual_end_time && isToday(new Date(t.scheduled_start_time)));

  return (
    <div className="flex-1 w-full flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)]">
      {/* Header Bar */}
      <header className={`${styles.glassCard} sticky top-4 mt-4 mx-4 mb-4 px-6 py-4 flex justify-between items-center z-50`}>
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-full transition-colors text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Clock className="w-7 h-7 text-emerald-400 drop-shadow-md" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
            Time Clock
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-2"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-medium">Help</span>
          </button>
          <div className="text-right">
            <div className="text-2xl font-mono tracking-wider font-bold text-white">
            {format(currentTime, 'h:mm:ss a')}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {format(currentTime, 'EEEE, MMMM do, yyyy')}
            </div>
          </div>
        </div>
      </header>

      {/* Help Dropdown Section */}
      <div className={`mx-4 overflow-hidden transition-all duration-300 ease-in-out ${showHelp ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
        <div className={`${styles.glassCard} p-6 relative`}>
          <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            How to Use the Time Clock
          </h3>
          <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 text-sm max-w-3xl">
            <li><strong>Clock In:</strong> Select a task from your schedule on the right to start tracking your time.</li>
            <li><strong>Clock Out:</strong> Click the large "Clock Out" button when you are finished or taking a break.</li>
            <li><strong>Reset Timer:</strong> If you made a mistake, you can reset the timer using the reset button.</li>
            <li><strong>Task Visibility:</strong> Only your tasks scheduled for today will appear here.</li>
          </ul>
        </div>
      </div>

      <main className="p-4 pt-0 pb-16 relative flex-1 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Active Task & Actions */}
        <div className="flex-1 flex flex-col gap-6">
          {errorMsg && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className={`${styles.glassCard} p-8 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group`}>

            <div className="relative z-10 flex flex-col items-center">
              {activeTask ? (
                <>
                  <div className="mb-2 text-emerald-400 font-semibold tracking-widest uppercase text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Currently Clocked In
                  </div>
                  <h2 className="text-3xl font-bold mb-2 text-white">{activeTask.title}</h2>
                  <p className="text-[var(--text-secondary)] mb-8 max-w-md">{activeTask.description || 'No description provided.'}</p>

                  <div className="text-7xl font-mono font-light tracking-tight mb-12 text-white drop-shadow-lg">
                    {formatElapsed(elapsedSeconds)}
                  </div>

                  <button
                    onClick={handleClockOut}
                    className="group relative px-8 py-4 rounded-full overflow-hidden shadow-lg hover:shadow-red-500/20 transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    <div className="absolute w-full h-full top-0 left-0 bg-gradient-to-r from-red-600 to-rose-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute w-full h-full top-0 left-0 border border-white/20 rounded-full"></div>
                    <div className="relative flex items-center gap-3 font-semibold text-lg text-white">
                      <Square className="w-5 h-5 fill-current" />
                      Clock Out
                    </div>
                  </button>
                  {activeTask.owner_user_id === user?.id && (
                    <button
                      onClick={() => handleResetTask(activeTask)}
                      className="mt-6 text-sm flex items-center gap-2 text-[var(--text-secondary)] hover:text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Timer
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Clock className="w-20 h-20 text-[var(--text-secondary)] opacity-50 mb-6" />
                  <h2 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Ready to Work</h2>
                  <p className="text-[var(--text-secondary)] max-w-sm mb-8">
                    You are not currently clocked in. Select a task from your schedule to begin tracking your time.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Task Lists */}
        <div className="w-full md:w-96 flex flex-col gap-6">
          <div className={`${styles.glassCard} p-6 flex flex-col`}>
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center justify-between">
              Your Schedule
              {fetching && <span className="text-xs font-normal text-blue-400 animate-pulse">Updating...</span>}
            </h3>

            <div className="flex-1 pb-4">
              {availableTasks.length === 0 && !fetching && (
                <div className="text-center p-6 m-2 text-[var(--text-secondary)] border border-dashed border-[var(--glass-border)] rounded-xl">
                  No available tasks for today.
                </div>
              )}

              {availableTasks.map(task => (
                <div key={task.id} className={`${styles.glassCard} p-4 m-2 group hover:border-emerald-500/30 transition-colors`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-white">{task.title}</h4>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(task.scheduled_start_time), 'h:mm a')} - {format(new Date(task.scheduled_end_time), 'h:mm a')}
                  </div>
                  <button
                    onClick={() => handleClockIn(task)}
                    disabled={!!activeTask}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all
                      ${activeTask
                        ? 'bg-white/5 text-[var(--text-secondary)] cursor-not-allowed'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                      }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Clock In
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Completed Tasks Summary */}
          {completedTasks.length > 0 && (
            <div className={`${styles.glassCard} p-6`}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">Completed Today</h3>
              <div className="space-y-3">
                {completedTasks.map(task => (
                  <div key={task.id} className="flex justify-between items-center text-sm group">
                    <span className="text-[var(--text-primary)] truncate pr-4">{task.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-mono">
                        {formatElapsed(differenceInSeconds(new Date(task.actual_end_time!), new Date(task.actual_start_time!)))}
                      </span>
                      {task.owner_user_id === user?.id && (
                        <button
                          onClick={() => handleResetTask(task)}
                          className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-[var(--text-secondary)] hover:text-white"
                          title="Reset Timer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
