import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Project } from '@features/projects/ProjectsPage.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import AnalyticScopeSelector from '@features/analytics/components/AnalyticScopeSelector.tsx';
import AnalyticStreak from '@features/analytics/components/AnalyticStreak.tsx';
import AnalyticProjectPie from '@features/analytics/components/AnalyticProjectPie.tsx';
import AnalyticWeekdayBars from '@features/analytics/components/AnalyticWeekdayBars.tsx';
import AnalyticHourlyBars from '@features/analytics/components/AnalyticHourlyBars.tsx';
import { AnalyticCalendar } from '@features/analytics/components/AnalyticCalendar.tsx';
import { SessionHistoryModal } from '@features/sessions/components/SessionHistoryModal.tsx';

export default function AnalyticsPage() {
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [sessionFilterDate, setSessionFilterDate] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  if (isLoading) return <div className="text-white">Loading...</div>;

  const userHasProjects = projects.length > 0;

  const openSessionHistory = (dateKey: string | null = null) => {
    setSessionFilterDate(dateKey);
    setIsSessionsModalOpen(true);
  };

  return (
    <div>
      <div className="flex flex-row">
        <div>
          <h1 className="text-5xl font-bold text-white">Analyze Projects</h1>
          <p className="pt-3 text-blue-200">See insides and statistics for your projects.</p>
        </div>
        <div className="ml-auto flex items-start gap-3">
          {userHasProjects && (
            <>
              <button
                type="button"
                onClick={() => openSessionHistory(null)}
                title="View and edit past sessions"
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm font-medium text-blue-100 shadow-lg transition-all hover:cursor-pointer hover:border-blue-500 hover:text-white"
              >
                <History className="h-4 w-4 text-blue-400" />
                <span>Sessions</span>
              </button>
              <AnalyticScopeSelector />
            </>
          )}
        </div>
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
            <AnalyticCalendar onSelectDay={(dateKey) => openSessionHistory(dateKey)} />
          </div>
        ) : (
          <FirstProjectTutorial />
        )}
      </div>

      <SessionHistoryModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
        projects={projects}
        initialDate={sessionFilterDate}
      />
    </div>
  );
}
