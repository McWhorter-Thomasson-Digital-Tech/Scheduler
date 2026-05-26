'use client';

import { useState, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import styles from '@/styles/glassmorphism.module.css';
import { X, Copy, CheckCircle2, Trash2, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ShareScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  user: any;
}

export function ShareScheduleModal({ isOpen, onClose, events, user }: ShareScheduleModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expiration, setExpiration] = useState('1week');
  const [showTitle, setShowTitle] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [showActualTime, setShowActualTime] = useState(false);
  const [shiftTypes, setShiftTypes] = useState<string[]>(['all']);

  const toggleShiftType = (typeId: string) => {
    if (typeId === 'all') {
      setShiftTypes(['all']);
      return;
    }

    let newTypes = shiftTypes.filter(t => t !== 'all');
    if (newTypes.includes(typeId)) {
      newTypes = newTypes.filter(t => t !== typeId);
      if (newTypes.length === 0) newTypes = ['all'];
    } else {
      newTypes.push(typeId);
    }
    setShiftTypes(newTypes);
  };

  const [positions, setPositions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState<'create' | 'manage'>('create');
  const [activeShares, setActiveShares] = useState<any[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && user) {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);

      setStartDate(now.toISOString().split('T')[0]);
      setEndDate(nextMonth.toISOString().split('T')[0]);
      setShareLink('');
      setCopied(false);
      setViewMode('create');

      fetchPositions();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (viewMode === 'manage' && isOpen) {
      fetchActiveShares();
    }
  }, [viewMode, isOpen]);

  const fetchActiveShares = async () => {
    setIsLoadingShares(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shared_schedules')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveShares(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingShares(false);
    }
  };

  const deleteShare = async (id: string) => {
    try {
      const supabase = createClient();
      await supabase.from('shared_schedules').delete().eq('id', id);
      setActiveShares(shares => shares.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete share link.');
    }
  };

  const copyShareLink = async (id: string, url: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const fetchPositions = async () => {
    const supabase = createClient();
    const { data: orgMemberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user?.id);
    const orgIds = orgMemberships?.map((m: any) => m.organization_id) || [];

    let query = supabase.from('positions').select('*');
    if (orgIds.length > 0) {
      query = query.or(`owner_user_id.eq.${user?.id},owner_organization_id.in.(${orgIds.join(',')})`);
    } else {
      query = query.or(`owner_user_id.eq.${user?.id}`);
    }
    const { data } = await query;
    if (data) setPositions(data);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();

      const expDate = new Date();
      if (expiration === '1day') expDate.setDate(expDate.getDate() + 1);
      if (expiration === '1week') expDate.setDate(expDate.getDate() + 7);
      if (expiration === '1month') expDate.setMonth(expDate.getMonth() + 1);
      if (expiration === '3months') expDate.setMonth(expDate.getMonth() + 3);
      if (expiration === '6months') expDate.setMonth(expDate.getMonth() + 6);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filteredEvents = events.filter((ev: any) => {
        const evStart = new Date(ev.start);
        const evEnd = ev.end ? new Date(ev.end) : evStart;

        const inDateRange = evEnd >= start && evStart <= end;
        const posId = ev.extendedProps.position_id;
        const isQuickTask = !posId;
        const matchesShift = shiftTypes.includes('all') ||
          (isQuickTask ? shiftTypes.includes('unassigned') : shiftTypes.includes(posId));

        return inDateRange && matchesShift;
      });

      const payloadEvents = filteredEvents.map((ev: any) => {
        const hideDetails = ev.extendedProps?.hide_details_in_share;

        return {
          id: ev.id,
          title: (showTitle && !hideDetails) ? ev.title : 'Busy',
          description: (showDescription && !hideDetails) ? ev.extendedProps?.description : null,
          colorCode: showColor ? ev.backgroundColor : '#3b82f6',
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          actualStart: (showActualTime && !hideDetails) ? ev.extendedProps?.actualStart : null,
          actualEnd: (showActualTime && !hideDetails) ? ev.extendedProps?.actualEnd : null,
        };
      });

      const payload = {
        config: {
          showTitle,
          showDescription,
          showColor,
          showActualTime,
          startDate,
          endDate,
          shiftTypes
        },
        events: payloadEvents
      };

      const { data, error } = await supabase.from('shared_schedules').insert([{
        user_id: user.id,
        expires_at: expDate.toISOString(),
        payload
      }]).select().single();

      if (error) throw error;

      const url = `${window.location.origin}/share/${data.id}`;
      setShareLink(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate share link.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareLink;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const backdropRef = useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div ref={backdropRef} className="fixed w-full h-full top-0 left-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className={`${styles.glassCard} w-full max-w-lg mx-2 sm:mx-4 flex flex-col max-h-[90vh] !bg-neutral-950/75`}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-xl font-semibold">{viewMode === 'create' ? 'Share Schedule' : 'Active Links'}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'create' ? 'manage' : 'create')}
              className={`${styles.glassButton} text-xs sm:text-sm px-3 py-1.5`}
            >
              {viewMode === 'create' ? 'Manage Active Links' : 'Create New Link'}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {viewMode === 'manage' ? (
            <div className="space-y-4">
              {isLoadingShares ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
              ) : activeShares.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">No active shared links found.</div>
              ) : (
                activeShares.map(share => {
                  const url = `${window.location.origin}/share/${share.id}`;
                  const isCopied = copiedStates[share.id];
                  return (
                    <div key={share.id} className="p-4 border border-[var(--glass-border)] rounded-lg bg-black/20 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium">Expires: {new Date(share.expires_at).toLocaleDateString()}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">
                            Schedule: {new Date(share.payload.config.startDate).toLocaleDateString()} to {new Date(share.payload.config.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteShare(share.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="Delete Link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={url}
                          className={`${styles.glassInput} flex-1 text-xs bg-black/40 py-1.5 px-2`}
                        />
                        <button
                          onClick={() => copyShareLink(share.id, url)}
                          className={`${styles.glassButton} px-2 py-1.5 ${isCopied ? 'text-green-400 border-green-500/30' : ''}`}
                          title="Copy Link"
                        >
                          {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.glassButton} px-2 py-1.5`}
                          title="Open Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : shareLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <h3 className="font-semibold text-lg">Link Generated Successfully!</h3>
                <p className="text-sm opacity-80">Anyone with this link can view the selected schedule until it expires.</p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className={`${styles.glassInput} flex-1 text-sm bg-black/20`}
                />
                <button
                  onClick={copyToClipboard}
                  className={`${styles.glassButton} ${copied ? 'bg-green-500/20 text-green-400' : ''}`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Date Range & Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`${styles.glassInput} w-full`}
                    style={{ paddingLeft: '0px', paddingRight: '0px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`${styles.glassInput} w-full`}
                    style={{ paddingLeft: '0px', paddingRight: '0px' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Link Expiration</label>
                <select
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                  className={`${styles.glassInput} w-full bg-[#1a1b26]`}
                >
                  <option value="1day">1 Day</option>
                  <option value="1week">1 Week</option>
                  <option value="1month">1 Month</option>
                  <option value="3months">3 Months</option>
                  <option value="6months">6 Months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Shift Types to Include</label>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar border border-[var(--glass-border)] p-3 rounded-lg bg-black/10">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={shiftTypes.includes('all')}
                      onChange={() => toggleShiftType('all')}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20 cursor-pointer"
                    />
                    <span className="text-sm text-white group-hover:text-blue-200 transition-colors">All Shifts & Tasks</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={shiftTypes.includes('unassigned')}
                      onChange={() => toggleShiftType('unassigned')}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20 cursor-pointer"
                    />
                    <span className="text-sm text-white group-hover:text-blue-200 transition-colors">Quick Tasks (Unassigned)</span>
                  </label>
                  {positions.map(p => (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={shiftTypes.includes(p.id)}
                        onChange={() => toggleShiftType(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color_code || '#6b7280' }}></span>
                        <span className="text-sm text-white group-hover:text-blue-200 transition-colors">{p.title}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-[var(--accent-primary)]">Visibility Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20" />
                    <span className="text-sm text-[var(--text-secondary)]">Show Task Title (otherwise "Busy")</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={showDescription} onChange={(e) => setShowDescription(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20" />
                    <span className="text-sm text-[var(--text-secondary)]">Show Task Description</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={showColor} onChange={(e) => setShowColor(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20" />
                    <span className="text-sm text-[var(--text-secondary)]">Show Colors</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={showActualTime} onChange={(e) => setShowActualTime(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-black/20" />
                    <span className="text-sm text-[var(--text-secondary)]">Show Actual Tracked Time</span>
                  </label>
                  <div className="text-xs text-[var(--text-secondary)] mt-2 opacity-70 italic">
                    Note: Scheduled time block is always displayed. Tasks marked "Hide details in shared views" will only appear as "Busy".
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--glass-border)] flex justify-end gap-2">
          <button onClick={onClose} className={styles.glassButton}>
            {viewMode === 'manage' || shareLink ? 'Close' : 'Cancel'}
          </button>
          {viewMode === 'create' && !shareLink && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`${styles.glassButton} ${styles.glassButtonPrimary}`}
            >
              {isGenerating ? 'Generating...' : 'Generate Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
