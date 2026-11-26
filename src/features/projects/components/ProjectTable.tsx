import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Folder, Project } from '@/shared/lib/models/project';
import { cn, formatSecondsToString, getErrorMessage } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock3,
  FolderOpen,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FolderSelect } from './FolderSelect';
import { UpdateProjectModal } from './UpdateProjectModal';

export type ProjectTableEmptyVariant = 'all' | 'folder' | 'unassigned' | 'search';

interface ProjectTableEntryProps {
  project: Project;
  folders: Folder[];
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onEdit: () => void;
  onActionError: (message: string) => void;
  onActionSuccess: () => void;
}

function ProjectTableEntry({
  project,
  folders,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onEdit,
  onActionError,
  onActionSuccess,
}: Readonly<ProjectTableEntryProps>) {
  const queryClient = useQueryClient();

  const { data: totalSeconds, isLoading } = useQuery({
    queryKey: ['overall_project_time', project.id],
    queryFn: () => invoke<number>('get_overall_project_time', { projectId: project.id }),
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_project', { id }),
    onSuccess: () => {
      onActionSuccess();
      onCancelDelete();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
      queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] });
      queryClient.invalidateQueries({ queryKey: ['most_active_project_name'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err) => {
      onCancelDelete();
      onActionError(getErrorMessage(err, `Failed to delete "${project.name}".`));
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: (folderId: string | null) =>
      invoke('update_project_folder', { projectId: project.id, folderId }),
    onSuccess: () => {
      onActionSuccess();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
    },
    onError: (err) => {
      onActionError(getErrorMessage(err, `Failed to move "${project.name}".`));
    },
  });

  return (
    <tr className="group border-b border-white/[0.05] transition-colors last:border-b-0 hover:bg-white/[0.025]">
      <td className="py-3.5 pr-3 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#F4F5F7]" title={project.name}>
              {project.name}
            </p>
            <p
              className="mt-0.5 truncate text-xs text-[#9CA3B0]"
              title={project.description}
            >
              {project.description}
            </p>
          </div>
        </div>
      </td>

      <td className="w-[172px] px-3 py-3.5">
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

      <td className="w-[108px] px-3 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-[#F4F5F7]">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#646C7A]" />
          {isLoading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="font-mono text-xs font-medium text-[#D1D5DE] tabular-nums sm:text-sm">
              {formatSecondsToString(totalSeconds || 0)}
            </span>
          )}
        </div>
      </td>

      <td className="w-[144px] py-3.5 pr-5 pl-2 whitespace-nowrap">
        {isConfirmingDelete ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(project.id)}
              aria-label={`Confirm delete ${project.name}`}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/25 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {deleteMutation.isPending ? '...' : 'Delete'}
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={onCancelDelete}
              aria-label={`Cancel delete ${project.name}`}
              className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-[#9CA3B0] transition-colors hover:bg-white/[0.06] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              aria-label={`Edit project ${project.name}`}
              title="Edit project"
              onClick={onEdit}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-white/[0.07] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Delete project ${project.name}`}
              title="Delete project"
              onClick={onRequestDelete}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3B0] transition-colors hover:bg-rose-500/15 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

interface ProjectTableProps {
  projects: Project[];
  folders: Folder[];
  filterKey?: string;
  emptyVariant?: ProjectTableEmptyVariant;
  searchQuery?: string;
  onClearSearch?: () => void;
  onAddProject?: () => void;
}

export function ProjectTable({
  projects,
  folders,
  filterKey = 'all',
  emptyVariant = 'folder',
  searchQuery = '',
  onClearSearch,
  onAddProject,
}: Readonly<ProjectTableProps>) {
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const projectsPerPage = 8;
  const maxPage = Math.max(1, Math.ceil(projects.length / projectsPerPage));

  useEffect(() => {
    setPage(1);
    setConfirmDeleteId(null);
  }, [filterKey]);

  useEffect(() => {
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, maxPage]);

  if (projects.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center">
        {emptyVariant === 'search' ? (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#9CA3B0]">
              <SearchX className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#F4F5F7]">No matching projects</p>
              <p className="max-w-xs text-xs text-[#9CA3B0]">
                No projects match <span className="text-[#F4F5F7]">&ldquo;{searchQuery}&rdquo;</span> in this view.
              </p>
            </div>
            {onClearSearch && (
              <Button variant="secondary" scale="sm" onClick={onClearSearch} className="mt-1">
                Clear search
              </Button>
            )}
          </>
        ) : emptyVariant === 'unassigned' ? (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-400">
              <CircleSlash className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#F4F5F7]">No unassigned projects</p>
              <p className="max-w-xs text-xs text-[#9CA3B0]">
                Every project is neatly organized inside a folder.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#F4F5F7]">
                {emptyVariant === 'all' ? 'No projects yet' : 'This folder is empty'}
              </p>
              <p className="max-w-xs text-xs text-[#9CA3B0]">
                {emptyVariant === 'all'
                  ? 'Create a project to start tracking focused work sessions.'
                  : 'Add a project here or assign an existing one using the folder selector.'}
              </p>
            </div>
            {onAddProject && (
              <Button variant="primary" scale="sm" onClick={onAddProject} className="mt-1">
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  const startIdx = (page - 1) * projectsPerPage;
  const visibleProjects = projects.slice(startIdx, startIdx + projectsPerPage);
  const endIdx = Math.min(startIdx + projectsPerPage, projects.length);

  return (
    <>
      <div className="surface-card overflow-hidden rounded-2xl">
        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-rose-500/25 bg-rose-500/10 px-5 py-2.5 text-xs text-rose-300"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setActionError(null)}
              className="cursor-pointer rounded p-0.5 text-rose-300/80 transition-colors hover:bg-rose-500/15 hover:text-rose-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                <th className="py-3 pr-3 pl-5 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                  Project
                </th>
                <th className="w-[172px] px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                  Folder
                </th>
                <th className="w-[108px] px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                  Total Time
                </th>
                <th className="w-[144px] py-3 pr-5 pl-2 text-right text-[11px] font-semibold tracking-wider text-[#646C7A] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <ProjectTableEntry
                  key={project.id}
                  project={project}
                  folders={folders}
                  isConfirmingDelete={confirmDeleteId === project.id}
                  onRequestDelete={() => {
                    setActionError(null);
                    setConfirmDeleteId(project.id);
                  }}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onEdit={() => {
                    setActionError(null);
                    setConfirmDeleteId(null);
                    setEditingProject(project);
                  }}
                  onActionError={(msg) => setActionError(msg)}
                  onActionSuccess={() => setActionError(null)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
          <p className="text-xs text-[#9CA3B0]">
            Showing{' '}
            <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">
              {startIdx + 1}–{endIdx}
            </span>{' '}
            of{' '}
            <span className="font-mono font-medium text-[#F4F5F7] tabular-nums">
              {projects.length}
            </span>{' '}
            {projects.length === 1 ? 'project' : 'projects'}
          </p>

          {maxPage > 1 && (
            <div className="flex items-center gap-2">
              <span className="mr-1 font-mono text-xs text-[#646C7A] tabular-nums">
                Page {page} / {maxPage}
              </span>
              <Button
                variant="secondary"
                scale="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(page === 1 && 'opacity-40')}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="secondary"
                scale="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                className={cn(page >= maxPage && 'opacity-40')}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {editingProject && (
        <UpdateProjectModal
          project={editingProject}
          isModalOpen={Boolean(editingProject)}
          setIsModalOpen={(open) => {
            if (!open) setEditingProject(null);
          }}
        />
      )}
    </>
  );
}
