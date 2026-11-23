import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getAncestorFolderIds,
  getFolderPathMap,
  Project,
} from '@/shared/lib/models/project';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
    if (!selectedProject) return new Set<string>();
    if (selectedProject.folder_id && folderMap.has(selectedProject.folder_id)) {
      return new Set(getAncestorFolderIds(selectedProject.folder_id, folders));
    }
    return new Set([UNASSIGNED_GROUP_KEY]);
  }, [selectedProject, folders, folderMap]);

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

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minMenuWidth = variant === 'filter' ? 280 : Math.max(280, rect.width);
    const width = Math.max(rect.width, minMenuWidth);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 300;

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
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
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
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelect = (projectId: string | null) => {
    onChange(projectId);
    closeMenu();
  };

  const renderProjectRow = (
    project: Project,
    options?: { showFolderBadge?: boolean; indentPx?: number },
  ) => {
    const isSelected = value === project.id;
    const projectFolder = project.folder_id ? folderMap.get(project.folder_id) : undefined;
    const folderPath = project.folder_id ? folderPathMap.get(project.folder_id) : undefined;

    return (
      <button
        key={project.id}
        type="button"
        onClick={() => handleSelect(project.id)}
        style={options?.indentPx ? { paddingLeft: `${options.indentPx}px` } : undefined}
        className={`flex w-full items-center gap-2.5 py-1.5 pr-3 text-left transition-colors hover:cursor-pointer hover:bg-slate-700/60 ${
          options?.indentPx ? '' : 'pl-3'
        } ${isSelected ? 'bg-blue-500/15 text-white' : 'text-slate-100'}`}
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

  const triggerClasses =
    variant === 'filter'
      ? `inline-flex min-w-44 max-w-64 items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-all hover:cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-slate-800 text-white ring-2 ring-blue-500/20'
            : 'border-slate-700 bg-slate-900 text-white hover:border-blue-400/70 hover:bg-slate-800/80'
        }`
      : `flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all hover:cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-slate-900 text-white ring-2 ring-blue-500/25'
            : 'border-slate-600 bg-slate-900 text-white hover:border-blue-400/80'
        }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            closeMenu();
          } else {
            setIsOpen(true);
          }
        }}
        className={`${triggerClasses} ${className}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedProject ? (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="truncate font-medium">{selectedProject.name}</span>
              {selectedFolder && (
                <span
                  title={folderPathMap.get(selectedFolder.id)}
                  className="inline-flex max-w-24 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
                  style={{
                    borderColor: `${selectedFolder.color}55`,
                    backgroundColor: `${selectedFolder.color}20`,
                  }}
                >
                  <span className="truncate">{selectedFolder.name}</span>
                </span>
              )}
            </>
          ) : (
            <>
              <Layers
                className={`${variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-blue-400`}
              />
              <span className="truncate text-slate-200">
                {allowAll ? allLabel : 'Select project'}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={`${variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-slate-300 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
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
              onClick={(e) => e.stopPropagation()}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="fixed z-[1201] overflow-hidden rounded-xl border border-slate-600/80 bg-slate-800/95 shadow-2xl shadow-black/50 backdrop-blur-md"
            >
              {/* Search bar */}
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
                    {allowAll && (
                      <button
                        type="button"
                        onClick={() => handleSelect(null)}
                        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:cursor-pointer hover:bg-slate-700/60 ${
                          value === null ? 'bg-blue-500/15 text-white' : 'text-slate-200'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <span className={`text-sm ${value === null ? 'font-medium' : ''}`}>
                          {allLabel}
                        </span>
                        {value === null && <Check className="ml-auto h-3.5 w-3.5 text-blue-400" />}
                      </button>
                    )}

                    {projects.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-500 italic">
                        No projects found...
                      </div>
                    ) : hasFoldersWithProjects ? (
                      <div className={allowAll ? 'mt-1 border-t border-slate-700/70 pt-1' : ''}>
                        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                          Folders
                        </div>
                        {folderTreeGroups.map((group) => renderFolderGroup(group))}
                      </div>
                    ) : (
                      <div className={allowAll ? 'mt-1 border-t border-slate-700/70 pt-1' : ''}>
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
