import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '@features/projects/ProjectsPage.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import AnalyticScopeSelector from '@features/analytics/components/AnalyticScopeSelector.tsx';
import AnalyticStreak from '@features/analytics/components/AnalyticStreak.tsx';
import AnalyticProjectPie from '@features/analytics/components/AnalyticProjectPie.tsx';
import AnalyticWeekdayBars from '@features/analytics/components/AnalyticWeekdayBars.tsx';
import AnalyticHourlyBars from '@features/analytics/components/AnalyticHourlyBars.tsx';
import { AnalyticCalendar } from '@features/analytics/components/AnalyticCalendar.tsx';

export default function AnalyticsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  if (isLoading) return <div className="text-white">Loading...</div>;

  let userHasProjects = projects.length > 0;

  return (
    <div>
      <div className="flex flex-row">
        <div>
          <h1 className="text-5xl font-bold text-white">Analyze Projects</h1>
          <p className="pt-3 text-blue-200">See insides and statistics for your projects.</p>
        </div>
        <div className="ml-auto">{userHasProjects && <AnalyticScopeSelector />}</div>
      </div>
      <div>
        {userHasProjects ? (
          <div className="flex flex-col gap-5">
            <div className="mt-15 flex items-stretch gap-5">
              <div className="flex-1">
                <AnalyticStreak />
              </div>
              <div className="flex-1">
                <AnalyticProjectPie />
              </div>
            </div>
            <div className="flex items-stretch gap-5">
              <div className="flex-1">
                <AnalyticWeekdayBars />
              </div>
              <div className="flex-1">
                <AnalyticHourlyBars />
              </div>
            </div>
            <AnalyticCalendar />
          </div>
        ) : (
          <FirstProjectTutorial />
        )}
      </div>
    </div>
  );
}
