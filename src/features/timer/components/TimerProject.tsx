import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, Folder } from "lucide-react";
import { useState } from "react";
import { Project } from "@/shared/components/layout/ProjectsPage";

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
    queryKey: ["projects"],
    queryFn: () => invoke<Project[]>("get_projects"),
  });

  return (
    <>
      <div className="relative w-70">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white hover:border-blue-500 transition-all shadow-lg hover:cursor-pointer"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {currentProject ? (
              <>
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: currentProject.color }}
                />
                <span className="truncate">{currentProject.name}</span>
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">Select Project</span>
              </>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="max-h-60 overflow-y-auto">
              {projects.length === 0 && !isLoading && (
                <div className="px-4 py-3 text-sm text-slate-500 italic">
                  No projects found...
                </div>
              )}

              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    switchCurrentProject(project);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-700/50 text-white transition-colors border-b border-slate-700/50 last:border-0 hover:cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm font-medium">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isOpen && (
          <button
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
      <div>
        <p className="text-sm text-blue-200/75^">
          Selecting a project tracks time automatically to your analytics.
        </p>
      </div>
    </>
  );
}
