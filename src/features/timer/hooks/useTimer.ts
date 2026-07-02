import { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import phaseChangeSound from '@assets/pomodoro-phase-change.mp3';
import { Project } from '@/shared/components/layout/ProjectsPage';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PresenceState, usePresence } from '@shared/hooks/usePresence';

type Subscriber = { tick: (n: number) => void; phase: (n: number) => void };
let moduleListenersRegistered = false;
const subscribers = new Set<Subscriber>();
const sharedAudio = new Audio(phaseChangeSound);
let lastSharedSoundTime = 0;

async function ensureModuleListeners() {
  if (moduleListenersRegistered) return;
  moduleListenersRegistered = true;

  await listen<number>('timer-tick', (event) => {
    subscribers.forEach((s) => s.tick(event.payload));
  });

  await listen<number>('pomodoro-phase', (event) => {
    subscribers.forEach((s) => s.phase(event.payload));
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
  const { settings } = useSettings();
  const { updatePresence } = usePresence();

  const [stopwatchMillis, setStopwatchMillis] = useState(0);
  const [pomodoroMillis, setPomodoroMillis] = useState(
    (settings?.focus_duration || 25) * 60 * 1000,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mode, setMode] = useState<'stopwatch' | 'pomodoro'>('stopwatch');
  const [pomodoroPhase, setPomodoroPhase] = useState(0);

  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        const [bIsRunning, bMode, sMillis, pMillis, phase, project] = await Promise.all([
          invoke<boolean>('is_timer_running'),
          invoke<'stopwatch' | 'pomodoro'>('get_timer_mode'),
          invoke<number>('get_stopwatch_millis'),
          invoke<number>('get_pomodoro_millis'),
          invoke<number>('get_pomodoro_phase'),
          invoke<Project | null>('get_selected_project'),
        ]);

        setIsRunning(bIsRunning);
        setMode(bMode);
        setStopwatchMillis(sMillis);
        setPomodoroMillis(pMillis);
        setPomodoroPhase(phase);
        setSelectedProject(project);
      } catch (err) {
        console.error('Backend Sync Error:', err);
      }
    };
    syncWithBackend();
  }, []);

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
        setPomodoroPhase(n);
        if (isRunning) {
          updatePresence(PresenceState.Working);
        }
      },
    };

    subscribers.add(localSubscriber);
    ensureModuleListeners();

    return () => {
      subscribers.delete(localSubscriber);
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (!isRunning && mode === 'pomodoro' && (pomodoroPhase === 0 || pomodoroPhase === 2)) {
      setPomodoroMillis(settings.focus_duration * 60 * 1000);
    }
  }, [settings?.focus_duration, mode, pomodoroPhase]);

  const start = async () => {
    await invoke('start_timer');
    await updatePresence(PresenceState.Working);
    setIsRunning(true);
  };

  const stop = async () => {
    await invoke('stop_timer');
    await updatePresence(PresenceState.Idle);
    setIsRunning(false);
  };

  const reset = async () => {
    await invoke('reset_timer');
    if (mode === 'stopwatch') {
      setStopwatchMillis(0);
    } else {
      const pMillis = await invoke<number>('get_pomodoro_millis');
      setPomodoroMillis(pMillis);
    }
    if (isRunning) {
      await updatePresence(PresenceState.Working);
    } else {
      await updatePresence(PresenceState.Idle);
    }
  };

  const switchMode = async (newMode: 'stopwatch' | 'pomodoro') => {
    await stop();
    setMode(newMode);
    await invoke('switch_timer_mode', { timerMode: newMode });

    const millis =
      newMode === 'pomodoro'
        ? await invoke<number>('get_pomodoro_millis')
        : await invoke<number>('get_stopwatch_millis');

    newMode === 'pomodoro' ? setPomodoroMillis(millis) : setStopwatchMillis(millis);
  };

  const switchSelectedProject = async (project: Project) => {
    setSelectedProject(project);
    await invoke('set_selected_project', { project });
    if (isRunning) {
      await updatePresence(PresenceState.Working);
    }
  };

  return {
    stopwatchMillis,
    pomodoroMillis,
    isRunning,
    mode,
    pomodoroPhase,
    selectedProject,
    start,
    stop,
    reset,
    switchMode,
    switchSelectedProject,
  };
}
