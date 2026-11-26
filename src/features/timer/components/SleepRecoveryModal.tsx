import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { Moon, Clock, Play } from 'lucide-react';
import Button from '@shared/components/Button';

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
    return `${minutes}m`;
  }
  return `${remainingSecs}s`;
}

export default function SleepRecoveryModal() {
  const queryClient = useQueryClient();
  const [recovery, setRecovery] = useState<SleepRecoveryInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    invoke<SleepRecoveryInfo | null>('get_pending_sleep_recovery')
      .then((pending) => {
        if (active && pending) {
          setRecovery(pending);
        }
      })
      .catch((err) => console.error('Failed to check pending sleep recovery:', err));

    const unlistenNeededPromise = listen<SleepRecoveryInfo>('sleep-recovery-needed', (event) => {
      if (active) {
        setRecovery(event.payload);
      }
    });

    const unlistenResolvedPromise = listen('sleep-recovery-resolved', () => {
      if (active) {
        setRecovery(null);
        setIsSubmitting(false);
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
  const sleepDurationLabel = formatDuration(recovery.sleep_duration_seconds);
  const scheduledPhaseEndLabel = recovery.scheduled_phase_end
    ? formatLocalTime(recovery.scheduled_phase_end)
    : null;

  const handleResolve = async (action: 'end_at_sleep' | 'keep_full_time') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await invoke('resolve_sleep_recovery', { action });
      setRecovery(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timer_projects'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['overall_project_time'] }),
        queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] }),
      ]);
    } catch (err) {
      console.error('Failed to resolve sleep recovery:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-1000 flex h-full w-full items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sleep-recovery-title"
        className="mx-6 flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-blue-300/35 bg-slate-800 p-8 text-center shadow-2xl"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
          <Moon className="h-7 w-7" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 id="sleep-recovery-title" className="text-2xl font-bold text-white">
            Device Sleep Detected
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Your device went to sleep at{' '}
            <span className="font-semibold text-white">{sleepTimeLabel}</span> and was asleep for{' '}
            <span className="font-semibold text-white">{sleepDurationLabel}</span>.
          </p>
          {recovery.phase_ended_during_sleep && scheduledPhaseEndLabel ? (
            <p className="text-sm leading-relaxed text-blue-200/90">
              Your Pomodoro phase would have finished at{' '}
              <span className="font-semibold text-white">{scheduledPhaseEndLabel}</span>. You can
              end the session at sleep time or save the completed phase and pause for the next one.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-400">
              Were you still studying while the device was asleep, or did you forget to stop the
              timer?
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            variant="primary"
            scale="md"
            disabled={isSubmitting}
            onClick={() => handleResolve('keep_full_time')}
            className="w-full py-3 text-base"
          >
            <Play className="h-4 w-4" />
            {recovery.phase_ended_during_sleep && scheduledPhaseEndLabel
              ? `Finish phase (${scheduledPhaseEndLabel}) & pause`
              : 'Keep full time & continue'}
          </Button>

          <Button
            variant="secondary"
            scale="md"
            disabled={isSubmitting}
            onClick={() => handleResolve('end_at_sleep')}
            className="w-full border border-slate-600/60 py-3 text-base hover:bg-slate-950"
          >
            <Clock className="h-4 w-4" />
            {`End session at ${sleepTimeLabel}`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
