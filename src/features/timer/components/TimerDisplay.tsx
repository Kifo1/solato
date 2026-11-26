import { useEffect, useId, useState } from 'react';
import { format } from 'date-fns';
import { cn, formatMillisParts } from '@shared/lib/utils';
import { PomodoroPhases } from './PomodoroPhases';
import { useSettings } from '@/features/settings/hooks/useSettings';

interface Props {
  millis: number;
  mode: 'stopwatch' | 'pomodoro';
  pomodoroPhase: number;
  isRunning: boolean;
}

interface DialTick {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isQuarter: boolean;
  isFiveMin: boolean;
}

const DIAL_RADIUS = 45;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const DIAL_TICKS: ReadonlyArray<DialTick> = Array.from({ length: 60 }, (_, index) => {
  const angleRad = ((index * 6 - 90) * Math.PI) / 180;
  const isQuarter = index % 15 === 0;
  const isFiveMin = index % 5 === 0;
  const outerR = 41.2;
  const innerR = isQuarter ? 38.4 : isFiveMin ? 39.1 : 40.0;

  return {
    index,
    x1: Number((50 + innerR * Math.cos(angleRad)).toFixed(3)),
    y1: Number((50 + innerR * Math.sin(angleRad)).toFixed(3)),
    x2: Number((50 + outerR * Math.cos(angleRad)).toFixed(3)),
    y2: Number((50 + outerR * Math.sin(angleRad)).toFixed(3)),
    isQuarter,
    isFiveMin,
  };
});

import { useTheme, type ThemeDefinition } from '@shared/context/ThemeContext';

interface PhasePalette {
  gradStart: string;
  gradMid: string;
  gradEnd: string;
  halo: string;
  dotClass: string;
}

function getPhasePalette(
  mode: 'stopwatch' | 'pomodoro',
  pomodoroPhase: number,
  svg: ThemeDefinition['svg'],
): PhasePalette {
  if (mode === 'pomodoro' && pomodoroPhase === 1) {
    return {
      gradStart: '#99F6E4',
      gradMid: '#2DD4BF',
      gradEnd: '#0D9488',
      halo: '#2DD4BF',
      dotClass: 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.7)]',
    };
  }

  if (mode === 'pomodoro' && pomodoroPhase === 3) {
    return {
      gradStart: '#BAE6FD',
      gradMid: '#38BDF8',
      gradEnd: '#0284C7',
      halo: '#38BDF8',
      dotClass: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]',
    };
  }

  return {
    gradStart: svg.arcStart,
    gradMid: svg.arcMid,
    gradEnd: svg.arcEnd,
    halo: svg.arcGlow,
    dotClass: 'bg-amber-400 solar-glow',
  };
}

export function TimerDisplay({ millis, mode, pomodoroPhase, isRunning }: Readonly<Props>) {
  const { settings } = useSettings();
  const { theme } = useTheme();
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  const uid = useId();
  const faceGradId = `timer-face-${uid}`;
  const arcGradId = `timer-arc-${uid}`;
  const glowFilterId = `timer-glow-${uid}`;

  useEffect(() => {
    const transitionTimeout = setTimeout(() => setTransitionsEnabled(true), 200);
    return () => clearTimeout(transitionTimeout);
  }, []);

  function getMaxMillisByPhase(phase: number): number {
    const focus = settings?.focus_duration ?? 25;
    const shortBreak = settings?.short_break ?? 5;
    const longBreak = settings?.long_break ?? 15;

    switch (phase) {
      case 0:
      case 2:
        return focus * 60 * 1000;
      case 1:
        return shortBreak * 60 * 1000;
      case 3:
        return longBreak * 60 * 1000;
      default:
        return focus * 60 * 1000;
    }
  }

  const maxMillis = getMaxMillisByPhase(pomodoroPhase);
  const rawRatio = mode === 'pomodoro' && maxMillis > 0 ? millis / maxMillis : 0;
  const ratio = Math.min(1, Math.max(0, rawRatio));

  const visibleArc = DIAL_CIRCUMFERENCE * ratio;
  const gapArc = Math.max(0, DIAL_CIRCUMFERENCE - visibleArc);
  const strokeDasharray = mode === 'stopwatch' ? '71 70 71 70' : `${visibleArc} ${gapArc}`;
  const strokeDashoffset = mode === 'stopwatch' ? (isRunning ? '0' : '70') : `${-(gapArc / 2)}`;
  const showActiveArc = mode === 'stopwatch' || ratio > 0;

  const palette = getPhasePalette(mode, pomodoroPhase, theme.svg);
  const { main, tenths } = formatMillisParts(millis);
  const isOverAnHour = millis >= 60 * 60 * 1000;

  const arcTransitionClass = !transitionsEnabled
    ? ''
    : mode === 'stopwatch'
      ? 'transition-all duration-700 ease-in-out'
      : isRunning
        ? 'transition-[stroke-dasharray,stroke-dashoffset,opacity] duration-150 ease-linear'
        : 'transition-all duration-500 ease-out';

  const statusText =
    mode === 'stopwatch'
      ? isRunning
        ? 'Running'
        : 'Stopwatch'
      : isRunning
        ? 'In Session'
        : 'Pomodoro';

  const stopwatchSubLabel = isRunning
    ? 'Session active'
    : millis > 0
      ? 'Session paused'
      : 'Ready to focus';

  const endsAtLabel =
    mode === 'pomodoro' && isRunning && millis > 0
      ? format(new Date(Math.round((Date.now() + millis) / 5000) * 5000), 'HH:mm')
      : null;

  return (
    <div className="relative flex h-full w-full items-center justify-center select-none">
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <radialGradient id={faceGradId} cx="50%" cy="28%" r="74%">
            <stop offset="0%" stopColor={theme.svg.dialFaceTop} />
            <stop offset="100%" stopColor={theme.svg.dialFaceBottom} />
          </radialGradient>

          <linearGradient id={arcGradId} x1="12%" y1="8%" x2="88%" y2="92%">
            <stop offset="0%" stopColor={palette.gradStart} />
            <stop offset="52%" stopColor={palette.gradMid} />
            <stop offset="100%" stopColor={palette.gradEnd} />
          </linearGradient>

          <filter id={glowFilterId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="1.65" />
          </filter>
        </defs>

        {/* Subtle recessed studio dial plate */}
        <circle
          cx="50"
          cy="50"
          r="42.4"
          fill={`url(#${faceGradId})`}
          stroke={theme.svg.dialBorder}
          strokeWidth="0.35"
        />

        {/* 60 horological precision micro-ticks */}
        <g>
          {DIAL_TICKS.map((tick) => (
            <line
              key={tick.index}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={
                tick.isQuarter
                  ? theme.svg.tickQuarter
                  : tick.isFiveMin
                    ? theme.svg.tickFive
                    : theme.svg.tickMinute
              }
              strokeWidth={tick.isQuarter ? '0.52' : tick.isFiveMin ? '0.42' : '0.3'}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Base orbital track */}
        <circle
          cx="50"
          cy="50"
          r={DIAL_RADIUS}
          fill="none"
          stroke={theme.svg.dialTrack}
          strokeWidth="2.0"
        />

        {/* Soft halo glow behind active arc when running */}
        <circle
          cx="50"
          cy="50"
          r={DIAL_RADIUS}
          transform="rotate(-90 50 50)"
          fill="transparent"
          stroke={palette.halo}
          strokeLinecap="round"
          strokeWidth="3.6"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          filter={`url(#${glowFilterId})`}
          opacity={showActiveArc ? (isRunning ? (theme.mode === 'light' ? 0.28 : 0.48) : 0.1) : 0}
          className={arcTransitionClass}
        />

        {/* Signature opposing quarter-arcs (Stopwatch) / radial countdown ring (Pomodoro) */}
        <circle
          cx="50"
          cy="50"
          r={DIAL_RADIUS}
          transform="rotate(-90 50 50)"
          fill="transparent"
          stroke={`url(#${arcGradId})`}
          strokeLinecap="round"
          strokeWidth="2.4"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          opacity={showActiveArc ? 1 : 0}
          className={arcTransitionClass}
        />
      </svg>

      {/* Upper micro-status inside dial */}
      <div className="pointer-events-none absolute top-[17.5%] z-10 flex items-center gap-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-all duration-300',
            isRunning ? palette.dotClass : 'bg-fg-muted/60',
          )}
        />
        <span className="text-[10px] font-semibold tracking-[0.22em] text-fg-muted uppercase">
          {statusText}
        </span>
      </div>

      {/* Primary tabular chronometer readout + subtle Pomodoro finish clock time */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6">
        <div role="timer" aria-live="off" className="flex items-baseline justify-center">
          <span
            className={cn(
              'font-mono leading-none font-semibold tracking-[-0.03em] text-fg tabular-nums transition-[font-size] duration-200',
              isOverAnHour
                ? 'text-[clamp(1.85rem,4.6vh,2.6rem)]'
                : 'text-[clamp(2.55rem,6.3vh,3.55rem)]',
            )}
          >
            {main}
          </span>
          <span
            className={cn(
              'ml-0.5 font-mono leading-none font-medium text-fg-muted tabular-nums',
              isOverAnHour
                ? 'text-[clamp(0.95rem,2.2vh,1.3rem)]'
                : 'text-[clamp(1.25rem,2.8vh,1.65rem)]',
            )}
          >
            .{tenths}
          </span>
        </div>

        {endsAtLabel && (
          <p className="mt-2 font-mono text-[11px] font-medium tracking-wide text-fg-secondary tabular-nums">
            Ends at <span className="text-fg-bright">{endsAtLabel}</span>
          </p>
        )}
      </div>

      {/* Lower phase / session indicator inside dial */}
      <div className="absolute bottom-[14.5%] z-10 flex flex-col items-center">
        {mode === 'pomodoro' ? (
          <PomodoroPhases currentPhase={pomodoroPhase} isRunning={isRunning} />
        ) : (
          <span className="text-[11px] font-medium tracking-wide text-fg-muted">
            {stopwatchSubLabel}
          </span>
        )}
      </div>
    </div>
  );
}
