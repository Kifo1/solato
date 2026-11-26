import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getAncestorFolderIds,
  getFolderPathMap,
  Project,
} from '@/shared/lib/models/project';
import { cn } from '@shared/lib/utils';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ProjectFolderSelectProps {
  projects: Project[];
  folders: Folder[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  allowAll?: boolean;
  allLabel?: string;
  variant?: 'filter' | 'form';
  ariaLabel?: string;
  className?: string;
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

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

const UNASSIGNED_GROUP_KEY = '__unassigned__';

export function ProjectFolderSelect({
  projects,
  folders,
  value,
  onChange,
  allowAll = false,
  allLabel = 'All projects',
  variant = 'form',
  ariaLabel,
  className = '',
}: Readonly<ProjectFolderSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [highlightedId, setHighlightedId] = useState<string | null | undefined>(undefined);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const folderMap = useMemo(
    () => new Map<string, Folder>(folders.map((f) => [f.id, f])),
    [folders],
  );
  const folderPathMap = useMemo(() => getFolderPathMap(folders), [folders]);

  const selectedProject = useMemo(
    () => (value ? (projects.find((p) => p.id === value) ?? null) : null),
    [projects, value],
  );
  const selectedFolder = selectedProject?.folder_id
    ? folderMap.get(selectedProject.folder_id)
    : undefined;

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
    if (!selectedProject) return new Set<string>();
    if (selectedProject.folder_id && folderMap.has(selectedProject.folder_id)) {
      return new Set(getAncestorFolderIds(selectedProject.folder_id, folders));
    }
    return new Set([UNASSIGNED_GROUP_KEY]);
  }, [selectedProject, folders, folderMap]);

  const isGroupExpanded = useCallback(
    (groupId: string) => {
      if (groupId in expandedGroups) {
        return expandedGroups[groupId];
      }
      if (projects.length <= 6) {
        return true;
      }
      return activeAncestorIds.has(groupId);
    },
    [expandedGroups, projects.length, activeAncestorIds],
  );

  const toggleGroup = (groupId: string) => {
    const currentlyExpanded = isGroupExpanded(groupId);
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !currentlyExpanded,
    }));
  };

  const visibleSelectableIds = useMemo(() => {
    const ids: (string | null)[] = [];
    if (isSearching) {
      for (const project of searchResults) {
        ids.push(project.id);
      }
      return ids;
    }

    if (allowAll) {
      ids.push(null);
    }

    if (hasFoldersWithProjects) {
      const walk = (group: PopulatedFolderNode) => {
        if (!isGroupExpanded(group.id)) return;
        for (const project of group.directProjects) {
          ids.push(project.id);
        }
        for (const child of group.children) {
          walk(child);
        }
      };
      for (const group of folderTreeGroups) {
        walk(group);
      }
    } else {
      for (const project of projects) {
        ids.push(project.id);
      }
    }
    return ids;
  }, [
    isSearching,
    searchResults,
    allowAll,
    hasFoldersWithProjects,
    folderTreeGroups,
    projects,
    isGroupExpanded,
  ]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedId(undefined);
  }, []);

  const handleSelect = useCallback(
    (projectId: string | null) => {
      onChange(projectId);
      closeMenu();
    },
    [onChange, closeMenu],
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minMenuWidth = variant === 'filter' ? 290 : Math.max(290, rect.width);
    const width = Math.max(rect.width, minMenuWidth);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 310;

    if (spaceBelow < estimatedHeight && rect.top > spaceBelow) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
      });
    }
  }, [variant]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        return;
      }

      if (visibleSelectableIds.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIdx = visibleSelectableIds.indexOf(highlightedId as string | null);
        const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % visibleSelectableIds.length;
        setHighlightedId(visibleSelectableIds[nextIdx]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = visibleSelectableIds.indexOf(highlightedId as string | null);
        const nextIdx =
          currentIdx < 0
            ? visibleSelectableIds.length - 1
            : (currentIdx - 1 + visibleSelectableIds.length) % visibleSelectableIds.length;
        setHighlightedId(visibleSelectableIds[nextIdx]);
      } else if (e.key === 'Enter' && highlightedId !== undefined) {
        if (visibleSelectableIds.includes(highlightedId)) {
          e.preventDefault();
          handleSelect(highlightedId);
          triggerRef.current?.focus();
        }
      }
    };

    const handleResizeOrScroll = () => updatePosition();

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen, visibleSelectableIds, highlightedId, closeMenu, handleSelect, updatePosition]);

  const renderProjectRow = (
    project: Project,
    options?: { showFolderBadge?: boolean; indentPx?: number },
  ) => {
    const isSelected = value === project.id;
    const isHighlighted = highlightedId === project.id;
    const projectFolder = project.folder_id ? folderMap.get(project.folder_id) : undefined;
    const folderPath = project.folder_id ? folderPathMap.get(project.folder_id) : undefined;

    return (
      <button
        key={project.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onMouseEnter={() => setHighlightedId(project.id)}
        onClick={() => handleSelect(project.id)}
        style={options?.indentPx ? { paddingLeft: `${options.indentPx}px` } : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2.5 text-left transition-colors hover:cursor-pointer',
          !options?.indentPx && 'pl-2.5',
          isSelected
            ? 'bg-amber-500/12 text-[#F4F5F7]'
            : isHighlighted
              ? 'bg-white/[0.06] text-[#F4F5F7]'
              : 'text-[#D0D5DE] hover:bg-white/[0.05]',
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        {options?.showFolderBadge && projectFolder && (
          <span
            title={folderPath}
            className="inline-flex max-w-28 shrink-0 items-center gap-1 truncate rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3B0]"
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
    const headerPadLeft = 10 + group.depth * 14;
    const projectIndentPx = headerPadLeft + 18;

    return (
      <div key={group.id}>
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          style={{ paddingLeft: `${headerPadLeft}px` }}
          className="flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left text-xs font-medium text-[#9CA3B0] transition-colors hover:cursor-pointer hover:bg-white/[0.04] hover:text-[#F4F5F7]"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-[#646C7A] transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-[#646C7A]">
            {group.totalProjects}
          </span>
        </button>
        {expanded && (
          <div className="space-y-0.5">
            {group.directProjects.map((project) =>
              renderProjectRow(project, { indentPx: projectIndentPx }),
            )}
            {group.children.map((child) => renderFolderGroup(child))}
          </div>
        )}
      </div>
    );
  };

  const triggerClasses =
    variant === 'filter'
      ? cn(
          'inline-flex h-8.5 min-w-44 max-w-64 items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-all duration-150 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
          isOpen
            ? 'border-amber-500/60 bg-[#14171F] text-[#F4F5F7] ring-2 ring-amber-500/15'
            : 'border-white/[0.09] bg-[#0E1015] text-[#F4F5F7] hover:border-white/[0.16] hover:bg-[#14171F]',
        )
      : cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm transition-all duration-150 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
          isOpen
            ? 'border-amber-500/60 bg-[#0E1015] text-[#F4F5F7] ring-2 ring-amber-500/20'
            : 'border-white/[0.09] bg-[#0E1015] text-[#F4F5F7] hover:border-white/[0.16]',
        );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            closeMenu();
          } else {
            setIsOpen(true);
          }
        }}
        className={cn(triggerClasses, className)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedProject ? (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="truncate font-medium text-[#F4F5F7]">{selectedProject.name}</span>
              {selectedFolder && (
                <span
                  title={folderPathMap.get(selectedFolder.id)}
                  className="inline-flex max-w-24 shrink-0 items-center gap-1 truncate rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3B0]"
                >
                  <span className="truncate">{selectedFolder.name}</span>
                </span>
              )}
            </>
          ) : (
            <>
              <Layers
                className={cn(
                  variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                  'shrink-0 text-amber-400',
                )}
              />
              <span className="truncate text-[#D0D5DE]">
                {allowAll ? allLabel : 'Select project'}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={cn(
            variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            'shrink-0 text-[#646C7A] transition-transform duration-150',
            isOpen && 'rotate-180 text-[#9CA3B0]',
          )}
        />
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[1200]"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
              }}
            />
            <div
              role="listbox"
              aria-label={ariaLabel}
              onClick={(e) => e.stopPropagation()}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="surface-elevated animate-popover fixed z-[1201] overflow-hidden rounded-xl"
            >
              {/* Search bar */}
              <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#101319]/80 px-3 py-2.5">
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
                    className="rounded p-0.5 text-[#646C7A] transition-colors hover:cursor-pointer hover:text-[#F4F5F7]"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto p-1.5">
                {isSearching ? (
                  searchResults.length > 0 ? (
                    <div className="space-y-0.5">
                      {searchResults.map((project) =>
                        renderProjectRow(project, { showFolderBadge: true }),
                      )}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-[#646C7A]">
                      No matching projects
                    </div>
                  )
                ) : (
                  <>
                    {allowAll && (
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === null}
                        onMouseEnter={() => setHighlightedId(null)}
                        onClick={() => handleSelect(null)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:cursor-pointer',
                          value === null
                            ? 'bg-amber-500/12 font-medium text-[#F4F5F7]'
                            : highlightedId === null
                              ? 'bg-white/[0.06] text-[#F4F5F7]'
                              : 'text-[#D0D5DE] hover:bg-white/[0.05]',
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="text-sm">{allLabel}</span>
                        {value === null && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                      </button>
                    )}

                    {projects.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-[#646C7A]">
                        No projects found
                      </div>
                    ) : hasFoldersWithProjects ? (
                      <div
                        className={cn(
                          'space-y-0.5',
                          allowAll && 'mt-1.5 border-t border-white/[0.06] pt-1.5',
                        )}
                      >
                        <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#646C7A] uppercase">
                          Folders
                        </div>
                        {folderTreeGroups.map((group) => renderFolderGroup(group))}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'space-y-0.5',
                          allowAll && 'mt-1.5 border-t border-white/[0.06] pt-1.5',
                        )}
                      >
                        {projects.map((project) => renderProjectRow(project))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
