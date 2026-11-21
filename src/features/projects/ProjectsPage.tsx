import { ProjectOverview } from '@features/projects/components/ProjectOverview.tsx';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial.tsx';
import { Folder, Project } from '@/shared/lib/models/project';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export type { Folder, Project };

export default function ProjectsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

  if (projectsLoading || foldersLoading) return <div className="text-white">Loading...</div>;

  const hasContent = projects.length > 0 || folders.length > 0;

  return (
    <div>
      <h1 className="text-5xl font-bold text-white">Manage Projects</h1>
      <p className="pt-3 text-blue-200">Organize and track your time.</p>

      {hasContent ? (
        <ProjectOverview projects={projects} folders={folders} />
      ) : (
        <FirstProjectTutorial />
      )}
    </div>
  );
}
