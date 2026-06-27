import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

interface StreakData {
  current_streak: number;
  active_today: boolean;
}

export default function AnalyticStreak() {
  const { data: streakData } = useQuery({
    queryKey: ["analytics", "streak"],
    queryFn: () => invoke<StreakData>("get_analytics_streak"),
  });

  return (
    <div>
      <p
        className={`${streakData?.active_today ? "text-green-500" : "text-gray-500"}`}
      >
        {streakData?.current_streak}
      </p>
    </div>
  );
}
