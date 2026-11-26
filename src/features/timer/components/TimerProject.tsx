import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getAncestorFolderIds,
  getFolderPathMap,
  Project,
  TimerProjectsResponse,
} from '@/shared/lib/models/project';
import { cn } from '@shared/lib/utils';
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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

interface PopoverPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  openUpward: boolean;
}

const UNASSIGNED_GROUP_KEY = '__unassigned__';
const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 8;
const PREFERRED_MENU_HEIGHT = 320;

export function TimerProjectDropdown({
  currentProject,
  switchCurrentProject,
}: Readonly<TimerProjectDropdownProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['timer_projects'],
    queryFn: () => invoke<TimerProjectsResponse>('get_timer_projects'),
  });

  const recommended = data?.recommended ?? [];
  const projects = data?.projects ?? [];
  const folders = data?.folders ?? [];

  const folderMap = useMemo(() => new Map<string, Folder>(folders.map((f) => [f.id, f])), [folders]);
  const folderPathMap = useMemo(() => getFolderPathMap(folders), [folders]);

  const currentFolder = currentProject?.folder_id
    ? folderMap.get(currentProject.folder_id)
    : undefined;
  const isUntracked = currentProject === null;

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return projects.filter((project) => {
      const folderPath = project.folder_id ? (folderPathMap.get(project.folder_id) ?? '') : '';
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
        color: '#646C7A',
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

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;

    const clampedWidth = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
    const clampedLeft = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - clampedWidth - VIEWPORT_MARGIN),
    );

    if (openUpward) {
      setPosition({
        left: clampedLeft,
        width: clampedWidth,
        bottom: window.innerHeight - rect.top + POPOVER_GAP,
        maxHeight: Math.min(PREFERRED_MENU_HEIGHT, Math.max(160, spaceAbove - POPOVER_GAP)),
        openUpward: true,
      });
    } else {
      setPosition({
        left: clampedLeft,
        width: clampedWidth,
        top: rect.bottom + POPOVER_GAP,
        maxHeight: Math.min(PREFERRED_MENU_HEIGHT, Math.max(160, spaceBelow - POPOVER_GAP)),
        openUpward: false,
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();

    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDropdown();
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDropdown]);

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
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 py-2 pr-3 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:outline-none',
          !options?.indentPx && 'pl-3',
          isSelected ? 'bg-amber-500/10 text-[#F4F5F7]' : 'text-[#D6DAE2]',
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/15"
          style={{ backgroundColor: project.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        {options?.showFolderBadge && projectFolder && (
          <span
            title={folderPath}
            className="inline-flex max-w-28 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-[#D6DAE2]"
            style={{
              borderColor: `${projectFolder.color}40`,
              backgroundColor: `${projectFolder.color}18`,
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: projectFolder.color }}
            />
            <span className="truncate">{projectFolder.name}</span>
          </span>
        )}
        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
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
          className="flex w-full cursor-pointer items-center gap-2 py-1.5 pr-3 text-left text-xs font-medium text-[#9CA3B0] transition-colors hover:bg-white/[0.04] hover:text-[#F4F5F7]"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto font-mono text-[11px] text-[#646C7A] tabular-nums">
            {group.totalProjects}
          </span>
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

  const popoverPortal =
    isOpen && position
      ? createPortal(
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-[1199]"
              onMouseDown={closeDropdown}
            />
            <div
              role="listbox"
              aria-label="Select project"
              style={{
                left: `${position.left}px`,
                width: `${position.width}px`,
                top: position.top !== undefined ? `${position.top}px` : undefined,
                bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
                maxHeight: `${position.maxHeight}px`,
              }}
              className={cn(
                'surface-elevated animate-popover fixed z-[1200] flex flex-col overflow-hidden rounded-xl',
                position.openUpward ? 'origin-bottom' : 'origin-top',
              )}
            >
              {/* Search bar */}
              <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#646C7A]" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects or folders..."
                  className="w-full bg-transparent text-xs text-[#F4F5F7] placeholder-[#646C7A] focus:outline-none"
                />
                {isSearching && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="cursor-pointer rounded p-0.5 text-[#646C7A] transition-colors hover:bg-white/[0.06] hover:text-[#F4F5F7]"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable results */}
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {isLoading && !data ? (
                  <div className="flex flex-col gap-1.5 px-3 py-2" aria-label="Loading projects">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 py-1">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/[0.08]" />
                        <span className="h-3.5 flex-1 animate-pulse rounded bg-white/[0.06]" />
                      </div>
                    ))}
                  </div>
                ) : isSearching ? (
                  searchResults.length > 0 ? (
                    searchResults.map((project) =>
                      renderProjectRow(project, { showFolderBadge: true }),
                    )
                  ) : (
                    <div className="px-3 py-5 text-center text-xs text-[#646C7A]">
                      No matching projects
                    </div>
                  )
                ) : (
                  <>
                    {/* No project option */}
                    <button
                      type="button"
                      onClick={() => handleSelectProject(null)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.05]',
                        isUntracked ? 'bg-amber-500/10 text-[#F4F5F7]' : 'text-[#9CA3B0]',
                      )}
                    >
                      <CircleSlash
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isUntracked ? 'text-amber-400' : 'text-[#646C7A]',
                        )}
                      />
                      <span className={cn('text-sm', isUntracked && 'font-medium')}>No project</span>
                      {isUntracked && <Check className="ml-auto h-3.5 w-3.5 text-amber-400" />}
                    </button>

                    {projects.length === 0 && !isLoading && (
                      <div className="px-3 py-3 text-xs text-[#646C7A]">
                        No projects yet — create one in Projects.
                      </div>
                    )}

                    {/* Recommended quick-picks */}
                    {recommended.length > 0 && (
                      <div className="mt-1 border-t border-white/[0.07] pt-1">
                        <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wider text-amber-400/90 uppercase">
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
                      <div className="mt-1 border-t border-white/[0.07] pt-1">
                        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[#646C7A] uppercase">
                          Folders
                        </div>
                        {folderTreeGroups.map((group) => renderFolderGroup(group))}
                      </div>
                    ) : (
                      remainingFlatProjects.length > 0 && (
                        <div className="mt-1 border-t border-white/[0.07] pt-1">
                          {recommended.length > 0 && (
                            <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[#646C7A] uppercase">
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
          </>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-72 sm:w-80">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
          className={cn(
            'surface-card flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E] focus-visible:outline-none',
            isOpen
              ? 'border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.18)]'
              : 'hover:border-white/[0.14]',
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {currentProject ? (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                  style={{ backgroundColor: currentProject.color }}
                />
                <span className="truncate text-sm font-medium text-[#F4F5F7]">
                  {currentProject.name}
                </span>
                {currentFolder && (
                  <span
                    title={folderPathMap.get(currentFolder.id)}
                    className="inline-flex max-w-24 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-[#D6DAE2]"
                    style={{
                      borderColor: `${currentFolder.color}40`,
                      backgroundColor: `${currentFolder.color}18`,
                    }}
                  >
                    <span className="truncate">{currentFolder.name}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <CircleSlash className="h-4 w-4 shrink-0 text-[#646C7A]" />
                <span className="truncate text-sm text-[#9CA3B0]">No project selected</span>
              </>
            )}
          </div>

          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[#646C7A] transition-transform duration-150',
              isOpen && 'rotate-180 text-amber-400',
            )}
          />
        </button>
      </div>

      <p className="text-center text-xs text-[#646C7A]">
        {isUntracked
          ? 'No project selected — sessions will not be tracked.'
          : 'Sessions are tracked to this project automatically.'}
      </p>

      {popoverPortal}
    </div>
  );
}
