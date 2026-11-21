export interface Folder {
  id: string;
  name: string;
  color: string;
  parent_id?: string | null;
  is_deleted?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  folder_id?: string | null;
  is_deleted?: number;
}

export interface TimerProjectsResponse {
  recommended: Project[];
  projects: Project[];
  folders: Folder[];
}

export interface FolderTreeNode {
  folder: Folder;
  depth: number;
  pathLabel: string;
  children: FolderTreeNode[];
}

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const childrenByParent = new Map<string | null, Folder[]>();

  for (const folder of folders) {
    const validParent =
      folder.parent_id && folder.parent_id !== folder.id && folderMap.has(folder.parent_id)
        ? folder.parent_id
        : null;
    const siblings = childrenByParent.get(validParent) ?? [];
    siblings.push(folder);
    childrenByParent.set(validParent, siblings);
  }

  const visited = new Set<string>();

  function buildNodes(parentId: string | null, depth: number, prefix: string): FolderTreeNode[] {
    const list = childrenByParent.get(parentId) ?? [];
    const nodes: FolderTreeNode[] = [];
    for (const folder of list) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      const pathLabel = prefix ? `${prefix} / ${folder.name}` : folder.name;
      nodes.push({
        folder,
        depth,
        pathLabel,
        children: buildNodes(folder.id, depth + 1, pathLabel),
      });
    }
    return nodes;
  }

  const roots = buildNodes(null, 0, '');

  // Append any remaining folders (e.g. from an unexpected cycle) as root nodes so none are lost.
  for (const folder of folders) {
    if (!visited.has(folder.id)) {
      visited.add(folder.id);
      roots.push({
        folder,
        depth: 0,
        pathLabel: folder.name,
        children: buildNodes(folder.id, 1, folder.name),
      });
    }
  }

  return roots;
}

export function flattenFolderTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  const result: FolderTreeNode[] = [];
  const walk = (list: FolderTreeNode[]) => {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function getDescendantFolderIds(folderId: string, folders: Folder[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parent_id) {
      const list = childrenByParent.get(folder.parent_id) ?? [];
      list.push(folder.id);
      childrenByParent.set(folder.parent_id, list);
    }
  }

  const result = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}

export function getAncestorFolderIds(folderId: string, folders: Folder[]): string[] {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const chain: string[] = [];
  const visited = new Set<string>();
  let cursor: string | null | undefined = folderId;

  while (cursor && !visited.has(cursor)) {
    const folder = folderMap.get(cursor);
    if (!folder) break;
    visited.add(cursor);
    chain.push(folder.id);
    cursor = folder.parent_id;
  }

  return chain.reverse();
}

export function getFolderPathMap(folders: Folder[]): Map<string, string> {
  const flat = flattenFolderTree(buildFolderTree(folders));
  return new Map(flat.map((node) => [node.folder.id, node.pathLabel]));
}
