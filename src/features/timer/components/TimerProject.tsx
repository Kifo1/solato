import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getAncestorFolderIds,
  getFolderPathMap,
  Project,
  TimerProjectsResponse,
} from '@/shared/lib/models/project';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Folder as FolderIcon,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface TimerProjectDropdownProps {
  currentProject: Project | null;
  switchCurrentProject: (project: Project | null) => void;
}

interface PopulatedFolderNode {
  id: string;
  name: string;
  color: string;
  depth: number;
  directProjects: Project[];
  children: PopulatedFolderNode[];
  totalProjects: number;
}

const UNASSIGNED_GROUP_KEY = '__unassigned__';

export function TimerProjectDropdown({
  currentProject,
  switchCurrentProject,
}: Readonly<TimerProjectDropdownProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['timer_projects'],
    queryFn: () => invoke<TimerProjectsResponse>('get_timer_projects'),
  });

  const recommended = data?.recommended ?? [];
  const projects = data?.projects ?? [];
  const folders = data?.folders ?? [];

  const folderMap = useMemo(() => new Map<string, Folder>(folders.map((f) => [f.id, f])), [folders]);
  const folderPathMap = useMemo(() => getFolderPathMap(folders), [folders]);

  const currentFolder = currentProject?.folder_id ? folderMap.get(currentProject.folder_id) : undefined;
  const isUntracked = currentProject === null;

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return projects.filter((project) => {
      const folderPath = project.folder_id ? folderPathMap.get(project.folder_id) ?? '' : '';
      return (
        project.name.toLowerCase().includes(trimmedQuery) ||
        project.description.toLowerCase().includes(trimmedQuery) ||
        folderPath.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [isSearching, projects, folderPathMap, trimmedQuery]);

  const { folderTreeGroups, hasFoldersWithProjects } = useMemo(() => {
    const byFolder = new Map<string, Project[]>();
    const unassigned: Project[] = [];

    for (const project of projects) {
      if (project.folder_id && folderMap.has(project.folder_id)) {
        const list = byFolder.get(project.folder_id) ?? [];
        list.push(project);
        byFolder.set(project.folder_id, list);
      } else {
        unassigned.push(project);
      }
    }

    const pruneNode = (node: FolderTreeNode): PopulatedFolderNode | null => {
      const directProjects = byFolder.get(node.folder.id) ?? [];
      const children = node.children
        .map(pruneNode)
        .filter((child): child is PopulatedFolderNode => child !== null);
      const totalProjects =
        directProjects.length + children.reduce((sum, c) => sum + c.totalProjects, 0);

      if (totalProjects === 0) return null;

      return {
        id: node.folder.id,
        name: node.folder.name,
        color: node.folder.color,
        depth: node.depth,
        directProjects,
        children,
        totalProjects,
      };
    };

    const rawRoots = buildFolderTree(folders);
    const groups = rawRoots
      .map(pruneNode)
      .filter((node): node is PopulatedFolderNode => node !== null);

    const hasFolders = groups.length > 0;

    if (hasFolders && unassigned.length > 0) {
      groups.push({
        id: UNASSIGNED_GROUP_KEY,
        name: 'No folder',
        color: '#64748B',
        depth: 0,
        directProjects: unassigned,
        children: [],
        totalProjects: unassigned.length,
      });
    }

    return { folderTreeGroups: groups, hasFoldersWithProjects: hasFolders };
  }, [projects, folders, folderMap]);

  const activeAncestorIds = useMemo(() => {
    if (!currentProject) return new Set<string>();
    if (currentProject.folder_id && folderMap.has(currentProject.folder_id)) {
      return new Set(getAncestorFolderIds(currentProject.folder_id, folders));
    }
    return new Set([UNASSIGNED_GROUP_KEY]);
  }, [currentProject, folders, folderMap]);

  const recommendedIds = useMemo(() => new Set(recommended.map((p) => p.id)), [recommended]);
  const remainingFlatProjects = useMemo(
    () => projects.filter((p) => !recommendedIds.has(p.id)),
    [projects, recommendedIds],
  );

  const isGroupExpanded = (groupId: string) => {
    if (groupId in expandedGroups) {
      return expandedGroups[groupId];
    }
    if (projects.length <= 6) {
      return true;
    }
    return activeAncestorIds.has(groupId);
  };

  const toggleGroup = (groupId: string) => {
    const currentlyExpanded = isGroupExpanded(groupId);
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !currentlyExpanded,
    }));
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectProject = (project: Project | null) => {
    switchCurrentProject(project);
    closeDropdown();
  };

  const renderProjectRow = (
    project: Project,
    options?: { showFolderBadge?: boolean; indentPx?: number },
  ) => {
    const isSelected = currentProject?.id === project.id;
    const projectFolder = project.folder_id ? folderMap.get(project.folder_id) : undefined;
    const folderPath = project.folder_id ? folderPathMap.get(project.folder_id) : undefined;

    return (
      <button
        key={project.id}
        type="button"
        onClick={() => handleSelectProject(project)}
        style={options?.indentPx ? { paddingLeft: `${options.indentPx}px` } : undefined}
        className={`flex w-full items-center gap-2.5 py-1.5 pr-3 text-left transition-colors hover:cursor-pointer hover:bg-slate-700/60 ${
          options?.indentPx ? '' : 'pl-3'
        } ${isSelected ? 'bg-blue-500/10 text-white' : 'text-slate-100'}`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        {options?.showFolderBadge && projectFolder && (
          <span
            title={folderPath}
            className="inline-flex max-w-28 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
            style={{
              borderColor: `${projectFolder.color}55`,
              backgroundColor: `${projectFolder.color}20`,
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: projectFolder.color }}
            />
            <span className="truncate">{projectFolder.name}</span>
          </span>
        )}
        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
      </button>
    );
  };

  const renderFolderGroup = (group: PopulatedFolderNode) => {
    const expanded = isGroupExpanded(group.id);
    const headerPadLeft = 12 + group.depth * 14;
    const projectIndentPx = headerPadLeft + 18;

    return (
      <div key={group.id}>
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          style={{ paddingLeft: `${headerPadLeft}px` }}
          className="flex w-full items-center gap-2 py-1.5 pr-3 text-left text-xs font-medium text-slate-200 transition-colors hover:cursor-pointer hover:bg-slate-700/40"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
          <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto text-[11px] text-slate-400">{group.totalProjects}</span>
        </button>
        {expanded && (
          <div>
            {group.directProjects.map((project) =>
              renderProjectRow(project, { indentPx: projectIndentPx }),
            )}
            {group.children.map((child) => renderFolderGroup(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="relative w-80">
        <button
          type="button"
          onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-white shadow-lg transition-all hover:cursor-pointer hover:border-blue-500"
        >
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {currentProject ? (
              <>
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: currentProject.color }}
                />
                <span className="truncate text-sm font-medium">{currentProject.name}</span>
                {currentFolder && (
                  <span
                    title={folderPathMap.get(currentFolder.id)}
                    className="inline-flex max-w-24 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
                    style={{
                      borderColor: `${currentFolder.color}55`,
                      backgroundColor: `${currentFolder.color}20`,
                    }}
                  >
                    <span className="truncate">{currentFolder.name}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <CircleSlash className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-400">No project</span>
              </>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="animate-in fade-in zoom-in absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl duration-150">
            {/* Compact search bar */}
            <div className="flex items-center gap-2 border-b border-slate-700/80 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects or folders..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:cursor-pointer hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {isSearching ? (
                searchResults.length > 0 ? (
                  searchResults.map((project) =>
                    renderProjectRow(project, { showFolderBadge: true }),
                  )
                ) : (
                  <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                    No matching projects
                  </div>
                )
              ) : (
                <>
                  {/* No project option */}
                  <button
                    type="button"
                    onClick={() => handleSelectProject(null)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:cursor-pointer hover:bg-slate-700/60 ${
                      isUntracked ? 'bg-blue-500/10 text-white' : 'text-slate-300'
                    }`}
                  >
                    <CircleSlash
                      className={`h-3.5 w-3.5 shrink-0 ${isUntracked ? 'text-blue-400' : 'text-slate-400'}`}
                    />
                    <span className={`text-sm ${isUntracked ? 'font-medium' : ''}`}>No project</span>
                    {isUntracked && <Check className="ml-auto h-3.5 w-3.5 text-blue-400" />}
                  </button>

                  {projects.length === 0 && !isLoading && (
                    <div className="px-3 py-3 text-xs text-slate-500 italic">
                      No projects found...
                    </div>
                  )}

                  {/* Top 3 Recommended based on recent activity & popularity */}
                  {recommended.length > 0 && (
                    <div className="mt-1 border-t border-slate-700/70 pt-1">
                      <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wider text-blue-300 uppercase">
                        <Sparkles className="h-3 w-3" />
                        <span>Recommended</span>
                      </div>
                      {recommended.map((project) =>
                        renderProjectRow(project, { showFolderBadge: true }),
                      )}
                    </div>
                  )}

                  {/* Collapsible nested folders or compact remaining list */}
                  {hasFoldersWithProjects ? (
                    <div className="mt-1 border-t border-slate-700/70 pt-1">
                      <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                        Folders
                      </div>
                      {folderTreeGroups.map((group) => renderFolderGroup(group))}
                    </div>
                  ) : (
                    remainingFlatProjects.length > 0 && (
                      <div className="mt-1 border-t border-slate-700/70 pt-1">
                        {recommended.length > 0 && (
                          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                            All projects
                          </div>
                        )}
                        {remainingFlatProjects.map((project) => renderProjectRow(project))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {isOpen && <button className="fixed inset-0 z-40" onClick={closeDropdown} />}
      </div>
      <div>
        <p className="text-sm text-blue-200/75">
          {isUntracked
            ? 'No project selected — time will not be tracked.'
            : 'Time is tracked to this project automatically.'}
        </p>
      </div>
    </>
  );
}
