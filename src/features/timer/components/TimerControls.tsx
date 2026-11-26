import Button from '@shared/components/Button';
import { cn } from '@shared/lib/utils';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface Props {
  isRunning: boolean;
  mode?: 'stopwatch' | 'pomodoro';
  pomodoroPhase?: number;
  onStartStop: () => void;
  onReset: () => void;
}

export function TimerControls({
  isRunning,
  mode = 'stopwatch',
  pomodoroPhase = 0,
  onStartStop,
  onReset,
}: Readonly<Props>) {
  const idleLabel =
    mode === 'pomodoro'
      ? pomodoroPhase === 1 || pomodoroPhase === 3
        ? 'Start Break'
        : 'Start Focus'
      : 'Start Timer';

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={onStartStop}
        className={cn(
          'inline-flex h-11 min-w-[168px] cursor-pointer items-center justify-center gap-2.5 rounded-full px-6 text-sm font-semibold transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E] focus-visible:outline-none active:scale-[0.985]',
          isRunning
            ? 'border border-amber-500/35 bg-[#1C212B] text-amber-300 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_10px_24px_-10px_rgba(0,0,0,0.7)] hover:border-amber-400/50 hover:bg-[#232936]'
            : 'bg-amber-500 text-[#0A0B0E] shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_10px_24px_-8px_rgba(245,158,11,0.55)] hover:bg-amber-400',
        )}
      >
        {isRunning ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 translate-x-[0.5px] fill-current" />
        )}
        <span>{isRunning ? 'Pause' : idleLabel}</span>
      </button>

      <Button
        variant="secondary"
        scale="icon_md"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset timer (R)"
        className="group h-11 w-11 rounded-full p-0"
      >
        <RotateCcw className="h-4 w-4 text-[#9CA3B0] transition-transform duration-300 group-hover:-rotate-45 group-hover:text-[#F4F5F7]" />
      </Button>
    </div>
  );
}
