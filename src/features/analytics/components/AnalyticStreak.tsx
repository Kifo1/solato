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

  return (
    <div className="flex">
      <Flame
        size={60}
        color={streakData?.active_today ? 'orange' : 'gray'}
        fill={streakData?.active_today ? 'orange' : '#1d293d'}
      />
      <p
        className={`align-bottom text-6xl font-semibold ${streakData?.active_today ? 'text-orange-400' : 'text-gray-500'}`}
      >
        {streakData?.current_streak}
      </p>
    </div>
  );
}
