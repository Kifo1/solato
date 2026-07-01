import { useEffect, useState } from 'react';
import { formatMillis } from '@shared/lib/utils';
import { PomodoroPhases } from './PomodoroPhases';
import { useSettings } from '@/features/settings/hooks/useSettings';

interface Props {
  millis: number;
  mode: 'stopwatch' | 'pomodoro';
  pomodoroPhase: number;
  isRunning: boolean;
}

export function TimerDisplay({ millis, mode, pomodoroPhase, isRunning }: Readonly<Props>) {
  const { settings } = useSettings();
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  useEffect(() => {
    const transitionTimeout = setTimeout(() => setTransitionsEnabled(true), 200);
    return () => clearTimeout(transitionTimeout);
  }, []);

  const ratio = mode === 'pomodoro' ? millis / getMaxMillisByPhase(pomodoroPhase) : 0;
  const R = 45;
  const CIRC = 2 * Math.PI * R;

  function getMaxMillisByPhase(phase: number) {
    if (!settings) return 25 * 60 * 1000;

    switch (phase) {
      case 0:
      case 2:
        return settings.focus_duration * 60 * 1000;
      case 1:
        return settings.short_break * 60 * 1000;
      case 3:
        return settings.long_break * 60 * 1000;
      default:
        return settings.focus_duration * 60 * 1000;
    }
  }

  return (
    <div className="relative grid h-100 w-100 grid-rows-[2fr_1fr]">
      <div className="mt-auto mb-10 flex flex-col justify-center text-center">
        <span className="font-mono text-6xl font-bold text-white tabular-nums">
          {formatMillis(millis)}
        </span>
        <span className="text-lg font-semibold text-gray-500 uppercase">{mode}</span>
      </div>
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute z-0 max-h-100 transform">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="dark:text-surface-highlight text-slate-700"
        />
        <circle
          className={`dark:text-primary text-blue-500 ${
            transitionsEnabled ? 'transition-all duration-700 ease-in-out' : ''
          }`}
          cx="50%"
          cy="50%"
          transform={'rotate(-90 50 50)'}
          fill="transparent"
          r="45"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.25"
          strokeDasharray={
            mode === 'stopwatch'
              ? '71 70 71 70'
              : (() => {
                  const visible = CIRC * ratio;
                  const gap = Math.max(0, CIRC - visible);
                  return `${visible} ${gap}`;
                })()
          }
          strokeDashoffset={(() => {
            if (mode === 'stopwatch') return isRunning ? '0' : '70';
            const visible = CIRC * ratio;
            const gap = Math.max(0, CIRC - visible);
            const offset = gap / 2;
            return `${-offset}`;
          })()}
        ></circle>
      </svg>
      {mode === 'pomodoro' && <PomodoroPhases currentPhase={pomodoroPhase} />}
    </div>
  );
}
