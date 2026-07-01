import { ProjectOverview } from '@/features/projects/components/ProjectOverview';
import FirstProjectTutorial from '@features/projects/components/FirstProjectTutorial';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
}

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  if (isLoading) return <div className="text-white">Loading...</div>;

  let userHasProjects = projects.length > 0;

  return (
    <div>
      <h1 className="text-5xl font-bold text-white">Manage Projects</h1>
      <p className="pt-3 text-blue-200">Organize and track your time.</p>

      {userHasProjects ? <ProjectOverview projects={projects} /> : <FirstProjectTutorial />}
    </div>
  );
}
