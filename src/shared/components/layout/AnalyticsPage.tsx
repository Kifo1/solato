import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Project } from './ProjectsPage';
import FirstProjectTutorial from '@/features/projects/components/FirstProjectTutorial';
import AnalyticScopeSelector from '@/features/analytics/components/AnalyticScopeSelector';
import AnalyticStreak from '@/features/analytics/components/AnalyticStreak';
import { AnalyticCalendar } from '@/features/analytics/components/AnalyticCalendar';

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
        <div className="ml-auto">
          <AnalyticScopeSelector />
        </div>
      </div>
      <div>
        {userHasProjects ? (
          <div className="flex flex-col gap-5">
            <div className="mt-15 flex items-center justify-between rounded-2xl border border-slate-200/10 bg-slate-200/5 p-6">
              <div className="flex flex-1 items-center justify-center">
                <AnalyticStreak />
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
