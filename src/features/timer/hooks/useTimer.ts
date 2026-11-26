import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import phaseChangeSound from '@assets/pomodoro-phase-change.mp3';
import { Project } from '@shared/lib/models/project';
import { getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PresenceState, usePresence } from '@shared/hooks/usePresence';

export type TimerMode = 'stopwatch' | 'pomodoro';

export const TIMER_SYNC_EVENT = 'solato:timer-state-changed';

export interface TimerSyncDetail {
  project?: Project | null;
}

export function emitTimerStateChanged(detail?: TimerSyncDetail) {
  window.dispatchEvent(new CustomEvent<TimerSyncDetail | undefined>(TIMER_SYNC_EVENT, { detail }));
}

type PhaseDurations = {
  focus: number;
  short: number;
  long: number;
};

type Subscriber = {
  tick: (n: number) => void;
  phase: (n: number) => void;
  running: (isRunning: boolean) => void;
};

const SESSION_RELATED_QUERY_KEYS = [
  ['timer_projects'],
  ['sessions'],
  ['analytics'],
  ['overall_project_time'],
  ['todays_overall_time'],
  ['most_active_project_name'],
] as const;

let moduleListenersRegistered = false;
const subscribers = new Set<Subscriber>();
const sharedAudio = new Audio(phaseChangeSound);
let lastSharedSoundTime = 0;

function getPhaseDurationMillis(phase: number, durations: PhaseDurations): number {
  switch (phase) {
    case 0:
    case 2:
      return durations.focus * 60 * 1000;
    case 1:
      return durations.short * 60 * 1000;
    case 3:
      return durations.long * 60 * 1000;
    default:
      return durations.focus * 60 * 1000;
  }
}

async function ensureModuleListeners() {
  if (moduleListenersRegistered) return;
  moduleListenersRegistered = true;

  await listen<number>('timer-tick', (event) => {
    subscribers.forEach((s) => s.tick(event.payload));
  });

  await listen<number>('pomodoro-phase', (event) => {
    subscribers.forEach((s) => s.phase(event.payload));
  });

  await listen<boolean>('timer-running-changed', (event) => {
    subscribers.forEach((s) => s.running(event.payload));
  });

  await listen('pomodoro-phase-sound', () => {
    const now = Date.now();
    if (now - lastSharedSoundTime > 1000) {
      lastSharedSoundTime = now;
      sharedAudio.currentTime = 0;
      sharedAudio.play().catch((e) => console.error('Audio error:', e));
    }
  });
}

export function useTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const { updatePresence } = usePresence();

  const [stopwatchMillis, setStopwatchMillis] = useState(0);
  const [pomodoroMillis, setPomodoroMillis] = useState(
    (settings?.focus_duration || 25) * 60 * 1000,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [pomodoroPhase, setPomodoroPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const modeRef = useRef<TimerMode>(mode);
  const isRunningRef = useRef(isRunning);
  const pomodoroPhaseRef = useRef(pomodoroPhase);
  const prevDurationsRef = useRef<PhaseDurations | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    pomodoroPhaseRef.current = pomodoroPhase;
  }, [pomodoroPhase]);

  const invalidateSessionQueries = useCallback(() => {
    for (const queryKey of SESSION_RELATED_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  }, [queryClient]);

  const syncWithBackend = useCallback(async () => {
    try {
      const [bIsRunning, bMode, sMillis, pMillis, phase, project] = await Promise.all([
        invoke<boolean>('is_timer_running'),
        invoke<TimerMode>('get_timer_mode'),
        invoke<number>('get_stopwatch_millis'),
        invoke<number>('get_pomodoro_millis'),
        invoke<number>('get_pomodoro_phase'),
        invoke<Project | null>('get_selected_project'),
      ]);

      isRunningRef.current = bIsRunning;
      modeRef.current = bMode;
      pomodoroPhaseRef.current = phase;

      setIsRunning(bIsRunning);
      setMode(bMode);
      setStopwatchMillis(sMillis);
      setPomodoroMillis(pMillis);
      setPomodoroPhase(phase);
      setSelectedProject(project);
    } catch (err) {
      console.error('Backend Sync Error:', err);
      setError(getErrorMessage(err, 'Failed to sync timer state.'));
    }
  }, []);

  useEffect(() => {
    void syncWithBackend();
  }, [syncWithBackend]);

  useEffect(() => {
    const handleExternalSync = (event: Event) => {
      const custom = event as CustomEvent<TimerSyncDetail | undefined>;
      if (custom.detail && 'project' in custom.detail) {
        setSelectedProject(custom.detail.project ?? null);
      }
      void syncWithBackend();
    };

    window.addEventListener(TIMER_SYNC_EVENT, handleExternalSync);
    return () => window.removeEventListener(TIMER_SYNC_EVENT, handleExternalSync);
  }, [syncWithBackend]);

  useEffect(() => {
    const localSubscriber: Subscriber = {
      tick: (n: number) => {
        if (modeRef.current === 'stopwatch') {
          setStopwatchMillis(n);
        } else {
          setPomodoroMillis(n);
        }
      },
      phase: (n: number) => {
        pomodoroPhaseRef.current = n;
        setPomodoroPhase(n);
        invalidateSessionQueries();
      },
      running: (running: boolean) => {
        const wasRunning = isRunningRef.current;
        isRunningRef.current = running;
        setIsRunning(running);
        if (!running && wasRunning) {
          invalidateSessionQueries();
        }
      },
    };

    subscribers.add(localSubscriber);
    ensureModuleListeners().catch((err) => {
      console.error('Failed to register timer listeners:', err);
    });

    return () => {
      subscribers.delete(localSubscriber);
    };
  }, [invalidateSessionQueries]);

  useEffect(() => {
    if (!settings) return;

    const nextDurations: PhaseDurations = {
      focus: settings.focus_duration,
      short: settings.short_break,
      long: settings.long_break,
    };

    const prevDurations = prevDurationsRef.current;
    prevDurationsRef.current = nextDurations;

    // On initial settings hydration, preserve the backend-synced pomodoroMillis.
    if (!prevDurations) return;

    const settingsChanged =
      prevDurations.focus !== nextDurations.focus ||
      prevDurations.short !== nextDurations.short ||
      prevDurations.long !== nextDurations.long;

    if (!settingsChanged || isRunningRef.current) return;

    const phase = pomodoroPhaseRef.current;
    const prevPhaseDuration = getPhaseDurationMillis(phase, prevDurations);
    const nextPhaseDuration = getPhaseDurationMillis(phase, nextDurations);

    if (prevPhaseDuration !== nextPhaseDuration) {
      setPomodoroMillis(nextPhaseDuration);
    }
  }, [settings?.focus_duration, settings?.short_break, settings?.long_break]);

  const start = useCallback(async () => {
    setError(null);
    try {
      await invoke('start_timer');
      isRunningRef.current = true;
      setIsRunning(true);
      await updatePresence(PresenceState.Working);
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
    } catch (err) {
      console.error('Failed to start timer:', err);
      setError(getErrorMessage(err, 'Failed to start timer.'));
    }
  }, [queryClient, updatePresence]);

  const stop = useCallback(async () => {
    setError(null);
    try {
      await invoke('stop_timer');
      isRunningRef.current = false;
      setIsRunning(false);
      await updatePresence(PresenceState.Idle);
      invalidateSessionQueries();
    } catch (err) {
      console.error('Failed to stop timer:', err);
      setError(getErrorMessage(err, 'Failed to stop timer.'));
    }
  }, [invalidateSessionQueries, updatePresence]);

  const reset = useCallback(async () => {
    setError(null);
    try {
      await invoke('reset_timer');
      const [running, phase] = await Promise.all([
        invoke<boolean>('is_timer_running'),
        invoke<number>('get_pomodoro_phase'),
      ]);

      isRunningRef.current = running;
      pomodoroPhaseRef.current = phase;
      setIsRunning(running);
      setPomodoroPhase(phase);

      if (modeRef.current === 'stopwatch') {
        const sMillis = await invoke<number>('get_stopwatch_millis');
        setStopwatchMillis(sMillis);
      } else {
        const pMillis = await invoke<number>('get_pomodoro_millis');
        setPomodoroMillis(pMillis);
      }

      await updatePresence(running ? PresenceState.Working : PresenceState.Idle);
      invalidateSessionQueries();
    } catch (err) {
      console.error('Failed to reset timer:', err);
      setError(getErrorMessage(err, 'Failed to reset timer.'));
    }
  }, [invalidateSessionQueries, updatePresence]);

  const switchMode = useCallback(
    async (newMode: TimerMode) => {
      if (newMode === modeRef.current) return;

      setError(null);
      try {
        if (isRunningRef.current) {
          await stop();
        }
        modeRef.current = newMode;
        setMode(newMode);
        await invoke('switch_timer_mode', { timerMode: newMode });

        if (newMode === 'pomodoro') {
          const [pMillis, phase] = await Promise.all([
            invoke<number>('get_pomodoro_millis'),
            invoke<number>('get_pomodoro_phase'),
          ]);
          pomodoroPhaseRef.current = phase;
          setPomodoroPhase(phase);
          setPomodoroMillis(pMillis);
        } else {
          const sMillis = await invoke<number>('get_stopwatch_millis');
          setStopwatchMillis(sMillis);
        }
      } catch (err) {
        console.error('Failed to switch timer mode:', err);
        setError(getErrorMessage(err, 'Failed to switch timer mode.'));
      }
    },
    [stop],
  );

  const switchSelectedProject = useCallback(
    async (project: Project | null) => {
      setError(null);
      const previousProject = selectedProject;
      setSelectedProject(project);
      try {
        await invoke('set_selected_project', { project });
        queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
        if (isRunningRef.current) {
          await updatePresence(PresenceState.Working);
        }
      } catch (err) {
        console.error('Failed to update selected project:', err);
        setSelectedProject(previousProject);
        setError(getErrorMessage(err, 'Failed to change project.'));
      }
    },
    [queryClient, selectedProject, updatePresence],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    stopwatchMillis,
    pomodoroMillis,
    isRunning,
    mode,
    pomodoroPhase,
    selectedProject,
    error,
    clearError,
    start,
    stop,
    reset,
    switchMode,
    switchSelectedProject,
  };
}
