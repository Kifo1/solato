import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Flame } from 'lucide-react';

interface StreakData {
  current_streak: number;
  active_today: boolean;
}

export default function AnalyticStreak() {
  const { data: streakData } = useQuery({
    queryKey: ['analytics', 'streak'],
    queryFn: () => invoke<StreakData>('get_analytics_streak'),
  });

  const streak = streakData?.current_streak ?? 0;
  const activeToday = streakData?.active_today ?? false;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/10 bg-slate-200/5 p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-blue-200 uppercase">Streak</h3>
        <p className="mt-1 text-xs text-blue-200/70">
          {streak} consecutive day{streak === 1 ? '' : 's'} with focus time
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex">
          <Flame
            size={60}
            color={activeToday ? 'orange' : 'gray'}
            fill={activeToday ? 'orange' : '#1d293d'}
          />
          <p
            className={`align-bottom text-6xl font-semibold ${activeToday ? 'text-orange-400' : 'text-gray-500'}`}
          >
            {streak}
          </p>
        </div>
      </div>
    </div>
  );
}
