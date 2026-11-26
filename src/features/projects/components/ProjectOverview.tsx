import Button from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { TextInput } from '@/shared/components/TextInput';
import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getDescendantFolderIds,
  Project,
} from '@/shared/lib/models/project';
import { cn, formatSecondsToString, getErrorMessage } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Clock,
  Flame,
  Folder as FolderIcon,
  FolderKanban,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { FolderModal } from './FolderModal';
import { ProjectTable, type ProjectTableEmptyVariant } from './ProjectTable';

type FolderFilter = 'all' | 'unassigned' | string;

interface ProjectOverviewProps {
  projects: Project[];
  folders: Folder[];
}

export function ProjectOverview({ projects, folders }: Readonly<ProjectOverviewProps>) {
  const queryClient = useQueryClient();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCompactFoldersOpen, setIsCompactFoldersOpen] = useState(true);

  const { data: todaysTotalSeconds, isLoading: todaysTimeLoading } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: 10000,
  });

  const { data: mostActiveProjectName, isLoading: mostActiveLoading } = useQuery({
    queryKey: ['most_active_project_name'],
    queryFn: () => invoke<string>('get_most_active_project_name'),
    refetchInterval: 10000,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_folder', { id }),
    onSuccess: (_data, deletedId) => {
      setFolderError(null);
      setConfirmDeleteFolderId(null);
      if (selectedFilter === deletedId) {
        setSelectedFilter('all');
      }
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
    },
    onError: (err) => {
      setConfirmDeleteFolderId(null);
      setFolderError(getErrorMessage(err, 'Failed to delete folder.'));
    },
  });

  const validFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  const activeFilter: FolderFilter =
    selectedFilter !== 'all' && selectedFilter !== 'unassigned' && !validFolderIds.has(selectedFilter)
      ? 'all'
      : selectedFilter;

  const activeFolder = useMemo(
    () =>
      activeFilter !== 'all' && activeFilter !== 'unassigned'
        ? (folders.find((f) => f.id === activeFilter) ?? null)
        : null,
    [folders, activeFilter],
  );

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  const { directCounts, subtreeCounts, unassignedCount } = useMemo(() => {
    const direct = new Map<string, number>();
    let unassigned = 0;

    for (const p of projects) {
      if (p.folder_id && validFolderIds.has(p.folder_id)) {
        direct.set(p.folder_id, (direct.get(p.folder_id) ?? 0) + 1);
      } else {
        unassigned += 1;
      }
    }

    const subtree = new Map<string, number>();
    const calcSubtree = (node: FolderTreeNode): number => {
      let total = direct.get(node.folder.id) ?? 0;
      for (const child of node.children) {
        total += calcSubtree(child);
      }
      subtree.set(node.folder.id, total);
      return total;
    };
    for (const root of folderTree) {
      calcSubtree(root);
    }

    return { directCounts: direct, subtreeCounts: subtree, unassignedCount: unassigned };
  }, [projects, validFolderIds, folderTree]);

  const folderFilteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    if (activeFilter === 'unassigned') {
      return projects.filter((p) => !p.folder_id || !validFolderIds.has(p.folder_id));
    }
    const matchingFolderIds = getDescendantFolderIds(activeFilter, folders);
    return projects.filter((p) => p.folder_id != null && matchingFolderIds.has(p.folder_id));
  }, [projects, folders, validFolderIds, activeFilter]);

  const trimmedSearch = searchQuery.trim().toLowerCase();

  const visibleProjects = useMemo(() => {
    if (!trimmedSearch) return folderFilteredProjects;
    return folderFilteredProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(trimmedSearch) ||
        p.description.toLowerCase().includes(trimmedSearch),
    );
  }, [folderFilteredProjects, trimmedSearch]);

  const emptyVariant: ProjectTableEmptyVariant = trimmedSearch
    ? 'search'
    : activeFilter === 'unassigned'
      ? 'unassigned'
      : activeFilter === 'all'
        ? 'all'
        : 'folder';

  const defaultFolderIdForNewProject =
    activeFilter !== 'all' && activeFilter !== 'unassigned' ? activeFilter : null;

  const openCreateFolder = (parentId: string | null) => {
    setFolderError(null);
    setConfirmDeleteFolderId(null);
    setEditingFolder(null);
    setNewFolderParentId(parentId);
    setIsFolderModalOpen(true);
  };

  const openEditFolder = (folder: Folder) => {
    setFolderError(null);
    setConfirmDeleteFolderId(null);
    setEditingFolder(folder);
    setNewFolderParentId(folder.parent_id ?? null);
    setIsFolderModalOpen(true);
  };

  const toggleCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const activeFilterLabel =
    activeFilter === 'all'
      ? 'All Projects'
      : activeFilter === 'unassigned'
        ? 'Unassigned'
        : (activeFolder?.name ?? 'All Projects');

  const renderFolderNode = (node: FolderTreeNode) => {
    const { folder, children } = node;
    const isSelected = activeFilter === folder.id;
    const hasChildren = children.length > 0;
    const isCollapsed = Boolean(collapsedFolders[folder.id]);
    const totalCount = subtreeCounts.get(folder.id) ?? 0;
    const directCount = directCounts.get(folder.id) ?? 0;
    const isConfirming = confirmDeleteFolderId === folder.id;

    return (
      <div key={folder.id} className="flex flex-col">
        <div
          className={cn(
            'group relative flex items-center gap-1 rounded-xl border px-1.5 py-1 transition-colors',
            isSelected
              ? 'border-amber-500/30 bg-amber-500/12 text-[#F4F5F7]'
              : 'border-transparent text-[#9CA3B0] hover:bg-white/[0.04] hover:text-[#F4F5F7]',
          )}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggleCollapse(folder.id)}
              className="flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#646C7A] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform duration-150', !isCollapsed && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedFilter(folder.id);
              setConfirmDeleteFolderId(null);
            }}
            aria-current={isSelected ? 'page' : undefined}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 pr-1 text-left text-xs font-medium focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/15"
              style={{ backgroundColor: folder.color }}
            />
            <span className="min-w-0 flex-1 truncate" title={folder.name}>
              {folder.name}
            </span>
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-opacity',
                isConfirming ? 'opacity-0' : 'group-focus-within:opacity-0 group-hover:opacity-0',
                isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.05] text-[#646C7A]',
              )}
              title={
                hasChildren
                  ? `${directCount} directly in folder, ${totalCount} including subfolders`
                  : `${totalCount} ${totalCount === 1 ? 'project' : 'projects'}`
              }
            >
              {totalCount}
            </span>
          </button>

          <div
            className={cn(
              'absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[#161A22]/95 px-0.5 py-0.5 shadow-sm backdrop-blur-xs transition-opacity',
              isConfirming
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
            )}
          >
            <button
              type="button"
              aria-label={`Add subfolder inside ${folder.name}`}
              title="Add subfolder"
              onClick={() => openCreateFolder(folder.id)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#9CA3B0] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Edit folder ${folder.name}`}
              title="Edit folder"
              onClick={() => openEditFolder(folder)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#9CA3B0] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label={`Delete folder ${folder.name}`}
              title="Delete folder"
              onClick={() => {
                setFolderError(null);
                setConfirmDeleteFolderId(isConfirming ? null : folder.id);
              }}
              className={cn(
                'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none',
                isConfirming
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'text-[#9CA3B0] hover:bg-rose-500/15 hover:text-rose-400',
              )}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isConfirming && (
          <div className="mt-1 ml-5 flex items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 py-2">
            <span className="text-[11px] leading-tight text-rose-200">
              Delete folder? Contents move up.
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={deleteFolderMutation.isPending}
                onClick={() => deleteFolderMutation.mutate(folder.id)}
                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-rose-500/25 px-2 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/35 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {deleteFolderMutation.isPending ? '...' : 'Delete'}
              </button>
              <button
                type="button"
                disabled={deleteFolderMutation.isPending}
                onClick={() => setConfirmDeleteFolderId(null)}
                className="inline-flex h-6 cursor-pointer items-center rounded-md px-1.5 text-[11px] font-medium text-[#9CA3B0] transition-colors hover:bg-white/[0.08] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {hasChildren && !isCollapsed && (
          <div
            className="mt-1 ml-3.5 flex flex-col gap-0.5 border-l pl-2"
            style={{ borderColor: `${folder.color}38` }}
          >
            {children.map((child) => renderFolderNode(child))}
          </div>
        )}
      </div>
    );
  };

  const trimmedMostActive = mostActiveProjectName?.trim();

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* 3-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="surface-card flex items-start justify-between gap-3 rounded-2xl p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#9CA3B0]">Today&apos;s Focus</p>
            <div className="mt-1.5">
              {todaysTimeLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="font-mono text-2xl font-semibold tracking-tight text-[#F4F5F7] tabular-nums">
                  {formatSecondsToString(todaysTotalSeconds || 0)}
                </p>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[#646C7A]">Tracked across all projects</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/12 text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="surface-card flex items-start justify-between gap-3 rounded-2xl p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#9CA3B0]">Most Active Project</p>
            <div className="mt-1.5">
              {mostActiveLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <p
                  className={cn(
                    'truncate text-xl font-semibold tracking-tight leading-7',
                    trimmedMostActive ? 'text-[#F4F5F7]' : 'text-[#646C7A]',
                  )}
                  title={trimmedMostActive || 'None yet'}
                >
                  {trimmedMostActive || 'None yet'}
                </p>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[#646C7A]">Highest recorded focus time</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/12 text-teal-400">
            <Flame className="h-4 w-4" />
          </div>
        </div>

        <div className="surface-card flex items-start justify-between gap-3 rounded-2xl p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#9CA3B0]">Total Projects</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-[#F4F5F7] tabular-nums">
              {projects.length}
            </p>
            <p className="mt-1 text-[11px] text-[#646C7A]">
              {folders.length} {folders.length === 1 ? 'active folder' : 'active folders'}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/12 text-sky-400">
            <FolderKanban className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Master-Detail 2-Pane Workspace (side-by-side at xl, stacked with collapsible rail below xl) */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[248px_minmax(0,1fr)]">
        {/* Left Rail: Folders */}
        <aside className="surface-card rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2 px-1.5 pb-2">
            <button
              type="button"
              onClick={() => setIsCompactFoldersOpen((open) => !open)}
              aria-expanded={isCompactFoldersOpen}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left xl:pointer-events-none"
            >
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-transform xl:hidden',
                  !isCompactFoldersOpen && '-rotate-90',
                )}
              />
              <span className="text-[11px] font-semibold tracking-wider text-[#9CA3B0] uppercase">
                Folders
              </span>
              <span className="truncate rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-[#D1D5DE] xl:hidden">
                {activeFilterLabel}
              </span>
            </button>

            <button
              type="button"
              aria-label="New folder"
              title="New folder"
              onClick={() => openCreateFolder(defaultFolderIdForNewProject)}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9CA3B0] transition-colors hover:border-amber-500/35 hover:bg-amber-500/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {folderError && (
            <div
              role="alert"
              className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300"
            >
              <div className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{folderError}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss folder error"
                onClick={() => setFolderError(null)}
                className="cursor-pointer rounded p-0.5 text-rose-300/80 hover:text-rose-200"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div
            className={cn(
              'flex flex-col gap-1',
              !isCompactFoldersOpen && 'hidden xl:flex',
            )}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedFilter('all');
                setConfirmDeleteFolderId(null);
              }}
              aria-current={activeFilter === 'all' ? 'page' : undefined}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                activeFilter === 'all'
                  ? 'border-amber-500/30 bg-amber-500/12 text-[#F4F5F7]'
                  : 'border-transparent text-[#9CA3B0] hover:bg-white/[0.04] hover:text-[#F4F5F7]',
              )}
            >
              <Layers
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  activeFilter === 'all' ? 'text-amber-400' : 'text-[#646C7A]',
                )}
              />
              <span className="min-w-0 flex-1 truncate">All Projects</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  activeFilter === 'all'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-white/[0.05] text-[#646C7A]',
                )}
              >
                {projects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedFilter('unassigned');
                setConfirmDeleteFolderId(null);
              }}
              aria-current={activeFilter === 'unassigned' ? 'page' : undefined}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                activeFilter === 'unassigned'
                  ? 'border-amber-500/30 bg-amber-500/12 text-[#F4F5F7]'
                  : 'border-transparent text-[#9CA3B0] hover:bg-white/[0.04] hover:text-[#F4F5F7]',
              )}
            >
              <CircleSlash
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  activeFilter === 'unassigned' ? 'text-amber-400' : 'text-[#646C7A]',
                )}
              />
              <span className="min-w-0 flex-1 truncate">Unassigned</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  activeFilter === 'unassigned'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-white/[0.05] text-[#646C7A]',
                )}
              >
                {unassignedCount}
              </span>
            </button>

            {folderTree.length > 0 ? (
              <div className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-t border-white/[0.06] pt-2 xl:max-h-[calc(100vh-340px)]">
                {folderTree.map((rootNode) => renderFolderNode(rootNode))}
              </div>
            ) : (
              <div className="mt-1.5 border-t border-white/[0.06] px-2 pt-3 pb-1 text-center">
                <p className="text-[11px] text-[#646C7A]">No folders yet</p>
                <button
                  type="button"
                  onClick={() => openCreateFolder(null)}
                  className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Create a folder
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right Detail Pane: Toolbar + Project Table */}
        <section className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#646C7A]" />
              <TextInput
                type="text"
                scale="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeFilterLabel.toLowerCase()}...`}
                aria-label="Search projects"
                className="pr-9 pl-10"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#646C7A] transition-colors hover:bg-white/[0.07] hover:text-[#F4F5F7]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => openCreateFolder(defaultFolderIdForNewProject)}
              >
                <FolderPlus className="h-4 w-4 text-[#9CA3B0]" />
                <span>New Folder</span>
              </Button>
              <Button variant="primary" onClick={() => setIsProjectModalOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>New Project</span>
              </Button>
            </div>
          </div>

          {activeFilter !== 'all' && (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2 text-xs text-[#9CA3B0]">
                <span>Viewing</span>
                <span className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-medium text-[#F4F5F7]">
                  {activeFolder ? (
                    <FolderIcon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: activeFolder.color }}
                    />
                  ) : (
                    <CircleSlash className="h-3.5 w-3.5 shrink-0 text-[#9CA3B0]" />
                  )}
                  <span className="truncate">{activeFilterLabel}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className="cursor-pointer text-xs font-medium text-[#9CA3B0] transition-colors hover:text-amber-400"
              >
                Show all
              </button>
            </div>
          )}

          <ProjectTable
            projects={visibleProjects}
            folders={folders}
            filterKey={`${activeFilter}::${trimmedSearch}`}
            emptyVariant={emptyVariant}
            searchQuery={searchQuery.trim()}
            onClearSearch={() => setSearchQuery('')}
            onAddProject={() => setIsProjectModalOpen(true)}
          />
        </section>
      </div>

      {isProjectModalOpen && (
        <CreateProjectModal
          isModalOpen={isProjectModalOpen}
          setIsModalOpen={setIsProjectModalOpen}
          defaultFolderId={defaultFolderIdForNewProject}
        />
      )}

      {isFolderModalOpen && (
        <FolderModal
          folder={editingFolder}
          defaultParentId={newFolderParentId}
          isModalOpen={isFolderModalOpen}
          setIsModalOpen={(open) => {
            setIsFolderModalOpen(open);
            if (!open) {
              setEditingFolder(null);
              setNewFolderParentId(null);
            }
          }}
        />
      )}
    </div>
  );
}
