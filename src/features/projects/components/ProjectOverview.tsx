import Button from '@/shared/components/Button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { Project } from '@/shared/components/layout/ProjectsPage';
import { ProjectTable } from './ProjectTable';
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { formatSecondsToString } from '@/shared/lib/utils';

interface OverallInfoComponentProps {
  title: string;
  value: string;
}

function OverallInfoComponent({ title, value }: Readonly<OverallInfoComponentProps>) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-blue-200 uppercase lg:text-sm">{title}</span>
      <span className="text-2xl font-bold text-white lg:text-3xl">{value}</span>
    </div>
  );
}

interface ProjectOverviewProps {
  projects: Project[];
}

export function ProjectOverview({ projects }: Readonly<ProjectOverviewProps>) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: todaysTotalSeconds, isLoading } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: 10000,
  });

  const { data: mostActiveProjectName, isLoading: nameIsLoading } = useQuery({
    queryKey: ['most_active_project_name'],
    queryFn: () => invoke<string>('get_most_active_project_name'),
    refetchInterval: 10000,
  });

  return (
    <div className="mt-15 flex flex-col gap-10">
      <div className="flex gap-10 rounded-2xl border border-slate-200/10 bg-slate-200/5 p-5">
        <OverallInfoComponent title="Total projects" value={projects.length.toString()} />
        <div className="h-auto w-px bg-slate-200/10"></div>
        <OverallInfoComponent
          title="Time tracked today"
          value={isLoading ? 'Loading...' : formatSecondsToString(todaysTotalSeconds || 0)}
        />
        <div className="h-auto w-px bg-slate-200/10"></div>
        <OverallInfoComponent
          title="Most active"
          value={nameIsLoading ? 'Loading...' : mostActiveProjectName || ''}
        />
        <Button onClick={() => setIsModalOpen(true)} className="ml-auto rounded-md font-medium">
          <Plus className="hidden lg:inline" />
          Add Project
        </Button>
      </div>
      <div>
        <ProjectTable projects={projects} />
      </div>
      {isModalOpen && (
        <CreateProjectModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
      )}
    </div>
  );
}
