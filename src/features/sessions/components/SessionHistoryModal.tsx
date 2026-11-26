import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { useToast } from '@/shared/context/ToastContext';
import { Folder, Project } from '@/shared/lib/models/project';
import {
  SessionEntry,
  SessionSyncEvent,
  SessionType,
  TimerMode,
  UpdateSessionInput,
} from '@/shared/lib/models/session';
import { cn, formatSecondsToString, getErrorMessage } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { format, isSameDay } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Clock3,
  Cloud,
  CloudOff,
  History,
  Hourglass,
  Loader2,
  Pencil,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CustomSelect, SelectOption } from './CustomSelect';
import { ProjectFolderSelect } from './ProjectFolderSelect';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  initialDate?: string | null;
  mode?: 'drawer' | 'inline';
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  FOCUS: 'Focus',
  SHORT_BREAK: 'Short Break',
  LONG_BREAK: 'Long Break',
};

const SESSION_TYPE_BADGE_CLASSES: Record<SessionType, string> = {
  FOCUS: 'border-amber-500/25 bg-amber-500/12 text-amber-300',
  SHORT_BREAK: 'border-teal-400/25 bg-teal-400/12 text-teal-300',
  LONG_BREAK: 'border-sky-400/25 bg-sky-400/12 text-sky-300',
};

const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  STOPWATCH: 'Stopwatch',
  POMODORO: 'Pomodoro',
};

type SessionTypeFilter = 'all' | SessionType;

const SESSION_TYPE_OPTIONS: SelectOption<SessionType>[] = [
  { value: 'FOCUS', label: 'Focus', dotColor: '#F59E0B' },
  { value: 'SHORT_BREAK', label: 'Short Break', dotColor: '#2DD4BF' },
  { value: 'LONG_BREAK', label: 'Long Break', dotColor: '#38BDF8' },
];

const SESSION_TYPE_FILTER_OPTIONS: SelectOption<SessionTypeFilter>[] = [
  { value: 'all', label: 'All types' },
  ...SESSION_TYPE_OPTIONS,
];

const TIMER_MODE_OPTIONS: SelectOption<TimerMode>[] = [
  {
    value: 'STOPWATCH',
    label: 'Stopwatch',
    icon: <Timer className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  },
  {
    value: 'POMODORO',
    label: 'Pomodoro',
    icon: <Hourglass className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  },
];

function formatSessionDuration(seconds: number): string {
  if (seconds < 0 || Number.isNaN(seconds)) return '0s';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return m < 5 && s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

function toLocalDateTimeInputValue(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

function parseLocalDateTimeInput(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitDurationHM(startVal: string, endVal: string): { hours: string; minutes: string } {
  const start = parseLocalDateTimeInput(startVal);
  const end = parseLocalDateTimeInput(endVal);
  if (!start || !end) return { hours: '0', minutes: '0' };
  const diffSecs = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  const totalMinutes = Math.floor(diffSecs / 60);
  return {
    hours: String(Math.floor(totalMinutes / 60)),
    minutes: String(totalMinutes % 60),
  };
}

function formatDateKeyReadable(dateKey: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'EEEE, MMM d, yyyy');
}

export function SessionHistoryModal({
  isOpen,
  onClose,
  projects,
  initialDate = null,
  mode = 'drawer',
}: Readonly<SessionHistoryModalProps>) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const isInline = mode === 'inline';
  const sessionsPerPage = isInline ? 15 : 12;

  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<SessionTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<string>(initialDate ?? '');
  const [page, setPage] = useState(1);

  const [editingSession, setEditingSession] = useState<SessionEntry | null>(null);
  const [editProjectId, setEditProjectId] = useState('');
  const [editStartLocal, setEditStartLocal] = useState('');
  const [editEndLocal, setEditEndLocal] = useState('');
  const [editDurationHours, setEditDurationHours] = useState('0');
  const [editDurationMinutes, setEditDurationMinutes] = useState('0');
  const [editSessionType, setEditSessionType] = useState<SessionType>('FOCUS');
  const [editMode, setEditMode] = useState<TimerMode>('STOPWATCH');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [syncEvent, setSyncEvent] = useState<SessionSyncEvent | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectFilter(null);
      setTypeFilter('all');
      setDateFilter(initialDate ?? '');
      setPage(1);
      setEditingSession(null);
      setEditError(null);
      setConfirmDeleteId(null);
      setDeleteError(null);
      setSyncEvent(null);
    }
  }, [isOpen, initialDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (editingSession) {
        event.preventDefault();
        setEditingSession(null);
        setEditError(null);
      } else if (!isInline) {
        event.preventDefault();
        onClose();
      }
    };

    if (isInline) {
      globalThis.addEventListener('keydown', handleKeyDown);
      return () => {
        globalThis.removeEventListener('keydown', handleKeyDown);
      };
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isInline, editingSession, onClose]);

  const invalidateSessionDependentQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['overall_project_time'] });
    queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] });
    queryClient.invalidateQueries({ queryKey: ['most_active_project_name'] });
    queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
  }, [queryClient]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let unlistenFn: (() => void) | undefined;

    listen<SessionSyncEvent>('session-sync-status', (event) => {
      setSyncEvent(event.payload);
      if (event.payload.status === 'synced') {
        invalidateSessionDependentQueries();
      }
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [isOpen, invalidateSessionDependentQueries]);

  const {
    data: sessions = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => invoke<SessionEntry[]>('get_sessions'),
    enabled: isOpen,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateSessionInput) => invoke<SessionEntry>('update_session', { input }),
    onSuccess: () => {
      invalidateSessionDependentQueries();
      setEditingSession(null);
      setEditError(null);
      toast.success('Session updated', 'Changes saved locally and queued for sync.');
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Failed to update session.');
      setEditError(message);
      toast.error('Could not update session', message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_session', { id }),
    onSuccess: () => {
      invalidateSessionDependentQueries();
      setConfirmDeleteId(null);
      setDeleteError(null);
      toast.info('Session deleted');
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Failed to delete session.');
      setDeleteError(message);
      toast.error('Could not delete session', message);
    },
  });

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (projectFilter !== null && session.project_id !== projectFilter) {
        return false;
      }
      if (typeFilter !== 'all' && session.session_type !== typeFilter) {
        return false;
      }
      if (dateFilter) {
        const localDateKey = format(new Date(session.start_time), 'yyyy-MM-dd');
        if (localDateKey !== dateFilter) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, projectFilter, typeFilter, dateFilter]);

  const totalFilteredSeconds = useMemo(() => {
    return filteredSessions.reduce((sum, s) => sum + Math.max(0, s.duration_seconds), 0);
  }, [filteredSessions]);

  const totalFocusSeconds = useMemo(() => {
    return filteredSessions.reduce(
      (sum, s) => sum + (s.session_type === 'FOCUS' ? Math.max(0, s.duration_seconds) : 0),
      0,
    );
  }, [filteredSessions]);

  const maxPage = Math.max(1, Math.ceil(filteredSessions.length / sessionsPerPage));

  useEffect(() => {
    setPage(1);
  }, [projectFilter, typeFilter, dateFilter]);

  useEffect(() => {
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, maxPage]);

  const startIdx = (page - 1) * sessionsPerPage;
  const visibleSessions = filteredSessions.slice(startIdx, startIdx + sessionsPerPage);

  const hasActiveFilters = projectFilter !== null || typeFilter !== 'all' || dateFilter !== '';
  const readableDateFilter = dateFilter ? formatDateKeyReadable(dateFilter) : null;

  const openEditor = (session: SessionEntry) => {
    const startLocal = toLocalDateTimeInputValue(session.start_time);
    const endLocal = toLocalDateTimeInputValue(session.end_time);
    const { hours, minutes } = splitDurationHM(startLocal, endLocal);

    setEditingSession(session);
    setEditProjectId(session.project_id);
    setEditStartLocal(startLocal);
    setEditEndLocal(endLocal);
    setEditDurationHours(hours);
    setEditDurationMinutes(minutes);
    setEditSessionType(session.session_type);
    setEditMode(session.mode);
    setEditError(null);
    setConfirmDeleteId(null);
  };

  const handleStartChange = (nextStart: string) => {
    setEditStartLocal(nextStart);
    const { hours, minutes } = splitDurationHM(nextStart, editEndLocal);
    setEditDurationHours(hours);
    setEditDurationMinutes(minutes);
    setEditError(null);
  };

  const handleEndChange = (nextEnd: string) => {
    setEditEndLocal(nextEnd);
    const { hours, minutes } = splitDurationHM(editStartLocal, nextEnd);
    setEditDurationHours(hours);
    setEditDurationMinutes(minutes);
    setEditError(null);
  };

  const handleDurationChange = (nextHoursStr: string, nextMinutesStr: string) => {
    setEditDurationHours(nextHoursStr);
    setEditDurationMinutes(nextMinutesStr);
    setEditError(null);

    const start = parseLocalDateTimeInput(editStartLocal);
    if (!start) return;

    const hours = Math.max(0, Number.parseInt(nextHoursStr || '0', 10) || 0);
    const minutes = Math.max(0, Number.parseInt(nextMinutesStr || '0', 10) || 0);
    const totalMs = (hours * 3600 + minutes * 60) * 1000;
    const nextEnd = new Date(start.getTime() + totalMs);
    setEditEndLocal(format(nextEnd, "yyyy-MM-dd'T'HH:mm:ss"));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    const startDate = parseLocalDateTimeInput(editStartLocal);
    const endDate = parseLocalDateTimeInput(editEndLocal);

    if (!startDate || !endDate) {
      setEditError('Please provide valid start and end timestamps.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setEditError('End time must be later than start time.');
      return;
    }

    if (!editProjectId) {
      setEditError('Please select a project.');
      return;
    }

    updateMutation.mutate({
      id: editingSession.id,
      project_id: editProjectId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      session_type: editSessionType,
      mode: editMode,
    });
  };

  const renderSyncBadge = () => {
    if (!syncEvent) return null;

    switch (syncEvent.status) {
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing...
          </span>
        );
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 text-xs font-medium text-teal-300">
            <Cloud className="h-3 w-3" />
            Synced
          </span>
        );
      case 'local_only':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[#9CA3B0]">
            <Check className="h-3 w-3" />
            Local only
          </span>
        );
      case 'error':
        return (
          <span
            title={syncEvent.message ?? 'Cloud sync will retry automatically.'}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300"
          >
            <CloudOff className="h-3 w-3" />
            Sync error
          </span>
        );
    }
  };

  if (!isOpen) {
    return null;
  }

  const headerTitle = editingSession
    ? 'Edit Session'
    : readableDateFilter && !isInline
      ? readableDateFilter
      : isInline
        ? 'Session Log'
        : 'Session History';

  const headerSubtitle = editingSession
    ? 'Adjust project, timestamps, or duration. Changes sync automatically.'
    : readableDateFilter && !isInline
      ? 'Inspect, filter, or adjust sessions recorded on this day.'
      : 'Inspect, filter, and refine your recorded focus and break sessions.';

  const content = (
    <>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-white/[0.07]',
          isInline ? 'px-6 py-5' : 'px-5 py-4',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {editingSession ? (
            <button
              type="button"
              onClick={() => {
                setEditingSession(null);
                setEditError(null);
              }}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/[0.09] bg-[#14171F] text-[#9CA3B0] transition-colors hover:border-white/[0.16] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
              aria-label="Back to session history"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <History className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-[#F4F5F7]">
              {headerTitle}
            </h2>
            <p className="mt-0.5 truncate text-xs text-[#9CA3B0]">{headerSubtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {renderSyncBadge()}
          {!isInline && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close session history"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {editingSession ? (
        <form
          onSubmit={handleEditSubmit}
          className={cn(
            'flex flex-1 flex-col gap-5',
            isInline ? 'p-6' : 'overflow-y-auto p-5',
          )}
        >
          {editError && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{editError}</span>
            </div>
          )}

          <div className="surface-well grid grid-cols-1 gap-5 rounded-2xl p-5 md:grid-cols-2">
            {/* Project */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                Project
              </span>
              <ProjectFolderSelect
                projects={projects}
                folders={folders}
                value={editProjectId || null}
                onChange={(projectId) => {
                  if (projectId) setEditProjectId(projectId);
                }}
                variant="form"
                ariaLabel="Session project"
              />
            </div>

            {/* Quick Duration */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                Duration (adjusts end time)
              </span>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#0E1015] px-3 transition-colors focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    aria-label="Duration hours"
                    value={editDurationHours}
                    onChange={(e) => handleDurationChange(e.target.value, editDurationMinutes)}
                    className="w-full bg-transparent font-mono text-sm tabular-nums text-[#F4F5F7] focus:outline-none"
                  />
                  <span className="font-mono text-xs text-[#646C7A]">h</span>
                </div>
                <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#0E1015] px-3 transition-colors focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label="Duration minutes"
                    value={editDurationMinutes}
                    onChange={(e) => handleDurationChange(editDurationHours, e.target.value)}
                    className="w-full bg-transparent font-mono text-sm tabular-nums text-[#F4F5F7] focus:outline-none"
                  />
                  <span className="font-mono text-xs text-[#646C7A]">m</span>
                </div>
              </div>
            </div>

            {/* Start time */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="session-start"
                className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase"
              >
                Start time
              </label>
              <input
                id="session-start"
                type="datetime-local"
                step={1}
                required
                value={editStartLocal}
                onChange={(e) => handleStartChange(e.target.value)}
                className="h-10 rounded-xl border border-white/[0.09] bg-[#0E1015] px-3 font-mono text-sm tabular-nums text-[#F4F5F7] scheme-dark transition-colors hover:border-white/[0.15] focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
              />
            </div>

            {/* End time */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="session-end"
                className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase"
              >
                End time
              </label>
              <input
                id="session-end"
                type="datetime-local"
                step={1}
                required
                value={editEndLocal}
                onChange={(e) => handleEndChange(e.target.value)}
                className="h-10 rounded-xl border border-white/[0.09] bg-[#0E1015] px-3 font-mono text-sm tabular-nums text-[#F4F5F7] scheme-dark transition-colors hover:border-white/[0.15] focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
              />
            </div>

            {/* Session type */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                Session type
              </span>
              <CustomSelect
                options={SESSION_TYPE_OPTIONS}
                value={editSessionType}
                onChange={setEditSessionType}
                variant="form"
                ariaLabel="Session type"
              />
            </div>

            {/* Timer mode */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                Timer mode
              </span>
              <CustomSelect
                options={TIMER_MODE_OPTIONS}
                value={editMode}
                onChange={setEditMode}
                variant="form"
                ariaLabel="Timer mode"
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-end gap-2.5 border-t border-white/[0.07] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingSession(null);
                setEditError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {/* Filter toolbar */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#101217]/80 py-3',
              isInline ? 'px-6' : 'px-5',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <ProjectFolderSelect
                projects={projects}
                folders={folders}
                value={projectFilter}
                onChange={setProjectFilter}
                allowAll
                allLabel="All projects"
                variant="filter"
                ariaLabel="Filter by project"
              />

              <CustomSelect
                options={SESSION_TYPE_FILTER_OPTIONS}
                value={typeFilter}
                onChange={setTypeFilter}
                variant="filter"
                ariaLabel="Filter by session type"
              />

              <div className="flex h-8.5 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#0E1015] px-3 transition-colors focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/15 hover:border-white/[0.16]">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <input
                  type="date"
                  aria-label="Filter by date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent font-mono text-xs font-medium tabular-nums text-[#F4F5F7] scheme-dark focus:outline-none"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setProjectFilter(null);
                    setTypeFilter('all');
                    setDateFilter('');
                  }}
                  className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-[#9CA3B0]">
              <span className="font-semibold text-[#F4F5F7]">{filteredSessions.length}</span>
              <span>{filteredSessions.length === 1 ? 'session' : 'sessions'}</span>
              <span className="text-white/20">·</span>
              <span className="font-semibold text-amber-400">
                {formatSecondsToString(
                  typeFilter === 'all'
                    ? totalFilteredSeconds
                    : totalFocusSeconds || totalFilteredSeconds,
                )}
              </span>
              <span className="text-[#646C7A]">{typeFilter === 'all' ? 'total' : 'filtered'}</span>
            </div>
          </div>

          {deleteError && (
            <div
              role="alert"
              className={cn(
                'mt-3 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200',
                isInline ? 'mx-6' : 'mx-5',
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{deleteError}</span>
            </div>
          )}

          {/* Session list */}
          <div className={cn('overflow-x-auto', !isInline && 'flex-1 overflow-y-auto')}>
            {isLoading ? (
              <div className={cn('divide-y divide-white/[0.05] py-2', isInline ? 'px-6' : 'px-5')}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-2.5 w-2.5 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-16 rounded-lg" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-7 w-14 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <p className="text-sm font-medium text-rose-200">Failed to load sessions</p>
                <p className="text-xs text-rose-300/75">
                  {getErrorMessage(loadError, 'Could not fetch recorded sessions.')}
                </p>
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-[#646C7A]">
                  <History className="h-5 w-5" />
                </div>
                <p className="mt-2 text-sm font-medium text-[#D0D5DE]">
                  {hasActiveFilters ? 'No sessions match your filters' : 'No sessions recorded yet'}
                </p>
                <p className="max-w-xs text-xs text-[#646C7A]">
                  {hasActiveFilters
                    ? 'Try adjusting the project, session type, or date filter above.'
                    : 'Complete a focus or break timer to see your session log here.'}
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[#171B23]/95 backdrop-blur-sm">
                  <tr className="border-b border-white/[0.07]">
                    <th
                      className={cn(
                        'py-2.5 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase',
                        isInline ? 'px-6' : 'px-5',
                      )}
                    >
                      Project
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                      Date &amp; Time
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                      Duration
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                      Type
                    </th>
                    <th
                      className={cn(
                        'py-2.5 text-right text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase',
                        isInline ? 'px-6' : 'px-5',
                      )}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {visibleSessions.map((session) => {
                    const start = new Date(session.start_time);
                    const end = new Date(session.end_time);
                    const spansDays = !isSameDay(start, end);
                    const isConfirmingDelete = confirmDeleteId === session.id;

                    return (
                      <tr
                        key={session.id}
                        className="group transition-colors hover:bg-white/[0.03]"
                      >
                        <td className={cn('py-3.5 whitespace-nowrap', isInline ? 'px-6' : 'px-5')}>
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: session.project_color }}
                            />
                            <span
                              className={cn(
                                'truncate text-sm font-medium text-[#F4F5F7]',
                                isInline ? 'max-w-52' : 'max-w-36',
                              )}
                            >
                              {session.project_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div className="text-sm font-medium text-[#F4F5F7]">
                            {spansDays
                              ? `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
                              : format(start, isInline ? 'EEE, MMM d, yyyy' : 'EEE, MMM d')}
                          </div>
                          <div className="mt-0.5 font-mono text-xs tabular-nums text-[#646C7A]">
                            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#0F1116] px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[#F4F5F7]">
                            <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                            {formatSessionDuration(session.duration_seconds)}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div
                            className={cn(
                              'flex gap-1.5',
                              isInline ? 'flex-row items-center' : 'flex-col items-start gap-1',
                            )}
                          >
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                SESSION_TYPE_BADGE_CLASSES[session.session_type],
                              )}
                            >
                              {SESSION_TYPE_LABELS[session.session_type]}
                            </span>
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#9CA3B0]">
                              {TIMER_MODE_LABELS[session.mode]}
                            </span>
                          </div>
                        </td>
                        <td
                          className={cn(
                            'py-3.5 text-right whitespace-nowrap',
                            isInline ? 'px-6' : 'px-5',
                          )}
                        >
                          {isConfirmingDelete ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="danger"
                                scale="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(session.id)}
                                className="h-7 px-2.5 text-xs"
                              >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                scale="sm"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-7 px-2 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                title="Edit session"
                                aria-label={`Edit ${session.project_name} session`}
                                onClick={() => openEditor(session)}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-white/[0.07] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete session"
                                aria-label={`Delete ${session.project_name} session`}
                                onClick={() => {
                                  setDeleteError(null);
                                  setConfirmDeleteId(session.id);
                                }}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-rose-500/15 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Pagination */}
          {filteredSessions.length > 0 && (
            <div
              className={cn(
                'flex items-center justify-between border-t border-white/[0.07] bg-[#101217]/80 py-3',
                isInline ? 'px-6' : 'px-5',
              )}
            >
              <div className="font-mono text-xs tabular-nums text-[#9CA3B0]">
                Showing{' '}
                <span className="font-semibold text-[#F4F5F7]">
                  {startIdx + 1}–{Math.min(startIdx + sessionsPerPage, filteredSessions.length)}
                </span>{' '}
                of <span className="font-semibold text-[#F4F5F7]">{filteredSessions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  scale="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  scale="sm"
                  disabled={page >= maxPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  if (isInline) {
    return (
      <section
        aria-label={editingSession ? 'Edit Session' : 'Session Log'}
        className="surface-card flex flex-col overflow-hidden rounded-2xl text-left"
      >
        {content}
      </section>
    );
  }

  return createPortal(
    <div
      role="presentation"
      className="animate-modal-backdrop fixed inset-0 z-[1000] flex justify-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (editingSession) {
          setEditingSession(null);
          setEditError(null);
        } else {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingSession ? 'Edit Session' : 'Session History'}
        className="surface-elevated animate-drawer-in fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/[0.08] text-left"
      >
        {content}
      </div>
    </div>,
    document.body,
  );
}
