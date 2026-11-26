import { cn } from '@shared/lib/utils';

interface Props {
  currentPhase: number;
  isRunning?: boolean;
}

type PhaseKind = 'focus' | 'short' | 'long';

const PHASES: ReadonlyArray<{
  index: number;
  label: string;
  title: string;
  kind: PhaseKind;
}> = [
  { index: 0, label: 'Focus · 1 of 2', title: 'Focus 1', kind: 'focus' },
  { index: 1, label: 'Short Break', title: 'Short Break', kind: 'short' },
  { index: 2, label: 'Focus · 2 of 2', title: 'Focus 2', kind: 'focus' },
  { index: 3, label: 'Long Break', title: 'Long Break', kind: 'long' },
];

function getActiveDotClasses(kind: PhaseKind): string {
  switch (kind) {
    case 'short':
      return 'w-6 bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.55)]';
    case 'long':
      return 'w-6 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.55)]';
    default:
      return 'w-6 bg-amber-400 shadow-[0_0_10px_var(--accent-glow)]';
  }
}

function getCompletedDotClasses(kind: PhaseKind): string {
  switch (kind) {
    case 'short':
      return 'w-2 bg-teal-400/45';
    case 'long':
      return 'w-2 bg-sky-400/45';
    default:
      return 'w-2 bg-amber-500/45';
  }
}

function getLabelPillClasses(kind: PhaseKind): string {
  switch (kind) {
    case 'short':
      return 'border-teal-400/20 bg-teal-400/10 text-teal-300';
    case 'long':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300';
    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }
}

export function PomodoroPhases({ currentPhase, isRunning = false }: Readonly<Props>) {
  const safePhase = Math.min(3, Math.max(0, currentPhase));
  const activePhase = PHASES[safePhase] ?? PHASES[0];

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <ul
        aria-label="Pomodoro phase progress"
        className="flex items-center justify-center gap-1.5"
      >
        {PHASES.map((phase) => {
          const isCurrent = phase.index === safePhase;
          const isCompleted = phase.index < safePhase;

          return (
            <li key={phase.index} title={phase.title} className="flex items-center">
              <span
                className={cn(
                  'inline-block h-1.5 rounded-full transition-all duration-300',
                  isCurrent
                    ? getActiveDotClasses(phase.kind)
                    : isCompleted
                      ? getCompletedDotClasses(phase.kind)
                      : 'w-2 bg-tint-strong',
                  isCurrent && isRunning && 'opacity-100',
                )}
              />
            </li>
          );
        })}
      </ul>

      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors duration-300',
          getLabelPillClasses(activePhase.kind),
        )}
      >
        {activePhase.label}
      </span>
    </div>
  );
}
