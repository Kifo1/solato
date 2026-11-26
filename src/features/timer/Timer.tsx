import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Maximize2, Minimize2, X } from 'lucide-react';
import { useLayout } from '@shared/context/LayoutContext';
import { useToast } from '@shared/context/ToastContext';
import { cn, formatSecondsToString, getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTimer } from './hooks/useTimer';
import { TimerDisplay } from './components/TimerDisplay';
import { ModeSwitcher } from './components/ModeSwitcher';
import { TimerControls } from './components/TimerControls';
import { TimerProjectDropdown } from './components/TimerProject';
import { TodayTimelineDrawer } from './components/TodayTimelineDrawer';

interface PomodoroPreset {
  id: string;
  label: string;
  name: string;
  focus_duration: number;
  short_break: number;
  long_break: number;
}

const POMODORO_PRESETS: ReadonlyArray<PomodoroPreset> = [
  {
    id: 'classic',
    label: '25/5',
    name: 'Classic',
    focus_duration: 25,
    short_break: 5,
    long_break: 15,
  },
  {
    id: 'deep',
    label: '50/10',
    name: 'Deep Work',
    focus_duration: 50,
    short_break: 10,
    long_break: 20,
  },
  {
    id: 'sprint',
    label: '15/3',
    name: 'Quick Sprint',
    focus_duration: 15,
    short_break: 3,
    long_break: 10,
  },
  {
    id: 'flow',
    label: '60/10',
    name: 'Extended Flow',
    focus_duration: 60,
    short_break: 10,
    long_break: 25,
  },
];

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function getAmbientGlowStyle(mode: 'stopwatch' | 'pomodoro', pomodoroPhase: number): string {
  if (mode === 'pomodoro' && pomodoroPhase === 1) {
    return 'radial-gradient(circle, rgba(45, 212, 191, 0.16) 0%, rgba(45, 212, 191, 0.045) 44%, transparent 72%)';
  }
  if (mode === 'pomodoro' && pomodoroPhase === 3) {
    return 'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0.045) 44%, transparent 72%)';
  }
  return 'radial-gradient(circle, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.045) 44%, transparent 72%)';
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

  const { isZenMode, setZenMode, toggleZenMode, openCommandPalette } = useLayout();
  const { settings, updateSettings, isUpdating: isUpdatingSettings } = useSettings();
  const toast = useToast();

  const [isTodayDrawerOpen, setIsTodayDrawerOpen] = useState(false);

  const { data: todaysOverallSeconds } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: isRunning ? 30_000 : false,
  });

  const canReset = !(mode === 'stopwatch' && !isRunning && stopwatchMillis === 0);

  useEffect(() => {
    if (isZenMode) {
      setIsTodayDrawerOpen(false);
    }
  }, [isZenMode]);

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
        if (canReset) {
          void reset();
        }
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleZenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, canReset, start, stop, reset, toggleZenMode]);

  const handleApplyPreset = useCallback(
    async (preset: PomodoroPreset) => {
      if (!settings || isUpdatingSettings) return;
      const alreadyActive =
        settings.focus_duration === preset.focus_duration &&
        settings.short_break === preset.short_break &&
        settings.long_break === preset.long_break;
      if (alreadyActive) return;

      try {
        await updateSettings({
          ...settings,
          focus_duration: preset.focus_duration,
          short_break: preset.short_break,
          long_break: preset.long_break,
        });
        toast.info(`Pomodoro set to ${preset.name} (${preset.label})`);
      } catch (err) {
        toast.error(
          'Failed to update Pomodoro preset',
          getErrorMessage(err, 'Could not save rhythm settings.'),
        );
      }
    },
    [settings, isUpdatingSettings, updateSettings, toast],
  );

  const todaysLabel = formatSecondsToString(todaysOverallSeconds ?? 0);
  const showPomodoroPresets = mode === 'pomodoro' && !isRunning && !isZenMode;
  const showShortcutBar = (mode === 'stopwatch' || isRunning) && !isZenMode;

  return (
    <div
      className={cn(
        'relative flex h-full min-h-full w-full flex-col items-center px-6 py-5 sm:py-7',
        isZenMode ? 'justify-center gap-8' : 'justify-between',
      )}
    >
      {/* Zen Mode subtle top-right escape pill */}
      {isZenMode ? (
        <button
          type="button"
          onClick={() => setZenMode(false)}
          title="Exit Zen Focus Mode (Esc or F)"
          className="surface-well fixed top-5 right-6 z-20 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-medium text-[#9CA3B0] opacity-30 transition-all duration-200 select-none hover:border-white/[0.15] hover:text-[#F4F5F7] hover:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <Minimize2 className="h-3 w-3" />
          <span>Exit Zen</span>
          <span className="text-white/20">·</span>
          <span className="font-mono text-[10px] text-[#646C7A]">Esc</span>
        </button>
      ) : (
        /* Top Floating Studio Bar */
        <header className="grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Left: Active Project Selector */}
          <div className="min-w-0 justify-self-start">
            <TimerProjectDropdown
              variant="compact"
              currentProject={selectedProject}
              switchCurrentProject={switchSelectedProject}
            />
          </div>

          {/* Center: Mode Switcher */}
          <div className="justify-self-center">
            <ModeSwitcher currentMode={mode} onSwitch={switchMode} />
          </div>

          {/* Right: Today's Momentum Pill + Zen Mode Toggle */}
          <div className="flex items-center gap-2 justify-self-end">
            <button
              type="button"
              onClick={() => setIsTodayDrawerOpen(true)}
              title="View today's completed sessions"
              aria-label={`Today's focus time: ${todaysLabel}. Open today's sessions`}
              className="surface-well group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-xs whitespace-nowrap transition-all duration-150 select-none hover:border-white/[0.14] hover:bg-[#151922] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E] focus-visible:outline-none"
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors duration-300',
                  isRunning
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.75)]'
                    : 'bg-[#646C7A]/70 group-hover:bg-amber-400/80',
                )}
              />
              <span className="text-[#9CA3B0] transition-colors group-hover:text-[#D6DAE2]">
                Today
              </span>
              <span className="text-white/15">·</span>
              <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">
                {todaysLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleZenMode}
              title="Zen Focus Mode (F)"
              aria-label="Zen Focus Mode"
              aria-pressed={isZenMode}
              className="surface-well inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#9CA3B0] transition-all duration-150 select-none hover:border-white/[0.14] hover:bg-[#151922] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E] focus-visible:outline-none"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Centerpiece Hero Chronometer Dial */}
      <div className="relative my-2 flex items-center justify-center">
        <div
          aria-hidden="true"
          style={{ background: getAmbientGlowStyle(mode, pomodoroPhase) }}
          className={cn(
            'pointer-events-none absolute -inset-12 rounded-full transition-opacity duration-700',
            isRunning ? 'animate-solar-breath opacity-95' : 'opacity-25',
          )}
        />
        <div
          className={cn(
            'relative transition-[width,height] duration-300 ease-out',
            isZenMode
              ? 'h-[min(420px,56vh)] min-h-[290px] w-[min(420px,56vh)] min-w-[290px]'
              : 'h-[min(368px,49vh)] min-h-[270px] w-[min(368px,49vh)] min-w-[270px]',
          )}
        >
          <TimerDisplay
            millis={mode === 'stopwatch' ? stopwatchMillis : pomodoroMillis}
            mode={mode}
            pomodoroPhase={pomodoroPhase}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Bottom Tactile Action Dock + Presets / Whisper Shortcut Bar */}
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
          canReset={canReset}
          onStartStop={isRunning ? stop : start}
          onReset={reset}
        />

        {/* Contextual sub-dock: Quick Rhythm Presets OR whisper-quiet shortcut bar */}
        {!isZenMode && (
          <div className="flex min-h-[32px] items-center justify-center">
            {showPomodoroPresets ? (
              <div
                role="group"
                aria-label="Quick Pomodoro presets"
                className="surface-well inline-flex items-center gap-1 rounded-full p-1 select-none"
              >
                {POMODORO_PRESETS.map((preset) => {
                  const isActive =
                    settings?.focus_duration === preset.focus_duration &&
                    settings?.short_break === preset.short_break;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={!settings || isUpdatingSettings}
                      onClick={() => void handleApplyPreset(preset)}
                      title={`${preset.name} — ${preset.focus_duration}m focus · ${preset.short_break}m short break · ${preset.long_break}m long break`}
                      aria-pressed={isActive}
                      className={cn(
                        'cursor-pointer rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        isActive
                          ? 'border border-amber-500/30 bg-amber-500/15 text-amber-300 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                          : 'border border-transparent text-[#858E9E] hover:bg-white/[0.04] hover:text-[#F4F5F7]',
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            ) : showShortcutBar ? (
              <div
                aria-label="Keyboard shortcuts"
                className="hidden items-center gap-2.5 text-[11px] text-[#525A68] select-none sm:inline-flex"
              >
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[#7A8292]">
                    Space
                  </kbd>
                  <span>{isRunning ? 'Pause' : 'Start'}</span>
                </span>
                <span aria-hidden="true" className="text-white/10">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[#7A8292]">
                    R
                  </kbd>
                  <span>Reset</span>
                </span>
                <span aria-hidden="true" className="text-white/10">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[#7A8292]">
                    F
                  </kbd>
                  <span>Zen</span>
                </span>
                <span aria-hidden="true" className="text-white/10">
                  ·
                </span>
                <button
                  type="button"
                  onClick={openCommandPalette}
                  className="inline-flex cursor-pointer items-center gap-1 rounded transition-colors hover:text-[#9CA3B0] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                >
                  <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[#7A8292]">
                    ⌘K
                  </kbd>
                  <span>Command</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Today's Sessions Slide-Over Drawer */}
      <TodayTimelineDrawer
        isOpen={isTodayDrawerOpen}
        onClose={() => setIsTodayDrawerOpen(false)}
      />
    </div>
  );
}
