import { Hourglass, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';

type TimerMode = 'stopwatch' | 'pomodoro';

interface Props {
  currentMode: TimerMode;
  onSwitch: (mode: TimerMode) => void | Promise<void>;
}

const MODES: ReadonlyArray<{ id: TimerMode; label: string; Icon: typeof TimerIcon }> = [
  { id: 'stopwatch', label: 'Stopwatch', Icon: TimerIcon },
  { id: 'pomodoro', label: 'Pomodoro', Icon: Hourglass },
];

export function ModeSwitcher({ currentMode, onSwitch }: Readonly<Props>) {
  return (
    <div
      role="tablist"
      aria-label="Timer mode"
      className="surface-well inline-flex w-fit items-center gap-1 rounded-full p-1"
    >
      {MODES.map(({ id, label, Icon }) => {
        const isActive = currentMode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) {
                onSwitch(id);
              }
            }}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E] focus-visible:outline-none',
              isActive
                ? 'border border-white/[0.08] bg-[#1E232D] text-[#F4F5F7] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_4px_12px_-4px_rgba(0,0,0,0.65)]'
                : 'border border-transparent text-[#9CA3B0] hover:bg-white/[0.03] hover:text-[#F4F5F7]',
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 transition-colors duration-200',
                isActive ? 'text-amber-400' : 'text-[#646C7A]',
              )}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
