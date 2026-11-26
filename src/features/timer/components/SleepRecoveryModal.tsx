import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Loader2, Moon, Play } from 'lucide-react';
import Button from '@shared/components/Button';
import { getErrorMessage } from '@shared/lib/utils';

export interface SleepRecoveryInfo {
  slept_at: string;
  woke_at: string;
  sleep_duration_seconds: number;
  elapsed_at_sleep_millis: number;
  mode: 'stopwatch' | 'pomodoro';
  phase_ended_during_sleep: boolean;
  scheduled_phase_end: string | null;
  pomodoro_phase: number | null;
}

type RecoveryAction = 'end_at_sleep' | 'keep_full_time';

const SESSION_QUERY_KEYS = [
  ['timer_projects'],
  ['sessions'],
  ['analytics'],
  ['overall_project_time'],
  ['todays_overall_time'],
  ['most_active_project_name'],
] as const;

function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSecs = secs % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
  }
  return `${remainingSecs}s`;
}

export default function SleepRecoveryModal() {
  const queryClient = useQueryClient();
  const [recovery, setRecovery] = useState<SleepRecoveryInfo | null>(null);
  const [submittingAction, setSubmittingAction] = useState<RecoveryAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = submittingAction !== null;

  useEffect(() => {
    let active = true;

    invoke<SleepRecoveryInfo | null>('get_pending_sleep_recovery')
      .then((pending) => {
        if (active && pending) {
          setRecovery(pending);
          setError(null);
        }
      })
      .catch((err) => console.error('Failed to check pending sleep recovery:', err));

    const unlistenNeededPromise = listen<SleepRecoveryInfo>('sleep-recovery-needed', (event) => {
      if (active) {
        setRecovery(event.payload);
        setError(null);
      }
    });

    const unlistenResolvedPromise = listen('sleep-recovery-resolved', () => {
      if (active) {
        setRecovery(null);
        setSubmittingAction(null);
        setError(null);
      }
    });

    return () => {
      active = false;
      unlistenNeededPromise.then((unlisten) => unlisten());
      unlistenResolvedPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!recovery) return null;

  const sleepTimeLabel = formatLocalTime(recovery.slept_at);
  const wokeTimeLabel = formatLocalTime(recovery.woke_at);
  const sleepDurationLabel = formatDuration(recovery.sleep_duration_seconds);
  const elapsedBeforeSleepLabel = formatDuration(
    Math.floor(Math.max(0, recovery.elapsed_at_sleep_millis) / 1000),
  );
  const scheduledPhaseEndLabel = recovery.scheduled_phase_end
    ? formatLocalTime(recovery.scheduled_phase_end)
    : null;

  const handleResolve = async (action: RecoveryAction) => {
    if (isSubmitting) return;
    setSubmittingAction(action);
    setError(null);

    try {
      await invoke('resolve_sleep_recovery', { action });
      setRecovery(null);
      await Promise.all(
        SESSION_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      );
    } catch (err) {
      console.error('Failed to resolve sleep recovery:', err);
      setError(getErrorMessage(err, 'Unable to save your sleep recovery choice. Please try again.'));
    } finally {
      setSubmittingAction(null);
    }
  };

  return createPortal(
    <div className="animate-modal-backdrop fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sleep-recovery-title"
        className="surface-elevated animate-modal-panel flex w-full max-w-lg flex-col gap-5 rounded-2xl p-6 sm:p-7"
      >
        {/* Header with Solar Amber Moon badge */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/12 text-amber-400">
            <Moon className="h-6 w-6" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2
                id="sleep-recovery-title"
                className="text-lg font-semibold tracking-tight text-[#F4F5F7]"
              >
                Device Sleep Detected
              </h2>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[#9CA3B0] uppercase">
                {recovery.mode}
              </span>
            </div>
            {recovery.phase_ended_during_sleep && scheduledPhaseEndLabel ? (
              <p className="text-sm leading-relaxed text-[#9CA3B0]">
                Your Pomodoro phase would have finished at{' '}
                <span className="font-mono font-medium text-[#F4F5F7]">
                  {scheduledPhaseEndLabel}
                </span>
                . End the session at sleep time, or save the completed phase and pause for the next
                one.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-[#9CA3B0]">
                Were you still working while your device was asleep, or did you forget to pause the
                timer?
              </p>
            )}
          </div>
        </div>

        {/* Structured sleep summary grid */}
        <div className="surface-well grid grid-cols-2 gap-3 rounded-xl p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-[#646C7A]">Time Slept</span>
            <span className="font-mono text-sm font-semibold text-[#F4F5F7] tabular-nums">
              {sleepTimeLabel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-[#646C7A]">Time Woke</span>
            <span className="font-mono text-sm font-semibold text-[#F4F5F7] tabular-nums">
              {wokeTimeLabel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-white/[0.06] pt-2.5">
            <span className="text-[11px] font-medium text-[#646C7A]">Sleep Duration</span>
            <span className="font-mono text-sm font-semibold text-amber-400 tabular-nums">
              {sleepDurationLabel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-white/[0.06] pt-2.5">
            <span className="text-[11px] font-medium text-[#646C7A]">Elapsed Before Sleep</span>
            <span className="font-mono text-sm font-semibold text-[#F4F5F7] tabular-nums">
              {elapsedBeforeSleepLabel}
            </span>
          </div>
        </div>

        {/* Inline error banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Resolution actions */}
        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            scale="lg"
            disabled={isSubmitting}
            onClick={() => handleResolve('keep_full_time')}
            className="w-full"
          >
            {submittingAction === 'keep_full_time' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            <span>
              {recovery.phase_ended_during_sleep && scheduledPhaseEndLabel
                ? `Finish phase (${scheduledPhaseEndLabel}) & pause`
                : 'Keep full time & continue'}
            </span>
          </Button>

          <Button
            variant="secondary"
            scale="lg"
            disabled={isSubmitting}
            onClick={() => handleResolve('end_at_sleep')}
            className="w-full"
          >
            {submittingAction === 'end_at_sleep' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4 text-[#9CA3B0]" />
            )}
            <span>{`End session at ${sleepTimeLabel}`}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
