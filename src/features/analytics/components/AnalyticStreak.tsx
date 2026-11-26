import { Skeleton } from '@/shared/components/Skeleton';
import { cn } from '@shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Flame } from 'lucide-react';

interface StreakData {
  current_streak: number;
  active_today: boolean;
}

export default function AnalyticStreak() {
  const { data: streakData, isLoading } = useQuery({
    queryKey: ['analytics', 'streak'],
    queryFn: () => invoke<StreakData>('get_analytics_streak'),
  });

  if (isLoading) {
    return (
      <div className="surface-card flex h-full flex-col justify-between rounded-2xl p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="my-6 flex flex-col items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
      </div>
    );
  }

  const streak = streakData?.current_streak ?? 0;
  const activeToday = streakData?.active_today ?? false;

  return (
    <div className="surface-card flex h-full flex-col justify-between rounded-2xl p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-fg">Focus Streak</h3>
        <p className="mt-1 text-xs text-fg-muted">Consecutive days with focus time</p>
      </div>

      <div className="my-6 flex flex-1 flex-col items-center justify-center text-center">
        <div
          className={cn(
            'relative flex h-15 w-15 items-center justify-center rounded-2xl border transition-all duration-300',
            activeToday
              ? 'border-amber-400/35 bg-amber-500/15 shadow-[0_0_28px_-4px_var(--accent-glow)]'
              : 'border-line bg-tint-subtle',
          )}
        >
          <Flame
            className={cn(
              'h-8 w-8 transition-colors',
              activeToday
                ? 'fill-amber-400 text-amber-400'
                : 'fill-[#252A34] text-fg-muted',
            )}
          />
        </div>

        <div className="mt-4 flex items-baseline justify-center gap-2">
          <span
            className={cn(
              'font-mono text-5xl font-semibold tracking-tight tabular-nums',
              activeToday ? 'text-fg' : 'text-fg-secondary',
            )}
          >
            {streak}
          </span>
          <span className="text-sm font-medium text-fg-muted">
            {streak === 1 ? 'day' : 'days'}
          </span>
        </div>

        <div className="mt-4">
          {activeToday ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/12 px-3 py-1 text-xs font-medium text-teal-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Active today
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-tint-subtle px-3 py-1 text-xs font-medium text-fg-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-fg-muted" />
              Start a session to keep streak
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
