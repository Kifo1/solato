import { Project } from '@features/projects/ProjectsPage.tsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { Check, ChevronDown, Folder, Layers, X } from 'lucide-react';

export default function AnalyticScopeSelector() {
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const { selectedProjects, setSelectedProjects } = useAnalytics();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  function getProjectPreview() {
    const selectedProjectLength = selectedProjects.length;
    if (selectedProjectLength === 0) {
      return (
        <>
          <Folder className="h-4 w-4 text-blue-400" />
          <span className="text-slate-400">Select Project</span>
        </>
      );
    } else if (selectedProjectLength === 1) {
      const currentProject = selectedProjects[0];
      return (
        <>
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: currentProject.color }}
          />
          <span className="truncate">{currentProject.name}</span>
        </>
      );
    } else {
      return (
        <>
          <Layers color="#3b82f6" />
          <span className="text-white">{selectedProjectLength} Selected</span>
        </>
      );
    }
  }

  async function toggleProject(project: Project) {
    const isSelected = isProjectSelected(project);
    const nextProjects = isSelected
      ? selectedProjects.filter((p) => p.id !== project.id)
      : [...selectedProjects, project];

    setSelectedProjects(nextProjects);

    await invoke('update_selected_projects', {
      projectIds: nextProjects.map((p) => p.id),
    });

    await queryClient.invalidateQueries({
      queryKey: ['analytics'],
    });
  }

  function isProjectSelected(project: Project) {
    return selectedProjects.some((p) => p.id === project.id);
  }

  return (
    <div className="relative w-70">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white shadow-lg transition-all hover:cursor-pointer hover:border-blue-500"
      >
        <div className="flex items-center gap-3 overflow-hidden">{getProjectPreview()}</div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="animate-in fade-in zoom-in absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl duration-150">
          <div className="max-h-60 overflow-y-auto">
            {projects.length === 0 && !isLoading && (
              <div className="px-4 py-3 text-sm text-slate-500 italic">No projects found...</div>
            )}

            {projects.map((project) => (
              <button
                key={project.id}
                onClick={async () => {
                  await toggleProject(project);
                }}
                className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-3 text-left text-white transition-colors last:border-0 hover:cursor-pointer hover:bg-slate-700/50"
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="text-sm font-medium">{project.name}</span>
                {isProjectSelected(project) ? (
                  <Check className="ml-auto" />
                ) : (
                  <X className="ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && <button className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
