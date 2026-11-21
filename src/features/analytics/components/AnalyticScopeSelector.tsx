import {
  buildFolderTree,
  Folder,
  FolderTreeNode,
  Project,
} from '@/shared/lib/models/project';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Check, ChevronDown, Folder as FolderIcon, Layers, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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

export default function AnalyticScopeSelector() {
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const { selectedProjects, setSelectedProjects } = useAnalytics();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<Project[]>('get_projects'),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

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
        color: '#64748B',
        depth: 0,
        directProjects: unassigned,
        allSubtreeProjects: unassigned,
        children: [],
      });
    }

    return { folderGroups: groups, hasFolders: anyFolders };
  }, [projects, folders]);

  function getProjectPreview() {
    const selectedProjectLength = selectedProjects.length;
    if (selectedProjectLength === 0) {
      return (
        <>
          <FolderIcon className="h-4 w-4 text-blue-400" />
          <span className="text-slate-400">Select Project</span>
        </>
      );
    } else if (selectedProjectLength === 1) {
      const currentProject = selectedProjects[0];
      return (
        <>
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: currentProject.color }}
          />
          <span className="truncate">{currentProject.name}</span>
        </>
      );
    } else {
      return (
        <>
          <Layers color="#3b82f6" />
          <span className="text-white">{selectedProjectLength} Selected</span>
        </>
      );
    }
  }

  async function applySelection(nextProjects: Project[]) {
    setSelectedProjects(nextProjects);

    await invoke('update_selected_projects', {
      projectIds: nextProjects.map((p) => p.id),
    });

    await queryClient.invalidateQueries({
      queryKey: ['analytics'],
    });
  }

  async function toggleProject(project: Project) {
    const isSelected = isProjectSelected(project);
    const nextProjects = isSelected
      ? selectedProjects.filter((p) => p.id !== project.id)
      : [...selectedProjects, project];
    await applySelection(nextProjects);
  }

  async function toggleGroup(groupProjects: Project[]) {
    const allSelected = groupProjects.every((p) => isProjectSelected(p));
    const groupIds = new Set(groupProjects.map((p) => p.id));
    const nextProjects = allSelected
      ? selectedProjects.filter((p) => !groupIds.has(p.id))
      : [
          ...selectedProjects,
          ...groupProjects.filter((p) => !selectedProjects.some((sp) => sp.id === p.id)),
        ];
    await applySelection(nextProjects);
  }

  function isProjectSelected(project: Project) {
    return selectedProjects.some((p) => p.id === project.id);
  }

  function renderScopeGroup(group: ScopeFolderGroup) {
    const allSelected = group.allSubtreeProjects.every((p) => isProjectSelected(p));
    const headerPadLeft = 12 + group.depth * 14;
    const projectPadLeft = headerPadLeft + 14;

    return (
      <div key={group.id}>
        <button
          type="button"
          onClick={() => toggleGroup(group.allSubtreeProjects)}
          style={{ paddingLeft: `${headerPadLeft}px` }}
          className="flex w-full items-center gap-2 bg-slate-900/40 py-1.5 pr-3 text-left text-xs font-semibold text-slate-300 transition-colors hover:cursor-pointer hover:bg-slate-700/50"
        >
          <FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto shrink-0 text-[10px] text-slate-400">
            {allSelected ? 'Deselect all' : 'Select all'}
          </span>
        </button>
        {group.directProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={async () => {
              await toggleProject(project);
            }}
            style={{ paddingLeft: `${projectPadLeft}px` }}
            className="flex w-full items-center gap-2.5 py-1.5 pr-3 text-left text-white transition-colors hover:cursor-pointer hover:bg-slate-700/50"
          >
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate text-sm font-medium">{project.name}</span>
            {isProjectSelected(project) ? (
              <Check className="ml-auto h-4 w-4 shrink-0 text-blue-400" />
            ) : (
              <X className="ml-auto h-4 w-4 shrink-0 text-slate-500" />
            )}
          </button>
        ))}
        {group.children.map((child) => renderScopeGroup(child))}
      </div>
    );
  }

  return (
    <div className="relative w-70">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white shadow-lg transition-all hover:cursor-pointer hover:border-blue-500"
      >
        <div className="flex items-center gap-3 overflow-hidden">{getProjectPreview()}</div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="animate-in fade-in zoom-in absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl duration-150">
          <div className="max-h-64 overflow-y-auto py-1">
            {projects.length === 0 && !isLoading && (
              <div className="px-4 py-3 text-sm text-slate-500 italic">No projects found...</div>
            )}

            {hasFolders
              ? folderGroups.map((group) => renderScopeGroup(group))
              : projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={async () => {
                      await toggleProject(project);
                    }}
                    className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-2.5 text-left text-white transition-colors last:border-0 hover:cursor-pointer hover:bg-slate-700/50"
                  >
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    {isProjectSelected(project) ? (
                      <Check className="ml-auto h-4 w-4 shrink-0 text-blue-400" />
                    ) : (
                      <X className="ml-auto h-4 w-4 shrink-0 text-slate-500" />
                    )}
                  </button>
                ))}
          </div>
        </div>
      )}

      {isOpen && <button className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
