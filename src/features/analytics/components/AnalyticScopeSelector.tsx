import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  getFolderPathMap,
  Project,
} from '@/shared/lib/models/project';
import { cn } from '@shared/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  Layers,
  Minus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnalytics } from '../hooks/useAnalytics';

interface ScopeFolderGroup {
  id: string;
  name: string;
  color: string;
  depth: number;
  directProjects: Project[];
  allSubtreeProjects: Project[];
  children: ScopeFolderGroup[];
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

function SelectionCheckbox({
  state,
}: Readonly<{ state: 'checked' | 'indeterminate' | 'unchecked' }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
        state === 'checked'
          ? 'border-amber-400 bg-amber-500 text-on-accent'
          : state === 'indeterminate'
            ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
            : 'border-line-strong bg-well text-transparent',
      )}
    >
      {state === 'checked' && <Check className="h-3 w-3 stroke-[2.75]" />}
      {state === 'indeterminate' && <Minus className="h-3 w-3 stroke-[2.75]" />}
    </span>
  );
}

export default function AnalyticScopeSelector() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { selectedProjects } = useAnalytics();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

  const folderPathMap = useMemo(() => getFolderPathMap(folders), [folders]);

  const selectedIdSet = useMemo(
    () => new Set(selectedProjects.map((p) => p.id)),
    [selectedProjects],
  );

  const updateSelectionMutation = useMutation({
    mutationFn: (nextProjects: Project[]) =>
      invoke('update_selected_projects', {
        projectIds: nextProjects.map((p) => p.id),
      }),
    onMutate: async (nextProjects) => {
      await queryClient.cancelQueries({ queryKey: ['localSelectedProjects'] });
      const previous = queryClient.getQueryData<Project[]>(['localSelectedProjects']);
      queryClient.setQueryData<Project[]>(['localSelectedProjects'], nextProjects);
      return { previous };
    },
    onError: (_err, _nextProjects, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Project[]>(['localSelectedProjects'], context.previous);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const applySelection = (nextProjects: Project[]) => {
    updateSelectionMutation.mutate(nextProjects);
  };

  const { folderGroups, hasFolders } = useMemo(() => {
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const byFolder = new Map<string, Project[]>();
    const unassigned: Project[] = [];

    for (const p of projects) {
      if (p.folder_id && folderMap.has(p.folder_id)) {
        const list = byFolder.get(p.folder_id) ?? [];
        list.push(p);
        byFolder.set(p.folder_id, list);
      } else {
        unassigned.push(p);
      }
    }

    const buildGroup = (node: FolderTreeNode): ScopeFolderGroup | null => {
      const directProjects = byFolder.get(node.folder.id) ?? [];
      const children = node.children
        .map(buildGroup)
        .filter((child): child is ScopeFolderGroup => child !== null);
      const allSubtreeProjects = [
        ...directProjects,
        ...children.flatMap((c) => c.allSubtreeProjects),
      ];
      if (allSubtreeProjects.length === 0) return null;

      return {
        id: node.folder.id,
        name: node.folder.name,
        color: node.folder.color,
        depth: node.depth,
        directProjects,
        allSubtreeProjects,
        children,
      };
    };

    const groups = buildFolderTree(folders)
      .map(buildGroup)
      .filter((group): group is ScopeFolderGroup => group !== null);

    const anyFolders = groups.length > 0;
    if (anyFolders && unassigned.length > 0) {
      groups.push({
        id: '__unassigned__',
        name: 'No folder',
        color: '#646C7A',
        depth: 0,
        directProjects: unassigned,
        allSubtreeProjects: unassigned,
        children: [],
      });
    }

    return { folderGroups: groups, hasFolders: anyFolders };
  }, [projects, folders]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const filteredProjects = useMemo(() => {
    if (!isSearching) return [];
    return projects.filter((p) => {
      const folderPath = p.folder_id ? (folderPathMap.get(p.folder_id) ?? '') : '';
      return (
        p.name.toLowerCase().includes(trimmedQuery) ||
        folderPath.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [isSearching, projects, folderPathMap, trimmedQuery]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 340;

    if (spaceBelow < estimatedHeight && rect.top > spaceBelow) {
      setCoords({
        bottom: window.innerHeight - rect.top + 8,
        left,
        width,
      });
    } else {
      setCoords({
        top: rect.bottom + 8,
        left,
        width,
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => updatePosition();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, closeMenu, updatePosition]);

  const toggleProject = (project: Project) => {
    const isSelected = selectedIdSet.has(project.id);
    const nextProjects = isSelected
      ? selectedProjects.filter((p) => p.id !== project.id)
      : [...selectedProjects, project];
    applySelection(nextProjects);
  };

  const toggleGroupSelection = (groupProjects: Project[]) => {
    const allSelected = groupProjects.every((p) => selectedIdSet.has(p.id));
    const groupIds = new Set(groupProjects.map((p) => p.id));
    const nextProjects = allSelected
      ? selectedProjects.filter((p) => !groupIds.has(p.id))
      : [
          ...selectedProjects,
          ...groupProjects.filter((p) => !selectedIdSet.has(p.id)),
        ];
    applySelection(nextProjects);
  };

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const getProjectPreview = () => {
    const count = selectedProjects.length;
    if (count === 0) {
      return (
        <>
          <Layers className="h-4 w-4 shrink-0 text-fg-muted" />
          <span className="truncate text-fg-secondary">Select projects</span>
        </>
      );
    }
    if (count === 1) {
      const current = selectedProjects[0];
      return (
        <>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: current.color }}
          />
          <span className="truncate text-fg">{current.name}</span>
        </>
      );
    }
    if (count === projects.length && projects.length > 0) {
      return (
        <>
          <Layers className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="truncate text-fg">All projects</span>
          <span className="rounded-md bg-tint px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg-secondary">
            {count}
          </span>
        </>
      );
    }
    return (
      <>
        <Layers className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="truncate text-fg">
          <span className="font-mono tabular-nums">{count}</span> selected
        </span>
      </>
    );
  };

  const renderProjectRow = (project: Project, indentPx?: number) => {
    const checked = selectedIdSet.has(project.id);
    const folderPath = project.folder_id ? folderPathMap.get(project.folder_id) : undefined;

    return (
      <button
        key={project.id}
        type="button"
        role="option"
        aria-selected={checked}
        onClick={() => toggleProject(project)}
        style={indentPx ? { paddingLeft: `${indentPx}px` } : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2.5 text-left transition-colors hover:cursor-pointer hover:bg-tint',
          !indentPx && 'pl-2.5',
          checked ? 'text-fg' : 'text-fg-secondary',
        )}
      >
        <SelectionCheckbox state={checked ? 'checked' : 'unchecked'} />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
        {isSearching && folderPath && (
          <span className="max-w-24 shrink-0 truncate rounded-md border border-line-subtle bg-tint-subtle px-1.5 py-0.5 text-[10px] text-fg-muted">
            {folderPath}
          </span>
        )}
      </button>
    );
  };

  const renderScopeGroup = (group: ScopeFolderGroup) => {
    const selectedCount = group.allSubtreeProjects.filter((p) => selectedIdSet.has(p.id)).length;
    const checkState: 'checked' | 'indeterminate' | 'unchecked' =
      selectedCount === group.allSubtreeProjects.length
        ? 'checked'
        : selectedCount > 0
          ? 'indeterminate'
          : 'unchecked';

    const isCollapsed = collapsedGroups[group.id] ?? false;
    const headerPadLeft = 8 + group.depth * 14;
    const projectPadLeft = headerPadLeft + 24;

    return (
      <div key={group.id} className="space-y-0.5">
        <div
          style={{ paddingLeft: `${headerPadLeft}px` }}
          className="flex items-center gap-1 rounded-lg py-1 pr-2 transition-colors hover:bg-tint"
        >
          <button
            type="button"
            aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
            onClick={() => toggleCollapse(group.id)}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-tint hover:text-fg"
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-150',
                !isCollapsed && 'rotate-90',
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => toggleGroupSelection(group.allSubtreeProjects)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5 text-left"
          >
            <SelectionCheckbox state={checkState} />
            <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
            <span className="truncate text-xs font-medium text-fg-bright">{group.name}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-fg-muted">
              {selectedCount}/{group.allSubtreeProjects.length}
            </span>
          </button>
        </div>

        {!isCollapsed && (
          <div className="space-y-0.5">
            {group.directProjects.map((project) => renderProjectRow(project, projectPadLeft))}
            {group.children.map((child) => renderScopeGroup(child))}
          </div>
        )}
      </div>
    );
  };

  const allSelected = projects.length > 0 && selectedProjects.length === projects.length;
  const noneSelected = selectedProjects.length === 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Filter analytics by projects"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
        className={cn(
          'flex h-9.5 w-60 cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3.5 text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none',
          isOpen
            ? 'border-amber-500/60 bg-elevated text-fg ring-2 ring-amber-500/15'
            : 'border-line bg-elevated text-fg shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] hover:border-line-strong hover:bg-elevated',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          {getProjectPreview()}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-fg-muted transition-transform duration-150',
            isOpen && 'rotate-180 text-fg-secondary',
          )}
        />
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[1200]" onClick={closeMenu} />
            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label="Project scope"
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="surface-elevated animate-popover fixed z-[1201] overflow-hidden rounded-xl"
            >
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-line-subtle bg-well/80 px-3 py-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter projects..."
                  className="w-full bg-transparent text-xs text-fg placeholder-fg-muted focus:outline-none"
                />
                {isSearching && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear filter"
                    className="rounded p-0.5 text-fg-muted transition-colors hover:cursor-pointer hover:text-fg"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick actions */}
              {projects.length > 0 && (
                <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2 text-[11px]">
                  <span className="font-mono tabular-nums text-fg-muted">
                    {selectedProjects.length} of {projects.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={allSelected}
                      onClick={() => applySelection(projects)}
                      className="cursor-pointer font-medium text-amber-400 transition-colors hover:text-amber-300 disabled:cursor-default disabled:opacity-40"
                    >
                      Select all
                    </button>
                    <span className="text-line-strong">·</span>
                    <button
                      type="button"
                      disabled={noneSelected}
                      onClick={() => applySelection([])}
                      className="cursor-pointer font-medium text-fg-secondary transition-colors hover:text-fg disabled:cursor-default disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Project / Folder list */}
              <div className="max-h-72 overflow-y-auto p-1.5">
                {projects.length === 0 && !isLoading ? (
                  <div className="px-3 py-4 text-center text-xs text-fg-muted">
                    No projects found
                  </div>
                ) : isSearching ? (
                  filteredProjects.length > 0 ? (
                    <div className="space-y-0.5">
                      {filteredProjects.map((project) => renderProjectRow(project))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-fg-muted">
                      No matching projects
                    </div>
                  )
                ) : hasFolders ? (
                  <div className="space-y-0.5">
                    {folderGroups.map((group) => renderScopeGroup(group))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {projects.map((project) => renderProjectRow(project))}
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
