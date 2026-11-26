import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { format, isToday } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Hourglass,
  RefreshCw,
  Timer as TimerIcon,
  X,
} from 'lucide-react';
import type { SessionEntry, SessionType } from '@shared/lib/models/session';
import { cn, formatSecondsToString, getErrorMessage } from '@shared/lib/utils';

interface TodayTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  FOCUS: 'Focus',
  SHORT_BREAK: 'Short Break',
  LONG_BREAK: 'Long Break',
};

const DURATION_PILL_CLASSES: Record<SessionType, string> = {
  FOCUS: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  SHORT_BREAK: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
  LONG_BREAK: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
};

function formatBlockDuration(seconds: number): string {
  if (seconds <= 0 || Number.isNaN(seconds)) return '0s';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return m < 5 && s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return '—';
  const startStr = format(start, 'HH:mm');
  if (Number.isNaN(end.getTime())) return startStr;
  return `${startStr} – ${format(end, 'HH:mm')}`;
}

function getTimelineNodeColor(session: SessionEntry): string {
  if (session.session_type === 'SHORT_BREAK') return '#2DD4BF';
  if (session.session_type === 'LONG_BREAK') return '#38BDF8';
  return session.project_color || '#F59E0B';
}

export function TodayTimelineDrawer({ isOpen, onClose }: Readonly<TodayTimelineDrawerProps>) {
  const navigate = useNavigate();

  const {
    data: sessions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => invoke<SessionEntry[]>('get_sessions'),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const { todaySessions, totalFocusSeconds, focusCount, breakCount } = useMemo(() => {
    const filtered = sessions
      .filter((session) => {
        const startDate = new Date(session.start_time);
        return !Number.isNaN(startDate.getTime()) && isToday(startDate);
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    let focusSecs = 0;
    let fCount = 0;
    let bCount = 0;

    for (const session of filtered) {
      if (session.session_type === 'FOCUS') {
        focusSecs += Math.max(0, session.duration_seconds || 0);
        fCount += 1;
      } else {
        bCount += 1;
      }
    }

    return {
      todaySessions: filtered,
      totalFocusSeconds: focusSecs,
      focusCount: fCount,
      breakCount: bCount,
    };
  }, [sessions]);

  if (!isOpen) return null;

  const todayDateLabel = format(new Date(), 'EEEE, MMM d');
  const totalFocusLabel = formatSecondsToString(totalFocusSeconds);

  const handleOpenSessionLog = () => {
    onClose();
    navigate('/analytics?tab=sessions');
  };

  return createPortal(
    <div className="fixed inset-0 z-[1150] flex justify-end">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-modal-backdrop fixed inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      {/* Slide-over sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Today's sessions"
        className="surface-elevated animate-drawer-in relative z-10 flex h-full w-full max-w-sm flex-col border-l border-white/[0.08]"
      >
        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.07] px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-[#646C7A]">
                {todayDateLabel}
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#F4F5F7]">
                Today&apos;s Sessions
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close today's sessions"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-white/[0.07] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Summary bar */}
          <div className="surface-well mt-3.5 flex items-center justify-between rounded-xl px-3.5 py-2.5">
            <div>
              <span className="block text-[10px] font-semibold tracking-wider text-[#646C7A] uppercase">
                Total Focus
              </span>
              <span className="mt-0.5 block font-mono text-base font-semibold text-[#F4F5F7] tabular-nums">
                {totalFocusLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1">
                <span className="font-mono text-xs font-medium text-amber-300 tabular-nums">
                  {focusCount}
                </span>
                <span className="ml-1 text-[11px] text-[#9CA3B0]">focus</span>
              </div>
              {breakCount > 0 && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1">
                  <span className="font-mono text-xs font-medium text-teal-300 tabular-nums">
                    {breakCount}
                  </span>
                  <span className="ml-1 text-[11px] text-[#9CA3B0]">
                    {breakCount === 1 ? 'break' : 'breaks'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable timeline body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading today's sessions">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/[0.1]" />
                      <span className="h-3.5 w-28 animate-pulse rounded bg-white/[0.08]" />
                    </div>
                    <span className="h-5 w-12 animate-pulse rounded-md bg-white/[0.06]" />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
                    <span className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-8 text-center">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-rose-200">
                  Couldn&apos;t load today&apos;s sessions
                </p>
                <p className="text-[11px] text-rose-300/80">
                  {getErrorMessage(error, 'Please try again.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/25"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-[#646C7A]">
                <Clock3 className="h-5 w-5" />
              </div>
              <p className="mt-4 max-w-[240px] text-xs leading-relaxed text-[#9CA3B0]">
                No sessions recorded today yet. Start the timer to log your first block.
              </p>
            </div>
          ) : (
            <ol aria-label="Chronological session timeline" className="relative space-y-2.5 pl-4">
              {/* Subtle vertical timeline rail */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-3 bottom-3 left-[4.5px] w-px bg-white/[0.08]"
              />

              {todaySessions.map((session) => {
                const isBreak = session.session_type !== 'FOCUS';
                const nodeColor = getTimelineNodeColor(session);
                const ModeIcon = session.mode === 'POMODORO' ? Hourglass : TimerIcon;

                return (
                  <li key={session.id} className="relative">
                    {/* Timeline rail dot */}
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: nodeColor }}
                      className="absolute top-4 -left-4 h-2.5 w-2.5 rounded-full ring-[3px] ring-[#171B23]"
                    />

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 transition-colors hover:border-white/[0.11] hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: session.project_color || '#F59E0B' }}
                          />
                          <span className="truncate text-xs font-medium text-[#F4F5F7]">
                            {session.project_name || 'Unassigned'}
                          </span>
                        </div>

                        <span
                          className={cn(
                            'shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums',
                            DURATION_PILL_CLASSES[session.session_type],
                          )}
                        >
                          {formatBlockDuration(session.duration_seconds)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-[#9CA3B0] tabular-nums">
                          {formatTimeRange(session.start_time, session.end_time)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isBreak && (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                session.session_type === 'SHORT_BREAK'
                                  ? 'bg-teal-400/10 text-teal-300'
                                  : 'bg-sky-400/10 text-sky-300',
                              )}
                            >
                              {SESSION_TYPE_LABELS[session.session_type]}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3B0]">
                            <ModeIcon className="h-2.5 w-2.5 text-[#646C7A]" />
                            <span>{session.mode === 'POMODORO' ? 'Pomodoro' : 'Stopwatch'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Footer CTA */}
        <footer className="shrink-0 border-t border-white/[0.07] px-5 py-3.5">
          <button
            type="button"
            onClick={handleOpenSessionLog}
            className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-[#F4F5F7] transition-all duration-150 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
          >
            <span>Open full Session Log</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#646C7A] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber-300" />
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
