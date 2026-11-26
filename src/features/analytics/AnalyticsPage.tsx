import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { History } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '@shared/lib/models/project';
import Button from '@shared/components/Button.tsx';
import { Skeleton } from '@shared/components/Skeleton.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import AnalyticScopeSelector from '@features/analytics/components/AnalyticScopeSelector.tsx';
import AnalyticStreak from '@features/analytics/components/AnalyticStreak.tsx';
import AnalyticProjectPie from '@features/analytics/components/AnalyticProjectPie.tsx';
import AnalyticWeekdayBars from '@features/analytics/components/AnalyticWeekdayBars.tsx';
import AnalyticHourlyBars from '@features/analytics/components/AnalyticHourlyBars.tsx';
import { AnalyticCalendar } from '@features/analytics/components/AnalyticCalendar.tsx';
import { SessionHistoryModal } from '@features/sessions/components/SessionHistoryModal.tsx';

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        <div className="surface-card flex h-72 flex-col justify-between rounded-2xl p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-col items-center gap-3 py-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        </div>
        <div className="surface-card flex h-72 flex-col justify-between rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[0, 1].map((idx) => (
          <div key={idx} className="surface-card h-80 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-7 w-28 rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-52 w-full rounded-xl" />
          </div>
        ))}
      </div>

      <div className="surface-card h-64 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <Skeleton className="mt-6 h-36 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [sessionFilterDate, setSessionFilterDate] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const userHasProjects = projects.length > 0;

  const openSessionHistory = (dateKey: string | null = null) => {
    setSessionFilterDate(dateKey);
    setIsSessionsModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-7 sm:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F4F5F7] sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1.5 text-sm text-[#9CA3B0]">
            Insights and focus patterns across your projects.
          </p>
        </div>

        {!isLoading && userHasProjects && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              scale="md"
              onClick={() => openSessionHistory(null)}
              title="View and edit past sessions"
            >
              <History className="h-4 w-4 text-amber-400" />
              <span>Sessions</span>
            </Button>
            <AnalyticScopeSelector />
          </div>
        )}
      </header>

      {isLoading ? (
        <AnalyticsLoadingSkeleton />
      ) : userHasProjects ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
            <AnalyticStreak />
            <AnalyticProjectPie />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <AnalyticWeekdayBars />
            <AnalyticHourlyBars />
          </div>

          <AnalyticCalendar onSelectDay={(dateKey) => openSessionHistory(dateKey)} />
        </div>
      ) : (
        <FirstProjectTutorial />
      )}

      <SessionHistoryModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
        projects={projects}
        initialDate={sessionFilterDate}
      />
    </div>
  );
}
