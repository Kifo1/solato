import { Project } from "@/shared/components/layout/ProjectsPage";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useAnalytics } from "../hooks/useAnalytics";
import { Check, ChevronDown, Folder, Layers, X } from "lucide-react";

export default function AnalyticScopeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedProjects, setSelectedProjects } = useAnalytics();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => invoke<Project[]>("get_projects"),
  });

  function getProjectPreview() {
    const selectedProjectLength = selectedProjects.length;
    if (selectedProjectLength === 0) {
      return (
        <>
          <Folder className="w-4 h-4 text-blue-400" />
          <span className="text-slate-400">Select Project</span>
        </>
      );
    } else if (selectedProjectLength === 1) {
      const currentProject = selectedProjects[0];
      return (
        <>
          <div
            className="w-3 h-3 rounded-full shrink-0"
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

  function toggleProject(project: Project) {
    if (isProjectSelected(project)) {
      setSelectedProjects(selectedProjects.filter((p) => p.id !== project.id));
    } else {
      setSelectedProjects([...selectedProjects, project]);
    }
  }

  function isProjectSelected(project: Project) {
    return selectedProjects.some((p) => p.id === project.id);
  }

  return (
    <div className="relative w-70">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white hover:border-blue-500 transition-all shadow-lg hover:cursor-pointer"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {getProjectPreview()}
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
                  toggleProject(project);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-700/50 text-white transition-colors border-b border-slate-700/50 last:border-0 hover:cursor-pointer"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
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

      {isOpen && (
        <button
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
