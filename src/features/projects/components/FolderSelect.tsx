import {
  buildFolderTree,
  flattenFolderTree,
  Folder,
  FolderTreeNode,
} from '@/shared/lib/models/project';
import { Check, ChevronDown, CircleSlash, Folder as FolderIcon, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FolderSelectProps {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  excludeIds?: Set<string>;
  emptyLabel?: string;
  variant?: 'form' | 'inline';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function FolderSelect({
  folders,
  value,
  onChange,
  excludeIds,
  emptyLabel = 'No folder',
  variant = 'form',
  disabled = false,
  className = '',
  ariaLabel,
}: Readonly<FolderSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allNodes = useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);

  const options: FolderTreeNode[] = useMemo(() => {
    if (!excludeIds || excludeIds.size === 0) return allNodes;
    return allNodes.filter((node) => !excludeIds.has(node.folder.id));
  }, [allNodes, excludeIds]);

  const selectedNode = useMemo(
    () => (value ? allNodes.find((node) => node.folder.id === value) ?? null : null),
    [allNodes, value],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const filteredOptions = useMemo(() => {
    if (!isSearching) return options;
    return options.filter(
      (node) =>
        node.folder.name.toLowerCase().includes(trimmedQuery) ||
        node.pathLabel.toLowerCase().includes(trimmedQuery),
    );
  }, [options, isSearching, trimmedQuery]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minMenuWidth = variant === 'inline' ? 220 : rect.width;
    const width = Math.max(rect.width, minMenuWidth);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 260;

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

  const handleSelect = (folderId: string | null) => {
    onChange(folderId);
    closeMenu();
  };

  const triggerClasses =
    variant === 'inline'
      ? `inline-flex max-w-48 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen
            ? 'border-blue-500 bg-slate-800 text-white ring-2 ring-blue-500/20'
            : 'border-slate-200/10 bg-slate-900/55 text-blue-100 hover:border-blue-400/50 hover:bg-slate-800/80'
        }`
      : `flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-all hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen
            ? 'border-blue-500 bg-slate-700 text-white ring-2 ring-blue-500/30'
            : 'border-slate-500/70 bg-slate-700 text-white hover:border-blue-400/80'
        }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        title={selectedNode?.pathLabel ?? emptyLabel}
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
          {selectedNode ? (
            <>
              <FolderIcon
                className={`${variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0`}
                style={{ color: selectedNode.folder.color }}
              />
              <span className="truncate">
                {variant === 'inline' ? selectedNode.folder.name : selectedNode.pathLabel}
              </span>
            </>
          ) : (
            <>
              <CircleSlash
                className={`${variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-slate-400`}
              />
              <span className="truncate text-slate-300">{emptyLabel}</span>
            </>
          )}
        </span>
        <ChevronDown
          className={`${variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-slate-300 transition-transform ${
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
              {options.length > 5 && (
                <div className="flex items-center gap-2 border-b border-slate-700/80 px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search folders..."
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
              )}

              <div className="max-h-56 overflow-y-auto py-1">
                {!isSearching && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:cursor-pointer hover:bg-slate-700/70 ${
                      value === null ? 'bg-blue-500/15 font-medium text-white' : 'text-slate-300'
                    }`}
                  >
                    <CircleSlash
                      className={`h-3.5 w-3.5 shrink-0 ${
                        value === null ? 'text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{emptyLabel}</span>
                    {value === null && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-400" />}
                  </button>
                )}

                {!isSearching && options.length > 0 && (
                  <div className="my-1 border-t border-slate-700/70" />
                )}

                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2.5 text-center text-xs text-slate-400 italic">
                    {isSearching ? 'No matching folders' : 'No folders yet'}
                  </div>
                ) : (
                  filteredOptions.map((node) => {
                    const isSelected = value === node.folder.id;
                    const indentPx = isSearching ? 12 : 12 + node.depth * 14;

                    return (
                      <button
                        key={node.folder.id}
                        type="button"
                        title={node.pathLabel}
                        onClick={() => handleSelect(node.folder.id)}
                        style={{ paddingLeft: `${indentPx}px` }}
                        className={`flex w-full items-center gap-2.5 py-1.5 pr-3 text-left text-sm transition-colors hover:cursor-pointer hover:bg-slate-700/70 ${
                          isSelected ? 'bg-blue-500/15 font-medium text-white' : 'text-slate-100'
                        }`}
                      >
                        <FolderIcon
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: node.folder.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {isSearching ? node.pathLabel : node.folder.name}
                        </span>
                        {isSelected && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
