import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, Folder } from 'lucide-react';
import { useState } from 'react';
import { Project } from '@features/projects/ProjectsPage.tsx';

interface TimerProjectDropdownProps {
  currentProject: Project | null;
  switchCurrentProject: (project: Project) => void;
}

export function TimerProjectDropdown({
  currentProject,
  switchCurrentProject,
}: Readonly<TimerProjectDropdownProps>) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  return (
    <>
      <div className="relative w-70">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white shadow-lg transition-all hover:cursor-pointer hover:border-blue-500"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {currentProject ? (
              <>
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: currentProject.color }}
                />
                <span className="truncate">{currentProject.name}</span>
              </>
            ) : (
              <>
                <Folder className="h-4 w-4 text-blue-400" />
                <span className="text-slate-400">Select Project</span>
              </>
            )}
          </div>
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
                  onClick={() => {
                    switchCurrentProject(project);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-3 text-left text-white transition-colors last:border-0 hover:cursor-pointer hover:bg-slate-700/50"
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm font-medium">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isOpen && <button className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
      </div>
      <div>
        <p className="text-sm text-blue-200/75">
          Selecting a project tracks time automatically to your analytics.
        </p>
      </div>
    </>
  );
}
