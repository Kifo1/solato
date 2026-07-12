import Button from '@/shared/components/Button';
import { Project } from '@features/projects/ProjectsPage.tsx';
import { formatSecondsToString } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Clock3, Pencil, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

interface ProjectTableEntryProps {
  project: Project;
}

function ProjectTableEntry({ project }: Readonly<ProjectTableEntryProps>) {
  const queryClient = useQueryClient();

  const { data: totalSeconds, isLoading } = useQuery({
    queryKey: ['overall_project_time', project.id],
    queryFn: () => invoke<number>('get_overall_project_time', { projectId: project.id }),
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return invoke('delete_project', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
  };

  return (
    <tr className="group">
      <td className="grid- px-2 py-2 pt-6 pb-6 whitespace-nowrap md:px-6 md:py-5">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 w-2 rounded-full" style={{ backgroundColor: project.color }}></div>
          <div>
            <p className="text-sm font-semibold text-white">{project.name}</p>
            <p className="text-xs text-blue-200">{project.description}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 pt-6 pb-6 whitespace-nowrap md:px-6 md:py-5">
        <div
          className="h-6 w-6 rounded-full md:w-15"
          style={{ backgroundColor: project.color }}
        ></div>
      </td>
      <td className="px-2 py-2 pt-6 pb-6 whitespace-nowrap md:px-6 md:py-5">
        <div className="flex items-center gap-2">
          <Clock3 color="white"></Clock3>
          <span className="text-sm font-medium text-blue-200">
            {isLoading ? (
              <span className="animate-pulse opacity-50">Loading...</span>
            ) : (
              formatSecondsToString(totalSeconds || 0)
            )}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 pt-6 pb-6 whitespace-nowrap md:px-6 md:py-5">
        <div className="flex items-center justify-end gap-5 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil
            className="rounded-lg text-blue-200 hover:cursor-pointer hover:text-white"
            onClick={handleEdit}
          ></Pencil>
          <Trash2
            className={`text-blue-200 hover:cursor-pointer hover:text-red-700 ${deleteMutation.isPending ? 'opacity-50' : ''}`}
            onClick={handleDelete}
          />
        </div>
      </td>
    </tr>
  );
}

interface ProjectTableProps {
  projects: Project[];
}

export function ProjectTable({ projects }: Readonly<ProjectTableProps>) {
  const [page, setPage] = useState(1);
  const projectsPerPage = 5;

  function maxPageNumber(projectAmount: number) {
    return Math.ceil(projectAmount / projectsPerPage);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/10 bg-slate-200/5">
      <div>
        <table>
          <thead>
            <tr className="border-b border-slate-200/10 bg-slate-200/5">
              <th className="w-1/3 px-2 py-2 pt-6 pb-6 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6 md:py-4">
                Project name
              </th>
              <th className="w-1/3 px-2 py-2 pt-6 pb-6 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6 md:py-4">
                Color tag
              </th>
              <th className="w-1/3 px-2 py-2 pt-6 pb-6 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6 md:py-4">
                Total time
              </th>
              <th className="w-1/3 px-2 py-2 pt-6 pb-6 text-left text-xs font-semibold tracking-wider text-blue-200 uppercase md:px-6 md:py-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.slice((page - 1) * projectsPerPage, page * projectsPerPage).map((project) => (
              <ProjectTableEntry key={project.id} project={project} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between overflow-hidden border-t border-slate-200/10 bg-slate-200/5 px-6 py-4">
        <div className="text-sm text-blue-200">
          <span>Showing </span>
          <span className="font-medium text-white">
            {1 + (page - 1) * projectsPerPage}-{Math.min(page * projectsPerPage, projects.length)}
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
            disabled={page === maxPageNumber(projects.length)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
