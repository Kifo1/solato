import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

interface CalendarData {
  history: { [key: string]: number };
}

export default function AnalyticStreak() {
  const { data: calendarData } = useQuery({
    queryKey: ["analytics", "calendar"],
    queryFn: () => invoke<CalendarData>("get_analytics_calendar"),
  });
  <div>
    <p>{}</p>
  </div>;
}
