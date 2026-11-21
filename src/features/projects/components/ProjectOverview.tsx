import Button from '@/shared/components/Button';
import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getDescendantFolderIds,
  Project,
} from '@/shared/lib/models/project';
import { formatSecondsToString } from '@/shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { FolderModal } from './FolderModal';
import { ProjectTable } from './ProjectTable';

type FolderFilter = 'all' | 'unassigned' | string;

interface OverallInfoComponentProps {
  title: string;
  value: string;
}

function OverallInfoComponent({ title, value }: Readonly<OverallInfoComponentProps>) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-blue-200 uppercase lg:text-sm">{title}</span>
      <span className="text-2xl font-bold text-white lg:text-3xl">{value}</span>
    </div>
  );
}

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
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const { data: todaysTotalSeconds, isLoading } = useQuery({
    queryKey: ['todays_overall_time'],
    queryFn: () => invoke<number>('get_todays_overall_time'),
    refetchInterval: 10000,
  });

  const { data: mostActiveProjectName, isLoading: nameIsLoading } = useQuery({
    queryKey: ['most_active_project_name'],
    queryFn: () => invoke<string>('get_most_active_project_name'),
    refetchInterval: 10000,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => invoke('delete_folder', { id }),
    onSuccess: (_data, deletedId) => {
      if (selectedFilter === deletedId) {
        setSelectedFilter('all');
      }
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
    },
  });

  const activeFilter: FolderFilter =
    selectedFilter !== 'all' &&
    selectedFilter !== 'unassigned' &&
    !folders.some((f) => f.id === selectedFilter)
      ? 'all'
      : selectedFilter;

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  const { directCounts, subtreeCounts, unassignedCount } = useMemo(() => {
    const direct = new Map<string, number>();
    let unassigned = 0;
    const validIds = new Set(folders.map((f) => f.id));

    for (const p of projects) {
      if (p.folder_id && validIds.has(p.folder_id)) {
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
  }, [projects, folders, folderTree]);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    if (activeFilter === 'unassigned') return projects.filter((p) => !p.folder_id);
    const matchingFolderIds = getDescendantFolderIds(activeFilter, folders);
    return projects.filter((p) => p.folder_id != null && matchingFolderIds.has(p.folder_id));
  }, [projects, folders, activeFilter]);

  const defaultFolderIdForNewProject =
    activeFilter !== 'all' && activeFilter !== 'unassigned' ? activeFilter : null;

  const openCreateFolder = (parentId: string | null) => {
    setEditingFolder(null);
    setNewFolderParentId(parentId);
    setIsFolderModalOpen(true);
  };

  const toggleCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const renderFolderNode = (node: FolderTreeNode) => {
    const { folder, children } = node;
    const isSelected = activeFilter === folder.id;
    const hasChildren = children.length > 0;
    const isCollapsed = Boolean(collapsedFolders[folder.id]);
    const totalCount = subtreeCounts.get(folder.id) ?? 0;
    const directCount = directCounts.get(folder.id) ?? 0;

    return (
      <div key={folder.id} className="flex flex-col">
        <div
          onClick={() => setSelectedFilter(folder.id)}
          className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
            isSelected
              ? 'border-blue-500 bg-blue-500/15 text-white'
              : 'border-transparent text-blue-200 hover:border-slate-200/15 hover:bg-slate-200/5 hover:text-white'
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(folder.id);
              }}
              className="rounded p-0.5 text-slate-400 hover:cursor-pointer hover:bg-slate-700/70 hover:text-white"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              />
            </button>
          ) : (
            <span className="w-4.5 shrink-0" />
          )}

          <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
          <span className="truncate">{folder.name}</span>
          <span
            className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-blue-200"
            title={
              hasChildren
                ? `${directCount} directly in folder, ${totalCount} including subfolders`
                : `${totalCount} projects`
            }
          >
            {totalCount}
          </span>

          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="Add subfolder"
              onClick={(e) => {
                e.stopPropagation();
                openCreateFolder(folder.id);
              }}
              className="rounded p-1 text-blue-200 hover:cursor-pointer hover:bg-slate-700 hover:text-white"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Edit folder"
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(folder);
                setNewFolderParentId(folder.parent_id ?? null);
                setIsFolderModalOpen(true);
              }}
              className="rounded p-1 text-blue-200 hover:cursor-pointer hover:bg-slate-700 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Delete folder (subfolders and projects move up one level)"
              disabled={deleteFolderMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                deleteFolderMutation.mutate(folder.id);
              }}
              className="rounded p-1 text-blue-200 hover:cursor-pointer hover:bg-red-500/20 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div
            className="mt-1 ml-4 flex flex-col gap-1 border-l pl-3"
            style={{ borderColor: `${folder.color}40` }}
          >
            {children.map((child) => renderFolderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200/10 bg-slate-200/5 p-5 lg:gap-10">
        <OverallInfoComponent title="Total projects" value={projects.length.toString()} />
        <div className="h-10 w-px bg-slate-200/10"></div>
        <OverallInfoComponent
          title="Time tracked today"
          value={isLoading ? 'Loading...' : formatSecondsToString(todaysTotalSeconds || 0)}
        />
        <div className="h-10 w-px bg-slate-200/10"></div>
        <OverallInfoComponent
          title="Most active"
          value={nameIsLoading ? 'Loading...' : mostActiveProjectName || '-'}
        />
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => openCreateFolder(defaultFolderIdForNewProject)}
            className="rounded-md border border-slate-200/15 font-medium"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
          <Button onClick={() => setIsProjectModalOpen(true)} className="rounded-md font-medium">
            <Plus className="hidden lg:inline" />
            Add Project
          </Button>
        </div>
      </div>

      {/* Hierarchical folder filter & management panel */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/10 bg-slate-200/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
              activeFilter === 'all'
                ? 'border-blue-500 bg-blue-500/15 text-white'
                : 'border-slate-200/10 bg-slate-900/30 text-blue-200 hover:border-slate-200/25 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4 text-blue-400" />
            <span>All</span>
            <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-blue-200">
              {projects.length}
            </span>
          </button>

          {folders.length > 0 && unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFilter('unassigned')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
                activeFilter === 'unassigned'
                  ? 'border-blue-500 bg-blue-500/15 text-white'
                  : 'border-slate-200/10 bg-slate-900/30 text-slate-300 hover:border-slate-200/25 hover:text-white'
              }`}
            >
              <span>No folder</span>
              <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-blue-200">
                {unassignedCount}
              </span>
            </button>
          )}
        </div>

        {folderTree.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-slate-200/10 pt-2">
            {folderTree.map((rootNode) => renderFolderNode(rootNode))}
          </div>
        )}
      </div>

      <div>
        <ProjectTable
          projects={filteredProjects}
          folders={folders}
          filterKey={activeFilter}
          onAddProject={() => setIsProjectModalOpen(true)}
        />
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
