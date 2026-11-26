import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getAncestorFolderIds,
  getFolderPathMap,
  Project,
  TimerProjectsResponse,
} from '@/shared/lib/models/project';
import { useToast } from '@shared/context/ToastContext';
import { cn, getErrorMessage } from '@shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Folder as FolderIcon,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface TimerProjectDropdownProps {
  currentProject: Project | null;
  switchCurrentProject: (project: Project | null) => void;
  variant?: 'compact' | 'default';
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
const PREFERRED_MENU_HEIGHT = 400;
const COMPACT_MIN_POPOVER_WIDTH = 312;

const QUICK_CREATE_COLORS = [
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Coral', hex: '#F97316' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Sky', hex: '#38BDF8' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Lavender', hex: '#A78BFA' },
] as const;

export function TimerProjectDropdown({
  currentProject,
  switchCurrentProject,
  variant = 'compact',
}: Readonly<TimerProjectDropdownProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  // Inline quick-create state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickDescription, setQuickDescription] = useState('');
  const [quickColor, setQuickColor] = useState<string>(QUICK_CREATE_COLORS[0].hex);
  const [quickError, setQuickError] = useState<string | null>(null);

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

  const resetQuickCreate = useCallback(() => {
    setIsQuickCreateOpen(false);
    setQuickName('');
    setQuickDescription('');
    setQuickColor(QUICK_CREATE_COLORS[0].hex);
    setQuickError(null);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    resetQuickCreate();
  }, [resetQuickCreate]);

  const openQuickCreate = useCallback((initialName = '') => {
    setQuickName(initialName);
    setQuickDescription('');
    setQuickColor(QUICK_CREATE_COLORS[0].hex);
    setQuickError(null);
    setIsQuickCreateOpen(true);
  }, []);

  const quickCreateMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description: string;
      color: string;
      existingIds: Set<string>;
    }) => {
      await invoke('create_project', {
        name: payload.name,
        description: payload.description,
        color: payload.color,
        folderId: null,
      });

      const refreshed = await queryClient.fetchQuery({
        queryKey: ['timer_projects'],
        queryFn: () => invoke<TimerProjectsResponse>('get_timer_projects'),
      });

      const created =
        refreshed.projects.find((p) => !payload.existingIds.has(p.id)) ??
        refreshed.projects.find((p) => p.name === payload.name && p.color === payload.color) ??
        null;

      return { created, name: payload.name };
    },
    onSuccess: ({ created, name }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });

      if (created) {
        switchCurrentProject(created);
      }
      toast.success(`Project "${name}" ready`, 'Selected for your active session.');
      closeDropdown();
    },
    onError: (err) => {
      setQuickError(getErrorMessage(err, 'Failed to create project.'));
    },
  });

  const handleQuickCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = quickName.trim();
    const trimmedDescription = quickDescription.trim();

    if (!trimmedName) {
      setQuickError('Enter a project name.');
      return;
    }

    setQuickError(null);
    quickCreateMutation.mutate({
      name: trimmedName,
      description: trimmedDescription || 'Focused work',
      color: quickColor,
      existingIds: new Set(projects.map((p) => p.id)),
    });
  };

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;

    const desiredWidth =
      variant === 'compact' ? Math.max(rect.width, COMPACT_MIN_POPOVER_WIDTH) : rect.width;
    const clampedWidth = Math.min(desiredWidth, window.innerWidth - VIEWPORT_MARGIN * 2);
    const clampedLeft = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - clampedWidth - VIEWPORT_MARGIN),
    );

    if (openUpward) {
      setPosition({
        left: clampedLeft,
        width: clampedWidth,
        bottom: window.innerHeight - rect.top + POPOVER_GAP,
        maxHeight: Math.min(PREFERRED_MENU_HEIGHT, Math.max(180, spaceAbove - POPOVER_GAP)),
        openUpward: true,
      });
    } else {
      setPosition({
        left: clampedLeft,
        width: clampedWidth,
        top: rect.bottom + POPOVER_GAP,
        maxHeight: Math.min(PREFERRED_MENU_HEIGHT, Math.max(180, spaceBelow - POPOVER_GAP)),
        openUpward: false,
      });
    }
  }, [variant]);

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
        if (isQuickCreateOpen) {
          resetQuickCreate();
        } else {
          closeDropdown();
          triggerRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isQuickCreateOpen, resetQuickCreate, closeDropdown]);

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

  const handleNavigateManageProjects = () => {
    closeDropdown();
    navigate('/projects');
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
        role="option"
        aria-selected={isSelected}
        onClick={() => handleSelectProject(project)}
        style={options?.indentPx ? { paddingLeft: `${options.indentPx}px` } : undefined}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 py-2 pr-3 text-left transition-colors hover:bg-tint focus-visible:bg-tint focus-visible:outline-none',
          !options?.indentPx && 'pl-3',
          isSelected ? 'bg-amber-500/10 text-fg' : 'text-fg-bright',
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line"
          style={{ backgroundColor: project.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        {options?.showFolderBadge && projectFolder && (
          <span
            title={folderPath}
            className="inline-flex max-w-28 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-fg-bright"
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
          className="flex w-full cursor-pointer items-center gap-2 py-1.5 pr-3 text-left text-xs font-medium text-fg-secondary transition-colors hover:bg-tint hover:text-fg"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto font-mono text-[11px] text-fg-muted tabular-nums">
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
              role="dialog"
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
              {isQuickCreateOpen ? (
                <form onSubmit={handleQuickCreateSubmit} className="flex flex-col">
                  <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2.5">
                    <button
                      type="button"
                      onClick={resetQuickCreate}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-fg-secondary transition-colors hover:text-fg"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Quick create project</span>
                    </button>
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-2 ring-line"
                      style={{ backgroundColor: quickColor }}
                    />
                  </div>

                  <div className="space-y-3 p-3">
                    <div>
                      <label htmlFor="quick-project-name" className="sr-only">
                        Project name
                      </label>
                      <input
                        id="quick-project-name"
                        type="text"
                        autoFocus
                        value={quickName}
                        onChange={(e) => {
                          setQuickName(e.target.value);
                          if (quickError) setQuickError(null);
                        }}
                        placeholder="Project name"
                        maxLength={64}
                        className="w-full rounded-lg border border-line bg-well px-2.5 py-2 text-xs text-fg placeholder-fg-muted transition-colors focus:border-amber-500/45 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="quick-project-desc" className="sr-only">
                        Short description
                      </label>
                      <input
                        id="quick-project-desc"
                        type="text"
                        value={quickDescription}
                        onChange={(e) => setQuickDescription(e.target.value)}
                        placeholder="Short description (optional)"
                        maxLength={120}
                        className="w-full rounded-lg border border-line bg-well px-2.5 py-2 text-xs text-fg placeholder-fg-muted transition-colors focus:border-amber-500/45 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[11px] font-medium text-fg-muted">Color</span>
                      <div className="flex items-center gap-1.5">
                        {QUICK_CREATE_COLORS.map((swatch) => {
                          const isActive = quickColor === swatch.hex;
                          return (
                            <button
                              key={swatch.hex}
                              type="button"
                              title={swatch.name}
                              aria-label={`Select ${swatch.name} color`}
                              aria-pressed={isActive}
                              onClick={() => setQuickColor(swatch.hex)}
                              style={{ backgroundColor: swatch.hex }}
                              className={cn(
                                'h-4 w-4 cursor-pointer rounded-full transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none',
                                isActive
                                  ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface'
                                  : 'ring-1 ring-line',
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {quickError && (
                      <p role="alert" className="text-[11px] text-rose-300">
                        {quickError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={resetQuickCreate}
                        disabled={quickCreateMutation.isPending}
                        className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-tint hover:text-fg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={quickCreateMutation.isPending}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-amber-400 disabled:opacity-60"
                      >
                        {quickCreateMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        <span>Create &amp; Select</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-3 py-2.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search projects or folders..."
                      className="w-full bg-transparent text-xs text-fg placeholder-fg-muted focus:outline-none"
                    />
                    {isSearching && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="cursor-pointer rounded p-0.5 text-fg-muted transition-colors hover:bg-tint hover:text-fg"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable results */}
                  <div role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
                    {isLoading && !data ? (
                      <div className="flex flex-col gap-1.5 px-3 py-2" aria-label="Loading projects">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-2.5 py-1">
                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-tint-strong" />
                            <span className="h-3.5 flex-1 animate-pulse rounded bg-tint" />
                          </div>
                        ))}
                      </div>
                    ) : isSearching ? (
                      searchResults.length > 0 ? (
                        searchResults.map((project) =>
                          renderProjectRow(project, { showFolderBadge: true }),
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                          <p className="text-xs text-fg-muted">No matching projects</p>
                          <button
                            type="button"
                            onClick={() => openQuickCreate(searchQuery.trim())}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Create &ldquo;{searchQuery.trim()}&rdquo;</span>
                          </button>
                        </div>
                      )
                    ) : (
                      <>
                        {/* No project option */}
                        <button
                          type="button"
                          role="option"
                          aria-selected={isUntracked}
                          onClick={() => handleSelectProject(null)}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-tint',
                            isUntracked ? 'bg-amber-500/10 text-fg' : 'text-fg-secondary',
                          )}
                        >
                          <CircleSlash
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              isUntracked ? 'text-amber-400' : 'text-fg-muted',
                            )}
                          />
                          <span className={cn('text-sm', isUntracked && 'font-medium')}>
                            No project
                          </span>
                          {isUntracked && <Check className="ml-auto h-3.5 w-3.5 text-amber-400" />}
                        </button>

                        {projects.length === 0 && !isLoading && (
                          <div className="px-3 py-3 text-xs text-fg-muted">
                            No projects yet — create one below to track your time.
                          </div>
                        )}

                        {/* Recommended quick-picks */}
                        {recommended.length > 0 && (
                          <div className="mt-1 border-t border-line-subtle pt-1">
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
                          <div className="mt-1 border-t border-line-subtle pt-1">
                            <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                              Folders
                            </div>
                            {folderTreeGroups.map((group) => renderFolderGroup(group))}
                          </div>
                        ) : (
                          remainingFlatProjects.length > 0 && (
                            <div className="mt-1 border-t border-line-subtle pt-1">
                              {recommended.length > 0 && (
                                <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
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

                  {/* Quick actions footer */}
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line-subtle bg-tint-subtle px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => openQuickCreate(isSearching ? searchQuery.trim() : '')}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/12 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New project</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNavigateManageProjects}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-fg-secondary transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
                    >
                      <span>Manage</span>
                      <ArrowUpRight className="h-3 w-3 text-fg-muted" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </>,
          document.body,
        )
      : null;

  if (variant === 'compact') {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          title={
            currentProject
              ? `Active project: ${currentProject.name}${currentFolder ? ` (${folderPathMap.get(currentFolder.id) ?? currentFolder.name})` : ''}`
              : 'No project selected — sessions will not be tracked'
          }
          onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
          className={cn(
            'surface-well group inline-flex h-9 max-w-[240px] cursor-pointer items-center gap-2 rounded-full px-3 text-left transition-all duration-150 select-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none',
            isOpen
              ? 'border-amber-500/40 bg-surface shadow-[0_0_0_1px_var(--accent-glow)]'
              : 'hover:border-line-strong hover:bg-surface',
          )}
        >
          {currentProject ? (
            <>
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full ring-2 ring-line"
                style={{ backgroundColor: currentProject.color }}
              />
              <span className="min-w-0 truncate text-xs font-medium text-fg">
                {currentProject.name}
              </span>
              {currentFolder && (
                <span
                  title={folderPathMap.get(currentFolder.id)}
                  className="hidden max-w-[74px] shrink-0 items-center truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium text-fg-bright md:inline-flex"
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
              <CircleSlash className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
              <span className="min-w-0 truncate text-xs font-medium text-fg-secondary">
                No project
              </span>
            </>
          )}

          <ChevronDown
            className={cn(
              'ml-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-150 group-hover:text-fg-secondary',
              isOpen && 'rotate-180 text-amber-400 group-hover:text-amber-400',
            )}
          />
        </button>

        {popoverPortal}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-72 sm:w-80">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
          className={cn(
            'surface-card flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none',
            isOpen
              ? 'border-amber-500/40 shadow-[0_0_0_1px_var(--accent-glow)]'
              : 'hover:border-line-strong',
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {currentProject ? (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-line"
                  style={{ backgroundColor: currentProject.color }}
                />
                <span className="truncate text-sm font-medium text-fg">
                  {currentProject.name}
                </span>
                {currentFolder && (
                  <span
                    title={folderPathMap.get(currentFolder.id)}
                    className="inline-flex max-w-24 shrink-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-fg-bright"
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
                <CircleSlash className="h-4 w-4 shrink-0 text-fg-muted" />
                <span className="truncate text-sm text-fg-secondary">No project selected</span>
              </>
            )}
          </div>

          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-fg-muted transition-transform duration-150',
              isOpen && 'rotate-180 text-amber-400',
            )}
          />
        </button>
      </div>

      <p className="text-center text-xs text-fg-muted">
        {isUntracked
          ? 'No project selected — sessions will not be tracked.'
          : 'Sessions are tracked to this project automatically.'}
      </p>

      {popoverPortal}
    </div>
  );
}
