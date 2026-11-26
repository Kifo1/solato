import { ProjectOverview } from '@features/projects/components/ProjectOverview.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Folder, Project } from '@/shared/lib/models/project';
import { cn, formatSecondsToString, getErrorMessage } from '@/shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Clock, Flame, FolderKanban, RefreshCw } from 'lucide-react';

export type { Folder, Project };

function ProjectsSkeleton() {
  return (
    <div className="mt-5 flex flex-col gap-5" aria-busy="true" aria-label="Loading projects">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[248px_minmax(0,1fr)]">
        <div className="surface-card flex flex-col gap-2 rounded-2xl p-3">
          <div className="flex items-center justify-between px-1.5 pb-1">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="mt-1 h-8 w-5/6 rounded-xl" />
          <Skeleton className="h-8 w-4/5 rounded-xl" />
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-9.5 min-w-[200px] flex-1 rounded-xl" />
            <Skeleton className="h-9.5 w-36 rounded-xl" />
            <Skeleton className="h-9.5 w-18 rounded-xl" />
            <Skeleton className="h-9.5 w-28 rounded-xl" />
            <Skeleton className="h-9.5 w-28 rounded-xl" />
          </div>
          <div className="surface-card flex flex-col gap-3 rounded-2xl p-5">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-4">
                <Skeleton className="h-3 w-3 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-7.5 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const {
    data: folders = [],
    isLoading: foldersLoading,
    error: foldersError,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

  const isLoading = projectsLoading || foldersLoading;
  const queryError = projectsError ?? foldersError;
  const hasContent = projects.length > 0 || folders.length > 0;

  const { data: todaysTotalSeconds, isLoading: todaysTimeLoading } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: 10000,
    enabled: hasContent,
  });

  const { data: mostActiveProjectName, isLoading: mostActiveLoading } = useQuery({
    queryKey: ['most_active_project_name'],
    queryFn: () => invoke<string>('get_most_active_project_name'),
    refetchInterval: 10000,
    enabled: hasContent,
  });

  const trimmedMostActive = mostActiveProjectName?.trim();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6 sm:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#F4F5F7]">Projects</h1>
          <p className="mt-0.5 text-xs text-[#9CA3B0] sm:text-sm">
            Launch focus sessions, organize folders, and track deep work.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        ) : hasContent && !queryError ? (
          <div aria-label="Workspace momentum summary" className="flex flex-wrap items-center gap-2">
            <div
              title="Tracked focus time today across all projects"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#13161E]/90 px-3 text-xs shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="text-[#9CA3B0]">Today</span>
              <span className="text-[#646C7A]" aria-hidden="true">
                ·
              </span>
              {todaysTimeLoading ? (
                <Skeleton className="h-3.5 w-11 rounded" />
              ) : (
                <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">
                  {formatSecondsToString(todaysTotalSeconds || 0)}
                </span>
              )}
            </div>

            <div
              title={
                trimmedMostActive
                  ? `Most active project: ${trimmedMostActive}`
                  : 'Most active project: none recorded yet'
              }
              className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#13161E]/90 px-3 text-xs shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
            >
              <Flame className="h-3.5 w-3.5 shrink-0 text-teal-400" />
              <span className="shrink-0 text-[#9CA3B0]">Top</span>
              <span className="shrink-0 text-[#646C7A]" aria-hidden="true">
                ·
              </span>
              {mostActiveLoading ? (
                <Skeleton className="h-3.5 w-16 rounded" />
              ) : (
                <span
                  className={cn(
                    'truncate font-medium',
                    trimmedMostActive ? 'text-[#F4F5F7]' : 'text-[#646C7A]',
                  )}
                >
                  {trimmedMostActive || 'None yet'}
                </span>
              )}
            </div>

            <div
              title={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} across ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#13161E]/90 px-3 text-xs shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
            >
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">
                {projects.length}
              </span>
              <span className="text-[#9CA3B0]">
                {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <ProjectsSkeleton />
      ) : queryError ? (
        <div className="surface-card mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#F4F5F7]">Couldn&apos;t load your projects</p>
            <p className="max-w-md text-xs text-[#9CA3B0]">
              {getErrorMessage(queryError, 'An unexpected error occurred while reading local data.')}
            </p>
          </div>
          <Button
            variant="secondary"
            scale="sm"
            onClick={() => {
              void refetchProjects();
              void refetchFolders();
            }}
            className="mt-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      ) : hasContent ? (
        <ProjectOverview projects={projects} folders={folders} />
      ) : (
        <FirstProjectTutorial />
      )}
    </div>
  );
}
