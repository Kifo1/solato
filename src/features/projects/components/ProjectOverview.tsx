import Button from '@/shared/components/Button';
import { TextInput } from '@/shared/components/TextInput';
import { useToast } from '@shared/context/ToastContext';
import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getDescendantFolderIds,
  getFolderPathMap,
  Project,
} from '@/shared/lib/models/project';
import { cn, getErrorMessage } from '@/shared/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  ArrowDownAZ,
  Check,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Folder as FolderIcon,
  FolderPlus,
  Layers,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { FolderModal } from './FolderModal';
import {
  ProjectTable,
  type ProjectTableEmptyVariant,
  type ProjectViewMode,
} from './ProjectTable';

type FolderFilter = 'all' | 'unassigned' | string;
type ProjectSortBy = 'name' | 'folder';

const VIEW_STORAGE_KEY = 'solato.projectsView';

function readSavedViewMode(): ProjectViewMode {
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  } catch {
    return 'list';
  }
}

interface ProjectOverviewProps {
  projects: Project[];
  folders: Folder[];
}

export function ProjectOverview({ projects, folders }: Readonly<ProjectOverviewProps>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ProjectSortBy>('name');
  const [viewMode, setViewMode] = useState<ProjectViewMode>(readSavedViewMode);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCompactFoldersOpen, setIsCompactFoldersOpen] = useState(true);

  const handleViewModeChange = (nextMode: ProjectViewMode) => {
    setViewMode(nextMode);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  };

  const deleteFolderMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => invoke('delete_folder', { id }),
    onSuccess: (_data, variables) => {
      setFolderError(null);
      setConfirmDeleteFolderId(null);
      if (selectedFilter === variables.id) {
        setSelectedFilter('all');
      }
      toast.success('Folder deleted', `${variables.name} — contents moved up`);
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'Failed to delete folder.');
      setConfirmDeleteFolderId(null);
      setFolderError(msg);
      toast.error('Failed to delete folder', msg);
    },
  });

  const validFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const folderPathMap = useMemo(() => getFolderPathMap(folders), [folders]);

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
    const filtered = !trimmedSearch
      ? folderFilteredProjects
      : folderFilteredProjects.filter(
          (p) =>
            p.name.toLowerCase().includes(trimmedSearch) ||
            p.description.toLowerCase().includes(trimmedSearch),
        );

    const sorted = [...filtered];
    if (sortBy === 'folder') {
      sorted.sort((a, b) => {
        const folderA = a.folder_id ? (folderPathMap.get(a.folder_id) ?? '') : '';
        const folderB = b.folder_id ? (folderPathMap.get(b.folder_id) ?? '') : '';
        if (folderA && !folderB) return -1;
        if (!folderA && folderB) return 1;
        const folderCmp = folderA.localeCompare(folderB, undefined, { sensitivity: 'base' });
        if (folderCmp !== 0) return folderCmp;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    return sorted;
  }, [folderFilteredProjects, trimmedSearch, sortBy, folderPathMap]);

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
              ? 'border-amber-500/30 bg-amber-500/12 text-fg'
              : 'border-transparent text-fg-secondary hover:bg-tint hover:text-fg',
          )}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggleCollapse(folder.id)}
              className="flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-150',
                  !isCollapsed && 'rotate-90',
                )}
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
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line"
              style={{ backgroundColor: folder.color }}
            />
            <span className="min-w-0 flex-1 truncate" title={folder.name}>
              {folder.name}
            </span>
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-opacity',
                isConfirming ? 'opacity-0' : 'group-focus-within:opacity-0 group-hover:opacity-0',
                isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-tint text-fg-muted',
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
              'absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-surface/95 px-0.5 py-0.5 shadow-sm backdrop-blur-xs transition-opacity',
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
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Edit folder ${folder.name}`}
              title="Edit folder"
              onClick={() => openEditFolder(folder)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
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
                  : 'text-fg-secondary hover:bg-rose-500/15 hover:text-rose-400',
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
                onClick={() => deleteFolderMutation.mutate({ id: folder.id, name: folder.name })}
                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-rose-500/25 px-2 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/35 focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:outline-none disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {deleteFolderMutation.isPending ? '...' : 'Delete'}
              </button>
              <button
                type="button"
                disabled={deleteFolderMutation.isPending}
                onClick={() => setConfirmDeleteFolderId(null)}
                className="inline-flex h-6 cursor-pointer items-center rounded-md px-1.5 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-tint-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:opacity-50"
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

  return (
    <div className="mt-5 flex flex-col gap-5">
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
                  'h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform xl:hidden',
                  !isCompactFoldersOpen && '-rotate-90',
                )}
              />
              <span className="text-[11px] font-semibold tracking-wider text-fg-secondary uppercase">
                Folders
              </span>
              <span className="truncate rounded-md bg-tint px-1.5 py-0.5 text-[11px] font-medium text-fg-bright xl:hidden">
                {activeFilterLabel}
              </span>
            </button>

            <button
              type="button"
              aria-label="New folder"
              title="New folder"
              onClick={() => openCreateFolder(defaultFolderIdForNewProject)}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-tint-subtle text-fg-secondary transition-colors hover:border-amber-500/35 hover:bg-amber-500/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
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

          <div className={cn('flex flex-col gap-1', !isCompactFoldersOpen && 'hidden xl:flex')}>
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
                  ? 'border-amber-500/30 bg-amber-500/12 text-fg'
                  : 'border-transparent text-fg-secondary hover:bg-tint hover:text-fg',
              )}
            >
              <Layers
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  activeFilter === 'all' ? 'text-amber-400' : 'text-fg-muted',
                )}
              />
              <span className="min-w-0 flex-1 truncate">All Projects</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  activeFilter === 'all'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-tint text-fg-muted',
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
                  ? 'border-amber-500/30 bg-amber-500/12 text-fg'
                  : 'border-transparent text-fg-secondary hover:bg-tint hover:text-fg',
              )}
            >
              <CircleSlash
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  activeFilter === 'unassigned' ? 'text-amber-400' : 'text-fg-muted',
                )}
              />
              <span className="min-w-0 flex-1 truncate">Unassigned</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  activeFilter === 'unassigned'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-tint text-fg-muted',
                )}
              >
                {unassignedCount}
              </span>
            </button>

            {folderTree.length > 0 ? (
              <div className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-t border-line-subtle pt-2 xl:max-h-[calc(100vh-220px)]">
                {folderTree.map((rootNode) => renderFolderNode(rootNode))}
              </div>
            ) : (
              <div className="mt-1.5 border-t border-line-subtle px-2 pt-3 pb-1 text-center">
                <p className="text-[11px] text-fg-muted">No folders yet</p>
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

        {/* Right Detail Pane: Actionable Workspace Toolbar + Projects */}
        <section className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <TextInput
                type="text"
                scale="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeFilter === 'all'
                    ? 'Search projects...'
                    : `Search ${activeFilterLabel.toLowerCase()}...`
                }
                aria-label="Search projects"
                className="pr-9 pl-10"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-tint-strong hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector + View Switcher */}
            <div className="flex shrink-0 items-center gap-2">
              <div
                role="group"
                aria-label="Sort projects"
                className="inline-flex h-9.5 items-center rounded-xl border border-line bg-well p-1"
              >
                <button
                  type="button"
                  aria-pressed={sortBy === 'name'}
                  onClick={() => setSortBy('name')}
                  className={cn(
                    'inline-flex h-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    sortBy === 'name'
                      ? 'bg-elevated text-fg shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                      : 'text-fg-muted hover:text-fg-bright',
                  )}
                >
                  <ArrowDownAZ
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      sortBy === 'name' ? 'text-amber-400' : 'text-current',
                    )}
                  />
                  <span>Name A–Z</span>
                </button>
                <button
                  type="button"
                  aria-pressed={sortBy === 'folder'}
                  onClick={() => setSortBy('folder')}
                  className={cn(
                    'inline-flex h-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    sortBy === 'folder'
                      ? 'bg-elevated text-fg shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                      : 'text-fg-muted hover:text-fg-bright',
                  )}
                >
                  <FolderIcon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      sortBy === 'folder' ? 'text-amber-400' : 'text-current',
                    )}
                  />
                  <span>Folder</span>
                </button>
              </div>

              <div
                role="group"
                aria-label="Project layout view"
                className="inline-flex h-9.5 items-center rounded-xl border border-line bg-well p-1"
              >
                <button
                  type="button"
                  aria-label="List view"
                  title="List view"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => handleViewModeChange('list')}
                  className={cn(
                    'flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    viewMode === 'list'
                      ? 'bg-elevated text-amber-400 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                      : 'text-fg-muted hover:text-fg-bright',
                  )}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Grid view"
                  title="Card grid view"
                  aria-pressed={viewMode === 'grid'}
                  onClick={() => handleViewModeChange('grid')}
                  className={cn(
                    'flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none',
                    viewMode === 'grid'
                      ? 'bg-elevated text-amber-400 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                      : 'text-fg-muted hover:text-fg-bright',
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Primary & Secondary Creation Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => openCreateFolder(defaultFolderIdForNewProject)}
              >
                <FolderPlus className="h-4 w-4 text-fg-secondary" />
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
              <div className="flex min-w-0 items-center gap-2 text-xs text-fg-secondary">
                <span>Viewing</span>
                <span className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-line bg-tint-subtle px-2 py-0.5 font-medium text-fg">
                  {activeFolder ? (
                    <FolderIcon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: activeFolder.color }}
                    />
                  ) : (
                    <CircleSlash className="h-3.5 w-3.5 shrink-0 text-fg-secondary" />
                  )}
                  <span className="truncate">{activeFilterLabel}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className="cursor-pointer text-xs font-medium text-fg-secondary transition-colors hover:text-amber-400"
              >
                Show all
              </button>
            </div>
          )}

          <ProjectTable
            projects={visibleProjects}
            folders={folders}
            viewMode={viewMode}
            filterKey={`${activeFilter}::${trimmedSearch}::${sortBy}`}
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
