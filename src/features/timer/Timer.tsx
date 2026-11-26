import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, X } from 'lucide-react';
import { cn, formatSecondsToString } from '@shared/lib/utils';
import { useTimer } from './hooks/useTimer';
import { TimerDisplay } from './components/TimerDisplay';
import { ModeSwitcher } from './components/ModeSwitcher';
import { TimerControls } from './components/TimerControls';
import { TimerProjectDropdown } from './components/TimerProject';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function getAmbientGlowStyle(mode: 'stopwatch' | 'pomodoro', pomodoroPhase: number): string {
  if (mode === 'pomodoro' && pomodoroPhase === 1) {
    return 'radial-gradient(circle, rgba(45, 212, 191, 0.15) 0%, rgba(45, 212, 191, 0.04) 44%, transparent 72%)';
  }
  if (mode === 'pomodoro' && pomodoroPhase === 3) {
    return 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0.04) 44%, transparent 72%)';
  }
  return 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.04) 44%, transparent 72%)';
}

export default function Timer() {
  const {
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
  } = useTimer();

  const { data: todaysOverallSeconds } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: isRunning ? 30_000 : false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (isRunning) {
          void stop();
        } else {
          void start();
        }
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        void reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, start, stop, reset]);

  const todaysLabel = formatSecondsToString(todaysOverallSeconds ?? 0);

  return (
    <div className="flex h-full min-h-full w-full flex-col items-center justify-between px-6 py-5 sm:py-7">
      {/* Balanced top studio bar */}
      <header className="grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Left: Today's Focus summary pill */}
        <div className="justify-self-start">
          <div
            title="Total focused time recorded today"
            className="surface-well inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs whitespace-nowrap select-none"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-300',
                isRunning
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.75)]'
                  : 'bg-[#646C7A]/70',
              )}
            />
            <span className="text-[#9CA3B0]">Today</span>
            <span className="text-white/15">·</span>
            <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">{todaysLabel}</span>
          </div>
        </div>

        {/* Center: Mode switcher */}
        <div className="justify-self-center">
          <ModeSwitcher currentMode={mode} onSwitch={switchMode} />
        </div>

        {/* Right: Subtle keyboard shortcuts hint */}
        <div className="justify-self-end">
          <div
            aria-label="Keyboard shortcuts: Space to start or pause, R to reset"
            className="surface-well hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap text-[#646C7A] select-none sm:inline-flex"
          >
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#9CA3B0]">
                Space
              </kbd>
              <span>{isRunning ? 'Pause' : 'Start'}</span>
            </span>
            <span className="text-white/15">·</span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#9CA3B0]">
                R
              </kbd>
              <span>Reset</span>
            </span>
          </div>
        </div>
      </header>

      {/* Centerpiece chronometer dial with subtle phase-matched ambient light */}
      <div className="relative my-2 flex items-center justify-center">
        <div
          aria-hidden="true"
          style={{ background: getAmbientGlowStyle(mode, pomodoroPhase) }}
          className={cn(
            'pointer-events-none absolute -inset-12 rounded-full transition-opacity duration-700',
            isRunning ? 'animate-solar-breath opacity-95' : 'opacity-25',
          )}
        />
        <div className="relative h-[min(360px,48vh)] min-h-[270px] w-[min(360px,48vh)] min-w-[270px]">
          <TimerDisplay
            millis={mode === 'stopwatch' ? stopwatchMillis : pomodoroMillis}
            mode={mode}
            pomodoroPhase={pomodoroPhase}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Bottom studio controls & project selector */}
      <div className="flex w-full flex-col items-center gap-3.5">
        {error && (
          <div
            role="alert"
            className="flex max-w-md items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span className="truncate">{error}</span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss timer error"
              className="ml-1 cursor-pointer rounded p-0.5 text-rose-300/75 transition-colors hover:bg-rose-500/15 hover:text-rose-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <TimerControls
          isRunning={isRunning}
          mode={mode}
          pomodoroPhase={pomodoroPhase}
          onStartStop={isRunning ? stop : start}
          onReset={reset}
        />

        <TimerProjectDropdown
          currentProject={selectedProject}
          switchCurrentProject={switchSelectedProject}
        />
      </div>
    </div>
  );
}
