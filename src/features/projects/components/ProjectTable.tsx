import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { useToast } from '@shared/context/ToastContext';
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
  Play,
  Plus,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderSelect } from './FolderSelect';
import { UpdateProjectModal } from './UpdateProjectModal';

export type ProjectTableEmptyVariant = 'all' | 'folder' | 'unassigned' | 'search';
export type ProjectViewMode = 'list' | 'grid';

interface ProjectItemProps {
  project: Project;
  folders: Folder[];
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onEdit: () => void;
  onActionError: (message: string) => void;
  onActionSuccess: () => void;
}

function useProjectItemController({
  project,
  folders,
  onCancelDelete,
  onActionError,
  onActionSuccess,
}: Pick<
  ProjectItemProps,
  'project' | 'folders' | 'onCancelDelete' | 'onActionError' | 'onActionSuccess'
>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: totalSeconds, isLoading: isTimeLoading } = useQuery({
    queryKey: ['overall_project_time', project.id],
    queryFn: () => invoke<number>('get_overall_project_time', { projectId: project.id }),
    refetchInterval: 10000,
  });

  const focusMutation = useMutation({
    mutationFn: () => invoke('set_selected_project', { project }),
    onSuccess: () => {
      onActionSuccess();
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      toast.success(`Ready to focus on ${project.name}`);
      navigate('/timer');
    },
    onError: (err) => {
      const msg = getErrorMessage(err, `Failed to start focus on "${project.name}".`);
      toast.error('Could not launch focus', msg);
      onActionError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_project', { id }),
    onSuccess: () => {
      onActionSuccess();
      onCancelDelete();
      toast.success('Project deleted', project.name);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
      queryClient.invalidateQueries({ queryKey: ['todays_overall_time'] });
      queryClient.invalidateQueries({ queryKey: ['most_active_project_name'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, `Failed to delete "${project.name}".`);
      onCancelDelete();
      toast.error('Failed to delete project', msg);
      onActionError(msg);
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: (folderId: string | null) =>
      invoke('update_project_folder', { projectId: project.id, folderId }),
    onSuccess: (_data, folderId) => {
      onActionSuccess();
      const targetFolder = folderId ? folders.find((f) => f.id === folderId) : null;
      if (targetFolder) {
        toast.success(`Moved to ${targetFolder.name}`, project.name);
      } else {
        toast.info('Removed from folder', project.name);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, `Failed to move "${project.name}".`);
      toast.error('Failed to move project', msg);
      onActionError(msg);
    },
  });

  return {
    totalSeconds,
    isTimeLoading,
    focusMutation,
    deleteMutation,
    moveFolderMutation,
  };
}

function ProjectListRow({
  project,
  folders,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onEdit,
  onActionError,
  onActionSuccess,
}: Readonly<ProjectItemProps>) {
  const { totalSeconds, isTimeLoading, focusMutation, deleteMutation, moveFolderMutation } =
    useProjectItemController({
      project,
      folders,
      onCancelDelete,
      onActionError,
      onActionSuccess,
    });

  return (
    <tr className="group border-b border-line-subtle transition-colors last:border-b-0 hover:bg-tint-subtle">
      <td className="py-3.5 pr-3 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-line"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg" title={project.name}>
              {project.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-fg-secondary" title={project.description}>
              {project.description}
            </p>
          </div>
        </div>
      </td>

      <td className="w-[168px] px-3 py-3.5">
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

      <td className="w-[104px] px-3 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-fg">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
          {isTimeLoading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="font-mono text-xs font-medium text-fg-bright tabular-nums sm:text-sm">
              {formatSecondsToString(totalSeconds || 0)}
            </span>
          )}
        </div>
      </td>

      <td className="w-[188px] py-3.5 pr-5 pl-2 whitespace-nowrap">
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
              className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              disabled={focusMutation.isPending}
              aria-label={`Focus on ${project.name}`}
              title={`Launch focus timer for ${project.name}`}
              onClick={() => focusMutation.mutate()}
              className="mr-1 inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-tint-subtle px-2.5 text-xs font-medium text-fg-bright transition-all group-hover:border-amber-500/25 group-hover:text-fg hover:!border-amber-500/45 hover:!bg-amber-500/15 hover:!text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none active:scale-[0.97] disabled:opacity-50"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Focus</span>
            </button>

            <div className="flex items-center gap-0.5 opacity-65 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                aria-label={`Edit project ${project.name}`}
                title="Edit project"
                onClick={onEdit}
                className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete project ${project.name}`}
                title="Delete project"
                onClick={onRequestDelete}
                className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-rose-500/15 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function ProjectGridCard({
  project,
  folders,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onEdit,
  onActionError,
  onActionSuccess,
}: Readonly<ProjectItemProps>) {
  const { totalSeconds, isTimeLoading, focusMutation, deleteMutation, moveFolderMutation } =
    useProjectItemController({
      project,
      folders,
      onCancelDelete,
      onActionError,
      onActionSuccess,
    });

  return (
    <article className="surface-card group flex flex-col overflow-hidden rounded-2xl transition-all duration-150 hover:border-line-strong hover:bg-surface/95">
      {/* Crisp top color accent bar */}
      <div
        className="h-[2.5px] w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, ${project.color}F0 0%, ${project.color}55 68%, transparent 100%)`,
        }}
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Card header: color dot + name + tracked time */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-line"
              style={{ backgroundColor: project.color }}
            />
            <h3
              className="truncate text-sm font-semibold tracking-tight text-fg"
              title={project.name}
            >
              {project.name}
            </h3>
          </div>

          <div
            title="Total tracked focus time"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-subtle bg-tint-subtle px-2 py-0.5 text-fg-bright"
          >
            <Clock3 className="h-3 w-3 shrink-0 text-fg-muted" />
            {isTimeLoading ? (
              <Skeleton className="h-3.5 w-10 rounded" />
            ) : (
              <span className="font-mono text-[11px] font-medium tabular-nums">
                {formatSecondsToString(totalSeconds || 0)}
              </span>
            )}
          </div>
        </div>

        {/* 2-line clamped description */}
        <p
          className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-fg-secondary"
          title={project.description}
        >
          {project.description}
        </p>

        {/* Inline folder move selector */}
        <div className="mt-auto pt-0.5">
          <FolderSelect
            folders={folders}
            value={project.folder_id ?? null}
            onChange={(folderId) => moveFolderMutation.mutate(folderId)}
            disabled={moveFolderMutation.isPending}
            emptyLabel="No folder"
            variant="inline"
            className="max-w-none"
            ariaLabel={`Folder for ${project.name}`}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between gap-2 border-t border-line-subtle bg-tint-subtle px-4 py-2.5">
        {isConfirmingDelete ? (
          <>
            <span className="truncate text-xs font-medium text-rose-200">Delete project?</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(project.id)}
                aria-label={`Confirm delete ${project.name}`}
                className="inline-flex h-7.5 cursor-pointer items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/25 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {deleteMutation.isPending ? '...' : 'Delete'}
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={onCancelDelete}
                aria-label={`Cancel delete ${project.name}`}
                className="inline-flex h-7.5 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={focusMutation.isPending}
              aria-label={`Focus on ${project.name}`}
              title={`Launch focus timer for ${project.name}`}
              onClick={() => focusMutation.mutate()}
              className="inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-xs font-medium text-amber-300 transition-all hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Focus</span>
            </button>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={`Edit project ${project.name}`}
                title="Edit project"
                onClick={onEdit}
                className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete project ${project.name}`}
                title="Delete project"
                onClick={onRequestDelete}
                className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-rose-500/15 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

interface ProjectTableProps {
  projects: Project[];
  folders: Folder[];
  viewMode?: ProjectViewMode;
  filterKey?: string;
  emptyVariant?: ProjectTableEmptyVariant;
  searchQuery?: string;
  onClearSearch?: () => void;
  onAddProject?: () => void;
}

export function ProjectTable({
  projects,
  folders,
  viewMode = 'list',
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

  const projectsPerPage = viewMode === 'grid' ? 9 : 8;
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-tint-subtle text-fg-secondary">
              <SearchX className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-fg">No matching projects</p>
              <p className="max-w-xs text-xs text-fg-secondary">
                No projects match{' '}
                <span className="text-fg">&ldquo;{searchQuery}&rdquo;</span> in this view.
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
              <p className="text-sm font-medium text-fg">No unassigned projects</p>
              <p className="max-w-xs text-xs text-fg-secondary">
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
              <p className="text-sm font-medium text-fg">
                {emptyVariant === 'all' ? 'No projects yet' : 'This folder is empty'}
              </p>
              <p className="max-w-xs text-xs text-fg-secondary">
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

  const renderPaginationControls = () =>
    maxPage > 1 ? (
      <div className="flex items-center gap-2">
        <span className="mr-1 font-mono text-xs text-fg-muted tabular-nums">
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
    ) : null;

  const renderCountSummary = () => (
    <p className="text-xs text-fg-secondary">
      Showing{' '}
      <span className="font-mono font-medium text-fg tabular-nums">
        {startIdx + 1}–{endIdx}
      </span>{' '}
      of{' '}
      <span className="font-mono font-medium text-fg tabular-nums">{projects.length}</span>{' '}
      {projects.length === 1 ? 'project' : 'projects'}
    </p>
  );

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="flex flex-col gap-3.5">
          {actionError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300"
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

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectGridCard
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-0.5">
            {renderCountSummary()}
            {renderPaginationControls()}
          </div>
        </div>
      ) : (
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
                <tr className="border-b border-line-subtle bg-tint-subtle">
                  <th className="py-3 pr-3 pl-5 text-left text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                    Project
                  </th>
                  <th className="w-[168px] px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                    Folder
                  </th>
                  <th className="w-[104px] px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                    Total Time
                  </th>
                  <th className="w-[188px] py-3 pr-5 pl-2 text-right text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => (
                  <ProjectListRow
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle bg-tint-subtle px-5 py-3">
            {renderCountSummary()}
            {renderPaginationControls()}
          </div>
        </div>
      )}

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
