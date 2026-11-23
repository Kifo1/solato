import Button from '@/shared/components/Button';
import { Folder, Project } from '@/shared/lib/models/project';
import {
  SessionEntry,
  SessionSyncEvent,
  SessionType,
  TimerMode,
  UpdateSessionInput,
} from '@/shared/lib/models/session';
import { formatSecondsToString } from '@/shared/lib/utils';
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
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CustomSelect, SelectOption } from './CustomSelect';
import { ProjectFolderSelect } from './ProjectFolderSelect';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  initialDate?: string | null;
}

const SESSIONS_PER_PAGE = 12;

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  FOCUS: 'Focus',
  SHORT_BREAK: 'Short Break',
  LONG_BREAK: 'Long Break',
};

const SESSION_TYPE_BADGE_CLASSES: Record<SessionType, string> = {
  FOCUS: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
  SHORT_BREAK: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  LONG_BREAK: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
};

const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  STOPWATCH: 'Stopwatch',
  POMODORO: 'Pomodoro',
};

type SessionTypeFilter = 'all' | SessionType;

const SESSION_TYPE_OPTIONS: SelectOption<SessionType>[] = [
  { value: 'FOCUS', label: 'Focus', dotColor: '#3B82F6' },
  { value: 'SHORT_BREAK', label: 'Short Break', dotColor: '#10B981' },
  { value: 'LONG_BREAK', label: 'Long Break', dotColor: '#8B5CF6' },
];

const SESSION_TYPE_FILTER_OPTIONS: SelectOption<SessionTypeFilter>[] = [
  { value: 'all', label: 'All types' },
  ...SESSION_TYPE_OPTIONS,
];

const TIMER_MODE_OPTIONS: SelectOption<TimerMode>[] = [
  {
    value: 'STOPWATCH',
    label: 'Stopwatch',
    icon: <Timer className="h-3.5 w-3.5 shrink-0 text-blue-300" />,
  },
  {
    value: 'POMODORO',
    label: 'Pomodoro',
    icon: <Hourglass className="h-3.5 w-3.5 shrink-0 text-blue-300" />,
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

export function SessionHistoryModal({
  isOpen,
  onClose,
  projects,
  initialDate = null,
}: Readonly<SessionHistoryModalProps>) {
  const queryClient = useQueryClient();

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
      if (event.key === 'Escape') {
        if (editingSession) {
          setEditingSession(null);
          setEditError(null);
        } else {
          onClose();
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editingSession, onClose]);

  const invalidateSessionDependentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['overall_project_time'] });
    queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] });
    queryClient.invalidateQueries({ queryKey: ['most_active_project_name'] });
    queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
  };

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
  }, [isOpen, queryClient]);

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
    },
    onError: (err) => {
      setEditError(typeof err === 'string' ? err : String(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_session', { id }),
    onSuccess: () => {
      invalidateSessionDependentQueries();
      setConfirmDeleteId(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(typeof err === 'string' ? err : String(err));
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

  const totalFocusSeconds = useMemo(() => {
    return filteredSessions.reduce(
      (sum, s) => sum + (s.session_type === 'FOCUS' ? s.duration_seconds : 0),
      0,
    );
  }, [filteredSessions]);

  const maxPage = Math.max(1, Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [projectFilter, typeFilter, dateFilter]);

  useEffect(() => {
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, maxPage]);

  const startIdx = (page - 1) * SESSIONS_PER_PAGE;
  const visibleSessions = filteredSessions.slice(startIdx, startIdx + SESSIONS_PER_PAGE);

  const hasActiveFilters = projectFilter !== null || typeFilter !== 'all' || dateFilter !== '';

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing…
          </span>
        );
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <Cloud className="h-3 w-3" />
            Synced with cloud
          </span>
        );
      case 'local_only':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-700/40 px-2.5 py-1 text-xs font-medium text-slate-300">
            <Check className="h-3 w-3" />
            Saved locally
          </span>
        );
      case 'error':
        return (
          <span
            title={syncEvent.message ?? 'Cloud sync will retry automatically.'}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
          >
            <CloudOff className="h-3 w-3" />
            Saved locally · sync pending
          </span>
        );
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={() => {
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
        aria-label="Session History"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-blue-300/25 bg-slate-800 text-left shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/10 px-6 py-4">
          <div className="flex items-center gap-3">
            {editingSession ? (
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setEditError(null);
                }}
                className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-blue-200 transition-colors hover:cursor-pointer hover:border-blue-500 hover:text-white"
                aria-label="Back to sessions"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                <History className="h-4 w-4" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white">
                {editingSession ? 'Edit Session' : 'Session History'}
              </h2>
              <p className="text-xs text-blue-200/75">
                {editingSession
                  ? 'Adjust timestamps, duration, or project — changes sync automatically.'
                  : `${filteredSessions.length} session${filteredSessions.length === 1 ? '' : 's'} · ${formatSecondsToString(totalFocusSeconds)} focus`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {renderSyncBadge()}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close session history"
              className="rounded-lg p-2 text-slate-300 transition-colors hover:cursor-pointer hover:bg-slate-700 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {editingSession ? (
          <form
            onSubmit={handleEditSubmit}
            className="flex flex-1 flex-col gap-5 overflow-y-auto p-6"
          >
            {editError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Project */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
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
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
                  Duration (adjusts end time)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      aria-label="Duration hours"
                      value={editDurationHours}
                      onChange={(e) => handleDurationChange(e.target.value, editDurationMinutes)}
                      className="w-full bg-transparent text-sm text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">h</span>
                  </div>
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      aria-label="Duration minutes"
                      value={editDurationMinutes}
                      onChange={(e) => handleDurationChange(editDurationHours, e.target.value)}
                      className="w-full bg-transparent text-sm text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">m</span>
                  </div>
                </div>
              </div>

              {/* Start time */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="session-start"
                  className="text-xs font-semibold tracking-wider text-blue-200 uppercase"
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
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white scheme-dark focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* End time */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="session-end"
                  className="text-xs font-semibold tracking-wider text-blue-200 uppercase"
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
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white scheme-dark focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Session type */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
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
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
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

            <div className="mt-auto flex items-center justify-end gap-3 border-t border-slate-200/10 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="rounded-lg border border-slate-600 text-sm"
                onClick={() => {
                  setEditingSession(null);
                  setEditError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-lg text-sm font-semibold"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/10 bg-slate-900/30 px-6 py-3">
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

              <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 transition-colors focus-within:border-blue-500 hover:border-blue-400/70">
                <Calendar className="h-3.5 w-3.5 text-blue-300" />
                <input
                  type="date"
                  aria-label="Filter by date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-white scheme-dark focus:outline-none"
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
                  className="text-xs font-medium text-blue-300 hover:cursor-pointer hover:text-white"
                >
                  Clear filters
                </button>
              )}
            </div>

            {deleteError && (
              <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-blue-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sessions…
                </div>
              ) : loadError ? (
                <div className="py-16 text-center text-sm text-red-300">
                  Failed to load sessions: {String(loadError)}
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="py-16 text-center text-sm text-blue-200/70">
                  {hasActiveFilters
                    ? 'No sessions match the selected filters.'
                    : 'No past sessions recorded yet.'}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-xs">
                    <tr className="border-b border-slate-200/10">
                      <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase">
                        Project
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase">
                        Date &amp; Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase">
                        Type / Mode
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold tracking-wider text-blue-200 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.map((session) => {
                      const start = new Date(session.start_time);
                      const end = new Date(session.end_time);
                      const spansDays = !isSameDay(start, end);
                      const isConfirmingDelete = confirmDeleteId === session.id;

                      return (
                        <tr
                          key={session.id}
                          className="group border-b border-slate-200/5 transition-colors last:border-b-0 hover:bg-slate-200/5"
                        >
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: session.project_color }}
                              />
                              <span className="max-w-44 truncate text-sm font-medium text-white">
                                {session.project_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">
                              {spansDays
                                ? `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
                                : format(start, 'EEE, MMM d, yyyy')}
                            </div>
                            <div className="text-xs text-blue-200/70">
                              {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/60 px-2.5 py-1 text-sm font-semibold text-white">
                              <Clock3 className="h-3.5 w-3.5 text-blue-400" />
                              {formatSessionDuration(session.duration_seconds)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SESSION_TYPE_BADGE_CLASSES[session.session_type]}`}
                              >
                                {SESSION_TYPE_LABELS[session.session_type]}
                              </span>
                              <span className="rounded-full border border-slate-600/60 bg-slate-900/40 px-2 py-0.5 text-[11px] text-slate-300">
                                {TIMER_MODE_LABELS[session.mode]}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-right whitespace-nowrap">
                            {isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => deleteMutation.mutate(session.id)}
                                  className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-300 hover:cursor-pointer hover:bg-red-500/30"
                                >
                                  {deleteMutation.isPending ? 'Deleting…' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:cursor-pointer hover:bg-slate-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  title="Edit session"
                                  aria-label="Edit session"
                                  onClick={() => openEditor(session)}
                                  className="rounded-lg p-1.5 text-blue-200 transition-colors hover:cursor-pointer hover:bg-slate-700 hover:text-white"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete session"
                                  aria-label="Delete session"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setConfirmDeleteId(session.id);
                                  }}
                                  className="rounded-lg p-1.5 text-blue-200 transition-colors hover:cursor-pointer hover:bg-red-500/20 hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
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
              <div className="flex items-center justify-between border-t border-slate-200/10 bg-slate-900/30 px-6 py-3">
                <div className="text-xs text-blue-200">
                  Showing{' '}
                  <span className="font-semibold text-white">
                    {startIdx + 1}-{Math.min(startIdx + SESSIONS_PER_PAGE, filteredSessions.length)}
                  </span>{' '}
                  of <span className="font-semibold text-white">{filteredSessions.length}</span>{' '}
                  sessions
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    scale="sm"
                    className="rounded-lg border border-white/15 text-xs"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    scale="sm"
                    className="rounded-lg border border-white/15 text-xs"
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
      </div>
    </div>,
    document.body,
  );
}
