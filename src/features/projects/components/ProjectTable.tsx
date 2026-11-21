import Button from '@/shared/components/Button';
import { Folder, Project } from '@/shared/lib/models/project';
import { formatSecondsToString } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FolderSelect } from './FolderSelect';
import { UpdateProjectModal } from './UpdateProjectModal';

interface ProjectTableEntryProps {
  project: Project;
  folders: Folder[];
}

function ProjectTableEntry({ project, folders }: Readonly<ProjectTableEntryProps>) {
  const queryClient = useQueryClient();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const { data: totalSeconds, isLoading } = useQuery({
    queryKey: ['overall_project_time', project.id],
    queryFn: () => invoke<number>('get_overall_project_time', { projectId: project.id }),
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_project', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: (folderId: string | null) =>
      invoke('update_project_folder', { projectId: project.id, folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteMutation.mutate(project.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUpdateModalOpen(true);
  };

  return (
    <tr className="group border-b border-slate-200/5 last:border-b-0">
      <td className="px-2 py-4 whitespace-nowrap md:px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <div>
            <p className="text-sm font-semibold text-white">{project.name}</p>
            <p className="text-xs text-blue-200">{project.description}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-4 whitespace-nowrap md:px-6">
        <FolderSelect
          folders={folders}
          value={project.folder_id ?? null}
          onChange={(folderId) => moveFolderMutation.mutate(folderId)}
          disabled={moveFolderMutation.isPending}
          emptyLabel="No folder"
          variant="inline"
          ariaLabel={`Folder for ${project.name}`}
        />
      </td>
      <td className="px-2 py-4 whitespace-nowrap md:px-6">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-white" />
          <span className="text-sm font-medium text-blue-200">
            {isLoading ? (
              <span className="animate-pulse opacity-50">Loading...</span>
            ) : (
              formatSecondsToString(totalSeconds || 0)
            )}
          </span>
        </div>
      </td>
      <td className="px-2 py-4 whitespace-nowrap md:px-6">
        <div className="flex items-center justify-end gap-5 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil
            className="h-4 w-4 rounded-lg text-blue-200 hover:cursor-pointer hover:text-white"
            onClick={handleEdit}
          />
          <Trash2
            className={`h-4 w-4 text-blue-200 hover:cursor-pointer hover:text-red-500 ${deleteMutation.isPending ? 'opacity-50' : ''}`}
            onClick={handleDelete}
          />
        </div>
      </td>
      {isUpdateModalOpen && (
        <UpdateProjectModal
          project={project}
          isModalOpen={isUpdateModalOpen}
          setIsModalOpen={setIsUpdateModalOpen}
        />
      )}
    </tr>
  );
}

interface ProjectTableProps {
  projects: Project[];
  folders: Folder[];
  filterKey?: string;
  onAddProject?: () => void;
}

export function ProjectTable({
  projects,
  folders,
  filterKey = 'all',
  onAddProject,
}: Readonly<ProjectTableProps>) {
  const [page, setPage] = useState(1);
  const projectsPerPage = 7;

  const maxPage = Math.max(1, Math.ceil(projects.length / projectsPerPage));

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, maxPage]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200/10 bg-slate-200/5 px-6 py-12 text-center">
        <p className="text-sm text-blue-200">No projects in this folder yet.</p>
        {onAddProject && (
          <Button onClick={onAddProject} className="rounded-md font-medium">
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        )}
      </div>
    );
  }

  const startIdx = (page - 1) * projectsPerPage;
  const visibleProjects = projects.slice(startIdx, startIdx + projectsPerPage);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/10 bg-slate-200/5">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/10 bg-slate-200/5">
              <th className="w-2/5 px-2 py-4 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6">
                Project name
              </th>
              <th className="w-1/4 px-2 py-4 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6">
                Folder
              </th>
              <th className="w-1/5 px-2 py-4 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6">
                Total time
              </th>
              <th className="px-2 py-4 text-right text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.map((project) => (
              <ProjectTableEntry key={project.id} project={project} folders={folders} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between overflow-hidden border-t border-slate-200/10 bg-slate-200/5 px-6 py-4">
        <div className="text-sm text-blue-200">
          <span>Showing </span>
          <span className="font-medium text-white">
            {startIdx + 1}-{Math.min(startIdx + projectsPerPage, projects.length)}
          </span>
          <span> of </span>
          <span className="font-medium text-white">{projects.length}</span>
          <span> projects</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={'secondary'}
            className="rounded-xl border border-white/20"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant={'secondary'}
            className="rounded-xl border border-white/20"
            disabled={page >= maxPage}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
