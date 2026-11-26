import { ProjectOverview } from '@features/projects/components/ProjectOverview.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Folder, Project } from '@/shared/lib/models/project';
import { getErrorMessage } from '@/shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, RefreshCw } from 'lucide-react';

export type { Folder, Project };

function ProjectsSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-5" aria-busy="true" aria-label="Loading projects">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="surface-card flex items-start justify-between gap-3 rounded-2xl p-4"
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        ))}
      </div>

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
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 flex-1 rounded-xl" />
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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-7 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F4F5F7] sm:text-3xl">
          Projects
        </h1>
        <p className="text-sm text-[#9CA3B0]">
          Organize your workspaces, nested folders, and tracked focus time.
        </p>
      </header>

      {isLoading ? (
        <ProjectsSkeleton />
      ) : queryError ? (
        <div className="surface-card mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center">
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
